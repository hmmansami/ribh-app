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

    // ========== EMAIL OPTIONS ==========
    // Option 1: Resend (FREE - 3000/month)
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    // Option 2: AWS SES (CHEAP - $0.10/1000 for scale)
    AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || '',
    AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || '',
    AWS_REGION: process.env.AWS_REGION || 'eu-west-1',
    EMAIL_FROM: process.env.EMAIL_FROM || 'ribh@ribh.click',
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'resend', // 'resend' or 'aws'

    // ========== SMS OPTIONS ==========
    // Option 1: Amazon SNS (CHEAPEST - $0.02/msg)
    // Uses same AWS credentials as email
    // Option 2: Twilio ($0.04/msg - fallback)
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    TWILIO_SMS_NUMBER: process.env.TWILIO_SMS_NUMBER || '',
    SMS_PROVIDER: process.env.SMS_PROVIDER || 'aws', // 'aws' or 'twilio'

    // ========== TELEGRAM (FREE!) ==========
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',

    // ========== WHATSAPP ==========
    // Option 1: Twilio WhatsApp Business (needs approval)
    TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886',
    // Option 2: Unofficial (store owner's number - coming soon)

    // ========== AI (Gemini is FREE!) ==========
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

    // ========== CHANNEL TOGGLES ==========
    ENABLE_EMAIL: process.env.ENABLE_EMAIL !== 'false',      // FREE - enabled by default
    ENABLE_TELEGRAM: process.env.ENABLE_TELEGRAM === 'true', // FREE - disabled until bot set up
    ENABLE_SMS: process.env.ENABLE_SMS === 'true',           // Paid - $0.02/msg
    ENABLE_WHATSAPP: process.env.ENABLE_WHATSAPP === 'true', // Needs Business API

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
                // Send via ALL enabled channels (Email FREE, SMS paid, WhatsApp paid)
                await sendAllReminders(cart, index + 1);
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
// EMAIL INTEGRATION (FREE - using Resend)
// ==========================================

async function sendEmailReminder(cart, reminderNumber) {
    if (!config.ENABLE_EMAIL || !cart.customer.email) {
        console.log('⚠️ Email disabled or no email address');
        return false;
    }

    console.log(`📧 Preparing Email reminder #${reminderNumber} for ${cart.customer.email}...`);

    const discount = config.REMINDER_DELAYS[reminderNumber - 1]?.discount || 0;
    const discountCode = discount > 0 ? `RIBH${discount}` : '';

    // Create product list HTML
    const productListHtml = cart.items
        .map(item => `<li>${item.name || item.product_name} (${item.quantity || 1}×)</li>`)
        .join('');

    const subject = reminderNumber === 1
        ? `${cart.customer.name}، سلتك في انتظارك! 🛒`
        : `خصم ${discount}% على سلتك المتروكة! 🎁`;

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; }
            .logo { text-align: center; font-size: 32px; color: #10B981; margin-bottom: 20px; }
            h1 { color: #333; font-size: 24px; }
            .products { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .discount { background: #10B981; color: white; padding: 15px; border-radius: 8px; text-align: center; font-size: 18px; margin: 20px 0; }
            .btn { display: inline-block; background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">رِبح 💚</div>
            <h1>مرحباً ${cart.customer.name}!</h1>
            <p>لاحظنا أنك تركت بعض المنتجات الرائعة في سلتك:</p>
            
            <div class="products">
                <ul>${productListHtml}</ul>
                <strong>المجموع: ${cart.total} ${cart.currency || 'SAR'}</strong>
            </div>
            
            ${discount > 0 ? `
            <div class="discount">
                🎁 خصم خاص لك: ${discount}%<br>
                كود الخصم: <strong>${discountCode}</strong>
            </div>
            ` : ''}
            
            <p style="text-align: center;">
                <a href="#" class="btn">أكمل طلبك الآن</a>
            </p>
            
            <div class="footer">
                <p>هذه الرسالة من رِبح - خدمة استرجاع السلات المتروكة</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Check store email limit (500/month free)
    const storeId = cart.merchant || 'default';
    const usageOk = checkAndUpdateEmailUsage(storeId);

    if (!usageOk) {
        console.log(`⚠️ Store ${storeId} exceeded free email limit (500/month)`);
        console.log('💡 Upgrade to paid plan for unlimited emails');
        return false;
    }

    // Priority: AWS SES (cheapest) > Resend (free tier) > Log only

    // Option 1: AWS SES ($0.10/1000 emails)
    if (config.AWS_ACCESS_KEY && config.AWS_SECRET_KEY) {
        try {
            // AWS SES via REST API (simplified)
            // For production, use @aws-sdk/client-ses
            const response = await sendEmailViaAWS(cart.customer.email, subject, htmlContent);
            if (response) {
                console.log(`✅ Email sent via AWS SES to ${cart.customer.email}`);
                return true;
            }
        } catch (error) {
            console.error('❌ AWS SES error:', error);
            // Fall through to try Resend
        }
    }

    // Option 2: Resend (as backup)
    if (config.RESEND_API_KEY) {
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: config.EMAIL_FROM,
                    to: cart.customer.email,
                    subject: subject,
                    html: htmlContent
                })
            });

            const result = await response.json();

            if (result.id) {
                console.log(`✅ Email sent via Resend! ID: ${result.id}`);
                return true;
            } else {
                console.log(`⚠️ Email failed:`, result);
                return false;
            }
        } catch (error) {
            console.error('❌ Resend error:', error);
            return false;
        }
    }

    console.log('📧 Email logged (no provider configured):', subject);
    return false;
}

// ==========================================
// EMAIL USAGE TRACKING & LIMITS
// ==========================================

const USAGE_FILE = path.join(__dirname, 'data', 'email_usage.json');

// Initialize usage file
if (!fs.existsSync(USAGE_FILE)) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify({}));
}

function getEmailUsage() {
    try {
        return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveEmailUsage(usage) {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));
}

function checkAndUpdateEmailUsage(storeId) {
    const usage = getEmailUsage();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

    // Initialize store usage if not exists
    if (!usage[storeId]) {
        usage[storeId] = {};
    }

    // Initialize month if not exists
    if (!usage[storeId][monthKey]) {
        usage[storeId][monthKey] = 0;
    }

    // Check limit (500/month for free)
    const FREE_LIMIT = 500;
    const store = getStoreConfig(storeId);
    const isPaid = store.isPaid || false; // Future: check if paid subscription

    if (!isPaid && usage[storeId][monthKey] >= FREE_LIMIT) {
        return false; // Limit exceeded
    }

    // Increment usage
    usage[storeId][monthKey]++;
    saveEmailUsage(usage);

    console.log(`📊 Email usage for ${storeId}: ${usage[storeId][monthKey]}/${isPaid ? '∞' : FREE_LIMIT}`);
    return true;
}

// AWS SES Email Sending (super cheap: $0.10/1000)
async function sendEmailViaAWS(to, subject, htmlContent) {
    // For full implementation, install: npm install @aws-sdk/client-ses
    // This is a placeholder that logs the intent

    console.log(`📧 AWS SES: Would send email to ${to}`);
    console.log(`   Subject: ${subject.substring(0, 50)}...`);
    console.log('💡 To enable AWS SES, install: npm install @aws-sdk/client-ses');
    console.log('   Then add AWS_ACCESS_KEY and AWS_SECRET_KEY to environment');

    // For now, return false to fall through to Resend
    // Once AWS SDK is installed, this will actually send
    return false;
}

// Get store usage stats
function getStoreUsageStats(storeId) {
    const usage = getEmailUsage();
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

    return {
        storeId,
        month: monthKey,
        emailsSent: usage[storeId]?.[monthKey] || 0,
        limit: 500,
        remaining: Math.max(0, 500 - (usage[storeId]?.[monthKey] || 0))
    };
}

// ==========================================
// TELEGRAM INTEGRATION (FREE!)
// ==========================================

async function sendTelegramReminder(cart, reminderNumber) {
    if (!config.ENABLE_TELEGRAM || !config.TELEGRAM_BOT_TOKEN) {
        console.log('⚠️ Telegram disabled or not configured');
        return false;
    }

    // Note: Customer needs to have started a chat with the bot first
    // We'd need to store their Telegram chat ID
    // For now, this is a placeholder - needs customer opt-in

    const discount = config.REMINDER_DELAYS[reminderNumber - 1]?.discount || 0;
    const discountCode = discount > 0 ? `RIBH${discount}` : '';

    let message;
    if (reminderNumber === 1) {
        message = `🛒 مرحباً ${cart.customer.name}!\n\nسلتك في انتظارك:\n💰 المجموع: ${cart.total} ${cart.currency || 'SAR'}\n\nأكمل طلبك الآن!`;
    } else if (discount > 0) {
        message = `🎁 ${cart.customer.name}، خصم خاص لك!\n\n✨ خصم ${discount}%\n🏷️ كود: ${discountCode}\n\nلا تفوّت الفرصة!`;
    } else {
        message = `⏰ تذكير: سلتك المتروكة في انتظارك يا ${cart.customer.name}!`;
    }

    // If we have customer's Telegram chat ID
    if (cart.customer.telegramChatId) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: cart.customer.telegramChatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            const result = await response.json();
            if (result.ok) {
                console.log(`✅ Telegram sent to ${cart.customer.telegramChatId}`);
                return true;
            } else {
                console.log(`⚠️ Telegram failed:`, result);
                return false;
            }
        } catch (error) {
            console.error('❌ Telegram error:', error);
            return false;
        }
    }

    console.log('📱 Telegram: Customer has no chat ID (need opt-in first)');
    return false;
}

// ==========================================
// AMAZON SNS SMS (CHEAPEST - $0.02/msg)
// ==========================================

async function sendSMSviaAWS(phoneNumber, message) {
    if (!config.AWS_ACCESS_KEY || !config.AWS_SECRET_KEY) {
        console.log('⚠️ AWS not configured, falling back to Twilio');
        return null; // Return null to trigger fallback
    }

    // AWS SNS requires signing requests - simplified version using AWS SDK style
    // In production, use @aws-sdk/client-sns

    const region = config.AWS_REGION;
    const endpoint = `https://sns.${region}.amazonaws.com/`;

    // Format phone number
    let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/^00/, '+');
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }

    // AWS SNS requires proper signature - for simplicity, we'll use a REST approach
    // Note: In production, install @aws-sdk/client-sns for proper implementation

    const params = new URLSearchParams({
        Action: 'Publish',
        PhoneNumber: formattedPhone,
        Message: message,
        Version: '2010-03-31'
    });

    try {
        // For now, log that AWS would be used
        // Full implementation requires AWS SDK
        console.log(`📱 AWS SNS would send to ${formattedPhone}: ${message.substring(0, 50)}...`);
        console.log('💡 To enable AWS SNS, install: npm install @aws-sdk/client-sns');

        // Return null to trigger Twilio fallback until AWS SDK is installed
        return null;
    } catch (error) {
        console.error('❌ AWS SNS error:', error);
        return null;
    }
}

// Updated SMS function with AWS priority
async function sendSMSReminder(cart, reminderNumber) {
    if (!config.ENABLE_SMS || !cart.customer.phone) {
        console.log('⚠️ SMS disabled or no phone number');
        return false;
    }

    console.log(`📱 Preparing SMS reminder #${reminderNumber} for ${cart.customer.phone}...`);

    const discount = config.REMINDER_DELAYS[reminderNumber - 1]?.discount || 0;
    const discountCode = discount > 0 ? `RIBH${discount}` : '';

    // Short SMS message (160 char limit)
    let message;
    if (reminderNumber === 1) {
        message = `مرحباً ${cart.customer.name}! 👋 سلتك (${cart.total} ${cart.currency || 'SAR'}) في انتظارك. أكمل طلبك الآن!`;
    } else if (discount > 0) {
        message = `${cart.customer.name}، خصم ${discount}% على سلتك! 🎁 كود: ${discountCode} - لا تفوّت!`;
    } else {
        message = `تذكير: سلتك المتروكة في انتظارك يا ${cart.customer.name}! 🛒`;
    }

    // Format phone number
    let formattedPhone = cart.customer.phone.replace(/\s+/g, '').replace(/^00/, '+');
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }

    // Try AWS SNS first (cheaper)
    if (config.SMS_PROVIDER === 'aws') {
        const awsResult = await sendSMSviaAWS(formattedPhone, message);
        if (awsResult !== null) return awsResult;
        // If null, fall through to Twilio
    }

    // Fallback to Twilio
    if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && config.TWILIO_SMS_NUMBER) {
        try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`;

            const formData = new URLSearchParams();
            formData.append('From', config.TWILIO_SMS_NUMBER);
            formData.append('To', formattedPhone);
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

            console.log(`✅ SMS sent via Twilio! SID: ${result.sid}`);
            return true;
        } catch (error) {
            console.error('❌ Twilio SMS error:', error);
            return false;
        }
    }

    console.log('⚠️ No SMS provider configured');
    return false;
}

// ==========================================
// UNIFIED REMINDER SENDER (uses all enabled channels)
// ==========================================

async function sendAllReminders(cart, reminderNumber) {
    const results = {
        email: false,
        telegram: false,
        sms: false,
        whatsapp: false
    };

    // 1. Email (FREE) - always try first
    if (config.ENABLE_EMAIL && cart.customer.email) {
        results.email = await sendEmailReminder(cart, reminderNumber);
    }

    // 2. Telegram (FREE) - if customer opted in
    if (config.ENABLE_TELEGRAM && cart.customer.telegramChatId) {
        results.telegram = await sendTelegramReminder(cart, reminderNumber);
    }

    // 3. SMS (Paid - $0.02/msg via AWS, $0.04 via Twilio) - if enabled
    if (config.ENABLE_SMS && cart.customer.phone) {
        results.sms = await sendSMSReminder(cart, reminderNumber);
    }

    // 4. WhatsApp (Paid + needs Business API) - if enabled
    if (config.ENABLE_WHATSAPP && cart.customer.phone) {
        results.whatsapp = await sendWhatsAppReminder(cart, reminderNumber);
    }

    console.log('📊 Reminder results:', results);
    return results;
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
// STORE SETTINGS API (Per-Store Config)
// ==========================================

const SETTINGS_FILE = path.join(__dirname, 'data', 'store_settings.json');

// Initialize settings file
if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}));
}

function readSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function writeSettings(data) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// Get store settings (returns masked sensitive data)
app.get('/api/store/settings', (req, res) => {
    const settings = readSettings();
    const storeId = req.query.storeId || 'default';
    const storeSettings = settings[storeId] || {};

    // Return masked version (don't expose full API keys)
    res.json({
        resendApiKey: storeSettings.resendApiKey ? '••••' + storeSettings.resendApiKey.slice(-4) : null,
        emailFrom: storeSettings.emailFrom || null,
        telegramBotToken: storeSettings.telegramBotToken ? '••••' + storeSettings.telegramBotToken.slice(-4) : null,
        twilioAccountSid: storeSettings.twilioAccountSid ? '••••' + storeSettings.twilioAccountSid.slice(-4) : null,
        enableEmail: storeSettings.enableEmail !== false,
        enableTelegram: !!storeSettings.telegramBotToken,
        enableSms: !!storeSettings.enableSms
    });
});

// Save store settings
app.post('/api/store/settings', (req, res) => {
    const settings = readSettings();
    const storeId = req.body.storeId || 'default';

    // Get existing settings or create new
    const storeSettings = settings[storeId] || {};

    // Update only provided fields
    if (req.body.resendApiKey) storeSettings.resendApiKey = req.body.resendApiKey;
    if (req.body.emailFrom) storeSettings.emailFrom = req.body.emailFrom;
    if (req.body.telegramBotToken) storeSettings.telegramBotToken = req.body.telegramBotToken;
    if (req.body.twilioAccountSid) storeSettings.twilioAccountSid = req.body.twilioAccountSid;
    if (req.body.twilioAuthToken) storeSettings.twilioAuthToken = req.body.twilioAuthToken;
    if (req.body.twilioSmsNumber) storeSettings.twilioSmsNumber = req.body.twilioSmsNumber;
    if (req.body.enableSms !== undefined) storeSettings.enableSms = req.body.enableSms;
    if (req.body.enableEmail !== undefined) storeSettings.enableEmail = req.body.enableEmail;

    settings[storeId] = storeSettings;
    writeSettings(settings);

    console.log(`✅ Settings saved for store: ${storeId}`);
    res.json({ success: true, message: 'Settings saved!' });
});

// Helper: Get store-specific config (for sending messages)
function getStoreConfig(storeId = 'default') {
    const settings = readSettings();
    const storeSettings = settings[storeId] || {};

    // Merge store-specific settings with global defaults
    return {
        // Email
        RESEND_API_KEY: storeSettings.resendApiKey || config.RESEND_API_KEY,
        EMAIL_FROM: storeSettings.emailFrom || config.EMAIL_FROM,
        ENABLE_EMAIL: storeSettings.enableEmail !== false,
        isPaid: storeSettings.isPaid || false,

        // Telegram  
        TELEGRAM_BOT_TOKEN: storeSettings.telegramBotToken || config.TELEGRAM_BOT_TOKEN,
        ENABLE_TELEGRAM: !!(storeSettings.telegramBotToken || config.TELEGRAM_BOT_TOKEN),

        // SMS
        TWILIO_ACCOUNT_SID: storeSettings.twilioAccountSid || config.TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN: storeSettings.twilioAuthToken || config.TWILIO_AUTH_TOKEN,
        TWILIO_SMS_NUMBER: storeSettings.twilioSmsNumber || config.TWILIO_SMS_NUMBER,
        ENABLE_SMS: storeSettings.enableSms || config.ENABLE_SMS,

        // WhatsApp (global only for now)
        TWILIO_WHATSAPP_NUMBER: config.TWILIO_WHATSAPP_NUMBER,
        ENABLE_WHATSAPP: config.ENABLE_WHATSAPP
    };
}

// Get store email usage
app.get('/api/store/usage', (req, res) => {
    const storeId = req.query.storeId || 'default';
    const stats = getStoreUsageStats(storeId);
    res.json(stats);
});

// ==========================================
// HEALTH CHECK & ROOT ENDPOINTS
// ==========================================

// API info endpoint (JSON)
app.get('/api/info', (req, res) => {
    res.status(200).json({
        success: true,
        app: 'رِبح (Ribh)',
        description: 'Salla Cart Recovery App',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            webhook: '/webhooks/salla',
            webhookAlt: '/api/webhooks/salla',
            dashboard: '/',
            settings: '/settings.html',
            stats: '/api/stats'
        },
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Root serves the dashboard (index.html is served by express.static)
// No need for explicit / route - express.static handles it

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
// ENV RELOAD Tue Jan 13 23:44:56 +03 2026
