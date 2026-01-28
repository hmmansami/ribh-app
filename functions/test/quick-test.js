/**
 * Quick test for the abandoned cart → WhatsApp flow
 */
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
if (admin.apps.length === 0) {
    try {
        // Try service account file first
        const serviceAccountPath = path.join(__dirname, '../../serviceAccountKey.json');
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log('✅ Firebase initialized with serviceAccountKey.json');
    } catch (e) {
        console.error('❌ Failed to initialize Firebase:', e.message);
        process.exit(1);
    }
}

async function runTest() {
    // Load the module
    console.log('\n📦 Loading sallaCart module...');
    const sallaCart = require('../webhooks/sallaCart');
    console.log('✅ Module loaded');

    // Create test data
    const testPayload = {
        event: 'abandoned.cart',
        merchant: '1543500889',
        data: {
            id: 'test_cart_' + Date.now(),
            customer: {
                name: 'تجربة',
                mobile: '+966501234567',
                email: 'test@test.com'
            },
            items: [
                { name: 'منتج تجريبي', quantity: 1, price: { amount: 100 } }
            ],
            total: { amount: 100 },
            currency: { code: 'SAR' },
            checkout_url: 'https://example.com/checkout'
        }
    };

    // Parse
    console.log('\n🔍 Parsing payload...');
    const parsed = sallaCart.parseAbandonedCartPayload(testPayload);
    console.log('✅ Parsed:', JSON.stringify({
        cartId: parsed.cartId,
        storeId: parsed.storeId,
        phone: parsed.customer.phone,
        total: parsed.total
    }));

    // Create mock request/response
    console.log('\n🌐 Simulating webhook request...');
    
    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/webhooks/salla/cart', sallaCart);
    
    const server = app.listen(3334);
    
    try {
        const fetch = require('node-fetch');
        const res = await fetch('http://localhost:3334/webhooks/salla/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
        });
        const data = await res.json();
        
        console.log('\n📋 Response:');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.success) {
            console.log('\n✅ TEST PASSED');
            if (data.whatsapp?.sent) {
                console.log('📱 WhatsApp was sent!');
            } else if (data.whatsapp?.error === 'merchant_not_connected') {
                console.log('⚠️ WhatsApp not sent (merchant not connected - expected)');
            }
        } else {
            console.log('\n❌ TEST FAILED:', data.error || data.message);
        }
    } catch (err) {
        console.error('\n❌ Request error:', err.message);
    } finally {
        server.close();
    }
}

runTest().catch(console.error).finally(() => process.exit(0));
