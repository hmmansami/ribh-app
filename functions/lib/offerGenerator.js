/**
 * 🎯 RIBH $100M Offer Generator - Groq powered (FREE)
 * 6-Part Formula: Headline + Urgency + Scarcity + Bonus + Guarantee + CTA
 */
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODELS = { primary: 'allam-2-7b', fallback: 'llama-3.1-8b-instant' };

const SEASONS = {
  ramadan: { emoji: '🌙', bonus: 'هدية السحور مجاناً', theme: 'بركة رمضان' },
  eid: { emoji: '🎉', bonus: 'تغليف هدايا فاخر مجاناً', theme: 'فرحة العيد' },
  summer: { emoji: '☀️', bonus: 'شحن سريع مجاني', theme: 'عروض الصيف' },
  national_day: { emoji: '🇸🇦', bonus: 'خصم 93% على قطعة', theme: 'فخر السعودية' },
  back_to_school: { emoji: '📚', bonus: 'حقيبة مدرسية هدية', theme: 'موسم المدارس' },
  default: { emoji: '✨', bonus: 'شحن مجاني', theme: 'عروض حصرية' }
};

const PRODUCT_VIBES = {
  fashion: { scarcity: 'المقاسات تنفد بسرعة', guarantee: 'استبدال مجاني 14 يوم' },
  electronics: { scarcity: 'آخر قطعة بالمخزون', guarantee: 'ضمان سنتين + استرداد' },
  beauty: { scarcity: 'إصدار محدود', guarantee: 'إرجاع مجاني إذا لم يناسبك' },
  food: { scarcity: 'طازج ومحدود', guarantee: 'استرداد فوري' },
  default: { scarcity: 'الكمية محدودة جداً', guarantee: 'ضمان استرداد 100%' }
};

const getCartTier = (v) => v >= 500 ? 'vip' : v >= 200 ? 'mid' : 'impulse';
const CART_HOOKS = {
  vip: { head: '👑 عميلنا المميز', hrs: '3 ساعات', disc: '15%' },
  mid: { head: '🔥 فرصتك الأخيرة', hrs: 'ساعتين', disc: '10%' },
  impulse: { head: '⚡ لا تفوّت', hrs: 'ساعة', disc: '5%' }
};

const getTimeGreeting = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'صباح الخير ☀️' : h >= 12 && h < 21 ? 'مساء الخير 🌙' : 'أهلاً ⭐';
};

async function callGroq(prompt, model = MODELS.primary) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.85, max_tokens: 350 })
  });
  if (res.status === 429 && model === MODELS.primary) return callGroq(prompt, MODELS.fallback);
  return (await res.json()).choices?.[0]?.message?.content;
}

function buildPrompt(ctx) {
  const { name, value, products, season, productType, tier, timeGreeting } = ctx;
  const s = SEASONS[season] || SEASONS.default, p = PRODUCT_VIBES[productType] || PRODUCT_VIBES.default, c = CART_HOOKS[tier];
  const prods = Array.isArray(products) ? products.slice(0, 3).join('، ') : products;
  return `أنت خبير تسويق سعودي. اكتب عرض واتساب لا يُقاوم.
العميل: ${name} | السلة: ${value} ريال (${tier}) | المنتجات: ${prods}
الموسم: ${s.theme} ${s.emoji} | نوع: ${productType} | تحية: ${timeGreeting}

أرجع JSON فقط:
{"headline":"عنوان قوي مع ${c.head}","urgency":"⏰ ينتهي خلال ${c.hrs}","scarcity":"🔥 ${p.scarcity}","bonus":"🎁 ${s.bonus}","guarantee":"✅ ${p.guarantee}","cta":"دعوة قوية مع ←"}`;
}

function buildFallback(ctx) {
  const { name, value, season, productType, tier, timeGreeting } = ctx;
  const s = SEASONS[season] || SEASONS.default, p = PRODUCT_VIBES[productType] || PRODUCT_VIBES.default, c = CART_HOOKS[tier];
  const offer = {
    headline: `${c.head} ${name}! ${s.emoji}`,
    urgency: `⏰ ينتهي خلال ${c.hrs} فقط`,
    scarcity: `🔥 ${p.scarcity} - باقي قطع قليلة`,
    bonus: `🎁 ${s.bonus} + خصم ${c.disc}`,
    guarantee: `✅ ${p.guarantee}`,
    cta: `أكمل طلبك الآن ← واستلم هديتك`
  };
  offer.fullMessage = `${timeGreeting} ${name}\n\n${offer.headline}\n\nسلتك بقيمة ${value} ريال تنتظرك!\n\n${offer.urgency}\n${offer.scarcity}\n${offer.bonus}\n${offer.guarantee}\n\n${offer.cta}`;
  return offer;
}

/**
 * 🚀 Generate $100M Offer
 * @param {Object} opts - { name, value, products, season, productType }
 * @returns {Object} { headline, urgency, scarcity, bonus, guarantee, cta, fullMessage }
 */
async function generateOffer(opts = {}) {
  const { name = 'عميلنا', value = 0, products = [], season = 'default', productType = 'default' } = opts;
  const ctx = { name, value, products, season, productType, tier: getCartTier(value), timeGreeting: getTimeGreeting() };
  
  if (!GROQ_API_KEY) return buildFallback(ctx);
  
  try {
    const response = await callGroq(buildPrompt(ctx));
    const match = response?.match(/\{[\s\S]*\}/);
    if (match) {
      const offer = JSON.parse(match[0]);
      if (offer.headline && offer.cta) {
        offer.fullMessage = `${ctx.timeGreeting} ${name}\n\n${offer.headline}\n\nسلتك بقيمة ${value} ريال جاهزة!\n\n${offer.urgency}\n${offer.scarcity}\n${offer.bonus}\n${offer.guarantee}\n\n${offer.cta}`;
        return offer;
      }
    }
    throw new Error('Invalid');
  } catch (e) {
    return buildFallback(ctx);
  }
}

module.exports = { generateOffer, SEASONS, PRODUCT_VIBES, CART_HOOKS };
