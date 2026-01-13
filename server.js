const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION
// ==========================================
const config = {
    // Salla
    SALLA_WEBHOOK_SECRET: process.env.SALLA_WEBHOOK_SECRET || '',
    SALLA_CLIENT_ID: process.env.SALLA_CLIENT_ID || '',
    SALLA_CLIENT_SECRET: process.env.SALLA_CLIENT_SECRET || '',

    // Twilio WhatsApp
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886',

    // AI (OpenAI or Google Gemini)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

    // App settings
    REMINDER_DELAYS: [
        { hours: 1, discount: 0 },      // 1st reminder: friendly message
        { hours: 6, discount: 5 },      // 2nd reminder: 5% discount
        { hours: 24, discount: 10 }     // 3rd reminder: 10% discount
    ]
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`, req.method === 'POST' ? req.body : '');
    next();
});

// Simple file-based database
const DB_FILE = path.join(__dirname, 'data', 'carts.json');
const STORES_FILE = path.join(__dirname, 'data', 'stores.json');
const LOG_FILE = path.join(__dirname, 'data', 'webhook_logs.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize DB files
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}
if (!fs.existsSync(STORES_FILE)) {
    fs.writeFileSync(STORES_FILE, JSON.stringify([]));
}
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([]));
}

// Helper functions
function readDB(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return [];
    }
}

function writeDB(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function logWebhook(event, data) {
    const logs = readDB(LOG_FILE);
    logs.push({
        timestamp: new Date().toISOString(),
        event,
        data
    });
    // Keep only last 100 logs
    if (logs.length > 100) logs.shift();
    writeDB(LOG_FILE, logs);
}

// ==========================================
// SALLA OAUTH - App Installation
// ==========================================
app.get('/oauth/callback', async (req, res) => {
    const { code, merchant } = req.query;

    console.log('🔐 OAuth Callback received:', { code, merchant });

    // Store merchant info
    const stores = readDB(STORES_FILE);
    const existingStore = stores.find(s => s.merchant === merchant);

    if (!existingStore) {
        stores.push({
            merchant,
            code,
            installedAt: new Date().toISOString(),
            active: true
        });
        writeDB(STORES_FILE, stores);
    }

    res.send(`
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>رِبح - تم التثبيت</title>
            <style>
                body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0fdf4; }
                .card { background: white; padding: 3rem; border-radius: 20px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
                h1 { color: #10B981; margin-bottom: 1rem; }
                p { color: #666; }
                .icon { font-size: 4rem; margin-bottom: 1rem; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">✅</div>
                <h1>تم تثبيت رِبح بنجاح!</h1>
                <p>سيبدأ التطبيق باستقبال السلات المتروكة تلقائياً</p>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// SALLA WEBHOOKS - URL VALIDATION & EVENTS
// ==========================================

// Verify Salla webhook signature (security)
function verifySallaSignature(req) {
    const signature = req.headers['x-salla-signature'];
    if (!signature || !config.SALLA_WEBHOOK_SECRET) {
        return true; // Skip verification if not configured
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', config.SALLA_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

    return signature === expectedSignature;
}

// Webhook handler function (shared between both paths)
function handleSallaWebhook(req, res) {
    const event = req.body;

    console.log('📨 Webhook received:', event.event || 'unknown', JSON.stringify(event).substring(0, 500));

    // Log the webhook
    logWebhook(event.event || 'unknown', {
        merchant: event.merchant,
        timestamp: event.created_at
    });

    // Verify signature (optional but recommended)
    if (!verifySallaSignature(req)) {
        console.log('⚠️ Invalid webhook signature');
        return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    // Handle different events
    try {
        switch (event.event) {
            case 'cart.abandoned':
            case 'abandoned_cart.created':
            case 'abandoned.cart':
                handleAbandonedCart(event.data, event.merchant);
                break;

            case 'order.created':
            case 'order.create':
                handleOrderCreated(event.data, event.merchant);
                break;

            case 'app.installed':
            case 'app.store.authorize':
                handleAppInstalled(event.data, event.merchant);
                break;

            case 'app.uninstalled':
                handleAppUninstalled(event.merchant);
                break;

            default:
                console.log(`📌 Unhandled event: ${event.event}`);
        }
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
    }

    // Always respond with 200 OK quickly (Salla expects fast response)
    res.status(200).json({
        success: true,
        message: 'Webhook received',
        app: 'ribh',
        timestamp: new Date().toISOString()
    });
}

// ==== GET HANDLERS FOR URL VALIDATION (FIX FOR "رابط غير صحيح") ====
// Salla validates webhook URLs by sending a request - these handlers respond with 200 OK

app.get('/webhooks/salla', (req, res) => {
    console.log('✅ Webhook URL validation (GET /webhooks/salla)');
    res.status(200).json({
        success: true,
        message: 'رِبح Webhook endpoint is ready',
        app: 'ribh',
        version: '1.0.0',
        status: 'active'
    });
});

app.get('/api/webhooks/salla', (req, res) => {
    console.log('✅ Webhook URL validation (GET /api/webhooks/salla)');
    res.status(200).json({
        success: true,
        message: 'رِبح Webhook endpoint is ready',
        app: 'ribh',
        version: '1.0.0',
        status: 'active'
    });
});

// Simple root-level health check
app.get('/webhook', (req, res) => {
    res.status(200).json({ success: true, message: 'Webhook ready' });
});

// ==== POST HANDLERS FOR RECEIVING WEBHOOKS ====
app.post('/webhooks/salla', handleSallaWebhook);
app.post('/api/webhooks/salla', handleSallaWebhook);
app.post('/webhook', handleSallaWebhook); // Alternative path

// Handle app uninstalled
function handleAppUninstalled(merchant) {
    console.log('👋 App uninstalled by:', merchant);
    const stores = readDB(STORES_FILE);
    const storeIndex = stores.findIndex(s => s.merchant === merchant);
    if (storeIndex !== -1) {
        stores[storeIndex].active = false;
        stores[storeIndex].uninstalledAt = new Date().toISOString();
        writeDB(STORES_FILE, stores);
    }
}

// Handle abandoned cart
function handleAbandonedCart(data, merchant) {
    console.log('🛒 Abandoned cart detected!', data);

    const carts = readDB(DB_FILE);

    const cart = {
        id: data.id || Date.now(),
        merchant,
        customer: {
            name: data.customer?.name || 'عميل',
            phone: data.customer?.mobile || data.customer?.phone,
            email: data.customer?.email
        },
        items: data.items || data.products || [],
        total: data.total || data.grand_total || 0,
        currency: data.currency || 'SAR',
        createdAt: new Date().toISOString(),
        status: 'pending', // pending, sent, recovered, expired
        reminders: []
    };

    carts.push(cart);
    writeDB(DB_FILE, carts);

    // Schedule WhatsApp reminder (in production, use a proper queue)
    scheduleReminder(cart);
}

// Handle order created (cart recovered!)
function handleOrderCreated(data, merchant) {
    console.log('🎉 Order created!', data);

    const carts = readDB(DB_FILE);

    // Mark cart as recovered if matches
    const cartIndex = carts.findIndex(c =>
        c.customer?.phone === data.customer?.mobile &&
        c.status === 'sent'
    );

    if (cartIndex !== -1) {
        carts[cartIndex].status = 'recovered';
        carts[cartIndex].recoveredAt = new Date().toISOString();
        carts[cartIndex].orderId = data.id;
        writeDB(DB_FILE, carts);
        console.log('✅ Cart marked as recovered!');
    }
}

// Handle app installed
function handleAppInstalled(data, merchant) {
    console.log('🎊 App installed by:', merchant);

    const stores = readDB(STORES_FILE);
    const existingStore = stores.find(s => s.merchant === merchant);

    if (!existingStore) {
        stores.push({
            merchant,
            installedAt: new Date().toISOString(),
            active: true,
            data
        });
        writeDB(STORES_FILE, stores);
    }
}

// Schedule reminder (simplified - in production use proper job queue like Bull/Redis)
function scheduleReminder(cart) {
    // For demo: send first reminder after 10 seconds
    // In production: use config.REMINDER_DELAYS with proper scheduling

    const delays = [
        10000,      // 1st reminder: 10 seconds (demo) - should be 1 hour
        30000,      // 2nd reminder: 30 seconds (demo) - should be 6 hours
        60000       // 3rd reminder: 60 seconds (demo) - should be 24 hours
    ];

    delays.forEach((delay, index) => {
        setTimeout(async () => {
            const carts = readDB(DB_FILE);
            const currentCart = carts.find(c => c.id === cart.id);

            // Only send if not already recovered
            if (currentCart && currentCart.status !== 'recovered') {
                await sendWhatsAppReminder(cart, index + 1);
            }
        }, delay);
    });
}

// ==========================================
// AI MESSAGE GENERATION
// ==========================================

async function generateAIMessage(cart, reminderNumber) {
    const discount = config.REMINDER_DELAYS[reminderNumber - 1]?.discount || 0;
    const discountCode = discount > 0 ? `RIBH${discount}` : '';

    // Create product list
    const productList = cart.items
        .map(item => `- ${item.name || item.product_name} (${item.quantity || 1}×)`)
        .join('\n');

    const prompt = `اكتب رسالة واتساب قصيرة ومقنعة باللغة العربية لاسترجاع سلة متروكة.

معلومات العميل:
- الاسم: ${cart.customer.name}
- عدد المنتجات: ${cart.items.length}
- إجمالي السلة: ${cart.total} ${cart.currency}

المنتجات:
${productList}

نوع الرسالة: رسالة رقم ${reminderNumber} من 3
${discount > 0 ? `عرض الخصم: ${discount}% بكود ${discountCode}` : 'بدون خصم - رسالة ودية فقط'}

المطلوب:
- رسالة قصيرة (أقل من 160 حرف)
- لهجة ودية وغير مزعجة
- استخدم إيموجي مناسب
- اذكر اسم العميل
${discount > 0 ? `- اذكر كود الخصم ${discountCode}` : ''}

اكتب الرسالة مباشرة بدون مقدمات:`;

    // Try OpenAI first, then Gemini
    if (config.OPENAI_API_KEY) {
        return await generateWithOpenAI(prompt);
    } else if (config.GEMINI_API_KEY) {
        return await generateWithGemini(prompt);
    }

    // Fallback to template messages
    return getTemplateMessage(cart, reminderNumber, discountCode);
}

async function generateWithOpenAI(prompt) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'أنت مساعد تسويق متخصص في كتابة رسائل استرجاع السلات المتروكة باللغة العربية.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error('❌ OpenAI API error:', error);
        return null;
    }
}

async function generateWithGemini(prompt) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (error) {
        console.error('❌ Gemini API error:', error);
        return null;
    }
}

function getTemplateMessage(cart, reminderNumber, discountCode) {
    const templates = [
        `مرحباً ${cart.customer.name}! 👋\n\nلاحظنا أنك تركت بعض المنتجات الرائعة في سلتك. هل تحتاج مساعدة لإكمال طلبك؟\n\n🛒 نحن هنا لمساعدتك!`,
        `${cart.customer.name}، منتجاتك لا تزال في الانتظار! 🛍️\n\nخصم خاص لك: استخدم كود ${discountCode} للحصول على خصم 5٪\n\n⏰ العرض ينتهي قريباً`,
        `آخر فرصة يا ${cart.customer.name}! 🔥\n\nخصم 10٪ على سلتك المتروكة!\n\n🎁 كود الخصم: ${discountCode}\n\nلا تفوّت الفرصة!`
    ];

    return templates[reminderNumber - 1] || templates[0];
}

// ==========================================
// WHATSAPP INTEGRATION (TWILIO)
// ==========================================

async function sendWhatsAppReminder(cart, reminderNumber) {
    console.log(`\n📱 Preparing WhatsApp reminder #${reminderNumber} for ${cart.customer.name}...`);

    // Generate AI message
    const message = await generateAIMessage(cart, reminderNumber);

    console.log('📝 Message:', message);

    // Send via Twilio if configured
    let sent = false;
    let errorMessage = null;

    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && cart.customer.phone) {
        try {
            sent = await sendViaTwilio(cart.customer.phone, message);
        } catch (error) {
            errorMessage = error.message;
            console.error('❌ Twilio error:', error);
        }
    } else {
        console.log('⚠️ Twilio not configured or no phone number - message logged only');
    }

    // Update cart status
    const carts = readDB(DB_FILE);
    const cartIndex = carts.findIndex(c => c.id === cart.id);

    if (cartIndex !== -1) {
        carts[cartIndex].status = 'sent';
        carts[cartIndex].reminders.push({
            number: reminderNumber,
            sentAt: new Date().toISOString(),
            message,
            delivered: sent,
            error: errorMessage
        });
        writeDB(DB_FILE, carts);
    }

    return sent;
}

async function sendViaTwilio(phoneNumber, message) {
    // Format phone number for WhatsApp
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^00/, '+');
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', `whatsapp:${config.TWILIO_WHATSAPP_NUMBER}`);
    formData.append('To', `whatsapp:${formattedPhone}`);
    formData.append('Body', message);

    const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
    });

    const result = await response.json();

    if (result.error_code) {
        throw new Error(result.error_message || `Twilio error: ${result.error_code}`);
    }

    console.log(`✅ WhatsApp sent! SID: ${result.sid}`);
    return true;
}

// ==========================================
// DASHBOARD API
// ==========================================

// Get all abandoned carts
app.get('/api/carts', (req, res) => {
    const carts = readDB(DB_FILE);
    res.json(carts.reverse()); // Latest first
});

// Get stats
app.get('/api/stats', (req, res) => {
    const carts = readDB(DB_FILE);

    const stats = {
        total: carts.length,
        pending: carts.filter(c => c.status === 'pending').length,
        sent: carts.filter(c => c.status === 'sent').length,
        recovered: carts.filter(c => c.status === 'recovered').length,
        totalValue: carts.reduce((sum, c) => sum + (c.total || 0), 0),
        recoveredValue: carts.filter(c => c.status === 'recovered')
            .reduce((sum, c) => sum + (c.total || 0), 0)
    };

    stats.recoveryRate = stats.total > 0
        ? ((stats.recovered / stats.total) * 100).toFixed(1)
        : 0;

    res.json(stats);
});

// Get stores
app.get('/api/stores', (req, res) => {
    const stores = readDB(STORES_FILE);
    res.json(stores);
});

// Test webhook (for development)
app.post('/api/test/abandoned-cart', (req, res) => {
    const testData = {
        event: 'cart.abandoned',
        merchant: 'test-store',
        data: {
            id: Date.now(),
            customer: {
                name: 'أحمد محمد',
                mobile: '+966501234567',
                email: 'ahmed@example.com'
            },
            items: [
                { name: 'قميص أزرق', quantity: 2, price: 150 },
                { name: 'بنطلون جينز', quantity: 1, price: 200 }
            ],
            total: 500,
            currency: 'SAR'
        }
    };

    handleAbandonedCart(testData.data, testData.merchant);
    res.json({ success: true, message: 'Test cart created!' });
});

// Get webhook logs
app.get('/api/logs', (req, res) => {
    const logs = readDB(LOG_FILE);
    res.json(logs.reverse()); // Latest first
});

// ==========================================
// HEALTH CHECK & ROOT ENDPOINTS
// ==========================================

// Root health check (important for hosting platforms)
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        app: 'رِبح (Ribh)',
        description: 'Salla Cart Recovery App',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            webhook: '/webhooks/salla',
            webhookAlt: '/api/webhooks/salla',
            dashboard: '/index.html',
            stats: '/api/stats'
        },
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ==========================================
// KEEP-ALIVE: Prevent Render from sleeping
// ==========================================
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://ribh.click';

function keepAlive() {
    fetch(`${APP_URL}/health`)
        .then(res => console.log(`💓 Keep-alive ping: ${res.status} at ${new Date().toLocaleTimeString()}`))
        .catch(err => console.log(`⚠️ Keep-alive failed: ${err.message}`));
}

// Start keep-alive after server starts (only in production)
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
    console.log(`💓 Keep-alive enabled: pinging every ${KEEP_ALIVE_INTERVAL / 60000} minutes`);
}

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                                                            ║
    ║     🚀 رِبح - Ribh App Running!                            ║
    ║                                                            ║
    ║     Local:     http://localhost:${PORT}                       ║
    ║                                                            ║
    ║     Endpoints:                                             ║
    ║     • Dashboard:  /                                        ║
    ║     • Webhook:    /webhooks/salla (GET & POST)             ║
    ║     • Webhook:    /api/webhooks/salla (GET & POST)         ║
    ║     • Stats:      /api/stats                               ║
    ║     • Carts:      /api/carts                               ║
    ║     • Test:       POST /api/test/abandoned-cart            ║
    ║                                                            ║
    ║     Integrations:                                          ║
    ║     • WhatsApp:   ${config.TWILIO_ACCOUNT_SID ? '✅ Configured' : '⚠️  Not configured'}                         ║
    ║     • AI:         ${config.OPENAI_API_KEY ? '✅ OpenAI' : config.GEMINI_API_KEY ? '✅ Gemini' : '⚠️  Not configured (using templates)'}            ║
    ║     • Keep-Alive: ✅ Enabled (every 5 min)                  ║
    ║                                                            ║
    ╚════════════════════════════════════════════════════════════╝
    `);

    // Initial ping after 10 seconds to confirm it works
    if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
        setTimeout(keepAlive, 10000);
    }
});
