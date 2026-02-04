/**
 * Review Collection Engine - RIBH
 *
 * Automated review collection system for Saudi e-commerce merchants.
 * WhatsApp-based review requests, star ratings, photo reviews,
 * scheduling, and review analytics.
 *
 * Firestore structure:
 *   merchants/{id}/reviews/{reviewId}          - Customer reviews
 *   merchants/{id}/review_requests/{requestId} - Pending review requests
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// ==========================================
// ARABIC WHATSAPP TEMPLATES
// ==========================================

const REVIEW_TEMPLATES = {
    standard: {
        id: 'standard',
        name: 'طلب تقييم قياسي',
        nameEn: 'Standard Review Request',
        message: `{customer_name} شكراً لتسوقك من {store_name}! ⭐

نتمنى عجبتك تجربتك 😊

لو تقدر تعطينا تقييم سريع بيساعدنا نتطور 🙏

{review_link}

🎁 كل تقييم = خصم 5% على طلبك الجاي!`
    },
    friendly: {
        id: 'friendly',
        name: 'طلب ودي',
        nameEn: 'Friendly Request',
        message: `أهلاً {customer_name} 👋

كيف كانت تجربتك مع {store_name}؟

رأيك يهمنا جداً ويساعد عملاء ثانيين ❤️

قيّم تجربتك من هنا:
{review_link}

شكراً لك 🌟`
    },
    incentive: {
        id: 'incentive',
        name: 'تقييم مع مكافأة',
        nameEn: 'Incentivized Review',
        message: `{customer_name} مبروك وصول طلبك من {store_name}! 🎉

عندنا هدية لك 🎁

شاركنا تقييمك واحصل على:
✅ خصم 10% على طلبك الجاي
✅ شحن مجاني للطلب القادم

قيّم من هنا: {review_link}

⏰ العرض لمدة 48 ساعة فقط!`
    },
    photo: {
        id: 'photo',
        name: 'تقييم مع صور',
        nameEn: 'Photo Review Request',
        message: `{customer_name} شكراً لطلبك من {store_name}! 📸

نحب نشوف المنتج عندك!

شاركنا صورة + تقييمك واحصل على خصم 15% 🔥

{review_link}

📸 التقييمات بالصور تحصل على خصم أكبر!`
    }
};

// ==========================================
// PURE UTILITY FUNCTIONS
// ==========================================

/**
 * Generate a short unique review token
 * @returns {string} 8-char hex token
 */
function generateReviewToken() {
    return crypto.randomBytes(4).toString('hex');
}

/**
 * Generate a review message from template
 * @param {string} templateId - Template key from REVIEW_TEMPLATES
 * @param {object} data - { customerName, storeName, reviewLink }
 * @returns {string} Filled message
 */
function generateReviewMessage(templateId, data = {}) {
    const template = REVIEW_TEMPLATES[templateId] || REVIEW_TEMPLATES.standard;
    return template.message
        .replace(/\{customer_name\}/g, data.customerName || 'عميلنا')
        .replace(/\{store_name\}/g, data.storeName || 'متجرنا')
        .replace(/\{review_link\}/g, data.reviewLink || '#')
        .replace(/\{product_name\}/g, data.productName || '');
}

/**
 * Calculate average rating from an array of ratings
 * @param {number[]} ratings
 * @returns {number} Average rounded to 1 decimal
 */
function calculateAverageRating(ratings) {
    if (!ratings || ratings.length === 0) return 0;
    const sum = ratings.reduce((a, b) => a + b, 0);
    return Math.round((sum / ratings.length) * 10) / 10;
}

/**
 * Get star distribution { 1: count, 2: count, ... 5: count }
 */
function getStarDistribution(ratings) {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (!ratings) return dist;
    for (const r of ratings) {
        const star = Math.min(5, Math.max(1, Math.round(r)));
        dist[star]++;
    }
    return dist;
}

// ==========================================
// REVIEW LINK GENERATION
// ==========================================

/**
 * Generate a review link for a specific order
 * @param {string} merchantId
 * @param {string} orderId
 * @returns {object} { token, link, expiresAt }
 */
async function generateReviewLink(merchantId, orderId) {
    const db = getDb();
    const token = generateReviewToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
        await db.collection('merchants').doc(merchantId).collection('review_requests').doc(token).set({
            orderId,
            token,
            status: 'pending',
            expiresAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('[ReviewEngine] Link generation error:', error.message);
    }

    return {
        token,
        link: `https://ribh-484706.web.app/review/${token}`,
        expiresAt: expiresAt.toISOString()
    };
}

// ==========================================
// REVIEW REQUEST
// ==========================================

/**
 * Create a review request for a customer after purchase
 * @param {string} merchantId
 * @param {string} customerId
 * @param {string} orderId
 * @param {object} [options] - { templateId, storeName, customerName, productName }
 * @returns {object} { requestId, message, reviewLink }
 */
async function requestReview(merchantId, customerId, orderId, options = {}) {
    const db = getDb();

    try {
        // Generate review link
        const { token, link } = await generateReviewLink(merchantId, orderId);

        // Build message
        const message = generateReviewMessage(options.templateId || 'standard', {
            customerName: options.customerName || 'عميلنا',
            storeName: options.storeName || 'متجرنا',
            reviewLink: link,
            productName: options.productName || ''
        });

        // Save request
        const requestRef = db.collection('merchants').doc(merchantId).collection('review_requests').doc(token);
        await requestRef.set({
            customerId,
            orderId,
            token,
            message,
            templateId: options.templateId || 'standard',
            status: 'pending',
            sentAt: null,
            reviewedAt: null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`[ReviewEngine] Review request created for order ${orderId} (token: ${token})`);

        return { requestId: token, message, reviewLink: link };
    } catch (error) {
        console.error('[ReviewEngine] Request error:', error.message);
        throw error;
    }
}

// ==========================================
// SUBMIT REVIEW
// ==========================================

/**
 * Submit a customer review
 * @param {string} merchantId
 * @param {string} customerId
 * @param {string} productId
 * @param {object} data - { rating: 1-5, text, photos: [], orderId, token }
 * @returns {object} Saved review
 */
async function submitReview(merchantId, customerId, productId, data = {}) {
    const db = getDb();

    const rating = Math.min(5, Math.max(1, parseInt(data.rating) || 5));

    try {
        const review = {
            merchantId,
            customerId,
            productId,
            orderId: data.orderId || null,
            rating,
            text: (data.text || '').substring(0, 1000),
            photos: Array.isArray(data.photos) ? data.photos.slice(0, 5) : [],
            hasPhotos: Array.isArray(data.photos) && data.photos.length > 0,
            status: 'published', // Could add moderation: 'pending'
            verified: !!data.orderId,
            helpful: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const ref = await db.collection('merchants').doc(merchantId).collection('reviews').add(review);

        // Update review request status if token provided
        if (data.token) {
            try {
                await db.collection('merchants').doc(merchantId).collection('review_requests').doc(data.token).update({
                    status: 'completed',
                    reviewId: ref.id,
                    reviewedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            } catch (_) { /* token may not exist */ }
        }

        console.log(`[ReviewEngine] Review submitted: ${rating} stars for product ${productId}`);

        return { reviewId: ref.id, ...review };
    } catch (error) {
        console.error('[ReviewEngine] Submit error:', error.message);
        throw error;
    }
}

// ==========================================
// REVIEW QUERIES
// ==========================================

/**
 * Get reviews for a specific product
 * @param {string} merchantId
 * @param {string} productId
 * @param {object} [options] - { limit, sortBy }
 * @returns {object} { reviews, avgRating, totalCount, distribution }
 */
async function getProductReviews(merchantId, productId, options = {}) {
    const db = getDb();

    try {
        const snap = await db.collection('merchants').doc(merchantId).collection('reviews')
            .where('productId', '==', productId)
            .where('status', '==', 'published')
            .orderBy('createdAt', 'desc')
            .limit(options.limit || 50)
            .get();

        const reviews = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const ratings = reviews.map(r => r.rating);

        return {
            reviews,
            avgRating: calculateAverageRating(ratings),
            totalCount: reviews.length,
            distribution: getStarDistribution(ratings),
            hasPhotos: reviews.filter(r => r.hasPhotos).length
        };
    } catch (error) {
        console.error('[ReviewEngine] Product reviews error:', error.message);
        return { reviews: [], avgRating: 0, totalCount: 0, distribution: getStarDistribution([]), hasPhotos: 0 };
    }
}

/**
 * Get overall review stats for a merchant
 */
async function getReviewStats(merchantId) {
    const db = getDb();

    try {
        const snap = await db.collection('merchants').doc(merchantId).collection('reviews')
            .where('status', '==', 'published')
            .get();

        const ratings = snap.docs.map(doc => doc.data().rating);
        const photoCount = snap.docs.filter(doc => doc.data().hasPhotos).length;

        // Get pending review requests
        const pendingSnap = await db.collection('merchants').doc(merchantId).collection('review_requests')
            .where('status', '==', 'pending')
            .get();

        const completedSnap = await db.collection('merchants').doc(merchantId).collection('review_requests')
            .where('status', '==', 'completed')
            .get();

        const totalRequests = pendingSnap.size + completedSnap.size;
        const responseRate = totalRequests > 0 ? Math.round((completedSnap.size / totalRequests) * 100) : 0;

        return {
            totalReviews: snap.size,
            avgRating: calculateAverageRating(ratings),
            distribution: getStarDistribution(ratings),
            photoReviews: photoCount,
            pendingRequests: pendingSnap.size,
            responseRate,
            positiveRate: ratings.filter(r => r >= 4).length,
            negativeRate: ratings.filter(r => r <= 2).length
        };
    } catch (error) {
        console.error('[ReviewEngine] Stats error:', error.message);
        return { totalReviews: 0, avgRating: 0, distribution: getStarDistribution([]), photoReviews: 0, pendingRequests: 0, responseRate: 0 };
    }
}

// ==========================================
// AUTO-REQUEST SCHEDULING
// ==========================================

/**
 * Schedule an auto review request 2 days after delivery
 * @param {string} merchantId
 * @param {string} orderId
 * @param {object} [orderData] - { customerId, customerName, storeName, deliveredAt }
 * @returns {object} { scheduled, sendAt }
 */
async function autoRequestAfterDelivery(merchantId, orderId, orderData = {}) {
    const db = getDb();
    const deliveredAt = orderData.deliveredAt ? new Date(orderData.deliveredAt) : new Date();
    const sendAt = new Date(deliveredAt.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days later

    try {
        await db.collection('merchants').doc(merchantId).collection('review_requests').add({
            orderId,
            customerId: orderData.customerId || null,
            customerName: orderData.customerName || '',
            storeName: orderData.storeName || '',
            status: 'scheduled',
            scheduledFor: sendAt,
            deliveredAt,
            templateId: 'standard',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[ReviewEngine] Auto-request scheduled for order ${orderId} at ${sendAt.toISOString()}`);

        return { scheduled: true, sendAt: sendAt.toISOString() };
    } catch (error) {
        console.error('[ReviewEngine] Auto-request error:', error.message);
        return { scheduled: false, error: error.message };
    }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Templates
    REVIEW_TEMPLATES,

    // Pure functions
    generateReviewMessage,
    generateReviewToken,
    calculateAverageRating,
    getStarDistribution,

    // Core operations
    requestReview,
    submitReview,
    generateReviewLink,

    // Queries
    getProductReviews,
    getReviewStats,

    // Scheduling
    autoRequestAfterDelivery
};
