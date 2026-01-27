/**
 * SALLA CART WEBHOOK - Unit Tests
 * 
 * Run: node functions/webhooks/sallaCart.test.js
 */

const crypto = require('crypto');

// Import the module under test
const {
    verifySallaSignature,
    normalizeSaudiPhone,
    parseAbandonedCartPayload,
    extractPhone,
    extractItems,
    extractTotal
} = require('./sallaCart');

// ==========================================
// TEST HELPERS
// ==========================================

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}`);
        console.log(`   Error: ${e.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg = '') {
    if (actual !== expected) {
        throw new Error(`${msg} Expected: ${expected}, Got: ${actual}`);
    }
}

function assertTrue(value, msg = '') {
    if (!value) {
        throw new Error(`${msg} Expected truthy, got: ${value}`);
    }
}

function assertFalse(value, msg = '') {
    if (value) {
        throw new Error(`${msg} Expected falsy, got: ${value}`);
    }
}

// ==========================================
// SAMPLE PAYLOADS (from Salla docs)
// ==========================================

const sampleSallaPayload = {
    event: "abandoned.cart",
    merchant: 1305146709,
    created_at: "Tue Jan 25 2022 13:00:27 GMT+0300",
    data: {
        id: 1097962121,
        status: "active",
        currency: "SAR",
        subtotal: 60,
        total_discount: 10,
        totla: 100, // Note: This is the actual typo from Salla docs!
        checkout_url: "https://salla.sa/dev-store/checkout/1097962121",
        age_in_minutes: 83,
        created_at: "Tue Jan 25 2022 13:00:27 GMT+0300",
        updated_at: "Tue Jan 25 2022 13:00:27 GMT+0300",
        customer: {
            id: 123456,
            name: "محمد أحمد",
            email: "mohammed@example.com",
            mobile: "0501234567"
        },
        items: [
            {
                id: 111,
                name: "تيشيرت أسود",
                quantity: 2,
                price: { amount: 30, currency: "SAR" }
            },
            {
                id: 222,
                name: "بنطلون جينز",
                quantity: 1,
                price: { amount: 40, currency: "SAR" }
            }
        ]
    }
};

// ==========================================
// SIGNATURE VERIFICATION TESTS
// ==========================================

console.log('\n📝 SIGNATURE VERIFICATION TESTS\n');

test('verifySallaSignature - valid signature', () => {
    const secret = 'test-secret-key-12345';
    const body = JSON.stringify({ event: 'test', data: {} });
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    
    assertTrue(verifySallaSignature(body, signature, secret));
});

test('verifySallaSignature - invalid signature', () => {
    const secret = 'test-secret-key-12345';
    const body = JSON.stringify({ event: 'test', data: {} });
    const wrongSignature = 'abcd1234wrongsignature5678';
    
    assertFalse(verifySallaSignature(body, wrongSignature, secret));
});

test('verifySallaSignature - no secret configured (dev mode)', () => {
    const body = JSON.stringify({ event: 'test', data: {} });
    assertTrue(verifySallaSignature(body, 'any-sig', ''));
    assertTrue(verifySallaSignature(body, 'any-sig', null));
});

test('verifySallaSignature - missing signature header', () => {
    const body = JSON.stringify({ event: 'test', data: {} });
    assertFalse(verifySallaSignature(body, null, 'my-secret'));
    assertFalse(verifySallaSignature(body, '', 'my-secret'));
});

// ==========================================
// PHONE NORMALIZATION TESTS
// ==========================================

console.log('\n📱 PHONE NORMALIZATION TESTS\n');

test('normalizeSaudiPhone - 0501234567 → +966501234567', () => {
    assertEqual(normalizeSaudiPhone('0501234567'), '+966501234567');
});

test('normalizeSaudiPhone - 501234567 → +966501234567', () => {
    assertEqual(normalizeSaudiPhone('501234567'), '+966501234567');
});

test('normalizeSaudiPhone - 966501234567 → +966501234567', () => {
    assertEqual(normalizeSaudiPhone('966501234567'), '+966501234567');
});

test('normalizeSaudiPhone - +966501234567 → +966501234567', () => {
    assertEqual(normalizeSaudiPhone('+966501234567'), '+966501234567');
});

test('normalizeSaudiPhone - 00966501234567 → +966501234567', () => {
    assertEqual(normalizeSaudiPhone('00966501234567'), '+966501234567');
});

test('normalizeSaudiPhone - with spaces and dashes', () => {
    assertEqual(normalizeSaudiPhone('050-123-4567'), '+966501234567');
    assertEqual(normalizeSaudiPhone('050 123 4567'), '+966501234567');
});

test('normalizeSaudiPhone - null/empty returns null', () => {
    assertEqual(normalizeSaudiPhone(null), null);
    assertEqual(normalizeSaudiPhone(''), null);
    assertEqual(normalizeSaudiPhone(undefined), null);
});

// ==========================================
// DATA EXTRACTION TESTS
// ==========================================

console.log('\n📦 DATA EXTRACTION TESTS\n');

test('extractPhone - from customer.mobile', () => {
    const data = { customer: { mobile: '0501234567' } };
    assertEqual(extractPhone(data), '+966501234567');
});

test('extractPhone - from billing_address.phone', () => {
    const data = { billing_address: { phone: '0551234567' } };
    assertEqual(extractPhone(data), '+966551234567');
});

test('extractPhone - prioritizes customer.mobile over others', () => {
    const data = {
        customer: { mobile: '0501234567' },
        phone: '0551234567'
    };
    assertEqual(extractPhone(data), '+966501234567');
});

test('extractTotal - handles Salla typo (totla)', () => {
    const data = { totla: 100, subtotal: 60 };
    assertEqual(extractTotal(data), 100);
});

test('extractTotal - handles total.amount object', () => {
    const data = { total: { amount: 150, currency: 'SAR' } };
    assertEqual(extractTotal(data), 150);
});

test('extractTotal - handles plain total number', () => {
    const data = { total: 200 };
    assertEqual(extractTotal(data), 200);
});

test('extractItems - parses items correctly', () => {
    const data = {
        items: [
            { id: 1, name: 'Product A', quantity: 2, price: 50 },
            { id: 2, name: 'Product B', quantity: 1, price: { amount: 30 } }
        ]
    };
    const items = extractItems(data);
    assertEqual(items.length, 2);
    assertEqual(items[0].name, 'Product A');
    assertEqual(items[0].quantity, 2);
    assertEqual(items[0].price, 50);
    assertEqual(items[1].price, 30);
});

// ==========================================
// FULL PAYLOAD PARSING TESTS
// ==========================================

console.log('\n🔄 FULL PAYLOAD PARSING TESTS\n');

test('parseAbandonedCartPayload - parses Salla sample correctly', () => {
    const result = parseAbandonedCartPayload(sampleSallaPayload);
    
    assertEqual(result.cartId, '1097962121');
    assertEqual(result.storeId, '1305146709');
    assertEqual(result.customer.name, 'محمد أحمد');
    assertEqual(result.customer.phone, '+966501234567');
    assertEqual(result.customer.email, 'mohammed@example.com');
    assertEqual(result.total, 100); // Uses 'totla' field
    assertEqual(result.currency, 'SAR');
    assertEqual(result.itemCount, 2);
    assertEqual(result.items[0].name, 'تيشيرت أسود');
    assertEqual(result.checkoutUrl, 'https://salla.sa/dev-store/checkout/1097962121');
    assertEqual(result.source, 'salla_webhook');
    assertEqual(result.eventType, 'abandoned.cart');
});

test('parseAbandonedCartPayload - handles minimal data', () => {
    const minimal = {
        event: 'abandoned.cart',
        merchant: 999,
        data: {
            id: 123,
            customer: { mobile: '0599999999' },
            items: [{ name: 'Test', quantity: 1, price: 10 }]
        }
    };
    
    const result = parseAbandonedCartPayload(minimal);
    assertEqual(result.cartId, '123');
    assertEqual(result.storeId, '999');
    assertEqual(result.customer.phone, '+966599999999');
    assertEqual(result.itemCount, 1);
});

test('parseAbandonedCartPayload - handles merchant as object', () => {
    const payload = {
        event: 'abandoned.cart',
        merchant: { id: 888, name: 'Test Store' },
        data: { id: 1, customer: { mobile: '0501111111' }, items: [] }
    };
    
    const result = parseAbandonedCartPayload(payload);
    assertEqual(result.storeId, '888');
});

// ==========================================
// SUMMARY
// ==========================================

console.log('\n' + '='.repeat(50));
console.log(`\n📊 TEST RESULTS: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
    process.exit(1);
} else {
    console.log('🎉 All tests passed!\n');
}
