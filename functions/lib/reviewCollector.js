/**
 * RIBH Review Collector - Auto-request reviews via WhatsApp after delivery
 * Flow: Order delivered → Wait 2 days → Send WhatsApp → Track response
 */
const admin = require('firebase-admin');
const { sendMessage } = require('./whatsappSender');

const db = () => admin.firestore();
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

// Saudi dialect messages
const MESSAGES = {
  initial: (p) => `أهلين! وصلك طلبك؟ كيف المنتجات؟ ⭐\n\n${p ? `كيف تجربتك مع ${p}؟ رأيك يهمنا!` : 'نتمنى تكون راضي عن الطلب!'}`,
  positive: (link) => `يسعدنا! ممكن تكتب رأيك هنا؟ 🙏\n${link}`,
  negative: 'نعتذر منك! وش المشكلة؟ نبي نساعدك ونحلها لك 🙏'
};

// Sentiment keywords (Arabic)
const POSITIVE = ['ممتاز', 'رائع', 'جميل', 'حلو', 'زين', 'طيب', 'تمام', 'شكرا', 'شكراً', 'راضي', 'مبسوط', 'عجبني', 'روعة', '👍', '❤️', '⭐'];
const NEGATIVE = ['سيء', 'مشكلة', 'خربان', 'تالف', 'متأخر', 'مو زين', 'ما عجبني', 'استرجاع', 'غلط', 'زعلان', '😡', '👎'];

/** Schedule review request 2 days after delivery */
async function scheduleReviewRequest(order) {
  const { storeId, orderId, phone, customerName, products = [], reviewLink } = order;
  if (!storeId || !phone) return { success: false, error: 'Missing storeId or phone' };

  const sendAt = new Date(Date.now() + TWO_DAYS_MS);
  await db().collection('stores').doc(storeId).collection('review_requests').doc(orderId).set({
    orderId, phone, customerName, reviewLink, status: 'scheduled',
    productName: products[0]?.name || products[0]?.title || null,
    sendAt: sendAt.toISOString(), createdAt: new Date().toISOString()
  });
  return { success: true, sendAt: sendAt.toISOString() };
}

/** Send review request WhatsApp message */
async function sendReviewRequest(order) {
  const { storeId, orderId, phone, productName } = order;
  const result = await sendMessage(phone, MESSAGES.initial(productName));

  if (result.success) {
    await db().collection('stores').doc(storeId).collection('review_requests').doc(orderId).update({
      status: 'sent', sentAt: new Date().toISOString(), messageId: result.messageId
    });
    await db().collection('pending_reviews').doc(phone.replace(/\D/g, '')).set({
      storeId, orderId, phone, awaitingReply: true, sentAt: new Date().toISOString()
    });
  }
  return result;
}

/** Handle customer reply to review request */
async function handleReviewReply(from, message) {
  const phoneKey = from.replace(/\D/g, '');
  const pendingRef = db().collection('pending_reviews').doc(phoneKey);
  const pending = await pendingRef.get();
  if (!pending.exists || !pending.data().awaitingReply) return { handled: false };

  const { storeId, orderId } = pending.data();
  const lowerMsg = message.toLowerCase();
  const isNeg = NEGATIVE.some(w => lowerMsg.includes(w));
  const isPos = POSITIVE.some(w => lowerMsg.includes(w));
  const sentiment = isNeg ? 'negative' : (isPos ? 'positive' : 'neutral');

  // Get review link & send response
  const reqDoc = await db().collection('stores').doc(storeId).collection('review_requests').doc(orderId).get();
  const reviewLink = reqDoc.data()?.reviewLink || `https://store.link/review/${orderId}`;
  const response = await sendMessage(from, sentiment === 'negative' ? MESSAGES.negative : MESSAGES.positive(reviewLink));

  // Update records
  const now = new Date().toISOString();
  await Promise.all([
    pendingRef.update({ awaitingReply: false, repliedAt: now, sentiment }),
    db().collection('stores').doc(storeId).collection('review_requests').doc(orderId).update({
      status: sentiment === 'negative' ? 'needs_support' : 'review_sent',
      customerReply: message, sentiment, repliedAt: now
    }),
    db().collection('analytics_events').add({ type: 'review_reply', data: { storeId, orderId, sentiment }, timestamp: now })
  ]);

  return { handled: true, sentiment, responseSent: response.success };
}

/** Get review collection stats for dashboard */
async function getReviewStats(storeId, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const requests = await db().collection('stores').doc(storeId)
    .collection('review_requests').where('createdAt', '>=', cutoff).get();

  const stats = { total: 0, sent: 0, replied: 0, positive: 0, negative: 0, neutral: 0, pending: 0 };
  requests.forEach(doc => {
    const d = doc.data();
    stats.total++;
    if (d.sentAt) stats.sent++;
    if (d.sentiment) { stats.replied++; stats[d.sentiment]++; }
    if (d.status === 'scheduled') stats.pending++;
  });

  stats.replyRate = stats.sent ? Math.round((stats.replied / stats.sent) * 100) : 0;
  stats.positiveRate = stats.replied ? Math.round((stats.positive / stats.replied) * 100) : 0;
  return stats;
}

module.exports = { scheduleReviewRequest, sendReviewRequest, handleReviewReply, getReviewStats, MESSAGES };
