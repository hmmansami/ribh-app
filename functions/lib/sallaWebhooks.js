/**
 * SALLA WEBHOOKS - Complete Event Handler
 * 
 * Handles ALL Salla webhook events for cart recovery loop:
 * - cart.abandoned → Start recovery sequence
 * - order.created → Cancel recovery + celebrate
 * - order.updated → Update analytics
 * - customer.created → Welcome sequence
 * - app.installed/uninstalled → Store management
 * 
 * PRINCIPLES:
 * - Zero cost (Salla webhooks are FREE)
 * - Bulletproof - never lose a cart, never miss an order
 * - Fast - respond quickly, do heavy work async
 */

const crypto = require('crypto');
const eventTracker = require('./eventTracker');

// Predictive Analytics & RFM Segmentation
const { getCustomerPredictions, updateAllPredictions } = require('./predictiveAnalytics');
const { segmentCustomer, runDailySegmentation } = require('./rfmSegmentation');

// ==========================================
// PHONE NUMBER UTILITIES (Saudi +966)
// ==========================================

/**
 * Normalize Saudi phone number to +966 format
 * Handles all common input formats:
 * - 0501234567 → +966501234567
 * - 501234567 → +966501234567
 * - 966501234567 → +966501234567
 * - +966501234567 → +966501234567
 * - 00966501234567 → +966501234567
 */
function normalizeSaudiPhone(phone) {
    if (!phone) return null;
    
    // Remove all non-digits except leading +
    let cleaned = String(phone).replace(/[^\d+]/g, '');
    
    // Remove leading + for processing
    const hadPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/^\+/, '');
    
    // Remove leading 00 (international prefix)
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }
    
    // Already has 966 country code
    if (cleaned.startsWith('966')) {
        // Remove 966 to check the local part
        const local = cleaned.substring(3);
        // Saudi mobile numbers: 5xxxxxxxx (9 digits)
        if (local.length === 9 && local.startsWith('5')) {
            return '+966' + local;
        }
        // Might be landline or other format
        if (local.length >= 7) {
            return '+966' + local;
        }
    }
    
    // Starts with 0 (local format: 05xxxxxxxx)
    if (cleaned.startsWith('0')) {
        const local = cleaned.substring(1);
        if (local.length === 9 && local.startsWith('5')) {
            return '+966' + local;
        }
        // Other Saudi numbers (landlines start with 01x, 02x, etc.)
        if (local.length >= 7) {
            return '+966' + local;
        }
    }
    
    // Starts with 5 (just the mobile part: 5xxxxxxxx)
    if (cleaned.startsWith('5') && cleaned.length === 9) {
        return '+966' + cleaned;
    }
    
    // If it's a valid-looking number but we're not sure, add 966
    if (cleaned.length >= 9 && cleaned.length <= 12) {
        // Assume it's missing the country code
        if (!cleaned.startsWith('966')) {
            return '+966' + cleaned;
        }
        return '+' + cleaned;
    }
    
    // Return original if we can't normalize (might be international)
    return phone;
}

/**
 * Validate if phone is a Saudi mobile number
 */
function isSaudiMobile(phone) {
    const normalized = normalizeSaudiPhone(phone);
    if (!normalized) return false;
    
    // Saudi mobiles: +9665xxxxxxxx (12 digits total with +)
    return /^\+9665\d{8}$/.test(normalized);
}

/**
 * Extract phone from various Salla customer data structures
 */
function extractCustomerPhone(data) {
    // Try all possible phone field locations
    const phoneFields = [
        data?.customer?.mobile,
        data?.customer?.phone,
        data?.mobile,
        data?.phone,
        data?.billing_address?.phone,
        data?.shipping_address?.phone,
        data?.addresses?.[0]?.phone,
    ];
    
    for (const phone of phoneFields) {
        if (phone) {
            const normalized = normalizeSaudiPhone(phone);
            if (normalized) return normalized;
        }
    }
    
    return null;
}

/**
 * Extract customer email from various locations
 */
function extractCustomerEmail(data) {
    return data?.customer?.email || 
           data?.email || 
           data?.billing_address?.email ||
           null;
}

/**
 * Extract customer name from various locations
 */
function extractCustomerName(data) {
    // Try full name first
    if (data?.customer?.name) return data.customer.name;
    if (data?.customer?.first_name) {
        const last = data.customer.last_name || '';
        return `${data.customer.first_name} ${last}`.trim();
    }
    if (data?.name) return data.name;
    if (data?.first_name) return data.first_name;
    
    // Try from addresses
    if (data?.billing_address?.name) return data.billing_address.name;
    if (data?.shipping_address?.name) return data.shipping_address.name;
    
    return 'عميل'; // Default: "Customer" in Arabic
}

// ==========================================
// SIGNATURE VERIFICATION
// ==========================================

/**
 * Verify Salla webhook signature for security
 * Salla sends: x-salla-signature header with HMAC-SHA256
 */
function verifySallaSignature(payload, signature, secret) {
    if (!signature || !secret) {
        // Skip verification if not configured (development mode)
        console.log('⚠️ Webhook signature verification skipped (no secret configured)');
        return true;
    }
    
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');
    
    // Timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch (e) {
        // If lengths differ, timingSafeEqual throws
        return false;
    }
}

// ==========================================
// EVENT PARSERS
// ==========================================

/**
 * Parse cart.abandoned event data
 */
function parseAbandonedCart(data, merchant) {
    const items = (data.items || data.products || []).map(item => ({
        id: item.id || item.product_id,
        name: item.name || item.product_name || item.title || 'منتج',
        quantity: item.quantity || 1,
        price: item.price || item.amount || 0,
        image: item.image || item.thumbnail || item.images?.[0]?.url,
        sku: item.sku
    }));
    
    return {
        id: data.id || data.cart_id || `cart_${Date.now()}`,
        merchant: merchant?.id || merchant,
        merchantName: merchant?.name || data.store?.name || 'المتجر',
        
        customer: {
            id: data.customer?.id,
            name: extractCustomerName(data),
            phone: extractCustomerPhone(data),
            email: extractCustomerEmail(data)
        },
        
        items,
        itemCount: items.length,
        total: data.total || data.grand_total || data.sub_total || 0,
        currency: data.currency?.code || data.currency || 'SAR',
        
        // Recovery URLs
        checkoutUrl: data.checkout_url || data.recovery_url || data.cart_url,
        storeUrl: data.store?.url || data.merchant_url,
        
        // Timestamps
        createdAt: data.created_at || new Date().toISOString(),
        abandonedAt: new Date().toISOString(),
        
        // Raw data for debugging
        _raw: data
    };
}

/**
 * Parse order.created event data
 */
function parseOrderCreated(data, merchant) {
    const items = (data.items || data.products || []).map(item => ({
        id: item.id || item.product_id,
        name: item.name || item.product_name || item.title,
        quantity: item.quantity || 1,
        price: item.price || item.amount || 0
    }));
    
    return {
        id: data.id || data.order_id || data.reference_id,
        referenceId: data.reference_id || data.id,
        merchant: merchant?.id || merchant,
        
        customer: {
            id: data.customer?.id,
            name: extractCustomerName(data),
            phone: extractCustomerPhone(data),
            email: extractCustomerEmail(data)
        },
        
        items,
        total: data.total || data.grand_total || data.amounts?.total?.amount || 0,
        subtotal: data.sub_total || data.amounts?.sub_total?.amount || 0,
        currency: data.currency?.code || data.currency || 'SAR',
        
        status: data.status?.name || data.status || 'created',
        paymentMethod: data.payment_method || data.payment?.method,
        
        // Used to match with abandoned cart
        cartId: data.cart_id || data.checkout_id,
        
        createdAt: data.created_at || data.date?.date || new Date().toISOString(),
        
        _raw: data
    };
}

/**
 * Parse order.updated event data
 */
function parseOrderUpdated(data, merchant) {
    return {
        id: data.id || data.order_id,
        referenceId: data.reference_id,
        merchant: merchant?.id || merchant,
        
        customer: {
            id: data.customer?.id,
            name: extractCustomerName(data),
            phone: extractCustomerPhone(data),
            email: extractCustomerEmail(data)
        },
        
        oldStatus: data.old_status?.name || data.old_status,
        newStatus: data.status?.name || data.status,
        
        total: data.total || data.grand_total || 0,
        
        updatedAt: data.updated_at || new Date().toISOString(),
        
        _raw: data
    };
}

/**
 * Parse customer.created event data
 */
function parseCustomerCreated(data, merchant) {
    return {
        id: data.id || data.customer_id,
        merchant: merchant?.id || merchant,
        
        name: extractCustomerName(data),
        firstName: data.first_name || data.name?.split(' ')[0],
        lastName: data.last_name || data.name?.split(' ').slice(1).join(' '),
        
        phone: extractCustomerPhone(data),
        email: extractCustomerEmail(data),
        
        // Customer metadata
        gender: data.gender,
        birthday: data.birthday,
        
        createdAt: data.created_at || new Date().toISOString(),
        
        _raw: data
    };
}

// ==========================================
// WEBHOOK HANDLER CLASS
// ==========================================

class SallaWebhookHandler {
    constructor(options = {}) {
        this.webhookSecret = options.webhookSecret || process.env.SALLA_WEBHOOK_SECRET;
        this.onCartAbandoned = options.onCartAbandoned || this.defaultCartHandler;
        this.onOrderCreated = options.onOrderCreated || this.defaultOrderHandler;
        this.onOrderUpdated = options.onOrderUpdated || this.defaultOrderUpdateHandler;
        this.onCheckoutStarted = options.onCheckoutStarted || this.defaultCheckoutHandler;
        this.onCustomerCreated = options.onCustomerCreated || this.defaultCustomerHandler;
        this.onAppInstalled = options.onAppInstalled || this.defaultAppInstalledHandler;
        this.onAppUninstalled = options.onAppUninstalled || this.defaultAppUninstalledHandler;
        this.onUnknownEvent = options.onUnknownEvent || this.defaultUnknownHandler;
        this.logger = options.logger || console;
    }
    
    /**
     * Main webhook handler - call this from your Express route
     */
    async handleWebhook(req, res) {
        const startTime = Date.now();
        
        try {
            const event = req.body;
            const eventType = event.event || 'unknown';
            
            this.logger.log(`📨 Salla webhook: ${eventType}`, {
                merchant: event.merchant?.id || event.merchant,
                timestamp: event.created_at
            });
            
            // Verify signature (optional but recommended)
            const signature = req.headers['x-salla-signature'];
            if (this.webhookSecret && !verifySallaSignature(req.body, signature, this.webhookSecret)) {
                this.logger.warn('⚠️ Invalid webhook signature');
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid signature' 
                });
            }
            
            // Respond immediately (Salla expects fast response)
            res.status(200).json({
                success: true,
                message: 'Webhook received',
                app: 'ribh',
                timestamp: new Date().toISOString(),
                processingTime: `${Date.now() - startTime}ms`
            });
            
            // Process event asynchronously (don't block response)
            setImmediate(async () => {
                try {
                    await this.processEvent(event);
                } catch (error) {
                    this.logger.error('❌ Async webhook processing error:', error);
                }
            });
            
        } catch (error) {
            this.logger.error('❌ Webhook handler error:', error);
            
            // Still try to respond with 200 to prevent retries
            if (!res.headersSent) {
                res.status(200).json({
                    success: true,
                    message: 'Webhook received (with errors)',
                    error: error.message
                });
            }
        }
    }
    
    /**
     * Process event after response is sent
     */
    async processEvent(event) {
        const eventType = event.event || '';
        const merchant = event.merchant;
        const data = event.data;
        
        // Route to appropriate handler
        switch (eventType) {
            // Cart abandonment events (Salla may use different names)
            case 'cart.abandoned':
            case 'abandoned_cart.created':
            case 'abandoned.cart':
            case 'checkout.abandoned':
                await this.onCartAbandoned(parseAbandonedCart(data, merchant), event);
                break;
            
            // Order created events
            case 'order.created':
            case 'order.create':
            case 'orders.created':
                await this.onOrderCreated(parseOrderCreated(data, merchant), event);
                break;
            
            // Order updated events
            case 'order.updated':
            case 'order.update':
            case 'order.status.updated':
            case 'orders.updated':
                await this.onOrderUpdated(parseOrderUpdated(data, merchant), event);
                break;
            
            // Checkout started events
            case 'checkout.started':
            case 'checkout.start':
            case 'checkout.created':
            case 'checkout.initiated':
                await this.onCheckoutStarted(parseAbandonedCart(data, merchant), event);
                break;
            
            // Customer events
            case 'customer.created':
            case 'customer.create':
            case 'customers.created':
                await this.onCustomerCreated(parseCustomerCreated(data, merchant), event);
                break;
            
            // App lifecycle events
            case 'app.installed':
            case 'app.store.authorize':
            case 'app.authorized':
                await this.onAppInstalled(data, merchant, event);
                break;
            
            case 'app.uninstalled':
            case 'app.store.revoke':
                await this.onAppUninstalled(merchant, event);
                break;
            
            // Unknown events
            default:
                await this.onUnknownEvent(eventType, data, merchant, event);
        }
    }
    
    // Default handlers (override these)
    
    async defaultCartHandler(cart, rawEvent) {
        this.logger.log('🛒 Abandoned cart:', {
            id: cart.id,
            customer: cart.customer.name,
            phone: cart.customer.phone,
            total: cart.total,
            items: cart.itemCount
        });
        
        // Track cart abandonment event
        const storeId = String(cart.merchant);
        const customerId = String(cart.customer?.id || cart.customer?.phone || 'unknown');
        
        if (storeId && customerId !== 'unknown') {
            try {
                // Track the cart abandoned event
                await eventTracker.trackEvent(storeId, customerId, eventTracker.EVENT_TYPES.CART_ADD, {
                    cartId: cart.id,
                    cartValue: cart.total,
                    itemCount: cart.itemCount,
                    items: cart.items,
                    checkoutUrl: cart.checkoutUrl,
                    source: 'salla_webhook',
                    abandoned: true
                });
                
                // Detect cart abandonment for this store (triggers automation)
                const abandonments = await eventTracker.detectCartAbandon(storeId, 1);
                this.logger.log(`📊 Event tracked + abandon detection: ${abandonments.length} carts found`);
            } catch (err) {
                this.logger.error('❌ Event tracking error (cart):', err.message);
            }
        }
    }
    
    async defaultOrderHandler(order, rawEvent) {
        this.logger.log('💰 Order created:', {
            id: order.id,
            customer: order.customer.name,
            total: order.total,
            status: order.status
        });
        
        // Track order placed event
        const storeId = String(order.merchant);
        const customerId = String(order.customer?.id || order.customer?.phone || 'unknown');
        
        if (storeId && customerId !== 'unknown') {
            try {
                // Track order in event system
                await eventTracker.trackOrderPlaced(storeId, customerId, {
                    id: order.id,
                    total: order.total,
                    items: order.items,
                    referenceId: order.referenceId,
                    paymentMethod: order.paymentMethod
                });
                this.logger.log('📊 Order tracked in event system');
            } catch (err) {
                this.logger.error('❌ Event tracking error (order):', err.message);
            }
            
            // Update predictive analytics and RFM segmentation for customer
            try {
                // Run predictions and segmentation in parallel
                const [predictions, segment] = await Promise.all([
                    getCustomerPredictions(storeId, customerId),
                    segmentCustomer(storeId, customerId)
                ]);
                
                this.logger.log('📊 Customer analytics updated:', {
                    customerId,
                    churnRisk: predictions?.churnRisk,
                    segment: segment?.segment,
                    predictedCLV: predictions?.predictedCLV
                });
            } catch (e) {
                this.logger.error('⚠️ Analytics update failed:', e.message);
            }
        }
    }
    
    async defaultOrderUpdateHandler(order, rawEvent) {
        this.logger.log('📦 Order updated:', {
            id: order.id,
            oldStatus: order.oldStatus,
            newStatus: order.newStatus
        });
    }
    
    async defaultCheckoutHandler(checkout, rawEvent) {
        this.logger.log('🛍️ Checkout started:', {
            total: checkout.total,
            itemCount: checkout.itemCount
        });
        
        // Track checkout start event
        const storeId = String(checkout.merchant);
        const customerId = String(checkout.customer?.id || checkout.customer?.phone || 'unknown');
        
        if (storeId && customerId !== 'unknown') {
            try {
                await eventTracker.trackCheckoutStart(storeId, customerId, {
                    total: checkout.total,
                    items: checkout.items,
                    itemCount: checkout.itemCount || checkout.items?.length || 0
                });
                this.logger.log('📊 Checkout start tracked');
            } catch (err) {
                this.logger.error('❌ Event tracking error (checkout):', err.message);
            }
        }
    }
    
    async defaultCustomerHandler(customer, rawEvent) {
        this.logger.log('👤 Customer created:', {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email
        });
        
        // Track customer signup event
        const storeId = String(customer.merchant);
        const customerId = String(customer.id || customer.phone || 'unknown');
        
        if (storeId && customerId !== 'unknown') {
            try {
                // Track signup in event system
                await eventTracker.trackEvent(storeId, customerId, eventTracker.EVENT_TYPES.SIGNUP, {
                    name: customer.name,
                    email: customer.email,
                    phone: customer.phone,
                    source: 'salla_webhook'
                });
                this.logger.log('📊 Customer signup tracked');
            } catch (err) {
                this.logger.error('❌ Event tracking error (customer):', err.message);
            }
            
            // Initialize predictions for new customer (baseline)
            try {
                const predictions = await getCustomerPredictions(storeId, customerId);
                this.logger.log('🔮 New customer predictions initialized:', {
                    customerId,
                    churnRisk: predictions?.churnRisk,
                    segment: 'new_customers'
                });
            } catch (e) {
                // New customers may have no orders yet - that's expected
                this.logger.log('📝 New customer baseline set (no orders yet)');
            }
        }
    }
    
    async defaultAppInstalledHandler(data, merchant, rawEvent) {
        this.logger.log('🚀 App installed:', { merchant: merchant?.id || merchant });
    }
    
    async defaultAppUninstalledHandler(merchant, rawEvent) {
        this.logger.log('👋 App uninstalled:', { merchant: merchant?.id || merchant });
    }
    
    async defaultUnknownHandler(eventType, data, merchant, rawEvent) {
        this.logger.log(`📌 Unknown event: ${eventType}`, { merchant: merchant?.id || merchant });
    }
}

// ==========================================
// EXPRESS MIDDLEWARE FACTORY
// ==========================================

/**
 * Create Express middleware for Salla webhooks
 * 
 * Usage:
 * const sallaWebhook = createSallaWebhookMiddleware({
 *     onCartAbandoned: async (cart) => { ... },
 *     onOrderCreated: async (order) => { ... }
 * });
 * 
 * app.post('/webhooks/salla', sallaWebhook);
 */
function createSallaWebhookMiddleware(options = {}) {
    const handler = new SallaWebhookHandler(options);
    return (req, res) => handler.handleWebhook(req, res);
}

// ==========================================
// SCHEDULED TRIGGER CRON
// ==========================================

/**
 * Process scheduled triggers for a store (call from cron job)
 * 
 * Usage in Firebase Functions:
 * exports.processScheduledTriggers = functions.pubsub
 *     .schedule('every 5 minutes')
 *     .onRun(async () => {
 *         const stores = await getActiveStores();
 *         for (const storeId of stores) {
 *             await processStoreTriggers(storeId);
 *         }
 *     });
 */
async function processStoreTriggers(storeId) {
    try {
        const result = await eventTracker.processScheduledTriggers(storeId);
        console.log(`⏰ Processed triggers for store ${storeId}:`, {
            processed: result.processed,
            results: result.results?.map(r => r.flow || r.error).filter(Boolean)
        });
        return result;
    } catch (err) {
        console.error(`❌ Error processing triggers for store ${storeId}:`, err.message);
        return { error: err.message };
    }
}

// ==========================================
// SCHEDULED JOBS (CRON TRIGGERS)
// ==========================================

/**
 * Daily cron job to update all predictions and RFM segmentation
 * Call this from Firebase scheduled function or external cron
 * 
 * Usage (Firebase Functions):
 * exports.dailyAnalytics = functions.pubsub.schedule('0 3 * * *').onRun(async () => {
 *     await runDailyAnalytics('your-store-id');
 * });
 */
async function runDailyAnalytics(storeId) {
    const startTime = Date.now();
    console.log(`🔄 [Daily Analytics] Starting for store ${storeId}`);
    
    const results = {
        storeId,
        startedAt: new Date().toISOString(),
        predictions: null,
        segmentation: null,
        errors: []
    };
    
    // Run predictions update
    try {
        results.predictions = await updateAllPredictions(storeId);
        console.log(`✅ [Predictions] Completed: ${results.predictions.processed} customers`);
    } catch (e) {
        console.error('❌ [Predictions] Failed:', e.message);
        results.errors.push({ step: 'predictions', error: e.message });
    }
    
    // Run RFM segmentation
    try {
        results.segmentation = await runDailySegmentation(storeId);
        console.log(`✅ [RFM] Completed: ${results.segmentation.total} customers segmented`);
    } catch (e) {
        console.error('❌ [RFM] Failed:', e.message);
        results.errors.push({ step: 'segmentation', error: e.message });
    }
    
    results.completedAt = new Date().toISOString();
    results.durationMs = Date.now() - startTime;
    
    console.log(`🏁 [Daily Analytics] Completed in ${results.durationMs}ms`, {
        predictions: results.predictions?.processed || 0,
        segments: results.segmentation?.total || 0,
        errors: results.errors.length
    });
    
    return results;
}

/**
 * Run daily analytics for multiple stores
 */
async function runDailyAnalyticsAllStores(storeIds) {
    const results = [];
    
    for (const storeId of storeIds) {
        try {
            const result = await runDailyAnalytics(storeId);
            results.push(result);
        } catch (e) {
            results.push({ storeId, error: e.message });
        }
    }
    
    return results;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Main handler class
    SallaWebhookHandler,
    
    // Middleware factory
    createSallaWebhookMiddleware,
    
    // Cron function for scheduled triggers (abandonment detection)
    processStoreTriggers,
    
    // Phone utilities
    normalizeSaudiPhone,
    isSaudiMobile,
    extractCustomerPhone,
    extractCustomerEmail,
    extractCustomerName,
    
    // Signature verification
    verifySallaSignature,
    
    // Event parsers (for testing/custom use)
    parseAbandonedCart,
    parseOrderCreated,
    parseOrderUpdated,
    parseCustomerCreated,
    
    // Scheduled jobs (cron triggers)
    runDailyAnalytics,
    runDailyAnalyticsAllStores,
    
    // Re-export eventTracker for convenience
    eventTracker
};
