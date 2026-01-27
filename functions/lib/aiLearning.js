/**
 * 🧠 RIBH AI Learning Loop
 * AI improves offers based on A/B test results + pricing outcomes
 * 
 * Learn → Adapt → Optimize → Repeat
 */
const admin = require('firebase-admin');
const getDb = () => admin.firestore();

/**
 * Record A/B test result for learning
 */
async function recordABResult(storeId, testData) {
  const {
    testId,
    testType, // 'offer', 'message', 'timing', 'discount', 'product'
    variantA,
    variantB,
    winner, // 'A', 'B', 'tie'
    metrics, // { conversions, revenue, clickRate, etc }
    segment, // customer segment (optional)
    context  // additional context
  } = testData;
  
  const result = {
    testId,
    testType,
    variantA,
    variantB,
    winner,
    metrics,
    segment: segment || 'all',
    context: context || {},
    recordedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await getDb()
    .collection('stores').doc(storeId)
    .collection('abResults').add(result);
  
  // Update winning patterns
  await updateWinningPatterns(storeId, result);
  
  console.log(`[AI Learning] 📊 Recorded ${testType} test: ${winner} won`);
  return result;
}

/**
 * Update winning patterns database
 * This is what AI uses to make better decisions
 */
async function updateWinningPatterns(storeId, result) {
  const { testType, winner, variantA, variantB, segment, metrics } = result;
  
  const winningVariant = winner === 'A' ? variantA : winner === 'B' ? variantB : null;
  if (!winningVariant) return;
  
  const patternRef = getDb()
    .collection('stores').doc(storeId)
    .collection('winningPatterns').doc(testType);
  
  const doc = await patternRef.get();
  const existing = doc.exists ? doc.data() : { patterns: [], lastUpdated: null };
  
  // Add new winning pattern
  existing.patterns.push({
    pattern: winningVariant,
    segment,
    metrics,
    addedAt: new Date().toISOString()
  });
  
  // Keep only last 100 patterns per type
  if (existing.patterns.length > 100) {
    existing.patterns = existing.patterns.slice(-100);
  }
  
  existing.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
  
  await patternRef.set(existing);
}

/**
 * Get winning patterns for AI to use
 */
async function getWinningPatterns(storeId, testType, segment = 'all') {
  const doc = await getDb()
    .collection('stores').doc(storeId)
    .collection('winningPatterns').doc(testType)
    .get();
  
  if (!doc.exists) return { patterns: [], confidence: 'none' };
  
  const data = doc.data();
  
  // Filter by segment if specified
  let relevantPatterns = segment === 'all' 
    ? data.patterns 
    : data.patterns.filter(p => p.segment === segment || p.segment === 'all');
  
  // Sort by most recent
  relevantPatterns = relevantPatterns.slice(-20);
  
  return {
    patterns: relevantPatterns,
    count: relevantPatterns.length,
    confidence: relevantPatterns.length >= 10 ? 'high' : relevantPatterns.length >= 5 ? 'medium' : 'low'
  };
}

/**
 * Analyze what works for which segment
 */
async function analyzeWinningPatternsForSegment(storeId, segment) {
  const testTypes = ['offer', 'message', 'timing', 'discount', 'product'];
  const analysis = {};
  
  for (const type of testTypes) {
    const patterns = await getWinningPatterns(storeId, type, segment);
    
    if (patterns.count === 0) continue;
    
    // Aggregate common winning traits
    const traits = {};
    
    patterns.patterns.forEach(p => {
      const pattern = p.pattern;
      
      // Extract key traits based on type
      if (type === 'discount' && pattern.percentage) {
        const bucket = `${Math.floor(pattern.percentage / 5) * 5}-${Math.floor(pattern.percentage / 5) * 5 + 5}%`;
        traits[bucket] = (traits[bucket] || 0) + 1;
      }
      
      if (type === 'timing' && pattern.hour) {
        traits[`hour_${pattern.hour}`] = (traits[`hour_${pattern.hour}`] || 0) + 1;
      }
      
      if (type === 'message' && pattern.tone) {
        traits[pattern.tone] = (traits[pattern.tone] || 0) + 1;
      }
      
      if (type === 'offer' && pattern.offerType) {
        traits[pattern.offerType] = (traits[pattern.offerType] || 0) + 1;
      }
    });
    
    // Find most common winning trait
    const topTrait = Object.entries(traits).sort((a, b) => b[1] - a[1])[0];
    
    analysis[type] = {
      patternCount: patterns.count,
      confidence: patterns.confidence,
      topWinningTrait: topTrait ? { trait: topTrait[0], wins: topTrait[1] } : null,
      allTraits: traits
    };
  }
  
  return {
    segment,
    analysis,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Record pricing experiment result
 */
async function recordPricingResult(storeId, pricingData) {
  const {
    productId,
    oldPrice,
    newPrice,
    strategy, // 'match_lowest', 'beat_by_percent', 'maximize_margin', 'premium'
    durationDays,
    salesBefore,
    salesAfter,
    revenueBefore,
    revenueAfter
  } = pricingData;
  
  const changePercent = ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
  const salesChange = salesAfter - salesBefore;
  const revenueChange = revenueAfter - revenueBefore;
  
  const result = {
    productId,
    oldPrice,
    newPrice,
    changePercent: parseFloat(changePercent),
    strategy,
    durationDays,
    salesBefore,
    salesAfter,
    salesChange,
    salesChangePercent: salesBefore > 0 ? ((salesChange / salesBefore) * 100).toFixed(1) : 0,
    revenueBefore,
    revenueAfter,
    revenueChange,
    revenueChangePercent: revenueBefore > 0 ? ((revenueChange / revenueBefore) * 100).toFixed(1) : 0,
    success: revenueAfter > revenueBefore, // Did we make more money?
    recordedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  await getDb()
    .collection('stores').doc(storeId)
    .collection('pricingResults').add(result);
  
  // Update pricing strategy learnings
  await updatePricingLearnings(storeId, result);
  
  console.log(`[AI Learning] 💰 Pricing result: ${result.success ? '✅' : '❌'} ${changePercent}% → ${result.revenueChangePercent}% revenue`);
  return result;
}

/**
 * Update pricing strategy learnings
 */
async function updatePricingLearnings(storeId, result) {
  const ref = getDb()
    .collection('stores').doc(storeId)
    .collection('pricingLearnings').doc(result.strategy);
  
  const doc = await ref.get();
  const data = doc.exists ? doc.data() : { 
    successes: 0, 
    failures: 0, 
    avgRevenueChange: 0,
    results: []
  };
  
  if (result.success) {
    data.successes++;
  } else {
    data.failures++;
  }
  
  // Rolling average
  const totalResults = data.successes + data.failures;
  data.avgRevenueChange = (
    (data.avgRevenueChange * (totalResults - 1) + parseFloat(result.revenueChangePercent)) 
    / totalResults
  ).toFixed(2);
  
  data.successRate = ((data.successes / totalResults) * 100).toFixed(1);
  data.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
  
  // Keep last 50 results for context
  data.results.push({
    changePercent: result.changePercent,
    revenueChange: result.revenueChangePercent,
    success: result.success,
    date: new Date().toISOString()
  });
  if (data.results.length > 50) data.results = data.results.slice(-50);
  
  await ref.set(data);
}

/**
 * Get best pricing strategy based on learnings
 */
async function getBestPricingStrategy(storeId) {
  const strategies = ['match_lowest', 'beat_by_percent', 'maximize_margin', 'premium'];
  const results = [];
  
  for (const strategy of strategies) {
    const doc = await getDb()
      .collection('stores').doc(storeId)
      .collection('pricingLearnings').doc(strategy)
      .get();
    
    if (doc.exists) {
      results.push({ strategy, ...doc.data() });
    }
  }
  
  if (results.length === 0) {
    return { recommendation: 'maximize_margin', confidence: 'none', reason: 'No data yet' };
  }
  
  // Sort by success rate, then revenue change
  results.sort((a, b) => {
    const scoreA = parseFloat(a.successRate || 0) * 0.6 + parseFloat(a.avgRevenueChange || 0) * 0.4;
    const scoreB = parseFloat(b.successRate || 0) * 0.6 + parseFloat(b.avgRevenueChange || 0) * 0.4;
    return scoreB - scoreA;
  });
  
  const best = results[0];
  const totalTests = best.successes + best.failures;
  
  return {
    recommendation: best.strategy,
    confidence: totalTests >= 20 ? 'high' : totalTests >= 10 ? 'medium' : 'low',
    successRate: best.successRate,
    avgRevenueChange: best.avgRevenueChange,
    totalTests,
    allStrategies: results
  };
}

/**
 * Generate AI insights from all learnings
 */
async function getAIInsights(storeId) {
  const [abResults, pricingStrategy, segments] = await Promise.all([
    getDb().collection('stores').doc(storeId).collection('abResults')
      .orderBy('recordedAt', 'desc').limit(50).get(),
    getBestPricingStrategy(storeId),
    getDb().collection('stores').doc(storeId).collection('winningPatterns').get()
  ]);
  
  const insights = {
    totalABTests: abResults.size,
    bestPricingStrategy: pricingStrategy,
    patternCategories: segments.docs.map(d => d.id),
    recommendations: [],
    generatedAt: new Date().toISOString()
  };
  
  // Generate recommendations
  if (pricingStrategy.confidence !== 'none') {
    insights.recommendations.push({
      type: 'pricing',
      ar: `استراتيجية التسعير الأفضل: ${pricingStrategy.recommendation} (${pricingStrategy.successRate}% نجاح)`,
      en: `Best pricing strategy: ${pricingStrategy.recommendation} (${pricingStrategy.successRate}% success rate)`,
      confidence: pricingStrategy.confidence
    });
  }
  
  // Check for segment-specific insights
  for (const segmentKey of ['champions', 'at_risk', 'new_customers']) {
    const segmentAnalysis = await analyzeWinningPatternsForSegment(storeId, segmentKey);
    
    if (segmentAnalysis.analysis.discount?.topWinningTrait) {
      insights.recommendations.push({
        type: 'discount',
        segment: segmentKey,
        ar: `أفضل خصم لـ ${segmentKey}: ${segmentAnalysis.analysis.discount.topWinningTrait.trait}`,
        en: `Best discount for ${segmentKey}: ${segmentAnalysis.analysis.discount.topWinningTrait.trait}`,
        confidence: segmentAnalysis.analysis.discount.confidence
      });
    }
  }
  
  return insights;
}

/**
 * Get offer weights for AI (which offers to prioritize)
 */
async function getOfferWeights(storeId, segment = 'all') {
  const patterns = await getWinningPatterns(storeId, 'offer', segment);
  
  const weights = {
    upsell: 1.0,
    downsell: 1.0,
    bundle: 1.0,
    discount: 1.0,
    freeShipping: 1.0,
    loyalty: 1.0
  };
  
  // Adjust weights based on winning patterns
  patterns.patterns.forEach(p => {
    if (p.pattern.offerType && weights[p.pattern.offerType] !== undefined) {
      // Each win increases weight by 0.1
      weights[p.pattern.offerType] += 0.1;
    }
  });
  
  // Normalize to max 2.0
  Object.keys(weights).forEach(k => {
    weights[k] = Math.min(2.0, weights[k]);
  });
  
  return {
    weights,
    segment,
    basedOnTests: patterns.count,
    confidence: patterns.confidence
  };
}

/**
 * Update offer weights manually (admin override)
 */
async function updateOfferWeights(storeId, weights) {
  await getDb()
    .collection('stores').doc(storeId)
    .update({
      'aiConfig.offerWeights': weights,
      'aiConfig.lastUpdated': admin.firestore.FieldValue.serverTimestamp()
    });
  
  return { success: true, weights };
}

module.exports = {
  recordABResult,
  getWinningPatterns,
  analyzeWinningPatternsForSegment,
  recordPricingResult,
  getBestPricingStrategy,
  getAIInsights,
  getOfferWeights,
  updateOfferWeights
};
