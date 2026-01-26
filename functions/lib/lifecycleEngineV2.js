/**
 * LIFECYCLE ENGINE V2 - Fully Integrated
 * 
 * WIRES EVERYTHING TOGETHER:
 * - SequenceEngine for multi-step flows (not setTimeout!)
 * - WhatsApp via whatsappClient (HTTP to Render bridge)
 * - AI offers via offerGenerator
 * - AntiBan integrated in the flow
 * 
 * FLOW:
 * Cart Abandoned → SequenceEngine.startSequence() + Immediate WhatsApp
 * Order Created → SequenceEngine.cancelSequence() + Start post-purchase
 * Every 5min → processPendingSteps() via keep-alive
 */

const fs = require('fs');
const path = require('path');

// ==========================================
// MODULE IMPORTS (with graceful fallbacks)
// ==========================================

let offerGenerator;
try {
    offerGenerator = require('./offerGenerator');
    console.log('✅ [LifecycleV2] Offer Generator loaded');
} catch (e) {
    console.log('⚠️ [LifecycleV2] Offer generator not available');
    offerGenerator = null;
}

let emailSender;
try {
    emailSender = require('./emailSender');
    console.log('✅ [LifecycleV2] Email Sender loaded');
} catch (e) {
    console.log('⚠️ [LifecycleV2] Email sender not available');
    emailSender = null;
}

let sequenceEngine;
try {
    sequenceEngine = require('./sequenceEngine');
    console.log('✅ [LifecycleV2] Sequence Engine loaded');
} catch (e) {
    console.log('⚠️ [LifecycleV2] Sequence engine not available');
    sequenceEngine = null;
}

// WhatsApp Client - HTTP calls to Render bridge (THE KEY INTEGRATION!)
let whatsappClient;
try {
    whatsappClient = require('./whatsappClient');
    console.log('✅ [LifecycleV2] WhatsApp Client loaded (HTTP → Render Bridge)');
} catch (e) {
    console.log('⚠️ [LifecycleV2] WhatsApp client not available');
    whatsappClient = null;
}

let referralSystem;
try {
    referralSystem = require('./referralSystem');
    console.log('✅ [LifecycleV2] Referral System loaded');
} catch (e) {
    referralSystem = null;
}

// ==========================================
// DATA STORAGE
// ==========================================

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORES_FILE = path.join(DATA_DIR, 'stores.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const EVENTS_LOG = path.join(DATA_DIR, 'events.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file) {
    try { 
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8')); 
    }
    catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function logEvent(event, data) {
    const events = readJSON(EVENTS_LOG);
    events.push({
        timestamp: new Date().toISOString(),
        event,
        ...data
    });
    // Keep last 1000 events
    if (events.length > 1000) events.splice(0, events.length - 1000);
    writeJSON(EVENTS_LOG, events);
}

// ==========================================
// MAIN EVENT PROCESSOR
// ==========================================

/**
 * Process any store event - routes to appropriate handler
 */
async function processEvent(eventType, merchantId, data) {
    console.log(`🧠 [LifecycleV2] Processing: ${eventType} for merchant ${merchantId}`);
    logEvent(eventType, { merchantId, dataKeys: Object.keys(data || {}) });

    const stores = readJSON(STORES_FILE);
    const store = stores.find(s => String(s.merchant) === String(merchantId));

    if (!store) {
        console.log(`❌ [LifecycleV2] Store not found: ${merchantId}`);
        return { success: false, error: 'store_not_found' };
    }

    try {
        switch (eventType) {
            case 'customer.created':
            case 'app.installed':
                return await handleNewCustomer(store, data);

            case 'cart.abandoned':
            case 'abandoned_cart.created':
                return await handleAbandonedCart(store, data);

            case 'order.created':
            case 'order.completed':
                return await handleOrderCreated(store, data);

            default:
                console.log(`⚠️ [LifecycleV2] Unknown event type: ${eventType}`);
                return { success: false, error: 'unknown_event' };
        }
    } catch (error) {
        console.error(`❌ [LifecycleV2] Error processing ${eventType}:`, error);
        logEvent('error', { eventType, error: error.message });
        return { success: false, error: error.message };
    }
}

// ==========================================
// ATTRACTION: New Customer Welcome
// ==========================================

async function handleNewCustomer(store, data) {
    const email = data.email || data.customer?.email;
    const phone = data.mobile || data.phone || data.customer?.mobile;
    const name = data.name || data.customer?.name || 'عميلنا';

    if (!email && !phone) {
        return { success: false, error: 'no_contact_info' };
    }

    console.log(`🎉 [Attraction] New customer: ${email || phone}`);

    // Track customer
    const customers = readJSON(CUSTOMERS_FILE);
    const existingCustomer = customers.find(c => 
        (email && c.email === email) || 
        (phone && c.phone === phone)
    );

    if (!existingCustomer) {
        customers.push({
            storeId: store.merchant,
            email,
            phone,
            name,
            firstSeen: new Date().toISOString(),
            lastPurchase: null,
            totalOrders: 0
        });
        writeJSON(CUSTOMERS_FILE, customers);
    }

    // Generate AI welcome offer
    let offer;
    if (offerGenerator) {
        offer = await offerGenerator.createOffer(store, 'attraction', {
            customerEmail: email,
            customerName: name
        });
    } else {
        offer = {
            headline: "🎁 هدية ترحيبية خاصة!",
            fullMessage: "أهلاً بك! احصل على خصم 15% على طلبك الأول",
            discount: 15
        };
    }

    // Send WhatsApp welcome (if phone available)
    if (whatsappClient && phone) {
        try {
            const message = `${offer.headline}\n\n${offer.fullMessage}`;
            await whatsappClient.sendMessage(store.merchant, phone, message);
            console.log(`📱 [Attraction] WhatsApp welcome sent to ${phone}`);
        } catch (e) {
            console.log(`⚠️ [Attraction] WhatsApp failed: ${e.message}`);
        }
    }

    return { success: true, offer, channel: phone ? 'whatsapp' : 'email' };
}

// ==========================================
// CONVERSION: Abandoned Cart Recovery
// ==========================================

async function handleAbandonedCart(store, data) {
    const email = data.email || data.customer?.email;
    const phone = data.mobile || data.phone || data.customer?.mobile;
    const customerName = data.customer?.name || data.name || 'عميلنا';
    const cartValue = data.total || data.cart_total || 0;
    const products = data.products || data.items || [];
    const checkoutUrl = data.checkout_url || data.checkoutUrl || '#';

    if (!email && !phone) {
        return { success: false, error: 'no_contact_info' };
    }

    console.log(`🛒 [Conversion] Abandoned cart: ${email || phone} - Value: ${cartValue}`);

    // ==========================================
    // STEP 1: Generate AI Offer
    // ==========================================
    let offer;
    if (offerGenerator) {
        offer = await offerGenerator.createOffer(store, 'conversion', {
            products,
            customerEmail: email,
            cartValue,
            customerData: await getCustomerData(store.merchant, email, phone)
        });
        console.log(`🤖 AI Generated Offer: ${offer.headline}`);
    } else {
        let discount = 5;
        if (cartValue > 500) discount = 10;
        if (cartValue > 1000) discount = 15;
        offer = {
            headline: "🛒 سلتك تنتظرك!",
            fullMessage: `أكمل طلبك واحصل على خصم ${discount}%`,
            discount,
            urgency: "العرض صالح لمدة ساعتين فقط"
        };
    }

    // ==========================================
    // STEP 2: Start Multi-Step Sequence (Email)
    // ==========================================
    if (sequenceEngine && email) {
        sequenceEngine.startSequence('cart_recovery', store.merchant, email, {
            storeName: store.merchantName || 'متجر رِبح',
            checkoutUrl,
            cartValue,
            products,
            phone, // Store phone for later WhatsApp steps
            customerName,
            offer // Pass the AI offer to the sequence
        });
        console.log(`📧 [Conversion] Multi-step email sequence started for ${email}`);
    }

    // ==========================================
    // STEP 3: IMMEDIATE WhatsApp (First Touch!)
    // This is the key - WhatsApp goes out NOW, not via setTimeout
    // ==========================================
    if (whatsappClient && phone) {
        try {
            // Check if merchant has WhatsApp connected
            const isConnected = await whatsappClient.isConnected(store.merchant);
            
            if (isConnected) {
                const result = await whatsappClient.sendCartRecovery(store.merchant, {
                    phone,
                    customerName,
                    cartValue,
                    items: products,
                    checkoutUrl,
                    discount: offer.discount || 0
                });

                if (result.success) {
                    console.log(`📱 [Conversion] WhatsApp cart recovery sent to ${phone}`);
                    logEvent('whatsapp_sent', { 
                        merchantId: store.merchant, 
                        phone, 
                        type: 'cart_recovery',
                        queued: result.queued,
                        scheduledAt: result.scheduledAt
                    });
                } else {
                    console.log(`⚠️ [Conversion] WhatsApp queued/delayed: ${result.message}`);
                }
            } else {
                console.log(`⚠️ [Conversion] WhatsApp not connected for ${store.merchant}`);
            }
        } catch (e) {
            console.error(`❌ [Conversion] WhatsApp error:`, e.message);
        }
    }

    return { 
        success: true, 
        offer,
        sequenceStarted: !!sequenceEngine && !!email,
        whatsappSent: !!whatsappClient && !!phone
    };
}

// ==========================================
// UPSELL & LOYALTY: Order Completed
// ==========================================

async function handleOrderCreated(store, data) {
    const email = data.email || data.customer?.email;
    const phone = data.mobile || data.phone || data.customer?.mobile;
    const customerName = data.customer?.name || data.name || 'عميلنا';
    const products = data.products || data.items || [];
    const orderValue = data.total || data.order_total || 0;
    const storeUrl = data.store_url || `https://${store.merchant}.salla.sa`;

    if (!email && !phone) {
        return { success: false, error: 'no_contact_info' };
    }

    console.log(`💰 [Upsell] Order completed: ${email || phone} - Value: ${orderValue}`);

    // ==========================================
    // STEP 1: CANCEL CART RECOVERY SEQUENCE!
    // This is CRITICAL - stop bugging them about the cart
    // ==========================================
    if (sequenceEngine && email) {
        sequenceEngine.cancelSequence('cart_recovery', store.merchant, email);
        console.log(`✅ [Upsell] Cancelled cart_recovery sequence for ${email}`);
    }

    // ==========================================
    // STEP 2: Update Customer Record
    // ==========================================
    const customers = readJSON(CUSTOMERS_FILE);
    let customer = customers.find(c => 
        c.storeId === store.merchant && 
        ((email && c.email === email) || (phone && c.phone === phone))
    );

    if (customer) {
        customer.lastPurchase = new Date().toISOString();
        customer.totalOrders = (customer.totalOrders || 0) + 1;
        customer.totalSpent = (customer.totalSpent || 0) + orderValue;
    } else {
        customer = {
            storeId: store.merchant,
            email,
            phone,
            name: customerName,
            firstSeen: new Date().toISOString(),
            lastPurchase: new Date().toISOString(),
            totalOrders: 1,
            totalSpent: orderValue
        };
        customers.push(customer);
    }
    writeJSON(CUSTOMERS_FILE, customers);

    // ==========================================
    // STEP 3: Start Post-Purchase Sequence
    // Uses SequenceEngine instead of setTimeout!
    // ==========================================
    if (sequenceEngine && email) {
        sequenceEngine.startSequence('post_purchase', store.merchant, email, {
            storeName: store.merchantName || 'متجر رِبح',
            storeUrl,
            orderValue,
            products,
            customerName,
            phone
        });
        console.log(`📧 [Upsell] Post-purchase sequence started for ${email}`);
    }

    // ==========================================
    // STEP 4: Immediate Thank You WhatsApp
    // ==========================================
    if (whatsappClient && phone) {
        try {
            const isConnected = await whatsappClient.isConnected(store.merchant);
            
            if (isConnected) {
                const thankYouMsg = `شكراً لطلبك ${customerName}! 💚\n\n` +
                    `طلبك بقيمة ${orderValue} ر.س في الطريق إليك.\n\n` +
                    `لأي استفسار، نحن هنا! 🙏`;

                const result = await whatsappClient.sendMessage(store.merchant, phone, thankYouMsg);
                
                if (result.success) {
                    console.log(`📱 [Upsell] Thank you WhatsApp sent to ${phone}`);
                }
            }
        } catch (e) {
            console.error(`❌ [Upsell] WhatsApp error:`, e.message);
        }
    }

    // ==========================================
    // STEP 5: Create Referral Link
    // ==========================================
    let referralLink = null;
    if (referralSystem) {
        try {
            const storeDomain = `${store.merchant}.salla.sa`;
            const referral = referralSystem.getOrCreateReferral(store.merchant, email, storeDomain);
            referralLink = referral.link;
            console.log(`🔗 [Upsell] Referral link created: ${referralLink}`);
        } catch (e) {
            console.log(`⚠️ [Upsell] Referral creation failed: ${e.message}`);
        }
    }

    return {
        success: true,
        sequenceStarted: !!sequenceEngine && !!email,
        whatsappSent: !!whatsappClient && !!phone,
        referralLink
    };
}

// ==========================================
// SEQUENCE PROCESSOR - Called by keep-alive
// ==========================================

/**
 * Process pending sequence steps
 * CALL THIS FROM KEEP-ALIVE (every 5 minutes)
 */
async function processPendingSequenceSteps() {
    if (!sequenceEngine) {
        return { processed: 0, error: 'sequence_engine_not_available' };
    }

    console.log(`⏰ [LifecycleV2] Processing pending sequence steps...`);

    // Create email sender wrapper for the sequence engine
    const emailSenderWrapper = emailSender ? {
        sendOfferEmail: async (to, offer, context) => {
            try {
                await emailSender.sendOfferEmail(to, offer, context);
                return true;
            } catch (e) {
                console.error(`❌ Email send failed:`, e.message);
                return false;
            }
        }
    } : null;

    const processed = await sequenceEngine.processPendingSteps(emailSenderWrapper);
    
    console.log(`✅ [LifecycleV2] Processed ${processed} sequence steps`);
    
    return { processed };
}

/**
 * Enhanced sequence processor with WhatsApp integration
 * Adds WhatsApp to sequence steps that have phone numbers
 */
async function processPendingStepsWithWhatsApp() {
    const result = await processPendingSequenceSteps();
    
    // Also process WhatsApp follow-ups from sequences
    // This is handled by the Render bridge's queue processor
    // We just need to ensure the bridge is alive
    
    if (whatsappClient) {
        try {
            // Ping the bridge to keep it warm
            await whatsappClient.getStatus('health-check');
        } catch (e) {
            // Bridge might not respond to fake merchant ID, that's OK
        }
    }

    return result;
}

// ==========================================
// WIN-BACK: Inactive Customer Reactivation
// ==========================================

async function checkInactiveCustomers() {
    console.log(`🔄 [Continuity] Checking for inactive customers...`);

    const customers = readJSON(CUSTOMERS_FILE);
    const stores = readJSON(STORES_FILE);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveCustomers = customers.filter(c => {
        if (!c.lastPurchase) return false;
        
        // Skip if already sent win-back in last 14 days
        if (c.lastWinbackSent) {
            const lastSent = new Date(c.lastWinbackSent);
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            if (lastSent > fourteenDaysAgo) return false;
        }
        
        return new Date(c.lastPurchase) < thirtyDaysAgo;
    });

    console.log(`📋 Found ${inactiveCustomers.length} inactive customers`);

    let sentCount = 0;
    
    for (const customer of inactiveCustomers) {
        const store = stores.find(s => String(s.merchant) === String(customer.storeId));
        if (!store) continue;

        // Generate AI win-back offer
        let offer;
        if (offerGenerator) {
            offer = await offerGenerator.createOffer(store, 'continuity', {
                customerEmail: customer.email,
                customerData: customer
            });
        } else {
            offer = {
                headline: "😊 اشتقنالك!",
                fullMessage: "مر وقت منذ آخر زيارة. جهزنا لك خصم 25% على أي طلب!",
                discount: 25,
                urgency: "صالح لمدة 7 أيام فقط"
            };
        }

        // Send WhatsApp if available
        if (whatsappClient && customer.phone) {
            try {
                const isConnected = await whatsappClient.isConnected(store.merchant);
                if (isConnected) {
                    const message = `${offer.headline}\n\n${offer.fullMessage}`;
                    await whatsappClient.sendMessage(store.merchant, customer.phone, message);
                    sentCount++;
                    customer.lastWinbackSent = new Date().toISOString();
                }
            } catch (e) {
                console.log(`⚠️ Win-back WhatsApp failed: ${e.message}`);
            }
        }

        // Send email if available
        if (emailSender && customer.email) {
            try {
                const storeUrl = `https://${store.merchant}.salla.sa`;
                await emailSender.sendOfferEmail(customer.email, offer, {
                    storeName: store.merchantName || 'متجر رِبح',
                    checkoutUrl: storeUrl
                });
                sentCount++;
                customer.lastWinbackSent = new Date().toISOString();
            } catch (e) {
                console.log(`⚠️ Win-back email failed: ${e.message}`);
            }
        }
    }

    writeJSON(CUSTOMERS_FILE, customers);

    console.log(`✅ Win-back messages sent: ${sentCount}`);
    return { checked: inactiveCustomers.length, sent: sentCount };
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function getCustomerData(storeId, email, phone) {
    const customers = readJSON(CUSTOMERS_FILE);
    const customer = customers.find(c => 
        c.storeId === storeId && 
        ((email && c.email === email) || (phone && c.phone === phone))
    );

    if (!customer) return { totalOrders: 0, totalSpent: 0 };

    const daysSinceLastOrder = customer.lastPurchase 
        ? Math.floor((Date.now() - new Date(customer.lastPurchase).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return {
        totalOrders: customer.totalOrders || 0,
        totalSpent: customer.totalSpent || 0,
        daysSinceLastOrder
    };
}

/**
 * Get stats for a store
 */
function getStats(storeId) {
    const stats = {
        sequences: sequenceEngine ? sequenceEngine.getSequenceStats(storeId) : null,
        customers: {
            total: 0,
            active: 0,
            inactive: 0
        }
    };

    const customers = readJSON(CUSTOMERS_FILE);
    const storeCustomers = customers.filter(c => String(c.storeId) === String(storeId));
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    stats.customers.total = storeCustomers.length;
    stats.customers.active = storeCustomers.filter(c => 
        c.lastPurchase && new Date(c.lastPurchase) > thirtyDaysAgo
    ).length;
    stats.customers.inactive = stats.customers.total - stats.customers.active;

    return stats;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Event processing
    processEvent,
    
    // Individual handlers (for direct calls)
    handleNewCustomer,
    handleAbandonedCart,
    handleOrderCreated,
    
    // Background processing (call from keep-alive)
    processPendingSequenceSteps,
    processPendingStepsWithWhatsApp,
    checkInactiveCustomers,
    
    // Stats
    getStats
};
