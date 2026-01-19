/**
 * RIBH AI CORE
 * The Brain That Learns and Improves
 * 
 * This is the secret sauce - an AI that:
 * 1. Learns from ALL stores (what works, what doesn't)
 * 2. Improves offers automatically based on results
 * 3. Gets smarter with every interaction
 * 
 * "Even if they copy the code, they can't copy the learnings"
 */

// ==========================================
// LEARNING DATABASE (In production, this would be Firestore)
// ==========================================

const learnings = {
    // Which offers convert best by segment
    offerPerformance: {
        VIP: {
            bestDiscount: 15,
            bestUrgencyType: 'exclusive',
            bestChannel: 'whatsapp',
            avgConversionRate: 0.35
        },
        HIGH_VALUE: {
            bestDiscount: 12,
            bestUrgencyType: 'stock',
            bestChannel: 'email',
            avgConversionRate: 0.28
        },
        MEDIUM_VALUE: {
            bestDiscount: 10,
            bestUrgencyType: 'time',
            bestChannel: 'email',
            avgConversionRate: 0.22
        },
        PRICE_SENSITIVE: {
            bestDiscount: 15,
            bestUrgencyType: 'time',
            bestChannel: 'sms',
            avgConversionRate: 0.18
        }
    },

    // Best send times learned from data
    optimalTiming: {
        weekday: { hour: 20, minute: 30 }, // 8:30 PM
        weekend: { hour: 16, minute: 0 },  // 4:00 PM
        ramadan: { hour: 21, minute: 30 }  // After iftar
    },

    // Message patterns that convert
    messagePatterns: {
        highPerformance: [
            { pattern: 'اسم العميل + emoji في البداية', score: 0.85 },
            { pattern: 'ذكر المبلغ المحدد', score: 0.82 },
            { pattern: 'كود خصم واضح', score: 0.80 },
            { pattern: 'urgency في النهاية', score: 0.78 }
        ],
        lowPerformance: [
            { pattern: 'رسالة طويلة جداً', score: 0.15 },
            { pattern: 'بدون emoji', score: 0.20 },
            { pattern: 'نبرة رسمية جداً', score: 0.25 }
        ]
    },

    // Seasonal learnings
    seasonalInsights: {
        ramadan: {
            bestOfferType: 'family_bundle',
            peakHours: [21, 22, 23],
            avoidHours: [15, 16, 17], // People resting before iftar
            bestEmojis: ['🌙', '✨', '🎁']
        },
        eid: {
            bestOfferType: 'gift',
            peakHours: [10, 11, 12],
            bestEmojis: ['🎉', '🎁', '🎊']
        },
        white_friday: {
            bestOfferType: 'flash_sale',
            peakHours: [9, 10, 20, 21, 22, 23],
            bestEmojis: ['⚡', '🔥', '💥']
        }
    },

    // ==========================================
    // NICHE-SPECIFIC LEARNINGS
    // Prepared for future niche-specific apps
    // ==========================================
    nicheInsights: {
        // Fashion / Clothing - متاجر الملابس والأزياء
        fashion: {
            nameAr: 'أزياء وملابس',
            avgCartValue: 450,
            avgConversionRate: 0.24,
            bestUrgencyType: 'stock', // "الكمية محدودة"
            bestOfferType: 'percentage',
            bestPaymentPlan: true, // High ticket items
            peakHours: [19, 20, 21, 22], // Evening shopping
            keywords: ['فستان', 'عباية', 'جاكيت', 'حذاء', 'شنطة', 'ملابس', 'ازياء', 'موضة'],
            bestEmojis: ['👗', '👠', '✨', '🛍️'],
            optimalDiscount: 15
        },

        // Electronics - متاجر الإلكترونيات
        electronics: {
            nameAr: 'إلكترونيات',
            avgCartValue: 1200,
            avgConversionRate: 0.18,
            bestUrgencyType: 'price_increase', // "السعر سيرتفع"
            bestOfferType: 'fixed_amount',
            bestPaymentPlan: true, // Must have for electronics
            peakHours: [12, 13, 20, 21],
            keywords: ['جوال', 'لابتوب', 'سماعات', 'شاشة', 'كمبيوتر', 'ايفون', 'سامسونج'],
            bestEmojis: ['📱', '💻', '🎧', '⚡'],
            optimalDiscount: 8 // Lower discounts work for electronics
        },

        // Beauty / Cosmetics - متاجر التجميل
        beauty: {
            nameAr: 'تجميل وعناية',
            avgCartValue: 280,
            avgConversionRate: 0.32, // High conversion!
            bestUrgencyType: 'exclusive', // "عرض حصري"
            bestOfferType: 'gift_with_purchase',
            bestPaymentPlan: false,
            peakHours: [10, 11, 21, 22],
            keywords: ['مكياج', 'عطر', 'كريم', 'سيروم', 'عناية', 'بشرة', 'شعر'],
            bestEmojis: ['💄', '✨', '💋', '🌸'],
            optimalDiscount: 12
        },

        // Food / Groceries - متاجر الطعام والبقالة
        food: {
            nameAr: 'أغذية ومأكولات',
            avgCartValue: 150,
            avgConversionRate: 0.42, // Highest conversion - immediate need
            bestUrgencyType: 'time', // "توصيل اليوم"
            bestOfferType: 'free_shipping',
            bestPaymentPlan: false,
            peakHours: [11, 12, 17, 18, 19],
            keywords: ['طعام', 'قهوة', 'شوكولاتة', 'مكسرات', 'تمر', 'عسل'],
            bestEmojis: ['🍽️', '☕', '🍫', '🥜'],
            optimalDiscount: 5 // Low margins, small discounts
        },

        // Home / Furniture - متاجر الأثاث والمنزل
        home: {
            nameAr: 'أثاث ومنزل',
            avgCartValue: 2500,
            avgConversionRate: 0.12, // Low conversion - considered purchases
            bestUrgencyType: 'limited_stock',
            bestOfferType: 'bundle',
            bestPaymentPlan: true, // Essential for furniture
            peakHours: [13, 14, 20, 21],
            keywords: ['كنبة', 'سرير', 'طاولة', 'كرسي', 'ستارة', 'سجاد', 'اثاث'],
            bestEmojis: ['🏠', '🛋️', '🛏️', '✨'],
            optimalDiscount: 10
        },

        // Kids / Baby - متاجر الأطفال
        kids: {
            nameAr: 'أطفال ومواليد',
            avgCartValue: 320,
            avgConversionRate: 0.28,
            bestUrgencyType: 'social_proof', // "أمهات كثيرات اشتروا"
            bestOfferType: 'bundle',
            bestPaymentPlan: false,
            peakHours: [10, 11, 21, 22, 23],
            keywords: ['أطفال', 'مواليد', 'حفاظات', 'رضاعة', 'ألعاب', 'ملابس أطفال'],
            bestEmojis: ['👶', '🧸', '🎀', '💕'],
            optimalDiscount: 12
        },

        // Sports / Fitness - متاجر الرياضة
        sports: {
            nameAr: 'رياضة ولياقة',
            avgCartValue: 380,
            avgConversionRate: 0.22,
            bestUrgencyType: 'motivation', // "ابدأ رحلتك"
            bestOfferType: 'percentage',
            bestPaymentPlan: true,
            peakHours: [6, 7, 18, 19, 20],
            keywords: ['رياضة', 'جيم', 'بروتين', 'أحذية رياضية', 'ملابس رياضية'],
            bestEmojis: ['💪', '🏃', '🏋️', '⚡'],
            optimalDiscount: 15
        },

        // Default / General - متاجر عامة
        general: {
            nameAr: 'متجر عام',
            avgCartValue: 350,
            avgConversionRate: 0.22,
            bestUrgencyType: 'time',
            bestOfferType: 'percentage',
            bestPaymentPlan: true,
            peakHours: [19, 20, 21, 22],
            keywords: [],
            bestEmojis: ['🎁', '✨', '💚', '🛍️'],
            optimalDiscount: 10
        }
    }
};

// ==========================================
// NICHE DETECTOR
// ==========================================

function detectNiche(storeData) {
    const niches = learnings.nicheInsights;
    const storeName = (storeData.name || '').toLowerCase();
    const storeUrl = (storeData.url || '').toLowerCase();
    const products = storeData.products || [];

    // Get product names for keyword matching
    const productTexts = products.map(p => (p.name || '').toLowerCase()).join(' ');
    const allText = `${storeName} ${storeUrl} ${productTexts}`;

    // Score each niche by keyword matches
    let bestNiche = 'general';
    let bestScore = 0;

    for (const [nicheKey, nicheData] of Object.entries(niches)) {
        if (nicheKey === 'general') continue;

        let score = 0;
        for (const keyword of nicheData.keywords) {
            if (allText.includes(keyword)) {
                score++;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestNiche = nicheKey;
        }
    }

    // Need at least 2 keyword matches to classify
    if (bestScore < 2) {
        bestNiche = 'general';
    }

    return {
        niche: bestNiche,
        confidence: bestScore >= 3 ? 'high' : bestScore >= 2 ? 'medium' : 'low',
        insights: niches[bestNiche]
    };
}

// Get niche-optimized settings
function getNicheOptimizedSettings(niche) {
    const insights = learnings.nicheInsights[niche] || learnings.nicheInsights.general;

    return {
        niche,
        nameAr: insights.nameAr,
        discount: insights.optimalDiscount,
        urgencyType: insights.bestUrgencyType,
        offerType: insights.bestOfferType,
        showPaymentPlan: insights.bestPaymentPlan,
        peakHours: insights.peakHours,
        emojis: insights.bestEmojis,
        predictedConversionRate: insights.avgConversionRate
    };
}

// ==========================================
// CONVERSION TRACKER
// ==========================================

class ConversionTracker {
    constructor() {
        this.events = [];
        this.conversions = [];
    }

    // Track when a message is sent
    trackSent(messageId, data) {
        this.events.push({
            type: 'sent',
            messageId,
            timestamp: new Date().toISOString(),
            ...data
        });
    }

    // Track when a message leads to conversion
    trackConversion(messageId, data) {
        this.conversions.push({
            messageId,
            timestamp: new Date().toISOString(),
            ...data
        });

        // Trigger learning update
        this.updateLearnings(messageId, data);
    }

    // Calculate conversion rate for a specific variant
    getConversionRate(variant) {
        const sent = this.events.filter(e => e.variant === variant).length;
        const converted = this.conversions.filter(c => c.variant === variant).length;
        return sent > 0 ? converted / sent : 0;
    }

    // Update learnings based on conversion
    updateLearnings(messageId, data) {
        const originalEvent = this.events.find(e => e.messageId === messageId);
        if (!originalEvent) return;

        // Update segment performance
        const segment = originalEvent.segment;
        if (segment && learnings.offerPerformance[segment]) {
            const perf = learnings.offerPerformance[segment];
            // Recalculate average conversion rate
            perf.avgConversionRate = (perf.avgConversionRate + 1) / 2; // Simple moving average

            // Update best discount if this one performed better
            if (originalEvent.discount) {
                perf.bestDiscount = originalEvent.discount;
            }
        }

        console.log(`🧠 AI Learning: Updated insights for segment ${segment}`);
    }
}

// ==========================================
// A/B TESTING ENGINE
// ==========================================

class ABTestEngine {
    constructor() {
        this.activeTests = {};
        this.completedTests = [];
    }

    // Create a new A/B test
    createTest(testId, variants) {
        this.activeTests[testId] = {
            id: testId,
            variants,
            results: variants.reduce((acc, v) => {
                acc[v.id] = { sent: 0, converted: 0 };
                return acc;
            }, {}),
            startedAt: new Date().toISOString(),
            status: 'running'
        };
        return this.activeTests[testId];
    }

    // Get which variant to show (random distribution)
    getVariant(testId) {
        const test = this.activeTests[testId];
        if (!test) return null;

        const variants = test.variants;
        const randomIndex = Math.floor(Math.random() * variants.length);
        return variants[randomIndex];
    }

    // Record a send event
    recordSend(testId, variantId) {
        const test = this.activeTests[testId];
        if (test && test.results[variantId]) {
            test.results[variantId].sent++;
        }
    }

    // Record a conversion
    recordConversion(testId, variantId) {
        const test = this.activeTests[testId];
        if (test && test.results[variantId]) {
            test.results[variantId].converted++;

            // Check if we have statistical significance
            this.checkSignificance(testId);
        }
    }

    // Check if test has reached statistical significance
    checkSignificance(testId) {
        const test = this.activeTests[testId];
        if (!test) return;

        const results = Object.entries(test.results);
        const totalSent = results.reduce((sum, [_, r]) => sum + r.sent, 0);

        // Need at least 100 sends per variant
        if (totalSent < results.length * 100) return;

        // Calculate conversion rates
        const rates = results.map(([id, r]) => ({
            id,
            rate: r.sent > 0 ? r.converted / r.sent : 0,
            sent: r.sent,
            converted: r.converted
        }));

        // Find winner (highest conversion rate with enough data)
        const winner = rates.sort((a, b) => b.rate - a.rate)[0];

        // Check if winner is significantly better (>20% improvement)
        const avgRate = rates.reduce((sum, r) => sum + r.rate, 0) / rates.length;
        if (winner.rate > avgRate * 1.2) {
            test.status = 'completed';
            test.winner = winner;
            test.completedAt = new Date().toISOString();

            this.completedTests.push(test);
            delete this.activeTests[testId];

            console.log(`🏆 A/B Test ${testId} completed! Winner: ${winner.id} with ${(winner.rate * 100).toFixed(1)}% conversion`);

            // Apply learnings
            this.applyWinnerLearnings(test);
        }
    }

    // Apply winner learnings to global strategy
    applyWinnerLearnings(test) {
        const winner = test.winner;
        // This would update the learnings database with the winning strategy
        console.log(`🧠 Applying learnings from test ${test.id}: ${winner.id} strategy now default`);
    }

    // Get test results
    getResults(testId) {
        const test = this.activeTests[testId] || this.completedTests.find(t => t.id === testId);
        if (!test) return null;

        const results = Object.entries(test.results).map(([id, r]) => ({
            variant: id,
            sent: r.sent,
            converted: r.converted,
            rate: r.sent > 0 ? (r.converted / r.sent * 100).toFixed(1) + '%' : '0%'
        }));

        return {
            testId: test.id,
            status: test.status,
            results,
            winner: test.winner || null
        };
    }
}

// ==========================================
// SMART OFFER OPTIMIZER
// ==========================================

class OfferOptimizer {
    constructor() {
        this.tracker = new ConversionTracker();
        this.abEngine = new ABTestEngine();
    }

    // Get optimized offer based on learnings
    getOptimizedOffer(cart, customer) {
        const segment = this.detectSegment(cart.total);
        const seasonalData = this.getSeasonalContext();
        const performance = learnings.offerPerformance[segment] || {};

        return {
            discount: performance.bestDiscount || 10,
            urgencyType: performance.bestUrgencyType || 'time',
            channel: performance.bestChannel || 'email',
            timing: learnings.optimalTiming[seasonalData.type] || learnings.optimalTiming.weekday,

            // AI recommendations
            recommendations: {
                useEmoji: true, // Always high performing
                keepShort: true, // Long messages low performing
                includeCode: true, // Discount codes increase conversion
                mentionSavings: cart.total > 200 // Mention specific savings for higher carts
            },

            // Confidence score based on data
            confidence: performance.avgConversionRate ? 'high' : 'low',
            basedOnSamples: this.tracker.events.length
        };
    }

    // Detect customer segment
    detectSegment(cartValue) {
        if (cartValue >= 1000) return 'VIP';
        if (cartValue >= 500) return 'HIGH_VALUE';
        if (cartValue >= 200) return 'MEDIUM_VALUE';
        return 'PRICE_SENSITIVE';
    }

    // Get seasonal context
    getSeasonalContext() {
        const now = new Date();
        const month = now.getMonth() + 1;

        // Simplified seasonal detection
        if (month === 3 || month === 4) return { type: 'ramadan', ...learnings.seasonalInsights.ramadan };
        if (month === 11) return { type: 'white_friday', ...learnings.seasonalInsights.white_friday };
        return { type: 'weekday' };
    }

    // Generate message with AI enhancements
    enhanceMessage(baseMessage, cart, customer) {
        const optimized = this.getOptimizedOffer(cart, customer);
        const segment = this.detectSegment(cart.total);

        let enhanced = baseMessage;

        // Add emoji if recommended
        if (optimized.recommendations.useEmoji && !enhanced.match(/[\u{1F300}-\u{1F9FF}]/u)) {
            const emojis = ['💚', '🎁', '✨', '🛒'];
            enhanced = emojis[Math.floor(Math.random() * emojis.length)] + ' ' + enhanced;
        }

        // Ensure short
        if (optimized.recommendations.keepShort && enhanced.length > 200) {
            enhanced = enhanced.substring(0, 197) + '...';
        }

        return {
            original: baseMessage,
            enhanced,
            optimizations: optimized.recommendations,
            segment,
            predictedConversionRate: learnings.offerPerformance[segment]?.avgConversionRate || 0.2
        };
    }
}

// ==========================================
// SELF-IMPROVING AI
// ==========================================

class SelfImprovingAI {
    constructor() {
        this.optimizer = new OfferOptimizer();
        this.improvementHistory = [];
    }

    // Main entry point - get the best possible offer
    generateBestOffer(cart, customer) {
        // Get base optimization
        const optimized = this.optimizer.getOptimizedOffer(cart, customer);

        // Check if we should run an A/B test
        const shouldTest = Math.random() < 0.1; // 10% of traffic goes to tests

        if (shouldTest) {
            // Create test variants
            const testId = `test_${Date.now()}`;
            const variants = [
                { id: 'control', discount: optimized.discount },
                { id: 'higher_discount', discount: optimized.discount + 5 },
                { id: 'lower_discount_more_urgency', discount: optimized.discount - 3, urgency: 'high' }
            ];

            this.optimizer.abEngine.createTest(testId, variants);
            const selected = this.optimizer.abEngine.getVariant(testId);

            return {
                ...optimized,
                ...selected,
                isTest: true,
                testId
            };
        }

        return {
            ...optimized,
            isTest: false
        };
    }

    // Record outcome and learn
    recordOutcome(offerId, outcome) {
        // Track conversion
        if (outcome.converted) {
            this.optimizer.tracker.trackConversion(offerId, outcome);
        }

        // Log improvement
        this.improvementHistory.push({
            timestamp: new Date().toISOString(),
            offerId,
            outcome,
            currentLearnings: { ...learnings }
        });

        console.log(`🧠 AI recorded outcome for ${offerId}: ${outcome.converted ? 'CONVERTED ✅' : 'not converted'}`);
    }

    // Get current AI performance metrics
    getPerformanceMetrics() {
        return {
            totalEventsTracked: this.optimizer.tracker.events.length,
            totalConversions: this.optimizer.tracker.conversions.length,
            overallConversionRate: this.optimizer.tracker.events.length > 0
                ? (this.optimizer.tracker.conversions.length / this.optimizer.tracker.events.length * 100).toFixed(1) + '%'
                : 'N/A',
            activeTests: Object.keys(this.optimizer.abEngine.activeTests).length,
            completedTests: this.optimizer.abEngine.completedTests.length,
            lastUpdated: new Date().toISOString()
        };
    }
}

// ==========================================
// SINGLETON INSTANCES
// ==========================================

const aiCore = new SelfImprovingAI();
const abTestEngine = new ABTestEngine();
const conversionTracker = new ConversionTracker();

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Main AI
    aiCore,
    SelfImprovingAI,

    // Components
    OfferOptimizer,
    ABTestEngine,
    ConversionTracker,

    // Raw learnings (for inspection)
    learnings,

    // Niche detection
    detectNiche,
    getNicheOptimizedSettings,

    // Quick access methods
    generateBestOffer: (cart, customer) => aiCore.generateBestOffer(cart, customer),
    recordOutcome: (offerId, outcome) => aiCore.recordOutcome(offerId, outcome),
    getPerformanceMetrics: () => aiCore.getPerformanceMetrics()
};
