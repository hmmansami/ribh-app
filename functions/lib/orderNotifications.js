/**
 * RIBH Order Notifications - WhatsApp updates for Salla webhooks
 * Stores history in Firestore to prevent duplicate sends
 */
const admin = require('firebase-admin');
const { sendMessage } = require('./whatsappClient');
const db = () => admin.firestore();

const MESSAGES = {
  created: (id) => `شكراً! استلمنا طلبك #${id} ✅`,
  shipped: (id, t) => `طلبك في الطريق! 🚚${t ? ` رقم التتبع: ${t}` : ''}`,
  delivered: () => `وصل طلبك! نتمنى يعجبك 💚`
};

const notifRef = (storeId, orderId, event) =>
  db().collection('stores').doc(storeId).collection('order_notifications').doc(`${orderId}_${event}`);

/** Send order status notification (with duplicate check) */
async function notify(order, event) {
  const { storeId, orderId, phone, trackingNumber } = order;
  if (!storeId || !phone || !orderId) return { success: false, error: 'Missing fields' };

  // Check duplicate
  const ref = notifRef(storeId, orderId, event);
  if ((await ref.get()).exists) return { success: false, error: 'Already sent', duplicate: true };

  // Build message
  const msg = event === 'created' ? MESSAGES.created(orderId)
    : event === 'shipped' ? MESSAGES.shipped(orderId, trackingNumber)
    : event === 'delivered' ? MESSAGES.delivered() : null;
  if (!msg) return { success: false, error: `Unknown event: ${event}` };

  // Send & record (whatsappClient.sendMessage takes merchantId, phone, message)
  const result = await sendMessage(storeId, phone, msg);
  if (result.success) {
    await ref.set({ orderId, event, phone, messageId: result.messageId, sentAt: new Date().toISOString() });
  }
  return { ...result, event, orderId };
}

// Convenience handlers for Salla webhooks
const onOrderCreated = (order) => notify(order, 'created');
const onOrderShipped = (order) => notify(order, 'shipped');
const onOrderDelivered = (order) => notify(order, 'delivered');

/** Extract order data from Salla webhook payload */
function extractFromSalla(merchantId, data) {
  const c = data.customer || {};
  const items = (data.items || data.products || []).map(item => ({
    name: item.name || item.product_name,
    quantity: item.quantity || 1,
    sku: item.sku
  }));
  return {
    storeId: merchantId,
    orderId: data.id || data.reference_id,
    phone: c.mobile || c.phone || data.mobile,
    trackingNumber: data.shipment?.tracking_number || data.tracking_number,
    status: data.status || data.order_status,
    customerName: c.name || c.first_name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
    items,
    reviewLink: data.urls?.customer || null
  };
}

module.exports = { notify, onOrderCreated, onOrderShipped, onOrderDelivered, extractFromSalla, MESSAGES };
