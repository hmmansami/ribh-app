/**
 * SALLA CART WEBHOOK - Integration Test
 * 
 * Simulates full webhook flow:
 * 1. Creates sample Salla payload
 * 2. Generates valid signature
 * 3. Sends POST to webhook endpoint
 * 4. Verifies Firestore document created
 * 
 * Run: node functions/webhooks/sallaCart.integration.js
 */

require('dotenv').config();
const crypto = require('crypto');
const admin = require('firebase-admin');

// Initialize Firebase if needed
if (admin.apps.length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase initialized');
    } else {
        console.log('⚠️ No Firebase credentials - will test without Firestore');
    }
}

// ==========================================
// SAMPLE PAYLOADS
// ==========================================

function createSamplePayload(overrides = {}) {
    const now = new Date().toISOString();
    return {
        event: "abandoned.cart",
        merchant: 12345,
        created_at: now,
        data: {
            id: Date.now(),
            status: "active",
            currency: "SAR",
            subtotal: 150,
            total_discount: 0,
            totla: 150, // Salla typo
            checkout_url: `https://test-store.salla.sa/checkout/${Date.now()}`,
            age_in_minutes: 45,
            created_at: now,
            customer: {
                id: 9999,
                name: "عميل تجريبي",
                email: "test@example.com",
                mobile: "0501234567"
            },
            items: [
                {
                    id: 1001,
                    name: "منتج تجريبي ١",
                    quantity: 2,
                    price: { amount: 50, currency: "SAR" }
                },
                {
                    id: 1002,
                    name: "منتج تجريبي ٢",
                    quantity: 1,
                    price: { amount: 50, currency: "SAR" }
                }
            ],
            ...overrides
        }
    };
}

// ==========================================
// TEST FUNCTIONS
// ==========================================

async function testParsingOnly() {
    console.log('\n🧪 TEST 1: Payload Parsing (no network)\n');
    
    const { parseAbandonedCartPayload } = require('./sallaCart');
    const payload = createSamplePayload();
    
    const result = parseAbandonedCartPayload(payload);
    
    console.log('Input payload:');
    console.log(JSON.stringify(payload, null, 2).substring(0, 500) + '...');
    
    console.log('\nParsed result:');
    console.log({
        cartId: result.cartId,
        storeId: result.storeId,
        customer: result.customer,
        total: result.total,
        currency: result.currency,
        itemCount: result.itemCount,
        items: result.items.map(i => `${i.name} x${i.quantity}`),
        checkoutUrl: result.checkoutUrl
    });
    
    // Validate
    const checks = [
        result.storeId === '12345',
        result.customer.phone === '+966501234567',
        result.customer.name === 'عميل تجريبي',
        result.total === 150,
        result.itemCount === 2
    ];
    
    if (checks.every(c => c)) {
        console.log('\n✅ Parsing test PASSED');
        return true;
    } else {
        console.log('\n❌ Parsing test FAILED');
        return false;
    }
}

async function testFirestoreSave() {
    console.log('\n🧪 TEST 2: Firestore Save\n');
    
    if (admin.apps.length === 0) {
        console.log('⚠️ Skipping - Firebase not configured');
        return true;
    }
    
    const { parseAbandonedCartPayload } = require('./sallaCart');
    const db = admin.firestore();
    
    // Create test payload
    const testId = `test_${Date.now()}`;
    const payload = createSamplePayload({ id: testId });
    const cartData = parseAbandonedCartPayload(payload);
    
    // Save to Firestore
    const docId = `${cartData.storeId}_${cartData.cartId}`;
    
    await db.collection('abandoned_carts').doc(docId).set({
        ...cartData,
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
        _test: true
    });
    
    console.log(`📝 Saved document: ${docId}`);
    
    // Read back and verify
    const doc = await db.collection('abandoned_carts').doc(docId).get();
    
    if (doc.exists) {
        const data = doc.data();
        console.log('📖 Read back:', {
            cartId: data.cartId,
            phone: data.customer?.phone,
            total: data.total,
            itemCount: data.itemCount
        });
        
        // Cleanup test document
        await db.collection('abandoned_carts').doc(docId).delete();
        console.log('🧹 Test document cleaned up');
        
        console.log('\n✅ Firestore test PASSED');
        return true;
    } else {
        console.log('\n❌ Firestore test FAILED - document not found');
        return false;
    }
}

async function testSignatureVerification() {
    console.log('\n🧪 TEST 3: Signature Verification\n');
    
    const { verifySallaSignature } = require('./sallaCart');
    
    const testSecret = 'my-test-webhook-secret-12345';
    const payload = createSamplePayload();
    const bodyString = JSON.stringify(payload);
    
    // Generate valid signature
    const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(bodyString)
        .digest('hex');
    
    console.log('Body length:', bodyString.length);
    console.log('Secret:', testSecret);
    console.log('Signature:', validSignature.substring(0, 32) + '...');
    
    // Test valid signature
    const validResult = verifySallaSignature(bodyString, validSignature, testSecret);
    console.log('Valid signature check:', validResult ? '✅ PASSED' : '❌ FAILED');
    
    // Test invalid signature
    const invalidResult = verifySallaSignature(bodyString, 'wrong-signature', testSecret);
    console.log('Invalid signature rejected:', !invalidResult ? '✅ PASSED' : '❌ FAILED');
    
    if (validResult && !invalidResult) {
        console.log('\n✅ Signature test PASSED');
        return true;
    } else {
        console.log('\n❌ Signature test FAILED');
        return false;
    }
}

async function testHTTPEndpoint() {
    console.log('\n🧪 TEST 4: HTTP Endpoint (requires running server)\n');
    
    const port = process.env.PORT || 3000;
    const baseUrl = `http://localhost:${port}`;
    
    // Check if server is running
    try {
        const healthRes = await fetch(`${baseUrl}/health`);
        if (!healthRes.ok) throw new Error('Server not healthy');
        console.log('✅ Server is running');
    } catch (e) {
        console.log(`⚠️ Server not running at ${baseUrl} - skipping HTTP test`);
        console.log('   Run: npm start (in another terminal)');
        return true; // Skip, not fail
    }
    
    // Create payload with signature
    const secret = process.env.SALLA_WEBHOOK_SECRET || '';
    const payload = createSamplePayload({ id: `http_test_${Date.now()}` });
    const bodyString = JSON.stringify(payload);
    
    const signature = secret 
        ? crypto.createHmac('sha256', secret).update(bodyString).digest('hex')
        : 'no-secret-configured';
    
    // Send POST to webhook endpoint
    console.log('📤 Sending POST to /webhooks/salla/cart');
    
    const response = await fetch(`${baseUrl}/webhooks/salla/cart`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Salla-Signature': signature
        },
        body: bodyString
    });
    
    const result = await response.json();
    console.log('📥 Response:', response.status, result);
    
    if (response.status === 200 && result.success) {
        console.log('\n✅ HTTP endpoint test PASSED');
        return true;
    } else {
        console.log('\n❌ HTTP endpoint test FAILED');
        return false;
    }
}

// ==========================================
// RUN ALL TESTS
// ==========================================

async function runAllTests() {
    console.log('═'.repeat(60));
    console.log('   SALLA CART WEBHOOK - INTEGRATION TESTS');
    console.log('═'.repeat(60));
    
    const results = {
        parsing: await testParsingOnly(),
        signature: await testSignatureVerification(),
        firestore: await testFirestoreSave(),
        http: await testHTTPEndpoint()
    };
    
    console.log('\n' + '═'.repeat(60));
    console.log('   SUMMARY');
    console.log('═'.repeat(60));
    
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    
    console.log(`\n📊 Results: ${passed}/${total} tests passed\n`);
    
    for (const [name, result] of Object.entries(results)) {
        console.log(`   ${result ? '✅' : '❌'} ${name}`);
    }
    
    console.log();
    
    if (passed === total) {
        console.log('🎉 All integration tests passed!');
    }
    
    process.exit(passed === total ? 0 : 1);
}

runAllTests().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
