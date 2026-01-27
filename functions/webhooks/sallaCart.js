/**
 * SALLA ABANDONED CART WEBHOOK HANDLER
 * 
 * Dedicated handler for Salla abandoned.cart webhook events.
 * Saves cart data to Firestore for recovery automation.
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
    
    // Remove all non-digits except leading +
    let cleaned = String(phone).replace(/[^\d+]/g, '');
    const hadPlus = cleaned.startsWith('+');
    cleaned = cleaned.replace(/^\+/, '');
    
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
 */
function extractItems(data) {
    const rawItems = data?.items || data?.products || data?.cart?.items || [];
    
    return rawItems.map(item => ({
        id: item.id || item.product_id,
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
        
        // 8. Success response
        return res.status(200).json({
            success: true,
            message: 'Abandoned cart saved',
            cartId: cartData.cartId,
            storeId: cartData.storeId,
            total: cartData.total,
            itemCount: cartData.itemCount,
            processingTimeMs: processingTime
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
