/**
 * 💎 RIBH Value Stacker
 * 
 * Hormozi's Core Principle: NEVER DISCOUNT - ADD VALUE INSTEAD
 * 
 * The Value Equation:
 * Value = (Dream Outcome × Perceived Likelihood) / (Time × Effort)
 * 
 * To increase value:
 * - Increase dream outcome (bigger result)
 * - Increase perceived likelihood (guarantees, proof)
 * - Decrease time to result (faster)
 * - Decrease effort required (easier)
 * 
 * Stack bonuses until perceived value = 10x price
 */

// ============================================================
// BONUS TYPES - Each removes a specific objection
// ============================================================

const BONUS_TYPES = {
  // SPEED (reduce time)
  FAST_SHIPPING: {
    id: 'fast_shipping',
    nameAr: 'توصيل سريع',
    nameEn: 'Fast Shipping',
    descAr: 'توصيل خلال 24 ساعة',
    descEn: 'Delivery within 24 hours',
    perceivedValue: 30,  // SAR
    actualCost: 15,
    removesObjection: 'time',
  },
  EXPRESS_PROCESSING: {
    id: 'express_processing',
    nameAr: 'أولوية في التجهيز',
    nameEn: 'Priority Processing',
    descAr: 'طلبك يتجهز أولاً',
    descEn: 'Your order is processed first',
    perceivedValue: 25,
    actualCost: 0,
    removesObjection: 'time',
  },
  
  // EASE (reduce effort)
  FREE_SHIPPING: {
    id: 'free_shipping',
    nameAr: 'شحن مجاني',
    nameEn: 'Free Shipping',
    descAr: 'توصيل مجاني لباب بيتك',
    descEn: 'Free delivery to your door',
    perceivedValue: 25,
    actualCost: 15,
    removesObjection: 'effort',
  },
  FREE_RETURNS: {
    id: 'free_returns',
    nameAr: 'إرجاع مجاني',
    nameEn: 'Free Returns',
    descAr: 'استرجع مجاناً خلال 30 يوم',
    descEn: 'Free returns within 30 days',
    perceivedValue: 50,
    actualCost: 10, // Average
    removesObjection: 'risk',
  },
  EASY_SETUP: {
    id: 'easy_setup',
    nameAr: 'إعداد مجاني',
    nameEn: 'Free Setup',
    descAr: 'نساعدك في الإعداد مجاناً',
    descEn: 'We help you set up for free',
    perceivedValue: 100,
    actualCost: 20,
    removesObjection: 'effort',
  },
  
  // CERTAINTY (increase likelihood)
  MONEY_BACK_GUARANTEE: {
    id: 'money_back',
    nameAr: 'ضمان استرداد المبلغ',
    nameEn: 'Money-Back Guarantee',
    descAr: 'غير راضي؟ نرجع فلوسك 100%',
    descEn: 'Not satisfied? 100% money back',
    perceivedValue: 100,
    actualCost: 5, // <5% actually use it
    removesObjection: 'risk',
  },
  WARRANTY_EXTENDED: {
    id: 'warranty_extended',
    nameAr: 'ضمان ممتد',
    nameEn: 'Extended Warranty',
    descAr: 'ضمان سنة كاملة بدل 3 شهور',
    descEn: '1 year warranty instead of 3 months',
    perceivedValue: 150,
    actualCost: 20,
    removesObjection: 'risk',
  },
  QUALITY_CERTIFICATE: {
    id: 'quality_cert',
    nameAr: 'شهادة جودة',
    nameEn: 'Quality Certificate',
    descAr: 'منتج معتمد ومفحوص',
    descEn: 'Certified and tested product',
    perceivedValue: 50,
    actualCost: 0,
    removesObjection: 'risk',
  },
  
  // RESULT (increase dream outcome)
  FREE_ACCESSORY: {
    id: 'free_accessory',
    nameAr: 'إكسسوار مجاني',
    nameEn: 'Free Accessory',
    descAr: 'هدية مجانية مع طلبك',
    descEn: 'Free gift with your order',
    perceivedValue: 50,
    actualCost: 15,
    removesObjection: 'value',
  },
  PREMIUM_PACKAGING: {
    id: 'premium_pack',
    nameAr: 'تغليف فاخر',
    nameEn: 'Premium Packaging',
    descAr: 'تغليف هدية فاخر مجاني',
    descEn: 'Free luxury gift packaging',
    perceivedValue: 30,
    actualCost: 5,
    removesObjection: 'value',
  },
  EXCLUSIVE_CONTENT: {
    id: 'exclusive_content',
    nameAr: 'محتوى حصري',
    nameEn: 'Exclusive Content',
    descAr: 'دليل استخدام + فيديوهات حصرية',
    descEn: 'User guide + exclusive videos',
    perceivedValue: 100,
    actualCost: 0,
    removesObjection: 'effort',
  },
  VIP_SUPPORT: {
    id: 'vip_support',
    nameAr: 'دعم VIP',
    nameEn: 'VIP Support',
    descAr: 'واتساب مباشر مع فريق الدعم',
    descEn: 'Direct WhatsApp support',
    perceivedValue: 100,
    actualCost: 5,
    removesObjection: 'effort',
  },
  
  // SCARCITY (not a discount!)
  LIMITED_EDITION: {
    id: 'limited_edition',
    nameAr: 'إصدار محدود',
    nameEn: 'Limited Edition',
    descAr: 'فقط 50 قطعة متوفرة',
    descEn: 'Only 50 pieces available',
    perceivedValue: 50,
    actualCost: 0,
    removesObjection: 'urgency',
  },
  EARLY_ACCESS: {
    id: 'early_access',
    nameAr: 'وصول مبكر',
    nameEn: 'Early Access',
    descAr: 'احصل عليه قبل الجميع',
    descEn: 'Get it before everyone',
    perceivedValue: 75,
    actualCost: 0,
    removesObjection: 'urgency',
  },
};

// ============================================================
// OBJECTIONS & THEIR SOLUTIONS
// ============================================================

const OBJECTION_SOLUTIONS = {
  price: ['MONEY_BACK_GUARANTEE', 'FREE_RETURNS', 'FREE_SHIPPING'],
  time: ['FAST_SHIPPING', 'EXPRESS_PROCESSING', 'EARLY_ACCESS'],
  effort: ['FREE_SHIPPING', 'EASY_SETUP', 'EXCLUSIVE_CONTENT', 'VIP_SUPPORT'],
  risk: ['MONEY_BACK_GUARANTEE', 'FREE_RETURNS', 'WARRANTY_EXTENDED', 'QUALITY_CERTIFICATE'],
  value: ['FREE_ACCESSORY', 'PREMIUM_PACKAGING', 'EXCLUSIVE_CONTENT'],
  urgency: ['LIMITED_EDITION', 'EARLY_ACCESS'],
};

// ============================================================
// VALUE STACKING LOGIC
// ============================================================

/**
 * Create a value stack for an offer
 * Goal: Stack bonuses until perceived value >= 10x price
 * 
 * @param {number} productPrice - The product price
 * @param {array} customerObjections - Detected objections ['price', 'risk', etc]
 * @param {number} maxCost - Maximum actual cost we can add
 * @returns {object} - The value stack
 */
function createValueStack(productPrice, customerObjections = [], maxCost = null) {
  const targetPerceivedValue = productPrice * 10; // 10x rule
  const maxActualCost = maxCost || productPrice * 0.15; // Max 15% of price in costs
  
  const stack = [];
  let totalPerceivedValue = 0;
  let totalActualCost = 0;
  const usedBonusIds = new Set();
  
  // First: Add bonuses that address specific objections
  for (const objection of customerObjections) {
    const solutions = OBJECTION_SOLUTIONS[objection] || [];
    for (const bonusId of solutions) {
      const bonus = BONUS_TYPES[bonusId];
      if (!bonus || usedBonusIds.has(bonus.id)) continue;
      
      if (totalActualCost + bonus.actualCost <= maxActualCost) {
        stack.push(bonus);
        totalPerceivedValue += bonus.perceivedValue;
        totalActualCost += bonus.actualCost;
        usedBonusIds.add(bonus.id);
      }
      
      if (totalPerceivedValue >= targetPerceivedValue) break;
    }
    if (totalPerceivedValue >= targetPerceivedValue) break;
  }
  
  // Second: Add high-value/low-cost bonuses until we hit target
  const sortedBonuses = Object.values(BONUS_TYPES)
    .filter(b => !usedBonusIds.has(b.id))
    .sort((a, b) => (b.perceivedValue / (b.actualCost || 1)) - (a.perceivedValue / (a.actualCost || 1)));
  
  for (const bonus of sortedBonuses) {
    if (totalPerceivedValue >= targetPerceivedValue) break;
    if (totalActualCost + bonus.actualCost > maxActualCost) continue;
    
    stack.push(bonus);
    totalPerceivedValue += bonus.perceivedValue;
    totalActualCost += bonus.actualCost;
  }
  
  return {
    bonuses: stack,
    totalPerceivedValue,
    totalActualCost,
    valueMultiple: Math.round((totalPerceivedValue / productPrice) * 10) / 10,
    meetsTarget: totalPerceivedValue >= targetPerceivedValue,
  };
}

/**
 * Format value stack for display in message
 */
function formatValueStackArabic(stack) {
  if (!stack.bonuses || stack.bonuses.length === 0) return '';
  
  let text = '🎁 مع طلبك تحصل على:\n';
  for (const bonus of stack.bonuses) {
    text += `✅ ${bonus.nameAr} (قيمتها ${bonus.perceivedValue} ريال)\n`;
  }
  text += `\n💎 إجمالي الهدايا: ${stack.totalPerceivedValue} ريال مجاناً!`;
  
  return text;
}

function formatValueStackEnglish(stack) {
  if (!stack.bonuses || stack.bonuses.length === 0) return '';
  
  let text = '🎁 With your order you get:\n';
  for (const bonus of stack.bonuses) {
    text += `✅ ${bonus.nameEn} (${bonus.perceivedValue} SAR value)\n`;
  }
  text += `\n💎 Total bonus value: ${stack.totalPerceivedValue} SAR FREE!`;
  
  return text;
}

// ============================================================
// DETECT CUSTOMER OBJECTIONS
// ============================================================

/**
 * Detect likely objections based on customer behavior
 */
function detectObjections(customerData) {
  const objections = [];
  
  // Price sensitivity
  if (customerData.abandonedAtCheckout) objections.push('price');
  if (customerData.viewedMultipleTimes && !customerData.purchased) objections.push('price');
  if (customerData.segment === 'price_sensitive') objections.push('price');
  
  // Risk aversion
  if (customerData.isFirstTimeBuyer) objections.push('risk');
  if (customerData.hasReturnedBefore) objections.push('risk');
  
  // Time/effort concerns
  if (customerData.abandonedAtShipping) objections.push('effort');
  if (customerData.askedAboutDelivery) objections.push('time');
  
  // Value perception
  if (customerData.cartValue < customerData.viewedProductsAvgPrice) objections.push('value');
  
  // Default: assume price and risk for unknown
  if (objections.length === 0) {
    objections.push('price', 'risk');
  }
  
  return objections;
}

// ============================================================
// CREATE OFFER WITH VALUE STACK (NOT DISCOUNT)
// ============================================================

/**
 * Transform a discount offer into a value-stacked offer
 * 
 * Instead of: "20% off" 
 * We say: "Get FREE shipping + FREE returns + extended warranty"
 * 
 * Same cost to us, but much higher perceived value
 */
function transformDiscountToValueStack(discountOffer, productPrice) {
  const discountAmount = productPrice * (discountOffer.discountPercent / 100);
  
  // Create a value stack with the same cost as the discount
  const stack = createValueStack(productPrice, ['price', 'risk'], discountAmount);
  
  return {
    ...discountOffer,
    type: 'value_stack',
    originalDiscount: discountOffer.discountPercent,
    valueStack: stack,
    message: {
      ar: formatValueStackArabic(stack),
      en: formatValueStackEnglish(stack),
    },
    psychology: 'Value stacking feels like getting MORE, discounts feel like paying LESS. More > Less.',
  };
}

// ============================================================
// HORMOZI'S VALUE EQUATION CALCULATOR
// ============================================================

/**
 * Calculate offer value using Hormozi's equation
 * Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort/Sacrifice)
 */
function calculateOfferValue(offer) {
  // Scale: 1-10 for each factor
  const dreamOutcome = offer.dreamOutcomeScore || 5;      // How big is the result?
  const likelihood = offer.likelihoodScore || 5;          // How likely to achieve?
  const timeDelay = offer.timeDelayScore || 5;            // How long to get result?
  const effort = offer.effortScore || 5;                  // How hard is it?
  
  // Calculate value (higher = better offer)
  const value = (dreamOutcome * likelihood) / (timeDelay * effort);
  
  return {
    value: Math.round(value * 100) / 100,
    factors: { dreamOutcome, likelihood, timeDelay, effort },
    interpretation: value > 2 ? 'Excellent offer' : value > 1 ? 'Good offer' : 'Needs improvement',
    improvements: generateImprovements({ dreamOutcome, likelihood, timeDelay, effort }),
  };
}

function generateImprovements(factors) {
  const improvements = [];
  
  if (factors.dreamOutcome < 7) {
    improvements.push({
      factor: 'dreamOutcome',
      suggestion: 'Make the end result more exciting. Paint a vivid picture of success.',
      ar: 'صوّر النتيجة النهائية بشكل أفضل',
    });
  }
  
  if (factors.likelihood < 7) {
    improvements.push({
      factor: 'likelihood',
      suggestion: 'Add guarantees, testimonials, or proof to increase believability.',
      ar: 'أضف ضمانات وتجارب عملاء حقيقية',
    });
  }
  
  if (factors.timeDelay > 3) {
    improvements.push({
      factor: 'timeDelay',
      suggestion: 'Reduce time to first result. Instant gratification wins.',
      ar: 'قلل وقت الحصول على النتيجة',
    });
  }
  
  if (factors.effort > 3) {
    improvements.push({
      factor: 'effort',
      suggestion: 'Make it easier. Done-for-you beats do-it-yourself.',
      ar: 'سهّل العملية على العميل',
    });
  }
  
  return improvements;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Core functions
  createValueStack,
  formatValueStackArabic,
  formatValueStackEnglish,
  transformDiscountToValueStack,
  
  // Detection
  detectObjections,
  
  // Hormozi equation
  calculateOfferValue,
  
  // Data
  BONUS_TYPES,
  OBJECTION_SOLUTIONS,
};
