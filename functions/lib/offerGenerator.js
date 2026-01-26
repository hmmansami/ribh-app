/**
 * 🎯 RIBH AI Offer Generator - Groq powered (FREE), Arabic, Saudi market
 * 
 * Using Groq's FREE tier with allam-2-7b (Arabic-native model)
 * Fallback: llama-3.1-8b-instant (high volume)
 * 
 * Cost: $0/month 🎉
 */
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Models in priority order (all FREE on Groq)
const MODELS = {
  primary: 'allam-2-7b',           // Arabic-native, 7K req/day
  fallback: 'llama-3.1-8b-instant' // 14.4K req/day, basic Arabic
};

const FALLBACK = {
  cart_recovery: {
    headline: 'سلتك تنتظرك! 🛒',
    body: 'مرحباً {name}، منتجاتك بقيمة {value} ريال لا زالت محفوظة لك',
    urgency: '⏰ العرض ينتهي خلال 24 ساعة', cta: 'أكمل طلبك الآن واحصل على خصم 10%'
  },
  upsell: {
    headline: 'عرض خاص لك! ✨',
    body: 'مرحباً {name}، بناءً على مشترياتك، نقترح عليك منتجات مميزة',
    urgency: '🔥 الكمية محدودة', cta: 'اكتشف العروض الحصرية'
  },
  reactivate: {
    headline: 'اشتقنا لك! 💚',
    body: 'مرحباً {name}، مرت فترة من آخر زيارة لك',
    urgency: '🎁 خصم ترحيبي خاص بك', cta: 'عد الآن واستمتع بخصم 15%'
  },
  seasonal: {
    headline: 'عروض الموسم! 🌙',
    body: 'مرحباً {name}، استعد للمناسبة مع أفضل العروض',
    urgency: '⭐ عروض لفترة محدودة', cta: 'تسوق الآن'
  }
};

async function callGroq(prompt, model = MODELS.primary) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${GROQ_API_KEY}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 300
    })
  });
  
  const data = await res.json();
  
  // Handle rate limiting - try fallback model
  if (res.status === 429 && model === MODELS.primary) {
    console.log('⚠️ Primary model rate limited, trying fallback...');
    return callGroq(prompt, MODELS.fallback);
  }
  
  return data.choices?.[0]?.message?.content;
}

function buildPrompt(name, value, products, type) {
  const types = { 
    cart_recovery: 'استرجاع سلة متروكة', 
    upsell: 'عرض ترقية', 
    reactivate: 'إعادة تنشيط عميل', 
    seasonal: 'عرض موسمي' 
  };
  const productList = Array.isArray(products) ? products.slice(0, 3).join('، ') : products;
  return `أنت خبير تسويق سعودي. اكتب رسالة واتساب قصيرة وجذابة.
النوع: ${types[type] || types.cart_recovery}
اسم العميل: ${name}
قيمة السلة: ${value} ريال
المنتجات: ${productList}
أرجع JSON فقط: {"headline":"عنوان جذاب مع إيموجي","body":"نص الرسالة","urgency":"عبارة استعجال","cta":"دعوة للإجراء"}`;
}

function applyFallback(type, name, value) {
  const t = FALLBACK[type] || FALLBACK.cart_recovery;
  return {
    headline: t.headline,
    body: t.body.replace('{name}', name).replace('{value}', value),
    urgency: t.urgency, 
    cta: t.cta
  };
}

/**
 * Generate personalized offer using Groq (FREE)
 * @param {string} customerName - Customer's name
 * @param {number} cartValue - Cart value in SAR  
 * @param {string|string[]} products - Product name(s)
 * @param {string} type - cart_recovery|upsell|reactivate|seasonal
 */
async function generateOffer(customerName, cartValue, products, type = 'cart_recovery') {
  if (!GROQ_API_KEY) {
    console.warn('⚠️ GROQ_API_KEY missing, using fallback templates');
    return applyFallback(type, customerName, cartValue);
  }
  
  try {
    const response = await callGroq(buildPrompt(customerName, cartValue, products, type));
    const match = response?.match(/\{[\s\S]*\}/);
    
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.headline && parsed.body && parsed.cta) return parsed;
    }
    throw new Error('Invalid AI response');
  } catch (err) {
    console.error('AI offer failed:', err.message);
    return applyFallback(type, customerName, cartValue);
  }
}

module.exports = { generateOffer, FALLBACK_TEMPLATES: FALLBACK };
