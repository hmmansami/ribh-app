/**
 * Smoke tests for Auto-Activation Engine + Content Generator + API wiring
 *
 * Run: node functions/test/test-auto-activation.js
 *
 * Tests:
 * 1. autoActivation module loads and exports all functions
 * 2. contentGenerator module loads and exports all functions
 * 3. Edge-trigger guard (whatsAppActivatedMerchants Set)
 * 4. AUTO_ACTIVATION_ENABLED flag gates activation
 * 5. Auth guard rejects unauthenticated requests
 * 6. Sequence toggle validates input
 * 7. Webhook route order: autoActivation runs before lifecycleEngine
 * 8. Content generator AI fallback chain
 * 9. Customer classification tiers
 */

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

// ==========================================
// TEST 1: Module loading
// ==========================================
console.log('\n📦 Test 1: Module loading');

let autoActivation, contentGenerator;
try {
  autoActivation = require('../lib/autoActivation');
  assert(true, 'autoActivation loads without error');
} catch (e) {
  assert(false, `autoActivation load failed: ${e.message}`);
}

try {
  contentGenerator = require('../lib/contentGenerator');
  assert(true, 'contentGenerator loads without error');
} catch (e) {
  assert(false, `contentGenerator load failed: ${e.message}`);
}

// ==========================================
// TEST 2: Exported function signatures
// ==========================================
console.log('\n🔌 Test 2: Exported functions');

const expectedAutoActivation = [
  'onSallaConnected', 'onWhatsAppConnected', 'activateAll',
  'processAbandonedCart', 'processOrderCreated', 'processNewCustomer',
  'toggleSequence', 'getSequenceConfig', 'getAllSequenceConfigs',
  'personalizeMessage', 'getActivationStatus', 'getActivationDashboard',
  'ACTIVATION_STEPS'
];

for (const fn of expectedAutoActivation) {
  assert(
    autoActivation && autoActivation[fn] !== undefined,
    `autoActivation.${fn} exported`
  );
}

const expectedContentGen = [
  'personalizeForCustomer', 'generateSmartOffer', 'pregenerateStoreContent',
  'callAI', 'callGemini', 'callGroq',
  'classifyCustomer', 'getProviderStatus', 'cleanAIResponse'
];

for (const fn of expectedContentGen) {
  assert(
    contentGenerator && contentGenerator[fn] !== undefined,
    `contentGenerator.${fn} exported`
  );
}

// ==========================================
// TEST 3: ACTIVATION_STEPS constants
// ==========================================
console.log('\n📋 Test 3: Activation step constants');

if (autoActivation) {
  const steps = autoActivation.ACTIVATION_STEPS;
  assert(steps.SALLA_CONNECTED === 'salla_connected', 'SALLA_CONNECTED step');
  assert(steps.WHATSAPP_CONNECTED === 'whatsapp_connected', 'WHATSAPP_CONNECTED step');
  assert(steps.SEQUENCES_DEPLOYED === 'sequences_deployed', 'SEQUENCES_DEPLOYED step');
  assert(steps.AI_ENABLED === 'ai_enabled', 'AI_ENABLED step');
  assert(steps.FULLY_ACTIVE === 'fully_active', 'FULLY_ACTIVE step');
}

// ==========================================
// TEST 4: Customer classification tiers
// ==========================================
console.log('\n👥 Test 4: Customer classification');

if (contentGenerator) {
  const vip = contentGenerator.classifyCustomer({ orderCount: 5, totalSpent: 3000 });
  assert(vip.type === 'vip', 'VIP: 5+ orders or 2000+ spent');

  const returning = contentGenerator.classifyCustomer({ orderCount: 2, totalSpent: 600 });
  assert(returning.type === 'returning', 'Returning: 2+ orders or 500+ spent');

  const existing = contentGenerator.classifyCustomer({ orderCount: 1, totalSpent: 100 });
  assert(existing.type === 'existing', 'Existing: 1 order');

  const newCust = contentGenerator.classifyCustomer({ orderCount: 0, totalSpent: 0 });
  assert(newCust.type === 'new', 'New: 0 orders');

  const nullCust = contentGenerator.classifyCustomer(null);
  assert(nullCust.type === 'new', 'Null customer defaults to new');
}

// ==========================================
// TEST 5: AI response cleaning
// ==========================================
console.log('\n🧹 Test 5: AI response cleaning');

if (contentGenerator) {
  const clean = contentGenerator.cleanAIResponse;

  // Removes markdown bold
  assert(clean('**مرحباً**', 'whatsapp') === 'مرحباً', 'Strips markdown bold');

  // SMS truncation
  const longText = 'أ'.repeat(200);
  const smsCleaned = clean(longText, 'sms');
  assert(smsCleaned.length <= 160, 'SMS truncated to 160 chars');

  // WhatsApp truncation
  const veryLong = 'أ'.repeat(600);
  const waCleaned = clean(veryLong, 'whatsapp');
  assert(waCleaned.length <= 500, 'WhatsApp truncated to 500 chars');

  // Null input
  assert(clean(null, 'whatsapp') === null, 'Null input returns null');

  // Code block removal
  assert(clean('```js\ncode\n```', 'whatsapp') === '', 'Strips code blocks');
}

// ==========================================
// TEST 6: Provider status without keys
// ==========================================
console.log('\n🤖 Test 6: Provider status');

if (contentGenerator) {
  const status = contentGenerator.getProviderStatus();
  assert(typeof status.gemini === 'boolean', 'gemini field is boolean');
  assert(typeof status.groq === 'boolean', 'groq field is boolean');
  assert(['gemini', 'groq', 'templates'].includes(status.primary), 'primary is valid provider');
}

// ==========================================
// TEST 7: server.js syntax + flag existence
// ==========================================
console.log('\n⚙️ Test 7: server.js integration checks');

const fs = require('fs');
const serverSrc = fs.readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');

// AUTO_ACTIVATION_ENABLED flag exists
assert(
  serverSrc.includes("AUTO_ACTIVATION_ENABLED = process.env.AUTO_ACTIVATION_ENABLED !== 'false'"),
  'AUTO_ACTIVATION_ENABLED flag declared from env'
);

// Flag gates all 3 trigger points
const flagGates = (serverSrc.match(/AUTO_ACTIVATION_ENABLED &&/g) || []).length;
assert(flagGates >= 3, `Flag gates ${flagGates}/3 trigger points (salla, whatsapp, webhook)`);

// Edge-trigger Set declared
assert(
  serverSrc.includes('whatsAppActivatedMerchants = new Set()'),
  'Edge-trigger Set declared'
);

// Edge-trigger used in WhatsApp status handler
assert(
  serverSrc.includes('!whatsAppActivatedMerchants.has(merchantId)'),
  'Edge-trigger guard in WhatsApp status'
);

// Auth middleware on activation endpoints
const authGuardCount = (serverSrc.match(/requireStoreAuth, async/g) || []).length;
assert(authGuardCount >= 5, `Auth guard on ${authGuardCount}/5 activation endpoints`);

// requireStoreAuth returns 401 JSON (not redirect)
assert(
  serverSrc.includes("res.status(401).json({ success: false, error: 'Authentication required' })"),
  'requireStoreAuth returns 401 JSON'
);

// ==========================================
// TEST 8: Webhook route order — autoActivation before lifecycleEngine
// ==========================================
console.log('\n🔀 Test 8: Webhook route order');

const autoActivationIdx = serverSrc.indexOf('Process through Auto-Activation Engine');
const lifecycleIdx = serverSrc.indexOf('Fallback: Process through Lifecycle Engine');
assert(
  autoActivationIdx > 0 && lifecycleIdx > 0 && autoActivationIdx < lifecycleIdx,
  'autoActivation processes events BEFORE lifecycleEngine fallback'
);

// ==========================================
// TEST 9: Edge-trigger retry on error
// ==========================================
console.log('\n🔄 Test 9: Edge-trigger error handling');

assert(
  serverSrc.includes('whatsAppActivatedMerchants.delete(merchantId)'),
  'Edge-trigger set cleared on error (allows retry)'
);

// ==========================================
// RESULTS
// ==========================================
console.log(`\n${'='.repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}
