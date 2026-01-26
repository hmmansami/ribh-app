/**
 * 🎯 RIBH ENGINE - ONE CLICK MAGIC
 * Store owner clicks ONE button → Money flows. Guaranteed.
 */
const admin = require('firebase-admin');
const { generateOffer } = require('./offerGenerator');
const { sendMessage } = require('./whatsappSender');
const { sendSMS, sendEmail } = require('./fallbackSender');

const getDb = () => admin.firestore();

/** Format offer into WhatsApp-ready message */
function formatMessage(offer, checkoutUrl) {
  return `${offer.headline}\n\n${offer.body}\n\n${offer.urgency}\n\n${offer.cta}${checkoutUrl ? `\n\n🔗 ${checkoutUrl}` : ''}`;
}

/** Track event in Firestore */
async function track(cartKey, event, data = {}) {
  const db = getDb();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('recovery_events').add({ cartKey, event, ...data, timestamp });
  await db.collection('carts').doc(cartKey).update({ [`tracking.${event}`]: new Date().toISOString() }).catch(() => {});
}

/**
 * 🚀 ONE CLICK MAGIC - Process abandoned cart
 * Auto-detects best channel: WhatsApp > SMS > Email
 * Never fails - always tries next channel
 */
async function processAbandonedCart(cart) {
  const { key, phone, email, items = [], totalAmount, checkoutUrl, customerId } = cart;
  const customerName = cart.customerName || cart.customer?.name || 'عميلنا العزيز';
  const products = items.map(i => i.name).filter(Boolean);
  
  // 1. Generate AI offer (auto-fallback to template)
  const offer = await generateOffer(customerName, totalAmount, products, 'cart_recovery');
  const message = formatMessage(offer, checkoutUrl);
  
  // 2. Try WhatsApp first (best channel for Saudi)
  if (phone) {
    const wa = await sendMessage(phone, message);
    if (wa.success) {
      await track(key, 'sent', { channel: 'whatsapp', messageId: wa.messageId });
      return { success: true, channel: 'whatsapp', messageId: wa.messageId, offer };
    }
    console.log(`⚠️ WhatsApp failed: ${wa.error}, trying SMS...`);
  }
  
  // 3. Fallback to SMS
  if (phone) {
    const shortMsg = `${offer.headline}\n${offer.body}\n${checkoutUrl || ''}`.slice(0, 160);
    const sms = await sendSMS(phone, shortMsg);
    if (sms.success) {
      await track(key, 'sent', { channel: 'sms', sid: sms.sid });
      return { success: true, channel: 'sms', sid: sms.sid, offer };
    }
    console.log(`⚠️ SMS failed: ${sms.error}, trying Email...`);
  }
  
  // 4. Fallback to Email
  if (email) {
    const subject = offer.headline.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim() || 'سلتك تنتظرك';
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2>${offer.headline}</h2><p>${offer.body}</p><p><strong>${offer.urgency}</strong></p>
      ${checkoutUrl ? `<a href="${checkoutUrl}" style="background:#25D366;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;margin-top:16px;">${offer.cta}</a>` : ''}
    </div>`;
    const mail = await sendEmail(email, subject, html);
    if (mail.success) {
      await track(key, 'sent', { channel: 'email' });
      return { success: true, channel: 'email', offer };
    }
    console.log(`⚠️ Email failed: ${mail.error}`);
  }
  
  // 5. All channels failed - log but don't throw
  await track(key, 'failed', { reason: 'no_channel_available', phone: !!phone, email: !!email });
  return { success: false, error: 'No channel available', offer };
}

/** Mark recovery as converted (for tracking) */
async function markRecoveryConverted(cartKey, orderValue) {
  await track(cartKey, 'converted', { orderValue });
  await getDb().collection('carts').doc(cartKey).update({
    status: 'recovered', recoveredAt: admin.firestore.FieldValue.serverTimestamp(), orderValue
  }).catch(() => {});
}

module.exports = { processAbandonedCart, markRecoveryConverted, track };
