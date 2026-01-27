/**
 * RIBH AI Chatbot - WhatsApp Message Handler
 * Handles customer intents: order status, complaints, product questions, general
 */
const { sendMessage, formatPhone } = require('./whatsappSender');

// Intent keywords (Arabic + English)
const INTENTS = {
  order: ['طلب', 'طلبي', 'شحن', 'توصيل', 'وين', 'متى', 'تتبع', 'order', 'shipping', 'track', 'where', 'when'],
  complaint: ['شكوى', 'مشكلة', 'سيء', 'رديء', 'تالف', 'خطأ', 'غلط', 'complaint', 'problem', 'broken', 'wrong', 'bad'],
  product: ['سعر', 'منتج', 'متوفر', 'لون', 'حجم', 'مقاس', 'كم', 'price', 'product', 'available', 'color', 'size']
};

/** Detect intent from message */
function detectIntent(text) {
  const lower = text.toLowerCase();
  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some(k => lower.includes(k))) return intent;
  }
  return 'general';
}

/** Order status responses in Arabic */
const STATUS_AR = {
  created: 'تم استلام طلبك ✅',
  processing: 'جاري تجهيز طلبك 📦',
  shipped: 'تم شحن طلبك 🚚',
  delivered: 'تم توصيل طلبك ✅',
  cancelled: 'تم إلغاء الطلب ❌'
};

/** Look up order by phone in Firestore */
async function lookupOrder(db, phone) {
  const normalized = formatPhone(phone);
  const snap = await db.collection('orders')
    .where('customer.phone', '==', normalized)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  
  if (snap.empty) {
    // Try alternate format without +
    const alt = normalized.replace('+', '');
    const snap2 = await db.collection('orders')
      .where('customer.phone', '==', alt)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    return snap2.empty ? null : snap2.docs[0].data();
  }
  return snap.docs[0].data();
}

/** Flag complaint for human review */
async function flagComplaint(db, phone, message) {
  await db.collection('complaints').add({
    phone: formatPhone(phone),
    message,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
}

/** Main chatbot handler */
async function handleMessage(db, phone, message) {
  const intent = detectIntent(message);
  let reply;

  switch (intent) {
    case 'order': {
      const order = await lookupOrder(db, phone);
      if (order) {
        const status = STATUS_AR[order.status] || order.status || 'قيد المعالجة';
        reply = `📦 طلبك رقم ${order.referenceId || order.id}\n${status}\n\nإجمالي: ${order.total} ${order.currency || 'ر.س'}`;
        if (order.items?.length) {
          reply += `\nالمنتجات: ${order.items.map(i => i.name).join('، ')}`;
        }
      } else {
        reply = 'عذراً، لم نجد طلب مرتبط برقمك 🤔\nهل تستطيع إرسال رقم الطلب؟';
      }
      break;
    }

    case 'complaint':
      await flagComplaint(db, phone, message);
      reply = 'نعتذر جداً عن أي إزعاج 🙏\nتم تسجيل ملاحظتك وسيتواصل معك فريقنا قريباً.\nشكراً لصبرك وتفهمك ❤️';
      break;

    case 'product':
      reply = 'مرحباً! 👋\nيمكنك تصفح جميع منتجاتنا وأسعارها في المتجر مباشرة 🛒\nهل تحتاج مساعدة بشيء محدد؟';
      break;

    default:
      reply = 'أهلاً وسهلاً! 👋\nكيف أقدر أساعدك اليوم؟\n\n• استفسار عن طلبك\n• أسئلة عن المنتجات\n• أي شيء آخر';
  }

  return sendMessage(phone, reply);
}

/** Process incoming webhook message */
async function processWebhook(db, data) {
  const msg = data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg || msg.type !== 'text') return { handled: false };
  
  const phone = msg.from;
  const text = msg.text?.body || '';
  
  const result = await handleMessage(db, phone, text);
  return { handled: true, intent: detectIntent(text), ...result };
}

module.exports = { handleMessage, processWebhook, detectIntent, lookupOrder };
