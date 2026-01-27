/**
 * PRICING ENGINE - Competitor Monitoring & Dynamic Pricing
 * Scrapes competitor prices, analyzes, auto-adjusts for max profit
 * 
 * 🧠 AI Learning Integration: Pricing strategies feed into learning loop
 */
const admin = require('firebase-admin');
const { sallaApi } = require('./sallaApp');
const { recordPricingResult, getBestPricingStrategy } = require('./aiLearning');
const getDb = () => admin.firestore();

const PRICE_PATTERNS = [
  /[\u0633\u0639\u0631|price|سعر][:\s]*[\$\u00A5\uFDFC\u20AC]?\s*([\d,.]+)/i,
  /"price":\s*"?([\d,.]+)"?/i, /data-price="([\d,.]+)"/i,
  /class="[^"]*price[^"]*"[^>]*>([\$\u00A5\uFDFC\u20AC]?\s*[\d,.]+)/gi,
  /([\d,]+(?:\.\d{2})?)\s*(?:ر\.س|SAR|ريال|SR)/i, /\$\s*([\d,]+(?:\.\d{2})?)/
];

/** Add competitor to track */
async function addCompetitor(storeId, productId, url, name = '') {
  const ref = getDb().collection('stores').doc(storeId).collection('competitors').doc();
  await ref.set({ productId, url, name: name || new URL(url).hostname,
    createdAt: admin.firestore.FieldValue.serverTimestamp(), lastPrice: null, status: 'active' });
  return ref.id;
}

const removeCompetitor = (storeId, id) => 
  getDb().collection('stores').doc(storeId).collection('competitors').doc(id).delete();

/** Scrape price from URL (fast: fetch + regex) */
async function scrapePrice(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0', 'Accept-Language': 'ar,en' }
    });
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
    const html = await res.text();
    
    for (const pattern of PRICE_PATTERNS) {
      const match = html.match(pattern);
      if (match) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (price > 0 && price < 1000000) return { success: true, price, url };
      }
    }
    // Fallback: SAR/$ numbers
    const nums = html.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:ر\.س|SAR|ريال|\$|€)/g);
    if (nums?.length) {
      const price = parseFloat(nums[0].replace(/[^\d.]/g, ''));
      if (price > 0) return { success: true, price, url };
    }
    return { success: false, error: 'No price found' };
  } catch (e) { return { success: false, error: e.message }; }
}

/** Scrape all competitors for a product */
async function scrapeCompetitors(storeId, productId) {
  const snap = await getDb().collection('stores').doc(storeId)
    .collection('competitors').where('productId', '==', productId).get();
  const results = [];
  for (const doc of snap.docs) {
    const c = doc.data(), result = await scrapePrice(c.url);
    await doc.ref.update({ lastPrice: result.price || null, 
      lastScraped: admin.firestore.FieldValue.serverTimestamp(), lastError: result.error || null });
    results.push({ id: doc.id, name: c.name, ...result });
  }
  return results;
}

/** Analyze pricing and suggest optimal price */
async function analyzePricing(storeId, productId, myPrice, myCost = 0) {
  const competitors = await scrapeCompetitors(storeId, productId);
  const prices = competitors.filter(c => c.success).map(c => c.price);
  if (!prices.length) return { suggestion: null, reason: 'No competitor prices', competitors };
  
  const [lowest, highest, avg] = [Math.min(...prices), Math.max(...prices), 
    prices.reduce((a, b) => a + b, 0) / prices.length];
  const analysis = {
    myPrice, myCost, margin: myCost ? ((myPrice - myCost) / myPrice * 100).toFixed(1) : null,
    competitors: { count: prices.length, lowest, highest, average: +avg.toFixed(2) },
    position: myPrice < lowest ? 'cheapest' : myPrice > highest ? 'most_expensive' : 'competitive',
    suggestions: { match_lowest: lowest, beat_by_5: +(lowest * 0.95).toFixed(2),
      maximize_margin: +(myCost ? Math.max(myCost * 1.3, avg) : avg).toFixed(2),
      premium: +(highest * 1.05).toFixed(2) },
    competitorDetails: competitors
  };
  await getDb().collection('stores').doc(storeId).collection('pricingAnalysis').doc(productId)
    .set({ ...analysis, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return analysis;
}

/** Auto-adjust price based on strategy 
 * 🧠 Uses AI-recommended strategy if none specified
 */
async function autoAdjustPrice(storeId, productId, strategy = null, opts = {}) {
  const store = (await getDb().collection('stores').doc(storeId).get()).data();
  if (!store) throw new Error('Store not found');
  
  // 🧠 Get AI-recommended strategy if none provided
  let aiRecommendation = null;
  if (!strategy) {
    try {
      aiRecommendation = await getBestPricingStrategy(storeId);
      strategy = aiRecommendation.recommendation;
      console.log(`[Pricing] 🧠 Using AI strategy: ${strategy} (confidence: ${aiRecommendation.confidence})`);
    } catch (e) {
      strategy = 'match_lowest'; // fallback
      console.log('[Pricing] No AI recommendation, using match_lowest');
    }
  }
  
  let currentPrice;
  if (store.platform === 'salla') {
    const res = await sallaApi(store.merchantId, `/products/${productId}`);
    currentPrice = parseFloat(res.data.price?.amount || res.data.price);
  } else throw new Error('Platform not supported');
  
  const cost = opts.cost || store.productCosts?.[productId] || 0;
  const { competitors: c, suggestions } = await analyzePricing(storeId, productId, currentPrice, cost);
  
  let newPrice = { match_lowest: c.lowest, beat_by_percent: c.lowest * (1 - (opts.percent || 5) / 100),
    maximize_margin: cost ? Math.max(cost * 1.25, c.average * 0.95) : c.average,
    premium: c.highest * (opts.premium || 1.05) }[strategy] || currentPrice;
  
  if (cost && newPrice < cost * 1.1) newPrice = cost * 1.1;
  newPrice = Math.round(newPrice * 100) / 100;
  
  const changeId = `${productId}_${Date.now()}`;
  
  if (Math.abs(newPrice - currentPrice) > 0.01) {
    if (store.platform === 'salla') {
      await sallaApi(store.merchantId, `/products/${productId}`, {
        method: 'PUT', body: JSON.stringify({ price: newPrice })
      });
    }
    await getDb().collection('stores').doc(storeId).collection('priceChanges').add({
      changeId, productId, oldPrice: currentPrice, newPrice, strategy,
      aiRecommended: !!aiRecommendation,
      aiConfidence: aiRecommendation?.confidence || 'manual',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      // 🧠 Track for later AI learning evaluation
      pendingEvaluation: true,
      evaluateAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });
    console.log(`[Pricing] 💰 ${productId}: ${currentPrice} → ${newPrice} (${strategy})`);
  }
  return { productId, oldPrice: currentPrice, newPrice, strategy, changed: newPrice !== currentPrice, 
    changeId, aiRecommended: !!aiRecommendation };
}

/** Get pricing report for dashboard */
async function getPricingReport(storeId) {
  const [analysis, changes, comps] = await Promise.all([
    getDb().collection('stores').doc(storeId).collection('pricingAnalysis').get(),
    getDb().collection('stores').doc(storeId).collection('priceChanges')
      .orderBy('timestamp', 'desc').limit(50).get(),
    getDb().collection('stores').doc(storeId).collection('competitors').get()
  ]);
  
  const products = analysis.docs.map(d => ({ productId: d.id, ...d.data() }));
  const opportunities = products.filter(p => p.position === 'most_expensive' || 
    p.myPrice > p.competitors?.average * 1.15);
  
  return {
    summary: { productsTracked: products.length, competitorsMonitored: comps.size,
      priceChanges: changes.size, opportunities: opportunities.length },
    opportunities, products, recentChanges: changes.docs.slice(0, 10).map(d => d.data()),
    competitors: comps.docs.map(d => ({ id: d.id, ...d.data() }))
  };
}

/** Daily bulk scrape all competitors */
async function dailyScrapeAll(storeId) {
  const snap = await getDb().collection('stores').doc(storeId)
    .collection('competitors').where('status', '==', 'active').get();
  const results = [];
  for (const doc of snap.docs) {
    const c = doc.data(), result = await scrapePrice(c.url);
    await doc.ref.update({ lastPrice: result.price || null, 
      lastScraped: admin.firestore.FieldValue.serverTimestamp() });
    results.push({ productId: c.productId, competitor: c.name, ...result });
  }
  console.log(`[Pricing] 📊 Daily scrape: ${results.length} competitors`);
  return results;
}

/**
 * 🧠 Evaluate pending pricing changes and record results to AI learning
 * Run this periodically (e.g., daily cron) to feed learning loop
 */
async function evaluatePricingResults(storeId) {
  const now = new Date();
  const pendingSnap = await getDb()
    .collection('stores').doc(storeId)
    .collection('priceChanges')
    .where('pendingEvaluation', '==', true)
    .where('evaluateAfter', '<=', now)
    .get();
  
  if (pendingSnap.empty) {
    console.log('[Pricing] 🧠 No pending evaluations');
    return { evaluated: 0 };
  }
  
  const results = [];
  
  for (const doc of pendingSnap.docs) {
    const change = doc.data();
    const { productId, oldPrice, newPrice, strategy, timestamp } = change;
    
    try {
      // Get sales data for the period
      const changeDate = timestamp.toDate();
      const durationDays = Math.round((now - changeDate) / (1000 * 60 * 60 * 24));
      
      // Get sales before and after (from orders collection)
      const beforeStart = new Date(changeDate.getTime() - durationDays * 24 * 60 * 60 * 1000);
      
      const [beforeSnap, afterSnap] = await Promise.all([
        getDb().collection('stores').doc(storeId).collection('orders')
          .where('createdAt', '>=', beforeStart)
          .where('createdAt', '<', changeDate)
          .get(),
        getDb().collection('stores').doc(storeId).collection('orders')
          .where('createdAt', '>=', changeDate)
          .where('createdAt', '<=', now)
          .get()
      ]);
      
      // Calculate metrics (filter to this product)
      const beforeOrders = beforeSnap.docs.filter(d => 
        d.data().items?.some(i => i.productId === productId));
      const afterOrders = afterSnap.docs.filter(d => 
        d.data().items?.some(i => i.productId === productId));
      
      const salesBefore = beforeOrders.length;
      const salesAfter = afterOrders.length;
      const revenueBefore = beforeOrders.reduce((sum, d) => 
        sum + (d.data().items?.find(i => i.productId === productId)?.total || 0), 0);
      const revenueAfter = afterOrders.reduce((sum, d) => 
        sum + (d.data().items?.find(i => i.productId === productId)?.total || 0), 0);
      
      // Record to AI learning
      await recordPricingResult(storeId, {
        productId,
        oldPrice,
        newPrice,
        strategy,
        durationDays,
        salesBefore,
        salesAfter,
        revenueBefore,
        revenueAfter
      });
      
      // Mark as evaluated
      await doc.ref.update({
        pendingEvaluation: false,
        evaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
        evaluationResult: {
          salesBefore, salesAfter, revenueBefore, revenueAfter,
          success: revenueAfter > revenueBefore
        }
      });
      
      results.push({ productId, strategy, success: revenueAfter > revenueBefore });
      console.log(`[Pricing] 🧠 Evaluated ${productId}: ${revenueAfter > revenueBefore ? '✅' : '❌'}`);
      
    } catch (e) {
      console.error(`[Pricing] Failed to evaluate ${productId}:`, e.message);
    }
  }
  
  console.log(`[Pricing] 🧠 Evaluated ${results.length} pricing changes`);
  return { evaluated: results.length, results };
}

/**
 * 🧠 Get AI-recommended strategy for a product (convenience wrapper)
 */
async function getRecommendedStrategy(storeId) {
  return getBestPricingStrategy(storeId);
}

module.exports = { addCompetitor, removeCompetitor, scrapePrice, scrapeCompetitors,
  analyzePricing, autoAdjustPrice, getPricingReport, dailyScrapeAll,
  evaluatePricingResults, getRecommendedStrategy };
