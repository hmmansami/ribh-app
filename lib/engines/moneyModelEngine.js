/**
 * RIBH MONEY MODEL ENGINE
 * Based on Alex Hormozi's teachings on maximizing LTV
 * 
 * Purpose: Get customers to buy MORE, pay MORE, come BACK
 * 
 * The Money Model:
 * 1. ATTRACT - Get them to buy (irresistible offer)
 * 2. UPSELL - Get them to buy more at checkout
 * 3. DOWNSELL - If they hesitate, offer alternatives
 * 4. CONTINUITY - Get them to come back
 */

// ==========================================
// ATTRACTION OFFERS
// ==========================================

const ATTRACTION_STRATEGIES = {
    // Risk reversal - remove perceived risk
    riskReversal: {
        types: [
            {
                name: 'money_back',
                message: '✅ ضمان استرجاع كامل خلال 14 يوم',
                messageEn: 'Full refund within 14 days',
                power: 10 // How powerful this guarantee is
            },
            {
                name: 'double_money_back',
                message: '💯 إذا لم يعجبك، نرد لك ضعف المبلغ!',
                messageEn: 'Double your money back if not satisfied',
                power: 20 // Very powerful, use for high-value items
            },
            {
                name: 'keep_product',
                message: '🎁 إذا لم يعجبك، احتفظ به مجاناً!',
                messageEn: 'Keep it free if not satisfied',
                power: 25
            },
            {
                name: 'free_trial',
                message: '🆓 جرّب مجاناً لمدة 7 أيام',
                messageEn: '7-day free trial',
                power: 15
            }
        ],

        selectBest: function (cartValue) {
            // Higher value = stronger guarantee needed
            if (cartValue >= 500) return this.types[1]; // double_money_back
            if (cartValue >= 200) return this.types[0]; // money_back
            return this.types[3]; // free_trial for low value
        }
    },

    // Value stacking - pile on the bonuses
    valueStacking: {
        bonuses: [
            { name: 'free_shipping', value: 30, message: '🚚 شحن مجاني', minCart: 100 },
            { name: 'free_gift', value: 50, message: '🎁 هدية مجانية مع الطلب', minCart: 200 },
            { name: 'vip_access', value: 100, message: '👑 عضوية VIP لمدة شهر', minCart: 500 },
            { name: 'extended_warranty', value: 150, message: '🔧 ضمان ممتد سنتين', minCart: 300 },
            { name: 'priority_support', value: 200, message: '⚡ دعم فني أولوية', minCart: 400 }
        ],

        getApplicableBonuses: function (cartValue) {
            return this.bonuses.filter(b => cartValue >= b.minCart);
        },

        calculateTotalBonusValue: function (cartValue) {
            return this.getApplicableBonuses(cartValue)
                .reduce((sum, bonus) => sum + bonus.value, 0);
        }
    },

    // Scarcity - create urgency
    scarcity: {
        types: [
            { type: 'stock', message: '⚠️ باقي {{count}} قطع فقط!' },
            { type: 'time', message: '⏰ العرض ينتهي خلال {{hours}} ساعات!' },
            { type: 'demand', message: '🔥 {{count}} شخص يشاهدون الآن!' },
            { type: 'exclusive', message: '💎 عرض حصري لأول {{count}} طلب!' }
        ],

        generate: function (type = 'stock') {
            const template = this.types.find(t => t.type === type) || this.types[0];
            return template.message
                .replace('{{count}}', Math.floor(Math.random() * 5) + 2)
                .replace('{{hours}}', Math.floor(Math.random() * 12) + 6);
        }
    }
};

// ==========================================
// UPSELL ENGINE
// ==========================================

const UPSELL_STRATEGIES = {
    // At checkout - add more to cart
    orderBumps: {
        types: [
            {
                name: 'extended_warranty',
                triggerCategory: 'electronics',
                price: 49,
                message: '🔧 أضف ضمان ممتد سنتين'
            },
            {
                name: 'gift_wrap',
                triggerValue: 200, // Any cart over 200
                price: 15,
                message: '🎁 تغليف هدية فاخر'
            },
            {
                name: 'express_shipping',
                triggerAny: true,
                price: 25,
                message: '⚡ شحن سريع خلال 24 ساعة'
            },
            {
                name: 'product_protection',
                triggerCategory: 'fashion',
                price: 29,
                message: '🛡️ حماية المنتج لمدة سنة'
            }
        ],

        getRelevantBumps: function (cart) {
            const cartValue = cart.total || 0;
            const categories = cart.items?.map(i => i.category) || [];

            return this.types.filter(bump => {
                if (bump.triggerAny) return true;
                if (bump.triggerValue && cartValue >= bump.triggerValue) return true;
                if (bump.triggerCategory && categories.includes(bump.triggerCategory)) return true;
                return false;
            });
        }
    },

    // After main purchase decided - upgrade
    quantityUpgrade: {
        tiers: [
            { quantity: 2, discount: 10, message: 'اشترِ 2 ووفّر 10%' },
            { quantity: 3, discount: 15, message: 'اشترِ 3 ووفّر 15%' },
            { quantity: 5, discount: 25, message: 'اشترِ 5 ووفّر 25%' }
        ],

        suggest: function (currentQuantity) {
            // Suggest next tier up
            return this.tiers.find(t => t.quantity > currentQuantity) || this.tiers[0];
        }
    },

    // Premium version upsell
    premiumUpgrade: {
        multiplier: 1.5, // Premium costs 50% more
        valueMultiplier: 3, // But delivers 3x value
        message: '⬆️ ترقية للنسخة المميزة',
        benefits: [
            'ضمان ممتد',
            'شحن أولوية',
            'دعم VIP',
            'إرجاع مجاني'
        ]
    },

    // Cross-sell related products
    crossSell: {
        generateSuggestions: function (purchasedItems) {
            // This would connect to product recommendation engine
            // For now, return template
            return {
                title: 'عملاء اشتروا هذا أحبوا أيضاً',
                products: [], // Would be populated from product catalog
                discount: 10 // 10% off if bought together
            };
        }
    }
};

// ==========================================
// DOWNSELL ENGINE
// ==========================================

const DOWNSELL_STRATEGIES = {
    // Payment plan - for those who can't pay full
    paymentPlan: {
        providers: {
            tamara: {
                name: 'Tamara',
                nameAr: 'تمارا',
                minAmount: 50,
                maxAmount: 10000,
                installments: [3, 4],
                interest: 0,
                fee: 0,
                logo: 'https://cdn.tamara.co/assets/svg/logo.svg'
            },
            tabby: {
                name: 'Tabby',
                nameAr: 'تابي',
                minAmount: 100,
                maxAmount: 5000,
                installments: [4],
                interest: 0,
                fee: 0,
                logo: 'https://tabby.ai/assets/logo.svg'
            }
        },

        calculate: function (total, provider = 'tamara', installments = 4) {
            const config = this.providers[provider];
            if (!config || total < config.minAmount || total > config.maxAmount) {
                return null;
            }

            const monthlyAmount = Math.ceil(total / installments);
            const firstPayment = total - (monthlyAmount * (installments - 1));

            return {
                provider: config.nameAr,
                total,
                installments,
                monthlyAmount,
                firstPayment,
                message: `قسّط على ${installments} دفعات: ${monthlyAmount} ر.س/شهر`,
                shortMessage: `${monthlyAmount} ر.س/شهر × ${installments}`,
                cta: `ادفع ${firstPayment} ر.س الآن فقط!`
            };
        },

        generatePopupHTML: function (total) {
            const plan = this.calculate(total);
            if (!plan) return null;

            return `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 14px; margin-bottom: 8px;">💳 قسّط بدون فوائد</div>
                    <div style="font-size: 28px; font-weight: bold;">${plan.monthlyAmount} ر.س/شهر</div>
                    <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">× ${plan.installments} دفعات مع ${plan.provider}</div>
                    <button style="background: white; color: #667eea; border: none; padding: 12px 24px; border-radius: 8px; margin-top: 15px; font-weight: bold; cursor: pointer;">
                        اختر التقسيط
                    </button>
                </div>
            `;
        }
    },

    // Smaller offer - for price-sensitive
    miniOffer: {
        percentage: 60, // Offer 60% of original value

        generate: function (originalOffer) {
            return {
                ...originalOffer,
                price: originalOffer.price * (this.percentage / 100),
                message: '💡 خيار أخف على الميزانية',
                isDownsell: true
            };
        }
    },

    // Exit intent - last chance
    exitIntent: {
        triggers: ['mouse_leave_top', 'tab_switch', 'back_button'],

        offers: [
            { discount: 10, message: 'قبل ما تمشي! خصم 10% إضافي' },
            { discount: 15, message: '⚡ عرض لمرة واحدة: خصم 15%!' },
            { discount: 20, message: '🚨 آخر فرصة! خصم 20% الآن فقط!' }
        ],

        getBestOffer: function (cartValue, attemptNumber = 1) {
            // Escalate discount based on how many times they tried to leave
            const index = Math.min(attemptNumber - 1, this.offers.length - 1);
            return this.offers[index];
        }
    },

    // Save for later
    saveForLater: {
        message: '📌 احفظ سلتك لوقت لاحق؟',
        reminderDelays: [24, 72, 168], // Hours

        generate: function (cart) {
            return {
                action: 'save_cart',
                cartId: cart.id,
                expiresIn: '30 days',
                reminderSchedule: this.reminderDelays,
                message: 'لا مشكلة! سنحتفظ بسلتك ونذكرك لاحقاً 💚'
            };
        }
    }
};

// ==========================================
// CONTINUITY ENGINE
// ==========================================

const CONTINUITY_STRATEGIES = {
    // Replenishment reminders
    replenishment: {
        categories: {
            consumables: { daysToRemind: 30, message: 'وقت إعادة الطلب! 🔄' },
            cosmetics: { daysToRemind: 45, message: 'منتجاتك المفضلة تنتظرك! 💄' },
            supplements: { daysToRemind: 28, message: 'لا تنسى فيتاميناتك! 💊' },
            pet_food: { daysToRemind: 21, message: 'طعام حيوانك الأليف! 🐱' }
        },

        schedule: function (purchase, category) {
            const config = this.categories[category] || { daysToRemind: 30 };
            const remindDate = new Date(purchase.date);
            remindDate.setDate(remindDate.getDate() + config.daysToRemind);

            return {
                remindAt: remindDate.toISOString(),
                message: config.message,
                products: purchase.items
            };
        }
    },

    // Win-back campaigns
    winback: {
        triggers: [
            { daysSincePurchase: 30, discount: 5, message: 'اشتقنا لك! 💚' },
            { daysSincePurchase: 60, discount: 10, message: 'عرض خاص لك فقط! 🎁' },
            { daysSincePurchase: 90, discount: 15, message: 'آخر فرصة! خصم 15% 🚨' }
        ],

        getBestCampaign: function (customer) {
            const daysSince = customer.daysSinceLastPurchase || 0;
            return this.triggers.find(t => daysSince >= t.daysSincePurchase) || null;
        }
    },

    // Loyalty program
    loyalty: {
        tiers: [
            { name: 'برونز', minPoints: 0, discountRate: 0, icon: '🥉' },
            { name: 'فضي', minPoints: 500, discountRate: 5, icon: '🥈' },
            { name: 'ذهبي', minPoints: 2000, discountRate: 10, icon: '🥇' },
            { name: 'بلاتيني', minPoints: 5000, discountRate: 15, icon: '💎' }
        ],

        pointsPerSAR: 1, // 1 point per 1 SAR spent

        calculateTier: function (totalPoints) {
            return this.tiers.reduce((highest, tier) => {
                return totalPoints >= tier.minPoints ? tier : highest;
            }, this.tiers[0]);
        },

        calculatePoints: function (purchaseAmount) {
            return Math.floor(purchaseAmount * this.pointsPerSAR);
        }
    },

    // Special occasions
    occasions: {
        types: [
            { type: 'birthday', discount: 20, message: 'عيد ميلاد سعيد! 🎂 خصم 20% هدية لك!' },
            { type: 'anniversary', discount: 15, message: 'ذكرى أول شراء! 🎉 خصم 15% لك!' },
            { type: 'eid', discount: 10, message: 'كل عام وأنت بخير! 🌙 عرض العيد' },
            { type: 'national_day', discount: 23, message: 'اليوم الوطني! 🇸🇦 خصم 23%' }
        ],

        getUpcoming: function (customer) {
            const now = new Date();
            const currentMonth = now.getMonth() + 1;
            const currentDay = now.getDate();

            const upcoming = [];

            // Check birthday
            if (customer.birthMonth && customer.birthDay) {
                if (customer.birthMonth === currentMonth &&
                    customer.birthDay >= currentDay &&
                    customer.birthDay <= currentDay + 7) {
                    upcoming.push(this.types.find(t => t.type === 'birthday'));
                }
            }

            // Check first purchase anniversary
            if (customer.firstPurchaseDate) {
                const firstPurchase = new Date(customer.firstPurchaseDate);
                if (firstPurchase.getMonth() + 1 === currentMonth &&
                    firstPurchase.getDate() >= currentDay &&
                    firstPurchase.getDate() <= currentDay + 7) {
                    upcoming.push(this.types.find(t => t.type === 'anniversary'));
                }
            }

            return upcoming;
        }
    }
};

// ==========================================
// MAIN ORCHESTRATOR
// ==========================================

function createMoneyModelStrategy(cart, customer, stage = 'attraction') {
    const cartValue = cart.total || 0;

    const strategy = {
        stage,
        cartValue,
        createdAt: new Date().toISOString()
    };

    switch (stage) {
        case 'attraction':
            strategy.riskReversal = ATTRACTION_STRATEGIES.riskReversal.selectBest(cartValue);
            strategy.bonuses = ATTRACTION_STRATEGIES.valueStacking.getApplicableBonuses(cartValue);
            strategy.totalBonusValue = ATTRACTION_STRATEGIES.valueStacking.calculateTotalBonusValue(cartValue);
            strategy.scarcity = ATTRACTION_STRATEGIES.scarcity.generate('stock');
            break;

        case 'upsell':
            strategy.orderBumps = UPSELL_STRATEGIES.orderBumps.getRelevantBumps(cart);
            strategy.crossSell = UPSELL_STRATEGIES.crossSell.generateSuggestions(cart.items);
            strategy.premiumUpgrade = UPSELL_STRATEGIES.premiumUpgrade;
            break;

        case 'downsell':
            strategy.paymentPlan = DOWNSELL_STRATEGIES.paymentPlan.calculate(cartValue);
            strategy.exitOffer = DOWNSELL_STRATEGIES.exitIntent.getBestOffer(cartValue);
            strategy.saveForLater = DOWNSELL_STRATEGIES.saveForLater.generate(cart);
            break;

        case 'continuity':
            strategy.loyalty = CONTINUITY_STRATEGIES.loyalty.calculateTier(customer.totalPoints || 0);
            strategy.winback = CONTINUITY_STRATEGIES.winback.getBestCampaign(customer);
            strategy.occasions = CONTINUITY_STRATEGIES.occasions.getUpcoming(customer);
            break;
    }

    return strategy;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Main orchestrator
    createMoneyModelStrategy,

    // Attraction
    ATTRACTION_STRATEGIES,

    // Upsell
    UPSELL_STRATEGIES,

    // Downsell
    DOWNSELL_STRATEGIES,

    // Continuity
    CONTINUITY_STRATEGIES
};
