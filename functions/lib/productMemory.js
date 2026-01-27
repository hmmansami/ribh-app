/**
 * PRODUCT MEMORY
 * 
 * Tracks customer product interactions (views, carts, purchases)
 * Provides recommendations based on history
 * 
 * Collection: stores/{storeId}/customerMemory/{customerId}
 */

const admin = require('firebase-admin');

// Allow injection for testing
let _db = null;
function getDb() {
  return _db || admin.firestore();
}
function _setDb(db) { _db = db; }

function getMemoryRef(storeId, customerId) {
  return getDb().collection('stores').doc(storeId)
    .collection('customerMemory').doc(customerId);
}

// ============= TRACKING =============

/**
 * Track product view
 */
async function trackProductView(storeId, customerId, product) {
  const ref = getMemoryRef(storeId, customerId);
  const now = Date.now();
  
  await ref.set({
    lastSeen: now,
    views: admin.firestore.FieldValue.arrayUnion({
      productId: product.id,
      name: product.name,
      price: product.price || 0,
      category: product.category || 'general',
      viewedAt: now
    })
  }, { merge: true });
  
  // Trim old views (keep last 50)
  const doc = await ref.get();
  if (doc.exists) {
    const views = doc.data().views || [];
    if (views.length > 50) {
      await ref.update({ views: views.slice(-50) });
    }
  }
  
  return { success: true, action: 'view', productId: product.id };
}

/**
 * Track cart add
 */
async function trackCartAdd(storeId, customerId, product) {
  const ref = getMemoryRef(storeId, customerId);
  const now = Date.now();
  
  await ref.set({
    lastSeen: now,
    cartAdds: admin.firestore.FieldValue.arrayUnion({
      productId: product.id,
      name: product.name,
      price: product.price || 0,
      category: product.category || 'general',
      addedAt: now
    })
  }, { merge: true });
  
  return { success: true, action: 'cart', productId: product.id };
}

/**
 * Track purchase
 */
async function trackPurchase(storeId, customerId, products, orderId) {
  const ref = getMemoryRef(storeId, customerId);
  const now = Date.now();
  
  const purchaseItems = products.map(p => ({
    productId: p.id,
    name: p.name,
    price: p.price || 0,
    category: p.category || 'general',
    quantity: p.quantity || 1
  }));
  
  await ref.set({
    lastSeen: now,
    lastPurchase: now,
    totalOrders: admin.firestore.FieldValue.increment(1),
    purchases: admin.firestore.FieldValue.arrayUnion({
      orderId,
      items: purchaseItems,
      total: purchaseItems.reduce((sum, p) => sum + (p.price * p.quantity), 0),
      purchasedAt: now
    })
  }, { merge: true });
  
  return { success: true, action: 'purchase', orderId, itemCount: products.length };
}

// ============= RETRIEVAL =============

/**
 * Get recent views
 */
async function getRecentViews(storeId, customerId, limit = 10) {
  const doc = await getMemoryRef(storeId, customerId).get();
  if (!doc.exists) return [];
  
  const views = doc.data().views || [];
  return views.slice(-limit).reverse(); // Most recent first
}

/**
 * Get recent purchases
 */
async function getRecentPurchases(storeId, customerId, limit = 5) {
  const doc = await getMemoryRef(storeId, customerId).get();
  if (!doc.exists) return [];
  
  const purchases = doc.data().purchases || [];
  return purchases.slice(-limit).reverse();
}

/**
 * Get customer memory summary
 */
async function getCustomerSummary(storeId, customerId) {
  const doc = await getMemoryRef(storeId, customerId).get();
  if (!doc.exists) return null;
  
  const data = doc.data();
  return {
    customerId,
    lastSeen: data.lastSeen,
    lastPurchase: data.lastPurchase,
    totalOrders: data.totalOrders || 0,
    viewCount: (data.views || []).length,
    cartAddCount: (data.cartAdds || []).length,
    purchaseCount: (data.purchases || []).length
  };
}

// ============= RECOMMENDATIONS =============

/**
 * Get related products based on history
 * Returns product IDs/categories to recommend
 */
async function getRelatedProducts(storeId, customerId, maxResults = 5) {
  const doc = await getMemoryRef(storeId, customerId).get();
  if (!doc.exists) return { recommendations: [], reason: 'no_history' };
  
  const data = doc.data();
  const views = data.views || [];
  const cartAdds = data.cartAdds || [];
  const purchases = data.purchases || [];
  
  // Score categories and products
  const categoryScores = {};
  const productScores = {};
  const purchasedIds = new Set();
  
  // Purchases = highest signal (but exclude from recs)
  purchases.forEach(p => {
    (p.items || []).forEach(item => {
      purchasedIds.add(item.productId);
      categoryScores[item.category] = (categoryScores[item.category] || 0) + 10;
    });
  });
  
  // Cart adds = strong intent
  cartAdds.forEach(item => {
    if (!purchasedIds.has(item.productId)) {
      productScores[item.productId] = (productScores[item.productId] || 0) + 5;
      categoryScores[item.category] = (categoryScores[item.category] || 0) + 3;
    }
  });
  
  // Views = interest signal
  views.forEach(item => {
    if (!purchasedIds.has(item.productId)) {
      productScores[item.productId] = (productScores[item.productId] || 0) + 1;
      categoryScores[item.category] = (categoryScores[item.category] || 0) + 1;
    }
  });
  
  // Sort and return top recommendations
  const topProducts = Object.entries(productScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults)
    .map(([productId, score]) => {
      const item = [...cartAdds, ...views].find(v => v.productId === productId);
      return { productId, name: item?.name, category: item?.category, score };
    });
  
  const topCategories = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, score]) => ({ category, score }));
  
  return {
    recommendations: topProducts,
    topCategories,
    reason: topProducts.length ? 'history_based' : 'no_unpurchased_items'
  };
}

module.exports = {
  trackProductView,
  trackCartAdd,
  trackPurchase,
  getRecentViews,
  getRecentPurchases,
  getCustomerSummary,
  getRelatedProducts
};

// ============= TEST =============

if (require.main === module) {
  const TEST_STORE = 'test-store-123';
  const TEST_CUSTOMER = 'cust-456';
  
  // Mock Firestore for testing (inject BEFORE any calls)
  const mockData = {};
  
  const mockRef = {
    set: async (data, opts) => {
      const key = `${TEST_STORE}/${TEST_CUSTOMER}`;
      if (!mockData[key]) mockData[key] = {};
      
      for (const [k, v] of Object.entries(data)) {
        if (v?.elements) {
          // arrayUnion - flatten and merge
          mockData[key][k] = [...(mockData[key][k] || []), ...v.elements];
        } else if (v?.operand !== undefined) {
          // increment
          mockData[key][k] = (mockData[key][k] || 0) + v.operand;
        } else {
          mockData[key][k] = v;
        }
      }
      return true;
    },
    get: async () => {
      const key = `${TEST_STORE}/${TEST_CUSTOMER}`;
      return {
        exists: !!mockData[key],
        data: () => JSON.parse(JSON.stringify(mockData[key] || {}))
      };
    },
    update: async (data) => {
      const key = `${TEST_STORE}/${TEST_CUSTOMER}`;
      Object.assign(mockData[key], data);
    }
  };
  
  // Inject mock DB
  _setDb({
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => mockRef }) }) })
  });
  
  async function runTests() {
    console.log('🧪 ProductMemory Tests\n');
    
    // Test 1: Track views
    console.log('1. Track product views...');
    await trackProductView(TEST_STORE, TEST_CUSTOMER, { id: 'prod-1', name: 'iPhone Case', price: 49, category: 'accessories' });
    await trackProductView(TEST_STORE, TEST_CUSTOMER, { id: 'prod-2', name: 'Screen Protector', price: 19, category: 'accessories' });
    await trackProductView(TEST_STORE, TEST_CUSTOMER, { id: 'prod-3', name: 'Wireless Charger', price: 79, category: 'electronics' });
    console.log('   ✅ Views tracked');
    
    // Test 2: Track cart add
    console.log('2. Track cart add...');
    await trackCartAdd(TEST_STORE, TEST_CUSTOMER, { id: 'prod-1', name: 'iPhone Case', price: 49, category: 'accessories' });
    console.log('   ✅ Cart add tracked');
    
    // Test 3: Track purchase
    console.log('3. Track purchase...');
    await trackPurchase(TEST_STORE, TEST_CUSTOMER, [
      { id: 'prod-2', name: 'Screen Protector', price: 19, category: 'accessories', quantity: 2 }
    ], 'order-789');
    console.log('   ✅ Purchase tracked');
    
    // Test 4: Get recent views
    console.log('4. Get recent views...');
    const views = await getRecentViews(TEST_STORE, TEST_CUSTOMER);
    console.log(`   ✅ Got ${views.length} views`);
    
    // Test 5: Get customer summary
    console.log('5. Get customer summary...');
    const summary = await getCustomerSummary(TEST_STORE, TEST_CUSTOMER);
    console.log(`   ✅ Summary: ${summary.viewCount} views, ${summary.totalOrders} orders`);
    
    // Test 6: Get recommendations
    console.log('6. Get recommendations...');
    const recs = await getRelatedProducts(TEST_STORE, TEST_CUSTOMER);
    console.log(`   ✅ Got ${recs.recommendations.length} recommendations`);
    console.log(`   Top categories: ${recs.topCategories.map(c => c.category).join(', ')}`);
    
    console.log('\n✅ All tests passed!');
  }
  
  runTests().catch(console.error);
}
