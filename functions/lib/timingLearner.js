/**
 * TimingLearner - Learn customer response patterns
 * Collection: stores/{storeId}/customerTiming/{customerId}
 */
const admin = require('firebase-admin');
const db = admin.firestore();
const TZ_OFFSET = 3; // Saudi Arabia UTC+3

const getLocalHour = (d = new Date()) => (d.getUTCHours() + TZ_OFFSET) % 24;
const getLocalDay = (d = new Date()) => d.getUTCDay();
const getRef = (storeId, customerId) => 
  db.collection('stores').doc(storeId).collection('customerTiming').doc(customerId);

/** Record when customer opens a message */
async function recordMessageOpen(storeId, customerId, timestamp = new Date()) {
  const hour = getLocalHour(timestamp), day = getLocalDay(timestamp);
  await getRef(storeId, customerId).set({
    lastOpen: timestamp,
    [`opens.hour_${hour}`]: admin.firestore.FieldValue.increment(1),
    [`opens.day_${day}`]: admin.firestore.FieldValue.increment(1),
    totalOpens: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { hour, day, recorded: true };
}

/** Record when customer replies */
async function recordReply(storeId, customerId, timestamp = new Date(), responseTimeMs = null) {
  const hour = getLocalHour(timestamp), day = getLocalDay(timestamp);
  const update = {
    lastReply: timestamp,
    [`replies.hour_${hour}`]: admin.firestore.FieldValue.increment(1),
    [`replies.day_${day}`]: admin.firestore.FieldValue.increment(1),
    totalReplies: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (responseTimeMs) {
    update.avgResponseTimeMs = admin.firestore.FieldValue.increment(responseTimeMs);
    update.responseTimeCount = admin.firestore.FieldValue.increment(1);
  }
  await getRef(storeId, customerId).set(update, { merge: true });
  return { hour, day, recorded: true };
}

/** Get customer's most active hours (top 3) */
async function getActiveHours(storeId, customerId) {
  const doc = await getRef(storeId, customerId).get();
  if (!doc.exists) return { hours: [], hasData: false };
  const data = doc.data(), hourCounts = [];
  for (let h = 0; h < 24; h++) {
    const opens = data.opens?.[`hour_${h}`] || 0;
    const replies = data.replies?.[`hour_${h}`] || 0;
    hourCounts.push({ hour: h, score: opens + replies * 2 });
  }
  hourCounts.sort((a, b) => b.score - a.score);
  const top = hourCounts.filter(h => h.score > 0).slice(0, 3);
  return { hours: top.map(h => h.hour), details: top, hasData: top.length > 0 };
}

/** Get best time to send next message */
async function getBestSendTime(storeId, customerId) {
  const { hours, hasData } = await getActiveHours(storeId, customerId);
  if (!hasData) return { hour: 16, confidence: 'low', reason: 'no_data' };
  const currentHour = getLocalHour();
  const future = hours.filter(h => h > currentHour);
  if (future.length > 0) return { hour: future[0], confidence: 'high', reason: 'learned' };
  return { hour: hours[0], confidence: 'high', reason: 'learned', tomorrow: true };
}

/** Get response patterns by hour and day */
async function getResponsePatterns(storeId, customerId) {
  const doc = await getRef(storeId, customerId).get();
  if (!doc.exists) return { patterns: null, hasData: false };
  const data = doc.data();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayScores = days.map((name, i) => ({
    day: name,
    opens: data.opens?.[`day_${i}`] || 0,
    replies: data.replies?.[`day_${i}`] || 0
  })).sort((a, b) => (b.opens + b.replies) - (a.opens + a.replies));
  const totalOpens = data.totalOpens || 0, totalReplies = data.totalReplies || 0;
  const responseRate = totalOpens > 0 ? (totalReplies / totalOpens * 100).toFixed(1) : 0;
  const avgMins = data.responseTimeCount > 0 
    ? Math.round(data.avgResponseTimeMs / data.responseTimeCount / 60000) : null;
  return {
    patterns: {
      bestDays: dayScores.slice(0, 3),
      responseRate: `${responseRate}%`,
      avgResponseMinutes: avgMins,
      totalInteractions: totalOpens + totalReplies
    },
    hasData: true
  };
}

/** Test with mock data */
async function runTest() {
  const storeId = 'test-store', customerId = 'test-customer-123';
  console.log('🧪 TimingLearner Test\n');
  
  // Simulate: 10:30 AM, 4 PM, 8 PM Saudi (UTC+3)
  const times = [
    new Date('2025-01-27T07:30:00Z'), new Date('2025-01-27T13:00:00Z'),
    new Date('2025-01-27T17:00:00Z'), new Date('2025-01-28T13:30:00Z'),
    new Date('2025-01-28T17:15:00Z'),
  ];
  for (const t of times) {
    await recordMessageOpen(storeId, customerId, t);
    if (Math.random() > 0.3) await recordReply(storeId, customerId, t, Math.random() * 300000);
  }
  console.log('✅ Recorded', times.length, 'interactions');
  
  const active = await getActiveHours(storeId, customerId);
  console.log('📊 Active hours:', active.hours.map(h => `${h}:00`).join(', '));
  
  const best = await getBestSendTime(storeId, customerId);
  console.log('⏰ Best send time:', `${best.hour}:00 (${best.confidence})`);
  
  const patterns = await getResponsePatterns(storeId, customerId);
  console.log('📈 Response rate:', patterns.patterns.responseRate);
  console.log('📅 Best days:', patterns.patterns.bestDays.map(d => d.day).join(', '));
  
  await getRef(storeId, customerId).delete();
  console.log('\n🧹 Cleaned up');
  return { success: true, active, best, patterns };
}

module.exports = { recordMessageOpen, recordReply, getActiveHours, getBestSendTime, getResponsePatterns, runTest };
