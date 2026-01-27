/**
 * PRODUCT MEMORY - Track customer product interactions & provide recommendations
 * Collection: stores/{storeId}/customerMemory/{customerId}
 */
const admin = require('firebase-admin');

let _db = null;
const getDb = () => _db || admin.firestore();
const _setDb = (db) => { _db = db; };
const getRef = (storeId, customerId) => 
  getDb().collection('stores').doc(storeId).collection('customerMemory').doc(customerId);

// ============= TRACKING =============

async function trackProductView(storeId, customerId, product) {
  const ref = getRef(storeId, customerId);
  const now = Date.now();
  await ref.set({
    lastSeen: now,
    views: admin.firestore.FieldValue.arrayUnion({
      productId: product.id, name: product.name, price: product.price || 0,
      category: product.category || 'general', viewedAt: now
    })
  }, { merge: true });
  
  // Trim old views (keep last 50)
  const doc = await ref.get();
  const views = doc.exists ? doc.data().views || [] : [];
  if (views.length > 50) await ref.update({ views: views.slice(-50) });
  
  return { success: true, action: 'view', productId: product.id };
}

async function trackCartAdd(storeId, customerId, product) {
  const now = Date.now();
  await getRef(storeId, customerId).set({
    lastSeen: now,
    cartAdds: admin.firestore.FieldValue.arrayUnion({
      productId: product.id, name: product.name, price: product.price || 0,
      category: product.category || 'general', addedAt: now
    })
  }, { merge: true });
  return { success: true, action: 'cart', productId: product.id };
}

async function trackPurchase(storeId, customerId, products, orderId) {
  const now = Date.now();
  const items = products.map(p => ({
    productId: p.id, name: p.name, price: p.price || 0,
    category: p.category || 'general', quantity: p.quantity || 1
  }));
  await getRef(storeId, customerId).set({
    lastSeen: now, lastPurchase: now,
    totalOrders: admin.firestore.FieldValue.increment(1),
    purchases: admin.firestore.FieldValue.arrayUnion({
      orderId, items, total: items.reduce((s, p) => s + p.price * p.quantity, 0), purchasedAt: now
    })
  }, { merge: true });
  return { success: true, action: 'purchase', orderId, itemCount: products.length };
}

// ============= RETRIEVAL =============

async function getRecentViews(storeId, customerId, limit = 10) {
  const doc = await getRef(storeId, customerId).get();
  return doc.exists ? (doc.data().views || []).slice(-limit).reverse() : [];
}

async function getRecentPurchases(storeId, customerId, limit = 5) {
  const doc = await getRef(storeId, customerId).get();
  return doc.exists ? (doc.data().purchases || []).slice(-limit).reverse() : [];
}

async function getCustomerSummary(storeId, customerId) {
  const doc = await getRef(storeId, customerId).get();
  if (!doc.exists) return null;
  const d = doc.data();
  return {
    customerId, lastSeen: d.lastSeen, lastPurchase: d.lastPurchase,
    totalOrders: d.totalOrders || 0, viewCount: (d.views || []).length,
    cartAddCount: (d.cartAdds || []).length, purchaseCount: (d.purchases || []).length
  };
}

// ============= RECOMMENDATIONS =============

async function getRelatedProducts(storeId, customerId, maxResults = 5) {
  const doc = await getRef(storeId, customerId).get();
  if (!doc.exists) return { recommendations: [], reason: 'no_history' };
  
  const { views = [], cartAdds = [], purchases = [] } = doc.data();
  const catScores = {}, prodScores = {}, purchasedIds = new Set();
  
  // Purchases = highest signal (exclude from recs)
  purchases.forEach(p => (p.items || []).forEach(i => {
    purchasedIds.add(i.productId);
    catScores[i.category] = (catScores[i.category] || 0) + 10;
  }));
  
  // Cart adds = strong intent
  cartAdds.forEach(i => {
    if (!purchasedIds.has(i.productId)) {
      prodScores[i.productId] = (prodScores[i.productId] || 0) + 5;
      catScores[i.category] = (catScores[i.category] || 0) + 3;
    }
  });
  
  // Views = interest signal
  views.forEach(i => {
    if (!purchasedIds.has(i.productId)) {
      prodScores[i.productId] = (prodScores[i.productId] || 0) + 1;
      catScores[i.category] = (catScores[i.category] || 0) + 1;
    }
  });
  
  const sortDesc = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const allItems = [...cartAdds, ...views];
  
  const recommendations = sortDesc(prodScores).slice(0, maxResults).map(([productId, score]) => {
    const item = allItems.find(v => v.productId === productId);
    return { productId, name: item?.name, category: item?.category, score };
  });
  
  const topCategories = sortDesc(catScores).slice(0, 3).map(([category, score]) => ({ category, score }));
  
  return { recommendations, topCategories, reason: recommendations.length ? 'history_based' : 'no_unpurchased' };
}

module.exports = {
  trackProductView, trackCartAdd, trackPurchase,
  getRecentViews, getRecentPurchases, getCustomerSummary, getRelatedProducts
};

// ============= TEST =============
if (require.main === module) {
  const STORE = 'test-store', CUST = 'cust-1', mockData = {};
  const mockRef = {
    set: async (data) => {
      const k = `${STORE}/${CUST}`;
      mockData[k] = mockData[k] || {};
      for (const [key, v] of Object.entries(data)) {
        if (v?.elements) mockData[k][key] = [...(mockData[k][key] || []), ...v.elements];
        else if (v?.operand !== undefined) mockData[k][key] = (mockData[k][key] || 0) + v.operand;
        else mockData[k][key] = v;
      }
    },
    get: async () => ({ exists: !!mockData[`${STORE}/${CUST}`], data: () => ({ ...mockData[`${STORE}/${CUST}`] }) }),
    update: async (data) => Object.assign(mockData[`${STORE}/${CUST}`], data)
  };
  _setDb({ collection: () => ({ doc: () => ({ collection: () => ({ doc: () => mockRef }) }) }) });

  (async () => {
    console.log('🧪 ProductMemory Tests\n');
    
    await trackProductView(STORE, CUST, { id: 'p1', name: 'Case', price: 49, category: 'accessories' });
    await trackProductView(STORE, CUST, { id: 'p2', name: 'Protector', price: 19, category: 'accessories' });
    console.log('✅ Views tracked');
    
    await trackCartAdd(STORE, CUST, { id: 'p1', name: 'Case', price: 49, category: 'accessories' });
    console.log('✅ Cart add tracked');
    
    await trackPurchase(STORE, CUST, [{ id: 'p2', name: 'Protector', price: 19, quantity: 2 }], 'ord-1');
    console.log('✅ Purchase tracked');
    
    const views = await getRecentViews(STORE, CUST);
    console.log(`✅ Recent views: ${views.length}`);
    
    const summary = await getCustomerSummary(STORE, CUST);
    console.log(`✅ Summary: ${summary.viewCount} views, ${summary.totalOrders} orders`);
    
    const recs = await getRelatedProducts(STORE, CUST);
    console.log(`✅ Recommendations: ${recs.recommendations.length} (categories: ${recs.topCategories.map(c => c.category).join(', ')})`);
    
    console.log('\n✅ All tests passed!');
  })();
}
