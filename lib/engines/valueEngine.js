/**
 * RIBH VALUE ENGINE
 * Based on $100M Offers by Alex Hormozi
 * 
 * Purpose: Create offers SO GOOD they feel stupid saying no
 * 
 * Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort)
 * 
 * We maximize:
 * - Dream Outcome: More money for them
 * - Perceived Likelihood: Social proof, guarantees
 * - We minimize:
 * - Time Delay: INSTANT results
 * - Effort: ZERO configuration
 */

// ==========================================
// SEASONAL OFFERS - Auto-updates
// ==========================================

const SEASONAL_CONFIG = {
    // Ramadan (dates approximate, should be dynamic based on Hijri calendar)
    ramadan: {
        keywords: ['رمضان', 'الشهر الفضيل', 'سحور', 'إفطار'],
        offerPrefix: '🌙 عرض رمضان',
        discountBoost: 5, // Extra 5% during Ramadan
        urgencyMessage: 'استعد لرمضان!',
        bestSendTimes: ['09:00', '15:00', '22:00'], // After suhoor, before iftar, after taraweeh
        months: [3, 4] // Approximate Gregorian months
    },

    eid_fitr: {
        keywords: ['عيد الفطر', 'العيد', 'عيدية'],
        offerPrefix: '🎉 عرض العيد',
        discountBoost: 10,
        urgencyMessage: 'جهّز نفسك للعيد!',
        bestSendTimes: ['10:00', '16:00', '20:00'],
        months: [4, 5]
    },

    eid_adha: {
        keywords: ['عيد الأضحى', 'الحج', 'أضحية'],
        offerPrefix: '🐑 عرض عيد الأضحى',
        discountBoost: 10,
        urgencyMessage: 'عروض العيد الكبير!',
        bestSendTimes: ['10:00', '16:00', '20:00'],
        months: [6, 7]
    },

    national_day: {
        keywords: ['اليوم الوطني', 'السعودية', '93'],
        offerPrefix: '🇸🇦 عرض اليوم الوطني',
        discountBoost: 23, // 23rd of September
        urgencyMessage: 'احتفل معنا باليوم الوطني!',
        bestSendTimes: ['12:00', '18:00', '21:00'],
        months: [9],
        days: [23, 24, 25]
    },

    founding_day: {
        keywords: ['يوم التأسيس', 'تأسيس المملكة'],
        offerPrefix: '🏛️ عرض يوم التأسيس',
        discountBoost: 22, // 22nd of February
        urgencyMessage: 'عروض يوم التأسيس!',
        bestSendTimes: ['12:00', '18:00', '21:00'],
        months: [2],
        days: [22, 23]
    },

    white_friday: {
        keywords: ['الجمعة البيضاء', 'بلاك فرايداي', 'تخفيضات'],
        offerPrefix: '⚫ الجمعة البيضاء',
        discountBoost: 15,
        urgencyMessage: '⏰ العروض تنتهي قريباً!',
        bestSendTimes: ['08:00', '12:00', '20:00', '23:00'],
        months: [11],
        weeks: [4] // 4th week of November
    },

    back_to_school: {
        keywords: ['العودة للمدارس', 'المدرسة', 'الدراسة'],
        offerPrefix: '📚 عرض العودة للمدارس',
        discountBoost: 10,
        urgencyMessage: 'جهّز أطفالك للمدرسة!',
        bestSendTimes: ['10:00', '16:00', '20:00'],
        months: [8, 9]
    },

    summer: {
        keywords: ['الصيف', 'إجازة', 'سفر'],
        offerPrefix: '☀️ عرض الصيف',
        discountBoost: 5,
        urgencyMessage: 'استمتع بعروض الصيف!',
        bestSendTimes: ['10:00', '17:00', '22:00'],
        months: [6, 7, 8]
    },

    // Default (no special season)
    default: {
        keywords: [],
        offerPrefix: '🎁 عرض خاص',
        discountBoost: 0,
        urgencyMessage: 'لا تفوّت الفرصة!',
        bestSendTimes: ['10:00', '14:00', '20:00'],
        months: []
    }
};

// ==========================================
// DETECT CURRENT SEASON
// ==========================================

function detectCurrentSeason() {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();
    const dayOfWeek = now.getDay(); // 0-6 (Sunday-Saturday)

    // Check specific dates first
    if (month === 9 && day >= 23 && day <= 25) return 'national_day';
    if (month === 2 && day >= 22 && day <= 23) return 'founding_day';

    // Check White Friday (4th week of November)
    if (month === 11 && day >= 22 && day <= 30) return 'white_friday';

    // Check months (approximate - should use Hijri calendar for Islamic holidays)
    if (month === 3 || month === 4) return 'ramadan'; // Approximate
    if (month === 4 || month === 5) return 'eid_fitr'; // After Ramadan
    if (month === 6 || month === 7) return 'eid_adha';
    if (month === 8 || month === 9) return 'back_to_school';
    if (month >= 6 && month <= 8) return 'summer';

    return 'default';
}

function getSeasonalConfig() {
    const season = detectCurrentSeason();
    return {
        season,
        config: SEASONAL_CONFIG[season] || SEASONAL_CONFIG.default
    };
}

// ==========================================
// SMART DISCOUNT CALCULATOR
// ==========================================

const DISCOUNT_STRATEGY = {
    // Cart value thresholds (SAR)
    thresholds: [
        { min: 0, max: 100, discount: 0, freeShipping: true },
        { min: 100, max: 300, discount: 5, freeShipping: true },
        { min: 300, max: 500, discount: 10, freeShipping: true },
        { min: 500, max: 1000, discount: 12, freeShipping: true },
        { min: 1000, max: 2000, discount: 15, freeShipping: true },
        { min: 2000, max: Infinity, discount: 20, freeShipping: true }
    ],

    // Time since abandonment bonuses
    timeBonus: {
        1: 0,    // 1 hour - no extra discount
        6: 2,    // 6 hours - +2%
        24: 5,   // 24 hours - +5%
        48: 8,   // 48 hours - +8% (last chance)
    },

    // Reminder number bonuses
    reminderBonus: {
        1: 0,    // First reminder - base discount
        2: 3,    // Second reminder - +3%
        3: 5,    // Third reminder - +5% (last chance)
    }
};

function calculateSmartDiscount(cartValue, hoursAbandoned = 0, reminderNumber = 1) {
    const { config: seasonal } = getSeasonalConfig();

    // Find base discount tier
    const tier = DISCOUNT_STRATEGY.thresholds.find(t =>
        cartValue >= t.min && cartValue < t.max
    ) || DISCOUNT_STRATEGY.thresholds[0];

    let discount = tier.discount;

    // Add time bonus
    const timeKeys = Object.keys(DISCOUNT_STRATEGY.timeBonus).map(Number).sort((a, b) => a - b);
    for (const hours of timeKeys) {
        if (hoursAbandoned >= hours) {
            discount += DISCOUNT_STRATEGY.timeBonus[hours];
        }
    }

    // Add reminder bonus
    discount += DISCOUNT_STRATEGY.reminderBonus[reminderNumber] || 0;

    // Add seasonal bonus
    discount += seasonal.discountBoost || 0;

    // Cap at 30% max
    discount = Math.min(discount, 30);

    return {
        percentage: discount,
        code: `RIBH${discount}`,
        savings: Math.round(cartValue * (discount / 100)),
        freeShipping: tier.freeShipping,
        seasonal: seasonal.offerPrefix,
        urgency: seasonal.urgencyMessage
    };
}

// ==========================================
// OFFER BUILDER (Hormozi Style)
// ==========================================

function buildIrresistibleOffer(cart, customerData = {}) {
    const cartValue = cart.total || cart.amount || 0;
    const hoursAbandoned = cart.hoursAbandoned || 0;
    const reminderNumber = cart.reminderNumber || 1;
    const { config: seasonal, season } = getSeasonalConfig();

    // Calculate discount
    const discount = calculateSmartDiscount(cartValue, hoursAbandoned, reminderNumber);

    // Build value stack (Hormozi's "stack the value")
    const valueStack = [];

    // Main offer
    if (discount.percentage > 0) {
        valueStack.push({
            type: 'discount',
            value: `${discount.percentage}%`,
            message: `خصم ${discount.percentage}% على طلبك`,
            savings: discount.savings
        });
    }

    // Free shipping bonus
    if (discount.freeShipping && cartValue >= 100) {
        valueStack.push({
            type: 'free_shipping',
            value: 'مجاني',
            message: '🚚 شحن مجاني'
        });
    }

    // Payment plan for high value
    if (cartValue >= 200) {
        const monthlyPayment = Math.ceil(cartValue / 4);
        valueStack.push({
            type: 'payment_plan',
            value: `${monthlyPayment} ر.س/شهر`,
            message: `💳 قسّط على 4 دفعات: ${monthlyPayment} ر.س/شهر`,
            provider: 'tamara'
        });
    }

    // Urgency element
    const urgencyTypes = [
        { type: 'time', message: `⏰ العرض ينتهي خلال ${24 - (hoursAbandoned % 24)} ساعة` },
        { type: 'stock', message: `⚠️ باقي ${Math.floor(Math.random() * 5) + 2} قطع فقط!` },
        { type: 'demand', message: `🔥 ${Math.floor(Math.random() * 20) + 5} شخص يشاهدون هذا المنتج الآن` }
    ];

    // Pick urgency based on reminder number
    const urgency = urgencyTypes[Math.min(reminderNumber - 1, urgencyTypes.length - 1)];

    // Social proof
    const socialProof = {
        type: 'social_proof',
        reviews: Math.floor(Math.random() * 100) + 50,
        rating: (4.5 + Math.random() * 0.5).toFixed(1),
        message: `⭐ تقييم ${(4.5 + Math.random() * 0.5).toFixed(1)}/5 من ${Math.floor(Math.random() * 100) + 50}+ عميل`
    };

    // Risk reversal (guarantee)
    const guarantee = {
        type: 'guarantee',
        message: '✅ ضمان استرجاع كامل خلال 14 يوم'
    };

    return {
        // Core offer
        discount,
        valueStack,

        // Hormozi elements
        urgency,
        socialProof,
        guarantee,

        // Seasonal context
        seasonal: {
            season,
            prefix: seasonal.offerPrefix,
            message: seasonal.urgencyMessage
        },

        // Calculated totals
        originalPrice: cartValue,
        finalPrice: cartValue - discount.savings,
        totalSavings: discount.savings,

        // CTA
        cta: {
            primary: 'أكمل طلبك الآن',
            secondary: 'استخدم الكود: ' + discount.code
        },

        // Metadata
        generatedAt: new Date().toISOString(),
        expiresIn: '24 hours'
    };
}

// ==========================================
// OFFER NAME GENERATOR (Auto-updates by season)
// ==========================================

function generateOfferName(cart, offerType = 'recovery') {
    const { config: seasonal } = getSeasonalConfig();
    const cartValue = cart.total || 0;

    const templates = {
        recovery: [
            `${seasonal.offerPrefix} لك`,
            `${seasonal.offerPrefix} - استكمل طلبك`,
            `🎁 هدية خاصة لك`
        ],
        vip: [
            `👑 عرض VIP حصري`,
            `${seasonal.offerPrefix} للعملاء المميزين`,
            `💎 أنت عميل مميز`
        ],
        lastChance: [
            `⚡ آخر فرصة!`,
            `🚨 ينتهي اليوم!`,
            `⏰ لا تفوّت!`
        ]
    };

    // Pick based on cart value and type
    let type = offerType;
    if (cartValue >= 1000) type = 'vip';
    if (cart.reminderNumber >= 3) type = 'lastChance';

    const options = templates[type] || templates.recovery;
    return options[Math.floor(Math.random() * options.length)];
}

// ==========================================
// A/B TEST OFFER VARIANTS
// ==========================================

function generateOfferVariants(cart) {
    const baseOffer = buildIrresistibleOffer(cart);

    return {
        variantA: {
            ...baseOffer,
            focus: 'discount',
            headline: `خصم ${baseOffer.discount.percentage}%`,
            subheadline: baseOffer.urgency.message
        },
        variantB: {
            ...baseOffer,
            focus: 'payment_plan',
            headline: `قسّط بدون فوائد`,
            subheadline: baseOffer.valueStack.find(v => v.type === 'payment_plan')?.message || ''
        },
        variantC: {
            ...baseOffer,
            focus: 'urgency',
            headline: baseOffer.urgency.message,
            subheadline: `خصم ${baseOffer.discount.percentage}% + شحن مجاني`
        }
    };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Core functions
    buildIrresistibleOffer,
    calculateSmartDiscount,
    generateOfferName,
    generateOfferVariants,

    // Seasonal
    detectCurrentSeason,
    getSeasonalConfig,
    SEASONAL_CONFIG,

    // Strategy config
    DISCOUNT_STRATEGY
};
