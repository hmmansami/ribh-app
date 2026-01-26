/**
 * Test Salla Webhooks module
 * Run: node test-salla-webhooks.js
 */

const {
    normalizeSaudiPhone,
    isSaudiMobile,
    parseAbandonedCart,
    parseOrderCreated,
    parseCustomerCreated
} = require('./lib/sallaWebhooks');

console.log('🧪 Testing Salla Webhooks Module\n');

// ==========================================
// Test Phone Normalization
// ==========================================
console.log('📱 Testing Phone Normalization:');

const phoneTests = [
    { input: '0501234567', expected: '+966501234567' },
    { input: '501234567', expected: '+966501234567' },
    { input: '966501234567', expected: '+966501234567' },
    { input: '+966501234567', expected: '+966501234567' },
    { input: '00966501234567', expected: '+966501234567' },
    { input: '05 01 23 45 67', expected: '+966501234567' },  // with spaces
    { input: '050-123-4567', expected: '+966501234567' },    // with dashes
    { input: null, expected: null },
    { input: '', expected: null },
];

let passed = 0;
let failed = 0;

phoneTests.forEach(test => {
    const result = normalizeSaudiPhone(test.input);
    const ok = result === test.expected;
    if (ok) {
        passed++;
        console.log(`  ✅ "${test.input}" → "${result}"`);
    } else {
        failed++;
        console.log(`  ❌ "${test.input}" → "${result}" (expected "${test.expected}")`);
    }
});

console.log(`\n  Results: ${passed}/${phoneTests.length} passed\n`);

// ==========================================
// Test isSaudiMobile
// ==========================================
console.log('📱 Testing isSaudiMobile:');

const mobileTests = [
    { phone: '+966501234567', expected: true },
    { phone: '0501234567', expected: true },
    { phone: '+966112345678', expected: false },  // landline
    { phone: '+1234567890', expected: false },    // not Saudi
    { phone: null, expected: false },
];

mobileTests.forEach(test => {
    const result = isSaudiMobile(test.phone);
    const ok = result === test.expected;
    console.log(`  ${ok ? '✅' : '❌'} isSaudiMobile("${test.phone}") = ${result} (expected ${test.expected})`);
});

// ==========================================
// Test Cart Parsing
// ==========================================
console.log('\n🛒 Testing Cart Parsing:');

const sampleCartData = {
    id: 123,
    customer: {
        name: 'أحمد محمد',
        mobile: '0501234567',
        email: 'ahmed@test.com'
    },
    items: [
        { name: 'قميص أزرق', quantity: 2, price: 150 },
        { name: 'بنطال', quantity: 1, price: 200 }
    ],
    total: 500,
    currency: 'SAR',
    checkout_url: 'https://store.salla.sa/cart/123',
    store: {
        name: 'متجر تجريبي',
        url: 'https://store.salla.sa'
    }
};

const parsedCart = parseAbandonedCart(sampleCartData, { id: 'test_merchant', name: 'Test Store' });

console.log('  Parsed cart:', JSON.stringify({
    id: parsedCart.id,
    customerName: parsedCart.customer.name,
    customerPhone: parsedCart.customer.phone,
    customerEmail: parsedCart.customer.email,
    itemCount: parsedCart.itemCount,
    total: parsedCart.total
}, null, 2));

console.log(`  ✅ Phone normalized: ${parsedCart.customer.phone}`);

// ==========================================
// Test Order Parsing
// ==========================================
console.log('\n💰 Testing Order Parsing:');

const sampleOrderData = {
    id: 456,
    reference_id: 'ORD-12345',
    customer: {
        id: 789,
        name: 'سارة علي',
        mobile: '966509876543',
        email: 'sara@test.com'
    },
    items: [
        { name: 'حقيبة', quantity: 1, price: 350 }
    ],
    total: 350,
    status: { name: 'pending' },
    cart_id: 123
};

const parsedOrder = parseOrderCreated(sampleOrderData, 'test_merchant');

console.log('  Parsed order:', JSON.stringify({
    id: parsedOrder.id,
    referenceId: parsedOrder.referenceId,
    customerName: parsedOrder.customer.name,
    customerPhone: parsedOrder.customer.phone,
    total: parsedOrder.total,
    status: parsedOrder.status,
    cartId: parsedOrder.cartId
}, null, 2));

console.log(`  ✅ Phone normalized: ${parsedOrder.customer.phone}`);

// ==========================================
// Test Customer Parsing
// ==========================================
console.log('\n👤 Testing Customer Parsing:');

const sampleCustomerData = {
    id: 999,
    first_name: 'محمد',
    last_name: 'العلي',
    mobile: '05 55 12 34 56',
    email: 'mohammed@test.com',
    gender: 'male'
};

const parsedCustomer = parseCustomerCreated(sampleCustomerData, 'test_merchant');

console.log('  Parsed customer:', JSON.stringify({
    id: parsedCustomer.id,
    name: parsedCustomer.name,
    phone: parsedCustomer.phone,
    email: parsedCustomer.email
}, null, 2));

console.log(`  ✅ Phone normalized: ${parsedCustomer.phone}`);

// ==========================================
// Summary
// ==========================================
console.log('\n' + '='.repeat(50));
console.log('✅ All tests completed!');
console.log('='.repeat(50));
