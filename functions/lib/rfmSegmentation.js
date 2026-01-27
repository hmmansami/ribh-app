/**
 * 📊 RIBH RFM Segmentation Engine
 * Automatically segments customers like Klaviyo
 * 
 * RFM = Recency, Frequency, Monetary
 * Each scored 1-5, combined into segments
 */
const admin = require('firebase-admin');
const { getHistoricCLV, calculateChurnRisk } = require('./predictiveAnalytics');
const getDb = () => admin.firestore();

/**
 * RFM Segment Definitions
 * Based on Klaviyo's proven segmentation model
 */
const RFM_SEGMENTS = {
  // High Value (R:4-5, F:4-5, M:4-5)
  'champions': {
    name: 'Champions',
    nameAr: 'الأبطال',
    description: 'Best customers. Bought recently, buy often, spend most.',
    action: 'Reward them! Ask for reviews & referrals.',
    actionAr: 'كافئهم! اطلب تقييمات وإحالات.',
    color: '#10B981', // green
    rules: { R: [4, 5], F: [4, 5], M: [4, 5] }
  },
  
  'loyal': {
    name: 'Loyal Customers',
    nameAr: 'العملاء المخلصون',
    description: 'Spend good money, buy frequently.',
    action: 'Upsell higher value products. Offer loyalty rewards.',
    actionAr: 'قدم منتجات أعلى قيمة. عروض ولاء.',
    color: '#3B82F6', // blue
    rules: { R: [3, 5], F: [3, 5], M: [3, 5] }
  },
  
  // Medium Value
  'potential_loyalist': {
    name: 'Potential Loyalists',
    nameAr: 'مخلصون محتملون',
    description: 'Recent customers with average frequency.',
    action: 'Offer membership/loyalty program. Recommend products.',
    actionAr: 'قدم برنامج ولاء. اقترح منتجات.',
    color: '#8B5CF6', // purple
    rules: { R: [4, 5], F: [2, 4], M: [2, 4] }
  },
  
  'new_customers': {
    name: 'New Customers',
    nameAr: 'عملاء جدد',
    description: 'Bought recently, first-time or few orders.',
    action: 'Welcome sequence. Guide to second purchase.',
    actionAr: 'رسائل ترحيب. شجع الشراء الثاني.',
    color: '#06B6D4', // cyan
    rules: { R: [4, 5], F: [1, 2], M: [1, 5] }
  },
  
  'promising': {
    name: 'Promising',
    nameAr: 'واعدون',
    description: 'Recent shoppers, haven\'t spent much yet.',
    action: 'Create brand awareness. Free trials.',
    actionAr: 'عزز الوعي بالعلامة. عينات مجانية.',
    color: '#F59E0B', // amber
    rules: { R: [3, 4], F: [1, 2], M: [1, 3] }
  },
  
  // At Risk
  'need_attention': {
    name: 'Need Attention',
    nameAr: 'يحتاجون اهتمام',
    description: 'Above average recency, frequency & monetary.',
    action: 'Reactivation offers. Limited time deals.',
    actionAr: 'عروض إعادة تنشيط. خصومات محدودة.',
    color: '#EAB308', // yellow
    rules: { R: [2, 3], F: [2, 4], M: [2, 4] }
  },
  
  'about_to_sleep': {
    name: 'About to Sleep',
    nameAr: 'على وشك الخمول',
    description: 'Below average recency. Will lose them.',
    action: 'Win them back! Personal offers.',
    actionAr: 'استعدهم! عروض شخصية.',
    color: '#F97316', // orange
    rules: { R: [2, 3], F: [1, 3], M: [1, 3] }
  },
  
  // Low Value / Churned
  'at_risk': {
    name: 'At Risk',
    nameAr: 'معرضون للخسارة',
    description: 'Spent big money, but long time ago.',
    action: 'Send personal emails. Offer renewals.',
    actionAr: 'رسائل شخصية. عروض تجديد.',
    color: '#EF4444', // red
    rules: { R: [1, 2], F: [2, 5], M: [2, 5] }
  },
  
  'cant_lose_them': {
    name: 'Can\'t Lose Them',
    nameAr: 'لا يمكن خسارتهم',
    description: 'Made big purchases, but haven\'t returned.',
    action: 'Win back! Talk to them. Don\'t lose to competition.',
    actionAr: 'استعدهم! تواصل معهم.',
    color: '#DC2626', // red-600
    rules: { R: [1, 2], F: [3, 5], M: [4, 5] }
  },
  
  'hibernating': {
    name: 'Hibernating',
    nameAr: 'خاملون',
    description: 'Low recency, frequency, and monetary.',
    action: 'Offer relevant products. Deep discounts.',
    actionAr: 'منتجات ذات صلة. خصومات كبيرة.',
    color: '#6B7280', // gray
    rules: { R: [1, 2], F: [1, 2], M: [1, 3] }
  },
  
  'lost': {
    name: 'Lost',
    nameAr: 'مفقودون',
    description: 'Lowest recency, frequency, and monetary.',
    action: 'Revive with very strong offers, or focus elsewhere.',
    actionAr: 'عروض قوية جداً أو ركز على غيرهم.',
    color: '#374151', // gray-700
    rules: { R: [1, 1], F: [1, 2], M: [1, 2] }
  }
};

/**
 * Calculate RFM scores for a customer
 * Each dimension: 1 (worst) to 5 (best)
 */
async function calculateRFMScores(storeId, customerId, storeStats = null) {
  // Get customer's order data
  const { historicCLV, orderCount, orderDates } = await getHistoricCLV(storeId, customerId);
  
  if (orderCount === 0) {
    return { R: 0, F: 0, M: 0, segment: 'never_purchased' };
  }
  
  // Get store-wide stats for percentile calculation (or use defaults)
  const stats = storeStats || await getStoreStats(storeId);
  
  // RECENCY: Days since last order (lower = better)
  const daysSinceLastOrder = Math.floor(
    (Date.now() - Math.max(...orderDates)) / (1000 * 60 * 60 * 24)
  );
  
  // FREQUENCY: Number of orders
  const frequency = orderCount;
  
  // MONETARY: Total spend
  const monetary = historicCLV;
  
  // Convert to 1-5 scores based on store percentiles
  const R = scoreRecency(daysSinceLastOrder, stats.recencyPercentiles);
  const F = scoreFrequency(frequency, stats.frequencyPercentiles);
  const M = scoreMonetary(monetary, stats.monetaryPercentiles);
  
  return { R, F, M, daysSinceLastOrder, frequency, monetary };
}

/**
 * Score recency (days since order) - lower days = higher score
 */
function scoreRecency(days, percentiles = { p20: 30, p40: 60, p60: 120, p80: 240 }) {
  if (days <= percentiles.p20) return 5;
  if (days <= percentiles.p40) return 4;
  if (days <= percentiles.p60) return 3;
  if (days <= percentiles.p80) return 2;
  return 1;
}

/**
 * Score frequency (order count) - higher = higher score
 */
function scoreFrequency(count, percentiles = { p20: 1, p40: 2, p60: 3, p80: 5 }) {
  if (count >= percentiles.p80) return 5;
  if (count >= percentiles.p60) return 4;
  if (count >= percentiles.p40) return 3;
  if (count >= percentiles.p20) return 2;
  return 1;
}

/**
 * Score monetary (total spend) - higher = higher score
 */
function scoreMonetary(amount, percentiles = { p20: 100, p40: 300, p60: 600, p80: 1200 }) {
  if (amount >= percentiles.p80) return 5;
  if (amount >= percentiles.p60) return 4;
  if (amount >= percentiles.p40) return 3;
  if (amount >= percentiles.p20) return 2;
  return 1;
}

/**
 * Determine segment from RFM scores
 */
function getSegmentFromRFM(R, F, M) {
  // Check each segment's rules
  for (const [key, segment] of Object.entries(RFM_SEGMENTS)) {
    const { rules } = segment;
    
    if (
      R >= rules.R[0] && R <= rules.R[1] &&
      F >= rules.F[0] && F <= rules.F[1] &&
      M >= rules.M[0] && M <= rules.M[1]
    ) {
      return {
        key,
        ...segment,
        rfmScore: `${R}${F}${M}`
      };
    }
  }
  
  // Fallback based on combined score
  const total = R + F + M;
  if (total >= 12) return { key: 'loyal', ...RFM_SEGMENTS.loyal };
  if (total >= 9) return { key: 'need_attention', ...RFM_SEGMENTS.need_attention };
  if (total >= 6) return { key: 'about_to_sleep', ...RFM_SEGMENTS.about_to_sleep };
  return { key: 'lost', ...RFM_SEGMENTS.lost };
}

/**
 * Get store-wide statistics for percentile calculation
 */
async function getStoreStats(storeId) {
  const ordersSnap = await getDb()
    .collection('stores').doc(storeId)
    .collection('orders')
    .where('status', 'not-in', ['cancelled', 'refunded'])
    .get();
  
  // Aggregate customer stats
  const customerStats = {};
  
  ordersSnap.forEach(doc => {
    const order = doc.data();
    const customerId = order.customerId;
    if (!customerId) return;
    
    if (!customerStats[customerId]) {
      customerStats[customerId] = { orders: 0, total: 0, lastOrder: null };
    }
    
    customerStats[customerId].orders++;
    customerStats[customerId].total += parseFloat(order.total || 0);
    
    const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
    if (!customerStats[customerId].lastOrder || orderDate > customerStats[customerId].lastOrder) {
      customerStats[customerId].lastOrder = orderDate;
    }
  });
  
  const customers = Object.values(customerStats);
  if (customers.length === 0) {
    // Return sensible defaults
    return {
      recencyPercentiles: { p20: 30, p40: 60, p60: 120, p80: 240 },
      frequencyPercentiles: { p20: 1, p40: 2, p60: 3, p80: 5 },
      monetaryPercentiles: { p20: 100, p40: 300, p60: 600, p80: 1200 }
    };
  }
  
  // Calculate days since last order
  const now = Date.now();
  const recencies = customers.map(c => 
    Math.floor((now - c.lastOrder) / (1000 * 60 * 60 * 24))
  ).sort((a, b) => a - b);
  
  const frequencies = customers.map(c => c.orders).sort((a, b) => a - b);
  const monetaries = customers.map(c => c.total).sort((a, b) => a - b);
  
  // Get percentiles
  const getPercentile = (arr, p) => arr[Math.floor(arr.length * p / 100)] || arr[arr.length - 1];
  
  return {
    customerCount: customers.length,
    recencyPercentiles: {
      p20: getPercentile(recencies, 20),
      p40: getPercentile(recencies, 40),
      p60: getPercentile(recencies, 60),
      p80: getPercentile(recencies, 80)
    },
    frequencyPercentiles: {
      p20: getPercentile(frequencies, 20),
      p40: getPercentile(frequencies, 40),
      p60: getPercentile(frequencies, 60),
      p80: getPercentile(frequencies, 80)
    },
    monetaryPercentiles: {
      p20: getPercentile(monetaries, 20),
      p40: getPercentile(monetaries, 40),
      p60: getPercentile(monetaries, 60),
      p80: getPercentile(monetaries, 80)
    }
  };
}

/**
 * Segment a single customer and save
 */
async function segmentCustomer(storeId, customerId, storeStats = null) {
  const scores = await calculateRFMScores(storeId, customerId, storeStats);
  
  if (scores.segment === 'never_purchased') {
    return { customerId, segment: 'never_purchased' };
  }
  
  const segment = getSegmentFromRFM(scores.R, scores.F, scores.M);
  
  const result = {
    customerId,
    rfmScores: { R: scores.R, F: scores.F, M: scores.M },
    rfmRaw: {
      daysSinceLastOrder: scores.daysSinceLastOrder,
      orderCount: scores.frequency,
      totalSpend: scores.monetary
    },
    segment: segment.key,
    segmentName: segment.name,
    segmentNameAr: segment.nameAr,
    segmentColor: segment.color,
    recommendedAction: segment.action,
    recommendedActionAr: segment.actionAr,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Save to Firestore
  await getDb()
    .collection('stores').doc(storeId)
    .collection('customerSegments').doc(customerId)
    .set(result, { merge: true });
  
  return result;
}

/**
 * Run daily segmentation for all customers
 */
async function runDailySegmentation(storeId) {
  console.log(`[RFM] Starting daily segmentation for store ${storeId}`);
  
  // Get store stats first (once, for efficiency)
  const storeStats = await getStoreStats(storeId);
  
  // Get all customers
  const customers = await getDb()
    .collection('stores').doc(storeId)
    .collection('customers')
    .get();
  
  const results = { total: 0, bySegment: {} };
  
  for (const doc of customers.docs) {
    try {
      const result = await segmentCustomer(storeId, doc.id, storeStats);
      results.total++;
      
      if (result.segment) {
        results.bySegment[result.segment] = (results.bySegment[result.segment] || 0) + 1;
      }
    } catch (e) {
      console.error(`[RFM] Error segmenting ${doc.id}:`, e.message);
    }
  }
  
  // Save segment summary
  await getDb().collection('stores').doc(storeId).update({
    rfmLastRun: admin.firestore.FieldValue.serverTimestamp(),
    rfmSummary: results.bySegment,
    rfmCustomerCount: results.total
  });
  
  console.log(`[RFM] Completed: ${results.total} customers segmented`);
  return results;
}

/**
 * Get segment dashboard data
 */
async function getSegmentDashboard(storeId) {
  const segments = await getDb()
    .collection('stores').doc(storeId)
    .collection('customerSegments')
    .get();
  
  const dashboard = {
    totalCustomers: segments.size,
    segments: {},
    topSegments: []
  };
  
  // Count by segment
  segments.forEach(doc => {
    const data = doc.data();
    const seg = data.segment || 'unknown';
    
    if (!dashboard.segments[seg]) {
      dashboard.segments[seg] = {
        count: 0,
        totalCLV: 0,
        name: data.segmentName || seg,
        nameAr: data.segmentNameAr,
        color: data.segmentColor,
        action: data.recommendedAction,
        actionAr: data.recommendedActionAr
      };
    }
    
    dashboard.segments[seg].count++;
    dashboard.segments[seg].totalCLV += data.rfmRaw?.totalSpend || 0;
  });
  
  // Sort by count
  dashboard.topSegments = Object.entries(dashboard.segments)
    .map(([key, data]) => ({ key, ...data }))
    .sort((a, b) => b.count - a.count);
  
  return dashboard;
}

/**
 * Get customers in a specific segment
 */
async function getCustomersInSegment(storeId, segmentKey, limit = 100) {
  const customers = await getDb()
    .collection('stores').doc(storeId)
    .collection('customerSegments')
    .where('segment', '==', segmentKey)
    .limit(limit)
    .get();
  
  return customers.docs.map(d => ({ customerId: d.id, ...d.data() }));
}

module.exports = {
  RFM_SEGMENTS,
  calculateRFMScores,
  getSegmentFromRFM,
  segmentCustomer,
  runDailySegmentation,
  getSegmentDashboard,
  getCustomersInSegment,
  getStoreStats
};
