/**
 * 🧪 RIBH End-to-End Test (No Second Device Needed)
 * Tests the full flow: webhook → cart processing → offer generation
 */
const BASE_URL = process.env.RIBH_URL || 'https://ribh-app.onrender.com';

async function testHealthCheck() {
  console.log('🏥 Testing health endpoint...');
  const res = await fetch(`${BASE_URL}/health`);
  const data = await res.json();
  console.log('   ✅ Health:', data.status);
  return data.status === 'healthy';
}

async function testWebhookEndpoint() {
  console.log('📨 Testing Salla webhook endpoint...');
  const mockCart = {
    event: 'cart.abandoned',
    merchant: 'test-store-123',
    data: {
      id: 'cart-' + Date.now(),
      customer: {
        name: 'أحمد محمد',
        phone: '+966500000000',
        email: 'test@example.com'
      },
      items: [
        { name: 'قميص أزرق', price: 150, quantity: 2 },
        { name: 'بنطلون جينز', price: 200, quantity: 1 }
      ],
      total: 500,
      currency: 'SAR',
      checkout_url: 'https://store.salla.sa/checkout/abc123'
    }
  };
  
  try {
    const res = await fetch(`${BASE_URL}/webhooks/salla`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockCart)
    });
    const data = await res.json();
    console.log('   Response:', JSON.stringify(data, null, 2));
    return res.ok;
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function testOfferGeneration() {
  console.log('🎯 Testing offer generation...');
  try {
    const res = await fetch(`${BASE_URL}/api/ai/generate-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'فاطمة',
        value: 350,
        products: ['فستان سهرة', 'حقيبة يد'],
        productType: 'fashion'
      })
    });
    const data = await res.json();
    console.log('   Offer:', data.offer?.headline || data.error);
    return !!data.offer?.headline;
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function testWhatsAppStatus() {
  console.log('📱 Testing WhatsApp bridge status...');
  try {
    const res = await fetch('https://ribh-whatsapp-1.onrender.com/');
    const data = await res.json();
    console.log('   Active sessions:', data.activeSessions);
    console.log('   Sessions:', data.sessions?.map(s => `${s.storeId}: ${s.state}`).join(', '));
    return true;
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n🚀 RIBH E2E TEST SUITE\n' + '='.repeat(40) + '\n');
  
  const results = {
    health: await testHealthCheck(),
    webhook: await testWebhookEndpoint(),
    offer: await testOfferGeneration(),
    whatsapp: await testWhatsAppStatus()
  };
  
  console.log('\n' + '='.repeat(40));
  console.log('📊 RESULTS:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}`);
  });
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.values(results).length;
  console.log(`\n🎯 ${passed}/${total} tests passed\n`);
  
  return passed === total;
}

runAllTests().then(success => process.exit(success ? 0 : 1));

// === ADVANCED TESTS ===

async function testFullRecoveryFlow() {
  console.log('🔄 Testing FULL recovery flow (simulated)...');
  
  const testStoreId = 'e2e-test-' + Date.now();
  const testPhone = '+966500000001';
  
  // Step 1: Simulate abandoned cart webhook
  const cart = {
    event: 'cart.abandoned',
    merchant: testStoreId,
    data: {
      id: 'cart-' + Date.now(),
      customer: { name: 'عبدالله', phone: testPhone, email: 'test@ribh.app' },
      items: [{ name: 'ساعة ذكية', price: 899, quantity: 1 }],
      total: 899,
      currency: 'SAR',
      checkout_url: 'https://store.salla.sa/checkout/test123'
    }
  };
  
  try {
    // Send webhook
    const webhookRes = await fetch(`${BASE_URL}/webhooks/salla`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cart)
    });
    const webhookData = await webhookRes.json();
    console.log('   1. Webhook received:', webhookData.success ? '✅' : '❌');
    
    // Generate offer for this cart
    const offerRes = await fetch(`${BASE_URL}/api/ai/generate-offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cart.data.customer.name,
        value: cart.data.total,
        products: cart.data.items.map(i => i.name),
        productType: 'electronics'
      })
    });
    const offerData = await offerRes.json();
    console.log('   2. Offer generated:', offerData.offer?.headline ? '✅' : '❌');
    console.log('      Message:', offerData.offer?.fullMessage?.substring(0, 100) + '...');
    
    // Check WhatsApp bridge readiness
    const waRes = await fetch('https://ribh-whatsapp-1.onrender.com/status/' + testStoreId);
    const waData = await waRes.json();
    console.log('   3. WhatsApp session:', waData.state || 'created');
    
    return webhookData.success && !!offerData.offer?.headline;
  } catch (e) {
    console.log('   ❌ Flow error:', e.message);
    return false;
  }
}

async function testRateLimiting() {
  console.log('🚦 Testing rate limiting (10 rapid requests)...');
  const results = [];
  
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      results.push(res.status);
    } catch (e) {
      results.push('error');
    }
  }
  
  const ok = results.filter(r => r === 200).length;
  console.log(`   ${ok}/10 requests succeeded (${results.join(', ')})`);
  return ok >= 8; // Allow some failures
}

// Add to main test runner
async function runAdvancedTests() {
  console.log('\n🔬 ADVANCED TESTS\n' + '='.repeat(40) + '\n');
  
  const results = {
    fullFlow: await testFullRecoveryFlow(),
    rateLimiting: await testRateLimiting()
  };
  
  console.log('\n' + '='.repeat(40));
  console.log('📊 ADVANCED RESULTS:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}`);
  });
  
  return Object.values(results).every(Boolean);
}

// Run if called directly with --advanced flag
if (process.argv.includes('--advanced')) {
  runAdvancedTests().then(success => process.exit(success ? 0 : 1));
}
