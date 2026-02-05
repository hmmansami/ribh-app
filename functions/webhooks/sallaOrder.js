/**
 * SALLA ORDER WEBHOOK HANDLER
 *
 * Handles order events for immediate upsell and review flows:
 * - order.created → Instant upsell WhatsApp (while customer is in buying mood)
 * - order.shipped/order.updated (delivered) → Instant review request
 *
 * Key principle: NO DELAYS - send immediately when event occurs
 *
 * @module webhooks/sallaOrder
 */

const express = require('express');
const crypto = require('crypto');
const admin = require('firebase-admin');

// WhatsApp Client
let whatsappClient;
try {
    whatsappClient = require('../lib/whatsappClient');
    console.log('[SallaOrder] WhatsApp Client loaded');
} catch (e) {
    console.log('[SallaOrder] WhatsApp Client not available:', e.message);
    whatsappClient = null;
}

const router = express.Router();

// ==========================================
// CONFIGURATION
// ==========================================

const WEBHOOK_SECRET = process.env.SALLA_WEBHOOK_SECRET || '';
const ORDERS_COLLECTION = 'orders';
const MESSAGES_COLLECTION = 'messages_sent';

// ==========================================
// SIGNATURE VERIFICATION
// ==========================================

function verifySallaSignature(rawBody, signature, secret) {
    if (!secret) return true;
    if (!signature) return false;

    const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(bodyString)
        .digest('hex');

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature.toLowerCase()),
            Buffer.from(expectedSignature.toLowerCase())
        );
    } catch (e) {
        return false;
    }
}

// ==========================================
// PHONE NORMALIZATION
// ==========================================

function normalizeSaudiPhone(phone) {
    if (!phone) return null;

    let cleaned = String(phone).replace(/[^\d+]/g, '');
    cleaned = cleaned.replace(/^\+/, '');

    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);

    if (cleaned.startsWith('966')) {
        const local = cleaned.substring(3);
        if (local.length >= 7) return '+966' + local;
    }

    if (cleaned.startsWith('0')) {
        const local = cleaned.substring(1);
        if (local.length >= 7) return '+966' + local;
    }

    if (cleaned.startsWith('5') && cleaned.length === 9) {
        return '+966' + cleaned;
    }

    return phone;
}

// ==========================================
// DATA EXTRACTION
// ==========================================

function extractCustomer(data) {
    const customer = data.customer || data.billing_address || {};

    const phone = normalizeSaudiPhone(
        customer.mobile || customer.phone ||
        data.mobile || data.phone ||
        data.shipping_address?.phone
    );

    const name = customer.name || customer.first_name ||
                 data.shipping_address?.name || 'عميل';

    return {
        id: customer.id ? String(customer.id) : null,
        name,
        phone,
        email: customer.email || data.email || null
    };
}

function extractOrderData(body) {
    const { event, merchant, data = {} } = body;

    const storeId = String(merchant?.id || merchant || 'unknown');
    const customer = extractCustomer(data);

    const items = (data.items || data.products || []).map((item, i) => ({
        id: String(item.id || item.product_id || `item_${i}`),
        name: item.name || item.product_name || item.title || 'منتج',
        quantity: item.quantity || 1,
        price: parseFloat(item.price?.amount || item.price || 0),
        sku: item.sku || null
    }));

    return {
        orderId: String(data.id || data.order_id || `order_${Date.now()}`),
        referenceId: data.reference_id || null,
        storeId,
        customer,
        items,
        total: parseFloat(data.total?.amount || data.total || data.grand_total || 0),
        currency: data.currency?.code || data.currency || 'SAR',
        status: data.status?.name || data.status || 'created',
        paymentMethod: data.payment_method || 'unknown',
        createdAt: data.created_at || new Date().toISOString(),
        eventType: event,
        source: 'salla_webhook'
    };
}

// ==========================================
// MESSAGE TEMPLATES
// ==========================================

/**
 * Post-purchase upsell message - sent IMMEDIATELY after order
 * While customer is still in buying mood
 */
function generateUpsellMessage(orderData) {
    const { customer, items, total, currency } = orderData;
    const name = customer?.name || 'عزيزنا العميل';
    const productName = items?.[0]?.name || 'طلبك';

    return `شكراً ${name}! 🎉

طلبك قيد التجهيز ✅

💡 عملاء اشتروا "${productName}" أعجبهم أيضاً:
• منتجات مشابهة متوفرة الآن

🎁 خصم 10% على طلبك القادم
الكود: THANKYOU10

اطلب الآن قبل نفاد العرض! 🛒`;
}

/**
 * Review request message - sent IMMEDIATELY after delivery
 */
function generateReviewMessage(orderData) {
    const { customer, orderId } = orderData;
    const name = customer?.name || 'عزيزنا العميل';

    return `مرحباً ${name} ⭐

نتمنى وصل طلبك بسلامة! 📦

رأيك يهمنا جداً 💚
30 ثانية من وقتك تساعدنا نخدمك أفضل

⭐⭐⭐⭐⭐
كيف كانت تجربتك؟

شكراً لثقتك! 🙏`;
}

// ==========================================
// WHATSAPP SEND
// ==========================================

async function sendWhatsAppMessage(storeId, phone, message, type) {
    if (!whatsappClient) {
        return { success: false, error: 'whatsapp_client_not_available' };
    }

    if (!phone) {
        return { success: false, error: 'no_phone_number' };
    }

    console.log(`[SallaOrder] 📤 Sending ${type} WhatsApp to ${phone}`);

    try {
        const result = await whatsappClient.sendMessage(storeId, phone, message);

        if (result.success) {
            console.log(`[SallaOrder] ✅ ${type} WhatsApp sent! ID: ${result.messageId}`);
            return { success: true, messageId: result.messageId };
        } else {
            console.log(`[SallaOrder] ❌ ${type} WhatsApp failed:`, result.error);
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.log(`[SallaOrder] ❌ ${type} exception:`, error.message);
        return { success: false, error: error.message };
    }
}

// ==========================================
// FIRESTORE TRACKING
// ==========================================

async function trackMessageSent(orderData, messageType, result) {
    const db = admin.firestore();

    const docId = `${orderData.storeId}_${orderData.orderId}_${messageType}`;

    await db.collection(MESSAGES_COLLECTION).doc(docId).set({
        orderId: orderData.orderId,
        storeId: orderData.storeId,
        customerId: orderData.customer?.id,
        customerPhone: orderData.customer?.phone,
        messageType,
        sent: result.success,
        messageId: result.messageId || null,
        error: result.error || null,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return docId;
}

async function wasMessageAlreadySent(storeId, orderId, messageType) {
    const db = admin.firestore();
    const docId = `${storeId}_${orderId}_${messageType}`;

    const doc = await db.collection(MESSAGES_COLLECTION).doc(docId).get();
    return doc.exists && doc.data()?.sent === true;
}

// ==========================================
// WEBHOOK ROUTE
// ==========================================

router.post('/', async (req, res) => {
    const startTime = Date.now();

    try {
        const rawBody = req.rawBody || JSON.stringify(req.body);
        const signature = req.headers['x-salla-signature'];
        const eventType = req.body?.event || 'unknown';

        console.log(`[SallaOrder] 📨 Received: ${eventType}`);

        // Validate signature
        if (WEBHOOK_SECRET && !verifySallaSignature(rawBody, signature, WEBHOOK_SECRET)) {
            console.log('[SallaOrder] ❌ Invalid signature');
            return res.status(401).json({ success: false, error: 'Invalid signature' });
        }

        // Parse order data
        const orderData = extractOrderData(req.body);

        if (!orderData.customer.phone) {
            console.log('[SallaOrder] ⚠️ No phone number, skipping');
            return res.status(200).json({
                success: true,
                message: 'No phone number - skipped'
            });
        }

        let whatsappResult = { skipped: true };

        // === ORDER CREATED → IMMEDIATE UPSELL ===
        if (eventType === 'order.created') {
            console.log(`[SallaOrder] 🛒 New order! ${orderData.orderId} - ${orderData.total} ${orderData.currency}`);

            // Check if already sent
            const alreadySent = await wasMessageAlreadySent(
                orderData.storeId,
                orderData.orderId,
                'upsell'
            );

            if (!alreadySent) {
                const message = generateUpsellMessage(orderData);
                whatsappResult = await sendWhatsAppMessage(
                    orderData.storeId,
                    orderData.customer.phone,
                    message,
                    'upsell'
                );

                await trackMessageSent(orderData, 'upsell', whatsappResult);

                if (whatsappResult.success) {
                    console.log(`[SallaOrder] 🎉 INSTANT UPSELL SENT! Order ${orderData.orderId}`);
                }
            } else {
                console.log(`[SallaOrder] ⏭️ Upsell already sent for ${orderData.orderId}`);
                whatsappResult = { skipped: true, reason: 'already_sent' };
            }
        }

        // === ORDER SHIPPED/DELIVERED → INSTANT REVIEW REQUEST ===
        if (eventType === 'order.shipped' ||
            eventType === 'order.updated' ||
            eventType === 'order.status.updated') {

            const status = (orderData.status || '').toLowerCase();
            const isDelivered = status.includes('deliver') ||
                               status.includes('complete') ||
                               status.includes('مكتمل') ||
                               status.includes('تم التوصيل');

            // Also trigger on shipped for stores that don't update to delivered
            const isShipped = status.includes('ship') ||
                             status.includes('شحن') ||
                             eventType === 'order.shipped';

            if (isDelivered || isShipped) {
                console.log(`[SallaOrder] 📦 Order ${isDelivered ? 'delivered' : 'shipped'}! ${orderData.orderId}`);

                // Check if already sent
                const alreadySent = await wasMessageAlreadySent(
                    orderData.storeId,
                    orderData.orderId,
                    'review'
                );

                if (!alreadySent) {
                    const message = generateReviewMessage(orderData);
                    whatsappResult = await sendWhatsAppMessage(
                        orderData.storeId,
                        orderData.customer.phone,
                        message,
                        'review'
                    );

                    await trackMessageSent(orderData, 'review', whatsappResult);

                    if (whatsappResult.success) {
                        console.log(`[SallaOrder] ⭐ INSTANT REVIEW REQUEST SENT! Order ${orderData.orderId}`);
                    }
                } else {
                    console.log(`[SallaOrder] ⏭️ Review already sent for ${orderData.orderId}`);
                    whatsappResult = { skipped: true, reason: 'already_sent' };
                }
            }
        }

        const processingTime = Date.now() - startTime;

        return res.status(200).json({
            success: true,
            event: eventType,
            orderId: orderData.orderId,
            processingTimeMs: processingTime,
            whatsapp: {
                attempted: !whatsappResult.skipped,
                sent: whatsappResult.success || false,
                messageId: whatsappResult.messageId || null,
                error: whatsappResult.error || null
            }
        });

    } catch (error) {
        console.error('[SallaOrder] ❌ Error:', error.message);

        return res.status(200).json({
            success: false,
            message: 'Webhook received with processing error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error'
        });
    }
});

module.exports = router;
module.exports.verifySallaSignature = verifySallaSignature;
module.exports.normalizeSaudiPhone = normalizeSaudiPhone;
module.exports.extractOrderData = extractOrderData;
