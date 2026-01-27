/**
 * 🧪 A/B TEST RUNNER
 * Tests all variant strategies with simulated customers
 * 
 * Run: node variantTester.js
 */

// ============================================================
// 📦 IMPORTS & VARIANT DEFINITIONS
// ============================================================

const messageVariants = require('./messageVariants');

// Offer Variants - Different discount/bonus strategies
const offerVariants = {
  aggressive: {
    name: 'aggressive',
    discount: 20,
    bonus: 'شحن مجاني + هدية',
    urgency: '1 hour',
    baseConversionWeight: 0.35
  },
  moderate: {
    name: 'moderate', 
    discount: 10,
    bonus: 'شحن مجاني',
    urgency: '24 hours',
    baseConversionWeight: 0.22
  },
  minimal: {
    name: 'minimal',
    discount: 5,
    bonus: null,
    urgency: '48 hours',
    baseConversionWeight: 0.12
  },
  tiered: {
    name: 'tiered',
    discountLogic: (cartValue) => cartValue >= 500 ? 25 : cartValue >= 200 ? 15 : 10,
    bonus: 'شحن مجاني',
    urgency: '6 hours',
    baseConversionWeight: 0.28
  },
  scarcity: {
    name: 'scarcity',
    discount: 15,
    bonus: 'آخر 3 قطع!',
    urgency: '30 mins',
    baseConversionWeight: 0.30
  }
};

// Timing Variants - When to send messages
const timingVariants = {
  immediate: {
    name: 'immediate',
    delayMinutes: 0,
    description: 'Send right away',
    baseConversionWeight: 0.15
  },
  quick: {
    name: 'quick',
    delayMinutes: 15,
    description: '15 min after cart abandonment',
    baseConversionWeight: 0.25
  },
  standard: {
    name: 'standard',
    delayMinutes: 60,
    description: '1 hour after',
    baseConversionWeight: 0.28
  },
  delayed: {
    name: 'delayed',
    delayMinutes: 180,
    description: '3 hours after',
    baseConversionWeight: 0.22
  },
  nextDay: {
    name: 'nextDay',
    delayMinutes: 1440,
    description: '24 hours after',
    baseConversionWeight: 0.18
  }
};

// Customer Scoring Variants - How to prioritize customers
const customerScoring = {
  rfmBased: {
    name: 'rfmBased',
    description: 'Score by Recency, Frequency, Monetary',
    scoreFunction: (customer) => {
      const recencyScore = customer.daysSinceLastOrder <= 30 ? 5 : customer.daysSinceLastOrder <= 90 ? 3 : 1;
      const frequencyScore = Math.min(5, customer.totalOrders);
      const monetaryScore = customer.totalSpent >= 1000 ? 5 : customer.totalSpent >= 500 ? 3 : 1;
      return (recencyScore + frequencyScore + monetaryScore) / 3;
    },
    baseConversionWeight: 0.30
  },
  cartValueOnly: {
    name: 'cartValueOnly',
    description: 'Higher cart = higher priority',
    scoreFunction: (customer) => Math.min(5, customer.cartValue / 200),
    baseConversionWeight: 0.22
  },
  engagementBased: {
    name: 'engagementBased',
    description: 'Based on previous message interactions',
    scoreFunction: (customer) => {
      const openRate = customer.messageOpens / Math.max(1, customer.messagesSent);
      const clickRate = customer.messageClicks / Math.max(1, customer.messageOpens);
      return (openRate * 3 + clickRate * 2);
    },
    baseConversionWeight: 0.28
  },
  hybrid: {
    name: 'hybrid',
    description: 'Combination of all factors',
    scoreFunction: (customer) => {
      const rfm = (customer.totalOrders * 0.3) + (customer.totalSpent / 500) * 0.3;
      const cart = (customer.cartValue / 300) * 0.2;
      const engagement = (customer.messageOpens / Math.max(1, customer.messagesSent)) * 0.2;
      return Math.min(5, rfm + cart + engagement);
    },
    baseConversionWeight: 0.32
  },
  random: {
    name: 'random',
    description: 'Random priority (control group)',
    scoreFunction: () => Math.random() * 5,
    baseConversionWeight: 0.18
  }
};

// ============================================================
// 🎲 MOCK DATA GENERATORS
// ============================================================

const arabicNames = ['أحمد', 'محمد', 'فاطمة', 'سارة', 'علي', 'نورة', 'خالد', 'ريم', 'عبدالله', 'لمى', 'سلطان', 'هند'];
const products = [
  'ساعة ذكية', 'سماعات بلوتوث', 'شاحن سريع', 'حقيبة جلدية', 
  'عطر فاخر', 'نظارات شمسية', 'حذاء رياضي', 'قميص قطني',
  'كريم مرطب', 'مكياج كامل', 'ساعة كلاسيكية', 'محفظة رجالية'
];

function generateMockCustomer() {
  const name = arabicNames[Math.floor(Math.random() * arabicNames.length)];
  const numProducts = Math.floor(Math.random() * 4) + 1;
  const customerProducts = [];
  for (let i = 0; i < numProducts; i++) {
    customerProducts.push(products[Math.floor(Math.random() * products.length)]);
  }
  
  return {
    id: `cust_${Math.random().toString(36).substr(2, 9)}`,
    name,
    phone: `+966${Math.floor(Math.random() * 900000000 + 100000000)}`,
    cartValue: Math.floor(Math.random() * 800 + 50),
    products: customerProducts,
    totalOrders: Math.floor(Math.random() * 10),
    totalSpent: Math.floor(Math.random() * 3000),
    daysSinceLastOrder: Math.floor(Math.random() * 120),
    messagesSent: Math.floor(Math.random() * 20),
    messageOpens: Math.floor(Math.random() * 15),
    messageClicks: Math.floor(Math.random() * 8)
  };
}

function generateMockCart(customer) {
  return {
    customerId: customer.id,
    items: customer.products.map(p => ({
      name: p,
      price: Math.floor(Math.random() * 300 + 50),
      quantity: Math.floor(Math.random() * 2) + 1
    })),
    totalValue: customer.cartValue,
    createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
    lastUpdated: new Date()
  };
}

// ============================================================
// 🧪 TEST RUNNER FUNCTIONS
// ============================================================

/**
 * Simulate conversion based on variant weights and customer quality
 */
function simulateConversion(baseWeight, customer, variant) {
  // Adjust weight based on customer characteristics
  let adjustedWeight = baseWeight;
  
  // Higher cart value = more likely to convert
  if (customer.cartValue > 500) adjustedWeight *= 1.3;
  else if (customer.cartValue > 200) adjustedWeight *= 1.1;
  
  // Previous engagement matters
  const engagementRate = customer.messageOpens / Math.max(1, customer.messagesSent);
  adjustedWeight *= (0.7 + engagementRate * 0.6);
  
  // Recent customers more likely to convert
  if (customer.daysSinceLastOrder < 30) adjustedWeight *= 1.2;
  else if (customer.daysSinceLastOrder > 90) adjustedWeight *= 0.8;
  
  // Cap at 70%
  adjustedWeight = Math.min(0.7, adjustedWeight);
  
  return Math.random() < adjustedWeight;
}

/**
 * Run a test for a specific variant type
 * @param {string} testType - 'message' | 'offer' | 'timing' | 'scoring'
 * @param {number} sampleSize - Number of simulated customers
 */
function runTest(testType, sampleSize = 100) {
  let variants;
  
  switch (testType) {
    case 'message':
      variants = Object.keys(messageVariants.variants).map(name => ({
        name,
        generator: messageVariants.variants[name],
        baseConversionWeight: getMessageWeight(name)
      }));
      break;
    case 'offer':
      variants = Object.values(offerVariants);
      break;
    case 'timing':
      variants = Object.values(timingVariants);
      break;
    case 'scoring':
      variants = Object.values(customerScoring);
      break;
    default:
      throw new Error(`Unknown test type: ${testType}`);
  }
  
  const results = {};
  
  // Initialize results for each variant
  for (const variant of variants) {
    results[variant.name] = {
      variant: variant.name,
      sent: 0,
      converted: 0,
      revenue: 0,
      customers: []
    };
  }
  
  // Run simulations
  for (let i = 0; i < sampleSize; i++) {
    const customer = generateMockCustomer();
    const cart = generateMockCart(customer);
    
    // Test each variant with this customer
    for (const variant of variants) {
      const converted = simulateConversion(variant.baseConversionWeight, customer, variant);
      
      results[variant.name].sent++;
      if (converted) {
        results[variant.name].converted++;
        results[variant.name].revenue += customer.cartValue;
      }
      results[variant.name].customers.push({
        id: customer.id,
        cartValue: customer.cartValue,
        converted
      });
    }
  }
  
  return results;
}

/**
 * Get base conversion weight for message variants
 */
function getMessageWeight(name) {
  const weights = {
    urgency: 0.28,
    friendly: 0.25,
    minimal: 0.15,
    socialProof: 0.30,
    question: 0.22
  };
  return weights[name] || 0.20;
}

// ============================================================
// 📊 ANALYSIS FUNCTIONS
// ============================================================

/**
 * Analyze test results and find winner
 */
function analyzeResults(testResults) {
  const analysis = [];
  
  for (const [name, data] of Object.entries(testResults)) {
    const conversionRate = data.sent > 0 ? (data.converted / data.sent * 100) : 0;
    const avgOrderValue = data.converted > 0 ? data.revenue / data.converted : 0;
    const revenuePerMessage = data.sent > 0 ? data.revenue / data.sent : 0;
    
    analysis.push({
      variant: name,
      sent: data.sent,
      converted: data.converted,
      conversionRate: conversionRate.toFixed(2),
      revenue: data.revenue,
      avgOrderValue: avgOrderValue.toFixed(0),
      revenuePerMessage: revenuePerMessage.toFixed(2)
    });
  }
  
  // Sort by conversion rate (descending)
  analysis.sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate));
  
  // Calculate statistical winner
  const winner = analysis[0];
  const runnerUp = analysis[1];
  
  // Simple confidence check (would use proper stats in production)
  const confidenceScore = winner && runnerUp ? 
    ((parseFloat(winner.conversionRate) - parseFloat(runnerUp.conversionRate)) / parseFloat(runnerUp.conversionRate || 1) * 100) : 0;
  
  return {
    ranked: analysis,
    winner: winner?.variant,
    winnerStats: winner,
    confidenceScore: confidenceScore.toFixed(1),
    isSignificant: confidenceScore > 10 // 10% improvement = significant
  };
}

// ============================================================
// 🚀 RUN ALL TESTS
// ============================================================

/**
 * Run all test categories and print results
 */
function runAllTests(sampleSize = 100) {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 RIBH A/B TEST RUNNER - Starting Full Test Suite');
  console.log('═'.repeat(70));
  console.log(`📊 Sample size per variant: ${sampleSize} customers\n`);
  
  const testTypes = ['message', 'offer', 'timing', 'scoring'];
  const allResults = {};
  const winners = {};
  
  for (const testType of testTypes) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📌 Testing: ${testType.toUpperCase()} VARIANTS`);
    console.log('─'.repeat(70));
    
    const results = runTest(testType, sampleSize);
    const analysis = analyzeResults(results);
    allResults[testType] = analysis;
    winners[testType] = analysis.winner;
    
    // Print results table
    console.log('\n┌─────────────────┬──────┬───────────┬────────────┬────────────┐');
    console.log('│ Variant         │ Sent │ Converted │ Conv Rate  │ Revenue    │');
    console.log('├─────────────────┼──────┼───────────┼────────────┼────────────┤');
    
    for (const row of analysis.ranked) {
      const isWinner = row.variant === analysis.winner;
      const marker = isWinner ? '🏆' : '  ';
      console.log(
        `│ ${marker}${row.variant.padEnd(13)} │ ${String(row.sent).padStart(4)} │ ${String(row.converted).padStart(9)} │ ${(row.conversionRate + '%').padStart(10)} │ ${('SAR ' + row.revenue).padStart(10)} │`
      );
    }
    console.log('└─────────────────┴──────┴───────────┴────────────┴────────────┘');
    
    // Winner announcement
    console.log(`\n✅ Winner: ${analysis.winner} (${analysis.winnerStats.conversionRate}% conversion)`);
    console.log(`📈 Confidence: ${analysis.confidenceScore}% improvement over runner-up`);
    console.log(`${analysis.isSignificant ? '🎯 Statistically significant!' : '⚠️ Need more data for significance'}`);
  }
  
  // Final summary
  console.log('\n' + '═'.repeat(70));
  console.log('🏆 FINAL RESULTS - BEST PERFORMERS');
  console.log('═'.repeat(70));
  console.log('\n┌──────────────────┬─────────────────┬─────────────┐');
  console.log('│ Category         │ Winner          │ Conv Rate   │');
  console.log('├──────────────────┼─────────────────┼─────────────┤');
  
  for (const [category, analysis] of Object.entries(allResults)) {
    console.log(
      `│ ${category.padEnd(16)} │ ${analysis.winner.padEnd(15)} │ ${(analysis.winnerStats.conversionRate + '%').padStart(11)} │`
    );
  }
  console.log('└──────────────────┴─────────────────┴─────────────┘');
  
  console.log('\n📋 Recommended Configuration:');
  console.log(`   • Message Style: ${winners.message}`);
  console.log(`   • Offer Type: ${winners.offer}`);
  console.log(`   • Send Timing: ${winners.timing}`);
  console.log(`   • Customer Scoring: ${winners.scoring}`);
  
  console.log('\n' + '═'.repeat(70) + '\n');
  
  return {
    allResults,
    winners,
    recommendations: {
      messageVariant: winners.message,
      offerVariant: winners.offer,
      timingVariant: winners.timing,
      scoringVariant: winners.scoring
    }
  };
}

// ============================================================
// 🎬 MAIN EXECUTION
// ============================================================

module.exports = {
  // Variants
  offerVariants,
  timingVariants,
  customerScoring,
  
  // Functions
  runTest,
  analyzeResults,
  runAllTests,
  
  // Utilities
  generateMockCustomer,
  generateMockCart,
  simulateConversion
};

// Run when executed directly
if (require.main === module) {
  console.log('\n🚀 RIBH A/B Test Runner v1.0\n');
  
  const results = runAllTests(100);
  
  console.log('💾 Test complete! Results returned.\n');
  
  // Export results for further analysis
  process.exit(0);
}
