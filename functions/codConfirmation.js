/**
 * COD Confirmation System for RIBH
 *
 * Confirms Cash-on-Delivery orders via WhatsApp before dispatch.
 * Saves Saudi stores 5-10% of revenue — COD orders have 12-13x higher return rates.
 *
 * Firestore: merchants/{id}/cod_confirmations/{orderId}
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// Default prepaid discount percentage (configurable per merchant)
const DEFAULT_PREPAID_DISCOUNT = 5;

// COD confirmation WhatsApp templates
const COD_TEMPLATES = {
    confirm_order: {
        // Sent immediately after COD order placed
        message: `{customer_name} شكراً لطلبك من {store_name}! 🛍️

طلبك #{order_id} بقيمة {order_value} ر.س جاهز للشحن.

للتأكيد، رد بـ:
✅ "نعم" - لتأكيد الطلب والاستلام
💳 "تحويل" - للدفع الآن واحصل على خصم {prepaid_discount}%
❌ "إلغاء" - لإلغاء الطلب

⏰ لو ما رديت خلال 24 ساعة بنتواصل معك`
    },

    reminder: {
        // Sent if no response after 12 hours
        message: `تذكير: طلبك #{order_id} من {store_name} ينتظر تأكيدك 📦

رد بـ ✅ "نعم" للتأكيد
أو 💳 "تحويل" واحصل على {prepaid_discount}% خصم`
    },

    convert_to_prepaid: {
        // Sent when customer says "تحويل"
        message: `ممتاز! 🎉
خصم {prepaid_discount}% تم تطبيقه على طلبك.

المبلغ بعد الخصم: {discounted_value} ر.س

{payment_link}

شكراً لاختيارك الدفع المسبق ❤️`
    },

    confirmed: {
        message: `تم تأكيد طلبك! ✅
سيتم شحنه خلال 24-48 ساعة.
شكراً {customer_name}! 🙏`
    }
};

/**
 * Fill template placeholders with actual values
 */
function fillTemplate(templateKey, data) {
    const template = COD_TEMPLATES[templateKey];
    if (!template) throw new Error(`Unknown template: ${templateKey}`);

    let msg = template.message;
    const placeholders = {
        '{customer_name}': data.customerName || '',
        '{store_name}': data.storeName || '',
        '{order_id}': data.orderId || '',
        '{order_value}': data.orderValue || '0',
        '{prepaid_discount}': data.prepaidDiscount || DEFAULT_PREPAID_DISCOUNT,
        '{discounted_value}': data.discountedValue || '0',
        '{payment_link}': data.paymentLink || ''
    };

    for (const [key, value] of Object.entries(placeholders)) {
        msg = msg.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), String(value));
    }
    return msg;
}

/**
 * Get merchant's prepaid discount config
 */
async function getMerchantDiscount(merchantId) {
    try {
        const db = getDb();
        const doc = await db.collection('merchants').doc(merchantId).get();
        if (doc.exists && doc.data().codConfig && doc.data().codConfig.prepaidDiscount) {
            return doc.data().codConfig.prepaidDiscount;
        }
    } catch (e) {
        console.error('[COD] Error reading merchant config:', e.message);
    }
    return DEFAULT_PREPAID_DISCOUNT;
}

/**
 * Send COD confirmation message for a new order
 * @param {string} merchantId - Merchant/store ID
 * @param {string} orderId - Order ID
 * @param {string} customerPhone - Customer phone number
 * @param {object} orderData - { customerName, storeName, orderValue, items?, paymentLink? }
 */
async function confirmCODOrder(merchantId, orderId, customerPhone, orderData) {
    const db = getDb();
    const prepaidDiscount = await getMerchantDiscount(merchantId);

    const confirmationData = {
        merchantId,
        orderId,
        customerPhone,
        customerName: orderData.customerName || '',
        storeName: orderData.storeName || '',
        orderValue: orderData.orderValue || 0,
        items: orderData.items || [],
        prepaidDiscount,
        status: 'pending', // pending | confirmed | converted_to_prepaid | cancelled | no_response
        messagesSent: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        confirmedAt: null,
        reminderSentAt: null,
        reminderScheduled: true
    };

    // Save to Firestore
    await db.collection('merchants').doc(merchantId)
        .collection('cod_confirmations').doc(orderId)
        .set(confirmationData);

    // Generate the confirmation message
    const message = fillTemplate('confirm_order', {
        customerName: orderData.customerName,
        storeName: orderData.storeName,
        orderId,
        orderValue: orderData.orderValue,
        prepaidDiscount
    });

    console.log(`[COD] Confirmation sent for order ${orderId} to ${customerPhone}`);

    return {
        orderId,
        status: 'pending',
        message,
        phone: customerPhone,
        reminderScheduledIn: '12h'
    };
}

/**
 * Process customer reply to COD confirmation
 * @param {string} merchantId - Merchant/store ID
 * @param {string} orderId - Order ID
 * @param {string} reply - Customer reply text (نعم/تحويل/إلغاء)
 */
async function handleCODReply(merchantId, orderId, reply) {
    const db = getDb();
    const docRef = db.collection('merchants').doc(merchantId)
        .collection('cod_confirmations').doc(orderId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`COD confirmation not found: ${orderId}`);
    }

    const data = doc.data();
    const normalizedReply = reply.trim().toLowerCase();
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Detect intent from reply
    let action;
    if (['نعم', 'اي', 'اكيد', 'تمام', 'yes', 'confirm', 'ok'].some(k => normalizedReply.includes(k))) {
        action = 'confirm';
    } else if (['تحويل', 'دفع', 'prepaid', 'pay', 'حول'].some(k => normalizedReply.includes(k))) {
        action = 'convert';
    } else if (['إلغاء', 'الغاء', 'لا', 'cancel', 'no'].some(k => normalizedReply.includes(k))) {
        action = 'cancel';
    } else {
        // Unknown reply — treat as needing clarification, resend confirm template
        return {
            orderId,
            action: 'unknown',
            message: fillTemplate('confirm_order', {
                customerName: data.customerName,
                storeName: data.storeName,
                orderId,
                orderValue: data.orderValue,
                prepaidDiscount: data.prepaidDiscount
            }),
            note: 'Reply not recognized, resending options'
        };
    }

    let responseMessage;
    let newStatus;

    if (action === 'confirm') {
        newStatus = 'confirmed';
        responseMessage = fillTemplate('confirmed', {
            customerName: data.customerName
        });
        await docRef.update({
            status: 'confirmed',
            confirmedAt: now,
            updatedAt: now,
            reminderScheduled: false
        });
    } else if (action === 'convert') {
        const discountedValue = (data.orderValue * (1 - data.prepaidDiscount / 100)).toFixed(2);
        newStatus = 'converted_to_prepaid';
        responseMessage = fillTemplate('convert_to_prepaid', {
            prepaidDiscount: data.prepaidDiscount,
            discountedValue,
            paymentLink: data.paymentLink || `https://pay.ribh.click/${merchantId}/${orderId}`
        });
        await docRef.update({
            status: 'converted_to_prepaid',
            confirmedAt: now,
            updatedAt: now,
            discountedValue: parseFloat(discountedValue),
            savingsFromConversion: data.orderValue - parseFloat(discountedValue),
            reminderScheduled: false
        });
    } else if (action === 'cancel') {
        newStatus = 'cancelled';
        responseMessage = `تم إلغاء طلبك #{${orderId}} بنجاح. نتمنى نشوفك قريب! 🙏`;
        await docRef.update({
            status: 'cancelled',
            cancelledAt: now,
            updatedAt: now,
            reminderScheduled: false
        });
    }

    console.log(`[COD] Order ${orderId} → ${newStatus}`);

    return {
        orderId,
        action,
        status: newStatus,
        message: responseMessage
    };
}

/**
 * Schedule a 12-hour reminder for unconfirmed COD orders
 * @param {string} merchantId - Merchant/store ID
 * @param {string} orderId - Order ID
 */
async function scheduleReminder(merchantId, orderId) {
    const db = getDb();
    const docRef = db.collection('merchants').doc(merchantId)
        .collection('cod_confirmations').doc(orderId);
    const doc = await docRef.get();

    if (!doc.exists) {
        throw new Error(`COD confirmation not found: ${orderId}`);
    }

    const data = doc.data();

    // Only send reminder if still pending
    if (data.status !== 'pending') {
        return { orderId, skipped: true, reason: `Order already ${data.status}` };
    }

    const message = fillTemplate('reminder', {
        orderId,
        storeName: data.storeName,
        prepaidDiscount: data.prepaidDiscount
    });

    await docRef.update({
        reminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        messagesSent: admin.firestore.FieldValue.increment(1),
        reminderScheduled: false
    });

    console.log(`[COD] Reminder sent for order ${orderId}`);

    return {
        orderId,
        status: 'reminder_sent',
        message,
        phone: data.customerPhone
    };
}

/**
 * Get COD confirmation statistics for a merchant
 * @param {string} merchantId - Merchant/store ID
 */
async function getCODStats(merchantId) {
    const db = getDb();
    const snapshot = await db.collection('merchants').doc(merchantId)
        .collection('cod_confirmations').get();

    const stats = {
        total: 0,
        confirmed: 0,
        converted_to_prepaid: 0,
        cancelled: 0,
        no_response: 0,
        pending: 0,
        totalOrderValue: 0,
        totalSavingsFromConversion: 0,
        confirmationRate: 0,
        conversionRate: 0,
        cancellationRate: 0
    };

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    snapshot.forEach(doc => {
        const data = doc.data();
        stats.total++;
        stats.totalOrderValue += data.orderValue || 0;

        if (data.status === 'confirmed') {
            stats.confirmed++;
        } else if (data.status === 'converted_to_prepaid') {
            stats.converted_to_prepaid++;
            stats.totalSavingsFromConversion += data.savingsFromConversion || 0;
        } else if (data.status === 'cancelled') {
            stats.cancelled++;
        } else if (data.status === 'pending') {
            // Check if older than 24h with no response
            const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().getTime() : 0;
            if (createdAt && (now - createdAt) > TWENTY_FOUR_HOURS) {
                stats.no_response++;
            } else {
                stats.pending++;
            }
        }
    });

    if (stats.total > 0) {
        stats.confirmationRate = Math.round(((stats.confirmed + stats.converted_to_prepaid) / stats.total) * 100);
        stats.conversionRate = Math.round((stats.converted_to_prepaid / stats.total) * 100);
        stats.cancellationRate = Math.round((stats.cancelled / stats.total) * 100);
    }

    return stats;
}

module.exports = {
    // Templates
    COD_TEMPLATES,
    DEFAULT_PREPAID_DISCOUNT,

    // Pure functions
    fillTemplate,

    // Core operations
    confirmCODOrder,
    handleCODReply,
    scheduleReminder,

    // Stats
    getCODStats,

    // Config
    getMerchantDiscount
};
