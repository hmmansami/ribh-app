/**
 * SALLA ABANDONED CART WEBHOOK HANDLER
 * 
 * Dedicated handler for Salla abandoned.cart webhook events.
 * Saves cart data to Firestore for recovery automation.
 * NOW WITH INSTANT WHATSAPP SENDING!
 * 
 * Events handled:
 * - abandoned.cart (primary)
 * - cart.abandoned, abandoned_cart.created (aliases)
 * 
 * @module webhooks/sallaCart
 */

const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');

// WhatsApp Client - calls the Render-hosted bridge
let whatsappClient;
try {
    whatsappClient = require('../lib/whatsappClient');
    console.log('✅ [SallaCart] WhatsApp Client loaded');
} catch (e) {
    console.log('⚠️ [SallaCart] WhatsApp Client not available:', e.message);
    whatsappClient = null;
}

// AI Messenger - generates personalized messages
let aiMessenger;
try {
    aiMessenger = require('../lib/aiMessenger');
    console.log('✅ [SallaCart] AI Messenger loaded');
} catch (e) {
    console.log('⚠️ [SallaCart] AI Messenger not available:', e.message);
    aiMessenger = null;
}

// Payment Token Engine - generates one-click payment links
let paymentTokens;
try {
    paymentTokens = require('../lib/paymentTokens');
    console.log('✅ [SallaCart] Payment Tokens loaded');
} catch (e) {
    console.log('⚠️ [SallaCart] Payment Tokens not available:', e.message);
    paymentTokens = null;
}

const router = express.Router();

// ==========================================
// CONFIGURATION
// ==========================================

const WEBHOOK_SECRET = process.env.SALLA_WEBHOOK_SECRET || '';
const COLLECTION_NAME = 'abandoned_carts';

// ==========================================
// SIGNATURE VERIFICATION
// ==========================================

/**
 * Verify Salla webhook signature (HMAC-SHA256)
 * Salla sends signature in X-Salla-Signature header
 * 
 * @param {string|Buffer} rawBody - Raw request body (must be unparsed JSON string)
 * @param {string} signature - X-Salla-Signature header value
 * @param {string} secret - Webhook secret from Salla partner dashboard
 * @returns {boolean} True if signature is valid
 */
function verifySallaSignature(rawBody, signature, secret) {
    if (!secret) {
        console.log('[SallaCart] ⚠️ No webhook secret configured - skipping verification');
        return true; // Skip in development
    }
    
    if (!signature) {
        console.log('[SallaCart] ⚠️ No signature in request');
        return false;
    }
    
    // Ensure we're working with the raw body string
    const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    
    // Calculate expected signature: HMAC-SHA256(body, secret)
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(bodyString)
        .digest('hex');
    
    // Timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature.toLowerCase()),
            Buffer.from(expectedSignature.toLowerCase())
        );
    } catch (e) {
        // Lengths differ = definitely not equal
        return false;
    }
}

// ==========================================
// PHONE NORMALIZATION (Saudi +966)
// ==========================================

/**
 * Normalize Saudi phone number to +966 format
 * Handles: 0501234567, 501234567, 966501234567, +966501234567
 * 
 * @param {string} phone - Raw phone number
 * @returns {string|null} Normalized phone or null
 */
function normalizeSaudiPhone(phone) {
    if (!phone) return null;
    
    // Remove all non-digits
    let cleaned = String(phone).replace(/\D/g, '');
    
    // Remove leading 00 (international prefix)
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    }
    
    // Already has 966 country code
    if (cleaned.startsWith('966')) {
        const local = cleaned.substring(3);
        if (local.length === 9 && local.startsWith('5')) {
            return '+966' + local;
        }
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
        if (local.length >= 7) {
            return '+966' + local;
        }
    }
    
    // Starts with 5 (mobile part only: 5xxxxxxxx)
    if (cleaned.startsWith('5') && cleaned.length === 9) {
        return '+966' + cleaned;
    }
    
    // Return original if we can't normalize (might be international)
    return phone;
}

// ==========================================
// DATA EXTRACTION
// ==========================================

/**
 * Extract customer phone from various Salla data structures
 */
function extractPhone(data) {
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
 * Extract customer name from various locations
 */
function extractName(data) {
    if (data?.customer?.name) return data.customer.name;
    if (data?.customer?.first_name) {
        const last = data.customer.last_name || '';
        return `${data.customer.first_name} ${last}`.trim();
    }
    if (data?.name) return data.name;
    if (data?.first_name) return data.first_name;
    if (data?.billing_address?.name) return data.billing_address.name;
    if (data?.shipping_address?.name) return data.shipping_address.name;
    
    return 'عميل'; // Default: "Customer" in Arabic
}

/**
 * Extract cart items from Salla payload
 * Ensures no undefined values (Firestore doesn't accept them)
 */
function extractItems(data) {
    const rawItems = data?.items || data?.products || data?.cart?.items || [];
    
    return rawItems.map((item, index) => ({
        id: String(item.id || item.product_id || `item_${index}`),
        name: item.name || item.product_name || item.title || 'منتج',
        quantity: item.quantity || 1,
        price: parseFloat(item.price?.amount || item.price || 0),
        image: item.image?.url || item.thumbnail || item.images?.[0]?.url || null,
        sku: item.sku || null
    }));
}

/**
 * Extract cart total from various locations
 */
function extractTotal(data) {
    const candidates = [
        data?.total?.amount,
        data?.total,
        data?.totla, // Salla typo in their docs!
        data?.grand_total,
        data?.sub_total,
        data?.subtotal,
        data?.cart?.total
    ];
    
    for (const val of candidates) {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) return num;
    }
    return 0;
}

/**
 * Parse full abandoned cart webhook payload
 */
function parseAbandonedCartPayload(body) {
    const { event, merchant, data = {}, created_at } = body;
    
    const storeId = String(merchant?.id || merchant || 'unknown');
    const phone = extractPhone(data);
    const items = extractItems(data);
    const total = extractTotal(data);
    
    return {
        // Core identifiers
        cartId: String(data.id || data.cart_id || `cart_${Date.now()}`),
        storeId,
        
        // Customer info
        customer: {
            id: data.customer?.id ? String(data.customer.id) : null,
            name: extractName(data),
            phone,
            email: data.customer?.email || data.email || null
        },
        
        // Cart details
        items,
        itemCount: items.length,
        total,
        currency: data.currency?.code || data.currency || 'SAR',
        
        // Recovery URL
        checkoutUrl: data.checkout_url || data.recovery_url || data.cart_url || null,
        
        // Metadata
        status: data.status || 'abandoned',
        ageInMinutes: data.age_in_minutes || 0,
        
        // Timestamps
        createdAt: data.created_at || created_at || new Date().toISOString(),
        abandonedAt: new Date().toISOString(),
        
        // Source tracking
        source: 'salla_webhook',
        eventType: event,
        
        // Raw for debugging (optional - comment out in production)
        _raw: data
    };
}

// ==========================================
// FIRESTORE OPERATIONS
// ==========================================

/**
 * Save abandoned cart to Firestore
 */
async function saveToFirestore(cartData) {
    const db = admin.firestore();
    
    // Create document ID: storeId_cartId for uniqueness
    const docId = `${cartData.storeId}_${cartData.cartId}`;
    
    const docRef = db.collection(COLLECTION_NAME).doc(docId);
    
    await docRef.set({
        ...cartData,
        // Firestore server timestamp for accurate timing
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Remove raw data in production to save space
        _raw: admin.firestore.FieldValue.delete()
    }, { merge: true });
    
    return docId;
}

// ==========================================
// WHATSAPP INTEGRATION
// ==========================================

/**
 * Check if merchant has WhatsApp connected via the Render bridge
 */
async function checkMerchantWhatsAppStatus(storeId) {
    if (!whatsappClient) return { connected: false, reason: 'client_not_available' };
    
    try {
        const status = await whatsappClient.getStatus(storeId);
        return {
            connected: status.connected,
            phone: status.info?.phone || null,
            reason: status.connected ? 'connected' : 'not_connected'
        };
    } catch (error) {
        console.error(`[SallaCart] WhatsApp status check failed for ${storeId}:`, error.message);
        return { connected: false, reason: 'status_check_failed' };
    }
}

/**
 * Calculate discount ONCE for a cart. Single source of truth.
 * Returns { discount, discountCode }
 */
function calculateDiscount(cartData) {
    const { total, items, currency, customer, checkoutUrl } = cartData;

    if (aiMessenger) {
        try {
            const analysis = aiMessenger.analyzeCartDeep({
                total, items, currency, customer, checkoutUrl
            });
            return {
                discount: analysis.suggestedDiscount || 0,
                discountCode: analysis.discountCode || null,
            };
        } catch (e) {
            // AI failed, fall through to rule-based
        }
    }

    // Rule-based fallback (always runs if AI unavailable or fails)
    let discount = 0;
    if (total >= 1000) discount = 15;
    else if (total >= 500) discount = 10;
    else if (total >= 200) discount = 5;

    return { discount, discountCode: null };
}

/**
 * Build WhatsApp recovery message with payment link.
 * Discount is passed in (already calculated), not re-calculated.
 */
function buildRecoveryMessage(cartData, paymentUrl, discount) {
    const { customer, items, total, currency, checkoutUrl } = cartData;
    const customerName = customer?.name || 'عزيزنا العميل';
    const currencyLabel = currency === 'SAR' ? 'ر.س' : currency;

    let message = `مرحباً ${customerName}! 👋\n\n`;
    message += `لاحظنا أن لديك منتجات في سلة التسوق 🛒\n\n`;

    if (items && items.length > 0) {
        message += `📦 منتجاتك:\n`;
        items.slice(0, 3).forEach(item => {
            message += `• ${item.name}\n`;
        });
        if (items.length > 3) {
            message += `• و ${items.length - 3} منتجات أخرى...\n`;
        }
        message += `\n`;
    }

    if (discount > 0) {
        const discounted = Math.round(total * (1 - discount / 100));
        message += `🎁 خصم خاص لك: ${discount}%\n`;
        message += `💰 بدل ${total} ${currencyLabel} → ${discounted} ${currencyLabel}\n\n`;
    } else {
        message += `💰 المجموع: ${total} ${currencyLabel}\n\n`;
    }

    if (paymentUrl) {
        message += `👇 ادفع بنقرة واحدة:\n${paymentUrl}\n\n`;
        message += `✅ Apple Pay، مدى، تمارا، أو نقد عند الاستلام`;
    } else if (checkoutUrl) {
        message += `👉 أكمل طلبك الآن:\n${checkoutUrl}`;
    }

    return message;
}

/**
 * Generate payment token for one-click payment
 */
async function generatePaymentLink(cartData, discount) {
    if (!paymentTokens) return null;

    try {
        const result = await paymentTokens.generateToken(cartData, cartData.storeId, { discount });
        const baseUrl = process.env.APP_URL || 'https://ribh-484706.web.app';
        return {
            url: `${baseUrl}${result.paymentUrl}`,
            token: result.token,
        };
    } catch (error) {
        console.error('[SallaCart] Payment token generation failed:', error.message);
        return null;
    }
}

/**
 * Send WhatsApp recovery message via Render bridge
 * Now includes one-click payment link!
 */
async function sendWhatsAppRecovery(storeId, cartData) {
    if (!whatsappClient) {
        return { success: false, error: 'whatsapp_client_not_available' };
    }

    const phone = cartData.customer?.phone;
    if (!phone) {
        return { success: false, error: 'no_phone_number' };
    }

    // Check merchant WhatsApp status first
    const waStatus = await checkMerchantWhatsAppStatus(storeId);
    if (!waStatus.connected) {
        console.log(`[SallaCart] ⚠️ Merchant ${storeId} WhatsApp not connected: ${waStatus.reason}`);
        return {
            success: false,
            error: 'merchant_not_connected',
            reason: waStatus.reason
        };
    }

    // Calculate discount ONCE (single source of truth)
    const { discount, discountCode } = calculateDiscount(cartData);

    // Generate one-click payment link (uses same discount)
    let paymentUrl = null;
    let paymentToken = null;
    const payLink = await generatePaymentLink(cartData, discount);
    if (payLink) {
        paymentUrl = payLink.url;
        paymentToken = payLink.token;
        console.log(`[SallaCart] 💳 Payment link generated: ${paymentUrl}`);
    }

    // Build message with the same discount that's in the payment link
    const message = buildRecoveryMessage(cartData, paymentUrl, discount);

    console.log(`[SallaCart] 📤 Sending WhatsApp to ${phone} via merchant ${storeId}`);

    try {
        const result = await whatsappClient.sendMessage(storeId, phone, message);

        if (result.success) {
            console.log(`[SallaCart] ✅ WhatsApp sent with payment link! ID: ${result.messageId}`);

            // Update Firestore with send status
            const db = admin.firestore();
            const docId = `${storeId}_${cartData.cartId}`;
            await db.collection(COLLECTION_NAME).doc(docId).update({
                whatsappSent: true,
                whatsappSentAt: new Date().toISOString(),
                whatsappMessageId: result.messageId,
                discountOffered: discount,
                discountCode: discountCode,
                paymentToken: paymentToken,
                paymentUrl: paymentUrl,
            });

            return {
                success: true,
                messageId: result.messageId,
                discountCode,
                discount,
                paymentUrl,
            };
        } else {
            console.error(`[SallaCart] ❌ WhatsApp send failed:`, result.error);
            return {
                success: false,
                error: result.error
            };
        }
    } catch (error) {
        console.error(`[SallaCart] ❌ WhatsApp send exception:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==========================================
// WEBHOOK ROUTE
// ==========================================

/**
 * POST /webhooks/salla/cart
 * 
 * Receives Salla abandoned.cart webhook events
 * Validates signature, extracts data, saves to Firestore
 */
router.post('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        // 1. Get raw body and signature
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const signature = req.headers['x-salla-signature'];
        const eventType = req.body?.event || 'unknown';
        
        console.log(`[SallaCart] 📨 Received: ${eventType}`);
        
        // 2. Validate signature
        if (WEBHOOK_SECRET && !verifySallaSignature(rawBody, signature, WEBHOOK_SECRET)) {
            console.log('[SallaCart] ❌ Invalid signature');
            return res.status(401).json({
                success: false,
                error: 'Invalid webhook signature'
            });
        }
        
        // 3. Validate event type
        const validEvents = ['abandoned.cart', 'cart.abandoned', 'abandoned_cart.created'];
        if (!validEvents.includes(eventType)) {
            console.log(`[SallaCart] ⚠️ Ignoring event: ${eventType}`);
            return res.status(200).json({
                success: true,
                message: 'Event type not handled',
                event: eventType
            });
        }
        
        // 4. Validate required data exists
        if (!req.body?.data) {
            console.log('[SallaCart] ❌ Missing data field');
            return res.status(400).json({
                success: false,
                error: 'Missing required data field'
            });
        }
        
        // 5. Parse cart data
        const cartData = parseAbandonedCartPayload(req.body);
        
        // 6. Validate we have minimum required fields
        if (!cartData.customer.phone && !cartData.customer.email) {
            console.log('[SallaCart] ❌ No customer contact info');
            return res.status(400).json({
                success: false,
                error: 'Missing customer phone or email'
            });
        }
        
        if (cartData.itemCount === 0) {
            console.log('[SallaCart] ⚠️ Empty cart, skipping');
            return res.status(200).json({
                success: true,
                message: 'Empty cart ignored'
            });
        }
        
        // 7. Save to Firestore
        const docId = await saveToFirestore(cartData);
        
        const processingTime = Date.now() - startTime;
        console.log(`[SallaCart] ✅ Saved: ${docId} (${cartData.total} ${cartData.currency}, ${cartData.itemCount} items) in ${processingTime}ms`);
        
        // 8. INSTANT WHATSAPP RECOVERY! 📱
        // Send WhatsApp message if merchant is connected and customer has phone
        let whatsappResult = { success: false, skipped: true };
        
        if (cartData.customer.phone && whatsappClient) {
            console.log(`[SallaCart] 📱 Attempting WhatsApp recovery for ${cartData.customer.phone}...`);
            
            // Fire-and-forget: Don't block webhook response
            // But we'll await for now to get result (Salla has long webhook timeout)
            whatsappResult = await sendWhatsAppRecovery(cartData.storeId, cartData);
            
            if (whatsappResult.success) {
                console.log(`[SallaCart] 🎉 INSTANT RECOVERY SENT! Cart ${cartData.cartId} → ${cartData.customer.phone}`);
            } else if (whatsappResult.error === 'merchant_not_connected') {
                console.log(`[SallaCart] ⚠️ Merchant not connected to WhatsApp - cart saved for later`);
            } else {
                console.log(`[SallaCart] ⚠️ WhatsApp send failed: ${whatsappResult.error}`);
            }
        } else if (!cartData.customer.phone) {
            console.log(`[SallaCart] ⚠️ No phone number - cart saved for email recovery only`);
        }
        
        // 9. Success response
        return res.status(200).json({
            success: true,
            message: 'Abandoned cart saved',
            cartId: cartData.cartId,
            storeId: cartData.storeId,
            total: cartData.total,
            itemCount: cartData.itemCount,
            processingTimeMs: processingTime,
            // WhatsApp status
            whatsapp: {
                attempted: !whatsappResult.skipped,
                sent: whatsappResult.success,
                messageId: whatsappResult.messageId || null,
                error: whatsappResult.error || null,
                discountOffered: whatsappResult.discount || 0
            }
        });
        
    } catch (error) {
        console.error('[SallaCart] ❌ Error:', error.message);
        
        // Still return 200 to prevent Salla retries (they retry on non-2xx)
        // Log the error but don't expose internals
        return res.status(200).json({
            success: false,
            message: 'Webhook received with processing error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
        });
    }
});

// ==========================================
// EXPORTS
// ==========================================

module.exports = router;

// Also export utilities for testing
module.exports.verifySallaSignature = verifySallaSignature;
module.exports.normalizeSaudiPhone = normalizeSaudiPhone;
module.exports.parseAbandonedCartPayload = parseAbandonedCartPayload;
module.exports.extractPhone = extractPhone;
module.exports.extractItems = extractItems;
module.exports.extractTotal = extractTotal;
