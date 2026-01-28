/**
 * TEST: Abandoned Cart → WhatsApp Flow
 * 
 * Tests the full flow:
 * 1. Simulate Salla abandoned.cart webhook
 * 2. Check if merchant WhatsApp is connected
 * 3. Generate AI message
 * 4. Send via WhatsApp bridge
 * 
 * Usage:
 *   node test/test-abandoned-cart-whatsapp.js [--local | --render]
 * 
 * Examples:
 *   node test/test-abandoned-cart-whatsapp.js --local    # Test against local server
 *   node test/test-abandoned-cart-whatsapp.js --render   # Test against Render deployment
 *   node test/test-abandoned-cart-whatsapp.js            # Default: local
 */

const fetch = require('node-fetch');

// Configuration
const LOCAL_URL = 'http://localhost:3000';
const RENDER_URL = 'https://ribh-app.onrender.com';
const WHATSAPP_BRIDGE = 'https://ribh-whatsapp-1.onrender.com';

// Parse args
const args = process.argv.slice(2);
const useRender = args.includes('--render');
const BASE_URL = useRender ? RENDER_URL : LOCAL_URL;

// Test store ID - use one with WhatsApp connected
const TEST_STORE_ID = process.env.TEST_STORE_ID || '1543500889';

// Colors for console
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
    console.log(`${c[color]}${msg}${c.reset}`);
}

// ==========================================
// TEST HELPERS
// ==========================================

/**
 * Create a mock Salla abandoned.cart webhook payload
 */
function createMockWebhookPayload(options = {}) {
    const now = new Date().toISOString();
    const cartId = options.cartId || `test_cart_${Date.now()}`;
    
    return {
        event: 'abandoned.cart',
        merchant: options.storeId || TEST_STORE_ID,
        created_at: now,
        data: {
            id: cartId,
            cart_id: cartId,
            customer: {
                id: options.customerId || '12345',
                name: options.customerName || 'محمد أحمد',
                mobile: options.phone || '+966501234567',
                email: options.email || 'test@example.com'
            },
            items: options.items || [
                {
                    id: 'prod_001',
                    name: 'سماعات بلوتوث لاسلكية',
                    quantity: 1,
                    price: { amount: 299 }
                },
                {
                    id: 'prod_002',
                    name: 'حافظة جوال سامسونج',
                    quantity: 2,
                    price: { amount: 49 }
                }
            ],
            total: { amount: options.total || 397 },
            currency: { code: options.currency || 'SAR' },
            checkout_url: options.checkoutUrl || 'https://store.salla.sa/checkout/abc123',
            status: 'abandoned',
            age_in_minutes: options.ageMinutes || 30
        }
    };
}

// ==========================================
// TESTS
// ==========================================

async function testWhatsAppBridgeStatus() {
    log('\n📡 Test 1: Check WhatsApp Bridge Status', 'cyan');
    log('─'.repeat(50), 'dim');
    
    try {
        const res = await fetch(`${WHATSAPP_BRIDGE}/`);
        const data = await res.json();
        
        log(`Bridge: ${data.service}`, 'green');
        log(`Active Sessions: ${data.activeSessions}`, 'green');
        
        // Check for connected sessions
        const connectedSessions = data.sessions?.filter(s => s.connected) || [];
        if (connectedSessions.length > 0) {
            log(`✅ ${connectedSessions.length} merchant(s) connected:`, 'green');
            connectedSessions.forEach(s => {
                log(`   - ${s.storeId}: ${s.user || 'connected'}`, 'green');
            });
        } else {
            log(`⚠️ No merchants connected to WhatsApp yet`, 'yellow');
            log(`   Merchants need to scan QR at: ${WHATSAPP_BRIDGE}/qr/:storeId`, 'yellow');
        }
        
        return { success: true, data };
    } catch (error) {
        log(`❌ Bridge unreachable: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testMerchantWhatsAppStatus(storeId) {
    log(`\n📱 Test 2: Check Merchant ${storeId} WhatsApp Status`, 'cyan');
    log('─'.repeat(50), 'dim');
    
    try {
        const res = await fetch(`${WHATSAPP_BRIDGE}/status/${storeId}`);
        const data = await res.json();
        
        if (data.connected) {
            log(`✅ Merchant ${storeId} IS CONNECTED`, 'green');
            log(`   Phone: ${data.phone || 'N/A'}`, 'green');
            return { success: true, connected: true, data };
        } else {
            log(`⚠️ Merchant ${storeId} NOT connected`, 'yellow');
            log(`   To connect: Open ${WHATSAPP_BRIDGE}/qr/${storeId} and scan QR`, 'yellow');
            return { success: true, connected: false, data };
        }
    } catch (error) {
        log(`❌ Status check failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testWebhookEndpoint() {
    log('\n🌐 Test 3: Webhook Endpoint Reachable', 'cyan');
    log('─'.repeat(50), 'dim');
    
    const webhookUrl = `${BASE_URL}/webhooks/salla/cart`;
    log(`Target: ${webhookUrl}`, 'dim');
    
    try {
        // Send a non-cart event to test endpoint exists
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'test.ping', data: {} })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            log(`✅ Webhook endpoint reachable`, 'green');
            log(`   Response: ${JSON.stringify(data)}`, 'dim');
            return { success: true, data };
        } else {
            log(`⚠️ Endpoint returned ${res.status}`, 'yellow');
            return { success: true, data };
        }
    } catch (error) {
        log(`❌ Webhook endpoint unreachable: ${error.message}`, 'red');
        if (!useRender) {
            log(`   Make sure the server is running: npm run serve`, 'yellow');
        }
        return { success: false, error: error.message };
    }
}

async function testAbandonedCartWebhook(storeId, options = {}) {
    log('\n🛒 Test 4: Simulate Abandoned Cart Webhook', 'cyan');
    log('─'.repeat(50), 'dim');
    
    const webhookUrl = `${BASE_URL}/webhooks/salla/cart`;
    const payload = createMockWebhookPayload({
        storeId,
        ...options
    });
    
    log(`Store ID: ${storeId}`, 'dim');
    log(`Customer: ${payload.data.customer.name} (${payload.data.customer.mobile})`, 'dim');
    log(`Cart Total: ${payload.data.total.amount} SAR`, 'dim');
    log(`Items: ${payload.data.items.length}`, 'dim');
    
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Salla-Signature': 'test-signature' // Would need real secret in prod
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        log('\n📋 Response:', 'cyan');
        console.log(JSON.stringify(data, null, 2));
        
        if (data.success) {
            log(`\n✅ Cart saved: ${data.cartId}`, 'green');
            
            if (data.whatsapp) {
                if (data.whatsapp.sent) {
                    log(`✅ WhatsApp SENT! Message ID: ${data.whatsapp.messageId}`, 'green');
                    if (data.whatsapp.discountOffered) {
                        log(`   Discount offered: ${data.whatsapp.discountOffered}%`, 'green');
                    }
                } else if (data.whatsapp.attempted) {
                    log(`⚠️ WhatsApp attempted but failed: ${data.whatsapp.error}`, 'yellow');
                } else {
                    log(`⚠️ WhatsApp not attempted`, 'yellow');
                }
            }
            
            return { success: true, data };
        } else {
            log(`❌ Webhook processing failed: ${data.error || data.message}`, 'red');
            return { success: false, data };
        }
    } catch (error) {
        log(`❌ Request failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

async function testDirectWhatsAppSend(storeId, phone, message) {
    log('\n📤 Test 5: Direct WhatsApp Send via Bridge', 'cyan');
    log('─'.repeat(50), 'dim');
    
    const sendUrl = `${WHATSAPP_BRIDGE}/send`;
    
    log(`Store: ${storeId}`, 'dim');
    log(`To: ${phone}`, 'dim');
    log(`Message: ${message.substring(0, 50)}...`, 'dim');
    
    try {
        const res = await fetch(sendUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': 'ribh-secret-2026'
            },
            body: JSON.stringify({
                merchant: storeId,
                phone: phone,
                message: message
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            log(`✅ Message SENT! ID: ${data.id || data.messageId}`, 'green');
            return { success: true, data };
        } else {
            log(`❌ Send failed: ${data.error}`, 'red');
            return { success: false, data };
        }
    } catch (error) {
        log(`❌ Request failed: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

// ==========================================
// MAIN
// ==========================================

async function runTests() {
    log('\n' + '='.repeat(60), 'cyan');
    log('  ABANDONED CART → WHATSAPP E2E TEST', 'cyan');
    log('='.repeat(60), 'cyan');
    log(`Target: ${BASE_URL}`, 'dim');
    log(`WhatsApp Bridge: ${WHATSAPP_BRIDGE}`, 'dim');
    log(`Store ID: ${TEST_STORE_ID}`, 'dim');
    
    const results = {};
    
    // Test 1: Bridge status
    results.bridge = await testWhatsAppBridgeStatus();
    
    // Test 2: Merchant WhatsApp status
    results.merchantStatus = await testMerchantWhatsAppStatus(TEST_STORE_ID);
    
    // Test 3: Webhook endpoint
    results.webhook = await testWebhookEndpoint();
    
    // Test 4: Abandoned cart webhook
    if (results.webhook.success) {
        results.abandonedCart = await testAbandonedCartWebhook(TEST_STORE_ID, {
            customerName: 'عبدالله محمد',
            phone: '+966579353338', // Your test phone
            total: 599,
            items: [
                { id: '1', name: 'ساعة ذكية أبل', quantity: 1, price: { amount: 599 } }
            ]
        });
    }
    
    // Test 5: Direct WhatsApp send (only if merchant is connected)
    if (results.merchantStatus.connected) {
        results.directSend = await testDirectWhatsAppSend(
            TEST_STORE_ID,
            '+966579353338',
            '🧪 رسالة اختبار من RIBH!\n\nهذه رسالة تجريبية للتأكد من عمل النظام.\n\n✅ النظام يعمل بنجاح!'
        );
    }
    
    // Summary
    log('\n' + '='.repeat(60), 'cyan');
    log('  SUMMARY', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const tests = [
        ['WhatsApp Bridge', results.bridge?.success],
        ['Merchant Status', results.merchantStatus?.success],
        ['Webhook Endpoint', results.webhook?.success],
        ['Abandoned Cart Flow', results.abandonedCart?.success],
        ['Direct WhatsApp Send', results.directSend?.success]
    ];
    
    tests.forEach(([name, passed]) => {
        if (passed === undefined) {
            log(`⏭️  ${name}: SKIPPED`, 'yellow');
        } else if (passed) {
            log(`✅ ${name}: PASSED`, 'green');
        } else {
            log(`❌ ${name}: FAILED`, 'red');
        }
    });
    
    // Next steps
    log('\n📋 NEXT STEPS:', 'cyan');
    
    if (!results.merchantStatus?.connected) {
        log(`1. Connect merchant WhatsApp:`, 'yellow');
        log(`   curl ${WHATSAPP_BRIDGE}/qr/${TEST_STORE_ID}`, 'dim');
        log(`   Then scan the QR code with WhatsApp`, 'dim');
    }
    
    if (!results.webhook?.success && !useRender) {
        log(`2. Start local server:`, 'yellow');
        log(`   cd ribh-app/functions && npm run serve`, 'dim');
    }
    
    log('\n');
}

// Run
runTests().catch(console.error);
