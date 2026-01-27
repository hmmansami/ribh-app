/**
 * 🔮 RIBH Predictive Analytics Engine
 * Klaviyo's $1000/mo killer feature - we're building it
 * 
 * Predictions: CLV, Churn Risk, Next Order Date, Purchase Patterns
 */
const admin = require('firebase-admin');
const getDb = () => admin.firestore();

// Gender prediction from Arabic/English first names
const MALE_NAMES = new Set(['محمد', 'أحمد', 'علي', 'عبدالله', 'خالد', 'فهد', 'سعود', 'عمر', 'يوسف', 'ibrahim', 'mohammed', 'ahmed', 'ali', 'omar', 'khalid']);
const FEMALE_NAMES = new Set(['فاطمة', 'نورة', 'سارة', 'مريم', 'هند', 'لمى', 'دانة', 'fatima', 'sara', 'noura', 'mariam', 'hind', 'lama', 'dana']);

/**
 * Calculate Historic CLV (total revenue from customer)
 */
async function getHistoricCLV(storeId, customerId) {
  const orders = await getDb()
    .collection('stores').doc(storeId)
    .collection('orders')
    .where('customerId', '==', customerId)
    .where('status', 'not-in', ['cancelled', 'refunded'])
    .get();

  let total = 0;
  let refunds = 0;
  const orderDates = [];

  orders.forEach(doc => {
    const order = doc.data();
    total += parseFloat(order.total || order.amount || 0);
    refunds += parseFloat(order.refundAmount || 0);
    if (order.createdAt) {
      orderDates.push(order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt));
    }
  });

  return {
    historicCLV: Math.round((total - refunds) * 100) / 100,
    orderCount: orders.size,
    orderDates,
    avgOrderValue: orders.size > 0 ? Math.round((total / orders.size) * 100) / 100 : 0
  };
}

/**
 * Calculate average days between orders
 */
function calculateAvgOrderInterval(orderDates) {
  if (orderDates.length < 2) return null;
  
  const sorted = orderDates.sort((a, b) => a - b);
  let totalDays = 0;
  
  for (let i = 1; i < sorted.length; i++) {
    totalDays += (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
  }
  
  return Math.round(totalDays / (sorted.length - 1));
}

/**
 * Predict Future CLV (next 12 months)
 * Uses: order frequency, recency, monetary value, trend
 */
async function predictFutureCLV(storeId, customerId) {
  const { historicCLV, orderCount, orderDates, avgOrderValue } = await getHistoricCLV(storeId, customerId);
  
  if (orderCount === 0) return { predictedCLV: 0, confidence: 'none', method: 'no_orders' };
  
  const avgInterval = calculateAvgOrderInterval(orderDates);
  const daysSinceLastOrder = orderDates.length > 0 
    ? Math.floor((Date.now() - Math.max(...orderDates)) / (1000 * 60 * 60 * 24))
    : 999;
  
  // Simple prediction model (can enhance with ML later)
  // Based on: frequency trend + recency decay
  
  let predictedOrders;
  let confidence;
  
  if (orderCount >= 3 && avgInterval) {
    // Enough data for pattern-based prediction
    const ordersPerYear = 365 / avgInterval;
    
    // Apply recency decay (if they haven't ordered in 2x their interval, decay prediction)
    const recencyFactor = avgInterval && daysSinceLastOrder > avgInterval * 2 
      ? Math.max(0.3, 1 - (daysSinceLastOrder - avgInterval) / 365)
      : 1;
    
    predictedOrders = ordersPerYear * recencyFactor;
    confidence = 'high';
  } else if (orderCount >= 1) {
    // Limited data - use store average or conservative estimate
    const recencyFactor = daysSinceLastOrder < 90 ? 0.8 : daysSinceLastOrder < 180 ? 0.5 : 0.2;
    predictedOrders = (orderCount / Math.max(1, Math.ceil(daysSinceLastOrder / 365))) * recencyFactor;
    confidence = 'medium';
  } else {
    predictedOrders = 0;
    confidence = 'none';
  }
  
  const predictedCLV = Math.round(predictedOrders * avgOrderValue * 100) / 100;
  
  return {
    predictedCLV,
    predictedOrders: Math.round(predictedOrders * 10) / 10,
    avgOrderValue,
    avgInterval,
    daysSinceLastOrder,
    confidence,
    method: orderCount >= 3 ? 'pattern_based' : 'estimate'
  };
}

/**
 * Calculate Churn Risk (0-100%)
 * High risk = likely won't purchase again
 */
async function calculateChurnRisk(storeId, customerId) {
  const { orderCount, orderDates, avgOrderValue } = await getHistoricCLV(storeId, customerId);
  
  if (orderCount === 0) return { churnRisk: 100, status: 'never_purchased', color: 'gray' };
  
  const avgInterval = calculateAvgOrderInterval(orderDates);
  const daysSinceLastOrder = Math.floor((Date.now() - Math.max(...orderDates)) / (1000 * 60 * 60 * 24));
  
  let churnRisk;
  let status;
  
  if (orderCount === 1) {
    // One-time buyers: high base churn, decays over time
    if (daysSinceLastOrder < 30) {
      churnRisk = 50; status = 'new_buyer';
    } else if (daysSinceLastOrder < 90) {
      churnRisk = 65; status = 'cooling_off';
    } else if (daysSinceLastOrder < 180) {
      churnRisk = 80; status = 'at_risk';
    } else {
      churnRisk = 95; status = 'likely_churned';
    }
  } else {
    // Repeat buyers: compare to their normal interval
    const intervalMultiple = avgInterval ? daysSinceLastOrder / avgInterval : 2;
    
    if (intervalMultiple < 1) {
      churnRisk = 15; status = 'active';
    } else if (intervalMultiple < 1.5) {
      churnRisk = 25; status = 'on_schedule';
    } else if (intervalMultiple < 2) {
      churnRisk = 45; status = 'slightly_overdue';
    } else if (intervalMultiple < 3) {
      churnRisk = 70; status = 'at_risk';
    } else {
      churnRisk = 90; status = 'likely_churned';
    }
  }
  
  // Adjust for order count (more orders = more loyal = lower churn)
  if (orderCount >= 5) churnRisk = Math.max(10, churnRisk - 15);
  else if (orderCount >= 3) churnRisk = Math.max(15, churnRisk - 10);
  
  const color = churnRisk < 30 ? 'green' : churnRisk < 60 ? 'yellow' : 'red';
  
  return {
    churnRisk: Math.round(churnRisk),
    status,
    color,
    daysSinceLastOrder,
    avgInterval,
    orderCount
  };
}

/**
 * Predict next order date
 */
async function predictNextOrderDate(storeId, customerId) {
  const { orderCount, orderDates } = await getHistoricCLV(storeId, customerId);
  
  if (orderCount === 0) return { predictedDate: null, confidence: 'none' };
  
  const avgInterval = calculateAvgOrderInterval(orderDates);
  const lastOrderDate = new Date(Math.max(...orderDates));
  
  let predictedDate;
  let confidence;
  
  if (avgInterval && orderCount >= 2) {
    // Use their pattern
    predictedDate = new Date(lastOrderDate.getTime() + avgInterval * 24 * 60 * 60 * 1000);
    confidence = orderCount >= 4 ? 'high' : 'medium';
  } else {
    // Use store average (assume 45 days for now, can calculate from all customers)
    predictedDate = new Date(lastOrderDate.getTime() + 45 * 24 * 60 * 60 * 1000);
    confidence = 'low';
  }
  
  // If predicted date is in the past, they're overdue
  const isOverdue = predictedDate < new Date();
  
  return {
    predictedDate: predictedDate.toISOString().split('T')[0],
    confidence,
    avgInterval,
    isOverdue,
    daysUntil: Math.ceil((predictedDate - Date.now()) / (1000 * 60 * 60 * 24))
  };
}

/**
 * Predict gender from first name
 */
function predictGender(firstName) {
  if (!firstName) return { gender: 'unknown', confidence: 0 };
  
  const name = firstName.toLowerCase().trim();
  
  if (MALE_NAMES.has(name)) return { gender: 'male', confidence: 85 };
  if (FEMALE_NAMES.has(name)) return { gender: 'female', confidence: 85 };
  
  // Arabic name patterns
  if (name.startsWith('عبد') || name.endsWith('الدين')) return { gender: 'male', confidence: 75 };
  if (name.endsWith('ة') || name.endsWith('اء')) return { gender: 'female', confidence: 70 };
  
  return { gender: 'unknown', confidence: 0 };
}

/**
 * Get full predictive profile for a customer (Klaviyo-style)
 */
async function getCustomerPredictions(storeId, customerId) {
  const [clvData, futureCLV, churnData, nextOrder] = await Promise.all([
    getHistoricCLV(storeId, customerId),
    predictFutureCLV(storeId, customerId),
    calculateChurnRisk(storeId, customerId),
    predictNextOrderDate(storeId, customerId)
  ]);
  
  // Get customer name for gender prediction
  const customerDoc = await getDb()
    .collection('stores').doc(storeId)
    .collection('customers').doc(customerId).get();
  
  const customer = customerDoc.data() || {};
  const gender = predictGender(customer.firstName || customer.name?.split(' ')[0]);
  
  return {
    customerId,
    // CLV
    historicCLV: clvData.historicCLV,
    predictedCLV: futureCLV.predictedCLV,
    totalCLV: Math.round((clvData.historicCLV + futureCLV.predictedCLV) * 100) / 100,
    
    // Order patterns
    orderCount: clvData.orderCount,
    avgOrderValue: clvData.avgOrderValue,
    avgTimeBetweenOrders: futureCLV.avgInterval,
    daysSinceLastOrder: futureCLV.daysSinceLastOrder,
    
    // Predictions
    churnRisk: churnData.churnRisk,
    churnStatus: churnData.status,
    churnColor: churnData.color,
    
    nextOrderDate: nextOrder.predictedDate,
    nextOrderConfidence: nextOrder.confidence,
    isOverdue: nextOrder.isOverdue,
    
    gender: gender.gender,
    genderConfidence: gender.confidence,
    
    // Metadata
    calculatedAt: new Date().toISOString()
  };
}

/**
 * Update predictions for all customers (daily job)
 */
async function updateAllPredictions(storeId) {
  const customers = await getDb()
    .collection('stores').doc(storeId)
    .collection('customers')
    .limit(1000) // Process in batches for large stores
    .get();
  
  const batch = getDb().batch();
  let processed = 0;
  
  for (const doc of customers.docs) {
    try {
      const predictions = await getCustomerPredictions(storeId, doc.id);
      const predRef = getDb()
        .collection('stores').doc(storeId)
        .collection('predictions').doc(doc.id);
      batch.set(predRef, predictions, { merge: true });
      processed++;
    } catch (e) {
      console.error(`[Predictions] Error for ${doc.id}:`, e.message);
    }
  }
  
  await batch.commit();
  console.log(`[Predictions] Updated ${processed} customers for store ${storeId}`);
  
  return { processed, storeId };
}

/**
 * Get customers by churn risk level (for targeting)
 */
async function getCustomersByChurnRisk(storeId, minRisk = 60, maxRisk = 100) {
  const predictions = await getDb()
    .collection('stores').doc(storeId)
    .collection('predictions')
    .where('churnRisk', '>=', minRisk)
    .where('churnRisk', '<=', maxRisk)
    .orderBy('churnRisk', 'desc')
    .limit(100)
    .get();
  
  return predictions.docs.map(d => ({ customerId: d.id, ...d.data() }));
}

/**
 * Get high-value customers (VIPs)
 */
async function getHighValueCustomers(storeId, minCLV = 500) {
  const predictions = await getDb()
    .collection('stores').doc(storeId)
    .collection('predictions')
    .where('totalCLV', '>=', minCLV)
    .orderBy('totalCLV', 'desc')
    .limit(100)
    .get();
  
  return predictions.docs.map(d => ({ customerId: d.id, ...d.data() }));
}

/**
 * Get customers due for next order (within X days)
 */
async function getCustomersDueForOrder(storeId, withinDays = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + withinDays);
  const cutoff = cutoffDate.toISOString().split('T')[0];
  
  const predictions = await getDb()
    .collection('stores').doc(storeId)
    .collection('predictions')
    .where('nextOrderDate', '<=', cutoff)
    .where('churnRisk', '<', 80) // Don't target likely churned
    .orderBy('nextOrderDate', 'asc')
    .limit(100)
    .get();
  
  return predictions.docs.map(d => ({ customerId: d.id, ...d.data() }));
}

module.exports = {
  getHistoricCLV,
  predictFutureCLV,
  calculateChurnRisk,
  predictNextOrderDate,
  predictGender,
  getCustomerPredictions,
  updateAllPredictions,
  getCustomersByChurnRisk,
  getHighValueCustomers,
  getCustomersDueForOrder,
  calculateAvgOrderInterval
};
