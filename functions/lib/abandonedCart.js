/**
 * Abandoned Cart Recovery - WhatsApp reminders for RIBH
 * Uses existing cart data from cartDetection.js
 */
const admin = require('firebase-admin');
const { sendMessage } = require('./whatsappSender');

const FIRST_REMINDER_MS = 60 * 60 * 1000;       // 1 hour after abandon
const SECOND_REMINDER_MS = 24 * 60 * 60 * 1000; // 24 hours after first

const MESSAGES = {
  first: 'لسه عندك منتجات بالسلة! 🛒 تبي تكمل الطلب؟',
  second: 'منتجاتك لسه بانتظارك! 🛍️ لا تفوّت الفرصة، كمّل طلبك الحين:'
};

function getDb() { return admin.firestore(); }

/** Find carts ready for reminders */
async function getCartsForReminder() {
  const db = getDb(), now = Date.now();
  const snap = await db.collection('carts')
    .where('status', 'in', ['abandoned', 'reminded'])
    .orderBy('abandonedAt', 'asc').limit(50).get();
  
  const ready = [];
  snap.forEach(doc => {
    const c = doc.data();
    if (!c.phone || c.status === 'converted') return;
    const abandonedAt = c.abandonedAt?.toMillis?.() || Date.parse(c.abandonedAt) || 0;
    const lastReminder = c.lastReminderAt?.toMillis?.() || 0;
    const reminderCount = c.reminderCount || 0;
    
    if (reminderCount === 0 && now - abandonedAt >= FIRST_REMINDER_MS) {
      ready.push({ ...c, id: doc.id, reminderType: 'first' });
    } else if (reminderCount === 1 && now - lastReminder >= SECOND_REMINDER_MS) {
      ready.push({ ...c, id: doc.id, reminderType: 'second' });
    }
  });
  return ready;
}

/** Send reminder to a single cart */
async function sendReminder(cart) {
  const msg = MESSAGES[cart.reminderType] + (cart.checkoutUrl ? `\n${cart.checkoutUrl}` : '');
  const result = await sendMessage(cart.phone, msg);
  
  if (result.success) {
    await getDb().collection('carts').doc(cart.id).update({
      status: 'reminded',
      reminderCount: (cart.reminderCount || 0) + 1,
      lastReminderAt: admin.firestore.FieldValue.serverTimestamp(),
      [`reminder${cart.reminderType === 'first' ? 1 : 2}At`]: new Date().toISOString()
    });
    console.log(`[AbandonedCart] ✅ Sent ${cart.reminderType} reminder to ${cart.phone}`);
  }
  return result;
}

/** Process all due reminders (run via cron/scheduler) */
async function processReminders() {
  const carts = await getCartsForReminder();
  const results = { sent: 0, failed: 0, skipped: 0 };
  
  for (const cart of carts) {
    const r = await sendReminder(cart);
    r.success ? results.sent++ : results.failed++;
    await new Promise(ok => setTimeout(ok, 1000)); // Rate limit
  }
  console.log(`[AbandonedCart] Processed: ${results.sent} sent, ${results.failed} failed`);
  return results;
}

/** Get recovery statistics */
async function getRecoveryStats(storeId, days = 30) {
  const db = getDb(), cutoff = new Date(Date.now() - days * 86400000);
  let query = db.collection('carts').where('abandonedAt', '>=', cutoff);
  if (storeId) query = query.where('storeId', '==', storeId);
  
  const snap = await query.get();
  const stats = { abandoned: 0, reminded: 0, converted: 0, recovered: 0, revenue: 0 };
  
  snap.forEach(doc => {
    const c = doc.data();
    stats.abandoned++;
    if (c.reminderCount > 0) stats.reminded++;
    if (c.status === 'converted' && c.reminderCount > 0) {
      stats.recovered++;
      stats.revenue += c.totalAmount || 0;
    }
  });
  stats.recoveryRate = stats.reminded > 0 ? ((stats.recovered / stats.reminded) * 100).toFixed(1) + '%' : '0%';
  return stats;
}

module.exports = { getCartsForReminder, sendReminder, processReminders, getRecoveryStats, MESSAGES };
