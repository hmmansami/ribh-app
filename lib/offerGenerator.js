/**
 * AI OFFER GENERATOR - Creates "Stupid to Say No" Offers
 * 
 * Uses Gemini to analyze products and create Hormozi-style offers:
 * - Value stacking (bonuses on top of bonuses)
 * - Psychological pricing
 * - Urgency/scarcity
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Generate an irresistible offer based on products and context
 */
async function createOffer(store, offerType, context) {
    const { products, customerEmail, cartValue } = context;

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
                return JSON.parse(jsonMatch[0]);
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

    return `
أنت خبير تسويق عالمي على غرار Alex Hormozi. مهمتك إنشاء عرض "لا يمكن رفضه".

المتجر: ${store.merchantName || 'متجر'}
نوع العرض: ${offerType}
المنتجات: ${productList}
قيمة السلة: ${cartValue || 'غير محددة'} ريال

القواعد:
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

    return offers[offerType] || offers.conversion;
}

module.exports = {
    createOffer,
    getFallbackOffer
};
