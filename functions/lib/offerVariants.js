/**
 * offerVariants.js - 5 Discount/Offer Strategies for A/B Testing
 * 
 * Each variant takes (cartValue, customerSegment) and returns:
 * { type, discount, message, expiryHours }
 */

// Customer segments: 'new', 'returning', 'vip', 'abandoner'

/**
 * 1. PERCENTAGE - Classic % off (10-25% based on cart value)
 */
function percentage(cartValue, customerSegment = 'new') {
  let discountPercent;
  
  // Higher cart = higher discount to close the deal
  if (cartValue >= 500) {
    discountPercent = 25;
  } else if (cartValue >= 300) {
    discountPercent = 20;
  } else if (cartValue >= 150) {
    discountPercent = 15;
  } else {
    discountPercent = 10;
  }
  
  // VIP gets extra 5%
  if (customerSegment === 'vip') {
    discountPercent += 5;
  }
  
  const discountAmount = Math.round(cartValue * (discountPercent / 100));
  
  return {
    type: 'percentage',
    discount: discountPercent,
    discountValue: discountAmount,
    message: `🎉 خصم ${discountPercent}% على طلبك! وفّر ${discountAmount} ريال`,
    messageEn: `🎉 ${discountPercent}% OFF your order! Save ${discountAmount} SAR`,
    expiryHours: customerSegment === 'abandoner' ? 24 : 48,
    code: `SAVE${discountPercent}`
  };
}

/**
 * 2. FIXED_AMOUNT - Fixed SAR off (e.g., "خصم 50 ريال")
 */
function fixedAmount(cartValue, customerSegment = 'new') {
  let discount;
  let minOrder;
  
  // Tiered fixed discounts based on cart value
  if (cartValue >= 400) {
    discount = 75;
    minOrder = 400;
  } else if (cartValue >= 250) {
    discount = 50;
    minOrder = 250;
  } else if (cartValue >= 100) {
    discount = 25;
    minOrder = 100;
  } else {
    discount = 15;
    minOrder = 50;
  }
  
  // Abandoners get a boost
  if (customerSegment === 'abandoner') {
    discount += 10;
  }
  
  return {
    type: 'fixed_amount',
    discount: discount,
    discountValue: discount,
    minOrder: minOrder,
    message: `💰 خصم ${discount} ريال على طلبات ${minOrder}+ ريال`,
    messageEn: `💰 ${discount} SAR OFF on orders ${minOrder}+ SAR`,
    expiryHours: 36,
    code: `FLAT${discount}`
  };
}

/**
 * 3. FREE_SHIPPING - Free shipping instead of discount
 */
function freeShipping(cartValue, customerSegment = 'new') {
  const shippingValue = 25; // Typical shipping cost
  let minOrder = 100;
  
  // Lower threshold for VIPs and abandoners
  if (customerSegment === 'vip' || customerSegment === 'abandoner') {
    minOrder = 50;
  }
  
  const qualifies = cartValue >= minOrder;
  
  return {
    type: 'free_shipping',
    discount: shippingValue,
    discountValue: qualifies ? shippingValue : 0,
    minOrder: minOrder,
    qualifies: qualifies,
    message: qualifies 
      ? `🚚 توصيل مجاني على طلبك!`
      : `🚚 أضف ${minOrder - cartValue} ريال للتوصيل المجاني`,
    messageEn: qualifies
      ? `🚚 FREE shipping on your order!`
      : `🚚 Add ${minOrder - cartValue} SAR for FREE shipping`,
    expiryHours: 72, // Longer expiry - lower urgency
    code: 'FREESHIP'
  };
}

/**
 * 4. BUNDLE - "أضف منتج ثاني بنصف السعر"
 */
function bundle(cartValue, customerSegment = 'new') {
  let bundleDiscount;
  let bundleType;
  
  // Different bundle offers based on segment
  if (customerSegment === 'vip') {
    bundleDiscount = 60; // 60% off second item
    bundleType = 'second_item_60';
  } else if (cartValue >= 200) {
    bundleDiscount = 50; // 50% off second item
    bundleType = 'second_item_50';
  } else {
    bundleDiscount = 40; // 40% off second item
    bundleType = 'second_item_40';
  }
  
  // Estimate savings (assume second item is ~same price)
  const estimatedSavings = Math.round(cartValue * (bundleDiscount / 100));
  
  return {
    type: 'bundle',
    discount: bundleDiscount,
    discountValue: estimatedSavings,
    bundleType: bundleType,
    message: `🛍️ أضف منتج ثاني واحصل على خصم ${bundleDiscount}% عليه!`,
    messageEn: `🛍️ Add a second item and get ${bundleDiscount}% OFF on it!`,
    expiryHours: 48,
    code: `BUNDLE${bundleDiscount}`
  };
}

/**
 * 5. TIERED - Bigger discount for bigger cart
 */
function tiered(cartValue, customerSegment = 'new') {
  const tiers = [
    { min: 500, discount: 20, nextTier: null },
    { min: 300, discount: 15, nextTier: 500 },
    { min: 150, discount: 10, nextTier: 300 },
    { min: 0, discount: 5, nextTier: 150 }
  ];
  
  // Find current tier
  const currentTier = tiers.find(t => cartValue >= t.min);
  const discountPercent = currentTier.discount;
  const discountValue = Math.round(cartValue * (discountPercent / 100));
  
  // Calculate upsell message
  let upsellMessage = '';
  let upsellMessageEn = '';
  
  if (currentTier.nextTier) {
    const nextTierObj = tiers.find(t => t.min === currentTier.nextTier);
    const amountNeeded = currentTier.nextTier - cartValue;
    upsellMessage = `أضف ${amountNeeded} ريال واحصل على ${nextTierObj.discount}% بدل ${discountPercent}%!`;
    upsellMessageEn = `Add ${amountNeeded} SAR to unlock ${nextTierObj.discount}% instead of ${discountPercent}%!`;
  }
  
  return {
    type: 'tiered',
    discount: discountPercent,
    discountValue: discountValue,
    currentTier: currentTier.min,
    nextTier: currentTier.nextTier,
    message: `📊 اشتري بـ${currentTier.min}+ واحصل على ${discountPercent}%`,
    messageEn: `📊 Spend ${currentTier.min}+ SAR and get ${discountPercent}% OFF`,
    upsellMessage: upsellMessage,
    upsellMessageEn: upsellMessageEn,
    expiryHours: 24, // Short expiry - creates urgency
    code: `TIER${discountPercent}`
  };
}

/**
 * Get a random offer for A/B testing
 * @param {number} cartValue 
 * @param {string} customerSegment 
 * @param {string[]} excludeTypes - Types to exclude from random selection
 */
function getRandomOffer(cartValue, customerSegment = 'new', excludeTypes = []) {
  const allVariants = {
    percentage,
    fixed_amount: fixedAmount,
    free_shipping: freeShipping,
    bundle,
    tiered
  };
  
  // Filter out excluded types
  const availableTypes = Object.keys(allVariants).filter(t => !excludeTypes.includes(t));
  
  if (availableTypes.length === 0) {
    return percentage(cartValue, customerSegment); // Fallback
  }
  
  // Random selection
  const randomType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
  const offer = allVariants[randomType](cartValue, customerSegment);
  
  // Add metadata for tracking
  offer.selectedAt = new Date().toISOString();
  offer.abTestGroup = randomType;
  
  return offer;
}

/**
 * Get the best offer based on segment behavior
 */
function getBestOffer(cartValue, customerSegment = 'new') {
  // Segment-based recommendations
  const segmentPreferences = {
    'new': ['percentage', 'fixed_amount'],      // New customers respond to clear discounts
    'returning': ['bundle', 'tiered'],          // Returning customers like value stacking
    'vip': ['bundle', 'free_shipping'],         // VIPs appreciate exclusive perks
    'abandoner': ['fixed_amount', 'percentage'] // Abandoners need clear, immediate value
  };
  
  const preferred = segmentPreferences[customerSegment] || ['percentage'];
  const variantName = preferred[0];
  
  const variants = {
    percentage,
    fixed_amount: fixedAmount,
    free_shipping: freeShipping,
    bundle,
    tiered
  };
  
  return variants[variantName](cartValue, customerSegment);
}

/**
 * Rate an offer's performance for tracking
 * @param {object} offer - The offer object
 * @param {number} conversionRate - Observed conversion rate (0-1)
 * @returns {object} Scored offer with performance metrics
 */
function rateOffer(offer, conversionRate) {
  // Base score from conversion rate (0-100)
  let score = conversionRate * 100;
  
  // Adjust for discount efficiency (lower discount with same conversion = better)
  const discountEfficiency = conversionRate / (offer.discount / 100 || 0.1);
  
  // Calculate ROI proxy (conversion vs discount given)
  const roi = offer.discountValue > 0 
    ? (conversionRate * 100) / offer.discountValue 
    : conversionRate * 100;
  
  // Performance tier
  let tier;
  if (score >= 20) tier = 'excellent';
  else if (score >= 10) tier = 'good';
  else if (score >= 5) tier = 'average';
  else tier = 'poor';
  
  return {
    offer: offer,
    conversionRate: conversionRate,
    score: Math.round(score * 100) / 100,
    discountEfficiency: Math.round(discountEfficiency * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    tier: tier,
    recommendation: tier === 'poor' 
      ? 'Consider retiring this variant'
      : tier === 'excellent'
        ? 'Scale this variant!'
        : 'Continue testing'
  };
}

/**
 * Compare multiple offers and rank them
 */
function compareOffers(offersWithRates) {
  // offersWithRates: [{ offer, conversionRate }, ...]
  const rated = offersWithRates.map(({ offer, conversionRate }) => 
    rateOffer(offer, conversionRate)
  );
  
  // Sort by score descending
  rated.sort((a, b) => b.score - a.score);
  
  return {
    ranked: rated,
    best: rated[0],
    worst: rated[rated.length - 1],
    summary: rated.map(r => `${r.offer.type}: ${r.score} (${r.tier})`).join(' | ')
  };
}

// ============ TEST WITH SAMPLE DATA ============

function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 TESTING OFFER VARIANTS');
  console.log('='.repeat(60));
  
  const testCases = [
    { cartValue: 100, segment: 'new' },
    { cartValue: 250, segment: 'returning' },
    { cartValue: 400, segment: 'vip' },
    { cartValue: 180, segment: 'abandoner' },
    { cartValue: 600, segment: 'vip' }
  ];
  
  const variants = [
    { name: 'percentage', fn: percentage },
    { name: 'fixed_amount', fn: fixedAmount },
    { name: 'free_shipping', fn: freeShipping },
    { name: 'bundle', fn: bundle },
    { name: 'tiered', fn: tiered }
  ];
  
  // Test each variant
  variants.forEach(({ name, fn }) => {
    console.log(`\n📦 ${name.toUpperCase()}`);
    console.log('-'.repeat(40));
    
    testCases.forEach(({ cartValue, segment }) => {
      const offer = fn(cartValue, segment);
      console.log(`  Cart: ${cartValue} SAR | Segment: ${segment}`);
      console.log(`  → ${offer.message}`);
      console.log(`  → Code: ${offer.code} | Expires: ${offer.expiryHours}h | Value: ${offer.discountValue} SAR`);
      console.log('');
    });
  });
  
  // Test random offer
  console.log('\n🎲 RANDOM OFFER TEST');
  console.log('-'.repeat(40));
  for (let i = 0; i < 3; i++) {
    const random = getRandomOffer(200, 'new');
    console.log(`  Random #${i + 1}: ${random.type} - ${random.message}`);
  }
  
  // Test rating system
  console.log('\n📊 RATING SYSTEM TEST');
  console.log('-'.repeat(40));
  
  const sampleResults = [
    { offer: percentage(200, 'new'), conversionRate: 0.15 },
    { offer: fixedAmount(200, 'new'), conversionRate: 0.12 },
    { offer: freeShipping(200, 'new'), conversionRate: 0.08 },
    { offer: bundle(200, 'new'), conversionRate: 0.18 },
    { offer: tiered(200, 'new'), conversionRate: 0.10 }
  ];
  
  const comparison = compareOffers(sampleResults);
  console.log('\nRanked Results:');
  comparison.ranked.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.offer.type}: Score ${r.score} (${r.tier}) - ${r.recommendation}`);
  });
  
  console.log(`\n🏆 Best: ${comparison.best.offer.type}`);
  console.log(`📉 Worst: ${comparison.worst.offer.type}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('='.repeat(60));
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

// Exports
module.exports = {
  // Individual variants
  percentage,
  fixedAmount,
  freeShipping,
  bundle,
  tiered,
  
  // A/B testing helpers
  getRandomOffer,
  getBestOffer,
  
  // Performance tracking
  rateOffer,
  compareOffers,
  
  // Testing
  runTests
};
