/**
 * 📡 RIBH Event Tracker
 * Track all customer events for smart triggers
 * 
 * Detects: Browse abandon, cart abandon, checkout abandon, etc.
 */
const admin = require('firebase-admin');
const getDb = () => admin.firestore();

/**
 * Event Types
 */
const EVENT_TYPES = {
  // Browsing
  PAGE_VIEW: 'page_view',
  PRODUCT_VIEW: 'product_view',
  CATEGORY_VIEW: 'category_view',
  SEARCH: 'search',
  
  // Shopping
  CART_ADD: 'cart_add',
  CART_REMOVE: 'cart_remove',
  CART_UPDATE: 'cart_update',
  
  // Checkout
  CHECKOUT_START: 'checkout_start',
  CHECKOUT_STEP: 'checkout_step',
  PAYMENT_INFO: 'payment_info_entered',
  
  // Order
  ORDER_PLACED: 'order_placed',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_REFUNDED: 'order_refunded',
  
  // Engagement
  EMAIL_OPEN: 'email_open',
  SMS_CLICK: 'sms_click',
  WHATSAPP_REPLY: 'whatsapp_reply',
  REVIEW_SUBMITTED: 'review_submitted',
  
  // Lifecycle
  SIGNUP: 'signup',
  LOGIN: 'login',
  UNSUBSCRIBE: 'unsubscribe'
};

/**
 * Track any event
 */
async function trackEvent(storeId, customerId, eventType, eventData = {}) {
  const event = {
    customerId,
    eventType,
    data: eventData,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    timestampMs: Date.now(),
    sessionId: eventData.sessionId || null,
    deviceType: eventData.deviceType || 'unknown',
    source: eventData.source || 'web'
  };
  
  // Store in events collection
  const eventRef = await getDb()
    .collection('stores').doc(storeId)
    .collection('events')
    .add(event);
  
  // Update customer's last activity
  await getDb()
    .collection('stores').doc(storeId)
    .collection('customers').doc(customerId)
    .set({
      lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
      lastEventType: eventType
    }, { merge: true });
  
  // Check for triggered automations
  await checkEventTriggers(storeId, customerId, eventType, eventData);
  
  return { eventId: eventRef.id, eventType };
}

/**
 * Track product view
 */
async function trackProductView(storeId, customerId, product) {
  return trackEvent(storeId, customerId, EVENT_TYPES.PRODUCT_VIEW, {
    productId: product.id,
    productName: product.name,
    productPrice: product.price,
    productCategory: product.category,
    productUrl: product.url
  });
}

/**
 * Track category view
 */
async function trackCategoryView(storeId, customerId, category) {
  return trackEvent(storeId, customerId, EVENT_TYPES.CATEGORY_VIEW, {
    categoryId: category.id,
    categoryName: category.name
  });
}

/**
 * Track cart add
 */
async function trackCartAdd(storeId, customerId, product, cartValue) {
  return trackEvent(storeId, customerId, EVENT_TYPES.CART_ADD, {
    productId: product.id,
    productName: product.name,
    productPrice: product.price,
    quantity: product.quantity || 1,
    cartValue
  });
}

/**
 * Track checkout start
 */
async function trackCheckoutStart(storeId, customerId, cart) {
  return trackEvent(storeId, customerId, EVENT_TYPES.CHECKOUT_START, {
    cartValue: cart.total,
    itemCount: cart.items?.length || 0,
    items: cart.items?.slice(0, 10) // Store first 10 items
  });
}

/**
 * Track order placed
 */
async function trackOrderPlaced(storeId, customerId, order) {
  return trackEvent(storeId, customerId, EVENT_TYPES.ORDER_PLACED, {
    orderId: order.id,
    orderTotal: order.total,
    itemCount: order.items?.length || 0
  });
}

/**
 * Get customer's recent events (journey)
 */
async function getCustomerJourney(storeId, customerId, limit = 50) {
  const events = await getDb()
    .collection('stores').doc(storeId)
    .collection('events')
    .where('customerId', '==', customerId)
    .orderBy('timestampMs', 'desc')
    .limit(limit)
    .get();
  
  return events.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Detect browse abandonment
 * Customer viewed product(s) but didn't add to cart
 */
async function detectBrowseAbandon(storeId, hoursAgo = 2) {
  const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
  
  // Get product views in the time window
  const productViews = await getDb()
    .collection('stores').doc(storeId)
    .collection('events')
    .where('eventType', '==', EVENT_TYPES.PRODUCT_VIEW)
    .where('timestampMs', '>=', cutoffTime)
    .get();
  
  // Group by customer
  const customerViews = {};
  productViews.forEach(doc => {
    const event = doc.data();
    if (!customerViews[event.customerId]) {
      customerViews[event.customerId] = {
        products: [],
        lastView: 0
      };
    }
    customerViews[event.customerId].products.push(event.data);
    customerViews[event.customerId].lastView = Math.max(
      customerViews[event.customerId].lastView,
      event.timestampMs
    );
  });
  
  // Check which ones didn't add to cart or order
  const abandonments = [];
  
  for (const [customerId, views] of Object.entries(customerViews)) {
    // Check if they added to cart after viewing
    const cartAdds = await getDb()
      .collection('stores').doc(storeId)
      .collection('events')
      .where('customerId', '==', customerId)
      .where('eventType', 'in', [EVENT_TYPES.CART_ADD, EVENT_TYPES.ORDER_PLACED])
      .where('timestampMs', '>=', views.lastView)
      .limit(1)
      .get();
    
    if (cartAdds.empty) {
      // Browse abandonment detected!
      abandonments.push({
        customerId,
        viewedProducts: views.products,
        lastViewAt: new Date(views.lastView).toISOString(),
        triggerType: 'browse_abandon'
      });
    }
  }
  
  return abandonments;
}

/**
 * Detect cart abandonment
 * Customer added to cart but didn't checkout
 */
async function detectCartAbandon(storeId, hoursAgo = 1) {
  const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
  
  // Get cart adds in the time window
  const cartAdds = await getDb()
    .collection('stores').doc(storeId)
    .collection('events')
    .where('eventType', '==', EVENT_TYPES.CART_ADD)
    .where('timestampMs', '>=', cutoffTime)
    .get();
  
  // Group by customer
  const customerCarts = {};
  cartAdds.forEach(doc => {
    const event = doc.data();
    if (!customerCarts[event.customerId]) {
      customerCarts[event.customerId] = {
        items: [],
        lastAdd: 0,
        cartValue: 0
      };
    }
    customerCarts[event.customerId].items.push(event.data);
    customerCarts[event.customerId].lastAdd = Math.max(
      customerCarts[event.customerId].lastAdd,
      event.timestampMs
    );
    customerCarts[event.customerId].cartValue = event.data.cartValue || 0;
  });
  
  const abandonments = [];
  
  for (const [customerId, cart] of Object.entries(customerCarts)) {
    // Check if they started checkout or ordered
    const checkouts = await getDb()
      .collection('stores').doc(storeId)
      .collection('events')
      .where('customerId', '==', customerId)
      .where('eventType', 'in', [EVENT_TYPES.CHECKOUT_START, EVENT_TYPES.ORDER_PLACED])
      .where('timestampMs', '>=', cart.lastAdd)
      .limit(1)
      .get();
    
    if (checkouts.empty) {
      abandonments.push({
        customerId,
        cartItems: cart.items,
        cartValue: cart.cartValue,
        lastAddAt: new Date(cart.lastAdd).toISOString(),
        triggerType: 'cart_abandon'
      });
    }
  }
  
  return abandonments;
}

/**
 * Detect checkout abandonment
 * Customer started checkout but didn't complete order
 */
async function detectCheckoutAbandon(storeId, hoursAgo = 0.5) {
  const cutoffTime = Date.now() - (hoursAgo * 60 * 60 * 1000);
  
  const checkoutStarts = await getDb()
    .collection('stores').doc(storeId)
    .collection('events')
    .where('eventType', '==', EVENT_TYPES.CHECKOUT_START)
    .where('timestampMs', '>=', cutoffTime)
    .get();
  
  const customerCheckouts = {};
  checkoutStarts.forEach(doc => {
    const event = doc.data();
    customerCheckouts[event.customerId] = {
      data: event.data,
      startTime: event.timestampMs
    };
  });
  
  const abandonments = [];
  
  for (const [customerId, checkout] of Object.entries(customerCheckouts)) {
    const orders = await getDb()
      .collection('stores').doc(storeId)
      .collection('events')
      .where('customerId', '==', customerId)
      .where('eventType', '==', EVENT_TYPES.ORDER_PLACED)
      .where('timestampMs', '>=', checkout.startTime)
      .limit(1)
      .get();
    
    if (orders.empty) {
      abandonments.push({
        customerId,
        cartValue: checkout.data.cartValue,
        itemCount: checkout.data.itemCount,
        startedAt: new Date(checkout.startTime).toISOString(),
        triggerType: 'checkout_abandon'
      });
    }
  }
  
  return abandonments;
}

/**
 * Check if event should trigger automation
 */
async function checkEventTriggers(storeId, customerId, eventType, eventData) {
  // Load store's automation triggers
  const storeDoc = await getDb().collection('stores').doc(storeId).get();
  const triggers = storeDoc.data()?.automationTriggers || {};
  
  const triggeredActions = [];
  
  // Check each trigger type
  if (eventType === EVENT_TYPES.PRODUCT_VIEW && triggers.browseAbandon?.enabled) {
    // Schedule browse abandon check for later
    triggeredActions.push({
      action: 'schedule_browse_abandon_check',
      delay: triggers.browseAbandon.delayMinutes || 120,
      customerId,
      data: eventData
    });
  }
  
  if (eventType === EVENT_TYPES.CART_ADD && triggers.cartAbandon?.enabled) {
    triggeredActions.push({
      action: 'schedule_cart_abandon_check',
      delay: triggers.cartAbandon.delayMinutes || 60,
      customerId,
      data: eventData
    });
  }
  
  if (eventType === EVENT_TYPES.CHECKOUT_START && triggers.checkoutAbandon?.enabled) {
    triggeredActions.push({
      action: 'schedule_checkout_abandon_check',
      delay: triggers.checkoutAbandon.delayMinutes || 30,
      customerId,
      data: eventData
    });
  }
  
  if (eventType === EVENT_TYPES.ORDER_PLACED && triggers.postPurchase?.enabled) {
    triggeredActions.push({
      action: 'trigger_post_purchase',
      delay: triggers.postPurchase.delayMinutes || 5,
      customerId,
      data: eventData
    });
  }
  
  // Save triggered actions for processing
  for (const trigger of triggeredActions) {
    await getDb()
      .collection('stores').doc(storeId)
      .collection('scheduledTriggers')
      .add({
        ...trigger,
        triggerAt: new Date(Date.now() + trigger.delay * 60 * 1000),
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
  }
  
  return triggeredActions;
}

/**
 * Process scheduled triggers (called by cron job)
 */
async function processScheduledTriggers(storeId) {
  const now = new Date();
  
  const dueTriggers = await getDb()
    .collection('stores').doc(storeId)
    .collection('scheduledTriggers')
    .where('status', '==', 'pending')
    .where('triggerAt', '<=', now)
    .limit(50)
    .get();
  
  const results = [];
  
  for (const doc of dueTriggers.docs) {
    const trigger = doc.data();
    
    try {
      let result;
      
      switch (trigger.action) {
        case 'schedule_browse_abandon_check':
          result = await handleBrowseAbandonTrigger(storeId, trigger);
          break;
        case 'schedule_cart_abandon_check':
          result = await handleCartAbandonTrigger(storeId, trigger);
          break;
        case 'schedule_checkout_abandon_check':
          result = await handleCheckoutAbandonTrigger(storeId, trigger);
          break;
        case 'trigger_post_purchase':
          result = await handlePostPurchaseTrigger(storeId, trigger);
          break;
        default:
          result = { skipped: true, reason: 'Unknown action' };
      }
      
      await doc.ref.update({
        status: 'processed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        result
      });
      
      results.push({ triggerId: doc.id, ...result });
      
    } catch (e) {
      await doc.ref.update({
        status: 'error',
        error: e.message,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      results.push({ triggerId: doc.id, error: e.message });
    }
  }
  
  return { processed: results.length, results };
}

// Placeholder handlers - these would integrate with messaging systems
async function handleBrowseAbandonTrigger(storeId, trigger) {
  // Check if customer still hasn't purchased
  const recentOrders = await getDb()
    .collection('stores').doc(storeId)
    .collection('events')
    .where('customerId', '==', trigger.customerId)
    .where('eventType', '==', EVENT_TYPES.ORDER_PLACED)
    .where('timestampMs', '>=', Date.now() - 24 * 60 * 60 * 1000)
    .limit(1)
    .get();
  
  if (recentOrders.empty) {
    // They haven't ordered - trigger browse abandon flow
    return { triggered: true, flow: 'browse_abandon', customerId: trigger.customerId };
  }
  
  return { triggered: false, reason: 'Customer already ordered' };
}

async function handleCartAbandonTrigger(storeId, trigger) {
  // Similar check - did they complete checkout?
  return { triggered: true, flow: 'cart_abandon', customerId: trigger.customerId };
}

async function handleCheckoutAbandonTrigger(storeId, trigger) {
  return { triggered: true, flow: 'checkout_abandon', customerId: trigger.customerId };
}

async function handlePostPurchaseTrigger(storeId, trigger) {
  return { triggered: true, flow: 'post_purchase', customerId: trigger.customerId };
}

module.exports = {
  EVENT_TYPES,
  trackEvent,
  trackProductView,
  trackCategoryView,
  trackCartAdd,
  trackCheckoutStart,
  trackOrderPlaced,
  getCustomerJourney,
  detectBrowseAbandon,
  detectCartAbandon,
  detectCheckoutAbandon,
  processScheduledTriggers
};
