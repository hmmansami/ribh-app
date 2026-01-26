/**
 * RIBH Analytics Engine v2
 * Comprehensive metrics for cart recovery insights
 * Under 150 lines, pulls real Firestore data
 */

const admin = require('firebase-admin');
const db = () => admin.firestore();

// Time helpers
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const hourOf = (ts) => new Date(ts).getHours();
const dayOf = (ts) => new Date(ts).getDay();

/**
 * Get comprehensive analytics for a store
 */
async function getAnalytics(storeId, days = 30) {
  const cutoff = daysAgo(days).toISOString();
  
  // Fetch all events in parallel with error handling
  let events, carts, messages;
  try {
    [events, carts, messages] = await Promise.all([
      db().collection('analytics_events').where('data.storeId', '==', storeId).where('timestamp', '>=', cutoff).get(),
      db().collection('stores').doc(storeId).collection('abandoned_carts').where('createdAt', '>=', cutoff).get(),
      db().collection('stores').doc(storeId).collection('messages').where('sentAt', '>=', cutoff).get()
    ]);
  } catch (e) {
    console.warn('⚠️ Analytics fetch error:', e.message);
    events = { docs: [] }; carts = { docs: [] }; messages = { docs: [] };
  }

  const evts = events.docs.map(d => d.data());
  const cartDocs = carts.docs.map(d => ({ id: d.id, ...d.data() }));
  const msgDocs = messages.docs.map(d => d.data());

  // 1. Revenue Recovery
  const recovered = evts.filter(e => e.type === 'cart_recovered' || e.type === 'conversion');
  const revenue = { total: 0, byDay: {}, trend: [] };
  recovered.forEach(e => {
    const amt = e.data?.revenue || 0;
    revenue.total += amt;
    const day = e.timestamp?.split('T')[0];
    revenue.byDay[day] = (revenue.byDay[day] || 0) + amt;
  });
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i).toISOString().split('T')[0];
    revenue.trend.push({ date: d, amount: revenue.byDay[d] || 0 });
  }

  // 2. Funnel: Abandoned → Messaged → Opened → Recovered
  const funnel = {
    abandoned: cartDocs.length,
    messaged: msgDocs.filter(m => m.status === 'sent').length,
    opened: evts.filter(e => e.type === 'email_opened' || e.type === 'message_opened').length,
    clicked: evts.filter(e => e.type === 'email_clicked' || e.type === 'link_clicked').length,
    recovered: recovered.length
  };
  funnel.rates = {
    messageRate: pct(funnel.messaged, funnel.abandoned),
    openRate: pct(funnel.opened, funnel.messaged),
    clickRate: pct(funnel.clicked, funnel.opened),
    recoveryRate: pct(funnel.recovered, funnel.abandoned)
  };

  // 3. Best Performing Offers
  const offers = {};
  recovered.forEach(e => {
    const offer = e.data?.offer || e.data?.type || 'standard';
    offers[offer] = offers[offer] || { sent: 0, converted: 0, revenue: 0 };
    offers[offer].converted++;
    offers[offer].revenue += e.data?.revenue || 0;
  });
  msgDocs.forEach(m => {
    const offer = m.offerType || 'standard';
    offers[offer] = offers[offer] || { sent: 0, converted: 0, revenue: 0 };
    offers[offer].sent++;
  });
  const topOffers = Object.entries(offers).map(([name, data]) => ({
    name, ...data, rate: pct(data.converted, data.sent)
  })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // 4. Customer Segments
  const segments = { vip: { sent: 0, recovered: 0 }, new: { sent: 0, recovered: 0 }, dormant: { sent: 0, recovered: 0 }, regular: { sent: 0, recovered: 0 } };
  msgDocs.forEach(m => { const s = m.segment || 'regular'; if (segments[s]) segments[s].sent++; });
  recovered.forEach(e => { const s = e.data?.segment || 'regular'; if (segments[s]) segments[s].recovered++; });
  Object.keys(segments).forEach(k => segments[k].rate = pct(segments[k].recovered, segments[k].sent));

  // 5. Channel Performance
  const channels = { whatsapp: { sent: 0, opened: 0, converted: 0 }, sms: { sent: 0, opened: 0, converted: 0 }, email: { sent: 0, opened: 0, converted: 0 } };
  msgDocs.forEach(m => { const c = m.channel || 'whatsapp'; if (channels[c]) channels[c].sent++; });
  evts.filter(e => e.type?.includes('opened')).forEach(e => { const c = e.data?.channel || 'whatsapp'; if (channels[c]) channels[c].opened++; });
  recovered.forEach(e => { const c = e.data?.channel || 'whatsapp'; if (channels[c]) channels[c].converted++; });
  Object.keys(channels).forEach(k => {
    channels[k].openRate = pct(channels[k].opened, channels[k].sent);
    channels[k].convRate = pct(channels[k].converted, channels[k].sent);
  });

  // 6. Time Analysis
  const hourStats = Array(24).fill(0).map(() => ({ sent: 0, converted: 0 }));
  const dayStats = Array(7).fill(0).map(() => ({ sent: 0, converted: 0 }));
  msgDocs.forEach(m => { const h = hourOf(m.sentAt); const d = dayOf(m.sentAt); hourStats[h].sent++; dayStats[d].sent++; });
  recovered.forEach(e => { const h = hourOf(e.timestamp); const d = dayOf(e.timestamp); hourStats[h].converted++; dayStats[d].converted++; });
  const bestHour = hourStats.reduce((best, s, i) => pct(s.converted, s.sent) > pct(hourStats[best].converted, hourStats[best].sent) ? i : best, 0);
  const bestDay = dayStats.reduce((best, s, i) => pct(s.converted, s.sent) > pct(dayStats[best].converted, dayStats[best].sent) ? i : best, 0);
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // 7. Product Insights
  const products = {};
  cartDocs.forEach(c => {
    (c.items || []).forEach(item => {
      const name = item.name || item.title || 'منتج';
      products[name] = products[name] || { abandoned: 0, recovered: 0, revenue: 0 };
      products[name].abandoned++;
    });
  });
  recovered.forEach(e => {
    (e.data?.items || []).forEach(item => {
      const name = item.name || item.title || 'منتج';
      if (products[name]) { products[name].recovered++; products[name].revenue += item.price || 0; }
    });
  });
  const topProducts = Object.entries(products).map(([name, data]) => ({
    name, ...data, rate: pct(data.recovered, data.abandoned)
  })).sort((a, b) => b.abandoned - a.abandoned).slice(0, 5);

  // 8. ROI Calculator
  const subscriptionCost = 299; // Monthly cost in SAR
  const roi = {
    cost: subscriptionCost,
    recovered: revenue.total,
    roi: revenue.total > 0 ? Math.round((revenue.total - subscriptionCost) / subscriptionCost * 100) : 0,
    perCart: funnel.recovered > 0 ? Math.round(revenue.total / funnel.recovered) : 0
  };

  return {
    period: days,
    revenue,
    funnel,
    topOffers,
    segments,
    channels,
    timing: { bestHour, bestDay: dayNames[bestDay], hourStats, dayStats },
    topProducts,
    roi,
    insights: generateInsights({ funnel, channels, bestHour, dayNames, bestDay, revenue, roi })
  };
}

// Helper: percentage
function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }

// Generate actionable insights
function generateInsights(data) {
  const insights = [];
  if (data.funnel.rates.openRate < 30) insights.push('💡 معدل الفتح منخفض - جرب عناوين أقوى');
  if (data.channels.whatsapp.convRate > data.channels.email.convRate) insights.push('📱 واتساب يتفوق على الإيميل - ركز عليه');
  insights.push(`⏰ أفضل وقت للإرسال: ${data.bestHour}:00 - نحسّن الإرسال تلقائياً`);
  insights.push(`📅 أفضل يوم: ${data.dayNames[data.bestDay]}`);
  if (data.roi.roi > 100) insights.push(`🚀 عائد استثمارك ${data.roi.roi}% - استثمار ناجح!`);
  return insights;
}

module.exports = { getAnalytics, pct };
