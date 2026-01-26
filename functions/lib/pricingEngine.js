/**
 * PRICING ENGINE - Competitor Monitoring & Dynamic Pricing
 * Scrapes competitor prices, analyzes, auto-adjusts for max profit
 */
const admin = require('firebase-admin');
const { sallaApi } = require('./sallaApp');
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

/** Auto-adjust price based on strategy */
async function autoAdjustPrice(storeId, productId, strategy = 'match_lowest', opts = {}) {
  const store = (await getDb().collection('stores').doc(storeId).get()).data();
  if (!store) throw new Error('Store not found');
  
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
  
  if (Math.abs(newPrice - currentPrice) > 0.01) {
    if (store.platform === 'salla') {
      await sallaApi(store.merchantId, `/products/${productId}`, {
        method: 'PUT', body: JSON.stringify({ price: newPrice })
      });
    }
    await getDb().collection('stores').doc(storeId).collection('priceChanges').add({
      productId, oldPrice: currentPrice, newPrice, strategy,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[Pricing] 💰 ${productId}: ${currentPrice} → ${newPrice} (${strategy})`);
  }
  return { productId, oldPrice: currentPrice, newPrice, strategy, changed: newPrice !== currentPrice };
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

module.exports = { addCompetitor, removeCompetitor, scrapePrice, scrapeCompetitors,
  analyzePricing, autoAdjustPrice, getPricingReport, dailyScrapeAll };
