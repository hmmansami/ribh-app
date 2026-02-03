/**
 * RIBH Review Collector - Complete Automated Review Collection via WhatsApp
 *
 * FLOW:
 * 1. Order delivered → Schedule review request (3-5 day delay)
 * 2. Send WhatsApp asking for 1-5 star rating
 * 3. If 4-5 stars → Ask for public review + share store link + THANKS10 discount
 * 4. If 1-3 stars → Route to support, ask what went wrong + SORRY20 discount
 * 5. Track everything in Firestore: stores/{storeId}/reviews/{reviewId}
 *
 * SMART ROUTING:
 * - Happy (4-5) → Public review request + referral offer
 * - Unhappy (1-3) → Private complaint handling + recovery offer (20% off)
 */

const admin = require('firebase-admin');

const db = () => admin.firestore();

// ==========================================
// MODULE IMPORTS (graceful fallbacks)
// ==========================================

let whatsappClient;
try {
    whatsappClient = require('./whatsappClient');
    console.log('[ReviewCollector] WhatsApp Client loaded (HTTP Bridge)');
} catch (e) {
    console.log('[ReviewCollector] WhatsApp Client not available, trying whatsappSender');
    try {
        const sender = require('./whatsappSender');
        // Wrap whatsappSender to match whatsappClient API: sendMessage(merchantId, to, message)
        whatsappClient = {
            sendMessage: async (merchantId, to, message) => sender.sendMessage(to, message),
            isConnected: async () => true
        };
        console.log('[ReviewCollector] WhatsApp Sender loaded (Meta API fallback)');
    } catch (e2) {
        console.log('[ReviewCollector] No WhatsApp sender available');
        whatsappClient = null;
    }
}

let referralSystem;
try {
    referralSystem = require('./referralSystem');
    console.log('[ReviewCollector] Referral System loaded');
} catch (e) {
    referralSystem = null;
}

// ==========================================
// CONFIGURATION
// ==========================================

const DEFAULT_DELAY_DAYS = 3; // Days after delivery to send review request
const MIN_DELAY_DAYS = 2;
const MAX_DELAY_DAYS = 7;

// Discount codes for review responses
const HAPPY_DISCOUNT_CODE = 'THANKS10';
const HAPPY_DISCOUNT_PERCENT = 10;
const UNHAPPY_DISCOUNT_CODE = 'SORRY20';
const UNHAPPY_DISCOUNT_PERCENT = 20;

// Conversation states for multi-step flow
const FLOW_STATES = {
    AWAITING_RATING: 'awaiting_rating',
    AWAITING_FEEDBACK: 'awaiting_feedback',
    AWAITING_PUBLIC_REVIEW: 'awaiting_public_review',
    COMPLETED: 'completed'
};

// ==========================================
// ARABIC MESSAGE TEMPLATES (Saudi dialect)
// ==========================================

const MESSAGES = {
    /**
     * Step 1: Initial review request - ask for 1-5 rating
     */
    reviewRequest: (customerName, storeName) =>
        `مرحبا ${customerName}! \u{1F60A}\n` +
        `وصلك طلبك من ${storeName}؟\n` +
        `كيف كانت تجربتك؟\n` +
        `رد برقم من 1 لـ 5\n` +
        `⭐ = ممتاز 5\n` +
        `⭐ = سيء 1`,

    /**
     * Step 2a: Happy customer (4-5 stars) - ask for public review
     */
    happyResponse: (reviewLink, discountCode) =>
        `يسعدنا إن التجربة عجبتك! \u{1F389}\n` +
        `ممكن تكتب تقييم يساعد ناس ثانين؟\n` +
        `${reviewLink}\n` +
        `وهذا كود خصم ${HAPPY_DISCOUNT_PERCENT}% لطلبك الجاي: ${discountCode} \u{2764}\u{FE0F}`,

    /**
     * Step 2b: Unhappy customer (1-3 stars) - route to support
     */
    unhappyResponse: (discountCode) =>
        `نعتذر منك جداً \u{1F614}\n` +
        `نبي نعرف وش الخطأ عشان نصلحه\n` +
        `اكتب لنا وش صار وبنتواصل معك فوراً\n` +
        `وهذا كود خصم ${UNHAPPY_DISCOUNT_PERCENT}% كتعويض: ${discountCode}`,

    /**
     * Step 3: Thank you after receiving feedback
     */
    thankYouAfterFeedback: (customerName) =>
        `شكراً ${customerName} على وقتك! \u{1F64F}\n` +
        `ملاحظاتك تساعدنا نتطور ونخدمك أحسن.\n` +
        `نتطلع نشوفك مرة ثانية!`,

    /**
     * Step 3: Thank you after public review
     */
    thankYouAfterReview: (customerName) =>
        `شكراً ${customerName}! تقييمك يفرق معنا كثير \u{1F4AA}\n` +
        `نتطلع نشوفك قريب!`,

    /**
     * Referral offer for happy customers
     */
    referralOffer: (referralLink) =>
        `شارك تجربتك مع أصدقائك! \u{1F381}\n` +
        `لما صديقك يطلب من الرابط، يحصل خصم 10% وأنت تحصل 15% رصيد!\n` +
        `${referralLink}`
};

// Sentiment keywords for text analysis (supplements numeric rating)
const POSITIVE_KEYWORDS = ['ممتاز', 'رائع', 'جميل', 'حلو', 'زين', 'طيب', 'تمام', 'شكرا', 'شكراً', 'راضي', 'مبسوط', 'عجبني', 'روعة', 'مرة حلو', 'فوق الممتاز'];
const NEGATIVE_KEYWORDS = ['سيء', 'مشكلة', 'خربان', 'تالف', 'متأخر', 'مو زين', 'ما عجبني', 'استرجاع', 'غلط', 'زعلان', 'مكسور', 'ناقص', 'غالي'];

// ==========================================
// CORE FUNCTIONS
// ==========================================

/**
 * Schedule a review request after order delivery
 * Called when order status changes to "delivered" or on a timed delay after order creation
 *
 * @param {string} orderId - The order ID
 * @param {string} storeId - The store/merchant ID
 * @param {Object} [orderData] - Optional order data (customer info, products, etc.)
 * @returns {Object} { success, reviewId, sendAt }
 */
async function scheduleReviewRequest(orderId, storeId, orderData = {}) {
    if (!orderId || !storeId) {
        return { success: false, error: 'Missing orderId or storeId' };
    }

    try {
        const {
            customerId = null,
            customerPhone = null,
            customerName = 'عميلنا',
            customerEmail = null,
            products = [],
            orderValue = 0,
            storeName = 'متجرنا',
            reviewLink = null,
            delayDays = DEFAULT_DELAY_DAYS
        } = orderData;

        if (!customerPhone) {
            return { success: false, error: 'Missing customerPhone - cannot send WhatsApp review request' };
        }

        // Validate delay range
        const delay = Math.max(MIN_DELAY_DAYS, Math.min(MAX_DELAY_DAYS, delayDays));
        const sendAt = new Date(Date.now() + delay * 24 * 60 * 60 * 1000);

        // Check if review already exists for this order
        const existingSnap = await db()
            .collection('stores').doc(storeId)
            .collection('reviews')
            .where('orderId', '==', orderId)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            const existingDoc = existingSnap.docs[0];
            console.log(`[ReviewCollector] Review already exists for order ${orderId}: ${existingDoc.id}`);
            return { success: true, reviewId: existingDoc.id, alreadyExists: true };
        }

        // Build the review link (Salla store review page)
        const storeReviewLink = reviewLink || `https://${storeId}.salla.sa/reviews`;

        // Create review document in Firestore
        const reviewRef = db()
            .collection('stores').doc(storeId)
            .collection('reviews')
            .doc();

        const reviewData = {
            orderId,
            customerId,
            customerPhone: formatPhone(customerPhone),
            customerName,
            customerEmail,
            storeName,
            storeReviewLink,
            products: products.slice(0, 5).map(p => ({
                name: p.name || p.product_name || p.title || 'منتج',
                id: p.id || p.product_id || null
            })),
            orderValue,
            rating: null,
            feedback: null,
            sentiment: null,
            publicReviewPosted: false,
            referralSent: false,
            supportTicketCreated: false,
            recoveryOfferSent: false,
            discountCodeSent: null,
            flowState: FLOW_STATES.AWAITING_RATING,
            status: 'scheduled',
            sendAt: sendAt.toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            sentAt: null,
            respondedAt: null,
            completedAt: null
        };

        await reviewRef.set(reviewData);

        console.log(`[ReviewCollector] Scheduled review request for order ${orderId} (store: ${storeId}) at ${sendAt.toISOString()}`);

        return {
            success: true,
            reviewId: reviewRef.id,
            sendAt: sendAt.toISOString(),
            delayDays: delay
        };
    } catch (error) {
        console.error(`[ReviewCollector] Error scheduling review for order ${orderId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Send the review request WhatsApp message
 * Called when the scheduled time arrives (via cron/keep-alive) or directly
 *
 * @param {string} reviewId - The review document ID
 * @returns {Object} { success, messageId }
 */
async function sendReviewRequest(reviewId) {
    if (!reviewId) {
        return { success: false, error: 'Missing reviewId' };
    }

    try {
        // Find the review document - search across all stores
        const reviewDoc = await findReviewById(reviewId);
        if (!reviewDoc) {
            return { success: false, error: `Review ${reviewId} not found` };
        }

        const review = reviewDoc.data;
        const storeId = reviewDoc.storeId;

        // Skip if already sent
        if (review.status === 'sent' || review.status === 'completed') {
            console.log(`[ReviewCollector] Review ${reviewId} already ${review.status}, skipping`);
            return { success: true, alreadySent: true };
        }

        if (!whatsappClient) {
            return { success: false, error: 'WhatsApp client not available' };
        }

        // Check WhatsApp connection
        const connected = await whatsappClient.isConnected(storeId);
        if (!connected) {
            console.log(`[ReviewCollector] WhatsApp not connected for store ${storeId}`);
            return { success: false, error: 'WhatsApp not connected' };
        }

        // Send the initial rating request message
        const message = MESSAGES.reviewRequest(review.customerName, review.storeName);
        const result = await whatsappClient.sendMessage(storeId, review.customerPhone, message);

        if (result.success) {
            // Update review status
            await reviewDoc.ref.update({
                status: 'sent',
                flowState: FLOW_STATES.AWAITING_RATING,
                sentAt: new Date().toISOString(),
                messageId: result.messageId || null
            });

            // Register in pending_reviews for reply tracking
            const phoneKey = review.customerPhone.replace(/\D/g, '');
            await db().collection('pending_reviews').doc(phoneKey).set({
                storeId,
                reviewId,
                orderId: review.orderId,
                customerName: review.customerName,
                phone: review.customerPhone,
                flowState: FLOW_STATES.AWAITING_RATING,
                awaitingReply: true,
                sentAt: new Date().toISOString()
            });

            console.log(`[ReviewCollector] Review request sent to ${review.customerPhone} for review ${reviewId}`);
        } else {
            console.error(`[ReviewCollector] Failed to send review request: ${result.error}`);
        }

        return result;
    } catch (error) {
        console.error(`[ReviewCollector] Error sending review request ${reviewId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Handle incoming WhatsApp response - processes 1-5 rating
 * Called by the incoming message handler when a reply is detected
 *
 * @param {string} phone - Customer phone number
 * @param {string} message - The incoming message text
 * @param {string} storeId - The store/merchant ID
 * @returns {Object} { handled, rating, sentiment, action }
 */
async function handleReviewResponse(phone, message, storeId) {
    const phoneKey = phone.replace(/\D/g, '');
    const pendingRef = db().collection('pending_reviews').doc(phoneKey);

    try {
        const pendingSnap = await pendingRef.get();
        if (!pendingSnap.exists || !pendingSnap.data().awaitingReply) {
            return { handled: false, reason: 'no_pending_review' };
        }

        const pending = pendingSnap.data();
        const resolvedStoreId = storeId || pending.storeId;
        const reviewId = pending.reviewId;
        const flowState = pending.flowState || FLOW_STATES.AWAITING_RATING;

        // Get review document
        const reviewRef = db()
            .collection('stores').doc(resolvedStoreId)
            .collection('reviews').doc(reviewId);
        const reviewSnap = await reviewRef.get();

        if (!reviewSnap.exists) {
            return { handled: false, reason: 'review_doc_not_found' };
        }

        const review = reviewSnap.data();
        const trimmedMsg = message.trim();

        // ==========================================
        // STATE MACHINE: Handle based on flow state
        // ==========================================

        if (flowState === FLOW_STATES.AWAITING_RATING) {
            return await processRating(trimmedMsg, {
                phone, phoneKey, resolvedStoreId, reviewId,
                reviewRef, review, pendingRef
            });
        }

        if (flowState === FLOW_STATES.AWAITING_FEEDBACK) {
            return await handleFeedback(reviewId, trimmedMsg, {
                phone, phoneKey, resolvedStoreId,
                reviewRef, review, pendingRef
            });
        }

        if (flowState === FLOW_STATES.AWAITING_PUBLIC_REVIEW) {
            // Any response after public review request is a thank you trigger
            return await completeReviewFlow(phone, phoneKey, resolvedStoreId, reviewId, reviewRef, review, pendingRef, trimmedMsg);
        }

        return { handled: false, reason: 'unknown_flow_state' };
    } catch (error) {
        console.error(`[ReviewCollector] Error handling review response from ${phone}:`, error);
        return { handled: false, error: error.message };
    }
}

/**
 * Process a 1-5 star rating response
 */
async function processRating(message, ctx) {
    const { phone, phoneKey, resolvedStoreId, reviewId, reviewRef, review, pendingRef } = ctx;

    // Extract numeric rating (1-5)
    const rating = extractRating(message);

    if (!rating) {
        // Could not parse rating - send a gentle reminder
        if (whatsappClient) {
            try {
                await whatsappClient.sendMessage(resolvedStoreId, phone,
                    'رد برقم من 1 لـ 5 عشان نقدر نساعدك \u{1F60A}\n' +
                    '5 = ممتاز ⭐\n' +
                    '1 = سيء'
                );
            } catch (e) {
                console.error(`[ReviewCollector] Error sending rating reminder:`, e.message);
            }
        }
        return { handled: true, action: 'rating_reminder_sent', parsed: false };
    }

    const now = new Date().toISOString();
    const isHappy = rating >= 4;
    const sentiment = rating >= 4 ? 'positive' : (rating <= 2 ? 'negative' : 'neutral');

    console.log(`[ReviewCollector] Rating received: ${rating}/5 (${sentiment}) from ${phone} for review ${reviewId}`);

    // Update review document with rating
    await reviewRef.update({
        rating,
        sentiment,
        respondedAt: now,
        status: 'responded'
    });

    // Route based on rating
    if (isHappy) {
        // ==========================================
        // HAPPY PATH (4-5 stars)
        // → Ask for public review + send discount
        // ==========================================
        const reviewLink = review.storeReviewLink || `https://${resolvedStoreId}.salla.sa/reviews`;
        const discountCode = HAPPY_DISCOUNT_CODE;

        if (whatsappClient) {
            try {
                await whatsappClient.sendMessage(
                    resolvedStoreId, phone,
                    MESSAGES.happyResponse(reviewLink, discountCode)
                );
            } catch (e) {
                console.error(`[ReviewCollector] Error sending happy response:`, e.message);
            }
        }

        // Update flow state
        await Promise.all([
            reviewRef.update({
                flowState: FLOW_STATES.AWAITING_PUBLIC_REVIEW,
                discountCodeSent: discountCode
            }),
            pendingRef.update({
                flowState: FLOW_STATES.AWAITING_PUBLIC_REVIEW,
                ratedAt: now
            })
        ]);

        // Send referral offer for 5-star ratings
        if (rating === 5) {
            await sendReferralOffer(resolvedStoreId, phone, review.customerEmail, reviewId, reviewRef);
        }

        // Log analytics event
        await logAnalyticsEvent('review_rating_happy', {
            storeId: resolvedStoreId,
            reviewId,
            orderId: review.orderId,
            rating,
            sentiment
        });

        return {
            handled: true,
            rating,
            sentiment,
            action: 'happy_path',
            publicReviewRequested: true,
            discountCode
        };
    } else {
        // ==========================================
        // UNHAPPY PATH (1-3 stars)
        // → Route to support + ask for feedback + send recovery discount
        // ==========================================
        const discountCode = UNHAPPY_DISCOUNT_CODE;

        if (whatsappClient) {
            try {
                await whatsappClient.sendMessage(
                    resolvedStoreId, phone,
                    MESSAGES.unhappyResponse(discountCode)
                );
            } catch (e) {
                console.error(`[ReviewCollector] Error sending unhappy response:`, e.message);
            }
        }

        // Update flow state to await feedback text
        await Promise.all([
            reviewRef.update({
                flowState: FLOW_STATES.AWAITING_FEEDBACK,
                discountCodeSent: discountCode,
                recoveryOfferSent: true
            }),
            pendingRef.update({
                flowState: FLOW_STATES.AWAITING_FEEDBACK,
                ratedAt: now
            })
        ]);

        // Create support ticket
        await routeToSupport(reviewId, {
            storeId: resolvedStoreId,
            reviewRef,
            review,
            rating
        });

        // Log analytics event
        await logAnalyticsEvent('review_rating_unhappy', {
            storeId: resolvedStoreId,
            reviewId,
            orderId: review.orderId,
            rating,
            sentiment
        });

        return {
            handled: true,
            rating,
            sentiment,
            action: 'unhappy_path',
            supportTicketCreated: true,
            recoveryOfferSent: true,
            discountCode
        };
    }
}

/**
 * Handle text feedback from an unhappy customer (or any follow-up text)
 *
 * @param {string} reviewId - The review document ID
 * @param {string} feedback - The customer's feedback text
 * @param {Object} [ctx] - Internal context (used when called from handleReviewResponse)
 * @returns {Object} { handled, feedbackSaved }
 */
async function handleFeedback(reviewId, feedback, ctx = null) {
    try {
        let reviewRef, review, phone, phoneKey, resolvedStoreId, pendingRef;

        if (ctx) {
            // Called from handleReviewResponse with full context
            ({ reviewRef, review, phone, phoneKey, resolvedStoreId, pendingRef } = ctx);
        } else {
            // Called directly - look up review
            const reviewDoc = await findReviewById(reviewId);
            if (!reviewDoc) {
                return { handled: false, error: 'Review not found' };
            }
            reviewRef = reviewDoc.ref;
            review = reviewDoc.data;
            resolvedStoreId = reviewDoc.storeId;
            phone = review.customerPhone;
            phoneKey = phone.replace(/\D/g, '');
            pendingRef = db().collection('pending_reviews').doc(phoneKey);
        }

        const now = new Date().toISOString();

        // Analyze sentiment of feedback text
        const textSentiment = analyzeTextSentiment(feedback);

        // Save feedback to review
        await reviewRef.update({
            feedback,
            feedbackSentiment: textSentiment,
            feedbackReceivedAt: now,
            flowState: FLOW_STATES.COMPLETED,
            status: 'completed',
            completedAt: now
        });

        // Update support ticket if one exists
        const ticketSnap = await db()
            .collection('stores').doc(resolvedStoreId)
            .collection('support_tickets')
            .where('reviewId', '==', reviewId)
            .limit(1)
            .get();

        if (!ticketSnap.empty) {
            await ticketSnap.docs[0].ref.update({
                customerFeedback: feedback,
                feedbackSentiment: textSentiment,
                updatedAt: now,
                status: 'feedback_received'
            });
        }

        // Send thank you message
        await sendThankYou(reviewId, {
            phone, resolvedStoreId, reviewRef, review, pendingRef, phoneKey
        });

        // Log analytics
        await logAnalyticsEvent('review_feedback_received', {
            storeId: resolvedStoreId,
            reviewId,
            orderId: review.orderId,
            feedbackLength: feedback.length,
            feedbackSentiment: textSentiment
        });

        console.log(`[ReviewCollector] Feedback received for review ${reviewId}: "${feedback.substring(0, 50)}..."`);

        return { handled: true, feedbackSaved: true, sentiment: textSentiment };
    } catch (error) {
        console.error(`[ReviewCollector] Error handling feedback for review ${reviewId}:`, error);
        return { handled: false, error: error.message };
    }
}

/**
 * Route unhappy customer to support - create a support ticket
 *
 * @param {string} reviewId - The review document ID
 * @param {Object} [ctx] - Internal context
 * @returns {Object} { success, ticketId }
 */
async function routeToSupport(reviewId, ctx = null) {
    try {
        let storeId, review, rating, reviewRef;

        if (ctx) {
            ({ storeId, review, rating, reviewRef } = ctx);
        } else {
            const reviewDoc = await findReviewById(reviewId);
            if (!reviewDoc) {
                return { success: false, error: 'Review not found' };
            }
            storeId = reviewDoc.storeId;
            review = reviewDoc.data;
            rating = review.rating;
            reviewRef = reviewDoc.ref;
        }

        // Create support ticket
        const ticketRef = db()
            .collection('stores').doc(storeId)
            .collection('support_tickets')
            .doc();

        const ticket = {
            reviewId,
            orderId: review.orderId,
            customerId: review.customerId,
            customerPhone: review.customerPhone,
            customerName: review.customerName,
            customerEmail: review.customerEmail,
            rating,
            products: review.products || [],
            orderValue: review.orderValue || 0,
            status: 'open',
            priority: rating <= 1 ? 'urgent' : (rating <= 2 ? 'high' : 'normal'),
            customerFeedback: null,
            internalNotes: null,
            assignedTo: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            resolvedAt: null
        };

        await ticketRef.set(ticket);

        // Mark review as having support ticket
        await reviewRef.update({
            supportTicketCreated: true,
            supportTicketId: ticketRef.id
        });

        console.log(`[ReviewCollector] Support ticket created: ${ticketRef.id} (priority: ${ticket.priority}) for review ${reviewId}`);

        return { success: true, ticketId: ticketRef.id, priority: ticket.priority };
    } catch (error) {
        console.error(`[ReviewCollector] Error creating support ticket for review ${reviewId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Send thank you message with discount code
 *
 * @param {string} reviewId - The review document ID
 * @param {Object} [ctx] - Internal context
 * @returns {Object} { success }
 */
async function sendThankYou(reviewId, ctx = null) {
    try {
        let phone, resolvedStoreId, review, reviewRef, pendingRef, phoneKey;

        if (ctx) {
            ({ phone, resolvedStoreId, review, reviewRef, pendingRef, phoneKey } = ctx);
        } else {
            const reviewDoc = await findReviewById(reviewId);
            if (!reviewDoc) {
                return { success: false, error: 'Review not found' };
            }
            reviewRef = reviewDoc.ref;
            review = reviewDoc.data;
            resolvedStoreId = reviewDoc.storeId;
            phone = review.customerPhone;
            phoneKey = phone.replace(/\D/g, '');
            pendingRef = db().collection('pending_reviews').doc(phoneKey);
        }

        if (!whatsappClient) {
            return { success: false, error: 'WhatsApp client not available' };
        }

        const isHappy = review.rating >= 4;
        const thankYouMessage = isHappy
            ? MESSAGES.thankYouAfterReview(review.customerName)
            : MESSAGES.thankYouAfterFeedback(review.customerName);

        const connected = await whatsappClient.isConnected(resolvedStoreId);
        if (!connected) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        const result = await whatsappClient.sendMessage(resolvedStoreId, phone, thankYouMessage);

        if (result.success) {
            const now = new Date().toISOString();

            // Mark pending review as complete
            await pendingRef.update({
                awaitingReply: false,
                flowState: FLOW_STATES.COMPLETED,
                completedAt: now
            });

            // Update review if not already completed
            if (review.status !== 'completed') {
                await reviewRef.update({
                    status: 'completed',
                    flowState: FLOW_STATES.COMPLETED,
                    completedAt: now
                });
            }

            console.log(`[ReviewCollector] Thank you sent to ${phone} for review ${reviewId}`);
        }

        return { success: result.success };
    } catch (error) {
        console.error(`[ReviewCollector] Error sending thank you for review ${reviewId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Complete the review flow for happy path (after public review link was sent)
 */
async function completeReviewFlow(phone, phoneKey, storeId, reviewId, reviewRef, review, pendingRef, message) {
    const now = new Date().toISOString();

    // Check if they mentioned they left a review
    const reviewConfirmKeywords = ['كتبت', 'قيمت', 'حطيت', 'سويت', 'تم', 'done', 'ok'];
    const didReview = reviewConfirmKeywords.some(kw => message.toLowerCase().includes(kw));

    await reviewRef.update({
        publicReviewPosted: didReview,
        publicReviewResponse: message,
        flowState: FLOW_STATES.COMPLETED,
        status: 'completed',
        completedAt: now
    });

    // Send thank you
    await sendThankYou(reviewId, {
        phone, resolvedStoreId: storeId, review: { ...review, rating: review.rating },
        reviewRef, pendingRef, phoneKey
    });

    await logAnalyticsEvent('review_flow_completed', {
        storeId,
        reviewId,
        orderId: review.orderId,
        rating: review.rating,
        publicReviewPosted: didReview
    });

    return {
        handled: true,
        action: 'flow_completed',
        publicReviewPosted: didReview
    };
}

// ==========================================
// REFERRAL INTEGRATION
// ==========================================

/**
 * Send referral offer to happy customers (5-star)
 */
async function sendReferralOffer(storeId, phone, customerEmail, reviewId, reviewRef) {
    if (!referralSystem || !customerEmail) return;

    try {
        const storeDomain = `${storeId}.salla.sa`;
        const referral = referralSystem.getOrCreateReferral(storeId, customerEmail, storeDomain);

        if (referral && referral.link && whatsappClient) {
            // Small delay so messages don't overlap
            setTimeout(async () => {
                try {
                    const connected = await whatsappClient.isConnected(storeId);
                    if (connected) {
                        await whatsappClient.sendMessage(storeId, phone, MESSAGES.referralOffer(referral.link));
                        await reviewRef.update({ referralSent: true });
                        console.log(`[ReviewCollector] Referral offer sent to ${phone}`);
                    }
                } catch (e) {
                    console.error(`[ReviewCollector] Error sending referral offer:`, e.message);
                }
            }, 3000); // 3 second delay between messages
        }
    } catch (e) {
        console.error(`[ReviewCollector] Error creating referral:`, e.message);
    }
}

// ==========================================
// SCHEDULED PROCESSING (call from keep-alive/cron)
// ==========================================

/**
 * Process all scheduled review requests that are due
 * Call this from your cron/keep-alive endpoint (every 5-15 minutes)
 *
 * @returns {Object} { processed, sent, errors }
 */
async function processScheduledReviews() {
    try {
        const now = new Date().toISOString();
        let processed = 0;
        let sent = 0;
        let errors = 0;

        // Get all stores
        const storesSnap = await db().collection('stores').get();

        for (const storeDoc of storesSnap.docs) {
            const storeId = storeDoc.id;

            // Find scheduled reviews that are due
            const dueReviews = await db()
                .collection('stores').doc(storeId)
                .collection('reviews')
                .where('status', '==', 'scheduled')
                .where('sendAt', '<=', now)
                .limit(20) // Process in batches
                .get();

            for (const reviewDoc of dueReviews.docs) {
                processed++;

                try {
                    const result = await sendReviewRequest(reviewDoc.id);
                    if (result.success) {
                        sent++;
                    } else {
                        errors++;
                        console.log(`[ReviewCollector] Failed to send review ${reviewDoc.id}: ${result.error}`);
                    }
                } catch (e) {
                    errors++;
                    console.error(`[ReviewCollector] Error processing review ${reviewDoc.id}:`, e.message);
                }
            }
        }

        if (processed > 0) {
            console.log(`[ReviewCollector] Processed ${processed} scheduled reviews: ${sent} sent, ${errors} errors`);
        }

        return { processed, sent, errors };
    } catch (error) {
        console.error(`[ReviewCollector] Error processing scheduled reviews:`, error);
        return { processed: 0, sent: 0, errors: 1, error: error.message };
    }
}

// ==========================================
// STATS & ANALYTICS
// ==========================================

/**
 * Get review statistics for a store dashboard
 *
 * @param {string} storeId - The store/merchant ID
 * @param {number} [days=30] - Number of days to look back
 * @returns {Object} Review stats
 */
async function getReviewStats(storeId, days = 30) {
    if (!storeId) {
        return { success: false, error: 'Missing storeId' };
    }

    try {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const reviewsSnap = await db()
            .collection('stores').doc(storeId)
            .collection('reviews')
            .where('createdAt', '>=', cutoffDate)
            .get();

        const stats = {
            totalReviews: 0,
            scheduled: 0,
            sent: 0,
            responded: 0,
            completed: 0,
            averageRating: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 },
            responseRate: 0,
            publicReviewRate: 0,
            supportTickets: 0,
            recoveryOffersSent: 0,
            referralsSent: 0,
            period: `${days} days`
        };

        let totalRating = 0;
        let ratedCount = 0;
        let publicReviewCount = 0;

        reviewsSnap.forEach(doc => {
            const review = doc.data();
            stats.totalReviews++;

            // Status counts
            switch (review.status) {
                case 'scheduled': stats.scheduled++; break;
                case 'sent': stats.sent++; break;
                case 'responded': stats.responded++; break;
                case 'completed': stats.completed++; break;
            }

            // Rating distribution
            if (review.rating) {
                ratedCount++;
                totalRating += review.rating;
                stats.ratingDistribution[review.rating] = (stats.ratingDistribution[review.rating] || 0) + 1;
            }

            // Sentiment
            if (review.sentiment) {
                stats.sentimentBreakdown[review.sentiment] = (stats.sentimentBreakdown[review.sentiment] || 0) + 1;
            }

            // Flags
            if (review.publicReviewPosted) publicReviewCount++;
            if (review.supportTicketCreated) stats.supportTickets++;
            if (review.recoveryOfferSent) stats.recoveryOffersSent++;
            if (review.referralSent) stats.referralsSent++;
        });

        // Calculate rates
        const sentOrCompleted = stats.sent + stats.responded + stats.completed;
        stats.averageRating = ratedCount > 0 ? Math.round((totalRating / ratedCount) * 10) / 10 : 0;
        stats.responseRate = sentOrCompleted > 0
            ? Math.round(((stats.responded + stats.completed) / sentOrCompleted) * 100)
            : 0;
        stats.publicReviewRate = ratedCount > 0
            ? Math.round((publicReviewCount / ratedCount) * 100)
            : 0;

        return stats;
    } catch (error) {
        console.error(`[ReviewCollector] Error getting review stats for store ${storeId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Calculate Net Promoter Score (NPS) for a store
 *
 * NPS mapping for 1-5 scale:
 * - Promoters: 5 stars (equivalent to 9-10 on NPS scale)
 * - Passives: 4 stars (equivalent to 7-8 on NPS scale)
 * - Detractors: 1-3 stars (equivalent to 0-6 on NPS scale)
 *
 * NPS = % Promoters - % Detractors (range: -100 to +100)
 *
 * @param {string} storeId - The store/merchant ID
 * @param {number} [days=90] - Number of days to look back
 * @returns {Object} { nps, promoters, passives, detractors, totalResponses }
 */
async function calculateNPS(storeId, days = 90) {
    if (!storeId) {
        return { success: false, error: 'Missing storeId' };
    }

    try {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const reviewsSnap = await db()
            .collection('stores').doc(storeId)
            .collection('reviews')
            .where('createdAt', '>=', cutoffDate)
            .get();

        let promoters = 0;  // 5 stars
        let passives = 0;   // 4 stars
        let detractors = 0; // 1-3 stars
        let totalResponses = 0;

        reviewsSnap.forEach(doc => {
            const review = doc.data();
            if (!review.rating) return;

            totalResponses++;

            if (review.rating === 5) {
                promoters++;
            } else if (review.rating === 4) {
                passives++;
            } else {
                detractors++;
            }
        });

        if (totalResponses === 0) {
            return {
                nps: 0,
                promoters: 0,
                passives: 0,
                detractors: 0,
                totalResponses: 0,
                promoterPercent: 0,
                passivePercent: 0,
                detractorPercent: 0,
                period: `${days} days`,
                interpretation: 'no_data'
            };
        }

        const promoterPercent = Math.round((promoters / totalResponses) * 100);
        const passivePercent = Math.round((passives / totalResponses) * 100);
        const detractorPercent = Math.round((detractors / totalResponses) * 100);
        const nps = promoterPercent - detractorPercent;

        // NPS interpretation
        let interpretation;
        if (nps >= 70) interpretation = 'excellent';
        else if (nps >= 50) interpretation = 'great';
        else if (nps >= 30) interpretation = 'good';
        else if (nps >= 0) interpretation = 'needs_improvement';
        else interpretation = 'critical';

        return {
            nps,
            promoters,
            passives,
            detractors,
            totalResponses,
            promoterPercent,
            passivePercent,
            detractorPercent,
            period: `${days} days`,
            interpretation
        };
    } catch (error) {
        console.error(`[ReviewCollector] Error calculating NPS for store ${storeId}:`, error);
        return { success: false, error: error.message };
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Extract numeric rating (1-5) from a message
 * Handles: "5", "⭐5", "5 نجوم", "خمسة", "5/5", etc.
 */
function extractRating(message) {
    const trimmed = message.trim();

    // Direct numeric: "1", "2", "3", "4", "5"
    const numMatch = trimmed.match(/^[١٢٣٤٥1-5]$/);
    if (numMatch) {
        return arabicToNumber(numMatch[0]);
    }

    // Number within short message: "5 نجوم", "⭐ 3", "rating: 4"
    const embeddedMatch = trimmed.match(/[١٢٣٤٥1-5]/);
    if (embeddedMatch && trimmed.length <= 15) {
        return arabicToNumber(embeddedMatch[0]);
    }

    // Arabic number words
    const arabicNumbers = {
        'واحد': 1, 'اثنين': 2, 'ثلاثة': 3, 'ثلاث': 3,
        'اربعة': 4, 'أربعة': 4, 'اربع': 4, 'أربع': 4,
        'خمسة': 5, 'خمس': 5
    };

    for (const [word, num] of Object.entries(arabicNumbers)) {
        if (trimmed.includes(word)) return num;
    }

    // Count star emojis
    const starCount = (trimmed.match(/⭐/g) || []).length;
    if (starCount >= 1 && starCount <= 5) return starCount;

    return null;
}

/**
 * Convert Arabic/Eastern Arabic numerals to standard numbers
 */
function arabicToNumber(char) {
    const arabicMap = { '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5 };
    return arabicMap[char] || parseInt(char, 10) || null;
}

/**
 * Analyze text sentiment using keyword matching
 */
function analyzeTextSentiment(text) {
    if (!text) return 'neutral';

    const lower = text.toLowerCase();
    const posScore = POSITIVE_KEYWORDS.filter(w => lower.includes(w)).length;
    const negScore = NEGATIVE_KEYWORDS.filter(w => lower.includes(w)).length;

    if (negScore > posScore) return 'negative';
    if (posScore > negScore) return 'positive';
    if (posScore > 0) return 'positive';
    return 'neutral';
}

/**
 * Format phone number to standard Saudi format
 */
function formatPhone(phone) {
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '966' + p.slice(1);
    if (p.length === 9) p = '966' + p;
    return p;
}

/**
 * Find a review document by ID across all stores
 * Returns { ref, data, storeId } or null
 */
async function findReviewById(reviewId) {
    // First try: check pending_reviews for store mapping (fast path)
    // The reviewId might be in a pending_review doc that points to the store

    // Search across stores - use collectionGroup for efficiency
    try {
        const snap = await db()
            .collectionGroup('reviews')
            .where(admin.firestore.FieldPath.documentId(), '==', reviewId)
            .limit(1)
            .get();

        // collectionGroup documentId query may not work as expected,
        // so we fall back to a broader approach if needed
        if (!snap.empty) {
            const doc = snap.docs[0];
            const storeId = doc.ref.parent.parent.id;
            return { ref: doc.ref, data: doc.data(), storeId };
        }
    } catch (e) {
        // collectionGroup query may fail if index is not set up
        console.log(`[ReviewCollector] collectionGroup query failed, using fallback: ${e.message}`);
    }

    // Fallback: check pending_reviews for storeId hint
    const pendingSnap = await db().collection('pending_reviews')
        .where('reviewId', '==', reviewId)
        .limit(1)
        .get();

    if (!pendingSnap.empty) {
        const storeId = pendingSnap.docs[0].data().storeId;
        const reviewRef = db()
            .collection('stores').doc(storeId)
            .collection('reviews').doc(reviewId);
        const reviewSnap = await reviewRef.get();
        if (reviewSnap.exists) {
            return { ref: reviewRef, data: reviewSnap.data(), storeId };
        }
    }

    return null;
}

/**
 * Log analytics event to Firestore
 */
async function logAnalyticsEvent(type, data) {
    try {
        await db().collection('analytics_events').add({
            type,
            data,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        // Non-critical - don't fail the flow
        console.error(`[ReviewCollector] Analytics log error:`, e.message);
    }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Core review flow
    scheduleReviewRequest,
    sendReviewRequest,
    handleReviewResponse,
    handleFeedback,
    routeToSupport,
    sendThankYou,

    // Scheduled processing (call from keep-alive/cron)
    processScheduledReviews,

    // Stats & analytics
    getReviewStats,
    calculateNPS,

    // Message templates (for external use/testing)
    MESSAGES,

    // Config constants
    FLOW_STATES,
    HAPPY_DISCOUNT_CODE,
    UNHAPPY_DISCOUNT_CODE,

    // Helpers (for testing)
    extractRating,
    analyzeTextSentiment,
    formatPhone
};
