/**
 * 🤖 AI CONTENT GENERATOR - Gemini/Groq Personalized Messages
 *
 * Generates AI-personalized marketing messages for each customer.
 * Similar to Attentive's Brand Voice AI + Audiences AI — every message is unique.
 *
 * Priority: Gemini (free, fast) → Groq (free) → Template fallback
 *
 * All content is Arabic-first, Saudi tone, RTL-aware.
 */

const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GEMINI_MODEL = 'gemini-1.5-flash';
const GROQ_MODEL_PRIMARY = 'allam-2-7b';
const GROQ_MODEL_FALLBACK = 'llama-3.1-8b-instant';

// ==========================================
// AI PROVIDER CALLS
// ==========================================

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300,
            topP: 0.9
          }
        })
      }
    );
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.log('⚠️ Gemini API error:', e.message);
    return null;
  }
}

async function callGroq(prompt, model = GROQ_MODEL_PRIMARY) {
  if (!GROQ_API_KEY) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.85,
        max_tokens: 300
      })
    });
    if (response.status === 429 && model === GROQ_MODEL_PRIMARY) {
      return callGroq(prompt, GROQ_MODEL_FALLBACK);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.log('⚠️ Groq API error:', e.message);
    return null;
  }
}

/**
 * Call AI with fallback chain: Gemini → Groq → null
 */
async function callAI(prompt) {
  // Try Gemini first (faster, better Arabic)
  const geminiResult = await callGemini(prompt);
  if (geminiResult) return { text: geminiResult, provider: 'gemini' };

  // Fallback to Groq
  const groqResult = await callGroq(prompt);
  if (groqResult) return { text: groqResult, provider: 'groq' };

  return null;
}

// ==========================================
// MESSAGE PERSONALIZATION
// ==========================================

/**
 * Main personalization function.
 * Takes a base template message + customer context → returns AI-enhanced version.
 */
async function personalizeForCustomer(opts) {
  const {
    baseMessage,
    customerName,
    cartValue,
    products,
    messageType,
    channel,
    category
  } = opts;

  const prompt = buildPersonalizationPrompt(opts);
  const result = await callAI(prompt);

  if (result?.text) {
    // Clean up AI response
    const cleaned = cleanAIResponse(result.text, channel);
    if (cleaned && cleaned.length > 20 && cleaned.length < 500) {
      return cleaned;
    }
  }

  // Fallback: return base message as-is
  return null;
}

/**
 * Build the AI prompt for message personalization
 */
function buildPersonalizationPrompt(opts) {
  const {
    baseMessage,
    customerName,
    cartValue,
    products,
    messageType,
    channel,
    category
  } = opts;

  const productList = Array.isArray(products)
    ? products.slice(0, 3).map(p => p.name || p.title || 'منتج').join('، ')
    : '';

  const channelGuide = {
    whatsapp: 'واتساب (قصير، ودي، استخدم إيموجي بذكاء، مثل محادثة شخصية)',
    sms: 'رسالة نصية SMS (قصير جداً، أقل من 160 حرف، بدون إيموجي كثيرة)',
    email: 'إيميل (يمكن أن يكون أطول قليلاً، احترافي لكن ودي)'
  };

  const typeGuide = {
    gentle_reminder: 'تذكير لطيف بدون ضغط. لا تذكر خصومات. فقط تذكير ودي.',
    offer: 'عرض خاص مع خصم. اخلق إحساس بالفرصة المحدودة.',
    final_chance: 'آخر فرصة! عرض كبير مع إلحاح حقيقي. الكمية محدودة.',
    thank_you: 'شكر حقيقي وحار بعد الشراء. اجعله يشعر بالتقدير.',
    review_request: 'اطلب تقييم بأسلوب لطيف. كافئ على التقييم.',
    upsell: 'اقترح منتجات مكملة بأسلوب ذكي، ليس بيعي.',
    welcome: 'ترحيب حار بعضو جديد. اجعله يشعر أنه مميز.',
    miss_you: 'رسالة اشتياق حقيقية. ذكّره بأفضل تجربة معك.',
    bigger_offer: 'عرض أكبر وأكثر إلحاحاً. آخر فرصة للعودة.',
    top_products: 'اعرض أفضل المنتجات بأسلوب مشوّق.',
    warm_welcome: 'ترحيب دافئ بعضو جديد مع عرض أول طلب.',
    curated_picks: 'اقتراحات مختارة بعناية.',
    friendly_review: 'اطلب رأيه بأسلوب صديق.',
    smart_recommendation: 'توصيات ذكية بناءً على مشترياته.',
    personal_winback: 'رسالة شخصية لعميل غائب.',
    urgency_winback: 'إلحاح لعميل غائب مع أكبر عرض.'
  };

  return `أنت مسوّق سعودي محترف. اكتب رسالة ${channelGuide[channel] || channelGuide.whatsapp}.

نوع الرسالة: ${typeGuide[messageType] || 'رسالة تسويقية'}

معلومات العميل:
- الاسم: ${customerName || 'عميلنا العزيز'}
- قيمة السلة: ${cartValue || '0'} ر.س
- المنتجات: ${productList || 'منتجات متنوعة'}
- فئة المتجر: ${category || 'عام'}

الرسالة الأساسية (حسّنها واجعلها أكثر شخصية):
${baseMessage}

القواعد:
1. اكتب بالعربية السعودية العامية (مثل "وش رايك" بدل "ما رأيك")
2. اجعلها شخصية وطبيعية كأنها من صديق
3. لا تضف روابط أو أكواد جديدة — الروابط والأكواد الموجودة في الرسالة الأساسية ستُدرج تلقائياً
4. حافظ على العناصر الأساسية: الاسم، القيمة، الخصم إن وُجد
5. ${channel === 'sms' ? 'أقل من 140 حرف عربي!' : 'أقل من 300 حرف!'}
6. لا تستخدم إيموجي أكثر من 3

اكتب الرسالة المحسّنة فقط بدون مقدمات أو شرح:`;
}

// ==========================================
// OFFER GENERATION (AI-powered)
// ==========================================

/**
 * Generate a smart, personalized offer for a cart.
 * Uses customer segment + cart analysis to determine the best offer.
 */
async function generateSmartOffer(cartData, customerData) {
  const cartValue = cartData?.total || cartData?.amounts?.total || 0;
  const segment = classifyCustomer(customerData);
  const tier = getOfferTier(cartValue, segment);

  // Try AI-generated offer text
  const prompt = buildOfferPrompt(cartData, customerData, tier);
  const result = await callAI(prompt);

  const offer = {
    discount: tier.discount,
    type: tier.type,
    code: generateDiscountCode(tier),
    message: result?.text ? cleanAIResponse(result.text, 'whatsapp') : tier.fallbackMessage,
    headline: tier.headline,
    urgencyHours: tier.urgencyHours,
    provider: result?.provider || 'template',
    segment: segment.type
  };

  return offer;
}

/**
 * Classify customer by behavior (RFM-lite)
 * Similar to Klaviyo's predictive segmentation
 */
function classifyCustomer(customerData) {
  if (!customerData) return { type: 'new', label: 'عميل جديد' };

  const orders = customerData.orderCount || customerData.orders_count || 0;
  const totalSpent = customerData.totalSpent || customerData.total_spent || 0;

  if (orders >= 5 || totalSpent >= 2000) return { type: 'vip', label: 'عميل VIP' };
  if (orders >= 2 || totalSpent >= 500) return { type: 'returning', label: 'عميل متكرر' };
  if (orders >= 1) return { type: 'existing', label: 'عميل حالي' };
  return { type: 'new', label: 'عميل جديد' };
}

/**
 * Determine offer tier based on cart value + customer segment
 */
function getOfferTier(cartValue, segment) {
  // VIP customers get bigger offers
  if (segment.type === 'vip') {
    return {
      discount: cartValue >= 500 ? 20 : 15,
      type: 'percentage',
      headline: '👑 عرض VIP حصري',
      urgencyHours: 6,
      fallbackMessage: `عميلنا المميز، جهزنا لك عرض VIP حصري! خصم خاص لأنك من أفضل عملائنا.`
    };
  }

  // Returning customers — moderate offer
  if (segment.type === 'returning') {
    return {
      discount: cartValue >= 300 ? 15 : 10,
      type: 'percentage',
      headline: '🎁 عرض خاص لك',
      urgencyHours: 12,
      fallbackMessage: `مرحباً! لأنك عميل مميز عندنا، جهزنا لك عرض خاص.`
    };
  }

  // High-value cart from new customer — best offer to convert
  if (cartValue >= 500) {
    return {
      discount: 15,
      type: 'percentage',
      headline: '🔥 عرض حصري',
      urgencyHours: 6,
      fallbackMessage: `فرصة لا تتكرر! خصم خاص على سلتك.`
    };
  }

  // Mid-value cart
  if (cartValue >= 200) {
    return {
      discount: 10,
      type: 'percentage',
      headline: '⚡ فرصة محدودة',
      urgencyHours: 12,
      fallbackMessage: `لا تفوّت الفرصة! عرض خاص على منتجاتك.`
    };
  }

  // Low-value / impulse buy
  return {
    discount: 5,
    type: 'percentage',
    headline: '💫 عرض لك',
    urgencyHours: 24,
    fallbackMessage: `أكمل طلبك واستمتع بخصم خاص!`
  };
}

function generateDiscountCode(tier) {
  const prefix = tier.discount >= 15 ? 'VIP' : tier.discount >= 10 ? 'RIBH' : 'SAVE';
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${tier.discount}${rand}`;
}

function buildOfferPrompt(cartData, customerData, tier) {
  const products = (cartData?.items || cartData?.products || [])
    .slice(0, 3)
    .map(p => p.name || p.title || 'منتج')
    .join('، ');

  return `أنت مسوّق سعودي. اكتب رسالة عرض واتساب قصيرة (أقل من 200 حرف).

العميل: ${customerData?.name || 'عميلنا العزيز'}
نوع العميل: ${tier.headline}
المنتجات: ${products || 'منتجات رائعة'}
قيمة السلة: ${cartData?.total || 0} ر.س
الخصم: ${tier.discount}%
الإلحاح: ينتهي خلال ${tier.urgencyHours} ساعة

القواعد:
1. عربي سعودي عامي
2. شخصي ودافئ
3. لا تذكر روابط (تُضاف تلقائياً)
4. إيموجي واحد أو اثنين فقط
5. اذكر نسبة الخصم والمنتجات

اكتب الرسالة فقط:`;
}

// ==========================================
// BULK CONTENT GENERATION
// ==========================================

/**
 * Pre-generate content for a store's sequences.
 * Called once during activation to prepare message variants.
 * Similar to Attentive's Brand Voice AI training.
 */
async function pregenerateStoreContent(merchantId, storeData) {
  const storeName = storeData?.storeName || storeData?.name || 'المتجر';
  const category = storeData?.category || 'general';

  const prompt = `أنت مسوّق سعودي محترف. المتجر: "${storeName}" (فئة: ${category}).

اكتب 5 رسائل واتساب قصيرة (كل رسالة في سطر جديد، مفصولة بـ ---):

1. رسالة سلة متروكة (تذكير لطيف بدون خصم)
2. رسالة سلة متروكة (مع خصم 10%)
3. رسالة سلة متروكة (آخر فرصة، خصم 15%)
4. رسالة شكر بعد الشراء
5. رسالة ترحيب بعميل جديد (مع خصم 10%)

استخدم {name} للاسم، {cartValue} للقيمة، {discount} للخصم، {checkoutUrl} للرابط.
اكتب بالعربية السعودية. كل رسالة أقل من 200 حرف.`;

  const result = await callAI(prompt);
  if (result?.text) {
    const messages = result.text.split('---').map(m => m.trim()).filter(m => m.length > 20);
    if (messages.length >= 3) {
      // Store pre-generated content
      try {
        const admin = require('firebase-admin');
        const db = admin.firestore();
        await db.collection('store_content').doc(String(merchantId)).set({
          storeName,
          category,
          messages: {
            cart_reminder_1: messages[0] || '',
            cart_reminder_2: messages[1] || '',
            cart_reminder_3: messages[2] || '',
            post_purchase: messages[3] || '',
            welcome: messages[4] || ''
          },
          provider: result.provider,
          generatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`📝 [ContentGen] Pre-generated ${messages.length} messages for ${merchantId}`);
        return { success: true, count: messages.length, provider: result.provider };
      } catch (e) {
        console.log('⚠️ Store content save error:', e.message);
      }
    }
  }

  return { success: false, fallback: 'templates' };
}

// ==========================================
// UTILITIES
// ==========================================

/**
 * Clean AI response — remove markdown, extra whitespace, etc.
 */
function cleanAIResponse(text, channel) {
  if (!text) return null;

  let cleaned = text
    .replace(/```[\s\S]*?```/g, '')   // Remove code blocks
    .replace(/\*\*/g, '')              // Remove bold markdown
    .replace(/^#+\s/gm, '')           // Remove headings
    .replace(/^[-*]\s/gm, '• ')       // Normalize bullets
    .replace(/\n{3,}/g, '\n\n')       // Max 2 newlines
    .trim();

  // SMS length enforcement
  if (channel === 'sms' && cleaned.length > 160) {
    cleaned = cleaned.substring(0, 157) + '...';
  }

  // WhatsApp length enforcement
  if (channel === 'whatsapp' && cleaned.length > 500) {
    cleaned = cleaned.substring(0, 497) + '...';
  }

  return cleaned;
}

/**
 * Get available AI provider info
 */
function getProviderStatus() {
  return {
    gemini: !!GEMINI_API_KEY,
    groq: !!GROQ_API_KEY,
    primary: GEMINI_API_KEY ? 'gemini' : GROQ_API_KEY ? 'groq' : 'templates',
    fallback: GEMINI_API_KEY && GROQ_API_KEY ? 'groq' : 'templates'
  };
}

module.exports = {
  // Core
  personalizeForCustomer,
  generateSmartOffer,
  pregenerateStoreContent,

  // AI callers (exposed for reuse)
  callAI,
  callGemini,
  callGroq,

  // Utilities
  classifyCustomer,
  getProviderStatus,
  cleanAIResponse
};
