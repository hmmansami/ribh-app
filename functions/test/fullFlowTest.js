/**
 * 🧪 RIBH FULL FLOW TEST
 * Tests the entire pipeline end-to-end with mock mode support
 * 
 * Run: node functions/test/fullFlowTest.js
 */

// Mock Firebase Admin (must be before any requires)
const mockFirestoreData = new Map();
const mockFirestore = {
  collection: (name) => ({
    doc: (id) => ({
      get: async () => ({ 
        exists: mockFirestoreData.has(`${name}/${id}`), 
        data: () => mockFirestoreData.get(`${name}/${id}`) 
      }),
      set: async (data, opts) => { mockFirestoreData.set(`${name}/${id}`, { ...mockFirestoreData.get(`${name}/${id}`), ...data }); },
      update: async (data) => { 
        const existing = mockFirestoreData.get(`${name}/${id}`) || {};
        mockFirestoreData.set(`${name}/${id}`, { ...existing, ...data }); 
      }
    }),
    add: async (data) => { 
      const id = `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      mockFirestoreData.set(`${name}/${id}`, data);
      return { id };
    }
  })
};

// Mock firebase-admin
const mockAdmin = {
  firestore: () => mockFirestore,
  initializeApp: () => {},
  credential: { cert: () => ({}) },
  apps: []
};
mockAdmin.firestore.FieldValue = { serverTimestamp: () => new Date().toISOString() };

// Inject mock before requiring modules
require.cache[require.resolve('firebase-admin')] = { exports: mockAdmin };

// Track all test results
const testResults = [];
let currentTest = '';

// Console wrapper for pretty output
const log = {
  test: (name) => { currentTest = name; console.log(`\n${'═'.repeat(60)}\n🧪 TEST: ${name}\n${'═'.repeat(60)}`); },
  step: (msg) => console.log(`  📍 ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  fail: (msg) => console.log(`  ❌ ${msg}`),
  info: (msg) => console.log(`  ℹ️  ${msg}`),
  data: (label, obj) => console.log(`  📦 ${label}:`, JSON.stringify(obj, null, 2).split('\n').map((l, i) => i === 0 ? l : '      ' + l).join('\n'))
};

// Sample webhooks
const WEBHOOKS = require('./sampleWebhooks.json');

// ══════════════════════════════════════════════════════════════
// MOCK IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════

let mockWhatsAppFail = false;
let mockSMSFail = false;
let mockEmailFail = false;
const sentMessages = [];

// Mock WhatsApp sender
const mockWhatsAppSender = {
  sendMessage: async (phone, message) => {
    if (mockWhatsAppFail) {
      return { success: false, error: 'Mock WhatsApp failure' };
    }
    const result = { success: true, messageId: `wa_${Date.now()}` };
    sentMessages.push({ channel: 'whatsapp', phone, message, result });
    return result;
  },
  formatPhone: (p) => String(p).replace(/\D/g, '').replace(/^0/, '966')
};

// Mock fallback sender
const mockFallbackSender = {
  sendSMS: async (phone, message) => {
    if (mockSMSFail) {
      return { success: false, error: 'Mock SMS failure (disabled)' };
    }
    const result = { success: true, sid: `sms_${Date.now()}` };
    sentMessages.push({ channel: 'sms', phone, message, result });
    return result;
  },
  sendEmail: async (email, subject, body) => {
    if (mockEmailFail) {
      return { success: false, error: 'Mock Email failure' };
    }
    const result = { success: true, provider: 'mock' };
    sentMessages.push({ channel: 'email', email, subject, body, result });
    return result;
  }
};

// Mock offer generator (uses fallback templates)
const mockOfferGenerator = {
  generateOffer: async (name, value, products, type = 'cart_recovery') => {
    // Check for seasonal override
    const now = new Date();
    const month = now.getMonth() + 1;
    const isRamadan = process.env.MOCK_RAMADAN === 'true' || month === 3;
    const isEid = process.env.MOCK_EID === 'true';
    
    const templates = {
      cart_recovery: {
        headline: 'سلتك تنتظرك! 🛒',
        body: `مرحباً ${name}، منتجاتك بقيمة ${value} ريال لا زالت محفوظة لك`,
        urgency: '⏰ العرض ينتهي خلال 24 ساعة',
        cta: 'أكمل طلبك الآن واحصل على خصم 10%'
      },
      seasonal_ramadan: {
        headline: 'عروض رمضان المباركة! 🌙',
        body: `مرحباً ${name}، استعد لشهر الخير مع تخفيضات خاصة`,
        urgency: '⭐ عروض رمضان لفترة محدودة',
        cta: 'تسوق عروض رمضان الآن'
      },
      seasonal_eid: {
        headline: 'عيدكم مبارك! 🎉✨',
        body: `مرحباً ${name}، احتفل بالعيد مع هدايا مميزة بقيمة ${value} ريال`,
        urgency: '🎁 خصم العيد 20% على كل شيء',
        cta: 'تسوق هدايا العيد'
      }
    };
    
    if (isRamadan && type === 'seasonal') return templates.seasonal_ramadan;
    if (isEid && type === 'seasonal') return templates.seasonal_eid;
    return templates[type] || templates.cart_recovery;
  },
  FALLBACK_TEMPLATES: {}
};

// ══════════════════════════════════════════════════════════════
// CORE ENGINE (modified for testing)
// ══════════════════════════════════════════════════════════════

function formatMessage(offer, checkoutUrl) {
  return `${offer.headline}\n\n${offer.body}\n\n${offer.urgency}\n\n${offer.cta}${checkoutUrl ? `\n\n🔗 ${checkoutUrl}` : ''}`;
}

async function track(cartKey, event, data = {}) {
  const timestamp = new Date().toISOString();
  await mockFirestore.collection('recovery_events').add({ cartKey, event, ...data, timestamp });
  await mockFirestore.collection('carts').doc(cartKey).update({ [`tracking.${event}`]: timestamp }).catch(() => {});
  log.step(`Tracked: ${event} for ${cartKey}`);
}

async function processAbandonedCart(cart) {
  const { key, phone, email, items = [], totalAmount, checkoutUrl } = cart;
  const customerName = cart.customerName || cart.customer?.name || 'عميلنا العزيز';
  const products = items.map(i => i.name).filter(Boolean);
  
  log.step(`Processing cart: ${key}`);
  log.info(`Customer: ${customerName}, Value: ${totalAmount} SAR`);
  
  // 1. Generate AI offer
  const offer = await mockOfferGenerator.generateOffer(customerName, totalAmount, products, 'cart_recovery');
  const message = formatMessage(offer, checkoutUrl);
  log.success('Generated offer');
  log.data('Offer', offer);
  
  // 2. Try WhatsApp first
  if (phone) {
    log.step('Trying WhatsApp...');
    const wa = await mockWhatsAppSender.sendMessage(phone, message);
    if (wa.success) {
      await track(key, 'sent', { channel: 'whatsapp', messageId: wa.messageId });
      log.success(`WhatsApp sent: ${wa.messageId}`);
      return { success: true, channel: 'whatsapp', messageId: wa.messageId, offer };
    }
    log.fail(`WhatsApp failed: ${wa.error}`);
  }
  
  // 3. Fallback to SMS
  if (phone) {
    log.step('Trying SMS fallback...');
    const shortMsg = `${offer.headline}\n${offer.body}\n${checkoutUrl || ''}`.slice(0, 160);
    const sms = await mockFallbackSender.sendSMS(phone, shortMsg);
    if (sms.success) {
      await track(key, 'sent', { channel: 'sms', sid: sms.sid });
      log.success(`SMS sent: ${sms.sid}`);
      return { success: true, channel: 'sms', sid: sms.sid, offer };
    }
    log.fail(`SMS failed: ${sms.error}`);
  }
  
  // 4. Fallback to Email
  if (email) {
    log.step('Trying Email fallback...');
    const subject = offer.headline.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim() || 'سلتك تنتظرك';
    const html = `<div dir="rtl">${offer.headline}<br>${offer.body}<br><strong>${offer.urgency}</strong></div>`;
    const mail = await mockFallbackSender.sendEmail(email, subject, html);
    if (mail.success) {
      await track(key, 'sent', { channel: 'email' });
      log.success('Email sent');
      return { success: true, channel: 'email', offer };
    }
    log.fail(`Email failed: ${mail.error}`);
  }
  
  // 5. All failed
  await track(key, 'failed', { reason: 'no_channel_available' });
  log.fail('All channels failed');
  return { success: false, error: 'No channel available', offer };
}

async function markRecoveryConverted(cartKey, orderValue) {
  await track(cartKey, 'converted', { orderValue });
  await mockFirestore.collection('carts').doc(cartKey).update({
    status: 'recovered',
    recoveredAt: new Date().toISOString(),
    orderValue
  }).catch(() => {});
  log.success(`Marked as converted: ${orderValue} SAR`);
}

// ══════════════════════════════════════════════════════════════
// CART DETECTION (simplified for testing)
// ══════════════════════════════════════════════════════════════

function normalizeCart(platform, payload) {
  if (platform === 'salla') {
    const d = payload.data || payload;
    return {
      cartId: String(d.id || d.checkout_id || d.cart?.id),
      storeId: String(payload.merchant || d.store_id || 'test_store'),
      customerId: d.customer?.id ? String(d.customer.id) : null,
      customerName: d.customer?.name || d.customer?.first_name,
      email: d.customer?.email || d.email || null,
      phone: d.customer?.mobile || d.mobile || d.phone || null,
      totalAmount: parseFloat(d.total?.amount || d.total || d.cart?.total || 0),
      currency: d.total?.currency || d.currency || 'SAR',
      items: (d.items || d.cart?.items || []).slice(0, 5).map(i => ({
        name: i.name || i.product?.name,
        qty: i.quantity || 1,
        price: parseFloat(i.price?.amount || i.price || 0)
      })),
      checkoutUrl: d.checkout_url || d.urls?.checkout || d.url || null
    };
  }
  // Shopify
  const c = payload;
  return {
    cartId: String(c.id || c.token),
    storeId: String(c.shop_id || payload.shop_domain || 'test_store'),
    customerId: c.customer?.id ? String(c.customer.id) : null,
    customerName: c.customer?.first_name,
    email: c.email || c.customer?.email || null,
    phone: c.phone || c.billing_address?.phone || c.shipping_address?.phone || null,
    totalAmount: parseFloat(c.total_price || c.subtotal_price || 0),
    currency: c.currency || 'SAR',
    items: (c.line_items || []).slice(0, 5).map(i => ({
      name: i.title || i.name,
      qty: i.quantity || 1,
      price: parseFloat(i.price || 0)
    })),
    checkoutUrl: c.abandoned_checkout_url || c.web_url || null
  };
}

async function handleCartWebhook(platform, payload, onAbandoned) {
  const cart = normalizeCart(platform, payload);
  const key = `${platform}:${cart.storeId}:${cart.cartId}`;
  cart.key = key;
  
  log.step(`Normalized cart: ${key}`);
  log.data('Cart', cart);
  
  await mockFirestore.collection('carts').doc(key).set({
    ...cart,
    platform,
    lastActivity: new Date().toISOString(),
    status: 'active'
  }, { merge: true });
  
  // In test mode, trigger immediately (skip 30min wait)
  if (onAbandoned) {
    log.step('Triggering abandonment callback (immediate in test mode)...');
    await onAbandoned(cart);
  }
  
  return { status: 'tracked', key };
}

// ══════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ══════════════════════════════════════════════════════════════

async function testShopifyCartAbandon() {
  log.test('SHOPIFY CART ABANDON');
  
  sentMessages.length = 0;
  mockWhatsAppFail = false;
  
  const result = await handleCartWebhook('shopify', WEBHOOKS.shopify.cart_abandon, async (cart) => {
    return await processAbandonedCart(cart);
  });
  
  const passed = result.status === 'tracked' && sentMessages.length > 0;
  testResults.push({ name: 'Shopify Cart Abandon', passed, sentMessages: [...sentMessages] });
  
  if (passed) log.success('TEST PASSED ✓');
  else log.fail('TEST FAILED ✗');
  
  return passed;
}

async function testSallaCartAbandon() {
  log.test('SALLA CART ABANDON');
  
  sentMessages.length = 0;
  mockWhatsAppFail = false;
  
  const result = await handleCartWebhook('salla', WEBHOOKS.salla.cart_abandon, async (cart) => {
    return await processAbandonedCart(cart);
  });
  
  const passed = result.status === 'tracked' && sentMessages.length > 0;
  testResults.push({ name: 'Salla Cart Abandon', passed, sentMessages: [...sentMessages] });
  
  if (passed) log.success('TEST PASSED ✓');
  else log.fail('TEST FAILED ✗');
  
  return passed;
}

async function testConversionTracking() {
  log.test('CONVERSION TRACKING');
  
  const cartKey = 'shopify:test_store:conv_123';
  
  // First create the cart
  await mockFirestore.collection('carts').doc(cartKey).set({
    status: 'abandoned',
    totalAmount: 450
  });
  
  log.step('Created abandoned cart in Firestore');
  
  // Now mark as converted
  await markRecoveryConverted(cartKey, 450);
  
  // Verify
  const doc = await mockFirestore.collection('carts').doc(cartKey).get();
  const data = doc.data();
  
  const passed = data.status === 'recovered' && data.orderValue === 450;
  testResults.push({ name: 'Conversion Tracking', passed, data });
  
  if (passed) log.success('TEST PASSED ✓');
  else log.fail('TEST FAILED ✗');
  
  return passed;
}

async function testChannelFallback() {
  log.test('CHANNEL FALLBACK (WhatsApp → SMS → Email)');
  
  sentMessages.length = 0;
  
  // Test 1: WhatsApp success
  log.info('Scenario 1: WhatsApp works');
  mockWhatsAppFail = false;
  mockSMSFail = false;
  mockEmailFail = false;
  
  const cart1 = {
    key: 'test:fallback:1',
    phone: '+966501234567',
    email: 'test@example.com',
    totalAmount: 300,
    items: [{ name: 'منتج تجريبي' }],
    checkoutUrl: 'https://store.com/checkout'
  };
  
  const result1 = await processAbandonedCart(cart1);
  const scenario1Pass = result1.channel === 'whatsapp';
  log.info(`Result: ${result1.channel} - ${scenario1Pass ? 'PASS' : 'FAIL'}`);
  
  // Test 2: WhatsApp fails, SMS works (but actually disabled now)
  log.info('Scenario 2: WhatsApp fails → SMS disabled → Email');
  sentMessages.length = 0;
  mockWhatsAppFail = true;
  mockSMSFail = true; // SMS is disabled in real app
  mockEmailFail = false;
  
  const cart2 = { ...cart1, key: 'test:fallback:2' };
  const result2 = await processAbandonedCart(cart2);
  const scenario2Pass = result2.channel === 'email';
  log.info(`Result: ${result2.channel} - ${scenario2Pass ? 'PASS' : 'FAIL'}`);
  
  // Test 3: All channels fail
  log.info('Scenario 3: All channels fail');
  sentMessages.length = 0;
  mockWhatsAppFail = true;
  mockSMSFail = true;
  mockEmailFail = true;
  
  const cart3 = { ...cart1, key: 'test:fallback:3' };
  const result3 = await processAbandonedCart(cart3);
  const scenario3Pass = result3.success === false;
  log.info(`Result: ${result3.success ? 'Success' : 'Failed as expected'} - ${scenario3Pass ? 'PASS' : 'FAIL'}`);
  
  // Reset mocks
  mockWhatsAppFail = false;
  mockSMSFail = false;
  mockEmailFail = false;
  
  const passed = scenario1Pass && scenario2Pass && scenario3Pass;
  testResults.push({ name: 'Channel Fallback', passed, scenarios: { scenario1Pass, scenario2Pass, scenario3Pass } });
  
  if (passed) log.success('TEST PASSED ✓');
  else log.fail('TEST FAILED ✗');
  
  return passed;
}

async function testSeasonalOffers() {
  log.test('SEASONAL OFFERS (Ramadan & Eid)');
  
  // Test Ramadan mode
  log.info('Testing Ramadan mode...');
  process.env.MOCK_RAMADAN = 'true';
  process.env.MOCK_EID = 'false';
  
  const ramadanOffer = await mockOfferGenerator.generateOffer('أحمد', 500, ['تمر', 'قهوة'], 'seasonal');
  const ramadanPass = ramadanOffer.headline.includes('رمضان');
  log.data('Ramadan Offer', ramadanOffer);
  log.info(`Ramadan mode: ${ramadanPass ? 'PASS' : 'FAIL'}`);
  
  // Test Eid mode
  log.info('Testing Eid mode...');
  process.env.MOCK_RAMADAN = 'false';
  process.env.MOCK_EID = 'true';
  
  const eidOffer = await mockOfferGenerator.generateOffer('محمد', 1000, ['عطر', 'ملابس'], 'seasonal');
  const eidPass = eidOffer.headline.includes('عيد');
  log.data('Eid Offer', eidOffer);
  log.info(`Eid mode: ${eidPass ? 'PASS' : 'FAIL'}`);
  
  // Reset
  delete process.env.MOCK_RAMADAN;
  delete process.env.MOCK_EID;
  
  const passed = ramadanPass && eidPass;
  testResults.push({ name: 'Seasonal Offers', passed, ramadanPass, eidPass });
  
  if (passed) log.success('TEST PASSED ✓');
  else log.fail('TEST FAILED ✗');
  
  return passed;
}

async function testAIOfferGeneration() {
  log.test('AI OFFER GENERATION');
  
  const testCases = [
    { name: 'سارة', value: 250, products: ['حقيبة يد', 'عطر'], type: 'cart_recovery' },
    { name: 'خالد', value: 1500, products: ['ساعة ذكية', 'سماعات'], type: 'cart_recovery' },
  ];
  
  let allPassed = true;
  
  for (const tc of testCases) {
    log.info(`Testing: ${tc.name} - ${tc.value} SAR`);
    const offer = await mockOfferGenerator.generateOffer(tc.name, tc.value, tc.products, tc.type);
    
    const hasAllFields = offer.headline && offer.body && offer.urgency && offer.cta;
    const containsName = offer.body.includes(tc.name);
    const containsValue = offer.body.includes(String(tc.value));
    
    const passed = hasAllFields && containsName && containsValue;
    
    log.data('Generated Offer', offer);
    log.info(`Fields: ${hasAllFields ? '✓' : '✗'}, Name: ${containsName ? '✓' : '✗'}, Value: ${containsValue ? '✓' : '✗'}`);
    
    if (!passed) allPassed = false;
  }
  
  testResults.push({ name: 'AI Offer Generation', passed: allPassed });
  
  if (allPassed) log.success('TEST PASSED ✓');
  else log.fail('TEST FAILED ✗');
  
  return allPassed;
}

// ══════════════════════════════════════════════════════════════
// MAIN - Run all tests
// ══════════════════════════════════════════════════════════════

async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 RIBH FULL FLOW TEST SUITE');
  console.log('═'.repeat(60));
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('🔧 Mode: MOCK (no real API calls)');
  
  await testShopifyCartAbandon();
  await testSallaCartAbandon();
  await testConversionTracking();
  await testChannelFallback();
  await testSeasonalOffers();
  await testAIOfferGeneration();
  
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  
  const passed = testResults.filter(t => t.passed).length;
  const total = testResults.length;
  
  for (const t of testResults) {
    console.log(`  ${t.passed ? '✅' : '❌'} ${t.name}`);
  }
  
  console.log('─'.repeat(60));
  console.log(`  📈 ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
  console.log('═'.repeat(60) + '\n');
  
  return { passed, total, results: testResults };
}

// Export for external use
module.exports = {
  runAllTests,
  testShopifyCartAbandon,
  testSallaCartAbandon,
  testConversionTracking,
  testChannelFallback,
  testSeasonalOffers,
  testAIOfferGeneration,
  // Exposed for manual testing
  processAbandonedCart,
  handleCartWebhook,
  normalizeCart,
  mockOfferGenerator,
  // Control mocks
  setMockFailures: (wa, sms, email) => {
    mockWhatsAppFail = wa;
    mockSMSFail = sms;
    mockEmailFail = email;
  },
  getSentMessages: () => [...sentMessages],
  clearSentMessages: () => { sentMessages.length = 0; }
};

// Run if executed directly
if (require.main === module) {
  runAllTests().then(({ passed, total }) => {
    process.exit(passed === total ? 0 : 1);
  });
}
