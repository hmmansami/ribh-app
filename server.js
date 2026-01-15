const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lifecycle Engine - AI-powered revenue optimization
let lifecycleEngine;
try {
    lifecycleEngine = require('./lib/lifecycleEngine');
    console.log('✅ Lifecycle Engine loaded');
} catch (e) {
    console.log('⚠️ Lifecycle Engine not available:', e.message);
    lifecycleEngine = null;
}

// Referral System
let referralSystem;
try {
    referralSystem = require('./lib/referralSystem');
    console.log('✅ Referral System loaded');
} catch (e) {
    console.log('⚠️ Referral System not available:', e.message);
    referralSystem = null;
}

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

// Simple cookie parser helper (inline for early use)
function parseCookies(req) {
    const cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            cookies[key] = value;
        });
    }
    return cookies;
}

// Salla Session Middleware - Detect store from Salla request
app.use((req, res, next) => {
    // Salla sends store info in various ways:
    // 1. Query params: ?merchant=xxx or ?store=xxx
    // 2. Headers: x-salla-merchant or x-merchant-id
    // 3. Body (for webhooks): merchant field

    const storeFromQuery = req.query.merchant || req.query.store;
    const storeFromHeader = req.headers['x-salla-merchant'] || req.headers['x-merchant-id'];
    const storeFromBody = req.body?.merchant;

    req.storeId = storeFromQuery || storeFromHeader || storeFromBody || null;
    next();
});

// Cookie auth will be checked later via API - for now just pass through
// The actual auth check happens in verifyStoreToken middleware

app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`, req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) : '');
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
// STORE AUTHENTICATION SYSTEM
// ==========================================

// Generate unique token for store authentication
function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

// Cookie parser middleware (simple implementation)
function parseCookies(req) {
    const cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim();
            cookies[key] = value;
        });
    }
    return cookies;
}

// Verify store token middleware
function verifyStoreToken(req, res, next) {
    const cookies = parseCookies(req);
    const token = req.query.token || cookies.ribhToken;

    if (!token) {
        return res.redirect('/login.html');
    }

    const stores = readDB(STORES_FILE);
    const store = stores.find(s => s.ribhToken === token);

    if (!store) {
        return res.redirect('/login.html?error=invalid');
    }

    // Set cookie if coming from query param (for persistent login)
    if (req.query.token && !cookies.ribhToken) {
        res.cookie('ribhToken', token, {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        });
    }

    req.store = store;
    next();
}

// Auth API endpoint - verify token
app.get('/api/auth/verify', (req, res) => {
    const cookies = parseCookies(req);
    const token = req.query.token || cookies.ribhToken;

    if (!token) {
        return res.json({ success: false, error: 'No token provided' });
    }

    const stores = readDB(STORES_FILE);
    const store = stores.find(s => s.ribhToken === token);

    if (!store) {
        return res.json({ success: false, error: 'Invalid token' });
    }

    res.json({
        success: true,
        store: {
            merchant: store.merchant,
            merchantName: store.merchantName,
            email: store.email,
            installedAt: store.installedAt
        }
    });
});

// Auth API endpoint - send magic link via email
app.post('/api/auth/send-link', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const stores = readDB(STORES_FILE);
    const store = stores.find(s => s.email && s.email.toLowerCase() === email.toLowerCase());

    if (!store) {
        return res.status(404).json({ success: false, error: 'Store not found with this email' });
    }

    // Generate new token if doesn't have one
    if (!store.token) {
        store.token = generateToken();
        writeDB(STORES_FILE, stores);
    }

    const loginUrl = `https://ribh.click/?token=${store.token}`;

    // Send email with magic link if Resend is configured
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
                    to: email,
                    subject: 'رابط الدخول إلى رِبح 🔐',
                    html: `
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head><meta charset="UTF-8"></head>
                    <body style="font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px;">
                        <div style="max-width: 400px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; text-align: center;">
                            <div style="font-size: 32px; color: #10B981; margin-bottom: 20px;">رِبح 💚</div>
                            <h2 style="color: #1D1D1F;">رابط الدخول الخاص بك</h2>
                            <p style="color: #86868B;">اضغط على الزر أدناه للدخول إلى لوحة التحكم</p>
                            <a href="${loginUrl}" style="display: inline-block; background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">الدخول إلى رِبح</a>
                            <p style="color: #86868B; font-size: 12px;">هذا الرابط صالح للاستخدام الدائم. لا تشاركه مع أي شخص.</p>
                        </div>
                    </body>
                    </html>
                    `
                })
            });

            const result = await response.json();
            if (result.id) {
                console.log(`✅ Magic link sent to ${email}`);
                return res.json({ success: true, message: 'تم إرسال رابط الدخول إلى بريدك الإلكتروني' });
            }
        } catch (error) {
            console.error('❌ Error sending magic link:', error);
        }
    }

    // Fallback: return the link directly (for development/testing)
    res.json({
        success: true,
        message: 'رابط الدخول الخاص بك',
        link: loginUrl
    });
});

// Logout endpoint
app.get('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'storeToken=; Path=/; HttpOnly; Max-Age=0');
    res.redirect('/login.html');
});


// ==========================================
// SALLA OAUTH - App Installation
// ==========================================
app.get('/oauth/callback', async (req, res) => {
    const { code } = req.query;

    console.log('🔐 OAuth Callback received:', { code: code?.substring(0, 20) + '...' });

    if (!code) {
        console.error('❌ No authorization code received');
        return res.status(400).send('Missing authorization code');
    }

    try {
        // Step 1: Exchange authorization code for access token
        const tokenResponse = await fetch('https://accounts.salla.sa/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: config.SALLA_CLIENT_ID,
                client_secret: config.SALLA_CLIENT_SECRET,
                redirect_uri: 'https://ribh.click/oauth/callback'
            })
        });

        const tokenData = await tokenResponse.json();
        console.log('🔑 Token response:', tokenData.access_token ? 'Got access token!' : tokenData);

        if (!tokenData.access_token) {
            console.error('❌ Failed to get access token:', tokenData);
            return res.status(400).send('Failed to authenticate with Salla');
        }

        // Step 2: Get merchant info using access token
        const userResponse = await fetch('https://accounts.salla.sa/oauth2/user/info', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        const userData = await userResponse.json();
        console.log('👤 User info:', userData);

        const merchantId = userData.data?.merchant?.id || userData.merchant?.id || 'unknown';
        const merchantName = userData.data?.merchant?.name || userData.merchant?.name || 'متجر';
        const merchantEmail = userData.data?.email || userData.email || '';

        console.log(`🏪 Merchant: ${merchantName} (${merchantId})`);

        // Step 3: Save store with access token
        const stores = readDB(STORES_FILE);
        let existingStore = stores.find(s => s.merchant === merchantId);
        let ribhToken;

        if (!existingStore) {
            ribhToken = generateToken();
            stores.push({
                merchant: merchantId,
                merchantName: merchantName,
                email: merchantEmail,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                ribhToken: ribhToken,
                installedAt: new Date().toISOString(),
                active: true
            });
            writeDB(STORES_FILE, stores);
            console.log(`✅ New store registered: ${merchantName} with token: ${ribhToken.substring(0, 8)}...`);
        } else {
            // Update existing store with new tokens
            existingStore.accessToken = tokenData.access_token;
            existingStore.refreshToken = tokenData.refresh_token;
            existingStore.merchantName = merchantName;
            if (!existingStore.ribhToken) {
                existingStore.ribhToken = generateToken();
            }
            ribhToken = existingStore.ribhToken;
            writeDB(STORES_FILE, stores);
            console.log(`🔄 Store updated: ${merchantName}`);
        }

        // Step 4: Set cookie for persistent login
        res.cookie('ribhToken', ribhToken, {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        });

        // Step 5: Redirect to dashboard with Ribh token (auto-login)
        res.redirect(`/?token=${ribhToken}&welcome=true`);

    } catch (error) {
        console.error('❌ OAuth error:', error);
        res.status(500).send('OAuth authentication failed');
    }
});

// ==========================================
// SEAMLESS APP ACCESS - One Click, No Friction!
// ==========================================
// Link from Salla: https://ribh.click/app
// Flow: Click → Auto OAuth (if needed) → Dashboard
app.get('/app', (req, res) => {
    // Accept multiple query parameter formats from Salla
    const storeId = req.query.merchant || req.query.store || req.query.store_id ||
        req.query.merchant_id || req.query.id;

    const cookies = parseCookies(req);

    console.log('📱 App entry point accessed:', {
        storeId: storeId || 'none',
        hasCookie: cookies.ribhToken ? 'yes' : 'no'
    });

    // OPTION 1: Store ID provided in URL
    if (storeId && storeId !== 'YOUR_STORE_ID' && !storeId.includes('{{')) {
        const stores = readDB(STORES_FILE);
        const foundStore = stores.find(s =>
            s.merchant === storeId ||
            s.merchant === String(storeId) ||
            String(s.merchant) === String(storeId)
        );

        if (foundStore && foundStore.ribhToken) {
            console.log(`✅ Found store: ${foundStore.merchantName || storeId}`);

            // Set cookie for future visits
            res.cookie('ribhToken', foundStore.ribhToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,
                secure: true,
                sameSite: 'lax'
            });

            return res.redirect(`/?token=${foundStore.ribhToken}`);
        }
        // Store not found - fall through to OAuth
    }

    // OPTION 2: Already has cookie from previous login
    if (cookies.ribhToken) {
        // Verify the token is still valid
        const stores = readDB(STORES_FILE);
        const validStore = stores.find(s => s.ribhToken === cookies.ribhToken);

        if (validStore) {
            console.log(`🍪 Valid cookie found for: ${validStore.merchantName}`);
            return res.redirect(`/?token=${cookies.ribhToken}`);
        }
        // Invalid cookie - fall through to OAuth
    }

    // OPTION 3: No authentication found - AUTO TRIGGER OAUTH!
    // Since merchant is already logged into Salla, this is seamless
    console.log('🔐 No auth found, triggering Salla OAuth...');

    const oauthUrl = `https://accounts.salla.sa/oauth2/auth?` +
        `client_id=${config.SALLA_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent('https://ribh.click/oauth/callback')}` +
        `&response_type=code` +
        `&scope=offline_access`;

    return res.redirect(oauthUrl);
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

        // Process through Lifecycle Engine for AI-powered offers
        if (lifecycleEngine) {
            lifecycleEngine.processEvent(event.event, event.merchant, event.data);
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

// ==== SALLA SETUP GUIDE - How to add "Open App" button ====
app.get('/salla-setup', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعداد تطبيق رِبح في سلة</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            min-height: 100vh;
            padding: 40px 20px;
        }
        .container {
            max-width: 700px;
            margin: 0 auto;
            background: white;
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }
        h1 { color: #10B981; margin-bottom: 20px; font-size: 28px; }
        h2 { color: #1D1D1F; margin: 30px 0 15px; font-size: 20px; }
        p { color: #6B7280; line-height: 1.8; margin-bottom: 15px; }
        .step { 
            background: #F0FDF4; 
            border-right: 4px solid #10B981;
            padding: 15px 20px;
            margin: 15px 0;
            border-radius: 8px;
        }
        .step-number {
            display: inline-block;
            width: 30px;
            height: 30px;
            background: #10B981;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 30px;
            font-weight: bold;
            margin-left: 10px;
        }
        code {
            background: #1D1D1F;
            color: #10B981;
            padding: 12px 20px;
            border-radius: 8px;
            display: block;
            font-family: 'Monaco', 'Consolas', monospace;
            direction: ltr;
            text-align: left;
            margin: 15px 0;
            font-size: 14px;
            word-break: break-all;
        }
        .highlight {
            background: #FEF3C7;
            border: 2px solid #F59E0B;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .success {
            background: #DCFCE7;
            border: 2px solid #22C55E;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        a { color: #10B981; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 إعداد زر "فتح التطبيق" في سلة</h1>
        
        <div class="highlight">
            <strong>❗ المشكلة:</strong> بعد تثبيت التطبيق، لا يوجد زر واضح لفتح لوحة التحكم
        </div>
        
        <h2>الحل: تحديث إعدادات التطبيق في بوابة الشركاء</h2>
        
        <div class="step">
            <span class="step-number">1</span>
            ادخل على <a href="https://partner.salla.sa" target="_blank">بوابة شركاء سلة</a>
        </div>
        
        <div class="step">
            <span class="step-number">2</span>
            اذهب إلى "تطبيقاتي" → ثم اختر تطبيق "ربح"
        </div>
        
        <div class="step">
            <span class="step-number">3</span>
            ابحث عن قسم "إعدادات ربط التطبيق" أو "App Settings Builder"
        </div>
        
        <div class="step">
            <span class="step-number">4</span>
            <strong>غيّر حقل الرابط (URL)</strong> من:<br>
            <code>https://ribh.click</code>
            <strong>إلى:</strong>
            <code>https://ribh.click/app?merchant={{store.id}}</code>
        </div>
        
        <div class="success">
            <strong>✅ النتيجة:</strong> الآن عندما يضغط التاجر على الرابط من لوحة سلة، 
            سيتم تعويض <code style="display:inline; padding: 4px 8px;">{{store.id}}</code> 
            برقم المتجر تلقائياً وسيدخل مباشرة للوحة التحكم!
        </div>
        
        <h2>🔗 روابط مفيدة</h2>
        <p>
            • <a href="https://partner.salla.sa" target="_blank">بوابة شركاء سلة</a><br>
            • <a href="https://ribh.click/login.html">صفحة تسجيل الدخول (للتجار)</a><br>
            • <a href="https://ribh.click/">لوحة التحكم الرئيسية</a>
        </p>
    </div>
</body>
</html>
    `);
});

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

// ==== TELEGRAM BOT WEBHOOK ====
// ONE-CLICK SIGNUP: Customer clicks link with phone embedded -> opens Telegram -> done!
// Link format: https://t.me/RibhCartBot?start=966501234567
app.post('/webhooks/telegram', async (req, res) => {
    const update = req.body;
    console.log('📱 Telegram update:', JSON.stringify(update).substring(0, 200));

    if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        const userName = update.message.from?.first_name || 'عميل';

        // Handle /start command with phone in deep link
        // /start 966501234567 (from deep link t.me/RibhCartBot?start=966501234567)
        if (text.startsWith('/start')) {
            const param = text.replace('/start', '').trim();

            // Check if this is a phone number (from deep link)
            if (param && /^[\d+]+$/.test(param) && param.length >= 9) {
                // ONE-CLICK SUCCESS! Save and confirm
                await saveTelegramSubscriber(param, chatId, userName);

                await sendTelegramMessage(chatId,
                    `🎉 مرحباً ${userName}!\n\n` +
                    `✅ تم تفعيل الإشعارات بنجاح!\n\n` +
                    `ستصلك تنبيهات عن:\n` +
                    `🛒 السلات المتروكة\n` +
                    `🎁 العروض الخاصة\n` +
                    `💰 التخفيضات الحصرية\n\n` +
                    `شكراً لاستخدامك رِبح! 💚`
                );
            }
            // Just /start without phone - ask for phone keyboard style
            else {
                await sendTelegramMessage(chatId,
                    `مرحباً ${userName}! 👋\n\n` +
                    `🔔 فعّل إشعارات رِبح\n\n` +
                    `أرسل رقم جوالك لربطه بحسابك:\n\n` +
                    `مثال: 0501234567`
                );
            }
        }
        // Handle contact sharing (phone from Telegram contact)
        else if (update.message.contact) {
            const phoneNumber = update.message.contact.phone_number;
            await saveTelegramSubscriber(phoneNumber, chatId, userName);

            await sendTelegramMessage(chatId,
                `🎉 ممتاز ${userName}!\n\n` +
                `✅ تم ربط رقمك بنجاح!\n\n` +
                `ستصلك جميع الإشعارات هنا 🔔`
            );
        }
        // Handle just phone number typed
        else if (/^[\d\s+]+$/.test(text) && text.replace(/\D/g, '').length >= 9) {
            const phoneNumber = text.replace(/\s/g, '');
            await saveTelegramSubscriber(phoneNumber, chatId, userName);

            await sendTelegramMessage(chatId,
                `✅ تم ربط رقمك بنجاح!\n\n` +
                `📱 ${phoneNumber}\n\n` +
                `ستصلك إشعارات السلات المتروكة والعروض 🎁`
            );
        }
        // Handle other messages
        else {
            await sendTelegramMessage(chatId,
                `مرحباً ${userName}! 👋\n\n` +
                `أنا بوت رِبح للإشعارات.\n\n` +
                `أرسل رقم جوالك للاشتراك:\n` +
                `مثال: 0501234567`
            );
        }
    }

    res.status(200).json({ ok: true });
});

// Generate one-click Telegram signup link for a phone number
function getTelegramSignupLink(phoneNumber) {
    // Normalize phone
    let phone = phoneNumber.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '966' + phone.substring(1);
    if (!phone.startsWith('966')) phone = '966' + phone;

    // Return deep link - customer just clicks and opens Telegram!
    return `https://t.me/RibhCartBot?start=${phone}`;
}

// Helper to send Telegram messages
async function sendTelegramMessage(chatId, text) {
    if (!config.TELEGRAM_BOT_TOKEN) return false;

    try {
        await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        return true;
    } catch (error) {
        console.error('❌ Telegram send error:', error);
        return false;
    }
}

// Save Telegram subscriber (phone → chatId mapping)
const TELEGRAM_SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'telegram_subscribers.json');

async function saveTelegramSubscriber(phone, chatId, name) {
    let subscribers = {};
    try {
        subscribers = JSON.parse(fs.readFileSync(TELEGRAM_SUBSCRIBERS_FILE, 'utf8'));
    } catch (e) {
        subscribers = {};
    }

    // Normalize phone number
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '966' + phone.substring(1);
    if (!phone.startsWith('966')) phone = '966' + phone;

    subscribers[phone] = { chatId, name, subscribedAt: new Date().toISOString() };

    fs.writeFileSync(TELEGRAM_SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
    console.log(`📱 Telegram subscriber added: ${phone} → ${chatId}`);
}

// Get Telegram chat ID for a phone number
function getTelegramChatId(phone) {
    try {
        const subscribers = JSON.parse(fs.readFileSync(TELEGRAM_SUBSCRIBERS_FILE, 'utf8'));

        // Normalize phone number
        phone = phone.replace(/\D/g, '');
        if (phone.startsWith('0')) phone = '966' + phone.substring(1);
        if (!phone.startsWith('966')) phone = '966' + phone;

        return subscribers[phone]?.chatId || null;
    } catch (e) {
        return null;
    }
}

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
        // Checkout URL from Salla or construct it
        checkoutUrl: data.checkout_url || data.recovery_url || data.cart_url || '',
        storeUrl: data.store?.url || data.merchant_url || '',
        storeName: data.store?.name || merchant,
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
        // Generate token and extract email from Salla data
        const token = generateToken();
        const email = data?.owner?.email || data?.email || data?.store?.email || '';

        stores.push({
            merchant,
            token,
            email,
            installedAt: new Date().toISOString(),
            active: true,
            data
        });
        writeDB(STORES_FILE, stores);
        console.log(`✅ Store ${merchant} installed with token: ${token.substring(0, 8)}...`);
    }
}

// Schedule reminder (simplified - in production use proper job queue like Bull/Redis)
function scheduleReminder(cart) {
    /*
     * SMART REMINDER STRATEGY:
     * 
     * IMMEDIATELY → SMS/WhatsApp (catches them while warm!)
     * 1 hour     → Email #1 (friendly reminder, no discount)
     * 6 hours    → Email #2 (5% discount)
     * 24 hours   → Email #3 (10% discount - last chance!)
     */

    // IMMEDIATE: Send SMS/WhatsApp right away (highest conversion!)
    console.log('📱 Sending IMMEDIATE SMS/WhatsApp...');
    sendImmediateReminder(cart);

    // DELAYED: Email reminders with increasing discounts
    const emailDelays = [
        { delay: 1 * 60 * 60 * 1000, discount: 0 },   // 1 hour - no discount
        { delay: 6 * 60 * 60 * 1000, discount: 5 },   // 6 hours - 5% off
        { delay: 24 * 60 * 60 * 1000, discount: 10 }  // 24 hours - 10% off
    ];

    // For DEMO: Use shorter delays (10s, 30s, 60s)
    const demoMode = true; // Set to false in production!
    const demoDelays = [
        { delay: 10000, discount: 0 },   // 10 seconds
        { delay: 30000, discount: 5 },   // 30 seconds
        { delay: 60000, discount: 10 }   // 60 seconds
    ];

    const delays = demoMode ? demoDelays : emailDelays;

    delays.forEach((reminder, index) => {
        setTimeout(async () => {
            const carts = readDB(DB_FILE);
            const currentCart = carts.find(c => c.id === cart.id);

            // Only send if not already recovered
            if (currentCart && currentCart.status !== 'recovered') {
                console.log(`📧 Sending Email reminder #${index + 1}...`);
                await sendEmailReminder(cart, index + 1);
            } else {
                console.log(`⏭️ Skipped reminder #${index + 1} - cart already recovered!`);
            }
        }, reminder.delay);
    });
}

// IMMEDIATE SMS/WhatsApp when cart is abandoned (catches them while warm!)
async function sendImmediateReminder(cart) {
    const message = `مرحباً ${cart.customer.name}! 👋\n\n` +
        `سلتك في انتظارك 🛒\n` +
        `${cart.items.length} منتجات بقيمة ${cart.total} ${cart.currency || 'SAR'}\n\n` +
        `أكمل طلبك الآن: ${cart.checkoutUrl || cart.storeUrl || ''}`;

    const results = { sms: false, whatsapp: false, telegram: false };

    // Try SMS first (highest reach)
    if (config.ENABLE_SMS && cart.customer.phone) {
        results.sms = await sendSMSReminder(cart, 0); // 0 = immediate, no discount
    }

    // Try WhatsApp if enabled
    if (config.ENABLE_WHATSAPP && cart.customer.phone) {
        results.whatsapp = await sendWhatsAppReminder(cart, 0);
    }

    // Try Telegram if customer has chat ID
    if (config.ENABLE_TELEGRAM && cart.customer.telegramChatId) {
        results.telegram = await sendTelegramReminder(cart, 0);
    }

    console.log('📊 Immediate reminder results:', results);
    return results;
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

// ==========================================
// SMART AI OFFERS (Personalized based on cart)
// ==========================================

function analyzeCart(cart) {
    const total = cart.total || 0;
    const itemCount = cart.items?.length || 0;

    // Determine customer segment
    let segment = 'standard';
    let suggestedDiscount = 5;
    let suggestedOffer = '';
    let urgencyLevel = 'low';

    // High-value cart (> 500 SAR) → Bigger discount worth it
    if (total >= 500) {
        segment = 'high_value';
        suggestedDiscount = 15;
        urgencyLevel = 'high';
        suggestedOffer = `خصم ${suggestedDiscount}% على طلبك!`;
    }
    // Medium cart (200-500 SAR)
    else if (total >= 200) {
        segment = 'medium_value';
        suggestedDiscount = 10;
        urgencyLevel = 'medium';
        suggestedOffer = `خصم ${suggestedDiscount}% لإتمام طلبك!`;
    }
    // Low cart (< 200 SAR) → Might be price-sensitive
    else if (total >= 50) {
        segment = 'price_sensitive';
        suggestedDiscount = 5;
        suggestedOffer = 'شحن مجاني على طلبك!';
    }
    // Very low cart → Might just be browsing
    else {
        segment = 'browser';
        suggestedDiscount = 0;
        suggestedOffer = 'نحن هنا لمساعدتك!';
    }

    return {
        segment,
        total,
        itemCount,
        suggestedDiscount,
        suggestedOffer,
        urgencyLevel,
        // Payment plan for medium/high value
        paymentPlan: total >= 200 ? {
            enabled: true,
            monthlyAmount: Math.ceil(total / 4),
            message: `قسّط على ٤ دفعات: ${Math.ceil(total / 4)} ${cart.currency}/شهر`
        } : null
    };
}

async function generateSmartOffer(cart, reminderNumber) {
    const analysis = analyzeCart(cart);

    console.log('🧠 Cart Analysis:', analysis);

    // Build AI prompt based on analysis
    const prompt = `أنت خبير في التسويق واسترجاع السلات المتروكة. اكتب رسالة مخصصة.

تحليل العميل:
- الاسم: ${cart.customer.name}
- قيمة السلة: ${analysis.total} ${cart.currency}
- عدد المنتجات: ${analysis.itemCount}
- نوع العميل: ${analysis.segment === 'high_value' ? 'عميل مميز - قيمة عالية' :
            analysis.segment === 'price_sensitive' ? 'عميل حساس للسعر' :
                analysis.segment === 'medium_value' ? 'عميل متوسط' : 'متصفح'}

الاستراتيجية المقترحة:
${analysis.segment === 'high_value' ?
            '- ركز على القيمة والجودة\n- اعرض خصم مميز\n- اذكر حصرية العرض' :
            analysis.segment === 'price_sensitive' ?
                '- ركز على التوفير\n- اعرض الشحن المجاني\n- اذكر خيار التقسيط إن وجد' :
                '- رسالة ودية\n- ذكّره بالمنتجات\n- لا تضغط كثيراً'}

${analysis.paymentPlan ? `خيار التقسيط: ${analysis.paymentPlan.message}` : ''}

العرض المقترح: ${analysis.suggestedOffer}
الخصم المقترح: ${analysis.suggestedDiscount}%
كود الخصم: RIBH${analysis.suggestedDiscount}

هذه الرسالة رقم ${reminderNumber} من 3.
${reminderNumber === 3 ? 'هذه آخر رسالة - استخدم عنصر العجلة والندرة!' : ''}

اكتب رسالة واتساب قصيرة (أقل من 200 حرف) بالعربية. اكتب الرسالة مباشرة:`;

    // Try AI generation
    let message = null;
    if (config.GEMINI_API_KEY) {
        message = await generateWithGemini(prompt);
    } else if (config.OPENAI_API_KEY) {
        message = await generateWithOpenAI(prompt);
    }

    // Fallback to smart template
    if (!message) {
        message = getSmartTemplate(cart, analysis, reminderNumber);
    }

    return {
        message,
        analysis,
        discountCode: `RIBH${analysis.suggestedDiscount}`,
        discount: analysis.suggestedDiscount
    };
}

function getSmartTemplate(cart, analysis, reminderNumber) {
    const name = cart.customer.name;
    const total = analysis.total;
    const currency = cart.currency || 'SAR';

    // High-value templates
    if (analysis.segment === 'high_value') {
        const templates = [
            `${name}، منتجاتك المميزة في الانتظار! 🌟\n\nقيمة سلتك: ${total} ${currency}\nخصم حصري لك: ${analysis.suggestedDiscount}%\n\nكود: RIBH${analysis.suggestedDiscount}`,
            `عميلنا المميز ${name}! 👑\n\nلا تفوّت عرضك الخاص\n${analysis.suggestedDiscount}% خصم على طلبك\n\n${analysis.paymentPlan ? analysis.paymentPlan.message : ''}`,
            `${name}، آخر فرصة! 🔥\n\nخصم ${analysis.suggestedDiscount}% ينتهي خلال ساعات\n\nكود: RIBH${analysis.suggestedDiscount}\n\nأكمل طلبك الآن!`
        ];
        return templates[reminderNumber - 1] || templates[0];
    }

    // Price-sensitive templates
    if (analysis.segment === 'price_sensitive') {
        const templates = [
            `مرحباً ${name}! 👋\n\nسلتك في انتظارك\n🚚 شحن مجاني على طلبك!\n\nأكمل طلبك الآن`,
            `${name}، عرض خاص! 🎁\n\nخصم ${analysis.suggestedDiscount}% + شحن مجاني\n\nكود: RIBH${analysis.suggestedDiscount}`,
            `${name}، فرصتك الأخيرة! ⏰\n\n${analysis.suggestedOffer}\n\nالعرض ينتهي اليوم!`
        ];
        return templates[reminderNumber - 1] || templates[0];
    }

    // Standard templates
    const templates = [
        `مرحباً ${name}! 👋\n\nلاحظنا أنك تركت بعض المنتجات في سلتك.\n\nنحن هنا لمساعدتك! 🛒`,
        `${name}، منتجاتك لا تزال في الانتظار! 🛍️\n\nخصم ${analysis.suggestedDiscount}% لك\nكود: RIBH${analysis.suggestedDiscount}`,
        `آخر فرصة يا ${name}! 🔥\n\nخصم ${analysis.suggestedDiscount}%\nكود: RIBH${analysis.suggestedDiscount}\n\nلا تفوّت الفرصة!`
    ];

    return templates[reminderNumber - 1] || templates[0];
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
                <a href="${cart.checkoutUrl || cart.storeUrl || '#'}" class="btn" style="color: white;">أكمل طلبك الآن 🛒</a>
            </p>
            
            ${discountCode ? `<p style="text-align: center; color: #666; font-size: 14px;">استخدم الكود <strong>${discountCode}</strong> عند الدفع</p>` : ''}
            
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

    const discount = config.REMINDER_DELAYS[reminderNumber - 1]?.discount || 0;
    const discountCode = discount > 0 ? `RIBH${discount}` : '';

    let message;
    if (reminderNumber === 0 || reminderNumber === 1) {
        message = `🛒 مرحباً ${cart.customer.name}!\n\nسلتك في انتظارك:\n💰 المجموع: ${cart.total} ${cart.currency || 'SAR'}\n\n🔗 أكمل طلبك: ${cart.checkoutUrl || cart.storeUrl || ''}`;
    } else if (discount > 0) {
        message = `🎁 ${cart.customer.name}، خصم خاص لك!\n\n✨ خصم ${discount}%\n🏷️ كود: ${discountCode}\n\n🔗 أكمل طلبك: ${cart.checkoutUrl || cart.storeUrl || ''}`;
    } else {
        message = `⏰ تذكير: سلتك المتروكة في انتظارك يا ${cart.customer.name}!`;
    }

    // Try to get chatId from cart OR lookup by phone
    let chatId = cart.customer.telegramChatId;
    if (!chatId && cart.customer.phone) {
        chatId = getTelegramChatId(cart.customer.phone);
    }

    if (chatId) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            const result = await response.json();
            if (result.ok) {
                console.log(`✅ Telegram sent to ${chatId}`);
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

    console.log('📱 Telegram: Customer has no chat ID - they need to subscribe first');
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

// ==========================================
// REFERRAL SYSTEM ENDPOINTS
// ==========================================

// Get referral stats for a store
app.get('/api/referrals', (req, res) => {
    const cookies = parseCookies(req);
    const token = req.query.token || cookies.ribhToken;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const stores = readDB(STORES_FILE);
    const store = stores.find(s => s.ribhToken === token);

    if (!store || !referralSystem) {
        return res.json({ referrals: [], total: 0 });
    }

    const referrals = referralSystem.getStoreReferrals(store.merchant);
    const totalEarnings = referrals.reduce((sum, r) => sum + r.totalEarnings, 0);
    const totalReferred = referrals.reduce((sum, r) => sum + r.referredCustomers.length, 0);

    res.json({
        referrals: referrals,
        stats: {
            totalReferrers: referrals.length,
            totalReferred: totalReferred,
            totalEarnings: totalEarnings
        }
    });
});

// Track referral use (when someone uses a referral code)
app.post('/api/referrals/track', (req, res) => {
    const { storeId, code, customerEmail, orderValue } = req.body;

    if (!referralSystem) {
        return res.status(500).json({ error: 'Referral system not available' });
    }

    const result = referralSystem.trackReferralUse(storeId, code, customerEmail, orderValue);

    if (result) {
        res.json({ success: true, result });
    } else {
        res.status(404).json({ error: 'Referral code not found' });
    }
});

// ==========================================
// EXIT POPUP API
// ==========================================
const POPUP_LEADS_FILE = path.join(__dirname, 'data', 'popup_leads.json');
if (!fs.existsSync(POPUP_LEADS_FILE)) {
    fs.writeFileSync(POPUP_LEADS_FILE, JSON.stringify([]));
}

// Capture email from popup
app.post('/api/popup/capture', (req, res) => {
    const { storeId, email, discount, source } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    const leads = readDB(POPUP_LEADS_FILE);
    const lead = {
        id: Date.now().toString(),
        storeId: storeId,
        email: email,
        discount: discount,
        source: source || 'exit_popup',
        createdAt: new Date().toISOString(),
        converted: false
    };

    leads.push(lead);

    // Keep last 5000 leads
    if (leads.length > 5000) {
        leads.splice(0, leads.length - 5000);
    }

    try {
        fs.writeFileSync(POPUP_LEADS_FILE, JSON.stringify(leads, null, 2));
    } catch (e) { }

    console.log(`📥 [Popup] Captured lead: ${email} from ${storeId}`);

    // Send discount code email
    if (lifecycleEngine) {
        const stores = readDB(STORES_FILE);
        const store = stores.find(s => String(s.merchant) === String(storeId)) || {};

        lifecycleEngine.handleNewCustomer(store, { email: email });
    }

    res.json({ success: true, message: 'Lead captured' });
});

// Track popup shown
app.post('/api/popup/shown', (req, res) => {
    const { storeId } = req.body;
    console.log(`👁️ [Popup] Shown on ${storeId}`);
    res.json({ success: true });
});

// Get popup stats
app.get('/api/popup/stats', (req, res) => {
    const leads = readDB(POPUP_LEADS_FILE);
    const storeId = req.query.storeId;

    const storeLeads = storeId
        ? leads.filter(l => l.storeId === storeId)
        : leads;

    res.json({
        total: storeLeads.length,
        converted: storeLeads.filter(l => l.converted).length,
        last7Days: storeLeads.filter(l =>
            new Date(l.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length
    });
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

// Trigger win-back check manually (for testing)
app.post('/api/winback/run', async (req, res) => {
    console.log('🔄 Manual win-back trigger...');

    if (!lifecycleEngine || !lifecycleEngine.checkInactiveCustomers) {
        return res.status(500).json({ error: 'Lifecycle engine not available' });
    }

    try {
        const result = await lifecycleEngine.checkInactiveCustomers();
        res.json({
            success: true,
            message: 'Win-back check complete',
            checked: result.checked,
            emailsSent: result.sent
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
// TELEGRAM SUBSCRIPTION ENDPOINTS
// ==========================================

// Handle Telegram Login Widget callback
app.post('/api/telegram/auth', async (req, res) => {
    const user = req.body;
    console.log('📱 Telegram auth callback:', user);

    if (user && user.id) {
        // Save the Telegram user
        const chatId = user.id;
        const name = user.first_name || 'عميل';
        const phone = user.phone_number || '';

        if (phone) {
            await saveTelegramSubscriber(phone, chatId, name);
        } else {
            // Store by Telegram user ID if no phone
            let subscribers = {};
            try {
                subscribers = JSON.parse(fs.readFileSync(TELEGRAM_SUBSCRIBERS_FILE, 'utf8'));
            } catch (e) {
                subscribers = {};
            }
            subscribers[`tg_${chatId}`] = { chatId, name, subscribedAt: new Date().toISOString() };
            fs.writeFileSync(TELEGRAM_SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
        }

        res.json({ success: true, message: 'تم التسجيل بنجاح!' });
    } else {
        res.status(400).json({ success: false, error: 'Invalid data' });
    }
});

// Subscribe by phone number
app.post('/api/telegram/subscribe', async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone required' });
    }

    console.log('📱 Telegram phone subscription:', phone);

    // Generate the subscription link
    const link = getTelegramSignupLink(phone);

    res.json({
        success: true,
        message: 'افتح الرابط للاشتراك',
        link
    });
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
// SEQUENCE PROCESSOR (Multi-step emails)
// ==========================================
let sequenceEngine;
let emailSender;
try {
    sequenceEngine = require('./lib/sequenceEngine');
    emailSender = require('./lib/emailSender');
    console.log('✅ Sequence Engine loaded');
} catch (e) {
    console.log('⚠️ Sequence Engine not available:', e.message);
}

// Process pending sequence steps every minute
if (sequenceEngine && emailSender) {
    setInterval(async () => {
        try {
            await sequenceEngine.processPendingSteps(emailSender);
        } catch (e) {
            console.log('⚠️ Sequence processing error:', e.message);
        }
    }, 60 * 1000); // Every 1 minute
    console.log('⏰ Sequence processor running every minute');
}

// ==========================================
// DAILY WIN-BACK CHECK (Continuity Marketing)
// ==========================================
const WINBACK_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

async function runDailyWinback() {
    console.log('🔄 Running daily win-back check...');
    if (lifecycleEngine && lifecycleEngine.checkInactiveCustomers) {
        const result = await lifecycleEngine.checkInactiveCustomers();
        console.log(`✅ Win-back complete: ${result.sent} emails sent`);
    }
}

// Run win-back check once per day (start after 1 hour to avoid startup load)
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    setTimeout(() => {
        runDailyWinback(); // Run once on startup (delayed)
        setInterval(runDailyWinback, WINBACK_CHECK_INTERVAL); // Then daily
    }, 60 * 60 * 1000); // 1 hour after start
    console.log('📅 Daily win-back scheduler enabled');
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
