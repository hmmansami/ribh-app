/**
 * PAYMENT TOKEN ENGINE
 *
 * Generates secure, time-limited payment tokens that embed:
 * - Cart data (items, total, discount)
 * - Customer data (pre-filled from Salla)
 * - Merchant info
 * - Expiry (48 hours default)
 *
 * One token = one tap to pay. No login. No forms. No friction.
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

const TOKEN_EXPIRY_HOURS = 48;
const COLLECTION = 'payment_tokens';

/**
 * Generate a secure payment token for a cart
 * Returns a short, URL-safe token
 */
async function generateToken(cartData, merchantId, options = {}) {
    const token = crypto.randomBytes(16).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000));

    const discount = options.discount || 0;
    const discountCode = options.discountCode || null;
    const originalTotal = cartData.total || 0;
    const discountedTotal = discount > 0
        ? Math.round(originalTotal * (1 - discount / 100) * 100) / 100
        : originalTotal;

    const tokenDoc = {
        token,
        merchantId: String(merchantId),
        cartId: String(cartData.cartId || `cart_${Date.now()}`),

        // Customer (pre-filled, no forms needed)
        customer: {
            name: cartData.customer?.name || null,
            phone: cartData.customer?.phone || null,
            email: cartData.customer?.email || null,
            address: cartData.customer?.address || null,
            city: cartData.customer?.city || null,
        },

        // Cart items
        items: (cartData.items || []).map(item => ({
            id: String(item.id || ''),
            name: item.name || '',
            price: parseFloat(item.price) || 0,
            quantity: item.quantity || 1,
            image: item.image || null,
        })),

        // Pricing
        originalTotal,
        discount,
        discountCode,
        discountedTotal,
        currency: cartData.currency || 'SAR',

        // Recovery URL fallback
        checkoutUrl: cartData.checkoutUrl || null,

        // State
        status: 'pending', // pending, viewed, completed, expired
        paymentMethod: null,

        // Timestamps
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        viewedAt: null,
        completedAt: null,
    };

    const db = admin.firestore();
    await db.collection(COLLECTION).doc(token).set(tokenDoc);

    return {
        token,
        paymentUrl: `/pay?t=${token}`,
        expiresAt: expiresAt.toISOString(),
    };
}

/**
 * Validate and retrieve a payment token
 * Returns token data or null if invalid/expired
 */
async function validateToken(token) {
    if (!token || token.length < 10) return null;

    const db = admin.firestore();
    const doc = await db.collection(COLLECTION).doc(token).get();

    if (!doc.exists) return null;

    const data = doc.data();

    // Check expiry
    if (new Date(data.expiresAt) < new Date()) {
        await db.collection(COLLECTION).doc(token).update({ status: 'expired' });
        return null;
    }

    // Check if already completed
    if (data.status === 'completed') {
        return { ...data, alreadyCompleted: true };
    }

    // Mark as viewed
    if (data.status === 'pending') {
        await db.collection(COLLECTION).doc(token).update({
            status: 'viewed',
            viewedAt: new Date().toISOString(),
        });
    }

    return data;
}

/**
 * Complete a payment - mark token as used, create order record
 */
async function completePayment(token, paymentMethod, customerInfo = {}) {
    const db = admin.firestore();
    const doc = await db.collection(COLLECTION).doc(token).get();

    if (!doc.exists) return { success: false, error: 'invalid_token' };

    const data = doc.data();

    if (data.status === 'completed') {
        return { success: false, error: 'already_completed' };
    }

    if (new Date(data.expiresAt) < new Date()) {
        return { success: false, error: 'expired' };
    }

    const now = new Date().toISOString();
    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    // Update token
    await db.collection(COLLECTION).doc(token).update({
        status: 'completed',
        completedAt: now,
        paymentMethod,
        orderId,
        customerUpdate: customerInfo,
    });

    // Create recovery record for analytics
    await db.collection('recovered_orders').doc(orderId).set({
        orderId,
        token,
        merchantId: data.merchantId,
        cartId: data.cartId,
        customer: { ...data.customer, ...customerInfo },
        items: data.items,
        total: data.discountedTotal,
        originalTotal: data.originalTotal,
        discount: data.discount,
        discountCode: data.discountCode,
        currency: data.currency,
        paymentMethod,
        source: 'one_click_payment',
        createdAt: now,
    });

    // Update abandoned cart status
    const cartDocId = `${data.merchantId}_${data.cartId}`;
    try {
        await db.collection('abandoned_carts').doc(cartDocId).update({
            status: 'recovered',
            recoveredAt: now,
            recoveredVia: 'one_click_payment',
            recoveredOrderId: orderId,
            paymentMethod,
        });
    } catch (e) {
        // Cart doc might not exist, that's fine
    }

    return {
        success: true,
        orderId,
        total: data.discountedTotal,
        currency: data.currency,
        paymentMethod,
    };
}

/**
 * Get payment stats for a merchant
 */
async function getPaymentStats(merchantId) {
    const db = admin.firestore();

    const recovered = await db.collection('recovered_orders')
        .where('merchantId', '==', String(merchantId))
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

    let totalRecovered = 0;
    let todayRecovered = 0;
    let weekRecovered = 0;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentOrders = [];

    recovered.forEach(doc => {
        const d = doc.data();
        totalRecovered += d.total || 0;
        if (d.createdAt && d.createdAt.startsWith(today)) todayRecovered += d.total || 0;
        if (d.createdAt && d.createdAt > weekAgo) weekRecovered += d.total || 0;
        if (recentOrders.length < 20) {
            recentOrders.push({
                orderId: d.orderId,
                customer: d.customer?.name || 'عميل',
                total: d.total,
                currency: d.currency,
                paymentMethod: d.paymentMethod,
                createdAt: d.createdAt,
                items: d.items?.length || 0,
            });
        }
    });

    // Get pending tokens (viewed but not completed)
    const pending = await db.collection(COLLECTION)
        .where('merchantId', '==', String(merchantId))
        .where('status', '==', 'viewed')
        .get();

    return {
        totalRecovered: Math.round(totalRecovered),
        todayRecovered: Math.round(todayRecovered),
        weekRecovered: Math.round(weekRecovered),
        totalOrders: recovered.size,
        pendingPayments: pending.size,
        recentOrders,
        currency: 'SAR',
    };
}

module.exports = {
    generateToken,
    validateToken,
    completePayment,
    getPaymentStats,
};
