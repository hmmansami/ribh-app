/**
 * RIBH ENGINE - THE UNIFIED CORE
 * 
 * This is the ONE CLICK engine that ties everything together:
 * - Value Engine (irresistible offers)
 * - Lead Engine (multi-channel delivery)
 * - Money Model Engine (upsell, downsell, continuity)
 * - AI Core (self-improving intelligence)
 * 
 * ONE CLICK → MONEY FLOWS
 */

const valueEngine = require('./valueEngine');
const leadEngine = require('./leadEngine');
const moneyModelEngine = require('./moneyModelEngine');
const aiCore = require('./aiCore');

// ==========================================
// UNIFIED CART PROCESSOR
// ==========================================

class RibhEngine {
    constructor() {
        this.isActive = true;
        this.processedCarts = new Map();
        this.stats = {
            cartsProcessed: 0,
            messagesSent: 0,
            recovered: 0,
            revenueRecovered: 0
        };
    }

    /**
     * Process an abandoned cart - THE ONE CLICK MAGIC
     * This is called when a cart.abandoned webhook is received
     */
    async processAbandonedCart(cart, storeConfig = {}) {
        console.log(`🛒 Processing abandoned cart: ${cart.id} (${cart.total} SAR)`);

        // 1. Get AI-optimized offer
        const customer = cart.customer || {};
        const aiOffer = aiCore.generateBestOffer(cart, customer);

        // 2. Build irresistible offer with Value Engine
        const offer = valueEngine.buildIrresistibleOffer({
            ...cart,
            hoursAbandoned: 0,
            reminderNumber: 1
        }, customer);

        // Merge AI recommendations
        offer.discount.percentage = aiOffer.discount || offer.discount.percentage;
        offer.aiOptimized = true;
        offer.confidence = aiOffer.confidence;

        // 3. Create message sequence with Lead Engine
        const sequence = leadEngine.createMessageSequence(cart, customer, storeConfig);

        // 4. Get Money Model strategies
        const attractionStrategy = moneyModelEngine.createMoneyModelStrategy(cart, customer, 'attraction');
        const downsellStrategy = moneyModelEngine.createMoneyModelStrategy(cart, customer, 'downsell');

        // 5. Build the complete recovery plan
        const recoveryPlan = {
            cartId: cart.id,
            storeId: cart.merchant || cart.storeId,
            customer: {
                name: customer.name || 'العميل',
                email: customer.email,
                phone: customer.phone
            },
            cartValue: cart.total,

            // Offer details
            offer,

            // Message sequence
            sequence: sequence.sequence,

            // Money model strategies
            strategies: {
                attraction: attractionStrategy,
                downsell: downsellStrategy
            },

            // AI metadata
            ai: {
                isTest: aiOffer.isTest,
                testId: aiOffer.testId,
                confidence: aiOffer.confidence,
                predictedConversionRate: aiOffer.predictedConversionRate
            },

            // Timing
            createdAt: new Date().toISOString(),
            status: 'active'
        };

        // Store for tracking
        this.processedCarts.set(cart.id, recoveryPlan);
        this.stats.cartsProcessed++;

        console.log(`✅ Recovery plan created for cart ${cart.id}`);
        console.log(`   Offer: ${offer.discount.percentage}% off (${offer.seasonal.prefix})`);
        console.log(`   Channel: ${sequence.primaryChannel}`);
        console.log(`   Messages scheduled: ${sequence.sequence.length}`);

        return recoveryPlan;
    }

    /**
     * Generate message for a specific reminder
     */
    generateMessage(cart, reminderNumber = 1) {
        const analysis = valueEngine.buildIrresistibleOffer({
            ...cart,
            reminderNumber
        });

        const seasonal = valueEngine.getSeasonalConfig();
        const customer = cart.customer || {};
        const name = customer.name || 'عميلنا';

        // Build message based on reminder number and segment
        let message = '';

        if (cart.total >= 1000) {
            // VIP message
            message = this.buildVIPMessage(name, cart, analysis, reminderNumber);
        } else if (cart.total >= 200) {
            // Standard message with payment plan
            message = this.buildStandardMessage(name, cart, analysis, reminderNumber);
        } else {
            // Simple message
            message = this.buildSimpleMessage(name, cart, analysis, reminderNumber);
        }

        // Enhance with AI
        const enhanced = aiCore.aiCore.optimizer.enhanceMessage(message, cart, customer);

        return {
            message: enhanced.enhanced,
            originalMessage: enhanced.original,
            analysis,
            seasonal,
            reminderNumber,
            optimizations: enhanced.optimizations
        };
    }

    buildVIPMessage(name, cart, analysis, reminderNumber) {
        const templates = {
            1: `👑 ${name}، أنت عميل مميز عندنا!\n\nسلتك (${cart.total} ر.س) محجوزة لك\n💎 خصم حصري ${analysis.discount.percentage}%\n\nكود: ${analysis.discount.code}`,
            2: `${name}، عرضك الخاص ينتهي قريباً! ⏰\n\n${analysis.discount.percentage}% خصم\n${analysis.valueStack.find(v => v.type === 'payment_plan')?.message || ''}\n\nكود: ${analysis.discount.code}`,
            3: `🚨 آخر فرصة يا ${name}!\n\nخصم ${analysis.discount.percentage}% = توفير ${analysis.discount.savings} ر.س\n${analysis.valueStack.find(v => v.type === 'payment_plan') ? '+ تقسيط بدون فوائد!' : ''}\n\nينتهي العرض خلال ساعات!`
        };
        return templates[reminderNumber] || templates[1];
    }

    buildStandardMessage(name, cart, analysis, reminderNumber) {
        const paymentPlan = moneyModelEngine.DOWNSELL_STRATEGIES.paymentPlan.calculate(cart.total);

        const templates = {
            1: `مرحباً ${name}! 💚\n\nسلتك (${cart.total} ر.س) في انتظارك 🛒\n${paymentPlan ? `💳 ${paymentPlan.shortMessage}` : ''}\n\nأكمل طلبك الآن!`,
            2: `${name}، هدية لك! 🎁\n\n${analysis.discount.percentage}% خصم على طلبك\n${paymentPlan ? `أو قسّط على ${paymentPlan.installments} دفعات!` : ''}\n\nكود: ${analysis.discount.code}`,
            3: `⏰ ${name}، آخر تذكير!\n\n${analysis.discount.percentage}% خصم + ${paymentPlan ? 'تقسيط بدون فوائد' : 'شحن مجاني'}!\n\nكود: ${analysis.discount.code}`
        };
        return templates[reminderNumber] || templates[1];
    }

    buildSimpleMessage(name, cart, analysis, reminderNumber) {
        const templates = {
            1: `مرحباً ${name}! 👋\n\nسلتك في انتظارك 🛒\n\nأكمل طلبك الآن!`,
            2: `${name}، عرض خاص! 🎁\n\n${analysis.discount.percentage > 0 ? `${analysis.discount.percentage}% خصم` : 'شحن مجاني'}\n\n${analysis.discount.code ? `كود: ${analysis.discount.code}` : ''}`,
            3: `آخر تذكير يا ${name}! ⏰\n\nسلتك تنتظرك\n\nأكمل طلبك الآن!`
        };
        return templates[reminderNumber] || templates[1];
    }

    /**
     * Handle order completion (stop recovery sequence)
     */
    handleOrderCompleted(orderId, cartId, orderData = {}) {
        const plan = this.processedCarts.get(cartId);

        if (plan) {
            // Mark as recovered
            plan.status = 'recovered';
            plan.recoveredAt = new Date().toISOString();
            plan.orderValue = orderData.total || plan.cartValue;

            // Update stats
            this.stats.recovered++;
            this.stats.revenueRecovered += plan.orderValue;

            // Record outcome for AI learning
            aiCore.recordOutcome(cartId, {
                converted: true,
                orderValue: plan.orderValue,
                remindersTaken: plan.sequence?.filter(s => s.status === 'sent').length || 0
            });

            console.log(`💰 Cart ${cartId} RECOVERED! +${plan.orderValue} SAR`);
            console.log(`   Total recovered so far: ${this.stats.revenueRecovered} SAR`);

            return {
                success: true,
                recovered: true,
                orderValue: plan.orderValue,
                totalRecovered: this.stats.revenueRecovered
            };
        }

        return { success: true, recovered: false };
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            ...this.stats,
            conversionRate: this.stats.cartsProcessed > 0
                ? ((this.stats.recovered / this.stats.cartsProcessed) * 100).toFixed(1) + '%'
                : '0%',
            avgOrderValue: this.stats.recovered > 0
                ? Math.round(this.stats.revenueRecovered / this.stats.recovered)
                : 0,
            aiPerformance: aiCore.getPerformanceMetrics(),
            isActive: this.isActive
        };
    }

    /**
     * Get live activity feed for dashboard
     */
    getActivityFeed(limit = 10) {
        const activities = [];

        // Get recent processed carts
        const recentCarts = Array.from(this.processedCarts.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);

        for (const cart of recentCarts) {
            if (cart.status === 'recovered') {
                activities.push({
                    type: 'recovery',
                    icon: '💰',
                    message: `${cart.customer.name} استكمل الشراء!`,
                    amount: cart.orderValue,
                    timestamp: cart.recoveredAt
                });
            } else {
                activities.push({
                    type: 'processing',
                    icon: '🤖',
                    message: `جاري معالجة سلة ${cart.customer.name}`,
                    amount: cart.cartValue,
                    timestamp: cart.createdAt
                });
            }
        }

        return activities;
    }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

const ribhEngine = new RibhEngine();

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Main engine
    ribhEngine,
    RibhEngine,

    // Sub-engines (for direct access if needed)
    valueEngine,
    leadEngine,
    moneyModelEngine,
    aiCore,

    // Quick access methods
    processCart: (cart, config) => ribhEngine.processAbandonedCart(cart, config),
    generateMessage: (cart, reminder) => ribhEngine.generateMessage(cart, reminder),
    handleOrder: (orderId, cartId, data) => ribhEngine.handleOrderCompleted(orderId, cartId, data),
    getStats: () => ribhEngine.getStats(),
    getActivityFeed: (limit) => ribhEngine.getActivityFeed(limit)
};
