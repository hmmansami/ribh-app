#!/usr/bin/env node
/**
 * RIBH Local Testing Script
 * Run: node test-local.js [command]
 * 
 * Commands:
 *   antiban  - Test anti-ban module
 *   whatsapp - Test WhatsApp QR connection
 *   offer    - Test AI offer generator
 *   server   - Start local server
 *   all      - Run all tests
 */

require('dotenv').config();

const command = process.argv[2] || 'all';

// Colors for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

// ==========================================
// TEST: Anti-Ban Module
// ==========================================
async function testAntiBan() {
    log('\n🛡️  TESTING ANTI-BAN MODULE', 'blue');
    log('='.repeat(50));

    const antiBan = require('./lib/antiBan');
    const testMerchant = 'test-merchant-123';

    // Test 1: Can send check
    log('\n1. Testing rate limiting...', 'yellow');
    const canSend = antiBan.canSendNow(testMerchant);
    log(`   Can send: ${canSend.allowed}`, canSend.allowed ? 'green' : 'red');
    if (!canSend.allowed) {
        log(`   Reason: ${canSend.reason}`, 'yellow');
    }

    // Test 2: Human delay
    log('\n2. Testing human delays...', 'yellow');
    const delays = [];
    for (let i = 0; i < 5; i++) {
        delays.push(antiBan.getHumanDelay());
    }
    log(`   Delays: ${delays.map(d => Math.round(d/1000) + 's').join(', ')}`, 'green');
    log(`   Range: ${Math.min(...delays)/1000}s - ${Math.max(...delays)/1000}s`, 'green');

    // Test 3: Message humanization
    log('\n3. Testing message humanization...', 'yellow');
    const original = 'مرحباً أحمد! 👋 سلتك في انتظارك';
    const variations = [];
    for (let i = 0; i < 3; i++) {
        variations.push(antiBan.humanizeMessage(original, { language: 'ar' }));
    }
    log(`   Original: ${original}`, 'blue');
    variations.forEach((v, i) => {
        const isDifferent = v !== original && variations.filter(x => x === v).length === 1;
        log(`   Variation ${i+1}: ${v}`, isDifferent ? 'green' : 'yellow');
    });

    // Test 4: Queue system
    log('\n4. Testing queue system...', 'yellow');
    const queueResult = antiBan.queueMessage(testMerchant, '+966501234567', 'Test message');
    log(`   Queued: ${queueResult.queued}`, queueResult.queued ? 'green' : 'red');
    if (queueResult.queued) {
        log(`   Scheduled: ${new Date(queueResult.scheduledAt).toISOString()}`, 'green');
        log(`   Position: ${queueResult.position}`, 'green');
    }

    // Test 5: Stats
    log('\n5. Checking stats...', 'yellow');
    const stats = antiBan.getQueueStats(testMerchant);
    log(`   Queue length: ${stats.queueLength}`, 'green');
    log(`   Hourly remaining: ${stats.hourlyRemaining}`, 'green');
    log(`   Daily remaining: ${stats.dailyRemaining}`, 'green');
    log(`   Warm-up day: ${stats.warmupDay}`, 'green');

    log('\n✅ Anti-ban tests complete!', 'green');
}

// ==========================================
// TEST: WhatsApp Connection
// ==========================================
async function testWhatsApp() {
    log('\n📱 TESTING WHATSAPP CONNECTION', 'blue');
    log('='.repeat(50));

    try {
        const whatsapp = require('./lib/whatsappBridgeV2');
        const testMerchant = 'test-bemo-' + Date.now();

        log('\n1. Initializing WhatsApp...', 'yellow');
        log('   This will generate a QR code. Scan it with your phone.', 'blue');

        const result = await whatsapp.initMerchantWhatsApp(testMerchant);

        if (result.qrCode) {
            log('\n🔲 QR CODE GENERATED!', 'green');
            log('   Open this URL in browser to see QR:', 'yellow');
            
            // Save QR as HTML file
            const fs = require('fs');
            const html = `<!DOCTYPE html>
<html>
<head><title>RIBH WhatsApp QR</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#0a0a0a;">
    <div style="text-align:center;color:white;">
        <h1>📱 Scan with WhatsApp</h1>
        <img src="${result.qrCode}" style="border-radius:12px;"/>
        <p>Merchant: ${testMerchant}</p>
    </div>
</body>
</html>`;
            fs.writeFileSync('/tmp/ribh-qr.html', html);
            log('   file:///tmp/ribh-qr.html', 'green');
            log('\n   Or view in terminal:', 'yellow');
            
            // Also try to display in terminal
            const qrcode = require('qrcode-terminal');
            // Extract QR data from data URL - need the original QR string
            // For now just show the base64 image was generated
            log('   QR Base64 generated (open HTML file to scan)', 'green');
        }

        if (result.ready) {
            log('\n✅ Already connected!', 'green');
            log(`   Phone: ${result.phone}`, 'green');
            log(`   Name: ${result.name}`, 'green');
        }

    } catch (error) {
        log(`\n❌ WhatsApp test failed: ${error.message}`, 'red');
    }
}

// ==========================================
// TEST: AI Offer Generator
// ==========================================
async function testOffer() {
    log('\n🧠 TESTING AI OFFER GENERATOR', 'blue');
    log('='.repeat(50));

    try {
        const { OfferGenerator } = require('./lib/offer-generator');
        
        const generator = new OfferGenerator({
            language: 'ar',
            merchantName: 'متجر تجريبي'
        });

        log('\n1. Testing cart recovery offer...', 'yellow');
        const cartOffer = generator.generate({
            productType: 'fashion',
            cartValue: 500,
            behavior: 'abandoned'
        });
        
        log(`   Headline: ${cartOffer.headline}`, 'green');
        log(`   Urgency: ${cartOffer.urgency}`, 'green');
        log(`   Scarcity: ${cartOffer.scarcity}`, 'green');
        log(`   Bonus: ${cartOffer.bonus}`, 'green');

        log('\n2. Testing seasonal offer (Ramadan)...', 'yellow');
        const ramadanOffer = generator.generate({
            season: 'ramadan',
            cartValue: 1000
        });
        
        log(`   Headline: ${ramadanOffer.headline}`, 'green');
        log(`   Full Message: ${ramadanOffer.fullMessage?.substring(0, 100)}...`, 'blue');

        log('\n✅ Offer generator tests complete!', 'green');

    } catch (error) {
        log(`\n⚠️ Offer generator not available: ${error.message}`, 'yellow');
        log('   This is OK - it will use fallback offers', 'yellow');
    }
}

// ==========================================
// TEST: Local Server
// ==========================================
async function testServer() {
    log('\n🚀 STARTING LOCAL SERVER', 'blue');
    log('='.repeat(50));

    process.env.PORT = 3000;
    const { app } = require('./server');

    app.listen(3000, () => {
        log('\n✅ Server running on http://localhost:3000', 'green');
        log('\nEndpoints to test:', 'yellow');
        log('   GET  http://localhost:3000/health', 'blue');
        log('   GET  http://localhost:3000/api/whatsapp/status?merchant=test', 'blue');
        log('   POST http://localhost:3000/api/ai/generate-offer', 'blue');
        log('\nPress Ctrl+C to stop', 'yellow');
    });
}

// ==========================================
// MAIN
// ==========================================
async function main() {
    log('\n' + '='.repeat(50), 'blue');
    log('   RIBH LOCAL TESTING - Bemo Edition 🤖', 'blue');
    log('='.repeat(50), 'blue');

    switch (command) {
        case 'antiban':
            await testAntiBan();
            break;
        case 'whatsapp':
            await testWhatsApp();
            break;
        case 'offer':
            await testOffer();
            break;
        case 'server':
            await testServer();
            break;
        case 'all':
            await testAntiBan();
            await testOffer();
            log('\n📝 To test WhatsApp: node test-local.js whatsapp', 'yellow');
            log('📝 To start server: node test-local.js server', 'yellow');
            break;
        default:
            log(`Unknown command: ${command}`, 'red');
            log('Usage: node test-local.js [antiban|whatsapp|offer|server|all]', 'yellow');
    }
}

main().catch(err => {
    log(`\n❌ Error: ${err.message}`, 'red');
    process.exit(1);
});
