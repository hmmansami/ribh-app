/**
 * 🧠 RIBH CUSTOMER JOURNEY ENGINE - Detect → Offer → Channel → Send → Learn
 */
const admin = require('firebase-admin');
const { sendMessage } = require('./whatsappSender');
const { sendSMS, sendEmail } = require('./fallbackSender');
const getDb = () => admin.firestore();

// 📊 Customer Type Matrix
const CUSTOMER_TYPES = {
  cold:       { offer: 'attraction',   discount: 15, tpl: 'welcome' },
  warm:       { offer: 'upsell',       discount: 0,  tpl: 'upsell' },
  abandoner:  { offer: 'downsell',     discount: 10, tpl: 'recovery' },
  price_sens: { offer: 'payment_plan', discount: 0,  tpl: 'bnpl' },
  first_buy:  { offer: 'upsell',       discount: 5,  tpl: 'post_purchase' },
  repeat:     { offer: 'loyalty',      discount: 20, tpl: 'vip' },
  dormant:    { offer: 'reactivation', discount: 25, tpl: 'comeback' }
};

// 📱 Channel Priority by Type
const CHANNELS = {
  cold: ['email'], warm: ['popup'], abandoner: ['sms', 'email'],
  price_sens: ['sms'], first_buy: ['email'], repeat: ['whatsapp'], dormant: ['sms', 'email']
};

// 🎨 Templates (Arabic)
const TEMPLATES = {
  welcome:       (n, d) => ({ h: `🎉 أهلاً ${n}!`, b: `خصم ${d}% على أول طلب`, c: 'تسوق الآن ←' }),
  upsell:        (n) => ({ h: `⭐ ${n}، شوف الجديد!`, b: 'منتجات تكمّل اختيارك', c: 'اكتشف المزيد ←' }),
  recovery:      (n, d) => ({ h: `😢 ${n}، سلتك وحشتنا!`, b: `خصم ${d}% لو أكملت الآن`, c: 'أكمل طلبك ←' }),
  bnpl:          (n) => ({ h: `💳 ${n}، قسّطها براحتك!`, b: 'ادفع 4 دفعات بدون فوائد - تمارا/تابي', c: 'اختر التقسيط ←' }),
  post_purchase: (n, d) => ({ h: `🙏 شكراً ${n}!`, b: `خصم ${d}% على طلبك القادم`, c: 'تسوق مجدداً ←' }),
  vip:           (n, d) => ({ h: `👑 ${n}، عميلنا VIP!`, b: `خصم حصري ${d}% لك فقط`, c: 'استفد من عرضك ←' }),
  comeback:      (n, d) => ({ h: `💔 افتقدناك ${n}!`, b: `عدنا بخصم ${d}% خصيصاً لك`, c: 'عد لنا ←' })
};

/** 🔍 Detect customer type from history + event */
function detectCustomerType(customer, event) {
  const { orderCount = 0, lastOrderDays = 999, cartValue = 0, hasAbandoned = false } = customer;
  const { type: eventType } = event;
  if (orderCount >= 2) return 'repeat';
  if (orderCount === 1 && eventType === 'order_complete') return 'first_buy';
  if (lastOrderDays >= 30 && orderCount > 0) return 'dormant';
  if (cartValue >= 300 && hasAbandoned) return 'price_sens';
  if (hasAbandoned || eventType === 'cart_abandoned') return 'abandoner';
  if (eventType === 'cart_updated' || eventType === 'add_to_cart') return 'warm';
  return 'cold';
}

/** 🎁 Select offer based on customer type */
function selectOffer(customerType, context = {}) {
  const cfg = CUSTOMER_TYPES[customerType] || CUSTOMER_TYPES.cold;
  const { customerName = 'عميلنا' } = context;
  const t = TEMPLATES[cfg.tpl](customerName, cfg.discount);
  return { type: cfg.offer, discount: cfg.discount, headline: t.h, body: t.b, cta: t.c };
}

/** 📱 Select best channel for customer type */
function selectChannel(customerType, { hasWhatsApp = false, hasEmail = false, hasPhone = false }) {
  const priority = CHANNELS[customerType] || ['email'];
  for (const ch of priority) {
    if (ch === 'whatsapp' && hasWhatsApp) return 'whatsapp';
    if (ch === 'sms' && hasPhone) return 'sms';
    if (ch === 'email' && hasEmail) return 'email';
    if (ch === 'popup') return 'popup';
  }
  return hasWhatsApp ? 'whatsapp' : hasPhone ? 'sms' : hasEmail ? 'email' : null;
}

/** 📨 Send via selected channel */
async function sendViaChannel(channel, contact, offer, checkoutUrl) {
  const msg = `${offer.headline}\n\n${offer.body}\n\n${offer.cta}${checkoutUrl ? `\n\n🔗 ${checkoutUrl}` : ''}`;
  if (channel === 'whatsapp') return sendMessage(contact.phone, msg);
  if (channel === 'sms') return sendSMS(contact.phone, msg.slice(0, 160));
  if (channel === 'email') {
    const html = `<div dir="rtl" style="font-family:Arial;max-width:600px;margin:0 auto;">
      <h2>${offer.headline}</h2><p>${offer.body}</p>
      ${checkoutUrl ? `<a href="${checkoutUrl}" style="background:#25D366;color:#fff;padding:12px 24px;border-radius:8px;display:inline-block;">${offer.cta}</a>` : ''}</div>`;
    return sendEmail(contact.email, offer.headline.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim(), html);
  }
  if (channel === 'popup') return { success: true, channel: 'popup', offer };
  return { success: false, error: 'No channel' };
}

/** 🚀 MAIN: Process customer event - the full brain loop */
async function processCustomerEvent(customer, event) {
  const { id: customerId, phone, email, name } = customer;
  
  // 1. DETECT → 2. SELECT OFFER → 3. SELECT CHANNEL
  const customerType = detectCustomerType(customer, event);
  const offer = selectOffer(customerType, { customerName: name });
  const channel = selectChannel(customerType, { hasWhatsApp: !!phone, hasEmail: !!email, hasPhone: !!phone });
  
  if (!channel || channel === 'popup') return { success: channel === 'popup', customerType, offer, channel };
  
  // 4. SEND
  const result = await sendViaChannel(channel, { phone, email }, offer, event.checkoutUrl);
  
  // 5. TRACK + LEARN
  const db = getDb();
  await db.collection('journey_events').add({
    customerId, customerType, channel, offerType: offer.type, discount: offer.discount,
    success: result.success, timestamp: admin.firestore.FieldValue.serverTimestamp()
  });
  
  if (result.success) {
    db.collection('journey_stats').doc(customerType).set(
      { [`${channel}_sent`]: admin.firestore.FieldValue.increment(1) }, { merge: true }
    ).catch(() => {});
  }
  
  return { success: result.success, customerType, offer, channel, ...result };
}

/** 📈 Track conversion for learning loop */
async function trackConversion(customerId, customerType, channel, orderValue) {
  await getDb().collection('journey_stats').doc(customerType).set({
    [`${channel}_converted`]: admin.firestore.FieldValue.increment(1),
    [`${channel}_revenue`]: admin.firestore.FieldValue.increment(orderValue)
  }, { merge: true });
}

module.exports = { detectCustomerType, selectOffer, selectChannel, processCustomerEvent, trackConversion, CUSTOMER_TYPES };
