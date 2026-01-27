/**
 * Customer Detection & Scoring Micro-Tools
 * Quick scoring functions for prioritizing customer outreach
 */

/**
 * Score urgency to contact this customer (0-100)
 * Higher = more urgent to reach out NOW
 */
function scoreUrgency(customer) {
  let score = 0;
  const { cartValue = 0, hoursSinceAbandon = 0, churnRisk = 0 } = customer;
  
  // Cart value weight (0-40 points)
  if (cartValue > 500) score += 40;
  else if (cartValue > 200) score += 30;
  else if (cartValue > 50) score += 20;
  else if (cartValue > 0) score += 10;
  
  // Time decay - fresher = more urgent (0-35 points)
  if (hoursSinceAbandon < 1) score += 35;
  else if (hoursSinceAbandon < 6) score += 30;
  else if (hoursSinceAbandon < 24) score += 20;
  else if (hoursSinceAbandon < 72) score += 10;
  
  // Churn risk boost (0-25 points)
  score += Math.min(churnRisk * 0.25, 25);
  
  return Math.min(Math.round(score), 100);
}

/**
 * Score revenue potential (0-100)
 * Higher = more valuable customer to pursue
 */
function scorePotential(customer) {
  let score = 0;
  const { predictedCLV = 0, pastOrderCount = 0, pastOrderTotal = 0, segment = 'unknown' } = customer;
  
  // Predicted CLV weight (0-40 points)
  score += Math.min((predictedCLV / 100) * 4, 40);
  
  // Past order history (0-30 points)
  score += Math.min(pastOrderCount * 3, 15);
  score += Math.min((pastOrderTotal / 500) * 15, 15);
  
  // Segment multiplier (0-30 points)
  const segmentScores = { vip: 30, loyal: 25, returning: 20, new: 15, unknown: 10 };
  score += segmentScores[segment] || 10;
  
  return Math.min(Math.round(score), 100);
}

/**
 * Score engagement level (0-100)
 * Higher = more actively engaged with brand
 */
function scoreEngagement(customer) {
  let score = 0;
  const { 
    emailOpenRate = 0,      // 0-1
    siteVisitsLast30d = 0,
    whatsappReplyRate = 0   // 0-1
  } = customer;
  
  // Email engagement (0-30 points)
  score += emailOpenRate * 30;
  
  // Site visits (0-35 points)
  if (siteVisitsLast30d >= 10) score += 35;
  else if (siteVisitsLast30d >= 5) score += 25;
  else if (siteVisitsLast30d >= 2) score += 15;
  else if (siteVisitsLast30d >= 1) score += 5;
  
  // WhatsApp responsiveness (0-35 points)
  score += whatsappReplyRate * 35;
  
  return Math.min(Math.round(score), 100);
}

/**
 * Detect best channel to reach customer
 * Returns: 'whatsapp' | 'sms' | 'email'
 */
function detectBestChannel(customer) {
  const {
    whatsappResponseRate = 0,
    smsResponseRate = 0,
    emailResponseRate = 0,
    hasWhatsapp = true,
    preferredChannel = null
  } = customer;
  
  // Respect explicit preference
  if (preferredChannel && ['whatsapp', 'sms', 'email'].includes(preferredChannel)) {
    return preferredChannel;
  }
  
  // Score each channel
  const channels = [
    { name: 'whatsapp', rate: hasWhatsapp ? whatsappResponseRate : 0 },
    { name: 'sms', rate: smsResponseRate },
    { name: 'email', rate: emailResponseRate }
  ];
  
  // Sort by response rate, default to WhatsApp for ties
  channels.sort((a, b) => b.rate - a.rate);
  return channels[0].rate > 0 ? channels[0].name : 'whatsapp';
}

/**
 * Detect buying intent level
 * Returns: 'high' | 'medium' | 'low'
 */
function detectBuyingIntent(customer) {
  let intentScore = 0;
  const {
    pagesViewedLast7d = 0,
    productPagesViewed = 0,
    timeOnSiteMinutes = 0,
    cartAddsLast7d = 0,
    checkoutStarted = false
  } = customer;
  
  // Checkout started is strong signal
  if (checkoutStarted) intentScore += 40;
  
  // Cart adds (0-25)
  intentScore += Math.min(cartAddsLast7d * 8, 25);
  
  // Product pages viewed (0-20)
  intentScore += Math.min(productPagesViewed * 4, 20);
  
  // Time on site (0-10)
  intentScore += Math.min(timeOnSiteMinutes * 2, 10);
  
  // General browsing (0-5)
  intentScore += Math.min(pagesViewedLast7d, 5);
  
  if (intentScore >= 50) return 'high';
  if (intentScore >= 25) return 'medium';
  return 'low';
}

module.exports = {
  scoreUrgency,
  scorePotential,
  scoreEngagement,
  detectBestChannel,
  detectBuyingIntent
};

// ============ TEST WITH MOCK DATA ============
if (require.main === module) {
  const mockCustomers = [
    {
      name: 'Hot Lead - Ahmed',
      cartValue: 350,
      hoursSinceAbandon: 2,
      churnRisk: 60,
      predictedCLV: 800,
      pastOrderCount: 5,
      pastOrderTotal: 1200,
      segment: 'loyal',
      emailOpenRate: 0.4,
      siteVisitsLast30d: 8,
      whatsappReplyRate: 0.9,
      whatsappResponseRate: 0.85,
      smsResponseRate: 0.3,
      emailResponseRate: 0.2,
      hasWhatsapp: true,
      pagesViewedLast7d: 15,
      productPagesViewed: 6,
      timeOnSiteMinutes: 12,
      cartAddsLast7d: 3,
      checkoutStarted: true
    },
    {
      name: 'Cold Lead - Sara',
      cartValue: 45,
      hoursSinceAbandon: 120,
      churnRisk: 20,
      predictedCLV: 150,
      pastOrderCount: 1,
      pastOrderTotal: 80,
      segment: 'new',
      emailOpenRate: 0.1,
      siteVisitsLast30d: 1,
      whatsappReplyRate: 0,
      whatsappResponseRate: 0,
      smsResponseRate: 0.1,
      emailResponseRate: 0.15,
      hasWhatsapp: false,
      pagesViewedLast7d: 3,
      productPagesViewed: 1,
      timeOnSiteMinutes: 2,
      cartAddsLast7d: 0,
      checkoutStarted: false
    },
    {
      name: 'VIP - Khalid',
      cartValue: 1200,
      hoursSinceAbandon: 0.5,
      churnRisk: 80,
      predictedCLV: 5000,
      pastOrderCount: 25,
      pastOrderTotal: 8500,
      segment: 'vip',
      emailOpenRate: 0.7,
      siteVisitsLast30d: 15,
      whatsappReplyRate: 0.95,
      whatsappResponseRate: 0.9,
      smsResponseRate: 0.5,
      emailResponseRate: 0.6,
      hasWhatsapp: true,
      pagesViewedLast7d: 20,
      productPagesViewed: 8,
      timeOnSiteMinutes: 25,
      cartAddsLast7d: 4,
      checkoutStarted: true
    }
  ];

  console.log('🎯 Customer Scoring Test Results\n');
  console.log('='.repeat(60));
  
  mockCustomers.forEach(c => {
    console.log(`\n📧 ${c.name}`);
    console.log('-'.repeat(40));
    console.log(`  Urgency:      ${scoreUrgency(c).toString().padStart(3)}/100`);
    console.log(`  Potential:    ${scorePotential(c).toString().padStart(3)}/100`);
    console.log(`  Engagement:   ${scoreEngagement(c).toString().padStart(3)}/100`);
    console.log(`  Best Channel: ${detectBestChannel(c)}`);
    console.log(`  Intent:       ${detectBuyingIntent(c)}`);
  });
  
  console.log('\n' + '='.repeat(60));
}
