/**
 * 🧠 RIBH AI Offer Generator
 * Intelligent, context-aware offer generation using Hormozi's Grand Slam framework
 * 
 * Every offer has 6 parts:
 * 1. HEADLINE - "Your cart is waiting"
 * 2. URGENCY - "Expires in 2 hours"
 * 3. SCARCITY - "Only 3 left"
 * 4. BONUS - "Free shipping today"
 * 5. GUARANTEE - "100% refund if..."
 * 6. CTA - "Complete Order →"
 */

// ========================================
// SEASON CONFIGURATIONS
// ========================================

const SEASONS = {
    normal: {
        name: 'Normal',
        nameAr: 'عادي',
        emoji: '📦',
        greeting: '',
        greetingAr: '',
        urgencyMultiplier: 1,
        bonusType: 'shipping',
        colors: { primary: '#00d084', secondary: '#3b82f6' },
        specialOffers: ['شحن مجاني', 'توصيل سريع', 'تغليف مجاني'],
        keywords: []
    },
    ramadan: {
        name: 'Ramadan',
        nameAr: 'رمضان',
        emoji: '🌙',
        greeting: 'Ramadan Kareem! ',
        greetingAr: 'رمضان كريم! ',
        urgencyMultiplier: 1.3,
        bonusType: 'blessing',
        colors: { primary: '#8b5cf6', secondary: '#ec4899' },
        specialOffers: ['توصيل مجاني قبل الإفطار', 'هدية رمضانية', 'عرض السحور الخاص'],
        keywords: ['iftar', 'suhoor', 'blessing', 'family'],
        timingRules: {
            bestHours: [10, 11, 12, 15, 16, 21, 22], // Before iftar & after tarawih
            avoidHours: [17, 18, 19, 20] // Iftar time
        }
    },
    eid: {
        name: 'Eid',
        nameAr: 'العيد',
        emoji: '🎉',
        greeting: 'Eid Mubarak! ',
        greetingAr: 'عيد مبارك! ',
        urgencyMultiplier: 1.5,
        bonusType: 'gift',
        colors: { primary: '#00d084', secondary: '#8b5cf6' },
        specialOffers: ['تغليف هدايا مجاني', 'توصيل يوم العيد', 'خصم العيد الخاص'],
        keywords: ['gift', 'celebration', 'family', 'new'],
        timingRules: {
            bestHours: [9, 10, 11, 14, 15, 16, 20, 21],
            avoidHours: [6, 7, 12, 13] // Prayer times
        }
    },
    summer: {
        name: 'Summer',
        nameAr: 'الصيف',
        emoji: '☀️',
        greeting: 'Hot Summer, Hotter Deals! ',
        greetingAr: 'صيف حار 🔥 عروض أحر! ',
        urgencyMultiplier: 1.2,
        bonusType: 'bundle',
        colors: { primary: '#f59e0b', secondary: '#ef4444' },
        specialOffers: ['تخفيضات الصيف', 'اشتري 2 واحصل على 1', 'عرض الشاطئ'],
        keywords: ['vacation', 'travel', 'beach', 'hot']
    },
    whitefriday: {
        name: 'White Friday',
        nameAr: 'الجمعة البيضاء',
        emoji: '🛍️',
        greeting: '⚡ White Friday! ',
        greetingAr: '⚡ الجمعة البيضاء! ',
        urgencyMultiplier: 2.0,
        bonusType: 'discount',
        colors: { primary: '#ef4444', secondary: '#f59e0b' },
        specialOffers: ['خصم 50%', 'عرض لا يتكرر', 'آخر فرصة السنة'],
        keywords: ['biggest', 'sale', 'limited', 'flash'],
        timingRules: {
            bestHours: [8, 9, 10, 11, 12, 20, 21, 22, 23],
            urgencyMax: true
        }
    },
    national: {
        name: 'National Day',
        nameAr: 'اليوم الوطني',
        emoji: '🇸🇦',
        greeting: '🇸🇦 Saudi National Day! ',
        greetingAr: '🇸🇦 اليوم الوطني السعودي! ',
        urgencyMultiplier: 1.3,
        bonusType: 'special',
        colors: { primary: '#00d084', secondary: '#00d084' },
        specialOffers: ['خصم 93%', 'هدية وطنية', 'توصيل مجاني للمملكة'],
        keywords: ['patriot', 'saudi', 'kingdom', 'national']
    },
    newyear: {
        name: 'Year End',
        nameAr: 'نهاية السنة',
        emoji: '🎆',
        greeting: '✨ Year End Clearance! ',
        greetingAr: '✨ تصفية نهاية السنة! ',
        urgencyMultiplier: 1.8,
        bonusType: 'clearance',
        colors: { primary: '#8b5cf6', secondary: '#ec4899' },
        specialOffers: ['تصفية كاملة', 'آخر القطع', 'أسعار لا تتكرر'],
        keywords: ['clearance', 'final', 'last', 'new year']
    },
    backtoschool: {
        name: 'Back to School',
        nameAr: 'العودة للمدارس',
        emoji: '📚',
        greeting: '📚 Back to School! ',
        greetingAr: '📚 موسم العودة للمدارس! ',
        urgencyMultiplier: 1.4,
        bonusType: 'bundle',
        colors: { primary: '#3b82f6', secondary: '#00d084' },
        specialOffers: ['باقة المدرسة', 'خصم الطلاب 20%', 'توصيل سريع'],
        keywords: ['school', 'student', 'supplies', 'kids']
    }
};

// ========================================
// PRODUCT TYPE CONFIGURATIONS
// ========================================

const PRODUCT_TYPES = {
    fashion: {
        name: 'Fashion',
        nameAr: 'ملابس وأزياء',
        urgencyText: 'الموضة تتغير سريعاً',
        scarcityText: 'مقاسات محدودة',
        bonusText: 'تغليف أنيق مجاني',
        keywords: ['style', 'trend', 'look', 'outfit']
    },
    electronics: {
        name: 'Electronics',
        nameAr: 'إلكترونيات',
        urgencyText: 'الكمية محدودة جداً',
        scarcityText: 'آخر القطع بالمخزون',
        bonusText: 'ضمان إضافي سنة مجاناً',
        keywords: ['tech', 'gadget', 'device', 'smart']
    },
    beauty: {
        name: 'Beauty',
        nameAr: 'مستحضرات تجميل',
        urgencyText: 'عرض حصري',
        scarcityText: 'إصدار محدود',
        bonusText: 'عينات فاخرة مجانية',
        keywords: ['glow', 'skin', 'care', 'beauty']
    },
    food: {
        name: 'Food',
        nameAr: 'مأكولات',
        urgencyText: 'طازج يومياً',
        scarcityText: 'الكمية اليوم فقط',
        bonusText: 'توصيل خلال ساعة',
        keywords: ['fresh', 'delicious', 'taste', 'organic']
    },
    home: {
        name: 'Home & Decor',
        nameAr: 'منزل وديكور',
        urgencyText: 'جدد منزلك اليوم',
        scarcityText: 'آخر قطعة بالمخزون',
        bonusText: 'تركيب مجاني',
        keywords: ['home', 'decor', 'comfort', 'style']
    },
    sports: {
        name: 'Sports',
        nameAr: 'رياضة',
        urgencyText: 'ابدأ رحلتك الصحية',
        scarcityText: 'مقاسات محدودة',
        bonusText: 'حقيبة رياضية هدية',
        keywords: ['fitness', 'health', 'active', 'sport']
    },
    kids: {
        name: 'Kids',
        nameAr: 'أطفال',
        urgencyText: 'أطفالك يستحقون الأفضل',
        scarcityText: 'المقاسات تنفد سريعاً',
        bonusText: 'لعبة مجانية مع كل طلب',
        keywords: ['kids', 'children', 'baby', 'family']
    },
    gifts: {
        name: 'Gifts',
        nameAr: 'هدايا',
        urgencyText: 'المناسبة قريبة!',
        scarcityText: 'تصميم حصري',
        bonusText: 'تغليف هدايا فاخر مجاني',
        keywords: ['gift', 'special', 'celebration', 'love']
    }
};

// ========================================
// CUSTOMER TYPE CONFIGURATIONS
// ========================================

const CUSTOMER_TYPES = {
    new: {
        name: 'New',
        nameAr: 'عميل جديد',
        tone: 'welcoming',
        baseDiscount: 10,
        guaranteeText: 'استرجاع مجاني خلال 14 يوم',
        headlines: [
            'مرحباً بك! 🎉',
            'سعداء بزيارتك!',
            'عرض ترحيبي خاص لك!'
        ]
    },
    returning: {
        name: 'Returning',
        nameAr: 'عميل عائد',
        tone: 'familiar',
        baseDiscount: 5,
        guaranteeText: 'نقدر ولائك - استرجاع 30 يوم',
        headlines: [
            'أهلاً من جديد! 👋',
            'سعداء بعودتك!',
            'اشتقنالك!'
        ]
    },
    vip: {
        name: 'VIP',
        nameAr: 'عميل VIP',
        tone: 'exclusive',
        baseDiscount: 0,
        guaranteeText: 'خدمة VIP - أولوية التوصيل والدعم',
        headlines: [
            'عميلنا المميز! ⭐',
            'عرض حصري لك فقط!',
            'مكافأة خاصة لعملائنا المميزين!'
        ]
    },
    inactive: {
        name: 'Inactive',
        nameAr: 'عميل غير نشط',
        tone: 'winback',
        baseDiscount: 15,
        guaranteeText: 'عرض العودة الخاص - ضمان كامل',
        headlines: [
            'اشتقنالك! 💙',
            'عدنا بعرض خاص لك!',
            'وحشتنا! عرض استثنائي للعودة'
        ]
    }
};

// ========================================
// ABANDON TIME CONFIGURATIONS
// ========================================

const ABANDON_TIMES = {
    '5m': {
        label: '5 minutes',
        labelAr: '5 دقائق',
        urgencyLevel: 'low',
        message: 'سلتك لا تزال محفوظة! 🛒',
        discountModifier: 0
    },
    '1h': {
        label: '1 hour',
        labelAr: 'ساعة واحدة',
        urgencyLevel: 'medium',
        message: 'سلتك تنتظرك 🛒',
        discountModifier: 0
    },
    '6h': {
        label: '6 hours',
        labelAr: '6 ساعات',
        urgencyLevel: 'high',
        message: 'منتجاتك قد تنفد قريباً! ⚠️',
        discountModifier: 5
    },
    '24h': {
        label: '24 hours',
        labelAr: '24 ساعة',
        urgencyLevel: 'urgent',
        message: 'آخر فرصة لإتمام طلبك! ⏰',
        discountModifier: 5
    },
    '3d': {
        label: '3 days',
        labelAr: '3 أيام',
        urgencyLevel: 'critical',
        message: 'سلتك على وشك الانتهاء! 🚨',
        discountModifier: 10
    }
};

// ========================================
// BEHAVIOR CONFIGURATIONS  
// ========================================

const BEHAVIORS = {
    abandoned: {
        name: 'Abandoned Cart',
        nameAr: 'ترك السلة',
        approach: 'recovery',
        headlines: [
            '{product} لا يزال ينتظرك! 🛒',
            'نسيت شيء؟ سلتك محفوظة 💫',
            'منتجاتك تنتظرك!'
        ]
    },
    browsing: {
        name: 'Just Browsing',
        nameAr: 'يتصفح فقط',
        approach: 'attraction',
        headlines: [
            'وجدت ما يعجبك؟ 👀',
            'منتجات مختارة لذوقك!',
            'شاهد أفضل العروض!'
        ]
    },
    pricesensitive: {
        name: 'Price Sensitive',
        nameAr: 'حساس للسعر',
        approach: 'value',
        headlines: [
            'وفّر {discount}% اليوم! 💰',
            'عرض لا يُفوّت!',
            'أفضل سعر الآن!'
        ]
    },
    exitintent: {
        name: 'Exit Intent',
        nameAr: 'نية الخروج',
        approach: 'urgent',
        headlines: [
            'لحظة! عرض خاص قبل ما تمشي! 🎁',
            'انتظر! عندنا مفاجأة لك!',
            'قبل ما تغادر...'
        ]
    },
    repeat: {
        name: 'Repeat Visitor',
        nameAr: 'زائر متكرر',
        approach: 'commitment',
        headlines: [
            'شفناك مهتم! خذ عرضك الخاص 🌟',
            'عرض حصري للزوار المميزين!',
            'مستمر بالتفكير؟ خلنا نساعدك!'
        ]
    }
};

// ========================================
// MAIN OFFER GENERATOR CLASS
// ========================================

class OfferGenerator {
    constructor(options = {}) {
        this.language = options.language || 'ar';
        this.merchantName = options.merchantName || 'متجرنا';
    }

    /**
     * Detect the current or upcoming season based on date
     */
    detectSeason(date = new Date()) {
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // Ramadan detection (approximate - should use Hijri calendar in production)
        // This is simplified - in production, use a proper Islamic calendar library
        const ramadanMonths = [3, 4]; // March-April 2025 approximate
        if (ramadanMonths.includes(month)) {
            return 'ramadan';
        }

        // Eid detection (week after Ramadan)
        if (month === 4 && day >= 20 && day <= 30) {
            return 'eid';
        }

        // Saudi National Day
        if (month === 9 && day >= 20 && day <= 26) {
            return 'national';
        }

        // White Friday (last week of November)
        if (month === 11 && day >= 20) {
            return 'whitefriday';
        }

        // Year End (December 20-31)
        if (month === 12 && day >= 20) {
            return 'newyear';
        }

        // Back to School (August 15 - September 15)
        if ((month === 8 && day >= 15) || (month === 9 && day <= 15)) {
            return 'backtoschool';
        }

        // Summer (June - August)
        if (month >= 6 && month <= 8) {
            return 'summer';
        }

        return 'normal';
    }

    /**
     * Get time of day category
     */
    getTimeOfDay(date = new Date()) {
        const hour = date.getHours();
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 21) return 'evening';
        return 'night';
    }

    /**
     * Calculate optimal discount
     */
    calculateDiscount(context) {
        const { season, customerType, abandonTime, cartValue, behavior } = context;

        let discount = CUSTOMER_TYPES[customerType].baseDiscount;

        // Add abandon time modifier
        discount += ABANDON_TIMES[abandonTime].discountModifier;

        // Apply season multiplier
        discount = Math.round(discount * SEASONS[season].urgencyMultiplier);

        // High cart value = less discount needed
        if (cartValue > 500) discount = Math.max(discount - 5, 0);
        if (cartValue > 1000) discount = Math.max(discount - 10, 0);

        // Price sensitive behavior = need more discount
        if (behavior === 'pricesensitive') discount += 5;

        // VIP never gets discount (they get exclusivity instead)
        if (customerType === 'vip') discount = 0;

        // Cap discount
        return Math.min(discount, 30);
    }

    /**
     * Generate scarcity number (1-10)
     */
    generateScarcity(context) {
        const { abandonTime, season } = context;

        // Base scarcity
        let base = Math.floor(Math.random() * 5) + 1;

        // Urgent times = lower scarcity numbers
        if (ABANDON_TIMES[abandonTime].urgencyLevel === 'critical') {
            base = Math.min(base, 3);
        }

        // High urgency seasons
        if (season === 'whitefriday' || season === 'newyear') {
            base = Math.min(base, 2);
        }

        return base;
    }

    /**
     * Calculate urgency hours
     */
    calculateUrgencyHours(context) {
        const { abandonTime, season } = context;

        let hours = 2;

        if (abandonTime === '24h' || abandonTime === '3d') {
            hours = 4;
        }

        if (season === 'whitefriday') {
            hours = 1;
        }

        return hours;
    }

    /**
     * Select best bonus for context
     */
    selectBonus(context) {
        const { season, productType, cartValue, customerType } = context;

        const seasonConfig = SEASONS[season];
        const productConfig = PRODUCT_TYPES[productType];

        // VIP gets exclusive bonus
        if (customerType === 'vip') {
            return 'أولوية التوصيل + دعم VIP';
        }

        // High cart value
        if (cartValue >= 300) {
            return seasonConfig.specialOffers[0] || productConfig.bonusText;
        }

        // Medium cart value
        if (cartValue >= 150) {
            return 'شحن مجاني';
        }

        // Default bonus
        return productConfig.bonusText;
    }

    /**
     * Generate headline based on context
     */
    generateHeadline(context) {
        const { behavior, productName, customerType, season } = context;

        const behaviorConfig = BEHAVIORS[behavior];
        const customerConfig = CUSTOMER_TYPES[customerType];
        const seasonConfig = SEASONS[season];

        // Select random headline from behavior templates
        const templates = behaviorConfig.headlines;
        let headline = templates[Math.floor(Math.random() * templates.length)];

        // Replace placeholders
        headline = headline.replace('{product}', productName || 'منتجاتك');
        headline = headline.replace('{discount}', context.discount || '10');

        // Add season greeting for special seasons
        if (season !== 'normal' && seasonConfig.greetingAr) {
            headline = seasonConfig.greetingAr + headline;
        }

        return headline;
    }

    /**
     * Generate CTA text
     */
    generateCTA(context) {
        const { discount, abandonTime, customerType } = context;

        const urgencyLevel = ABANDON_TIMES[abandonTime].urgencyLevel;

        if (urgencyLevel === 'critical' || urgencyLevel === 'urgent') {
            return '⚡ اطلب قبل فوات الأوان';
        }

        if (discount > 0) {
            return `🎁 وفّر ${discount}% الآن`;
        }

        if (customerType === 'vip') {
            return '⭐ احصل على عرضك الحصري';
        }

        return 'أكمل طلبك الآن ←';
    }

    /**
     * Build the complete offer message
     */
    buildMessage(offer, context) {
        const seasonConfig = SEASONS[context.season];
        const abandonConfig = ABANDON_TIMES[context.abandonTime];
        const customerConfig = CUSTOMER_TYPES[context.customerType];

        let msg = '';

        // Greeting
        if (seasonConfig.greetingAr) {
            msg += `${seasonConfig.greetingAr}\n\n`;
        }

        // Headline
        msg += `${offer.headline}\n\n`;

        // Timing message
        msg += `${abandonConfig.message}\n\n`;

        // Discount (if applicable)
        if (offer.discount > 0) {
            msg += `💥 خصم ${offer.discount}% على طلبك\n`;
        }

        // Bonus
        msg += `🎁 ${offer.bonus}\n`;

        // Guarantee
        msg += `✅ ${offer.guarantee}\n\n`;

        // Urgency
        msg += `⏰ العرض ينتهي خلال ${offer.urgencyHours} ساعات\n`;

        // Scarcity
        msg += `📦 متبقي ${offer.scarcity} قطع فقط!\n\n`;

        // CTA
        msg += `👇 ${offer.cta}`;

        return msg;
    }

    /**
     * MAIN GENERATION METHOD
     * Generate a complete, intelligent offer
     */
    generate(input) {
        // Set defaults
        const context = {
            season: input.season || this.detectSeason(),
            productType: input.productType || 'fashion',
            cartValue: input.cartValue || 350,
            productName: input.productName || '',
            customerType: input.customerType || 'new',
            behavior: input.behavior || 'abandoned',
            abandonTime: input.abandonTime || '1h',
            timestamp: new Date()
        };

        // Calculate dynamic values
        context.discount = this.calculateDiscount(context);

        // Get configurations
        const seasonConfig = SEASONS[context.season];
        const productConfig = PRODUCT_TYPES[context.productType];
        const customerConfig = CUSTOMER_TYPES[context.customerType];

        // Generate the 6 parts of the offer
        const offer = {
            // 1. HEADLINE
            headline: this.generateHeadline(context),

            // 2. URGENCY
            urgencyHours: this.calculateUrgencyHours(context),
            urgency: `⏰ ينتهي خلال ${this.calculateUrgencyHours(context)} ساعات`,

            // 3. SCARCITY
            scarcity: this.generateScarcity(context),
            scarcityText: `📦 باقي ${this.generateScarcity(context)} قطع فقط`,

            // 4. BONUS
            bonus: this.selectBonus(context),

            // 5. GUARANTEE
            guarantee: customerConfig.guaranteeText,

            // 6. CTA
            cta: this.generateCTA(context),

            // Additional data
            discount: context.discount,
            season: context.season,
            seasonEmoji: seasonConfig.emoji,
            seasonName: seasonConfig.nameAr,

            // Full formatted message
            fullMessage: null,

            // Metadata
            generatedAt: new Date().toISOString(),
            context: context
        };

        // Build the complete message
        offer.fullMessage = this.buildMessage(offer, context);

        return offer;
    }

    /**
     * Generate offer for a specific cart/customer
     */
    generateForCart(cart, customer = {}) {
        return this.generate({
            season: this.detectSeason(),
            productType: this.detectProductType(cart.items),
            cartValue: cart.total || 0,
            productName: cart.items?.[0]?.name || '',
            customerType: this.detectCustomerType(customer),
            behavior: 'abandoned',
            abandonTime: this.calculateAbandonTime(cart.createdAt)
        });
    }

    /**
     * Detect product type from cart items
     */
    detectProductType(items) {
        if (!items || items.length === 0) return 'fashion';

        // In production, use category mapping from Salla/Shopify
        // This is simplified
        const firstItem = items[0];
        const name = (firstItem.name || '').toLowerCase();

        if (name.includes('phone') || name.includes('laptop') || name.includes('جوال')) return 'electronics';
        if (name.includes('dress') || name.includes('فستان') || name.includes('ملابس')) return 'fashion';
        if (name.includes('cream') || name.includes('كريم') || name.includes('تجميل')) return 'beauty';

        return 'fashion';
    }

    /**
     * Detect customer type from history
     */
    detectCustomerType(customer) {
        if (!customer) return 'new';

        const orderCount = customer.totalOrders || 0;
        const totalSpent = customer.totalSpent || 0;
        const lastOrderDays = customer.daysSinceLastOrder || 0;

        if (totalSpent >= 5000 || orderCount >= 10) return 'vip';
        if (lastOrderDays > 60) return 'inactive';
        if (orderCount > 0) return 'returning';

        return 'new';
    }

    /**
     * Calculate abandon time from cart creation
     */
    calculateAbandonTime(createdAt) {
        if (!createdAt) return '1h';

        const now = new Date();
        const created = new Date(createdAt);
        const hoursDiff = (now - created) / (1000 * 60 * 60);

        if (hoursDiff < 0.5) return '5m';
        if (hoursDiff < 3) return '1h';
        if (hoursDiff < 12) return '6h';
        if (hoursDiff < 48) return '24h';
        return '3d';
    }
}

// Export configurations and class
module.exports = {
    OfferGenerator,
    SEASONS,
    PRODUCT_TYPES,
    CUSTOMER_TYPES,
    ABANDON_TIMES,
    BEHAVIORS
};
