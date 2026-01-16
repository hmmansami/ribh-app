/**
 * AI OFFER GENERATOR - Creates "Stupid to Say No" Offers
 * 
 * Uses Gemini to analyze products and create Hormozi-style offers:
 * - Value stacking (bonuses on top of bonuses)
 * - Psychological pricing
 * - Urgency/scarcity
 */

const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CACHE_FILE = path.join(__dirname, '..', 'data', 'ai_cache.json');

// A/B Testing Integration
let abTesting;
try {
    abTesting = require('./abTesting');
    console.log('✅ A/B Testing active');
} catch (e) {
    abTesting = null;
}

// Ensure data dir exists
if (!fs.existsSync(path.dirname(CACHE_FILE))) {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
}

/**
 * Generate an irresistible offer based on products and context
 * Includes caching to avoid hitting Gemini API limits
 */
async function createOffer(store, offerType, context) {
    const { products, customerEmail, cartValue } = context;

    // Check cache first
    const cacheKey = `${store.id}_${offerType}_${JSON.stringify(products?.map(p => p.id || p.name))}`;
    const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};

    if (cache[cacheKey] && new Date(cache[cacheKey].expiresAt) > new Date()) {
        console.log(`🤖 Reusing cached AI offer for ${offerType}`);
        return cache[cacheKey].offer;
    }

    // Build the prompt for Gemini
    const prompt = buildPrompt(store, offerType, context);

    try {
        // Call Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            // Try to parse JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const offer = JSON.parse(jsonMatch[0]);

                // Save to cache (valid for 24 hours)
                cache[cacheKey] = {
                    offer: offer,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                };
                fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

                return offer;
            }
        }
    } catch (error) {
        console.error('AI offer generation failed:', error.message);
    }

    // Fallback to template offers
    return getFallbackOffer(offerType, context);
}

function buildPrompt(store, offerType, context) {
    const { products, cartValue } = context;
    const productList = products?.map(p => p.name || p.title).join(', ') || 'منتجات متنوعة';

    // Load personality
    let personality = {};
    try {
        const personalityFile = path.join(__dirname, '..', 'data', 'personality.json');
        if (fs.existsSync(personalityFile)) {
            personality = JSON.parse(fs.readFileSync(personalityFile, 'utf8'));
        }
    } catch (e) { }

    const personalityStr = personality.traits ? `Traits: ${personality.traits.join(', ')}` : '';
    const rulesStr = personality.rules ? `Rules: ${personality.rules.join(', ')}` : '';

    return `
أنت خبير تسويق عالمي على غرار Alex Hormozi. مهمتك إنشاء عرض "لا يمكن رفضه".
${personalityStr}
${rulesStr}

المتجر: ${store.merchantName || 'متجر'}
نوع العرض: ${offerType}
المنتجات: ${productList}
قيمة السلة: ${cartValue || 'غير محددة'} ريال

القواعد الأساسية:
1. العرض يجب أن يكون قيمته أعلى بكثير من سعره
2. أضف مكافآت إضافية (شحن مجاني، ضمان، هدية)
3. اخلق شعور بالاستعجال (عرض محدود)
4. اجعل العميل يشعر بالغباء إذا رفض

أرجع JSON فقط بهذا الشكل:
{
    "headline": "عنوان جذاب قصير",
    "body": "نص الرسالة الكاملة (3-4 جمل)",
    "offer": "وصف العرض الفعلي",
    "discount": 10,
    "urgency": "صالح لمدة 24 ساعة فقط",
    "bonuses": ["شحن مجاني", "ضمان 30 يوم"]
}
`;
}

function getFallbackOffer(offerType, context) {
    const { cartValue = 0 } = context;

    const offers = {
        attraction: {
            headline: "🎁 هدية ترحيبية خاصة بك!",
            body: "أهلاً بك في متجرنا! كهدية ترحيبية، احصل على خصم 15% على طلبك الأول مع شحن مجاني.",
            offer: "خصم 15% + شحن مجاني",
            discount: 15,
            urgency: "صالح لمدة 48 ساعة",
            bonuses: ["شحن مجاني", "ضمان الاسترجاع"]
        },
        conversion: {
            headline: "🛒 سلتك تنتظرك!",
            body: `لاحظنا أنك تركت منتجات في سلتك. أكمل طلبك الآن واحصل على خصم ${cartValue > 500 ? '10' : '5'}% كهدية منا.`,
            offer: `خصم ${cartValue > 500 ? '10' : '5'}%`,
            discount: cartValue > 500 ? 10 : 5,
            urgency: "العرض ينتهي خلال 2 ساعة",
            bonuses: ["شحن سريع"]
        },
        upsell: {
            headline: "💎 أكمل تجربتك!",
            body: "شكراً لطلبك! عملاؤنا المميزين يحصلون على خصم 20% على طلبهم القادم.",
            offer: "خصم 20% على الطلب القادم",
            discount: 20,
            urgency: "صالح لمدة 7 أيام",
            bonuses: ["نقاط ولاء مضاعفة"]
        },
        continuity: {
            headline: "😊 اشتقنا لك!",
            body: "مر وقت منذ آخر زيارة لك. لقد جهزنا لك عرض خاص: خصم 25% على أي طلب.",
            offer: "خصم 25% ترحيبي",
            discount: 25,
            urgency: "عرض حصري لك فقط",
            bonuses: ["شحن مجاني", "هدية مفاجأة"]
        }
    };

    const baseOffer = offers[offerType] || offers.conversion;

    // Apply A/B testing to subject/discount if available
    if (abTesting && (offerType === 'conversion' || offerType === 'upsell')) {
        const mapType = offerType === 'conversion' ? 'cart_recovery' : 'upsell';
        return abTesting.generateTestedOffer(mapType, baseOffer);
    }

    return baseOffer;
}

module.exports = {
    createOffer,
    getFallbackOffer
};
