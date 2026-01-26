/**
 * WHATSAPP AI ASSISTANT - RIBH
 * Auto-handles: order status, prices, stock, returns, FAQ
 * VALUE: Saves 20+ support hours/month = 4-5k SAR
 */
const admin = require('firebase-admin');
const { sallaApi } = require('./sallaApp');
const GROQ_KEY = process.env.GROQ_API_KEY;
const getDb = () => admin.firestore();

// Intent keywords (Arabic-native)
const INTENTS = {
  order_status: ['وين طلبي', 'طلبي وين', 'اين طلبي', 'تتبع', 'شحن', 'متى يوصل', 'حالة الطلب'],
  price_check: ['كم سعر', 'سعر', 'بكم', 'كم يكلف', 'اسعار'],
  stock_check: ['عندكم', 'متوفر', 'موجود', 'المخزون', 'هل يوجد'],
  return_request: ['ارجع', 'استرجاع', 'ابي ارجع', 'ابغى ارجع', 'استبدال'],
  greeting: ['السلام', 'مرحبا', 'هلا', 'اهلا'],
  thanks: ['شكرا', 'مشكور', 'تسلم', 'يعطيك العافية']
};

function detectIntent(message) {
  const msg = message.toLowerCase().trim();
  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some(kw => msg.includes(kw))) return intent;
  }
  return 'general';
}

function extractProductQuery(message) {
  const patterns = [/(?:كم سعر|بكم|سعر)\s+(.+?)[\?؟\s]*$/i, /(?:عندكم|متوفر)\s+(.+?)[\?؟\s]*$/i];
  for (const p of patterns) {
    const match = message.match(p);
    if (match) return match[1].trim();
  }
  return message.replace(/[؟?]/g, '').trim();
}

// Data fetchers (Salla)
async function getOrderByPhone(phone, merchantId) {
  try {
    const normalized = phone.replace(/\D/g, '').slice(-9);
    const res = await sallaApi(merchantId, `/orders?mobile=${normalized}&per_page=5`);
    return res.data?.[0] || null;
  } catch (e) { console.error('[Assistant] Order error:', e.message); return null; }
}

async function searchProducts(query, merchantId) {
  try {
    const res = await sallaApi(merchantId, `/products?keyword=${encodeURIComponent(query)}&per_page=3`);
    return res.data || [];
  } catch (e) { console.error('[Assistant] Product error:', e.message); return []; }
}

async function getStoreInfo(merchantId) {
  const doc = await getDb().collection('salla_merchants').doc(String(merchantId)).get();
  return doc.exists ? doc.data() : { storeName: 'المتجر' };
}

// AI Response (Groq - FREE)
async function generateAIResponse(context) {
  if (!GROQ_KEY) return context.fallback;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `أنت مساعد خدمة عملاء لمتجر سعودي "${context.storeName}". رد بلهجة سعودية ودية وقصيرة (2-3 جمل).` },
          { role: 'user', content: context.prompt }
        ],
        max_tokens: 150, temperature: 0.7
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || context.fallback;
  } catch (e) { console.error('[Assistant] AI error:', e.message); return context.fallback; }
}

// Response formatters
function formatOrderStatus(order) {
  if (!order) return 'ما لقيت طلب برقم جوالك 🤔\nارسلي رقم الطلب وأبحث لك';
  const status = { pending: '⏳ قيد المراجعة', processing: '📦 جاري التجهيز', 
    shipped: '🚚 في الطريق', delivered: '✅ تم التوصيل', cancelled: '❌ ملغي'
  }[order.status?.slug] || order.status?.name || 'غير معروف';
  let msg = `طلبك #${order.id}\nالحالة: ${status}`;
  if (order.shipping?.tracking_number) msg += `\nرقم الشحن: ${order.shipping.tracking_number}`;
  if (order.shipping?.tracking_link) msg += `\nتتبع: ${order.shipping.tracking_link}`;
  return msg;
}

function formatProducts(products) {
  if (!products.length) return 'ما لقيت المنتج 😅\nابحث عن شي ثاني؟';
  return products.map(p => 
    `📦 ${p.name}\n💰 ${p.price?.amount || p.price} ${p.currency || 'ريال'}${p.quantity > 0 ? '\n✅ متوفر' : '\n❌ نفذ'}${p.url ? '\n🔗 ' + p.url : ''}`
  ).join('\n\n');
}

// Session management (multi-turn)
const sessions = new Map();
const SESSION_TTL = 15 * 60 * 1000;
function getSession(id) { const s = sessions.get(id); return s && Date.now() - s.lastUpdate < SESSION_TTL ? s : null; }
function setSession(id, data) { sessions.set(id, { ...data, lastUpdate: Date.now() }); }

// Main handler
async function handleIncomingMessage(from, message, merchantId) {
  const sessionId = `${merchantId}:${from}`;
  const session = getSession(sessionId);
  const intent = detectIntent(message);
  const { storeName } = await getStoreInfo(merchantId);
  let response;

  switch (intent) {
    case 'order_status':
      response = formatOrderStatus(await getOrderByPhone(from, merchantId));
      break;
    case 'price_check':
    case 'stock_check':
      response = formatProducts(await searchProducts(extractProductQuery(message), merchantId));
      break;
    case 'return_request':
      setSession(sessionId, { intent: 'return', step: 'awaiting_order' });
      response = 'حياك الله 🙏\nعشان نساعدك بالاسترجاع، ارسلي رقم الطلب';
      break;
    case 'greeting':
      response = await generateAIResponse({ storeName, prompt: `عميل يرحب: "${message}". رد بترحيب`, fallback: 'أهلاً وسهلاً! 👋\nكيف أقدر أساعدك؟' });
      break;
    case 'thanks':
      response = 'العفو! 😊\nلو تحتاج شي ثاني أنا موجود';
      break;
    default:
      // Multi-turn return flow
      if (session?.intent === 'return') {
        if (session.step === 'awaiting_order') {
          setSession(sessionId, { intent: 'return', step: 'awaiting_reason', orderId: message.trim() });
          response = 'تمام! وش سبب الاسترجاع؟\n1️⃣ مقاس غلط\n2️⃣ منتج تالف\n3️⃣ غيرت رأيي\n4️⃣ سبب ثاني';
          break;
        }
        if (session.step === 'awaiting_reason') {
          await getDb().collection('return_requests').add({
            merchantId, phone: from, orderId: session.orderId, reason: message,
            status: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          sessions.delete(sessionId);
          response = 'تم تسجيل طلب الاسترجاع ✅\nفريقنا بيتواصل معك خلال 24 ساعة';
          break;
        }
      }
      // General fallback
      response = await generateAIResponse({
        storeName, prompt: `عميل يسأل: "${message}". أجب بشكل مفيد`,
        fallback: 'كيف أقدر أساعدك؟ 🤔\n- وين طلبي؟\n- كم سعر [منتج]؟\n- ابي ارجع الطلب'
      });
  }

  // Log for analytics
  getDb().collection('assistant_logs').add({
    merchantId, phone: from, message, intent, response,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});

  return { success: true, response, intent };
}

module.exports = { handleIncomingMessage, detectIntent, extractProductQuery, getOrderByPhone, searchProducts, generateAIResponse };
