#!/usr/bin/env node
/**
 * Local test for Salla webhook handler
 * Tests the parsing and normalization logic without needing Firebase
 * 
 * Usage: node scripts/test-salla-local.js
 */

const { 
    parseAbandonedCartPayload, 
    normalizeSaudiPhone, 
    extractPhone,
    extractItems,
    extractTotal
} = require('../functions/webhooks/sallaCart');

console.log('🧪 Testing Salla Webhook Handler (Local)\n');

// Test phone normalization
console.log('📱 Phone Normalization Tests:');
const phoneTests = [
    ['0501234567', '+966501234567'],
    ['501234567', '+966501234567'],
    ['966501234567', '+966501234567'],
    ['+966501234567', '+966501234567'],
    ['00966501234567', '+966501234567'],
];

let allPassed = true;
for (const [input, expected] of phoneTests) {
    const result = normalizeSaudiPhone(input);
    const passed = result === expected;
    console.log(`  ${passed ? '✅' : '❌'} ${input} → ${result} ${passed ? '' : `(expected: ${expected})`}`);
    if (!passed) allPassed = false;
}
console.log('');

// Test payload parsing
console.log('📦 Payload Parsing Test:');
const testPayload = {
    event: 'abandoned.cart',
    merchant: 12345678,
    created_at: new Date().toISOString(),
    data: {
        id: 'test_cart_001',
        customer: {
            id: 987654,
            name: 'محمد أحمد',
            email: 'test@example.com',
            mobile: '0501234567'
        },
        items: [
            {
                id: 'prod_001',
                name: 'قميص قطني أبيض',
                quantity: 2,
                price: { amount: 150, currency: 'SAR' }
            },
            {
                id: 'prod_002',
                name: 'بنطلون جينز',
                quantity: 1,
                price: { amount: 200, currency: 'SAR' }
            }
        ],
        total: { amount: 500, currency: 'SAR' },
        checkout_url: 'https://store.salla.sa/checkout/test',
        age_in_minutes: 30,
        status: 'abandoned'
    }
};

const parsed = parseAbandonedCartPayload(testPayload);

console.log('  Parsed Result:');
console.log(`  • Cart ID: ${parsed.cartId}`);
console.log(`  • Store ID: ${parsed.storeId}`);
console.log(`  • Customer: ${parsed.customer.name} (${parsed.customer.phone})`);
console.log(`  • Items: ${parsed.itemCount}`);
console.log(`  • Total: ${parsed.total} ${parsed.currency}`);
console.log(`  • Checkout URL: ${parsed.checkoutUrl}`);
console.log('');

// Validate parsed data
const checks = [
    ['Cart ID', parsed.cartId === 'test_cart_001'],
    ['Store ID', parsed.storeId === '12345678'],
    ['Phone Normalized', parsed.customer.phone === '+966501234567'],
    ['Item Count', parsed.itemCount === 2],
    ['Total', parsed.total === 500],
    ['Currency', parsed.currency === 'SAR'],
];

console.log('✓ Validation:');
for (const [name, passed] of checks) {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
    if (!passed) allPassed = false;
}

console.log('\n' + (allPassed ? '🎉 All tests passed!' : '❌ Some tests failed'));
process.exit(allPassed ? 0 : 1);
