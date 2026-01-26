/**
 * 🚀 RIBH AI OFFER GENERATOR v2.0
 * 
 * Creates "STUPID TO SAY NO" offers using:
 * - Gemini AI for creative copy
 * - 100M Offers formula (6 parts)
 * - Seasonal awareness (Ramadan, Eid, etc.)
 * - Customer behavior analysis
 * 
 * PRINCIPLE: Gemini API is nearly free - use it liberally!
 */

const fs = require('fs');
const path = require('path');
const { OfferGenerator: RuleGenerator, SEASONS, PRODUCT_TYPES, CUSTOMER_TYPES, ABANDON_TIMES, BEHAVIORS } = require('./offer-generator');

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
const dataDir = path.dirname(CACHE_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Detect current season
 */
function detectSeason(date = new Date()) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Ramadan (approximate - March/April 2025)
    if (month === 3 || (month === 4 && day <= 10)) return 'ramadan';
    
    // Eid Al-Fitr (week after Ramadan)
    if (month === 4 && day >= 10 && day <= 20) return 'eid';
    
    // Eid Al-Adha (approximate - June 2025)
    if (month === 6 && day >= 5 && day <= 15) return 'eid';
    
    // Saudi National Day
    if (month === 9 && day >= 20 && day <= 26) return 'national';
    
    // White Friday (Black Friday)
    if (month === 11 && day >= 20) return 'whitefriday';
    
    // Year End Sale
    if (month === 12 && day >= 20) return 'newyear';
    
    // Back to School
    if ((month === 8 && day >= 15) || (month === 9 && day <= 15)) return 'backtoschool';
    
    // Summer
    if (month >= 6 && month <= 8) return 'summer';
    
    return 'normal';
}

/**
 * Get time of day for messaging
 */
function getTimeOfDay(date = new Date()) {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) return { period: 'morning', greeting: 'صباح الخير ☀️' };
    if (hour >= 12 && hour < 17) return { period: 'afternoon', greeting: '' };
    if (hour >= 17 && hour < 21) return { period: 'evening', greeting: 'مساء الخير 🌙' };
    return { period: 'night', greeting: '' };
}

/**
 * Build the ULTIMATE prompt for Gemini
 * Includes ALL context: season, customer, product, behavior
 */
function buildSuperPrompt(store, offerType, context) {
    const { products, cartValue, customerData, abandonedTime } = context;
    const productList = products?.map(p => p.name || p.title).join(', ') || 'منتجات متنوعة';
    
    // Detect season & get config
    const season = detectSeason();
    const seasonConfig = SEASONS[season];
    const timeOfDay = getTimeOfDay();
    
    // Detect customer type
    let customerType = 'new';
    if (customerData?.totalOrders >= 10 || customerData?.totalSpent >= 5000) customerType = 'vip';
    else if (customerData?.daysSinceLastOrder > 60) customerType = 'inactive';
    else if (customerData?.totalOrders > 0) customerType = 'returning';
    
    const customerConfig = CUSTOMER_TYPES[customerType];
    
    // Calculate base discount
    let suggestedDiscount = customerConfig.baseDiscount;
    if (abandonedTime > 24) suggestedDiscount += 5;
    if (abandonedTime > 72) suggestedDiscount += 5;
    if (cartValue > 500) suggestedDiscount = Math.max(suggestedDiscount - 5, 5);
    suggestedDiscount = Math.round(suggestedDiscount * seasonConfig.urgencyMultiplier);
    suggestedDiscount = Math.min(suggestedDiscount, 35); // Cap at 35%
    
    // VIP never gets discount
    if (customerType === 'vip') suggestedDiscount = 0;
    
    // Load personality if exists
    let personality = {};
    try {
        const personalityFile = path.join(__dirname, '..', 'data', 'personality.json');
        if (fs.existsSync(personalityFile)) {
            personality = JSON.parse(fs.readFileSync(personalityFile, 'utf8'));
        }
    } catch (e) { }

    const personalityStr = personality.traits ? `شخصية المتجر: ${personality.traits.join(', ')}` : '';

    return `
أنت Alex Hormozi العربي - خبير إنشاء العروض التي لا يمكن رفضها!

📌 السياق:
- المتجر: ${store.merchantName || 'متجر'}
- نوع العرض: ${offerType}
- المنتجات: ${productList}
- قيمة السلة: ${cartValue || 'غير محددة'} ريال
${personalityStr}

📅 الموسم الحالي: ${seasonConfig.nameAr} ${seasonConfig.emoji}
${seasonConfig.greetingAr ? `تحية الموسم: ${seasonConfig.greetingAr}` : ''}

👤 نوع العميل: ${customerConfig.nameAr}
${customerType === 'vip' ? '⭐ عميل VIP - لا يحتاج خصم، يحتاج حصرية!' : ''}
${customerType === 'inactive' ? '💙 عميل غير نشط - يحتاج سبب قوي للعودة!' : ''}

⏰ الوقت: ${timeOfDay.period}

═══════════════════════════════════════
🎯 قانون 100 مليون عرض (6 أجزاء إلزامية):

1️⃣ HEADLINE - عنوان صادم يوقف العميل
2️⃣ URGENCY - ضغط الوقت ("ينتهي خلال X ساعة")
3️⃣ SCARCITY - ندرة الكمية ("باقي X قطع فقط")
4️⃣ BONUS - مكافأة إضافية (شحن مجاني، هدية، ضمان)
5️⃣ GUARANTEE - ضمان يزيل المخاطر ("استرجاع 100% إذا...")
6️⃣ CTA - أمر واضح ("أكمل الطلب الآن")
═══════════════════════════════════════

🎨 نصائح العرض:
- ${seasonConfig.specialOffers.join(' | ')}
- ${customerConfig.guaranteeText}
- الخصم المقترح: ${suggestedDiscount}% (يمكنك تعديله)

📝 مهمتك:
اكتب عرض يجعل العميل يشعر بالغباء إذا رفضه!
استخدم عاطفة + منطق + ندرة + قيمة عالية.

أرجع JSON فقط (بدون شرح):
{
    "headline": "عنوان صادم قصير مع إيموجي",
    "urgency": "ينتهي خلال X ساعة/ساعات",
    "scarcity": "باقي X قطع فقط",
    "bonus": "المكافأة الإضافية",
    "guarantee": "الضمان الذي يزيل المخاطر",
    "cta": "زر الإجراء",
    "discount": ${suggestedDiscount},
    "fullMessage": "الرسالة الكاملة (3-5 سطور) تجمع كل العناصر بشكل مقنع"
}
`;
}

/**
 * Main offer creation with Gemini AI
 */
async function createOffer(store, offerType, context) {
    const { products } = context;
    
    // Check cache first
    const cacheKey = `${store.id}_${offerType}_${JSON.stringify(products?.map(p => p.id || p.name))}_${detectSeason()}`;
    const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};

    if (cache[cacheKey] && new Date(cache[cacheKey].expiresAt) > new Date()) {
        console.log(`🤖 Reusing cached AI offer for ${offerType}`);
        return cache[cacheKey].offer;
    }

    // Build the super prompt
    const prompt = buildSuperPrompt(store, offerType, context);

    try {
        // Call Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.9, // More creative
                    topP: 0.95,
                    maxOutputTokens: 1024
                }
            })
        });

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            // Parse JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const offer = JSON.parse(jsonMatch[0]);
                
                // Ensure all 6 parts exist
                const validatedOffer = validateOffer(offer, offerType, context);

                // Cache for 12 hours (shorter for freshness)
                cache[cacheKey] = {
                    offer: validatedOffer,
                    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
                };
                fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

                console.log(`✨ AI generated ${offerType} offer for ${store.merchantName || store.id}`);
                return validatedOffer;
            }
        }
        
        console.warn('⚠️ Gemini returned invalid response, using fallback');
    } catch (error) {
        console.error('❌ AI offer generation failed:', error.message);
    }

    // Fallback to rule-based
    return getFallbackOffer(offerType, context);
}

/**
 * Validate offer has all 6 parts
 */
function validateOffer(offer, offerType, context) {
    const season = detectSeason();
    const seasonConfig = SEASONS[season];
    
    // Ensure all required fields exist with fallbacks
    return {
        headline: offer.headline || `${seasonConfig.emoji} عرض خاص لا يفوتك!`,
        urgency: offer.urgency || 'ينتهي خلال ساعتين ⏰',
        scarcity: offer.scarcity || 'باقي 3 قطع فقط! 📦',
        bonus: offer.bonus || seasonConfig.specialOffers[0] || 'شحن مجاني 🎁',
        guarantee: offer.guarantee || 'استرجاع مجاني خلال 14 يوم ✅',
        cta: offer.cta || 'أكمل الطلب الآن ←',
        discount: offer.discount || 0,
        fullMessage: offer.fullMessage || buildFallbackMessage(offer),
        
        // Metadata
        season: season,
        seasonEmoji: seasonConfig.emoji,
        generatedBy: 'gemini-ai',
        generatedAt: new Date().toISOString()
    };
}

/**
 * Build fallback message from parts
 */
function buildFallbackMessage(offer) {
    return `${offer.headline || '🛒 عرض خاص لا يفوتك!'}\n\n` +
           `${offer.discount > 0 ? `💥 خصم ${offer.discount}%\n` : ''}` +
           `🎁 ${offer.bonus || 'شحن مجاني'}\n` +
           `✅ ${offer.guarantee || 'ضمان استرجاع كامل'}\n\n` +
           `⏰ ${offer.urgency || 'العرض محدود!'}\n` +
           `📦 ${offer.scarcity || 'الكمية محدودة!'}\n\n` +
           `👇 ${offer.cta || 'اطلب الآن!'}`;
}

/**
 * Smart fallback offers using rule-based generator
 */
function getFallbackOffer(offerType, context) {
    const { cartValue = 0 } = context;
    const season = detectSeason();
    const seasonConfig = SEASONS[season];
    const timeOfDay = getTimeOfDay();

    // Use the rule-based generator for smart fallbacks
    const ruleGen = new RuleGenerator({ language: 'ar' });
    const ruleOffer = ruleGen.generate({
        season: season,
        cartValue: cartValue,
        behavior: offerType === 'conversion' ? 'abandoned' : 
                  offerType === 'attraction' ? 'browsing' : 'repeat',
        customerType: 'new',
        abandonTime: '1h'
    });

    // Merge with 100M formula structure
    const offers = {
        attraction: {
            headline: `${seasonConfig.emoji} ${seasonConfig.greetingAr || ''} هدية ترحيبية خاصة بك!`,
            urgency: 'صالح لمدة 48 ساعة فقط ⏰',
            scarcity: 'عرض للعملاء الجدد فقط! 🌟',
            bonus: seasonConfig.specialOffers[0] || 'شحن مجاني',
            guarantee: 'استرجاع مجاني خلال 14 يوم ✅',
            cta: 'احصل على هديتك الآن →',
            discount: 15,
            fullMessage: null
        },
        conversion: {
            headline: `${seasonConfig.emoji} سلتك تنتظرك! 🛒`,
            urgency: 'العرض ينتهي خلال ساعتين ⏰',
            scarcity: `باقي ${Math.floor(Math.random() * 3) + 2} قطع فقط! 📦`,
            bonus: cartValue > 200 ? 'شحن مجاني 🚚' : 'خصم إضافي على الطلب القادم',
            guarantee: 'استرجاع كامل خلال 30 يوم ✅',
            cta: `وفّر ${cartValue > 500 ? '10' : '5'}% الآن ←`,
            discount: cartValue > 500 ? 10 : 5,
            fullMessage: null
        },
        upsell: {
            headline: `${seasonConfig.emoji} شكراً لطلبك! إليك مكافأة 🎁`,
            urgency: 'صالح لمدة 7 أيام فقط ⏰',
            scarcity: 'عرض حصري لعملائنا المميزين! ⭐',
            bonus: 'نقاط ولاء مضاعفة',
            guarantee: 'نفس ضمان الجودة العالية ✅',
            cta: 'احصل على خصم 20% الآن →',
            discount: 20,
            fullMessage: null
        },
        continuity: {
            headline: `${seasonConfig.emoji} اشتقنالك! 💙`,
            urgency: 'عرض خاص للعودة - لمدة 48 ساعة ⏰',
            scarcity: 'عرض حصري لك فقط! 🎯',
            bonus: seasonConfig.specialOffers[0] || 'شحن مجاني + هدية مفاجأة',
            guarantee: 'نفس الجودة التي أحببتها ✅',
            cta: 'عد إلينا الآن ←',
            discount: 25,
            fullMessage: null
        }
    };

    const baseOffer = offers[offerType] || offers.conversion;
    
    // Build full message
    baseOffer.fullMessage = buildFallbackMessage(baseOffer);
    
    // Add metadata
    baseOffer.season = season;
    baseOffer.seasonEmoji = seasonConfig.emoji;
    baseOffer.generatedBy = 'rule-based-fallback';
    baseOffer.generatedAt = new Date().toISOString();

    // Apply A/B testing if available
    if (abTesting && (offerType === 'conversion' || offerType === 'upsell')) {
        const mapType = offerType === 'conversion' ? 'cart_recovery' : 'upsell';
        return abTesting.generateTestedOffer(mapType, baseOffer);
    }

    return baseOffer;
}

/**
 * Quick offer generator for specific scenarios
 */
async function quickOffer(scenario, context = {}) {
    const store = { id: 'quick', merchantName: context.merchantName || 'المتجر' };
    
    const scenarios = {
        'welcome': 'attraction',
        'cart': 'conversion',
        'thankyou': 'upsell',
        'winback': 'continuity',
        'flash': 'conversion' // Flash sale
    };
    
    return createOffer(store, scenarios[scenario] || 'conversion', context);
}

module.exports = {
    createOffer,
    getFallbackOffer,
    quickOffer,
    detectSeason,
    getTimeOfDay,
    // Export configs for testing
    SEASONS,
    PRODUCT_TYPES,
    CUSTOMER_TYPES
};
