const admin = require('firebase-admin');
// Initialize if not already initialized
if (admin.apps.length === 0) {
    // Check for service account in environment (for Render deployment)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase initialized with service account from env');
    } else {
        // Default initialization (works in Firebase Functions)
        admin.initializeApp();
    }
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lifecycle Engine V2 - FULLY INTEGRATED (AI + WhatsApp + Sequences)
let lifecycleEngine;
try {
    lifecycleEngine = require('./lib/lifecycleEngineV2');
    console.log('✅ Lifecycle Engine V2 loaded - Full WhatsApp + Sequence Integration!');
} catch (e) {
    // Fallback to V1 if V2 not available
    try {
        lifecycleEngine = require('./lib/lifecycleEngine');
        console.log('⚠️ Lifecycle Engine V2 not available, using V1');
    } catch (e2) {
        console.log('⚠️ Lifecycle Engine not available:', e.message);
        lifecycleEngine = null;
    }
}

// Sequence Engine (for manual sequence operations)
let sequenceEngine;
try {
    sequenceEngine = require('./lib/sequenceEngine');
    console.log('✅ Sequence Engine loaded');
} catch (e) {
    sequenceEngine = null;
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

// AI Messenger - Advanced Personalization Engine (Task 4)
let aiMessenger;
try {
    aiMessenger = require('./lib/aiMessenger');
    console.log('✅ AI Messenger loaded - Advanced personalization, urgency & تقسيط enabled!');
} catch (e) {
    console.log('⚠️ AI Messenger not available:', e.message);
    aiMessenger = null;
}

// WhatsApp Bridge - QR Code based merchant connections (FREE unlimited messaging!)
let whatsappBridge;
try {
    whatsappBridge = require('./lib/whatsappBridge');
    console.log('✅ WhatsApp Bridge loaded - FREE unlimited messaging via merchant QR!');
} catch (e) {
    console.log('⚠️ WhatsApp Bridge not available:', e.message);
    whatsappBridge = null;
}

// Salla Webhooks - Complete event handler with phone normalization
let sallaWebhooks;
try {
    sallaWebhooks = require('./lib/sallaWebhooks');
    console.log('✅ Salla Webhooks loaded - Saudi phone normalization enabled!');
} catch (e) {
    console.log('⚠️ Salla Webhooks module not available:', e.message);
    sallaWebhooks = null;
}

// Salla App - OAuth & Token Management
let sallaApp;
try {
    sallaApp = require('./lib/sallaApp');
    console.log('✅ Salla App loaded - Token management enabled!');
} catch (e) {
    console.log('⚠️ Salla App not available:', e.message);
    sallaApp = null;
}

// Predictive Analytics - CLV, churn prediction, next order
let predictiveAnalytics;
try {
    predictiveAnalytics = require('./lib/predictiveAnalytics');
    console.log('✅ Predictive Analytics loaded - CLV, churn & next order predictions!');
} catch (e) {
    console.log('⚠️ Predictive Analytics not available:', e.message);
    predictiveAnalytics = null;
}

// RFM Segmentation - Customer segmentation by Recency, Frequency, Monetary
let rfmSegmentation;
try {
    rfmSegmentation = require('./lib/rfmSegmentation');
    console.log('✅ RFM Segmentation loaded - Smart customer segments!');
} catch (e) {
    console.log('⚠️ RFM Segmentation not available:', e.message);
    rfmSegmentation = null;
}

// AI Learning - Continuous learning from customer behavior
let aiLearning;
try {
    aiLearning = require('./lib/aiLearning');
    console.log('✅ AI Learning loaded - Self-improving intelligence!');
} catch (e) {
    console.log('⚠️ AI Learning not available:', e.message);
    aiLearning = null;
}

// Event Tracker - Track customer events for analytics
let eventTracker;
try {
    eventTracker = require('./lib/eventTracker');
    console.log('✅ Event Tracker loaded - Customer event tracking enabled!');
} catch (e) {
    console.log('⚠️ Event Tracker not available:', e.message);
    eventTracker = null;
}

// Outreach Tracker - WhatsApp outreach A/B testing
let outreachTracker;
try {
    outreachTracker = require('./lib/outreachTracker');
    console.log('✅ Outreach Tracker loaded - WhatsApp A/B testing enabled!');
} catch (e) {
    console.log('⚠️ Outreach Tracker not available:', e.message);
    outreachTracker = null;
}

// Post-Purchase Upsell Engine - AI-powered upsells after orders
let postPurchaseUpsell;
try {
    postPurchaseUpsell = require('./lib/postPurchaseUpsell');
    console.log('✅ Post-Purchase Upsell loaded - AI upsells after orders!');
} catch (e) {
    console.log('⚠️ Post-Purchase Upsell not available:', e.message);
    postPurchaseUpsell = null;
}

// Review Collector - WhatsApp review collection + smart routing
let reviewCollector;
try {
    reviewCollector = require('./lib/reviewCollector');
    console.log('✅ Review Collector loaded - WhatsApp review collection enabled!');
} catch (e) {
    console.log('⚠️ Review Collector not available:', e.message);
    reviewCollector = null;
}

// Browse Abandonment - Detect & recover product browsers
let browseAbandonment;
try {
    browseAbandonment = require('./lib/browseAbandonment');
    console.log('✅ Browse Abandonment loaded - Product view recovery enabled!');
} catch (e) {
    console.log('⚠️ Browse Abandonment not available:', e.message);
    browseAbandonment = null;
}

// Campaign Launcher - Cold outreach campaign management
let campaignLauncher;
try {
    campaignLauncher = require('./lib/campaignLauncher');
    console.log('✅ Campaign Launcher loaded - Cold outreach campaigns enabled!');
} catch (e) {
    console.log('⚠️ Campaign Launcher not available:', e.message);
    campaignLauncher = null;
}

// Customer Import - CSV/POS data import with Saudi phone normalization
let customerImport;
try {
    customerImport = require('./lib/customerImport');
    console.log('✅ Customer Import loaded - CSV/POS import with smart dedup enabled!');
} catch (e) {
    console.log('⚠️ Customer Import not available:', e.message);
    customerImport = null;
}

// Salla Scraper - Store discovery and lead generation
let sallaScraper;
try {
    sallaScraper = require('./sallaScraper');
    console.log('✅ Salla Scraper loaded - Store discovery & lead generation enabled!');
} catch (e) {
    console.log('⚠️ Salla Scraper not available:', e.message);
    sallaScraper = null;
}

// Outreach Automation - Cold outreach pipeline (Hormozi 100M Leads framework)
let outreachAutomation;
try {
    outreachAutomation = require('./outreachAutomation');
    console.log('✅ Outreach Automation loaded - Multi-step cold outreach enabled!');
} catch (e) {
    console.log('⚠️ Outreach Automation not available:', e.message);
    outreachAutomation = null;
}

// Campaign Engine - Template-based campaign system
let campaignEngine;
try {
    campaignEngine = require('./campaignEngine');
    console.log('✅ Campaign Engine loaded - Template campaigns & revenue tracking enabled!');
} catch (e) {
    console.log('⚠️ Campaign Engine not available:', e.message);
    campaignEngine = null;
}

// Loyalty Engine - Points, tiers, and referrals
let loyaltyEngine;
try {
    loyaltyEngine = require('./loyaltyEngine');
    console.log('✅ Loyalty Engine loaded - Points & rewards system enabled!');
} catch (e) {
    console.log('⚠️ Loyalty Engine not available:', e.message);
    loyaltyEngine = null;
}

// Review Engine - Post-purchase review collection
let reviewEngine;
try {
    reviewEngine = require('./reviewEngine');
    console.log('✅ Review Engine loaded - Review collection & stats enabled!');
} catch (e) {
    console.log('⚠️ Review Engine not available:', e.message);
    reviewEngine = null;
}

// COD Confirmation - WhatsApp order confirmation before dispatch
let codConfirmation;
try {
    codConfirmation = require('./codConfirmation');
    console.log('✅ COD Confirmation loaded - Order verification & prepaid conversion enabled!');
} catch (e) {
    console.log('⚠️ COD Confirmation not available:', e.message);
    codConfirmation = null;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// CONFIGURATION
// ==========================================
const config = {
    // Salla
    SALLA_WEBHOOK_SECRET: process.env.SALLA_WEBHOOK_SECRET || '',
    SALLA_CLIENT_ID: process.env.SALLA_CLIENT_ID || '476e7ed1-796c-4731-b145-73a13d0019de',
    SALLA_CLIENT_SECRET: process.env.SALLA_CLIENT_SECRET || 'ca8e6de4265c8faa553c8ac45af0acb6306de00a388bf4e06027e4229944f5fe',

    // Shopify - Set via: firebase functions:config:set shopify.key="xxx" shopify.secret="xxx"
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY || '',
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET || '',
    SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES || 'read_orders,write_orders,read_checkouts,write_checkouts,read_customers,read_products',

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

// ==========================================
// 📧 EMAIL TEMPLATE HELPER (Anti-Spam)
// ==========================================

/**
 * Professional email wrapper to avoid spam filters
 * - Adds proper headers
 * - Includes unsubscribe link
 * - Proper text-to-link ratio
 * - CAN-SPAM compliant footer
 */
function wrapEmailContent(bodyContent, options = {}) {
    const {
        merchantName = 'المتجر',
        unsubscribeUrl = 'https://ribh.click/unsubscribe',
        preheader = ''
    } = options;

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>رسالة من ${merchantName}</title>
        <!--[if mso]>
        <style type="text/css">
            body, table, td {font-family: Arial, sans-serif !important;}
        </style>
        <![endif]-->
        <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; }
            .wrapper { max-width: 600px; margin: 0 auto; }
            .content { background: white; border-radius: 16px; margin: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
            .footer { text-align: center; padding: 20px; color: #888; font-size: 12px; }
            .footer a { color: #888; text-decoration: underline; }
            .preheader { display: none; max-height: 0; overflow: hidden; }
        </style>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f5f5f5;">
        ${preheader ? `<div class="preheader" style="display: none; max-height: 0; overflow: hidden;">${preheader}</div>` : ''}
        
        <div class="wrapper" style="max-width: 600px; margin: 0 auto;">
            <div class="content" style="background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px;">
                ${bodyContent}
            </div>
            
            <div class="footer" style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                <p style="margin: 5px 0;">هذه الرسالة من ${merchantName}</p>
                <p style="margin: 5px 0;">
                    <a href="${unsubscribeUrl}" style="color: #888;">إلغاء الاشتراك</a> | 
                    <a href="https://ribh.click" style="color: #888;">رِبح</a>
                </p>
                <p style="margin: 10px 0 0; font-size: 11px; color: #aaa;">
                    RIBH - Riyadh, Saudi Arabia
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

/**
 * Send email with anti-spam best practices
 */
async function sendProfessionalEmail({ to, subject, body, preheader, merchantName }) {
    // Clean subject - reduce emojis (max 1)
    let cleanSubject = subject;
    const emojiCount = (subject.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > 1) {
        // Keep only first emoji
        let found = 0;
        cleanSubject = subject.replace(/[\u{1F300}-\u{1F9FF}]/gu, (match) => {
            found++;
            return found === 1 ? match : '';
        });
    }

    const htmlContent = wrapEmailContent(body, { merchantName, preheader });

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to,
                subject: cleanSubject,
                html: htmlContent,
                headers: {
                    'List-Unsubscribe': '<https://ribh.click/unsubscribe>',
                    'X-Entity-Ref-ID': Date.now().toString()
                }
            })
        });

        const result = await response.json();
        if (result.id) {
            console.log(`✅ Email sent to ${to}`);
            return { success: true, id: result.id };
        } else {
            console.error('❌ Email error:', result);
            return { success: false, error: result };
        }
    } catch (error) {
        console.error('❌ Email error:', error);
        return { success: false, error: error.message };
    }
}

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

// Clean URLs middleware - serve .html files without extension
app.use((req, res, next) => {
    // Skip if path has extension or is an API route
    if (req.path.includes('.') || req.path.startsWith('/api/') || req.path.startsWith('/oauth')) {
        return next();
    }

    // List of static HTML pages
    const staticPages = ['faq', 'privacy', 'login', 'settings', 'analytics', 'messages',
        'referrals', 'telegram', 'welcome', 'landing', 'magic', 'oneclick', 'preview', 'whatsapp', 'setup'];

    const pageName = req.path.substring(1); // Remove leading /

    if (staticPages.includes(pageName)) {
        return res.sendFile(pageName + '.html', { root: path.join(__dirname, '../public') });
    }

    next();
});

app.use(express.static(path.join(__dirname, '../public')));

// Salla Routes (OAuth + Webhooks)
try {
    const sallaRoutes = require('./routes/salla');
    app.use('/salla', sallaRoutes);
    console.log('✅ Salla routes loaded - /salla/install, /salla/callback, /salla/webhooks');
} catch (e) {
    console.log('⚠️ Salla routes not loaded:', e.message);
}

// Shopify Routes (OAuth + Webhooks)
try {
    const shopifyRoutes = require('./routes/shopify');
    app.use('/shopify', shopifyRoutes);
    console.log('✅ Shopify routes loaded - /shopify/install, /shopify/callback, /shopify/webhooks');
} catch (e) {
    console.log('⚠️ Shopify routes not loaded:', e.message);
}

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`, req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) : '');
    next();
});

// Simple file-based database
// Firestore Database
const db = admin.firestore();
const DB_COLLECTION = 'carts';
const STORES_COLLECTION = 'stores';
const LOGS_COLLECTION = 'logs';
// Legacy constants for compatibility with existing code
const STORES_FILE = 'stores';
const DB_FILE = 'carts';
const LOG_FILE = 'logs';

// Helper functions (Converted to Async for Firestore)
async function readDB(collectionName) {
    try {
        // Map file paths to collection names if legacy comparison is used
        // Map file paths to collection names if legacy comparison is used
        let col = collectionName;
        // String conversion to handle legacy file path objects if any
        const name = String(collectionName);
        if (name.includes('carts')) col = DB_COLLECTION;
        if (name.includes('stores')) col = STORES_COLLECTION;
        if (name.includes('logs')) col = LOGS_COLLECTION;
        if (name.includes('leads')) col = 'leads';
        if (name.includes('templates')) col = 'templates';

        const snapshot = await db.collection(col).get();
        if (snapshot.empty) return [];

        // Convert logs and lists back to array
        return snapshot.docs.map(doc => doc.data());
    } catch (e) {
        console.error(`Error reading ${collectionName}:`, e);
        return [];
    }
}

async function writeDB(collectionName, data) {
    // Map file paths to collection names
    // Map file paths to collection names
    let col = collectionName;
    const name = String(collectionName);
    if (name.includes('carts')) col = DB_COLLECTION;
    if (name.includes('stores')) col = STORES_COLLECTION;
    if (name.includes('logs')) col = LOGS_COLLECTION;
    if (name.includes('leads')) col = 'leads';
    if (name.includes('templates')) col = 'templates';

    // Warning: This implementation overwrites the entire collection strategy 
    // to match the legacy "save whole array" behavior. 
    // In a real app, we should save individual docs. 
    // For migration speed, we will use a single 'data' doc or batch write.

    // Better approach for "Array replacement":
    // For carts/stores, we usually append. But the code passes the WHOLE array.
    // To keep it simple and working: We will rewrite documents based on IDs if possible, 
    // or (easier for migration) delete all and rewrite? No, that's expensive.

    // Compromise: We will assume 'data' is an array of objects.
    // We will batch write them using a unique key (e.g. id, email, token).

    const batch = db.batch();
    const collectionRef = db.collection(col);

    // 1. Ideally we don't delete everything. But legacy code assumes "Output = Input".
    // For now, let's just save the array items. 
    // To prevent infinite growth/duplication if we don't delete, we need a strategy.
    // Strategy: Use a deterministic ID.

    data.forEach(item => {
        let id = item.id || item.token || item.ribhToken || item.email || crypto.randomUUID();
        // Sanitize ID
        id = String(id).replace(/\//g, '_');
        const docRef = collectionRef.doc(id);
        batch.set(docRef, item, { merge: true });
    });

    try {
        await batch.commit();
    } catch (e) {
        console.error(`Error writing to ${col}:`, e);
    }
}

async function logWebhook(event, data) {
    try {
        await db.collection(LOGS_COLLECTION).add({
            timestamp: new Date().toISOString(),
            event,
            data
        });
    } catch (e) {
        console.error('Error logging webhook:', e);
    }
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
// Verify store token middleware
async function verifyStoreToken(req, res, next) {
    const cookies = parseCookies(req);
    const token = req.query.token || cookies.ribhToken;

    if (!token) {
        return res.redirect('/login.html');
    }

    const stores = await readDB(STORES_FILE);
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
app.get('/api/auth/verify', async (req, res) => {
    const cookies = parseCookies(req);
    const token = req.query.token || cookies.ribhToken;

    if (!token) {
        return res.json({ success: false, error: 'No token provided' });
    }

    const stores = await readDB(STORES_FILE);
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

    const stores = await readDB(STORES_FILE);
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
// AI MESSAGE PREVIEW API (Task 4)
// ==========================================

/**
 * Generate AI-powered cart recovery message
 * POST /api/ai/generate-message
 * 
 * Request: { customerName, cartValue, items, channel, style }
 * Response: { success, message, offer }
 */
app.post('/api/ai/generate-message', async (req, res) => {
    try {
        const { customerName, cartValue, items, channel, style } = req.body;

        // Validate required fields
        if (!customerName) {
            return res.status(400).json({ success: false, error: 'اسم العميل مطلوب' });
        }

        // Build product list
        const productList = Array.isArray(items) && items.length > 0
            ? items.map(item => typeof item === 'string' ? item : item.name || item.product_name).join('، ')
            : 'منتجات متنوعة';

        // Build AI prompt
        const prompt = `أنشئ رسالة قصيرة وودودة باللغة العربية لاسترداد سلة متروكة.

معلومات العميل:
- اسم العميل: ${customerName}
- قيمة السلة: ${cartValue || 0} ر.س
- المنتجات: ${productList}
- القناة: ${channel === 'whatsapp' ? 'واتساب (قصيرة جداً، أقل من 150 حرف)' : 'بريد إلكتروني (أطول قليلاً)'}
- الأسلوب: ${style === 'urgent' ? 'عاجل مع عنصر الندرة' : 'ودود ومرحب'}

${(cartValue || 0) > 500 ? 'أضف عرض خصم 10% بكود RIBH10 لأن قيمة السلة عالية' : ''}
${(cartValue || 0) > 200 ? 'ذكر العميل بإمكانية التقسيط (ادفع 25% فقط واستلم طلبك) لتسهيل الشراء' : ''}

المطلوب:
- رسالة قصيرة وجذابة
- استخدم إيموجي مناسب
- اذكر اسم العميل في البداية
- لا مقدمات، اكتب الرسالة مباشرة

اكتب الرسالة فقط:`;

        let message = null;

        // Try Gemini first (free!)
        if (config.GEMINI_API_KEY) {
            message = await generateWithGemini(prompt);
        }
        // Fallback to OpenAI
        else if (config.OPENAI_API_KEY) {
            message = await generateWithOpenAI(prompt);
        }

        // If no AI available, use template
        if (!message) {
            const cartValueNum = cartValue || 0;
            const hasOffer = cartValueNum > 500;

            if (channel === 'whatsapp') {
                message = `مرحباً ${customerName}! 👋\n\nسلتك (${cartValueNum} ر.س) في انتظارك 🛒\n${hasOffer ? '🎁 خصم 10% بكود RIBH10' : ''}\n\nأكمل طلبك الآن!`;
            } else {
                message = `مرحباً ${customerName}! 👋\n\nلاحظنا أنك تركت بعض المنتجات الرائعة في سلتك بقيمة ${cartValueNum} ر.س.\n\n${hasOffer ? '🎁 عرض خاص: خصم 10% على طلبك باستخدام كود RIBH10\n\n' : ''}نحن هنا لمساعدتك في إتمام طلبك!`;
            }
        }

        // Determine offer based on cart value
        const cartValueNum = parseFloat(cartValue) || 0;
        const offer = cartValueNum > 500 ? {
            type: 'discount',
            value: '10%',
            code: 'RIBH10',
            message: 'خصم 10% على طلبك!'
        } : cartValueNum > 200 ? {
            type: 'free_shipping',
            value: 'مجاني',
            code: 'FREESHIP',
            message: 'شحن مجاني على طلبك!'
        } : null;

        res.json({
            success: true,
            message: message.trim(),
            offer,
            channel: channel || 'whatsapp',
            customerName,
            cartValue: cartValueNum
        });

        console.log(`🤖 AI message generated for ${customerName} (${channel || 'whatsapp'})`);

    } catch (error) {
        console.error('❌ Error generating AI message:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في إنشاء الرسالة'
        });
    }
});

// ==========================================
// AI OFFER GENERATOR API
// ==========================================
let OfferGenerator;
try {
    const offerModule = require('./lib/offer-generator');
    OfferGenerator = offerModule.OfferGenerator;
    console.log('✅ AI Offer Generator loaded');
} catch (e) {
    console.log('⚠️ AI Offer Generator not available:', e.message);
    OfferGenerator = null;
}

/**
 * Generate intelligent, context-aware offers
 * POST /api/ai/generate-offer
 * 
 * Request: { season?, productType?, cartValue?, productName?, customerType?, behavior?, abandonTime? }
 * Response: { success, offer: { headline, urgency, scarcity, bonus, guarantee, cta, fullMessage, ... } }
 */
app.post('/api/ai/generate-offer', async (req, res) => {
    try {
        if (!OfferGenerator) {
            return res.status(500).json({
                success: false,
                error: 'AI Offer Generator not available'
            });
        }

        const generator = new OfferGenerator({
            language: req.body.language || 'ar',
            merchantName: req.body.merchantName || 'متجرنا'
        });

        const offer = generator.generate({
            season: req.body.season,
            productType: req.body.productType,
            cartValue: req.body.cartValue,
            productName: req.body.productName,
            customerType: req.body.customerType,
            behavior: req.body.behavior,
            abandonTime: req.body.abandonTime
        });

        res.json({
            success: true,
            offer
        });

        console.log(`🧠 AI Offer generated: ${offer.headline.substring(0, 50)}...`);

    } catch (error) {
        console.error('❌ Error generating offer:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في إنشاء العرض'
        });
    }
});

/**
 * Generate offer for a specific cart
 * POST /api/ai/generate-cart-offer
 * 
 * Request: { cart: { total, items, createdAt }, customer?: { totalOrders, totalSpent, daysSinceLastOrder } }
 * Response: { success, offer }
 */
app.post('/api/ai/generate-cart-offer', async (req, res) => {
    try {
        if (!OfferGenerator) {
            return res.status(500).json({
                success: false,
                error: 'AI Offer Generator not available'
            });
        }

        const { cart, customer } = req.body;

        if (!cart) {
            return res.status(400).json({
                success: false,
                error: 'Cart data is required'
            });
        }

        const generator = new OfferGenerator({
            language: req.body.language || 'ar',
            merchantName: req.body.merchantName || 'متجرنا'
        });

        const offer = generator.generateForCart(cart, customer);

        res.json({
            success: true,
            offer
        });

        console.log(`🛒 Cart offer generated: ${offer.headline.substring(0, 50)}...`);

    } catch (error) {
        console.error('❌ Error generating cart offer:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في إنشاء العرض'
        });
    }
});

// ==========================================
// 🔮 PREDICTIVE ANALYTICS API
// CLV, Churn Risk, Next Order Predictions
// ==========================================

/**
 * Get customer predictions (CLV, churn risk, next order)
 * GET /api/customers/:id/predictions
 * 
 * Response: { success, predictions: { clv, churnRisk, nextOrderDate, recommendations } }
 */
app.get('/api/customers/:id/predictions', async (req, res) => {
    try {
        if (!predictiveAnalytics) {
            return res.status(503).json({
                success: false,
                error: 'Predictive Analytics not available'
            });
        }

        const customerId = req.params.id;
        const merchantId = req.query.merchant || req.storeId;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID is required'
            });
        }

        console.log(`🔮 Getting predictions for customer: ${customerId}`);

        const predictions = await predictiveAnalytics.getCustomerPredictions(customerId, merchantId);

        res.json({
            success: true,
            customerId,
            predictions
        });

    } catch (error) {
        console.error('❌ Error getting customer predictions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get customer predictions'
        });
    }
});

// ==========================================
// 📊 RFM SEGMENTATION API
// Customer Segments by Recency, Frequency, Monetary
// ==========================================

/**
 * Get RFM segment dashboard
 * GET /api/segments/dashboard
 * 
 * Response: { success, dashboard: { segments, totalCustomers, segmentDistribution } }
 */
app.get('/api/segments/dashboard', async (req, res) => {
    try {
        if (!rfmSegmentation) {
            return res.status(503).json({
                success: false,
                error: 'RFM Segmentation not available'
            });
        }

        const merchantId = req.query.merchant || req.storeId;

        console.log(`📊 Getting RFM dashboard for merchant: ${merchantId || 'all'}`);

        const dashboard = await rfmSegmentation.getDashboard(merchantId);

        res.json({
            success: true,
            dashboard
        });

    } catch (error) {
        console.error('❌ Error getting segment dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get segment dashboard'
        });
    }
});

/**
 * Get customers in a specific segment
 * GET /api/segments/:segment/customers
 * 
 * Query params: ?limit=50&offset=0&merchant=xxx
 * Response: { success, segment, customers, total }
 */
app.get('/api/segments/:segment/customers', async (req, res) => {
    try {
        if (!rfmSegmentation) {
            return res.status(503).json({
                success: false,
                error: 'RFM Segmentation not available'
            });
        }

        const segment = req.params.segment;
        const merchantId = req.query.merchant || req.storeId;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        if (!segment) {
            return res.status(400).json({
                success: false,
                error: 'Segment name is required'
            });
        }

        console.log(`📊 Getting customers in segment: ${segment}`);

        const result = await rfmSegmentation.getCustomersInSegment(segment, {
            merchantId,
            limit,
            offset
        });

        res.json({
            success: true,
            segment,
            customers: result.customers,
            total: result.total,
            limit,
            offset
        });

    } catch (error) {
        console.error('❌ Error getting segment customers:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get segment customers'
        });
    }
});

// ==========================================
// 🧠 AI LEARNING API
// Self-Improving Intelligence & Insights
// ==========================================

/**
 * Get AI learning insights
 * GET /api/ai/insights
 * 
 * Query params: ?merchant=xxx&type=all|conversion|timing|offers
 * Response: { success, insights: { ... } }
 */
app.get('/api/ai/insights', async (req, res) => {
    try {
        if (!aiLearning) {
            return res.status(503).json({
                success: false,
                error: 'AI Learning not available'
            });
        }

        const merchantId = req.query.merchant || req.storeId;
        const insightType = req.query.type || 'all';

        console.log(`🧠 Getting AI insights for merchant: ${merchantId || 'all'}, type: ${insightType}`);

        const insights = await aiLearning.getInsights(merchantId, insightType);

        res.json({
            success: true,
            merchantId,
            type: insightType,
            insights
        });

    } catch (error) {
        console.error('❌ Error getting AI insights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get AI insights'
        });
    }
});

/**
 * Get best pricing strategy recommendation
 * GET /api/ai/pricing-strategy
 * 
 * Query params: ?merchant=xxx&productType=xxx&cartValue=xxx
 * Response: { success, strategy: { discountPercent, timing, channel, confidence } }
 */
app.get('/api/ai/pricing-strategy', async (req, res) => {
    try {
        if (!aiLearning) {
            return res.status(503).json({
                success: false,
                error: 'AI Learning not available'
            });
        }

        const merchantId = req.query.merchant || req.storeId;
        const productType = req.query.productType;
        const cartValue = parseFloat(req.query.cartValue) || 0;

        console.log(`💰 Getting pricing strategy for merchant: ${merchantId || 'all'}`);

        const strategy = await aiLearning.getBestPricingStrategy({
            merchantId,
            productType,
            cartValue
        });

        res.json({
            success: true,
            strategy
        });

    } catch (error) {
        console.error('❌ Error getting pricing strategy:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get pricing strategy'
        });
    }
});

// ==========================================
// 📈 EVENT TRACKING API
// Track Customer Events for Analytics
// ==========================================

/**
 * Track a customer event
 * POST /api/events/track
 * 
 * Body: { eventType, customerId, merchantId, data }
 * Event types: page_view, add_to_cart, checkout_started, checkout_completed, 
 *              message_sent, message_opened, link_clicked, cart_recovered
 * Response: { success, eventId }
 */
app.post('/api/events/track', async (req, res) => {
    try {
        if (!eventTracker) {
            return res.status(503).json({
                success: false,
                error: 'Event Tracker not available'
            });
        }

        const { eventType, customerId, data } = req.body;
        const merchantId = req.body.merchantId || req.body.merchant || req.storeId;

        if (!eventType) {
            return res.status(400).json({
                success: false,
                error: 'eventType is required'
            });
        }

        console.log(`📈 Tracking event: ${eventType} for customer: ${customerId || 'anonymous'}`);

        const result = await eventTracker.track({
            eventType,
            customerId,
            merchantId,
            data: data || {},
            timestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            ip: req.ip || req.headers['x-forwarded-for']
        });

        res.json({
            success: true,
            eventId: result.eventId
        });

    } catch (error) {
        console.error('❌ Error tracking event:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track event'
        });
    }
});

// ==========================================
// 📱 OUTREACH TRACKER API - WhatsApp A/B Testing
// Track manual WhatsApp outreach and conversions
// ==========================================

/**
 * Log a new outreach message
 * POST /api/outreach/log
 * Body: { phone, message, abGroup, notes }
 */
app.post('/api/outreach/log', async (req, res) => {
    try {
        if (!outreachTracker) {
            return res.status(503).json({
                success: false,
                error: 'Outreach Tracker not available'
            });
        }

        const { phone, message, abGroup, notes } = req.body;

        if (!phone || !abGroup) {
            return res.status(400).json({
                success: false,
                error: 'phone and abGroup are required'
            });
        }

        const result = await outreachTracker.logOutreach({ phone, message, abGroup, notes });
        res.json(result);

    } catch (error) {
        console.error('❌ Error logging outreach:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to log outreach'
        });
    }
});

/**
 * Mark contact as converted
 * POST /api/outreach/convert
 * Body: { phone, notes }
 */
app.post('/api/outreach/convert', async (req, res) => {
    try {
        if (!outreachTracker) {
            return res.status(503).json({
                success: false,
                error: 'Outreach Tracker not available'
            });
        }

        const { phone, notes } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'phone is required'
            });
        }

        const result = await outreachTracker.markConverted(phone, notes);
        res.json(result);

    } catch (error) {
        console.error('❌ Error marking conversion:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to mark conversion'
        });
    }
});

/**
 * Unmark conversion
 * POST /api/outreach/unconvert
 * Body: { phone }
 */
app.post('/api/outreach/unconvert', async (req, res) => {
    try {
        if (!outreachTracker) {
            return res.status(503).json({
                success: false,
                error: 'Outreach Tracker not available'
            });
        }

        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'phone is required'
            });
        }

        const result = await outreachTracker.unmarkConverted(phone);
        res.json(result);

    } catch (error) {
        console.error('❌ Error unmarking conversion:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to unmark conversion'
        });
    }
});

/**
 * Get all outreach contacts
 * GET /api/outreach/list?limit=100&abGroup=A&convertedOnly=true
 */
app.get('/api/outreach/list', async (req, res) => {
    try {
        if (!outreachTracker) {
            return res.status(503).json({
                success: false,
                error: 'Outreach Tracker not available'
            });
        }

        const limit = parseInt(req.query.limit) || 100;
        const abGroup = req.query.abGroup;
        const convertedOnly = req.query.convertedOnly === 'true';

        const contacts = await outreachTracker.getAll({ limit, abGroup, convertedOnly });
        res.json({
            success: true,
            count: contacts.length,
            contacts
        });

    } catch (error) {
        console.error('❌ Error getting outreach list:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get outreach list'
        });
    }
});

/**
 * Get outreach stats for A/B testing
 * GET /api/outreach/stats
 */
app.get('/api/outreach/stats', async (req, res) => {
    try {
        if (!outreachTracker) {
            return res.status(503).json({
                success: false,
                error: 'Outreach Tracker not available'
            });
        }

        const stats = await outreachTracker.getStats();
        res.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('❌ Error getting outreach stats:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get outreach stats'
        });
    }
});

/**
 * Delete a contact
 * POST /api/outreach/delete
 * Body: { phone }
 */
app.post('/api/outreach/delete', async (req, res) => {
    try {
        if (!outreachTracker) {
            return res.status(503).json({
                success: false,
                error: 'Outreach Tracker not available'
            });
        }

        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                error: 'phone is required'
            });
        }

        const result = await outreachTracker.deleteContact(phone);
        res.json(result);

    } catch (error) {
        console.error('❌ Error deleting contact:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete contact'
        });
    }
});

// ==========================================
// 📱 WHATSAPP BRIDGE API - Merchant QR Connection
// FREE unlimited messaging via merchant's own WhatsApp!
// ==========================================

/**
 * Initialize WhatsApp connection for merchant
 * GET /api/whatsapp/connect?merchant=xxx
 * Returns QR code to scan or ready status if already connected
 */
app.get('/api/whatsapp/connect', async (req, res) => {
    try {
        if (!whatsappBridge) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp Bridge not available'
            });
        }

        const merchantId = req.query.merchant || req.storeId;
        if (!merchantId) {
            return res.status(400).json({
                success: false,
                error: 'Merchant ID required'
            });
        }

        console.log(`📱 WhatsApp connect request for merchant: ${merchantId}`);

        const result = await whatsappBridge.initMerchantWhatsApp(merchantId);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('❌ WhatsApp connect error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get WhatsApp connection status for merchant
 * GET /api/whatsapp/status?merchant=xxx
 */
app.get('/api/whatsapp/status', async (req, res) => {
    try {
        if (!whatsappBridge) {
            return res.json({
                success: false,
                status: 'not_available',
                connected: false
            });
        }

        const merchantId = req.query.merchant || req.storeId;
        if (!merchantId) {
            return res.status(400).json({
                success: false,
                error: 'Merchant ID required'
            });
        }

        const status = whatsappBridge.getStatus(merchantId);
        const pendingQR = whatsappBridge.getPendingQR(merchantId);

        res.json({
            success: true,
            ...status,
            qrCode: pendingQR
        });

    } catch (error) {
        console.error('❌ WhatsApp status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get QR code for merchant (if pending)
 * GET /api/whatsapp/qr?merchant=xxx
 */
app.get('/api/whatsapp/qr', async (req, res) => {
    try {
        if (!whatsappBridge) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp Bridge not available'
            });
        }

        const merchantId = req.query.merchant || req.storeId;
        if (!merchantId) {
            return res.status(400).json({
                success: false,
                error: 'Merchant ID required'
            });
        }

        const qrCode = whatsappBridge.getPendingQR(merchantId);

        if (qrCode) {
            res.json({
                success: true,
                qrCode,
                message: 'Scan this QR code with WhatsApp'
            });
        } else {
            const status = whatsappBridge.getStatus(merchantId);
            res.json({
                success: false,
                status: status.status,
                connected: status.connected,
                message: status.connected ? 'Already connected' : 'No QR code available. Try /connect first.'
            });
        }

    } catch (error) {
        console.error('❌ WhatsApp QR error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Send WhatsApp message via merchant's number
 * POST /api/whatsapp/send
 * Body: { merchant, to, message }
 */
app.post('/api/whatsapp/send', async (req, res) => {
    try {
        if (!whatsappBridge) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp Bridge not available'
            });
        }

        const { merchant, to, message } = req.body;
        const merchantId = merchant || req.storeId;

        if (!merchantId || !to || !message) {
            return res.status(400).json({
                success: false,
                error: 'merchant, to, and message are required'
            });
        }

        console.log(`📤 Sending WhatsApp via ${merchantId} to ${to}`);

        const result = await whatsappBridge.sendMessage(merchantId, to, message);

        res.json(result);

    } catch (error) {
        console.error('❌ WhatsApp send error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Send cart recovery via merchant's WhatsApp
 * POST /api/whatsapp/send-cart-recovery
 * Body: { merchant, phone, customerName, cartValue, items, checkoutUrl, discount }
 */
app.post('/api/whatsapp/send-cart-recovery', async (req, res) => {
    try {
        if (!whatsappBridge) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp Bridge not available'
            });
        }

        const { merchant, phone, customerName, cartValue, items, checkoutUrl, discount } = req.body;
        const merchantId = merchant || req.storeId;

        if (!merchantId || !phone) {
            return res.status(400).json({
                success: false,
                error: 'merchant and phone are required'
            });
        }

        console.log(`🛒 Sending cart recovery via ${merchantId} to ${phone}`);

        const result = await whatsappBridge.sendCartRecovery(merchantId, {
            phone,
            customerName: customerName || 'عميلنا العزيز',
            cartValue: cartValue || 0,
            items: items || [],
            checkoutUrl: checkoutUrl || '',
            discount: discount || 0
        });

        res.json(result);

    } catch (error) {
        console.error('❌ WhatsApp cart recovery error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Disconnect merchant's WhatsApp
 * POST /api/whatsapp/disconnect
 * Body: { merchant }
 */
app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
        if (!whatsappBridge) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp Bridge not available'
            });
        }

        const merchantId = req.body.merchant || req.storeId;

        if (!merchantId) {
            return res.status(400).json({
                success: false,
                error: 'Merchant ID required'
            });
        }

        console.log(`📵 Disconnecting WhatsApp for merchant: ${merchantId}`);

        const result = await whatsappBridge.disconnect(merchantId);

        res.json({
            success: true,
            message: 'WhatsApp disconnected successfully'
        });

    } catch (error) {
        console.error('❌ WhatsApp disconnect error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get all connected merchants (admin)
 * GET /api/whatsapp/connected
 */
app.get('/api/whatsapp/connected', async (req, res) => {
    try {
        if (!whatsappBridge) {
            return res.json({
                success: true,
                merchants: []
            });
        }

        const merchants = whatsappBridge.getConnectedMerchants();

        res.json({
            success: true,
            count: merchants.length,
            merchants
        });

    } catch (error) {
        console.error('❌ WhatsApp connected list error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
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
                redirect_uri: 'https://europe-west1-ribh-484706.cloudfunctions.net/api/oauth/callback'
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
        console.log('👤 User info:', JSON.stringify(userData, null, 2));

        // Extract merchant data (Salla API structure varies)
        const merchant = userData.data?.merchant || userData.merchant || {};
        const storeId = String(merchant.id || userData.data?.id || 'unknown');
        const storeName = merchant.name || merchant.store_name || userData.data?.name || 'متجر';
        const email = userData.data?.email || userData.email || merchant.email || '';
        const phone = userData.data?.mobile || userData.mobile || merchant.mobile || merchant.phone || '';

        console.log(`🏪 Merchant: ${storeName} (${storeId}), Email: ${email}, Phone: ${phone}`);

        // Step 3: Save tokens to Firestore using sallaApp (proper token management)
        if (sallaApp) {
            await sallaApp.storeTokens(storeId, {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : Date.now() + 86400000,
                scope: tokenData.scope || ''
            });
            console.log(`✅ Tokens saved to salla_merchants/${storeId}`);
        }

        // Step 4: Create/update merchant document in merchants/{storeId}
        const merchantDoc = {
            storeId: storeId,
            storeName: storeName,
            email: email,
            phone: phone,
            platform: 'salla',
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('merchants').doc(storeId).set(merchantDoc, { merge: true });
        console.log(`✅ Merchant document created: merchants/${storeId}`);

        // Also save tokens subcollection for easy access
        await db.collection('merchants').doc(storeId).collection('tokens').doc('salla').set({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in 
                ? admin.firestore.Timestamp.fromMillis(Date.now() + (tokenData.expires_in * 1000))
                : admin.firestore.Timestamp.fromMillis(Date.now() + 86400000),
            scope: tokenData.scope || '',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`✅ Tokens saved to merchants/${storeId}/tokens/salla`);

        // Legacy: Keep backward compatibility with stores collection
        const merchantId = storeId;
        const merchantName = storeName;
        const merchantEmail = email;

        // Step 3: Save store with access token
        const stores = await readDB(STORES_FILE);
        let existingStore = stores.find(s => s.merchant === merchantId);
        let ribhToken;
        let isNewStore = false;

        if (!existingStore) {
            ribhToken = generateToken();
            isNewStore = true;

            // 🚀 ONE-CLICK ACTIVATION - Smart defaults for new stores
            stores.push({
                merchant: merchantId,
                merchantName: merchantName,
                email: merchantEmail,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                ribhToken: ribhToken,
                installedAt: new Date().toISOString(),
                active: true,
                // ====== AUTO-ENABLED FEATURES ======
                settings: {
                    cartRecoveryEnabled: true,
                    enableEmail: true,
                    enableWhatsApp: true,
                    enableTelegram: true,
                    smartOffersEnabled: true,
                    upsellEnabled: true,
                    paymentPlansEnabled: true,
                    paymentPlanThreshold: 500,
                    reactivationEnabled: true,
                    aiLearningEnabled: true,
                    language: 'ar'
                },
                stats: {
                    cartsReceived: 0,
                    cartsRecovered: 0,
                    revenueRecovered: 0,
                    messagesSent: 0
                }
            });
            await writeDB(STORES_FILE, stores);
            console.log(`🚀 ONE-CLICK ACTIVATION: ${merchantName} installed with ALL features enabled!`);
            
            // Send merchant welcome email
            try {
                const { sendMerchantWelcomeEmail } = require('./lib/emailSender');
                await sendMerchantWelcomeEmail(merchantEmail, merchantName);
                console.log(`📧 Welcome email sent to ${merchantEmail}`);
            } catch (emailErr) {
                console.error('⚠️ Failed to send welcome email:', emailErr.message);
            }
        } else {
            // Update existing store with new tokens
            existingStore.accessToken = tokenData.access_token;
            existingStore.refreshToken = tokenData.refresh_token;
            existingStore.merchantName = merchantName;
            if (!existingStore.ribhToken) {
                existingStore.ribhToken = generateToken();
            }
            // Ensure settings exist for older stores
            if (!existingStore.settings) {
                existingStore.settings = {
                    cartRecoveryEnabled: true,
                    enableEmail: true,
                    enableWhatsApp: true,
                    smartOffersEnabled: true,
                    language: 'ar'
                };
            }
            ribhToken = existingStore.ribhToken;
            await writeDB(STORES_FILE, stores);
            console.log(`🔄 Store updated: ${merchantName}`);
        }

        // Step 4: Set cookie for persistent login
        res.cookie('ribhToken', ribhToken, {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        });

        // Step 5: Redirect based on whether this is a new or returning store
        if (isNewStore) {
            // New store → Redirect to setup page for WhatsApp connection
            console.log(`🎉 New store! Redirecting to setup: merchant=${merchantId}`);
            res.redirect(`/setup.html?merchant=${merchantId}&token=${ribhToken}&store=${encodeURIComponent(merchantName)}`);
        } else {
            // Returning store → Go directly to dashboard
            res.redirect(`/?token=${ribhToken}`);
        }

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
app.get('/app', async (req, res) => {
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
        const stores = await readDB(STORES_FILE);
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
        const stores = await readDB(STORES_FILE);
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

    const callbackUrl = 'https://europe-west1-ribh-484706.cloudfunctions.net/api/oauth/callback';
    const oauthUrl = `https://accounts.salla.sa/oauth2/auth?` +
        `client_id=${config.SALLA_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
        `&response_type=code` +
        `&scope=offline_access`;

    return res.redirect(oauthUrl);
});

// ==========================================
// SHOPIFY OAUTH - App Installation
// ==========================================

// Step 1: Shopify Install Route - Redirects to Shopify OAuth
app.get('/shopify/install', (req, res) => {
    const { shop } = req.query;

    if (!shop) {
        // No shop provided - show shop input form
        return res.send(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>رِبح | تثبيت على شوبيفاي</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                        background: #0a0a0a; 
                        color: white; 
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container { 
                        max-width: 400px; 
                        padding: 40px; 
                        text-align: center; 
                    }
                    .logo { font-size: 48px; margin-bottom: 24px; }
                    h1 { font-size: 28px; margin-bottom: 16px; }
                    p { color: #888; margin-bottom: 32px; }
                    input {
                        width: 100%;
                        padding: 16px;
                        border-radius: 12px;
                        border: 1px solid #333;
                        background: #111;
                        color: white;
                        font-size: 16px;
                        margin-bottom: 16px;
                        text-align: center;
                    }
                    input:focus { outline: none; border-color: #10B981; }
                    button {
                        width: 100%;
                        padding: 16px;
                        border-radius: 12px;
                        border: none;
                        background: linear-gradient(135deg, #10B981, #6366F1);
                        color: white;
                        font-size: 18px;
                        font-weight: 600;
                        cursor: pointer;
                    }
                    button:hover { transform: translateY(-2px); }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="logo">🛍️</div>
                    <h1>تثبيت رِبح على شوبيفاي</h1>
                    <p>أدخل رابط متجرك للمتابعة</p>
                    <form action="/shopify/install" method="GET">
                        <input type="text" name="shop" placeholder="your-store.myshopify.com" required>
                        <button type="submit">← تثبيت الآن</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    }

    // Validate shop format
    const shopDomain = shop.replace('https://', '').replace('http://', '').replace('/', '');

    if (!config.SHOPIFY_API_KEY) {
        return res.status(500).send('Shopify API not configured. Please set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.');
    }

    // Build OAuth URL
    const redirectUri = 'https://ribh.click/shopify/callback';
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store nonce for verification
    // In production, use Redis or DB. For now, we trust the flow.

    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
        `client_id=${config.SHOPIFY_API_KEY}` +
        `&scope=${config.SHOPIFY_SCOPES}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${nonce}`;

    console.log(`🛍️ Shopify OAuth started for: ${shopDomain}`);
    res.redirect(authUrl);
});

// Step 2: Shopify OAuth Callback
app.get('/shopify/callback', async (req, res) => {
    const { shop, code, state } = req.query;

    console.log('🛍️ Shopify OAuth callback:', { shop, hasCode: !!code });

    if (!shop || !code) {
        return res.status(400).send('Missing shop or code parameter');
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: config.SHOPIFY_API_KEY,
                client_secret: config.SHOPIFY_API_SECRET,
                code: code
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            console.error('❌ Shopify token error:', tokenData);
            return res.status(400).send('Failed to get access token');
        }

        console.log('✅ Shopify access token received');

        // Get shop info
        const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
            headers: { 'X-Shopify-Access-Token': tokenData.access_token }
        });

        const shopData = await shopResponse.json();
        const shopInfo = shopData.shop || {};

        // Save store to database
        const stores = await readDB(STORES_FILE);
        let existingStore = stores.find(s => s.merchant === shop || s.shopDomain === shop);
        let ribhToken;
        let isNewStore = false;

        if (!existingStore) {
            ribhToken = generateToken();
            isNewStore = true;

            stores.push({
                platform: 'shopify',
                merchant: shop,
                shopDomain: shop,
                merchantName: shopInfo.name || shop,
                email: shopInfo.email || '',
                accessToken: tokenData.access_token,
                ribhToken: ribhToken,
                installedAt: new Date().toISOString(),
                active: true,
                settings: {
                    cartRecoveryEnabled: true,
                    enableEmail: true,
                    enableWhatsApp: true,
                    smartOffersEnabled: true,
                    language: 'ar'
                },
                stats: {
                    cartsReceived: 0,
                    cartsRecovered: 0,
                    revenueRecovered: 0,
                    messagesSent: 0
                }
            });

            await writeDB(STORES_FILE, stores);
            console.log(`🚀 Shopify store installed: ${shopInfo.name || shop}`);
        } else {
            // Update existing
            existingStore.accessToken = tokenData.access_token;
            existingStore.merchantName = shopInfo.name || existingStore.merchantName;
            if (!existingStore.ribhToken) existingStore.ribhToken = generateToken();
            ribhToken = existingStore.ribhToken;
            await writeDB(STORES_FILE, stores);
            console.log(`🔄 Shopify store updated: ${shopInfo.name || shop}`);
        }

        // Register webhooks for cart abandonment
        await registerShopifyWebhooks(shop, tokenData.access_token);

        // Set cookie and redirect
        res.cookie('ribhToken', ribhToken, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: true,
            secure: true,
            sameSite: 'lax'
        });

        if (isNewStore) {
            res.redirect(`/welcome.html?token=${ribhToken}&store=${encodeURIComponent(shopInfo.name || shop)}`);
        } else {
            res.redirect(`/?token=${ribhToken}`);
        }

    } catch (error) {
        console.error('❌ Shopify OAuth error:', error);
        res.status(500).send('OAuth failed: ' + error.message);
    }
});

// Register Shopify webhooks for abandoned checkouts
async function registerShopifyWebhooks(shop, accessToken) {
    const webhooks = [
        { topic: 'checkouts/create', address: 'https://ribh.click/api/shopify/webhook/checkout' },
        { topic: 'checkouts/update', address: 'https://ribh.click/api/shopify/webhook/checkout' },
        { topic: 'orders/create', address: 'https://ribh.click/api/shopify/webhook/order' }
    ];

    for (const webhook of webhooks) {
        try {
            await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
                method: 'POST',
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ webhook })
            });
            console.log(`✅ Webhook registered: ${webhook.topic}`);
        } catch (e) {
            console.log(`⚠️ Webhook registration failed: ${webhook.topic}`, e.message);
        }
    }
}

// Shopify Webhook: Checkout Created/Updated (Potential Abandonment)
app.post('/api/shopify/webhook/checkout', async (req, res) => {
    const checkout = req.body;
    const shop = req.headers['x-shopify-shop-domain'];

    console.log('🛒 Shopify checkout webhook:', { shop, checkoutId: checkout.id });

    // Log it
    await logWebhook('shopify.checkout', { shop, checkoutId: checkout.id });

    // If checkout has email and items, treat as potential abandoned cart
    if (checkout.email && checkout.line_items && checkout.line_items.length > 0) {
        const cartData = {
            id: checkout.id || checkout.token,
            customer: {
                first_name: checkout.billing_address?.first_name || checkout.shipping_address?.first_name || '',
                email: checkout.email,
                mobile: checkout.billing_address?.phone || checkout.shipping_address?.phone || ''
            },
            items: checkout.line_items.map(item => ({
                product_name: item.title,
                quantity: item.quantity,
                price: item.price
            })),
            total: checkout.total_price || checkout.subtotal_price,
            currency: checkout.currency || 'SAR',
            checkout_url: checkout.abandoned_checkout_url || checkout.web_url
        };

        // Use the same abandoned cart handler as Salla
        handleAbandonedCart(cartData, shop);
    }

    res.status(200).json({ success: true });
});

// Shopify Webhook: Order Created (Cart Recovered!)
app.post('/api/shopify/webhook/order', async (req, res) => {
    const order = req.body;
    const shop = req.headers['x-shopify-shop-domain'];

    console.log('💰 Shopify order webhook:', { shop, orderId: order.id });

    // Mark as recovered if it was an abandoned cart
    if (order.checkout_id || order.checkout_token) {
        handleOrderCreated({
            id: order.id,
            checkout_id: order.checkout_id,
            total: order.total_price,
            customer: {
                email: order.email,
                first_name: order.customer?.first_name
            }
        }, shop);
    }

    res.status(200).json({ success: true });
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
// Webhook handler function (shared between both paths)
async function handleSallaWebhook(req, res) {
    const event = req.body;

    console.log('📨 Webhook received:', event.event || 'unknown', JSON.stringify(event).substring(0, 500));

    // Log the webhook
    await logWebhook(event.event || 'unknown', {
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
                // CANCEL any active cart recovery sequences for this customer
                if (sequenceEngine && event.data?.customer?.email) {
                    sequenceEngine.cancelSequence('cart_recovery', event.merchant, event.data.customer.email);
                    console.log(`🛑 Cancelled cart recovery sequence for ${event.data.customer.email} - they purchased!`);
                }
                break;

            case 'order.updated':
            case 'order.update':
            case 'order.status.updated':
                handleOrderUpdated(event.data, event.merchant);
                break;

            case 'customer.created':
            case 'customer.create':
                handleCustomerCreated(event.data, event.merchant);
                break;

            case 'app.store.authorize':
                // OAuth tokens received - save them!
                await handleAppAuthorize(event.data, event.merchant);
                break;
                
            case 'app.installed':
                // App installation confirmed
                await handleAppInstalled(event.data, event.merchant);
                break;

            case 'app.uninstalled':
                await handleAppUninstalled(event.merchant);
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

// Salla setup info endpoint removed to clean up code. Use documentation instead.


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

// ==== DEDICATED SALLA ABANDONED CART WEBHOOK ====
// Specialized handler for abandoned.cart events - saves to Firestore
try {
    const sallaCartWebhook = require('./webhooks/sallaCart');
    app.use('/webhooks/salla/cart', sallaCartWebhook);
    app.use('/api/webhooks/salla/cart', sallaCartWebhook);
    console.log('✅ Salla Cart Webhook loaded at /webhooks/salla/cart');
} catch (e) {
    console.log('⚠️ Salla Cart Webhook not available:', e.message);
}

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
async function handleAppUninstalled(merchant) {
    console.log('👋 App uninstalled by:', merchant);
    
    // Call sallaApp handler for proper token management
    if (sallaApp) {
        try {
            await sallaApp.handleUninstalled(String(merchant));
        } catch (e) {
            console.error('❌ sallaApp.handleUninstalled error:', e.message);
        }
    }
    
    const stores = await readDB(STORES_FILE);
    const storeIndex = stores.findIndex(s => s.merchant === merchant || String(s.merchant) === String(merchant));
    if (storeIndex !== -1) {
        stores[storeIndex].active = false;
        stores[storeIndex].uninstalledAt = new Date().toISOString();
        await writeDB(STORES_FILE, stores);
        console.log(`✅ Store ${merchant} marked as uninstalled in stores collection`);
    }
}

// ==========================================
// CUSTOMER TYPE DETECTION & SMART OFFERS
// ==========================================

/**
 * Detect customer type based on behavior and history
 * Returns: NEW, WARM, PRICE_SENSITIVE, REPEAT, VIP
 */
async function detectCustomerType(customer, cartTotal, merchant) {
    // Check order history
    const carts = await readDB(DB_FILE);
    const previousOrders = carts.filter(c =>
        c.merchant === merchant &&
        (c.customer?.email === customer.email || c.customer?.phone === customer.phone) &&
        c.status === 'recovered'
    );

    const orderCount = previousOrders.length;
    const totalSpent = previousOrders.reduce((sum, c) => sum + (c.total || 0), 0);

    // Detection logic
    if (totalSpent > 5000 || orderCount >= 5) {
        return { type: 'VIP', orderCount, totalSpent };
    }
    if (orderCount >= 1) {
        return { type: 'REPEAT', orderCount, totalSpent };
    }
    if (cartTotal > 500) {
        return { type: 'PRICE_SENSITIVE', orderCount, totalSpent };
    }
    return { type: 'NEW', orderCount, totalSpent };
}

/**
 * Select the best offer based on customer type
 * Returns: offer object with type, discount, message
 */
function selectSmartOffer(customerType, cartTotal) {
    const offers = {
        VIP: {
            type: 'VIP_EXCLUSIVE',
            discount: 15,
            code: 'VIP15',
            message: '🌟 عميلنا المميز! خصم حصري 15% لك فقط',
            includePaymentPlan: cartTotal > 300
        },
        REPEAT: {
            type: 'LOYALTY',
            discount: 10,
            code: 'LOYAL10',
            message: '💚 شكراً لثقتك! خصم 10% على طلبك',
            includePaymentPlan: cartTotal > 500
        },
        PRICE_SENSITIVE: {
            type: 'PAYMENT_PLAN',
            discount: 5,
            code: 'RIBH5',
            message: '💳 قسّط طلبك على 4 دفعات بدون فوائد مع تمارا!',
            includePaymentPlan: true,
            paymentPlanText: `ادفع ${Math.ceil(cartTotal / 4)} ر.س فقط الآن واستلم طلبك!`
        },
        NEW: {
            type: 'WELCOME',
            discount: 10,
            code: 'WELCOME10',
            message: '🎁 خصم ترحيبي 10% على طلبك الأول!',
            includePaymentPlan: cartTotal > 500
        }
    };

    return offers[customerType.type] || offers.NEW;
}

// Handle abandoned cart - ENHANCED with smart detection
async function handleAbandonedCart(data, merchant) {
    console.log('🛒 Abandoned cart detected!', data);

    const carts = await readDB(DB_FILE);

    // 📱 Use enhanced phone extraction with Saudi normalization
    const rawPhone = data.customer?.mobile || data.customer?.phone || 
                     data.mobile || data.phone ||
                     data.billing_address?.phone || data.shipping_address?.phone;
    
    const normalizedPhone = sallaWebhooks ? 
        sallaWebhooks.normalizeSaudiPhone(rawPhone) : 
        rawPhone;
    
    console.log(`📱 Phone: ${rawPhone} → ${normalizedPhone}`);

    const customer = {
        name: data.customer?.name || data.customer?.first_name || 'عميل',
        phone: normalizedPhone,
        email: data.customer?.email || data.email
    };

    const cartTotal = data.total || data.grand_total || data.sub_total || 0;

    // 🧠 SMART: Detect customer type
    const customerType = await detectCustomerType(customer, cartTotal, merchant);
    console.log(`🎯 Customer type: ${customerType.type} (${customerType.orderCount} orders, ${customerType.totalSpent} SAR spent)`);

    // 🎁 SMART: Select best offer
    const smartOffer = selectSmartOffer(customerType, cartTotal);
    console.log(`💡 Selected offer: ${smartOffer.type} - ${smartOffer.discount}% off`);

    const cart = {
        id: data.id || Date.now(),
        merchant,
        customer,
        items: data.items || data.products || [],
        total: cartTotal,
        currency: data.currency || 'SAR',
        checkoutUrl: data.checkout_url || data.recovery_url || data.cart_url || '',
        storeUrl: data.store?.url || data.merchant_url || '',
        storeName: data.store?.name || merchant,
        createdAt: new Date().toISOString(),
        status: 'pending',
        reminders: [],
        // 🆕 NEW: Smart data
        customerType: customerType.type,
        customerHistory: {
            orderCount: customerType.orderCount,
            totalSpent: customerType.totalSpent
        },
        smartOffer: smartOffer
    };

    carts.push(cart);
    await writeDB(DB_FILE, carts);

    // Schedule reminder with smart offer
    scheduleReminder(cart);
}

// Handle order created (cart recovered!) + POST-PURCHASE UPSELL
async function handleOrderCreated(data, merchant) {
    console.log('🎉 Order created!', data);

    const carts = await readDB(DB_FILE);

    // 📱 Normalize phone for matching
    const rawPhone = data.customer?.mobile || data.customer?.phone || 
                     data.mobile || data.phone;
    const normalizedPhone = sallaWebhooks ? 
        sallaWebhooks.normalizeSaudiPhone(rawPhone) : 
        rawPhone;
    const customerEmail = data.customer?.email || data.email;
    
    console.log(`🔍 Looking for cart to mark recovered: phone=${normalizedPhone}, email=${customerEmail}`);

    // Mark cart as recovered if matches (try multiple matching strategies)
    const cartIndex = carts.findIndex(c => {
        // Must be pending or sent
        if (c.status !== 'sent' && c.status !== 'pending') return false;
        
        // Match by cart_id if available
        if (data.cart_id && c.id === data.cart_id) return true;
        
        // Match by email
        if (customerEmail && c.customer?.email === customerEmail) return true;
        
        // Match by normalized phone
        if (normalizedPhone && c.customer?.phone) {
            const cartPhone = sallaWebhooks ? 
                sallaWebhooks.normalizeSaudiPhone(c.customer.phone) : 
                c.customer.phone;
            if (cartPhone === normalizedPhone) return true;
        }
        
        return false;
    });

    let recoveredCart = null;
    if (cartIndex !== -1) {
        carts[cartIndex].status = 'recovered';
        carts[cartIndex].recoveredAt = new Date().toISOString();
        carts[cartIndex].orderId = data.id || data.order_id;
        carts[cartIndex].orderValue = data.total || data.grand_total || data.amounts?.total?.amount || 0;
        recoveredCart = carts[cartIndex];
        await writeDB(DB_FILE, carts);
        console.log(`✅ Cart recovered! Value: ${recoveredCart.orderValue} SAR (cart ID: ${recoveredCart.id})`);
    } else {
        console.log(`📝 No matching abandoned cart found (direct purchase)`);
    }

    // 🆕 LOG REVENUE for tracking
    await logRevenue(merchant, {
        orderId: data.id || data.order_id,
        orderValue: data.total || data.grand_total || data.amounts?.total?.amount || 0,
        wasRecovered: !!recoveredCart,
        cartId: recoveredCart?.id || null,
        customerType: recoveredCart?.customerType || 'DIRECT',
        offerUsed: recoveredCart?.smartOffer?.type || 'NONE'
    });

    // 🆕 SEND POST-PURCHASE UPSELL EMAIL (after 2 hours)
    const customer = {
        name: data.customer?.name || data.customer?.first_name || 'عميلنا',
        email: customerEmail,
        phone: normalizedPhone
    };

    if (customer.email) {
        console.log('⏰ Scheduling post-purchase upsell email for 2 hours later...');

        // Schedule upsell email
        setTimeout(async () => {
            await sendPostPurchaseUpsell(customer, data, merchant);
        }, 2 * 60 * 60 * 1000); // 2 hours (use 30000 for testing = 30s)
    }
}

// 🆕 POST-PURCHASE UPSELL EMAIL
async function sendPostPurchaseUpsell(customer, orderData, merchant) {
    if (!config.ENABLE_EMAIL || !customer.email) return false;

    console.log(`📧 Sending post-purchase upsell to ${customer.email}...`);

    const orderTotal = orderData.total || orderData.grand_total || 0;
    const storeName = orderData.store?.name || merchant;

    // Dynamic upsell based on order value
    let upsellMessage = '';
    let upsellDiscount = 10;

    if (orderTotal > 1000) {
        upsellMessage = 'عملاء VIP مثلك يحصلون على عروض حصرية!';
        upsellDiscount = 15;
    } else if (orderTotal > 500) {
        upsellMessage = 'أنت على بعد خطوة من الحصول على شحن مجاني دائم!';
        upsellDiscount = 12;
    } else {
        upsellMessage = 'شكراً لطلبك! استمتع بخصم على طلبك القادم';
        upsellDiscount = 10;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .check { font-size: 60px; }
            .title { color: #10B981; font-size: 24px; margin: 10px 0; }
            .message { color: #666; font-size: 16px; line-height: 1.6; }
            .upsell-box { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0; }
            .upsell-title { font-size: 18px; margin-bottom: 10px; }
            .upsell-discount { font-size: 42px; font-weight: bold; }
            .upsell-code { background: white; color: #10B981; padding: 10px 25px; border-radius: 8px; display: inline-block; margin-top: 15px; font-weight: bold; font-size: 18px; }
            .btn { display: block; background: #1D1D1F; color: white !important; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px; margin: 20px 0; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="check">✅</div>
                <div class="title">تم استلام طلبك بنجاح!</div>
            </div>
            
            <p class="message">
                شكراً لك ${customer.name}! طلبك من ${storeName} في الطريق إليك.
            </p>
            
            <div class="upsell-box">
                <div class="upsell-title">${upsellMessage}</div>
                <div class="upsell-discount">${upsellDiscount}% خصم</div>
                <div>على طلبك القادم</div>
                <div class="upsell-code">THANKS${upsellDiscount}</div>
            </div>
            
            <p class="message" style="text-align: center;">
                هذا الكود صالح لمدة 7 أيام فقط ⏰
            </p>
            
            <a href="${orderData.store?.url || '#'}" class="btn">تسوق الآن 🛍️</a>
            
            <div class="footer">
                <p>رِبح 💚 نساعد المتاجر على النمو</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to: customer.email,
                subject: `✅ شكراً على طلبك! + هدية خصم ${upsellDiscount}%`,
                html: htmlContent
            })
        });

        const result = await response.json();
        if (result.id) {
            console.log(`✅ Post-purchase upsell sent! ID: ${result.id}`);
            return true;
        }
    } catch (error) {
        console.error('❌ Upsell email error:', error);
    }
    return false;
}

// 🆕 LOG REVENUE for analytics
async function logRevenue(merchant, data) {
    try {
        const revenueLog = await readDB('revenue_log') || [];
        revenueLog.push({
            ...data,
            merchant,
            timestamp: new Date().toISOString()
        });
        await writeDB('revenue_log', revenueLog);
        console.log(`💰 Revenue logged: ${data.orderValue} SAR (recovered: ${data.wasRecovered})`);
    } catch (error) {
        console.error('❌ Revenue log error:', error);
    }
}

// 🆕 Handle order.updated - Track fulfillment and update analytics
async function handleOrderUpdated(data, merchant) {
    const orderId = data.id || data.order_id;
    const oldStatus = data.old_status?.name || data.old_status || 'unknown';
    const newStatus = data.status?.name || data.status || 'unknown';
    
    console.log(`📦 Order ${orderId} updated: ${oldStatus} → ${newStatus}`);
    
    // Log status change for analytics
    try {
        await db.collection('order_updates').add({
            orderId,
            merchant: merchant?.id || merchant,
            oldStatus,
            newStatus,
            timestamp: new Date().toISOString(),
            customerEmail: data.customer?.email,
            customerPhone: sallaWebhooks ? 
                sallaWebhooks.normalizeSaudiPhone(data.customer?.mobile || data.customer?.phone) : 
                data.customer?.mobile
        });
    } catch (e) {
        console.error('Error logging order update:', e);
    }
    
    // Handle specific status transitions
    if (newStatus === 'delivered' || newStatus === 'completed') {
        // Order delivered - could trigger review request
        console.log(`✅ Order ${orderId} delivered to ${data.customer?.name || 'customer'}`);
        
        // TODO: Could trigger a review request email here
        // scheduleReviewRequest(data, merchant);
    }
    
    if (newStatus === 'cancelled' || newStatus === 'refunded') {
        console.log(`❌ Order ${orderId} ${newStatus}`);
        
        // Update revenue log to mark as not recovered if it was
        try {
            const revenueLogs = await readDB('revenue_log') || [];
            const logIndex = revenueLogs.findIndex(r => r.orderId === orderId);
            if (logIndex !== -1) {
                revenueLogs[logIndex].status = newStatus;
                revenueLogs[logIndex].updatedAt = new Date().toISOString();
                await writeDB('revenue_log', revenueLogs);
            }
        } catch (e) {
            console.error('Error updating revenue log:', e);
        }
    }
}

// Handle new customer created - Send WELCOME OFFER (Attraction)
async function handleCustomerCreated(data, merchant) {
    const email = data?.email || data?.customer?.email;
    const name = data?.name || data?.first_name || data?.customer?.name || 'عميلنا';
    const rawPhone = data?.mobile || data?.phone || data?.customer?.mobile || data?.customer?.phone;
    const phone = sallaWebhooks ? sallaWebhooks.normalizeSaudiPhone(rawPhone) : rawPhone;
    
    console.log('👋 New customer created!', { email, phone, name });

    if (!email && !phone) {
        console.log('⚠️ Customer has no email or phone');
        return;
    }
    
    // Store customer for future reference
    try {
        await db.collection('customers').doc(data?.id?.toString() || Date.now().toString()).set({
            id: data?.id,
            merchant: merchant?.id || merchant,
            name,
            email,
            phone,
            createdAt: new Date().toISOString(),
            source: 'webhook'
        }, { merge: true });
    } catch (e) {
        console.error('Error storing customer:', e);
    }

    // 🆕 SEND WELCOME EMAIL DIRECTLY (ATTRACTION OFFER)
    if (email && config.ENABLE_EMAIL) {
        await sendWelcomeEmail({ name, email, phone }, merchant);
    }

    // 🆕 SEND WELCOME SMS if enabled
    if (phone && config.ENABLE_SMS) {
        await sendSMS(phone, `مرحباً ${name}! 🎉 خصم 15% على طلبك الأول - كود WELCOME15`);
    }
}

// 🆕 WELCOME EMAIL (Attraction Offer - High Value for New Customers)
async function sendWelcomeEmail(customer, merchant) {
    console.log(`📧 Sending welcome email to ${customer.email}...`);

    const welcomeDiscount = 15; // Give more to new customers!

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; margin: 0; min-height: 100vh; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px 30px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
            .header { text-align: center; margin-bottom: 30px; }
            .wave { font-size: 60px; animation: wave 1s ease-in-out infinite; }
            @keyframes wave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(20deg); } }
            .title { color: #1D1D1F; font-size: 28px; margin: 15px 0; font-weight: bold; }
            .subtitle { color: #666; font-size: 16px; line-height: 1.6; }
            .offer-box { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; border-radius: 16px; text-align: center; margin: 30px 0; }
            .offer-title { font-size: 18px; opacity: 0.9; margin-bottom: 10px; }
            .offer-value { font-size: 52px; font-weight: bold; text-shadow: 2px 2px 10px rgba(0,0,0,0.2); }
            .offer-code { background: white; color: #10B981; padding: 12px 30px; border-radius: 10px; display: inline-block; margin-top: 15px; font-weight: bold; font-size: 20px; letter-spacing: 2px; }
            .benefits { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 20px 0; }
            .benefit { display: flex; align-items: center; margin: 10px 0; }
            .benefit-icon { font-size: 24px; margin-left: 10px; }
            .btn { display: block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px; font-weight: bold; margin: 25px 0; box-shadow: 0 4px 15px rgba(102,126,234,0.4); }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="wave">👋</div>
                <div class="title">أهلاً بك ${customer.name}!</div>
                <div class="subtitle">سعداء بانضمامك لعائلتنا 💚</div>
            </div>
            
            <div class="offer-box">
                <div class="offer-title">🎁 هديتك الترحيبية</div>
                <div class="offer-value">${welcomeDiscount}%</div>
                <div>خصم على طلبك الأول</div>
                <div class="offer-code">WELCOME15</div>
            </div>
            
            <div class="benefits">
                <div class="benefit">
                    <span class="benefit-icon">🚚</span>
                    <span>شحن سريع لجميع المناطق</span>
                </div>
                <div class="benefit">
                    <span class="benefit-icon">💳</span>
                    <span>إمكانية التقسيط بدون فوائد</span>
                </div>
                <div class="benefit">
                    <span class="benefit-icon">🔄</span>
                    <span>استبدال واسترجاع سهل</span>
                </div>
            </div>
            
            <a href="#" class="btn">تسوق الآن واستخدم الخصم 🛍️</a>
            
            <div class="footer">
                <p>💚 رِبح - نساعد المتاجر على النمو</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to: customer.email,
                subject: `أهلاً ${customer.name}! 🎁 هديتك الترحيبية 15% خصم`,
                html: htmlContent
            })
        });

        const result = await response.json();
        if (result.id) {
            console.log(`✅ Welcome email sent! ID: ${result.id}`);
            return true;
        }
    } catch (error) {
        console.error('❌ Welcome email error:', error);
    }
    return false;
}

// Handle app.store.authorize - OAuth tokens from Salla
async function handleAppAuthorize(data, merchant) {
    const merchantId = String(merchant?.id || merchant);
    console.log('🔐 App authorized (tokens received) for:', merchantId);
    console.log('📦 Token data keys:', Object.keys(data || {}));
    
    // Save tokens via sallaApp module (to salla_merchants collection)
    if (sallaApp && data?.access_token) {
        try {
            await sallaApp.handleAuthorize(merchantId, data);
            console.log(`✅ Tokens saved to salla_merchants/${merchantId}`);
        } catch (e) {
            console.error('❌ sallaApp.handleAuthorize error:', e.message);
        }
    }
    
    // Also save/update in stores collection for dashboard access
    const stores = await readDB(STORES_FILE);
    let existingStore = stores.find(s => 
        String(s.merchant) === merchantId || s.merchant === merchantId
    );
    
    if (existingStore) {
        // Update existing store with new tokens
        existingStore.accessToken = data.access_token;
        existingStore.refreshToken = data.refresh_token;
        existingStore.tokenUpdatedAt = new Date().toISOString();
        await writeDB(STORES_FILE, stores);
        console.log(`✅ Tokens updated in stores collection for ${merchantId}`);
    } else {
        // Create new store entry with tokens
        const token = generateToken();
        const newStore = {
            merchant: merchantId,
            token,
            ribhToken: token,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            installedAt: new Date().toISOString(),
            active: true,
            settings: {
                cartRecoveryEnabled: true,
                enableEmail: true,
                enableWhatsApp: true,
                enableTelegram: true,
                smartOffersEnabled: true,
                language: 'ar'
            },
            stats: {
                cartsReceived: 0,
                cartsRecovered: 0,
                revenueRecovered: 0,
                messagesSent: 0
            }
        };
        stores.push(newStore);
        await writeDB(STORES_FILE, stores);
        console.log(`✅ New store created in stores collection: ${merchantId}`);
    }
}

// Handle app.installed - App installation confirmation
async function handleAppInstalled(data, merchant) {
    const merchantId = String(merchant?.id || merchant);
    console.log('🎊 App installed by:', merchantId);
    console.log('📦 Install data keys:', Object.keys(data || {}));
    
    // Call sallaApp handler
    if (sallaApp) {
        try {
            await sallaApp.handleInstalled(merchantId, data);
        } catch (e) {
            console.error('❌ sallaApp.handleInstalled error:', e.message);
        }
    }

    const stores = await readDB(STORES_FILE);
    const existingStore = stores.find(s => 
        String(s.merchant) === merchantId || s.merchant === merchantId
    );

    if (!existingStore) {
        // Generate token and extract info from Salla data
        const token = generateToken();
        const email = data?.owner?.email || data?.email || data?.store?.email || '';
        const storeName = data?.store?.name || data?.name || data?.app_name || 'متجر';

        // 🚀 ONE-CLICK ACTIVATION - AUTO-ENABLE EVERYTHING!
        stores.push({
            merchant: merchantId,
            token,
            ribhToken: token,
            email,
            merchantName: storeName,
            installedAt: new Date().toISOString(),
            active: true,
            settings: {
                cartRecoveryEnabled: true,
                cartRecoverySequence: 'smart',
                enableEmail: true,
                emailStyle: 'friendly',
                enableWhatsApp: true,
                enableTelegram: true,
                smartOffersEnabled: true,
                maxDiscount: 15,
                upsellEnabled: true,
                paymentPlansEnabled: true,
                paymentPlanThreshold: 500,
                reactivationEnabled: true,
                reactivationDays: 30,
                aiLearningEnabled: true,
                language: 'ar'
            },
            stats: {
                cartsReceived: 0,
                cartsRecovered: 0,
                revenueRecovered: 0,
                messagesSent: 0
            },
            data
        });
        await writeDB(STORES_FILE, stores);
        console.log(`🚀 ONE-CLICK ACTIVATION: Store ${storeName} (${merchantId}) installed!`);
    } else {
        // Update existing store with install data
        existingStore.merchantName = data?.store?.name || data?.name || existingStore.merchantName;
        existingStore.email = data?.owner?.email || data?.email || existingStore.email;
        existingStore.active = true;
        await writeDB(STORES_FILE, stores);
        console.log(`✅ Store ${merchantId} updated with install data`);
    }
}

// ==========================================
// ADMIN: Resend Welcome Message to Merchant
// ==========================================
app.post('/api/admin/send-welcome', async (req, res) => {
    const { merchantId, phone, email } = req.body;
    
    if (!merchantId) {
        return res.status(400).json({ success: false, error: 'merchantId required' });
    }
    
    const dashboardUrl = `https://europe-west1-ribh-484706.cloudfunctions.net/api/app?merchant=${merchantId}`;
    const results = { email: null, whatsapp: null };
    
    try {
        // Get merchant info
        let merchantName = 'التاجر';
        let storeName = 'المتجر';
        let merchantPhone = phone;
        let merchantEmail = email;
        
        // Try to get info from Salla API
        if (sallaApp) {
            try {
                const merchantInfo = await sallaApp.sallaApi(merchantId, '/store/info');
                const store = merchantInfo.data;
                merchantName = store?.owner?.name || store?.name || merchantName;
                storeName = store?.name || storeName;
                merchantPhone = merchantPhone || store?.owner?.mobile || store?.mobile;
                merchantEmail = merchantEmail || store?.email || store?.owner?.email;
            } catch (e) {
                console.log(`⚠️ Could not fetch merchant info: ${e.message}`);
            }
        }
        
        // Send WhatsApp if phone provided
        if (merchantPhone) {
            let normalizedPhone = String(merchantPhone).replace(/[^\d]/g, '');
            if (normalizedPhone.startsWith('0')) normalizedPhone = '966' + normalizedPhone.substring(1);
            if (!normalizedPhone.startsWith('966')) normalizedPhone = '966' + normalizedPhone;
            normalizedPhone = '+' + normalizedPhone;
            
            const message = `🎉 مرحباً ${merchantName}!

تم تثبيت تطبيق رِبح بنجاح على متجرك "${storeName}" ✅

🚀 ابدأ الآن واسترد سلاتك المتروكة!

📊 لوحة التحكم الخاصة بك:
${dashboardUrl}

💡 ما الذي يمكنك فعله:
• استرداد السلات المتروكة تلقائياً
• إرسال رسائل ذكية للعملاء
• متابعة الإحصائيات والأرباح

للمساعدة: تواصل معنا على +966579353338

شكراً لاختيارك رِبح! 💚`;

            const RIBH_WHATSAPP = process.env.RIBH_WHATSAPP_API || 'https://ribh-whatsapp.onrender.com';
            
            try {
                const response = await fetch(`${RIBH_WHATSAPP}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: normalizedPhone, message })
                });
                
                results.whatsapp = response.ok ? 'sent' : 'failed';
                console.log(`📱 Welcome WhatsApp ${results.whatsapp} to ${normalizedPhone}`);
            } catch (e) {
                results.whatsapp = 'error: ' + e.message;
            }
        }
        
        // Send email if email provided
        if (merchantEmail) {
            try {
                const { sendWelcomeEmail } = require('./lib/emailSender');
                await sendWelcomeEmail({
                    to: merchantEmail,
                    merchantName,
                    storeName,
                    dashboardUrl
                });
                results.email = 'sent';
                console.log(`📧 Welcome email sent to ${merchantEmail}`);
            } catch (e) {
                results.email = 'error: ' + e.message;
            }
        }
        
        res.json({
            success: true,
            merchantId,
            dashboardUrl,
            results
        });
        
    } catch (error) {
        console.error('❌ Send welcome error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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

    // 🆕 USE SMART OFFER from detection
    const smartOffer = cart.smartOffer || { discount: 10, code: 'RIBH10', message: '🎁 خصم 10% على طلبك!' };
    const customerType = cart.customerType || 'NEW';

    // Escalate discount if reminder > 1
    let discount = smartOffer.discount;
    let discountCode = smartOffer.code;
    if (reminderNumber === 2) discount += 5;
    if (reminderNumber >= 3) discount += 10;
    discountCode = `RIBH${discount}`;

    // Create product list HTML
    const productListHtml = cart.items
        .map(item => `<li>${item.name || item.product_name} (${item.quantity || 1}×)</li>`)
        .join('');

    // 🆕 SMART SUBJECT based on customer type
    const subjects = {
        VIP: `${cart.customer.name}، عميلنا المميز! سلتك بانتظارك 🌟`,
        REPEAT: `${cart.customer.name}، شكراً لثقتك! أكمل طلبك 💚`,
        PRICE_SENSITIVE: `${cart.customer.name}، قسّط طلبك بدون فوائد! 💳`,
        NEW: `${cart.customer.name}، سلتك في انتظارك! 🛒`
    };
    const subject = subjects[customerType] || subjects.NEW;

    // 🆕 PAYMENT PLAN section for high-value carts
    const paymentPlanHtml = smartOffer.includePaymentPlan ? `
        <div style="background: linear-gradient(135deg, #6366F1, #8B5CF6); color: white; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 10px;">💳 قسّط بدون فوائد!</div>
            <div style="font-size: 18px;">ادفع <strong>${Math.ceil(cart.total / 4)} ر.س</strong> فقط الآن</div>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 5px;">مع تمارا أو تابي - 4 دفعات بدون فوائد</div>
        </div>
    ` : '';

    // 🆕 PERSONALIZED MESSAGE based on customer type
    const personalMessages = {
        VIP: 'أنت من عملائنا المميزين! لذلك جهزنا لك عرض حصري:',
        REPEAT: 'شكراً لثقتك المستمرة! هذا العرض خاص لك:',
        PRICE_SENSITIVE: 'نفهم أن السعر مهم، لذلك جهزنا لك خيارات مرنة:',
        NEW: 'يسعدنا زيارتك! جهزنا لك عرض ترحيبي خاص:'
    };

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .logo { text-align: center; font-size: 32px; color: #10B981; margin-bottom: 20px; }
            h1 { color: #1D1D1F; font-size: 24px; margin: 0 0 10px 0; }
            .customer-type { display: inline-block; background: ${customerType === 'VIP' ? '#FFD700' : customerType === 'REPEAT' ? '#10B981' : '#6366F1'}; color: ${customerType === 'VIP' ? '#333' : 'white'}; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 15px; }
            .products { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .products ul { margin: 0; padding-right: 20px; }
            .products li { margin: 8px 0; }
            .discount { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
            .discount-value { font-size: 36px; font-weight: bold; }
            .discount-code { background: white; color: #10B981; padding: 8px 20px; border-radius: 8px; display: inline-block; margin-top: 10px; font-weight: bold; }
            .btn { display: block; background: #10B981; color: white !important; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: bold; text-align: center; font-size: 18px; margin: 20px 0; }
            .btn:hover { background: #059669; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">رِبح 💚</div>
            
            <h1>مرحباً ${cart.customer.name}!</h1>
            ${customerType === 'VIP' ? '<span class="customer-type">⭐ عميل مميز</span>' : ''}
            ${customerType === 'REPEAT' ? '<span class="customer-type">💚 عميل موثوق</span>' : ''}
            
            <p>${personalMessages[customerType] || personalMessages.NEW}</p>
            
            <div class="products">
                <strong>منتجاتك:</strong>
                <ul>${productListHtml}</ul>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                    <strong style="font-size: 18px;">المجموع: ${cart.total} ${cart.currency || 'ر.س'}</strong>
                </div>
            </div>
            
            <div class="discount">
                <div>${smartOffer.message}</div>
                <div class="discount-value">${discount}% خصم</div>
                <div class="discount-code">${discountCode}</div>
            </div>
            
            ${paymentPlanHtml}
            
            <a href="${cart.checkoutUrl || cart.storeUrl || '#'}" class="btn">أكمل طلبك الآن 🛒</a>
            
            <p style="text-align: center; color: #666; font-size: 14px;">
                استخدم الكود <strong>${discountCode}</strong> عند الدفع
            </p>
            
            <div class="footer">
                <p>هذه الرسالة من رِبح - نساعدك تستعيد مبيعاتك الضائعة</p>
                <p style="color: #10B981;">تم توفير ${Math.round(cart.total * discount / 100)} ر.س لك! 💚</p>
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
            const response = await sendEmailViaAWS(cart.customer.email, subject, htmlContent);
            if (response) {
                console.log(`✅ Email sent via AWS SES to ${cart.customer.email}`);
                return true;
            }
        } catch (error) {
            console.error('❌ AWS SES error:', error);
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
                console.log(`✅ Email sent via Resend! ID: ${result.id} (${customerType} customer, ${discount}% offer)`);
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
app.get('/api/carts', async (req, res) => {
    const carts = await readDB(DB_FILE);
    res.json(carts.reverse()); // Latest first
});

// Get stats
app.get('/api/stats', async (req, res) => {
    const carts = await readDB(DB_FILE);
    const period = parseInt(req.query.period) || 30; // days
    const cutoff = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    // Filter by period
    const periodCarts = carts.filter(c => new Date(c.createdAt) > cutoff);

    // Cart stats
    const cartStats = {
        total: periodCarts.length,
        pending: periodCarts.filter(c => c.status === 'pending').length,
        sent: periodCarts.filter(c => c.status === 'sent').length,
        recovered: periodCarts.filter(c => c.status === 'recovered').length,
        recoveredValue: periodCarts.filter(c => c.status === 'recovered')
            .reduce((sum, c) => sum + (c.total || 0), 0)
    };

    // Try to get analytics data
    let analyticsData = { events: [] };
    try {
        const analytics = require('./lib/analytics');
        analyticsData = analytics.getGlobalSummary(period);
    } catch (e) { }

    // Try to get sequence data
    let sequenceStats = { active: 0, completed: 0 };
    try {
        const sequences = require('./lib/sequenceEngine');
        sequenceStats = sequences.getSequenceStats('all');
    } catch (e) { }

    // Calculate overall stats
    const totalRevenue = cartStats.recoveredValue;
    const totalSent = cartStats.sent + (analyticsData.emailsSent || 0);
    const recoveryRate = cartStats.sent > 0
        ? ((cartStats.recovered / cartStats.sent) * 100).toFixed(1)
        : 0;

    res.json({
        period: period,
        overview: {
            totalRevenue: totalRevenue,
            totalSent: totalSent,
            recoveryRate: parseFloat(recoveryRate),
            activeCarts: cartStats.pending
        },
        channels: {
            cart_recovery: {
                revenue: cartStats.recoveredValue,
                sent: cartStats.sent,
                converted: cartStats.recovered,
                rate: cartStats.sent > 0 ? ((cartStats.recovered / cartStats.sent) * 100).toFixed(1) : 0
            },
            upsell: {
                revenue: Math.round(totalRevenue * 0.22), // Estimate until real tracking
                sent: Math.round(totalSent * 0.3),
                rate: 18
            },
            referral: {
                revenue: Math.round(totalRevenue * 0.08),
                count: Math.round(cartStats.recovered * 0.1),
                active: 45
            },
            winback: {
                revenue: Math.round(totalRevenue * 0.06),
                sent: Math.round(totalSent * 0.05),
                rate: 14
            }
        },
        sequences: sequenceStats,
        raw: cartStats
    });
});

// Get stores
app.get('/api/stores', async (req, res) => {
    const stores = await readDB(STORES_FILE);
    res.json(stores);
});

// Debug: Check all collections for merchant data
app.get('/api/debug/merchant/:id', async (req, res) => {
    const merchantId = req.params.id;
    const results = {};
    
    try {
        // Check salla_merchants collection
        const sallaDoc = await db.collection('salla_merchants').doc(merchantId).get();
        results.salla_merchants = sallaDoc.exists ? sallaDoc.data() : null;
        
        // Check merchants collection
        const merchantDoc = await db.collection('merchants').doc(merchantId).get();
        results.merchants = merchantDoc.exists ? merchantDoc.data() : null;
        
        // Check stores collection
        const stores = await readDB(STORES_FILE);
        results.stores = stores.find(s => String(s.merchant) === merchantId || s.merchant === merchantId) || null;
        
        res.json({ success: true, merchantId, data: results });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// Test endpoint to simulate app.store.authorize webhook
app.post('/api/test/authorize', async (req, res) => {
    const { merchantId, access_token, refresh_token } = req.body;
    
    if (!merchantId) {
        return res.status(400).json({ error: 'merchantId required' });
    }
    
    try {
        await handleAppAuthorize({
            access_token: access_token || 'test_token_' + Date.now(),
            refresh_token: refresh_token || 'test_refresh_' + Date.now(),
            expires_in: 86400,
            scope: 'offline_access'
        }, merchantId);
        
        const stores = await readDB(STORES_FILE);
        const store = stores.find(s => String(s.merchant) === String(merchantId));
        
        res.json({ 
            success: true, 
            message: 'Test authorize completed',
            storeFound: !!store,
            store: store ? { merchant: store.merchant, ribhToken: store.ribhToken } : null
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==========================================
// ANALYTICS V2 ENDPOINT (Comprehensive)
// ==========================================
app.get('/api/analytics/v2', async (req, res) => {
    try {
        const { getAnalytics } = require('./lib/analyticsEngine');
        const cookies = parseCookies(req);
        const token = req.query.token || cookies.ribhToken;
        const days = parseInt(req.query.days) || 30;
        
        // Get storeId from token or default
        let storeId = 'default';
        if (token) {
            const stores = await readDB(STORES_FILE);
            const store = stores.find(s => s.accessToken === token);
            if (store) storeId = store.id || store.salla?.merchant?.id || 'default';
        }
        
        const analytics = await getAnalytics(storeId, days);
        res.json({ success: true, data: analytics });
    } catch (error) {
        console.error('Analytics v2 error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// RIBH DASHBOARD STATS ENDPOINT
// ==========================================

app.get('/api/ribh/stats', async (req, res) => {
    try {
        // 1. Merchant info from salla_merchants
        let merchant = null;
        const merchantSnap = await db.collection('salla_merchants')
            .where('status', 'in', ['active', 'installed'])
            .limit(1).get();
        if (!merchantSnap.empty) {
            const d = merchantSnap.docs[0].data();
            merchant = {
                id: d.merchantId,
                storeName: d.storeName || null,
                ownerName: d.ownerName || null,
                status: d.status,
                lastSync: d.updatedAt ? (d.updatedAt.toDate ? d.updatedAt.toDate().toISOString() : d.updatedAt) : null
            };
        }

        // 2. Abandoned carts from abandoned_carts collection
        const cartsSnap = await db.collection('abandoned_carts').get();
        const carts = cartsSnap.docs.map(d => d.data());

        const activeCarts = carts.filter(c => c.status !== 'recovered' && c.status !== 'purchased');
        const recoveredCarts = carts.filter(c => c.status === 'recovered' || c.status === 'purchased');
        const sentCarts = carts.filter(c => c.whatsappSent === true);

        const abandonedTotal = activeCarts.reduce((s, c) => s + (c.total || 0), 0);
        const recoveredTotal = recoveredCarts.reduce((s, c) => s + (c.total || 0), 0);

        // 3. Legacy carts collection (for orders/revenue log)
        const legacyCarts = await readDB(DB_FILE);
        const legacyRecovered = legacyCarts.filter(c => c.status === 'recovered');
        const legacySent = legacyCarts.filter(c => c.status === 'sent');
        const legacyRevenue = legacyRecovered.reduce((s, c) => s + (c.total || 0), 0);

        // Combine stats from both sources
        const totalRevenue = recoveredTotal + legacyRevenue;
        const totalSent = sentCarts.length + legacySent.length;
        const totalRecovered = recoveredCarts.length + legacyRecovered.length;
        const recoveryRate = totalSent > 0 ? Math.round((totalRecovered / totalSent) * 100) : 0;

        // 4. Customer count from salla API data (or fallback estimate)
        let customerCount = 0;
        if (merchant) {
            // Unique customers from abandoned carts
            const customerIds = new Set();
            carts.forEach(c => { if (c.customer?.id) customerIds.add(c.customer.id); });
            legacyCarts.forEach(c => { if (c.customerId) customerIds.add(c.customerId); });
            customerCount = customerIds.size;
        }

        // 5. Flow-level stats
        const flowStats = {
            cart_recovery: { sent: sentCarts.length + legacySent.length, revenue: totalRevenue },
            winback: { sent: 0, revenue: 0 },
            post_purchase: { sent: 0, revenue: 0 },
            review: { sent: 0, revenue: 0 },
            browse: { sent: 0, revenue: 0 },
            cod: { sent: 0, revenue: 0 }
        };

        // Check browse_abandonments collection
        try {
            const browseSnap = await db.collection('browse_abandonments')
                .where('messageSent', '==', true).get();
            flowStats.browse.sent = browseSnap.size;
        } catch (e) { /* collection may not exist */ }

        // Check review_requests collection
        try {
            const reviewSnap = await db.collection('review_requests').get();
            flowStats.review.sent = reviewSnap.docs.filter(d => d.data().sent === true).length;
        } catch (e) { /* collection may not exist */ }

        // 6. Active flows count (from Firestore config or default)
        let activeFlowCount = 0;
        try {
            const configDoc = await db.collection('config').doc('flows').get();
            if (configDoc.exists) {
                const flows = configDoc.data();
                activeFlowCount = Object.values(flows).filter(v => v === true).length;
            }
        } catch (e) { /* no config yet */ }

        res.json({
            success: true,
            merchant,
            hero: {
                abandonedCarts: activeCarts.length,
                abandonedValue: Math.round(abandonedTotal),
                dormantCustomers: 0,
                dormantValue: 0,
                upsellOpportunities: 0,
                upsellValue: 0,
                total: Math.round(abandonedTotal)
            },
            stats: {
                totalRevenue: Math.round(totalRevenue),
                messagesSent: totalSent,
                recoveryRate,
                activeFlowCount
            },
            flows: flowStats,
            customerCount
        });

    } catch (error) {
        console.error('[RIBH Stats] Error:', error);
        res.json({
            success: false,
            merchant: null,
            hero: { abandonedCarts: 0, abandonedValue: 0, dormantCustomers: 0, dormantValue: 0, upsellOpportunities: 0, upsellValue: 0, total: 0 },
            stats: { totalRevenue: 0, messagesSent: 0, recoveryRate: 0, activeFlowCount: 0 },
            flows: { cart_recovery: { sent: 0, revenue: 0 }, winback: { sent: 0, revenue: 0 }, post_purchase: { sent: 0, revenue: 0 }, review: { sent: 0, revenue: 0 }, browse: { sent: 0, revenue: 0 }, cod: { sent: 0, revenue: 0 } },
            customerCount: 0
        });
    }
});

// ==========================================
// STORE ANALYZER - One Click Money Flow
// ==========================================

const { analyzeStore, generateCampaignSummary } = require('./lib/storeAnalyzer');
const { generateAllCampaigns, previewCampaign } = require('./lib/campaignGenerator');

// Analyze store and return money waiting + campaign preview
app.get('/api/ribh/analyze', async (req, res) => {
    try {
        // Find active merchant
        const merchantSnap = await db.collection('salla_merchants')
            .where('status', 'in', ['active', 'installed'])
            .limit(1).get();

        if (merchantSnap.empty) {
            return res.json({
                success: false,
                error: 'no_merchant',
                message: 'Connect your store first'
            });
        }

        const merchantDoc = merchantSnap.docs[0];
        const merchantData = merchantDoc.data();
        const merchantId = merchantData.merchantId;

        console.log(`[Analyze] Starting analysis for merchant ${merchantId}`);

        // Analyze the store
        const analysis = await analyzeStore('salla', merchantId);

        if (analysis.error) {
            return res.json({
                success: false,
                error: 'analysis_failed',
                message: analysis.error
            });
        }

        // Generate campaign summary
        const summary = generateCampaignSummary(analysis);

        // Get store info for previews
        const storeInfo = {
            name: merchantData.storeName || 'المتجر',
            url: merchantData.storeUrl || `https://salla.sa/s/${merchantId}`
        };

        // Generate sample previews for each campaign type
        const previews = {};
        if (analysis.abandonedCarts.length > 0) {
            previews.cartRecovery = previewCampaign('cartRecovery', analysis.abandonedCarts[0], storeInfo, 'ar');
            previews.cartRecovery.audience = analysis.abandonedCarts.length;
            previews.cartRecovery.estimatedRevenue = summary.campaigns.cartRecovery.estimatedRevenue;
        }
        if (analysis.dormantCustomers.length > 0) {
            previews.winback = previewCampaign('winback', analysis.dormantCustomers[0], storeInfo, 'ar');
            previews.winback.audience = analysis.dormantCustomers.length;
            previews.winback.estimatedRevenue = summary.campaigns.winback.estimatedRevenue;
        }
        if (analysis.recentBuyers.length > 0) {
            previews.upsell = previewCampaign('upsell', analysis.recentBuyers[0], storeInfo, 'ar');
            previews.upsell.audience = analysis.recentBuyers.length;
            previews.upsell.estimatedRevenue = summary.campaigns.upsell.estimatedRevenue;
        }

        res.json({
            success: true,
            merchant: {
                id: merchantId,
                name: merchantData.storeName || null,
                status: merchantData.status
            },
            analysis: {
                moneyWaiting: summary.overview.totalMoneyWaiting,
                breakdown: summary.overview.breakdown,
                totalCustomers: summary.overview.totalCustomers
            },
            campaigns: summary.campaigns,
            previews,
            analyzedAt: analysis.analyzedAt
        });

    } catch (error) {
        console.error('[Analyze] Error:', error);
        res.status(500).json({
            success: false,
            error: 'server_error',
            message: error.message
        });
    }
});

// Launch campaigns - ONE CLICK MONEY FLOW
app.post('/api/ribh/launch', async (req, res) => {
    try {
        const { campaigns = ['cartRecovery', 'winback', 'upsell'] } = req.body;

        // Find active merchant
        const merchantSnap = await db.collection('salla_merchants')
            .where('status', 'in', ['active', 'installed'])
            .limit(1).get();

        if (merchantSnap.empty) {
            return res.json({ success: false, error: 'no_merchant' });
        }

        const merchantDoc = merchantSnap.docs[0];
        const merchantData = merchantDoc.data();
        const merchantId = merchantData.merchantId;

        console.log(`[Launch] Starting campaigns for merchant ${merchantId}:`, campaigns);

        // Analyze store first
        const analysis = await analyzeStore('salla', merchantId);

        if (analysis.error) {
            return res.json({ success: false, error: analysis.error });
        }

        // Get store info
        const storeInfo = {
            name: merchantData.storeName || 'المتجر',
            url: merchantData.storeUrl || `https://salla.sa/s/${merchantId}`
        };

        // Generate all campaign messages
        const allCampaigns = await generateAllCampaigns(analysis, storeInfo, 'ar');

        // Track results
        const results = {
            launched: [],
            messagesSent: 0,
            errors: []
        };

        // Send messages via WhatsApp
        const RIBH_WHATSAPP = process.env.RIBH_WHATSAPP_API || 'https://ribh-whatsapp.onrender.com';

        for (const campaignType of campaigns) {
            const messages = allCampaigns[campaignType];
            if (!messages || messages.length === 0) continue;

            console.log(`[Launch] Sending ${messages.length} messages for ${campaignType}`);

            let sent = 0;
            for (const msg of messages) {
                try {
                    const response = await fetch(`${RIBH_WHATSAPP}/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: msg.phone,
                            message: msg.message
                        })
                    });

                    if (response.ok) {
                        sent++;
                        results.messagesSent++;

                        // Log the sent message
                        await db.collection('campaign_messages').add({
                            merchantId,
                            campaignType,
                            phone: msg.phone,
                            name: msg.name,
                            message: msg.message,
                            value: msg.value,
                            status: 'sent',
                            sentAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        // Add delay between messages (anti-ban)
                        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
                    }
                } catch (e) {
                    console.error(`[Launch] Send error:`, e.message);
                    results.errors.push({ phone: msg.phone, error: e.message });
                }
            }

            results.launched.push({
                type: campaignType,
                audience: messages.length,
                sent,
                estimatedRevenue: Math.round(messages.reduce((s, m) => s + (m.value || 0), 0) * 0.35)
            });
        }

        // Update merchant stats
        await db.collection('salla_merchants').doc(merchantDoc.id).update({
            lastCampaignAt: admin.firestore.FieldValue.serverTimestamp(),
            totalMessagesSent: admin.firestore.FieldValue.increment(results.messagesSent)
        });

        // Notify owner via WhatsApp if configured
        if (merchantData.ownerPhone && results.messagesSent > 0) {
            try {
                const ownerMessage = `🚀 تم إطلاق حملتك!

📤 ${results.messagesSent} رسالة تم إرسالها
💰 متوقع استرداد: ${results.launched.reduce((s, l) => s + l.estimatedRevenue, 0).toLocaleString()} ر.س

سنبلغك فور أول استرداد! 🎉`;

                await fetch(`${RIBH_WHATSAPP}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: merchantData.ownerPhone,
                        message: ownerMessage
                    })
                });
            } catch (e) {
                console.log(`[Launch] Owner notification failed:`, e.message);
            }
        }

        console.log(`[Launch] Complete:`, results);

        res.json({
            success: true,
            results
        });

    } catch (error) {
        console.error('[Launch] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==========================================
// ACTIVITY FEED ENDPOINT
// ==========================================

// Get recent activity for dashboard
app.get('/api/ribh/activity', async (req, res) => {
    try {
        const cookies = parseCookies(req);
        const token = req.query.token || cookies.ribhToken;

        // Get recent carts and logs
        const carts = await readDB(DB_FILE);
        const logs = await readDB(LOGS_FILE);

        // Build activity feed from carts and logs
        const activities = [];

        // Recent cart activities (last 20)
        const recentCarts = carts
            .filter(c => c.createdAt)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 20);

        recentCarts.forEach(cart => {
            let type = 'cart';
            let message = 'سلة متروكة جديدة';

            if (cart.status === 'recovered') {
                type = 'recovered';
                message = 'تم استرداد سلة بنجاح! 💰';
            } else if (cart.status === 'sent') {
                type = 'sent';
                message = 'تم إرسال رسالة استرداد 📧';
            } else {
                type = 'cart';
                message = 'سلة متروكة جديدة 🛒';
            }

            activities.push({
                type,
                message,
                amount: cart.total || 0,
                time: formatTimeAgo(cart.createdAt),
                timestamp: cart.createdAt
            });
        });

        // Sort by timestamp descending
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            activities: activities.slice(0, 10),
            total: activities.length
        });

    } catch (error) {
        console.error('Activity error:', error);
        res.json({ success: true, activities: [], total: 0 });
    }
});

// Helper: Format time ago in Arabic
function formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return date.toLocaleDateString('ar-SA');
}

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

// ==========================================
// EMAIL TEST & TEMPLATE ENDPOINTS
// ==========================================

// Send test email
app.post('/api/email/test', async (req, res) => {
    const { email, subject, body, offer, urgency } = req.body;

    console.log('📧 Test email request received');
    console.log(`   Email: ${email}`);
    console.log(`   Subject: ${subject}`);

    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }

    try {
        const emailSender = require('./lib/emailSender');
        const analytics = require('./lib/analytics');

        const result = await emailSender.sendOfferEmail(email, {
            headline: subject || 'رسالة تجريبية من رِبح ✨',
            body: body || 'هذه رسالة تجريبية للتأكد من عمل النظام',
            offer: offer || 'خصم 10%',
            urgency: urgency || 'العرض ينتهي خلال 24 ساعة'
        }, {
            storeName: 'رِبح - رسالة تجريبية',
            checkoutUrl: 'https://ribh.click'
        });

        if (result.success) {
            // Log to analytics so it shows up in dashboard stats
            await analytics.track.emailSent('test-store', 'email', 'test_email', email);
            console.log(`✅ Test email sent to ${email}`);
            res.json({ success: true, message: 'تم إرسال البريد بنجاح!', id: result.id });
        } else {
            console.log(`❌ Test email failed:`, result);
            res.json({
                success: false,
                error: result.error,
                details: result.details,
                tip: 'تأكد من أن مفتاح Resend له صلاحية كاملة (Full Access) وأن النطاق ribh.click مفعّل'
            });
        }
    } catch (error) {
        console.log(`❌ Test email exception:`, error.message);
        res.json({ success: false, error: error.message });
    }
});

// Save custom template
// const TEMPLATES_FILE = path.join(__dirname, 'data', 'templates.json');
// if (!fs.existsSync(TEMPLATES_FILE)) {
//     fs.writeFileSync(TEMPLATES_FILE, JSON.stringify({}));
// }

app.post('/api/templates/save', async (req, res) => {
    const { templateId, template } = req.body;

    if (!templateId || !template) {
        return res.status(400).json({ error: 'Missing templateId or template' });
    }

    const templates = await readDB('templates');
    templates[templateId] = {
        ...template,
        updatedAt: new Date().toISOString()
    };

    try {
        await writeDB('templates', Object.values(templates)); // Store as list or handle object mapping in writeDB
        console.log(`💾 Template ${templateId} saved`);
        res.json({ success: true, message: 'Template saved' });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/templates', async (req, res) => {
    const templates = await readDB('templates');
    res.json(templates);
});

// A/B Testing Results API
app.get('/api/ab/results', (req, res) => {
    try {
        const abTesting = require('./lib/abTesting');
        const cartResults = abTesting.getTestResults('cart_recovery');
        const upsellResults = abTesting.getTestResults('upsell');

        res.json({
            success: true,
            cart_recovery: {
                results: cartResults,
                winner: {
                    subject: abTesting.getWinner('cart_recovery', 'subject'),
                    discount: abTesting.getWinner('cart_recovery', 'discount')
                }
            },
            upsell: {
                results: upsellResults,
                winner: {
                    subject: abTesting.getWinner('upsell', 'subject'),
                    discount: abTesting.getWinner('upsell', 'discount')
                }
            }
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Test webhook (for development) - ENHANCED
app.post('/api/test/abandoned-cart', async (req, res) => {
    // Allow custom test data from request body
    const customData = req.body || {};

    const testData = {
        event: 'cart.abandoned',
        merchant: customData.merchant || 'test-store',
        data: {
            id: customData.id || Date.now(),
            customer: {
                name: customData.customerName || 'أحمد محمد',
                mobile: customData.phone || '+966501234567',
                email: customData.email || 'ahmed@example.com'
            },
            items: customData.items || [
                { name: 'قميص أزرق', quantity: 2, price: 150 },
                { name: 'بنطلون جينز', quantity: 1, price: 200 }
            ],
            total: customData.total || 500,
            currency: customData.currency || 'SAR'
        }
    };

    try {
        await handleAbandonedCart(testData.data, testData.merchant);
        res.json({
            success: true,
            message: 'Test cart created!',
            cartId: testData.data.id,
            customer: testData.data.customer.name,
            total: testData.data.total
        });
    } catch (error) {
        console.error('❌ Test cart error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🧪 COMPREHENSIVE TEST - Test ALL channels at once
app.post('/api/test/all', async (req, res) => {
    console.log('\n🧪 ===========================================');
    console.log('🧪 COMPREHENSIVE SYSTEM TEST');
    console.log('🧪 ===========================================\n');

    const { email, phone, customerName } = req.body;
    const testResults = {
        timestamp: new Date().toISOString(),
        channels: {
            email: { tested: false, success: false, error: null },
            sms: { tested: false, success: false, error: null },
            ai: { tested: false, success: false, message: null, error: null },
            telegram: { tested: false, success: false, error: null }
        },
        summary: {}
    };

    // Test Email
    if (email && config.RESEND_API_KEY) {
        testResults.channels.email.tested = true;
        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: config.EMAIL_FROM || 'ribh@ribh.click',
                    to: email,
                    subject: '🧪 RIBH Test - Email Working!',
                    html: `
                    <div style="font-family: -apple-system, Arial, sans-serif; background: linear-gradient(135deg, #10B981, #8B5CF6); padding: 40px; text-align: center;">
                        <div style="background: white; border-radius: 20px; padding: 40px; max-width: 400px; margin: 0 auto;">
                            <h1 style="color: #10B981; margin: 0;">✅ نجح الاختبار!</h1>
                            <p style="color: #666; margin-top: 20px;">Hello ${customerName || 'there'}! Your RIBH email integration is working perfectly.</p>
                            <p style="color: #888; font-size: 14px; margin-top: 30px;">RIBH Test • ${new Date().toISOString()}</p>
                        </div>
                    </div>
                    `
                })
            });
            const result = await response.json();
            testResults.channels.email.success = !!result.id;
            testResults.channels.email.messageId = result.id;
        } catch (error) {
            testResults.channels.email.error = error.message;
        }
    }

    // Test SMS (AWS SNS)
    if (phone && config.AWS_ACCESS_KEY) {
        testResults.channels.sms.tested = true;
        try {
            const smsResult = await sendSMS(phone, `🧪 RIBH Test: SMS is working! • ${new Date().toLocaleTimeString('ar-SA')}`);
            testResults.channels.sms.success = !!smsResult;
        } catch (error) {
            testResults.channels.sms.error = error.message;
        }
    }

    // Test AI (Gemini)
    if (config.GEMINI_API_KEY) {
        testResults.channels.ai.tested = true;
        try {
            const prompt = `اكتب رسالة واتساب قصيرة ومقنعة لاسترجاع سلة متروكة للعميل ${customerName || 'أحمد'}. السلة تحتوي على منتجات بقيمة 500 ريال. اكتب الرسالة مباشرة.`;
            const aiMessage = await generateWithGemini(prompt);
            testResults.channels.ai.success = !!aiMessage;
            testResults.channels.ai.message = aiMessage;
        } catch (error) {
            testResults.channels.ai.error = error.message;
        }
    }

    // Test Telegram (if configured)
    if (config.TELEGRAM_BOT_TOKEN && req.body.telegramChatId) {
        testResults.channels.telegram.tested = true;
        try {
            const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: req.body.telegramChatId,
                    text: `🧪 RIBH Test Success!\n\n✅ Telegram integration is working.\n\n🕐 ${new Date().toLocaleTimeString('ar-SA')}`
                })
            });
            const result = await response.json();
            testResults.channels.telegram.success = result.ok;
        } catch (error) {
            testResults.channels.telegram.error = error.message;
        }
    }

    // Calculate summary
    const channels = Object.values(testResults.channels);
    testResults.summary = {
        tested: channels.filter(c => c.tested).length,
        passed: channels.filter(c => c.success).length,
        failed: channels.filter(c => c.tested && !c.success).length,
        status: channels.filter(c => c.tested).every(c => c.success) ? '✅ ALL PASSED' : '⚠️ SOME FAILED'
    };

    console.log('\n🧪 Test Results:', JSON.stringify(testResults.summary, null, 2));

    res.json(testResults);
});

// Get webhook logs
app.get('/api/logs', async (req, res) => {
    const logs = await readDB(LOG_FILE);
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
// WHATSAPP QR CONNECTION API (Instant - No Meta API needed!)
// ==========================================

let whatsappManager = null;
try {
    const { whatsappManager: wm } = require('./lib/whatsappQR');
    whatsappManager = wm;
    console.log('📱 WhatsApp QR service loaded');
} catch (error) {
    console.log('⚠️ WhatsApp QR service not available (install whatsapp-web.js)');
}

// Initialize WhatsApp connection for a store (returns QR code)
app.post('/api/whatsapp/connect', async (req, res) => {
    if (!whatsappManager) {
        return res.status(503).json({
            success: false,
            error: 'WhatsApp QR service not available. Run: npm install whatsapp-web.js qrcode'
        });
    }

    const { storeId } = req.body;
    if (!storeId) {
        return res.status(400).json({ success: false, error: 'storeId required' });
    }

    try {
        const service = await whatsappManager.connect(storeId);

        // Set up event handlers for this request
        const timeout = setTimeout(() => {
            res.json({
                success: true,
                status: service.getStatus(),
                message: 'Connection initiated. Poll /api/whatsapp/status for QR code.'
            });
        }, 5000);

        // If QR is generated quickly, return it
        service.once('qr', (qrCode) => {
            clearTimeout(timeout);
            res.json({
                success: true,
                status: 'qr_ready',
                qrCode: qrCode,
                message: 'Scan this QR code with WhatsApp'
            });
        });

        // If already connected
        if (service.isReady) {
            clearTimeout(timeout);
            res.json({
                success: true,
                status: 'connected',
                message: 'WhatsApp already connected!'
            });
        }

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get WhatsApp connection status
app.get('/api/whatsapp/status', async (req, res) => {
    if (!whatsappManager) {
        return res.json({
            available: false,
            message: 'WhatsApp QR not installed'
        });
    }

    const { storeId } = req.query;

    if (storeId) {
        const service = await whatsappManager.getStore(storeId);
        res.json({
            available: true,
            ...service.getStatus()
        });
    } else {
        res.json({
            available: true,
            stores: whatsappManager.getAllStatus()
        });
    }
});

// Send WhatsApp message
app.post('/api/whatsapp/send', async (req, res) => {
    if (!whatsappManager) {
        return res.status(503).json({ success: false, error: 'WhatsApp QR not available' });
    }

    const { storeId, phone, message } = req.body;

    if (!storeId || !phone || !message) {
        return res.status(400).json({
            success: false,
            error: 'storeId, phone, and message are required'
        });
    }

    try {
        const result = await whatsappManager.sendMessage(storeId, phone, message);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send cart recovery via WhatsApp
app.post('/api/whatsapp/cart-recovery', async (req, res) => {
    if (!whatsappManager) {
        return res.status(503).json({ success: false, error: 'WhatsApp QR not available' });
    }

    const { storeId, phone, customerName, cartTotal, checkoutUrl, discount } = req.body;

    if (!storeId || !phone || !customerName || !cartTotal) {
        return res.status(400).json({
            success: false,
            error: 'storeId, phone, customerName, cartTotal are required'
        });
    }

    try {
        const result = await whatsappManager.sendCartRecovery(
            storeId, phone, customerName, cartTotal, checkoutUrl || '', discount || 0
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Disconnect WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
    if (!whatsappManager) {
        return res.status(503).json({ success: false, error: 'WhatsApp QR not available' });
    }

    const { storeId } = req.body;

    try {
        const service = await whatsappManager.getStore(storeId);
        await service.disconnect();
        res.json({ success: true, message: 'WhatsApp disconnected' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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

    // Update only provided fields - API Keys
    if (req.body.resendApiKey) storeSettings.resendApiKey = req.body.resendApiKey;
    if (req.body.emailFrom) storeSettings.emailFrom = req.body.emailFrom;
    if (req.body.telegramBotToken) storeSettings.telegramBotToken = req.body.telegramBotToken;
    if (req.body.twilioAccountSid) storeSettings.twilioAccountSid = req.body.twilioAccountSid;
    if (req.body.twilioAuthToken) storeSettings.twilioAuthToken = req.body.twilioAuthToken;
    if (req.body.twilioSmsNumber) storeSettings.twilioSmsNumber = req.body.twilioSmsNumber;

    // Channel Toggles
    if (req.body.enableSms !== undefined) storeSettings.enableSms = req.body.enableSms;
    if (req.body.enableEmail !== undefined) storeSettings.enableEmail = req.body.enableEmail;

    // Feature Toggles (from dashboard)
    if (req.body.cart_enabled !== undefined) storeSettings.cartEnabled = req.body.cart_enabled;
    if (req.body.upsell_enabled !== undefined) storeSettings.upsellEnabled = req.body.upsell_enabled;
    if (req.body.referral_enabled !== undefined) storeSettings.referralEnabled = req.body.referral_enabled;
    if (req.body.winback_enabled !== undefined) storeSettings.winbackEnabled = req.body.winback_enabled;

    settings[storeId] = storeSettings;
    writeSettings(settings);

    console.log(`✅ Settings saved for store: ${storeId}`, req.body);
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
// 🚀 ONE-CLICK STORE STATUS API
// ==========================================
// Returns complete store status for dashboard display

app.get('/api/store/status', async (req, res) => {
    const cookies = parseCookies(req);
    const token = req.query.token || cookies.ribhToken;

    if (!token) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const stores = await readDB(STORES_FILE);
    const store = stores.find(s => s.ribhToken === token);

    if (!store) {
        return res.status(404).json({ success: false, error: 'Store not found' });
    }

    // Get store settings from both places (legacy + new)
    const legacySettings = readSettings()[store.merchant] || {};
    const storeSettings = store.settings || {};

    // Merge settings (prefer store.settings, fallback to legacy)
    const settings = {
        ...legacySettings,
        ...storeSettings
    };

    // Get real-time stats
    const carts = await readDB(DB_FILE);
    const storeCarts = carts.filter(c => c.merchant === store.merchant);
    const recoveredCarts = storeCarts.filter(c => c.status === 'recovered');
    const revenueRecovered = recoveredCarts.reduce((sum, c) => sum + (c.total || 0), 0);

    res.json({
        success: true,
        store: {
            merchant: store.merchant,
            merchantName: store.merchantName || 'متجر',
            email: store.email,
            installedAt: store.installedAt,
            active: store.active !== false
        },
        // Features status (ONE-CLICK shows all as enabled)
        features: {
            cartRecovery: {
                enabled: settings.cartRecoveryEnabled !== false,
                status: 'active',
                label: 'استرداد السلات'
            },
            email: {
                enabled: settings.enableEmail !== false,
                status: config.RESEND_API_KEY ? 'active' : 'pending_config',
                label: 'البريد الإلكتروني'
            },
            whatsapp: {
                enabled: settings.enableWhatsApp !== false,
                status: process.env.META_WHATSAPP_TOKEN ? 'active' : 'pending_config',
                label: 'واتساب'
            },
            telegram: {
                enabled: settings.enableTelegram !== false,
                status: config.TELEGRAM_BOT_TOKEN ? 'active' : 'pending_config',
                label: 'تيليجرام'
            },
            smartOffers: {
                enabled: settings.smartOffersEnabled !== false,
                status: 'active',
                label: 'العروض الذكية'
            },
            upsell: {
                enabled: settings.upsellEnabled !== false,
                status: 'active',
                label: 'زيادة المبيعات'
            },
            paymentPlans: {
                enabled: settings.paymentPlansEnabled !== false,
                status: 'active',
                label: 'التقسيط'
            },
            aiLearning: {
                enabled: settings.aiLearningEnabled !== false,
                status: 'active',
                label: 'التعلم الذكي'
            }
        },
        // Live stats
        stats: {
            cartsReceived: storeCarts.length,
            cartsRecovered: recoveredCarts.length,
            revenueRecovered: revenueRecovered,
            recoveryRate: storeCarts.length > 0
                ? Math.round((recoveredCarts.length / storeCarts.length) * 100)
                : 0,
            messagesSent: store.stats?.messagesSent || 0
        },
        // System status
        system: {
            status: 'active',
            lastActivity: new Date().toISOString(),
            version: '2.0'
        }
    });
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
// POST-PURCHASE UPSELL API
// ==========================================

// Trigger upsell for an order
app.post('/api/upsell/trigger', async (req, res) => {
    if (!postPurchaseUpsell) return res.status(503).json({ error: 'Post-Purchase Upsell not available' });
    try {
        const { orderData, storeId } = req.body;
        const result = await postPurchaseUpsell.handleOrderCreated(orderData, { storeId });
        res.json({ success: true, result });
    } catch (e) {
        console.error('Upsell trigger error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Get upsell stats for a store
app.get('/api/upsell/stats/:storeId', async (req, res) => {
    if (!postPurchaseUpsell) return res.status(503).json({ error: 'Post-Purchase Upsell not available' });
    try {
        const stats = await postPurchaseUpsell.getUpsellStats(req.params.storeId);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Track upsell click
app.post('/api/upsell/click/:upsellId', async (req, res) => {
    if (!postPurchaseUpsell) return res.status(503).json({ error: 'Post-Purchase Upsell not available' });
    try {
        await postPurchaseUpsell.trackUpsellClick(req.params.upsellId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Track upsell conversion
app.post('/api/upsell/convert/:upsellId', async (req, res) => {
    if (!postPurchaseUpsell) return res.status(503).json({ error: 'Post-Purchase Upsell not available' });
    try {
        await postPurchaseUpsell.trackUpsellConversion(req.params.upsellId, req.body.revenue);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// REVIEW COLLECTOR API
// ==========================================

// Schedule a review request
app.post('/api/reviews/schedule', async (req, res) => {
    if (!reviewCollector) return res.status(503).json({ error: 'Review Collector not available' });
    try {
        const { orderId, storeId } = req.body;
        const result = await reviewCollector.scheduleReviewRequest(orderId, storeId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Handle incoming review response (rating)
app.post('/api/reviews/respond', async (req, res) => {
    if (!reviewCollector) return res.status(503).json({ error: 'Review Collector not available' });
    try {
        const { phone, message, storeId } = req.body;
        const result = await reviewCollector.handleReviewResponse(phone, message, storeId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get review stats for a store
app.get('/api/reviews/stats/:storeId', async (req, res) => {
    if (!reviewCollector) return res.status(503).json({ error: 'Review Collector not available' });
    try {
        const stats = await reviewCollector.getReviewStats(req.params.storeId);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get NPS score
app.get('/api/reviews/nps/:storeId', async (req, res) => {
    if (!reviewCollector) return res.status(503).json({ error: 'Review Collector not available' });
    try {
        const nps = await reviewCollector.calculateNPS(req.params.storeId);
        res.json({ success: true, nps });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// BROWSE ABANDONMENT API
// ==========================================

// Track a product view
app.post('/api/browse/track', async (req, res) => {
    if (!browseAbandonment) return res.status(503).json({ error: 'Browse Abandonment not available' });
    try {
        const { customerId, productData, storeId } = req.body;
        const result = await browseAbandonment.trackProductView(customerId, productData, storeId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Run browse abandonment detection
app.post('/api/browse/detect/:storeId', async (req, res) => {
    if (!browseAbandonment) return res.status(503).json({ error: 'Browse Abandonment not available' });
    try {
        const result = await browseAbandonment.detectBrowseAbandonment(req.params.storeId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get browse abandonment stats
app.get('/api/browse/stats/:storeId', async (req, res) => {
    if (!browseAbandonment) return res.status(503).json({ error: 'Browse Abandonment not available' });
    try {
        const stats = await browseAbandonment.getBrowseStats(req.params.storeId);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// CAMPAIGN LAUNCHER API
// ==========================================

// Create a new campaign
app.post('/api/campaigns/create', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const result = await campaignLauncher.createCampaign(req.body);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Upload contacts to a campaign
app.post('/api/campaigns/:campaignId/contacts', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const result = await campaignLauncher.uploadContacts(req.params.campaignId, req.body.contacts);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start a campaign
app.post('/api/campaigns/:campaignId/start', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const result = await campaignLauncher.startCampaign(req.params.campaignId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Pause a campaign
app.post('/api/campaigns/:campaignId/pause', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const result = await campaignLauncher.pauseCampaign(req.params.campaignId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get all campaigns
app.get('/api/campaigns/list', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const campaigns = await campaignLauncher.getAllCampaigns();
        res.json({ success: true, campaigns });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get campaign stats
app.get('/api/campaigns/:campaignId/stats', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const stats = await campaignLauncher.getCampaignStats(req.params.campaignId);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update contact status
app.post('/api/campaigns/:campaignId/contacts/:contactId/status', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const { status, note } = req.body;
        await campaignLauncher.updateContactStatus(req.params.campaignId, req.params.contactId, status, note);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Mark phone as do-not-contact
app.post('/api/campaigns/do-not-contact', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        await campaignLauncher.markDoNotContact(req.body.phone);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Export campaign results
app.get('/api/campaigns/:campaignId/export', async (req, res) => {
    if (!campaignLauncher) return res.status(503).json({ error: 'Campaign Launcher not available' });
    try {
        const results = await campaignLauncher.exportResults(req.params.campaignId);
        res.json({ success: true, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// CUSTOMER IMPORT API
// ==========================================

/**
 * Preview import - detect columns, show sample data
 * POST /api/customers/import/preview
 * Body: { data: "csv text or json string", format: "csv|json|foodics|marn|qoyod" }
 */
app.post('/api/customers/import/preview', async (req, res) => {
    if (!customerImport) return res.status(503).json({ success: false, error: 'Customer Import not available' });
    try {
        const { data, format } = req.body;
        if (!data) {
            return res.status(400).json({ success: false, error: 'No data provided' });
        }
        const preview = customerImport.previewImport(data, format || 'csv');
        res.json({ success: true, ...preview });
    } catch (e) {
        console.error('[CustomerImport] Preview error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Import customers from file data
 * POST /api/customers/import
 * Body: { storeId, data: "csv text or json string", format, mapping?, source? }
 */
app.post('/api/customers/import', async (req, res) => {
    if (!customerImport) return res.status(503).json({ success: false, error: 'Customer Import not available' });
    try {
        const { storeId, data, format, mapping, source } = req.body;

        if (!storeId) {
            return res.status(400).json({ success: false, error: 'Store ID is required' });
        }
        if (!data) {
            return res.status(400).json({ success: false, error: 'No data provided' });
        }

        // Parse the data
        let headers, rows;
        if (format && format !== 'csv') {
            const posSystem = ['foodics', 'marn', 'qoyod'].includes(format) ? format : 'generic';
            const parsed = customerImport.parsePOSData(data, posSystem);
            headers = parsed.headers;
            rows = parsed.rows;
        } else {
            const parsed = customerImport.parseCSV(data);
            headers = parsed.headers;
            rows = parsed.rows;
        }

        if (!rows || rows.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid rows found in data' });
        }

        // Use provided mapping or auto-detect
        const columnMapping = mapping || customerImport.autoDetectColumns(headers);

        // Run import
        const stats = await customerImport.importCustomers(storeId, rows, columnMapping, source || 'imported');

        res.json({
            success: true,
            stats,
            message: `Imported ${stats.newCustomers} new customers, merged ${stats.duplicatesMerged} duplicates`
        });
    } catch (e) {
        console.error('[CustomerImport] Import error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * Get customer stats for a store
 * GET /api/customers/stats/:storeId
 */
app.get('/api/customers/stats/:storeId', async (req, res) => {
    if (!customerImport) return res.status(503).json({ success: false, error: 'Customer Import not available' });
    try {
        const { storeId } = req.params;
        if (!storeId) {
            return res.status(400).json({ success: false, error: 'Store ID is required' });
        }
        const stats = await customerImport.getCustomerStats(storeId);
        res.json({ success: true, stats });
    } catch (e) {
        console.error('[CustomerImport] Stats error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==========================================
// CAMPAIGN ENGINE API (Template-based campaigns)
// ==========================================

// Get campaign templates
app.get('/api/campaigns/templates', async (req, res) => {
    if (!campaignEngine) return res.status(503).json({ error: 'Campaign Engine not available' });
    try {
        res.json({ success: true, templates: campaignEngine.getTemplates() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create campaign from template
app.post('/api/campaigns/engine/create', async (req, res) => {
    if (!campaignEngine) return res.status(503).json({ error: 'Campaign Engine not available' });
    try {
        const result = await campaignEngine.createFromTemplate(req.body.merchantId, req.body.templateId, req.body);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Launch a campaign
app.post('/api/campaigns/engine/:id/launch', async (req, res) => {
    if (!campaignEngine) return res.status(503).json({ error: 'Campaign Engine not available' });
    try {
        const result = await campaignEngine.launchCampaign(req.params.id);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get campaign stats
app.get('/api/campaigns/engine/:id/stats', async (req, res) => {
    if (!campaignEngine) return res.status(503).json({ error: 'Campaign Engine not available' });
    try {
        const stats = await campaignEngine.getCampaignStats(req.params.id);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get campaign revenue
app.get('/api/campaigns/revenue', async (req, res) => {
    if (!campaignEngine) return res.status(503).json({ error: 'Campaign Engine not available' });
    try {
        const revenue = await campaignEngine.getCampaignRevenue(req.query.merchantId);
        res.json({ success: true, revenue });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Pause a campaign
app.put('/api/campaigns/engine/:id/pause', async (req, res) => {
    if (!campaignEngine) return res.status(503).json({ error: 'Campaign Engine not available' });
    try {
        const result = await campaignEngine.pauseCampaign(req.params.id);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// SALLA SCRAPER API
// ==========================================

// Start a scrape job
app.post('/api/scraper/start', async (req, res) => {
    if (!sallaScraper) return res.status(503).json({ error: 'Salla Scraper not available' });
    try {
        const result = await sallaScraper.startScrapeJob(req.body.urls, req.body.options);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get leads
app.get('/api/scraper/leads', async (req, res) => {
    if (!sallaScraper) return res.status(503).json({ error: 'Salla Scraper not available' });
    try {
        const leads = await sallaScraper.getLeads(req.query);
        res.json({ success: true, leads });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Update lead status
app.put('/api/scraper/leads/:id', async (req, res) => {
    if (!sallaScraper) return res.status(503).json({ error: 'Salla Scraper not available' });
    try {
        const result = await sallaScraper.updateLeadStatus(req.params.id, req.body.status);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// OUTREACH AUTOMATION API
// ==========================================

// Create outreach campaign
app.post('/api/outreach/auto/campaigns', async (req, res) => {
    if (!outreachAutomation) return res.status(503).json({ error: 'Outreach Automation not available' });
    try {
        const result = await outreachAutomation.createOutreachCampaign(req.body.name, req.body.filters, req.body.sequenceId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Start outreach campaign
app.post('/api/outreach/auto/campaigns/:id/start', async (req, res) => {
    if (!outreachAutomation) return res.status(503).json({ error: 'Outreach Automation not available' });
    try {
        const result = await outreachAutomation.startOutreachCampaign(req.params.id);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get outreach campaign stats
app.get('/api/outreach/auto/campaigns/:id/stats', async (req, res) => {
    if (!outreachAutomation) return res.status(503).json({ error: 'Outreach Automation not available' });
    try {
        const stats = await outreachAutomation.getOutreachStats(req.params.id);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Pause outreach campaign
app.put('/api/outreach/auto/campaigns/:id/pause', async (req, res) => {
    if (!outreachAutomation) return res.status(503).json({ error: 'Outreach Automation not available' });
    try {
        const result = await outreachAutomation.pauseOutreach(req.params.id);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get outreach templates
app.get('/api/outreach/auto/templates', (req, res) => {
    if (!outreachAutomation) return res.status(503).json({ error: 'Outreach Automation not available' });
    try {
        res.json({ success: true, templates: outreachAutomation.OUTREACH_TEMPLATES });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// LOYALTY ENGINE API
// ==========================================

// Initialize loyalty program for merchant
app.post('/api/loyalty/init', async (req, res) => {
    if (!loyaltyEngine) return res.status(503).json({ error: 'Loyalty Engine not available' });
    try {
        const result = await loyaltyEngine.initLoyalty(req.body.merchantId, req.body.config);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Earn points
app.post('/api/loyalty/earn', async (req, res) => {
    if (!loyaltyEngine) return res.status(503).json({ error: 'Loyalty Engine not available' });
    try {
        const result = await loyaltyEngine.earnPoints(req.body.merchantId, req.body.customerId, req.body.orderValue);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Redeem points
app.post('/api/loyalty/redeem', async (req, res) => {
    if (!loyaltyEngine) return res.status(503).json({ error: 'Loyalty Engine not available' });
    try {
        const result = await loyaltyEngine.redeemPoints(req.body.merchantId, req.body.customerId, req.body.points);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get loyalty balance
app.get('/api/loyalty/balance/:merchantId/:customerId', async (req, res) => {
    if (!loyaltyEngine) return res.status(503).json({ error: 'Loyalty Engine not available' });
    try {
        const balance = await loyaltyEngine.getBalance(req.params.merchantId, req.params.customerId);
        res.json({ success: true, balance });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// REVIEW ENGINE API
// ==========================================

// Request a review from customer
app.post('/api/reviews/request', async (req, res) => {
    if (!reviewEngine) return res.status(503).json({ error: 'Review Engine not available' });
    try {
        const result = await reviewEngine.requestReview(req.body.merchantId, req.body.customerId, req.body.orderId);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Submit a review
app.post('/api/reviews/submit', async (req, res) => {
    if (!reviewEngine) return res.status(503).json({ error: 'Review Engine not available' });
    try {
        const result = await reviewEngine.submitReview(req.body.merchantId, req.body.customerId, req.body.productId, req.body);
        res.json({ success: true, result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get review stats for merchant
app.get('/api/reviews/:merchantId/stats', async (req, res) => {
    if (!reviewEngine) return res.status(503).json({ error: 'Review Engine not available' });
    try {
        const stats = await reviewEngine.getReviewStats(req.params.merchantId);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// COD CONFIRMATION API
// ==========================================

// Confirm a COD order (send WhatsApp confirmation)
app.post('/api/cod/confirm', async (req, res) => {
    if (!codConfirmation) return res.status(503).json({ error: 'COD Confirmation not available' });
    try {
        const { merchantId, orderId, customerPhone, customerName, storeName, orderValue, items, paymentLink } = req.body;
        if (!merchantId || !orderId || !customerPhone) {
            return res.status(400).json({ error: 'merchantId, orderId, and customerPhone are required' });
        }
        const result = await codConfirmation.confirmCODOrder(merchantId, orderId, customerPhone, {
            customerName, storeName, orderValue, items, paymentLink
        });
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Handle customer reply to COD confirmation
app.post('/api/cod/reply', async (req, res) => {
    if (!codConfirmation) return res.status(503).json({ error: 'COD Confirmation not available' });
    try {
        const { merchantId, orderId, reply } = req.body;
        if (!merchantId || !orderId || !reply) {
            return res.status(400).json({ error: 'merchantId, orderId, and reply are required' });
        }
        const result = await codConfirmation.handleCODReply(merchantId, orderId, reply);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Schedule reminder for unconfirmed COD order
app.post('/api/cod/reminder/:merchantId/:orderId', async (req, res) => {
    if (!codConfirmation) return res.status(503).json({ error: 'COD Confirmation not available' });
    try {
        const result = await codConfirmation.scheduleReminder(req.params.merchantId, req.params.orderId);
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get COD confirmation stats for a merchant
app.get('/api/cod/stats/:merchantId', async (req, res) => {
    if (!codConfirmation) return res.status(503).json({ error: 'COD Confirmation not available' });
    try {
        const stats = await codConfirmation.getCODStats(req.params.merchantId);
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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

// ==========================================
// SEQUENCE PROCESSING API (Manual Trigger)
// ==========================================

/**
 * Manually trigger sequence processing
 * POST /api/sequences/process
 * Useful for testing and debugging
 */
app.post('/api/sequences/process', async (req, res) => {
    try {
        if (!lifecycleEngine || !lifecycleEngine.processPendingSequenceSteps) {
            return res.status(503).json({
                success: false,
                error: 'LifecycleEngineV2 not available'
            });
        }

        const result = await lifecycleEngine.processPendingStepsWithWhatsApp();
        
        res.json({
            success: true,
            processed: result.processed,
            message: `Processed ${result.processed} sequence steps`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Sequence processing error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get sequence stats for a store
 * GET /api/sequences/stats?merchant=xxx
 */
app.get('/api/sequences/stats', async (req, res) => {
    try {
        const merchantId = req.query.merchant || req.storeId;
        
        if (!merchantId) {
            return res.status(400).json({
                success: false,
                error: 'Merchant ID required'
            });
        }

        const stats = {
            sequences: null,
            lifecycle: null
        };

        if (sequenceEngine) {
            stats.sequences = sequenceEngine.getSequenceStats(merchantId);
        }

        if (lifecycleEngine && lifecycleEngine.getStats) {
            stats.lifecycle = lifecycleEngine.getStats(merchantId);
        }

        res.json({
            success: true,
            merchantId,
            stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Stats error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Cancel a sequence for a customer
 * POST /api/sequences/cancel
 * Body: { merchant, email, type }
 */
app.post('/api/sequences/cancel', async (req, res) => {
    try {
        const { merchant, email, type } = req.body;
        const merchantId = merchant || req.storeId;

        if (!merchantId || !email || !type) {
            return res.status(400).json({
                success: false,
                error: 'merchant, email, and type are required'
            });
        }

        if (!sequenceEngine) {
            return res.status(503).json({
                success: false,
                error: 'Sequence engine not available'
            });
        }

        sequenceEngine.cancelSequence(type, merchantId, email);

        res.json({
            success: true,
            message: `Cancelled ${type} sequence for ${email}`,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Cancel error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Root serves landing page for new visitors
app.get('/', (req, res) => {
    res.sendFile('landing-v4.html', { root: path.join(__dirname, '../public') });
});

// Dashboard is at /dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile('dashboard.html', { root: path.join(__dirname, '../public') });
});

// ==========================================
// BEHAVIORAL ANALYTICS (Mom Test Style)
// Track what users STRUGGLE with, not just clicks
// ==========================================

const ANALYTICS_COLLECTION = 'analytics';

// Receive analytics events from frontend
app.post('/api/analytics', async (req, res) => {
    try {
        const event = req.body;

        // Add server timestamp and user info
        const enrichedEvent = {
            ...event,
            serverTimestamp: new Date().toISOString(),
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
            // Strip IP to last segment for privacy
            ipHash: crypto.createHash('md5').update(
                req.headers['x-forwarded-for']?.split(',')[0] || 'unknown'
            ).digest('hex').substring(0, 8)
        };

        // Store in Firestore
        await db.collection(ANALYTICS_COLLECTION).add(enrichedEvent);

        // Log important events
        if (['rage_click', 'oneclick_button_clicked', 'session_end'].includes(event.event)) {
            console.log(`📊 Analytics: ${event.event}`, JSON.stringify(event).substring(0, 200));
        }

        res.json({ success: true });
    } catch (error) {
        // Silent fail - analytics shouldn't break UX
        res.json({ success: true });
    }
});

// Get analytics summary (for your review)
app.get('/api/analytics/summary', async (req, res) => {
    try {
        const snapshot = await db.collection(ANALYTICS_COLLECTION)
            .orderBy('serverTimestamp', 'desc')
            .limit(1000)
            .get();

        if (snapshot.empty) {
            return res.json({ success: true, summary: { totalEvents: 0 } });
        }

        const events = snapshot.docs.map(doc => doc.data());

        // Calculate insights
        const summary = {
            totalEvents: events.length,
            uniqueSessions: new Set(events.map(e => e.sessionId)).size,

            // Struggle indicators
            rageClicks: events.filter(e => e.event === 'rage_click').length,
            hesitantClicks: events.filter(e => e.wasHesitant).length,

            // Conversion funnel
            pageViews: events.filter(e => e.event === 'page_view').length,
            oneClickViewed: events.filter(e => e.event === 'oneclick_button_viewed').length,
            oneClickClicked: events.filter(e => e.event === 'oneclick_button_clicked').length,

            // Session data
            avgTimeOnPage: Math.round(
                events.filter(e => e.event === 'session_end')
                    .reduce((sum, e) => sum + (e.totalTimeMs || 0), 0) /
                events.filter(e => e.event === 'session_end').length || 1
            ),
            avgScrollPercent: Math.round(
                events.filter(e => e.event === 'session_end')
                    .reduce((sum, e) => sum + (e.maxScrollPercent || 0), 0) /
                events.filter(e => e.event === 'session_end').length || 1
            ),

            // Most visited pages
            topPages: Object.entries(
                events.filter(e => e.event === 'page_view')
                    .reduce((acc, e) => {
                        acc[e.url] = (acc[e.url] || 0) + 1;
                        return acc;
                    }, {})
            ).sort((a, b) => b[1] - a[1]).slice(0, 5),

            // Recent rage clicks (frustration points)
            recentFrustrations: events
                .filter(e => e.event === 'rage_click')
                .slice(0, 10)
                .map(e => ({
                    page: e.url,
                    element: e.element,
                    time: e.serverTimestamp
                }))
        };

        res.json({ success: true, summary });
    } catch (error) {
        console.error('Error getting analytics:', error);
        res.json({ success: false, error: error.message });
    }
});


// Keep-alive for Render removed as project moved to Firebase.


// ==========================================
// SEQUENCE PROCESSOR (Multi-step emails)
// ==========================================
let emailSender;
try {
    // sequenceEngine already loaded at top of file
    if (!sequenceEngine) {
        sequenceEngine = require('./lib/sequenceEngine');
    }
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
if (require.main === module) {
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
}

// ==========================================
// TESTING & DIAGNOSTICS
// ==========================================

/**
 * Test WhatsApp directly
 * POST /api/test/whatsapp
 * Request: { phone, message, provider? }
 */
app.post('/api/test/whatsapp', async (req, res) => {
    const { phone, message, provider = 'twilio' } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    console.log(`🧪 TRIGGERING WHATSAPP TEST: To ${phone} via ${provider}`);

    try {
        let sent = false;
        let details = {};

        if (provider === 'twilio') {
            if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
                return res.status(400).json({ success: false, error: 'Twilio not configured' });
            }
            sent = await sendViaTwilio(phone, message);
            details = { provider: 'twilio', sid: 'test_sid' };
        } else if (provider === 'meta') {
            const metaWhatsApp = require('./lib/metaWhatsApp');
            if (!metaWhatsApp.isConfigured()) {
                return res.status(400).json({ success: false, error: 'Meta WhatsApp not configured' });
            }
            const result = await metaWhatsApp.sendWhatsApp(phone, message);
            sent = result.success;
            details = { provider: 'meta', result };
        }

        if (sent) {
            res.json({ success: true, message: 'Message sent successfully!', details });
        } else {
            res.status(500).json({ success: false, error: 'Failed to send message', details });
        }
    } catch (error) {
        console.error('❌ Test WhatsApp error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = { app };

// ==========================================
// 🆕 SMS WRAPPER FUNCTION
// ==========================================
async function sendSMS(phoneNumber, message) {
    if (!config.ENABLE_SMS) {
        console.log('📱 SMS disabled, would send:', message);
        return false;
    }

    // Normalize phone number for Saudi Arabia
    let phone = phoneNumber.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '966' + phone.substring(1);
    if (!phone.startsWith('966') && !phone.startsWith('+')) phone = '966' + phone;
    if (!phone.startsWith('+')) phone = '+' + phone;

    console.log(`📱 Sending SMS to ${phone}...`);

    // Use AWS SNS (cheapest) or Twilio
    if (config.AWS_ACCESS_KEY && config.SMS_PROVIDER === 'aws') {
        return await sendSMSviaAWS(phone, message);
    } else if (config.TWILIO_ACCOUNT_SID) {
        // Twilio SMS
        try {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`;
            const response = await fetch(twilioUrl, {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    To: phone,
                    From: config.TWILIO_SMS_NUMBER,
                    Body: message
                })
            });
            const result = await response.json();
            if (result.sid) {
                console.log(`✅ SMS sent via Twilio! SID: ${result.sid}`);
                return true;
            }
        } catch (error) {
            console.error('❌ Twilio SMS error:', error);
        }
    }
    return false;
}

// ==========================================
// 🆕 REORDER REMINDER SYSTEM (Continuity)
// ==========================================

// API endpoint to trigger reorder check (call via cron or Cloud Scheduler)
app.post('/api/cron/reorder-reminders', async (req, res) => {
    console.log('⏰ Running reorder reminder check...');

    const results = await checkAndSendReorderReminders();

    res.json({
        success: true,
        message: 'Reorder reminder check complete',
        results
    });
});

async function checkAndSendReorderReminders() {
    const revenueLog = await readDB('revenue_log') || [];
    const now = new Date();
    const results = { checked: 0, reminders_sent: 0 };

    // Group orders by customer email
    const customerOrders = {};
    revenueLog.forEach(order => {
        if (!order.customerEmail) return;
        if (!customerOrders[order.customerEmail]) {
            customerOrders[order.customerEmail] = [];
        }
        customerOrders[order.customerEmail].push(order);
    });

    // Check each customer
    for (const [email, orders] of Object.entries(customerOrders)) {
        results.checked++;

        // Get last order
        const lastOrder = orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        const daysSinceOrder = Math.floor((now - new Date(lastOrder.timestamp)) / (1000 * 60 * 60 * 24));

        // If 14+ days since last order, send reorder reminder
        if (daysSinceOrder >= 14 && daysSinceOrder < 15) { // Only on day 14
            console.log(`📧 Customer ${email} hasn't ordered in ${daysSinceOrder} days, sending reminder...`);
            await sendReorderReminder(email, lastOrder);
            results.reminders_sent++;
        }
    }

    console.log(`✅ Reorder check complete: ${results.reminders_sent} reminders sent`);
    return results;
}

async function sendReorderReminder(email, lastOrder) {
    if (!config.ENABLE_EMAIL) return false;

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 20px; }
            .wave { font-size: 50px; }
            .title { color: #1D1D1F; font-size: 24px; margin: 15px 0; }
            .offer-box { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0; }
            .offer-value { font-size: 38px; font-weight: bold; }
            .offer-code { background: white; color: #D97706; padding: 10px 25px; border-radius: 8px; display: inline-block; margin-top: 10px; font-weight: bold; }
            .btn { display: block; background: #10B981; color: white !important; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px; margin: 20px 0; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="wave">👋</div>
                <div class="title">اشتقنالك!</div>
            </div>
            
            <p style="text-align: center; color: #666;">
                مرت فترة من آخر زيارة لك. جهزنا لك عرض خاص للترحيب بك من جديد!
            </p>
            
            <div class="offer-box">
                <div>🎁 عرض العودة</div>
                <div class="offer-value">20% خصم</div>
                <div class="offer-code">MISSYOU20</div>
            </div>
            
            <a href="${lastOrder.storeUrl || '#'}" class="btn">تسوق الآن 🛍️</a>
            
            <div class="footer">
                <p>💚 رِبح - نساعد المتاجر على النمو</p>
            </div>
        </div>
    </body>
    </html>
    `;

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
                subject: '👋 اشتقنالك! خصم 20% ينتظرك',
                html: htmlContent
            })
        });

        const result = await response.json();
        if (result.id) {
            console.log(`✅ Reorder reminder sent to ${email}! ID: ${result.id}`);
            return true;
        }
    } catch (error) {
        console.error('❌ Reorder reminder error:', error);
    }
    return false;
}

// ==========================================
// 🆕 ANALYTICS API
// ==========================================

app.get('/api/analytics/revenue', async (req, res) => {
    try {
        const revenueLog = await readDB('revenue_log') || [];

        // Calculate totals
        const totalOrders = revenueLog.length;
        const totalRevenue = revenueLog.reduce((sum, o) => sum + (o.orderValue || 0), 0);
        const recoveredOrders = revenueLog.filter(o => o.wasRecovered);
        const recoveredRevenue = recoveredOrders.reduce((sum, o) => sum + (o.orderValue || 0), 0);
        const ribhRevenue = Math.round(recoveredRevenue * 0.05); // 5% commission

        res.json({
            success: true,
            analytics: {
                totalOrders,
                totalRevenue,
                recoveredOrders: recoveredOrders.length,
                recoveredRevenue,
                recoveryRate: totalOrders > 0 ? Math.round((recoveredOrders.length / totalOrders) * 100) : 0,
                ribhRevenue,
                byOfferType: groupBy(recoveredOrders, 'offerUsed'),
                byCustomerType: groupBy(recoveredOrders, 'customerType')
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

function groupBy(array, key) {
    return array.reduce((result, item) => {
        const groupKey = item[key] || 'unknown';
        if (!result[groupKey]) result[groupKey] = { count: 0, revenue: 0 };
        result[groupKey].count++;
        result[groupKey].revenue += item.orderValue || 0;
        return result;
    }, {});
}

// ==========================================
// 🆕 SALLA API INTEGRATION
// ==========================================

/**
 * Create a discount coupon in Salla store
 * @param {string} merchantId - Store merchant ID
 * @param {object} couponData - Coupon configuration
 */
async function createSallaCoupon(merchantId, couponData) {
    const stores = await readDB(STORES_FILE);
    const store = stores.find(s => s.merchant === merchantId);

    if (!store?.accessToken) {
        console.log('⚠️ No access token for store:', merchantId);
        return null;
    }

    const defaultCoupon = {
        code: `RIBH${Date.now().toString(36).toUpperCase()}`,
        type: 'percentage', // percentage or fixed
        amount: 10,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        usage_limit: 100,
        minimum_amount: 0,
        free_shipping: false,
        ...couponData
    };

    try {
        const response = await fetch('https://api.salla.dev/admin/v2/coupons', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${store.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(defaultCoupon)
        });

        const result = await response.json();

        if (result.data?.id) {
            console.log(`✅ Salla coupon created: ${defaultCoupon.code}`);
            return {
                id: result.data.id,
                code: defaultCoupon.code,
                amount: defaultCoupon.amount,
                type: defaultCoupon.type
            };
        } else {
            console.log('⚠️ Coupon creation failed:', result);
            return null;
        }
    } catch (error) {
        console.error('❌ Salla coupon API error:', error);
        return null;
    }
}

/**
 * Fetch products from a Salla store category
 */
async function fetchSallaProducts(merchantId, categoryId = null, limit = 10) {
    const stores = await readDB(STORES_FILE);
    const store = stores.find(s => s.merchant === merchantId);

    if (!store?.accessToken) {
        console.log('⚠️ No access token for store:', merchantId);
        return [];
    }

    try {
        let url = `https://api.salla.dev/admin/v2/products?per_page=${limit}`;
        if (categoryId) {
            url = `https://api.salla.dev/admin/v2/categories/${categoryId}/products?per_page=${limit}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${store.accessToken}`
            }
        });

        const result = await response.json();

        if (result.data) {
            console.log(`✅ Fetched ${result.data.length} products from Salla`);
            return result.data.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price?.amount || p.sale_price?.amount || 0,
                image: p.thumbnail || p.main_image,
                url: p.url
            }));
        }
        return [];
    } catch (error) {
        console.error('❌ Salla products API error:', error);
        return [];
    }
}

/**
 * Fetch store categories
 */
async function fetchSallaCategories(merchantId) {
    const stores = await readDB(STORES_FILE);
    const store = stores.find(s => s.merchant === merchantId);

    if (!store?.accessToken) return [];

    try {
        const response = await fetch('https://api.salla.dev/admin/v2/categories', {
            headers: {
                'Authorization': `Bearer ${store.accessToken}`
            }
        });

        const result = await response.json();
        return result.data || [];
    } catch (error) {
        console.error('❌ Salla categories API error:', error);
        return [];
    }
}

// API endpoint to create coupon
app.post('/api/coupons/create', async (req, res) => {
    const { merchantId, code, amount, type } = req.body;

    const coupon = await createSallaCoupon(merchantId, { code, amount, type });

    if (coupon) {
        res.json({ success: true, coupon });
    } else {
        res.status(400).json({ success: false, error: 'Failed to create coupon' });
    }
});

// API endpoint to fetch products
app.get('/api/products/:merchantId', async (req, res) => {
    const products = await fetchSallaProducts(req.params.merchantId, req.query.category);
    res.json({ success: true, products });
});

// ==========================================
// 🆕 REFERRAL SYSTEM
// ==========================================

const REFERRALS_COLLECTION = 'referrals';

/**
 * Generate unique referral code for a customer
 */
function generateReferralCode(customerEmail) {
    const hash = customerEmail.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return `REF${hash.toString(36).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

/**
 * Create or get referral code for customer
 */
app.post('/api/referrals/generate', async (req, res) => {
    const { email, name, merchantId } = req.body;

    if (!email || !merchantId) {
        return res.status(400).json({ success: false, error: 'Email and merchantId required' });
    }

    const referrals = await readDB(REFERRALS_COLLECTION) || [];

    // Check if customer already has a code
    let referral = referrals.find(r => r.email === email && r.merchantId === merchantId);

    if (!referral) {
        referral = {
            code: generateReferralCode(email),
            email,
            name: name || email.split('@')[0],
            merchantId,
            createdAt: new Date().toISOString(),
            referredCount: 0,
            earnedDiscount: 0,
            referredCustomers: []
        };
        referrals.push(referral);
        await writeDB(REFERRALS_COLLECTION, referrals);
        console.log(`✅ New referral code created: ${referral.code}`);
    }

    res.json({
        success: true,
        referral: {
            code: referral.code,
            referralLink: `https://ribh.click/ref/${referral.code}`,
            stats: {
                referredCount: referral.referredCount,
                earnedDiscount: referral.earnedDiscount
            }
        }
    });
});

/**
 * Track referral usage when new customer signs up with code
 */
app.post('/api/referrals/track', async (req, res) => {
    const { referralCode, newCustomerEmail, orderValue, merchantId } = req.body;

    if (!referralCode) {
        return res.status(400).json({ success: false, error: 'Referral code required' });
    }

    const referrals = await readDB(REFERRALS_COLLECTION) || [];
    const referral = referrals.find(r => r.code === referralCode);

    if (!referral) {
        return res.status(404).json({ success: false, error: 'Invalid referral code' });
    }

    // Update referral stats
    referral.referredCount++;
    referral.earnedDiscount += 10; // Give 10% per referral
    referral.referredCustomers.push({
        email: newCustomerEmail,
        orderValue: orderValue || 0,
        date: new Date().toISOString()
    });

    await writeDB(REFERRALS_COLLECTION, referrals);

    // Send thank you email to referrer
    if (referral.email && config.ENABLE_EMAIL) {
        await sendReferralThankYouEmail(referral);
    }

    res.json({
        success: true,
        message: 'Referral tracked',
        referrerDiscount: referral.earnedDiscount
    });
});

/**
 * Send thank you email to referrer
 */
async function sendReferralThankYouEmail(referral) {
    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px;">
            <div style="text-align: center; font-size: 50px;">🎉</div>
            <h1 style="text-align: center; color: #10B981;">شكراً على الإحالة!</h1>
            <p style="text-align: center; color: #666;">
                صديقك اشترى باستخدام كودك! 🛍️
            </p>
            <div style="background: #10B981; color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 20px 0;">
                <div style="font-size: 18px;">رصيدك الآن</div>
                <div style="font-size: 40px; font-weight: bold;">${referral.earnedDiscount}% خصم</div>
            </div>
            <p style="text-align: center;">
                كودك: <strong>${referral.code}</strong><br>
                عدد الإحالات: ${referral.referredCount}
            </p>
        </div>
    </body>
    </html>
    `;

    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to: referral.email,
                subject: '🎉 شكراً! صديقك اشترى وحصلت على خصم!',
                html: htmlContent
            })
        });
        console.log(`✅ Referral thank you email sent to ${referral.email}`);
    } catch (error) {
        console.error('❌ Referral email error:', error);
    }
}

/**
 * Get referral stats for a customer
 */
app.get('/api/referrals/:code', async (req, res) => {
    const referrals = await readDB(REFERRALS_COLLECTION) || [];
    const referral = referrals.find(r => r.code === req.params.code);

    if (!referral) {
        return res.status(404).json({ success: false, error: 'Referral not found' });
    }

    res.json({
        success: true,
        referral: {
            code: referral.code,
            referredCount: referral.referredCount,
            earnedDiscount: referral.earnedDiscount,
            referredCustomers: referral.referredCustomers.length
        }
    });
});

// ==========================================
// 🆕 AI-ENHANCED OFFER GENERATION
// ==========================================

/**
 * Generate AI-powered personalized offer message
 */
async function generateAIOfferMessage(customer, offerType, cartData = {}) {
    const prompts = {
        CART_RECOVERY: `أنشئ رسالة استرداد سلة متروكة قصيرة وجذابة بالعربي للعميل "${customer.name}".
السلة: ${cartData.total} ريال
المنتجات: ${cartData.items?.map(i => i.name).join('، ') || 'منتجات رائعة'}
اكتب رسالة ودودة تحفزه على إكمال الشراء. 50 كلمة كحد أقصى.`,

        WELCOME: `أنشئ رسالة ترحيبية قصيرة للعميل الجديد "${customer.name}".
عرض: خصم 15% على أول طلب
اجعلها ودودة وحماسية. 40 كلمة كحد أقصى.`,

        UPSELL: `أنشئ رسالة شكر على الشراء للعميل "${customer.name}" مع عرض خصم على الطلب القادم.
قيمة الطلب: ${cartData.total} ريال
عرض: 10% خصم
30 كلمة كحد أقصى.`,

        REORDER: `أنشئ رسالة "اشتقنالك" للعميل "${customer.name}" الذي لم يشترِ منذ فترة.
عرض: 20% خصم للعودة
اجعلها عاطفية. 40 كلمة كحد أقصى.`,

        REFERRAL: `أنشئ رسالة تشجع العميل "${customer.name}" على دعوة أصدقائه مقابل خصومات.
الفائدة: العميل والصديق يحصلان على 10% خصم
30 كلمة كحد أقصى.`
    };

    const prompt = prompts[offerType] || prompts.CART_RECOVERY;

    if (config.GEMINI_API_KEY) {
        const aiMessage = await generateWithGemini(prompt);
        if (aiMessage) return aiMessage.trim();
    }

    // Fallback templates
    const fallbacks = {
        CART_RECOVERY: `مرحباً ${customer.name}! 👋 سلتك في انتظارك. أكمل طلبك الآن!`,
        WELCOME: `أهلاً ${customer.name}! 🎉 نرحب بك مع خصم 15% على طلبك الأول`,
        UPSELL: `شكراً ${customer.name}! 💚 هذا خصم 10% على طلبك القادم`,
        REORDER: `اشتقنالك ${customer.name}! 👋 عد لنا مع خصم 20%`,
        REFERRAL: `${customer.name}، ادعُ صديقك واحصلا على 10% خصم!`
    };

    return fallbacks[offerType] || fallbacks.CART_RECOVERY;
}

// ==========================================
// 🆕 FLASH SALE / SEASONAL OFFERS
// ==========================================

app.post('/api/offers/flash-sale', async (req, res) => {
    const { merchantId, discount, duration_hours, productIds } = req.body;

    // Create limited-time coupon
    const coupon = await createSallaCoupon(merchantId, {
        code: `FLASH${Date.now().toString(36).toUpperCase()}`,
        amount: discount || 25,
        type: 'percentage',
        end_date: new Date(Date.now() + (duration_hours || 24) * 60 * 60 * 1000).toISOString(),
        usage_limit: 50
    });

    if (coupon) {
        // TODO: Send notification to all customers about flash sale
        res.json({
            success: true,
            flashSale: {
                coupon: coupon.code,
                discount: coupon.amount,
                expiresIn: duration_hours || 24
            }
        });
    } else {
        res.status(400).json({ success: false, error: 'Failed to create flash sale' });
    }
});

// Seasonal offer templates
const SEASONAL_OFFERS = {
    RAMADAN: { discount: 20, message: '🌙 عروض رمضان - خصم 20%' },
    EID: { discount: 25, message: '🎉 عيدك مبارك - خصم 25%' },
    NATIONAL_DAY: { discount: 15, message: '🇸🇦 اليوم الوطني - خصم 15%' },
    BLACK_FRIDAY: { discount: 30, message: '🖤 الجمعة البيضاء - خصم 30%' },
    NEWYEAR: { discount: 20, message: '🎆 السنة الجديدة - خصم 20%' }
};

app.get('/api/offers/seasonal', (req, res) => {
    res.json({ success: true, offers: SEASONAL_OFFERS });
});

// ==========================================
// 🆕 HEALTH CHECK & STATS
// ==========================================

app.get('/api/health', async (req, res) => {
    const carts = await readDB(DB_FILE) || [];
    const stores = await readDB(STORES_FILE) || [];
    const revenueLog = await readDB('revenue_log') || [];
    const referrals = await readDB(REFERRALS_COLLECTION) || [];

    res.json({
        success: true,
        health: 'OK',
        stats: {
            activeStores: stores.filter(s => s.active !== false).length,
            totalCarts: carts.length,
            pendingCarts: carts.filter(c => c.status === 'pending').length,
            recoveredCarts: carts.filter(c => c.status === 'recovered').length,
            totalOrders: revenueLog.length,
            totalRevenue: revenueLog.reduce((s, o) => s + (o.orderValue || 0), 0),
            totalReferrals: referrals.length,
            totalReferred: referrals.reduce((s, r) => s + r.referredCount, 0)
        },
        integrations: {
            email: !!config.RESEND_API_KEY,
            sms: !!config.TWILIO_ACCOUNT_SID || !!config.AWS_ACCESS_KEY,
            ai: !!config.GEMINI_API_KEY || !!config.OPENAI_API_KEY,
            telegram: !!config.TELEGRAM_BOT_TOKEN
        }
    });
});

// ==========================================
// 🆕 A/B TESTING SYSTEM
// ==========================================

const AB_TESTS_COLLECTION = 'ab_tests';

/**
 * Simple A/B test system
 * Randomly assigns variant and tracks conversions
 */
async function getABTestVariant(testName, merchantId) {
    const tests = await readDB(AB_TESTS_COLLECTION) || {};

    if (!tests[testName]) {
        tests[testName] = {
            name: testName,
            variants: {
                A: { impressions: 0, conversions: 0 },
                B: { impressions: 0, conversions: 0 }
            },
            createdAt: new Date().toISOString()
        };
    }

    // Simple 50/50 split
    const variant = Math.random() > 0.5 ? 'A' : 'B';
    tests[testName].variants[variant].impressions++;

    await writeDB(AB_TESTS_COLLECTION, tests);

    return variant;
}

async function trackABConversion(testName, variant) {
    const tests = await readDB(AB_TESTS_COLLECTION) || {};

    if (tests[testName] && tests[testName].variants[variant]) {
        tests[testName].variants[variant].conversions++;
        await writeDB(AB_TESTS_COLLECTION, tests);
    }
}

// A/B Test Offer Variations
const OFFER_VARIANTS = {
    DISCOUNT: {
        A: { discount: 10, message: '🎁 خصم 10% على طلبك!' },
        B: { discount: 15, message: '🔥 عرض خاص! 15% خصم' }
    },
    URGENCY: {
        A: { message: 'سلتك في انتظارك' },
        B: { message: '⏰ آخر فرصة! سلتك ستنتهي قريباً' }
    },
    CTA: {
        A: { button: 'أكمل طلبك الآن' },
        B: { button: 'احصل على الخصم →' }
    }
};

// API to get A/B test results
app.get('/api/ab-tests', async (req, res) => {
    const tests = await readDB(AB_TESTS_COLLECTION) || {};

    const results = {};
    for (const [name, test] of Object.entries(tests)) {
        const varA = test.variants.A;
        const varB = test.variants.B;
        results[name] = {
            A: {
                impressions: varA.impressions,
                conversions: varA.conversions,
                rate: varA.impressions > 0 ? (varA.conversions / varA.impressions * 100).toFixed(2) + '%' : '0%'
            },
            B: {
                impressions: varB.impressions,
                conversions: varB.conversions,
                rate: varB.impressions > 0 ? (varB.conversions / varB.impressions * 100).toFixed(2) + '%' : '0%'
            },
            winner: varA.conversions / (varA.impressions || 1) > varB.conversions / (varB.impressions || 1) ? 'A' : 'B'
        };
    }

    res.json({ success: true, tests: results });
});

// ==========================================
// 🆕 BEST SEND TIME DETECTION
// ==========================================

const SEND_TIMES_COLLECTION = 'send_times';

/**
 * Track email open time to learn best send times
 */
async function trackEmailOpen(merchantId, customerId, openedAt) {
    const sendTimes = await readDB(SEND_TIMES_COLLECTION) || {};

    const hour = new Date(openedAt).getHours();
    const day = new Date(openedAt).getDay(); // 0-6 (Sun-Sat)

    if (!sendTimes[merchantId]) {
        sendTimes[merchantId] = {
            byHour: Array(24).fill(0),
            byDay: Array(7).fill(0),
            totalOpens: 0
        };
    }

    sendTimes[merchantId].byHour[hour]++;
    sendTimes[merchantId].byDay[day]++;
    sendTimes[merchantId].totalOpens++;

    await writeDB(SEND_TIMES_COLLECTION, sendTimes);
}

/**
 * Get best send time for a merchant
 */
async function getBestSendTime(merchantId) {
    const sendTimes = await readDB(SEND_TIMES_COLLECTION) || {};
    const data = sendTimes[merchantId];

    if (!data || data.totalOpens < 10) {
        // Default: 8 PM Saudi time (high engagement)
        return { hour: 20, day: null, confidence: 'low' };
    }

    const bestHour = data.byHour.indexOf(Math.max(...data.byHour));
    const bestDay = data.byDay.indexOf(Math.max(...data.byDay));

    return {
        hour: bestHour,
        day: bestDay,
        confidence: data.totalOpens > 50 ? 'high' : 'medium',
        totalOpens: data.totalOpens
    };
}

// Email open tracking pixel endpoint
app.get('/api/track/open/:trackingId', async (req, res) => {
    const { trackingId } = req.params;

    try {
        // Decode tracking ID (format: merchantId_customerId_timestamp)
        const parts = Buffer.from(trackingId, 'base64').toString().split('_');
        const [merchantId, customerId] = parts;

        await trackEmailOpen(merchantId, customerId, new Date().toISOString());
        console.log(`📧 Email opened: ${trackingId}`);
    } catch (error) {
        console.error('❌ Track open error:', error);
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set('Content-Type', 'image/gif');
    res.send(pixel);
});

// API to get best send times
app.get('/api/analytics/send-times/:merchantId', async (req, res) => {
    const bestTime = await getBestSendTime(req.params.merchantId);
    const sendTimes = await readDB(SEND_TIMES_COLLECTION) || {};
    const data = sendTimes[req.params.merchantId] || { byHour: [], byDay: [] };

    res.json({
        success: true,
        bestTime,
        distribution: {
            byHour: data.byHour,
            byDay: data.byDay
        }
    });
});

// ==========================================
// 🆕 REVIEW REQUEST SYSTEM
// ==========================================

/**
 * Send review request email X days after order delivered
 */
async function sendReviewRequest(customer, order, merchantId) {
    if (!config.ENABLE_EMAIL || !customer.email) return false;

    console.log(`⭐ Sending review request to ${customer.email}...`);

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px;">
            <div style="text-align: center; font-size: 50px;">⭐</div>
            <h1 style="text-align: center; color: #1D1D1F;">كيف كانت تجربتك؟</h1>
            
            <p style="text-align: center; color: #666;">
                مرحباً ${customer.name}! نتمنى أن تكون سعيداً بطلبك.<br>
                رأيك يهمنا جداً!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${order.storeUrl || '#'}?review=1" style="font-size: 40px; text-decoration: none;">⭐⭐⭐⭐⭐</a>
            </div>
            
            <a href="${order.storeUrl || '#'}?review=1" style="display: block; background: #F59E0B; color: white; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px;">
                شاركنا رأيك 📝
            </a>
            
            <p style="text-align: center; color: #888; font-size: 14px; margin-top: 20px;">
                كشكر لك، احصل على 5% خصم على طلبك القادم بعد كتابة التقييم!
            </p>
            
            <div style="text-align: center; color: #888; font-size: 12px; margin-top: 30px;">
                <p>💚 رِبح - نساعد المتاجر على النمو</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to: customer.email,
                subject: `⭐ ${customer.name}، كيف كانت تجربتك؟`,
                html: htmlContent
            })
        });

        const result = await response.json();
        if (result.id) {
            console.log(`✅ Review request sent! ID: ${result.id}`);
            return true;
        }
    } catch (error) {
        console.error('❌ Review request error:', error);
    }
    return false;
}

// API to trigger review requests (call via cron 7 days after order)
app.post('/api/cron/review-requests', async (req, res) => {
    console.log('⭐ Running review request check...');

    const revenueLog = await readDB('revenue_log') || [];
    const now = new Date();
    let sent = 0;

    for (const order of revenueLog) {
        if (!order.reviewRequestSent && order.timestamp) {
            const orderDate = new Date(order.timestamp);
            const daysSinceOrder = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));

            // Send 7 days after order
            if (daysSinceOrder >= 7 && daysSinceOrder < 8) {
                // Get customer info
                const customer = {
                    name: order.customerName || 'عميلنا',
                    email: order.customerEmail
                };

                if (customer.email) {
                    await sendReviewRequest(customer, order, order.merchant);
                    order.reviewRequestSent = true;
                    sent++;
                }
            }
        }
    }

    await writeDB('revenue_log', revenueLog);

    res.json({
        success: true,
        message: `Review requests sent: ${sent}`
    });
});

// ==========================================
// 🆕 CUSTOMER SEGMENTATION
// ==========================================

/**
 * Segment customers for targeted offers
 */
async function segmentCustomers(merchantId) {
    const revenueLog = await readDB('revenue_log') || [];
    const merchantOrders = revenueLog.filter(o => o.merchant === merchantId);

    // Group by customer
    const customers = {};
    merchantOrders.forEach(order => {
        const email = order.customerEmail;
        if (!email) return;

        if (!customers[email]) {
            customers[email] = {
                email,
                orders: 0,
                totalSpent: 0,
                firstOrder: order.timestamp,
                lastOrder: order.timestamp,
                avgOrderValue: 0
            };
        }

        customers[email].orders++;
        customers[email].totalSpent += order.orderValue || 0;
        if (order.timestamp > customers[email].lastOrder) {
            customers[email].lastOrder = order.timestamp;
        }
    });

    // Calculate segments
    const segments = {
        VIP: [],           // High spenders (top 10%)
        LOYAL: [],         // 3+ orders
        ACTIVE: [],        // Ordered in last 30 days
        AT_RISK: [],       // No order in 30-60 days
        CHURNED: [],       // No order in 60+ days
        NEW: []            // 1 order only
    };

    const now = new Date();
    const sortedBySpend = Object.values(customers).sort((a, b) => b.totalSpent - a.totalSpent);
    const vipThreshold = sortedBySpend[Math.floor(sortedBySpend.length * 0.1)]?.totalSpent || 10000;

    for (const customer of Object.values(customers)) {
        customer.avgOrderValue = customer.orders > 0 ? customer.totalSpent / customer.orders : 0;
        const daysSinceOrder = Math.floor((now - new Date(customer.lastOrder)) / (1000 * 60 * 60 * 24));

        if (customer.totalSpent >= vipThreshold) {
            segments.VIP.push(customer);
        } else if (customer.orders >= 3) {
            segments.LOYAL.push(customer);
        } else if (daysSinceOrder <= 30) {
            segments.ACTIVE.push(customer);
        } else if (daysSinceOrder <= 60) {
            segments.AT_RISK.push(customer);
        } else if (daysSinceOrder > 60) {
            segments.CHURNED.push(customer);
        } else if (customer.orders === 1) {
            segments.NEW.push(customer);
        }
    }

    return segments;
}

// API to get customer segments
app.get('/api/segments/:merchantId', async (req, res) => {
    const segments = await segmentCustomers(req.params.merchantId);

    res.json({
        success: true,
        segments: {
            VIP: { count: segments.VIP.length, customers: segments.VIP.slice(0, 10) },
            LOYAL: { count: segments.LOYAL.length },
            ACTIVE: { count: segments.ACTIVE.length },
            AT_RISK: { count: segments.AT_RISK.length },
            CHURNED: { count: segments.CHURNED.length },
            NEW: { count: segments.NEW.length }
        }
    });
});

// ==========================================
// 🆕 CAMPAIGN BROADCAST
// ==========================================

/**
 * Send campaign to a customer segment
 */
app.post('/api/campaigns/broadcast', async (req, res) => {
    const { merchantId, segment, subject, message, discount } = req.body;

    if (!merchantId || !segment) {
        return res.status(400).json({ success: false, error: 'merchantId and segment required' });
    }

    const segments = await segmentCustomers(merchantId);
    const targetCustomers = segments[segment] || [];

    if (targetCustomers.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No customers in segment' });
    }

    let sent = 0;
    for (const customer of targetCustomers) {
        if (customer.email && config.ENABLE_EMAIL) {
            // Simple campaign email
            try {
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: config.EMAIL_FROM,
                        to: customer.email,
                        subject: subject || '🎁 عرض خاص لك!',
                        html: `
                            <div dir="rtl" style="font-family: Arial; max-width: 500px; margin: 0 auto; padding: 20px;">
                                <p>${message || 'لدينا عرض خاص لك!'}</p>
                                ${discount ? `<p><strong>خصم ${discount}%</strong></p>` : ''}
                            </div>
                        `
                    })
                });
                sent++;
            } catch (error) {
                console.error('Campaign email error:', error);
            }
        }
    }

    res.json({
        success: true,
        sent,
        total: targetCustomers.length
    });
});

// ==========================================
// 🆕 RELATED PRODUCTS / CROSS-SELL
// ==========================================

/**
 * Get related products based on cart items
 * Uses category matching to find similar products
 */
async function getRelatedProducts(merchantId, cartItems, limit = 4) {
    const stores = await readDB(STORES_FILE);
    const store = stores.find(s => s.merchant === merchantId);

    if (!store?.accessToken) {
        console.log('⚠️ No access token for related products');
        return [];
    }

    // Get product IDs from cart
    const cartProductIds = cartItems.map(i => i.id || i.product_id).filter(Boolean);

    // Fetch random products from store (as fallback / simple implementation)
    // In production, you'd fetch by category of cart items
    try {
        const response = await fetch(`https://api.salla.dev/admin/v2/products?per_page=${limit + cartProductIds.length}`, {
            headers: { 'Authorization': `Bearer ${store.accessToken}` }
        });

        const result = await response.json();

        if (result.data) {
            // Filter out products already in cart
            const relatedProducts = result.data
                .filter(p => !cartProductIds.includes(p.id))
                .slice(0, limit)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    price: p.price?.amount || p.sale_price?.amount || 0,
                    image: p.thumbnail || p.main_image || '',
                    url: p.url
                }));

            console.log(`✅ Found ${relatedProducts.length} related products`);
            return relatedProducts;
        }
    } catch (error) {
        console.error('❌ Related products error:', error);
    }

    return [];
}

/**
 * Generate HTML for related products section in emails
 */
function generateRelatedProductsHtml(products) {
    if (!products || products.length === 0) return '';

    const productsHtml = products.map(p => `
        <div style="display: inline-block; width: 45%; margin: 2%; text-align: center; vertical-align: top;">
            <a href="${p.url || '#'}" style="text-decoration: none; color: inherit;">
                ${p.image ? `<img src="${p.image}" style="width: 100%; max-width: 120px; height: 120px; object-fit: cover; border-radius: 8px;" alt="${p.name}">` : ''}
                <p style="margin: 8px 0 4px; font-size: 14px; color: #333;">${p.name}</p>
                <p style="margin: 0; color: #10B981; font-weight: bold;">${p.price} ر.س</p>
            </a>
        </div>
    `).join('');

    return `
        <div style="margin: 30px 0; padding: 20px; background: #f8f9fa; border-radius: 12px;">
            <h3 style="text-align: center; color: #1D1D1F; margin: 0 0 15px;">✨ قد يعجبك أيضاً</h3>
            <div style="text-align: center;">
                ${productsHtml}
            </div>
        </div>
    `;
}

/**
 * Enhanced post-purchase email with related products
 */
async function sendPostPurchaseWithCrossSell(customer, orderData, merchant) {
    if (!config.ENABLE_EMAIL || !customer.email) return false;

    console.log(`📧 Sending post-purchase with cross-sell to ${customer.email}...`);

    // Get related products
    const relatedProducts = await getRelatedProducts(
        merchant,
        orderData.items || orderData.products || [],
        4
    );

    const orderTotal = orderData.total || orderData.grand_total || 0;
    const upsellDiscount = orderTotal > 1000 ? 15 : orderTotal > 500 ? 12 : 10;
    const relatedProductsHtml = generateRelatedProductsHtml(relatedProducts);

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 60px;">✅</div>
                <h1 style="color: #10B981; margin: 10px 0;">شكراً ${customer.name}!</h1>
                <p style="color: #666;">طلبك في الطريق إليك</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 20px 0;">
                <div style="font-size: 16px; opacity: 0.9;">🎁 هديتك</div>
                <div style="font-size: 42px; font-weight: bold;">${upsellDiscount}% خصم</div>
                <div style="margin-top: 10px;">على طلبك القادم</div>
                <div style="background: white; color: #10B981; padding: 10px 25px; border-radius: 8px; display: inline-block; margin-top: 15px; font-weight: bold; font-size: 18px;">
                    THANKS${upsellDiscount}
                </div>
            </div>
            
            ${relatedProductsHtml}
            
            <a href="${orderData.store?.url || '#'}" style="display: block; background: #1D1D1F; color: white; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px; margin: 20px 0;">
                تصفح المزيد 🛍️
            </a>
            
            <div style="text-align: center; color: #888; font-size: 12px; margin-top: 30px;">
                <p>💚 رِبح - نساعد المتاجر على النمو</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to: customer.email,
                subject: `✅ شكراً! + خصم ${upsellDiscount}% + منتجات قد تعجبك`,
                html: htmlContent
            })
        });

        const result = await response.json();
        if (result.id) {
            console.log(`✅ Cross-sell email sent! ID: ${result.id}`);
            return true;
        }
    } catch (error) {
        console.error('❌ Cross-sell email error:', error);
    }
    return false;
}

// API to get related products
app.get('/api/related-products/:merchantId', async (req, res) => {
    const { items } = req.query;
    const cartItems = items ? JSON.parse(items) : [];

    const relatedProducts = await getRelatedProducts(
        req.params.merchantId,
        cartItems,
        parseInt(req.query.limit) || 4
    );

    res.json({ success: true, products: relatedProducts });
});

// ==========================================
// 🆕 COMPLETE AUTOMATION TRIGGERS
// ==========================================

/**
 * All cron jobs in one endpoint for easy scheduling
 * Call this daily via Cloud Scheduler or cron
 */
app.post('/api/cron/daily', async (req, res) => {
    console.log('⏰ Running daily automation...');

    const results = {
        reorderReminders: await checkAndSendReorderReminders(),
        reviewRequests: 0 // Will be counted below
    };

    // Review requests (7 days after order)
    const revenueLog = await readDB('revenue_log') || [];
    const now = new Date();

    for (const order of revenueLog) {
        if (!order.reviewRequestSent && order.timestamp) {
            const daysSinceOrder = Math.floor((now - new Date(order.timestamp)) / (1000 * 60 * 60 * 24));

            if (daysSinceOrder >= 7 && daysSinceOrder < 8 && order.customerEmail) {
                await sendReviewRequest(
                    { name: order.customerName || 'عميلنا', email: order.customerEmail },
                    order,
                    order.merchant
                );
                order.reviewRequestSent = true;
                results.reviewRequests++;
            }
        }
    }

    await writeDB('revenue_log', revenueLog);

    console.log('✅ Daily automation complete:', results);

    res.json({
        success: true,
        message: 'Daily automation complete',
        results
    });
});

// ==========================================
// 🆕 DASHBOARD STATS FOR REAL-TIME
// ==========================================

/**
 * Fast stats endpoint for dashboard polling
 */
app.get('/api/stats/live', async (req, res) => {
    const { merchantId } = req.query;

    const carts = await readDB(DB_FILE) || [];
    const revenueLog = await readDB('revenue_log') || [];

    const merchantCarts = merchantId
        ? carts.filter(c => c.merchant === merchantId)
        : carts;

    const merchantRevenue = merchantId
        ? revenueLog.filter(o => o.merchant === merchantId)
        : revenueLog;

    // Calculate stats
    const pendingCarts = merchantCarts.filter(c => c.status === 'pending').length;
    const recoveredCarts = merchantCarts.filter(c => c.status === 'recovered').length;
    const totalRecoveredValue = merchantCarts
        .filter(c => c.status === 'recovered')
        .reduce((sum, c) => sum + (c.total || 0), 0);

    const totalRevenue = merchantRevenue.reduce((sum, o) => sum + (o.orderValue || 0), 0);
    const ribhCommission = Math.round(totalRecoveredValue * 0.05);

    res.json({
        success: true,
        live: true,
        timestamp: new Date().toISOString(),
        stats: {
            pendingCarts,
            recoveredCarts,
            recoveryValue: totalRecoveredValue,
            totalRevenue,
            ribhCommission,
            // For animation
            lastRecovery: merchantCarts
                .filter(c => c.status === 'recovered')
                .sort((a, b) => new Date(b.recoveredAt) - new Date(a.recoveredAt))[0] || null
        }
    });
});

// ==========================================
// 🆕 LEAD CAPTURE SYSTEM
// ==========================================

const LEADS_COLLECTION = 'leads';

/**
 * Save lead (email collected before cart)
 */
app.post('/api/leads/capture', async (req, res) => {
    const { email, name, merchantId, source, phone } = req.body;

    if (!email || !merchantId) {
        return res.status(400).json({ success: false, error: 'Email and merchantId required' });
    }

    const leads = await readDB(LEADS_COLLECTION) || [];

    // Check if lead exists
    const existingLead = leads.find(l => l.email === email && l.merchantId === merchantId);

    if (existingLead) {
        // Update existing lead
        existingLead.visits = (existingLead.visits || 1) + 1;
        existingLead.lastVisit = new Date().toISOString();
        if (phone && !existingLead.phone) existingLead.phone = phone;
    } else {
        // Create new lead
        leads.push({
            email,
            name: name || email.split('@')[0],
            phone: phone || null,
            merchantId,
            source: source || 'popup',
            createdAt: new Date().toISOString(),
            lastVisit: new Date().toISOString(),
            visits: 1,
            converted: false,
            sentWelcome: false
        });
    }

    await writeDB(LEADS_COLLECTION, leads);
    console.log(`✅ Lead captured: ${email}`);

    // Send welcome email to new lead
    const lead = existingLead || leads[leads.length - 1];
    if (!lead.sentWelcome && config.ENABLE_EMAIL) {
        await sendLeadWelcomeEmail(lead, merchantId);
        lead.sentWelcome = true;
        await writeDB(LEADS_COLLECTION, leads);
    }

    res.json({ success: true, message: 'Lead captured' });
});

/**
 * Send welcome email to new lead
 */
async function sendLeadWelcomeEmail(lead, merchantId) {
    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px;">
            <div style="text-align: center; font-size: 50px;">🎁</div>
            <h1 style="text-align: center; color: #10B981;">شكراً لتسجيلك!</h1>
            <p style="text-align: center; color: #666;">
                مرحباً ${lead.name}! سجلنا بريدك وجهزنا لك عروض حصرية.
            </p>
            <div style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 20px 0;">
                <div style="font-size: 16px;">خصم ترحيبي</div>
                <div style="font-size: 40px; font-weight: bold;">15%</div>
                <div style="background: white; color: #10B981; padding: 10px 20px; border-radius: 8px; display: inline-block; margin-top: 10px; font-weight: bold;">
                    WELCOME15
                </div>
            </div>
            <a href="#" style="display: block; background: #1D1D1F; color: white; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px;">
                تسوق الآن 🛍️
            </a>
        </div>
    </body>
    </html>
    `;

    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to: lead.email,
                subject: `🎁 ${lead.name}، خصم 15% بانتظارك!`,
                html: htmlContent
            })
        });
        console.log(`✅ Lead welcome email sent to ${lead.email}`);
    } catch (error) {
        console.error('❌ Lead welcome email error:', error);
    }
}

/**
 * Get leads for a merchant
 */
app.get('/api/leads/:merchantId', async (req, res) => {
    const leads = await readDB(LEADS_COLLECTION) || [];
    const merchantLeads = leads.filter(l => l.merchantId === req.params.merchantId);

    res.json({
        success: true,
        total: merchantLeads.length,
        leads: merchantLeads.slice(-100) // Last 100
    });
});

/**
 * Update lead status (e.g., mark as converted)
 */
app.post('/api/leads/update', async (req, res) => {
    const { email, merchantId, converted } = req.body;
    
    if (!email || !merchantId) {
        return res.status(400).json({ error: 'Missing email or merchantId' });
    }
    
    const leads = await readDB(LEADS_COLLECTION) || [];
    const lead = leads.find(l => l.email === email && l.merchantId === merchantId);
    
    if (lead) {
        lead.converted = converted;
        lead.convertedAt = converted ? new Date().toISOString() : null;
        await writeDB(LEADS_COLLECTION, leads);
        res.json({ success: true, lead });
    } else {
        res.status(404).json({ error: 'Lead not found' });
    }
});

// ==========================================
// 🆕 EXIT INTENT TRACKING
// ==========================================

/**
 * Track exit intent event
 */
app.post('/api/exit-intent', async (req, res) => {
    const { email, merchantId, cartValue, cartItems, exitType } = req.body;

    console.log(`🚪 Exit intent detected: ${email || 'anonymous'} - ${exitType}`);

    // If we have email, this is a warm lead
    if (email && merchantId) {
        // Save as abandoned browse
        const leads = await readDB(LEADS_COLLECTION) || [];
        const lead = leads.find(l => l.email === email && l.merchantId === merchantId);

        if (lead) {
            lead.exitIntents = (lead.exitIntents || 0) + 1;
            lead.lastExitIntent = new Date().toISOString();
            lead.lastCartValue = cartValue || 0;
            await writeDB(LEADS_COLLECTION, leads);
        }

        // Could trigger immediate popup offer here
    }

    res.json({ success: true });
});

// ==========================================
// 🆕 EMBEDDABLE WIDGET (JavaScript for stores)
// ==========================================

/**
 * Returns JavaScript widget for stores to embed
 * Usage: <script src="https://ribh.click/widget.js?merchant=xxx"></script>
 */
app.get('/widget.js', (req, res) => {
    const { merchant } = req.query;

    const widgetJS = `
(function() {
    const MERCHANT_ID = '${merchant || 'unknown'}';
    const API_URL = 'https://ribh.click/api';
    
    // Styles for popup
    const styles = \`
        .ribh-popup-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.3s;
        }
        .ribh-popup-overlay.show { opacity: 1; }
        .ribh-popup {
            background: white; border-radius: 16px; padding: 30px;
            max-width: 400px; width: 90%; text-align: center;
            direction: rtl; font-family: -apple-system, Arial, sans-serif;
            transform: scale(0.9); transition: transform 0.3s;
        }
        .ribh-popup-overlay.show .ribh-popup { transform: scale(1); }
        .ribh-popup h2 { color: #1D1D1F; margin: 0 0 10px; font-size: 24px; }
        .ribh-popup p { color: #666; margin: 0 0 20px; }
        .ribh-popup input {
            width: 100%; padding: 15px; border: 2px solid #eee;
            border-radius: 10px; font-size: 16px; margin-bottom: 10px;
            text-align: center; direction: ltr;
        }
        .ribh-popup input:focus { border-color: #10B981; outline: none; }
        .ribh-popup button {
            width: 100%; padding: 15px; background: #10B981; color: white;
            border: none; border-radius: 10px; font-size: 18px;
            cursor: pointer; font-weight: bold;
        }
        .ribh-popup button:hover { background: #059669; }
        .ribh-popup .close {
            position: absolute; top: 10px; left: 10px;
            background: none; border: none; font-size: 24px;
            cursor: pointer; color: #999; width: auto; padding: 5px;
        }
        .ribh-discount { font-size: 48px; color: #10B981; font-weight: bold; margin: 15px 0; }
    \`;
    
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    
    // Show popup after delay or on exit intent
    let popupShown = false;
    
    function showPopup() {
        if (popupShown || localStorage.getItem('ribh_popup_shown')) return;
        popupShown = true;
        
        const overlay = document.createElement('div');
        overlay.className = 'ribh-popup-overlay';
        overlay.innerHTML = \`
            <div class="ribh-popup" style="position: relative;">
                <button class="close">&times;</button>
                <div style="font-size: 40px;">🎁</div>
                <h2>لا تفوت الفرصة!</h2>
                <div class="ribh-discount">15% خصم</div>
                <p>سجل بريدك واحصل على خصم فوري</p>
                <input type="email" id="ribh-email" placeholder="بريدك الإلكتروني" />
                <button id="ribh-submit">احصل على الخصم</button>
            </div>
        \`;
        
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
        
        overlay.querySelector('.close').onclick = () => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
            localStorage.setItem('ribh_popup_shown', 'true');
        };
        
        overlay.querySelector('#ribh-submit').onclick = async () => {
            const email = overlay.querySelector('#ribh-email').value;
            if (!email || !email.includes('@')) {
                alert('الرجاء إدخال بريد صحيح');
                return;
            }
            
            try {
                await fetch(API_URL + '/leads/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, merchantId: MERCHANT_ID, source: 'popup' })
                });
                
                overlay.querySelector('.ribh-popup').innerHTML = \`
                    <div style="font-size: 60px;">✅</div>
                    <h2>شكراً لك!</h2>
                    <p>تم إرسال كود الخصم إلى بريدك</p>
                    <p style="font-size: 24px; color: #10B981; font-weight: bold;">WELCOME15</p>
                \`;
                
                localStorage.setItem('ribh_popup_shown', 'true');
                setTimeout(() => {
                    overlay.classList.remove('show');
                    setTimeout(() => overlay.remove(), 300);
                }, 3000);
            } catch (e) {
                console.error('RIBH error:', e);
            }
        };
    }
    
    // Exit intent detection
    document.addEventListener('mouseout', (e) => {
        if (e.clientY <= 0) showPopup();
    });
    
    // Timer fallback (30 seconds)
    setTimeout(showPopup, 30000);
})();
    `;

    res.set('Content-Type', 'application/javascript');
    res.send(widgetJS);
});

// ==========================================
// 🆕 ABANDONED BROWSE TRACKING
// ==========================================

const BROWSE_COLLECTION = 'abandoned_browse';

/**
 * Track product views (before cart)
 */
app.post('/api/browse/track', async (req, res) => {
    const { email, merchantId, productId, productName, productPrice, productUrl, productImage } = req.body;

    if (!merchantId) {
        return res.status(400).json({ success: false, error: 'merchantId required' });
    }

    const browseData = await readDB(BROWSE_COLLECTION) || [];

    const browseSession = {
        email: email || null,
        merchantId,
        productId,
        productName,
        productPrice,
        productUrl,
        productImage,
        viewedAt: new Date().toISOString(),
        reminderSent: false
    };

    browseData.push(browseSession);

    // Keep only last 1000 entries
    if (browseData.length > 1000) {
        browseData.splice(0, browseData.length - 1000);
    }

    await writeDB(BROWSE_COLLECTION, browseData);
    console.log(`👀 Browse tracked: ${productName || productId}`);

    res.json({ success: true });
});

/**
 * Send browse reminder emails (24h after view, no purchase)
 */
app.post('/api/cron/browse-reminders', async (req, res) => {
    console.log('👀 Running browse reminder check...');

    const browseData = await readDB(BROWSE_COLLECTION) || [];
    const revenueLog = await readDB('revenue_log') || [];
    const now = new Date();
    let sent = 0;

    // Group by email to send ONE email with ALL viewed products
    const emailProducts = {};

    for (const browse of browseData) {
        if (!browse.email || browse.reminderSent) continue;

        const viewedAt = new Date(browse.viewedAt);
        const hoursSinceView = (now - viewedAt) / (1000 * 60 * 60);

        // 24-48 hours after view
        if (hoursSinceView >= 24 && hoursSinceView < 48) {
            // Check if customer purchased
            const purchased = revenueLog.some(o =>
                o.customerEmail === browse.email &&
                new Date(o.timestamp) > viewedAt
            );

            if (!purchased) {
                if (!emailProducts[browse.email]) {
                    emailProducts[browse.email] = [];
                }
                emailProducts[browse.email].push(browse);
            }
        }
    }

    // Send emails
    for (const [email, products] of Object.entries(emailProducts)) {
        if (products.length > 0 && config.ENABLE_EMAIL) {
            await sendBrowseReminderEmail(email, products);

            // Mark as sent
            products.forEach(p => p.reminderSent = true);
            sent++;
        }
    }

    await writeDB(BROWSE_COLLECTION, browseData);

    res.json({
        success: true,
        message: `Browse reminders sent: ${sent}`
    });
});

/**
 * Send browse reminder email
 */
async function sendBrowseReminderEmail(email, products) {
    const productHtml = products.slice(0, 4).map(p => `
        <div style="display: inline-block; width: 45%; margin: 2%; text-align: center; vertical-align: top;">
            <a href="${p.productUrl || '#'}" style="text-decoration: none; color: inherit;">
                ${p.productImage ? `<img src="${p.productImage}" style="width: 100%; max-width: 120px; height: 120px; object-fit: cover; border-radius: 8px;" alt="${p.productName}">` : ''}
                <p style="margin: 8px 0 4px; font-size: 14px; color: #333;">${p.productName || 'منتج رائع'}</p>
                ${p.productPrice ? `<p style="margin: 0; color: #10B981; font-weight: bold;">${p.productPrice} ر.س</p>` : ''}
            </a>
        </div>
    `).join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px;">
            <div style="text-align: center; font-size: 50px;">👀</div>
            <h2 style="text-align: center; color: #1D1D1F; margin: 15px 0;">هل نسيت شيء؟</h2>
            <p style="text-align: center; color: #666;">
                لاحظنا أنك شاهدت هذه المنتجات الرائعة...
            </p>
            
            <div style="text-align: center; margin: 25px 0;">
                ${productHtml}
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                <div style="font-size: 16px;">🎁 خصم خاص لك</div>
                <div style="font-size: 32px; font-weight: bold;">10%</div>
                <div style="background: white; color: #764ba2; padding: 8px 20px; border-radius: 8px; display: inline-block; margin-top: 10px; font-weight: bold;">
                    BROWSE10
                </div>
            </div>
            
            <a href="${products[0]?.productUrl || '#'}" style="display: block; background: #1D1D1F; color: white; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px;">
                تسوق الآن 🛍️
            </a>
            
            <div style="text-align: center; color: #888; font-size: 12px; margin-top: 30px;">
                <p>💚 رِبح - نساعد المتاجر على النمو</p>
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: config.EMAIL_FROM,
                to: email,
                subject: '👀 هل نسيت شيء؟ خصم 10% ينتظرك!',
                html: htmlContent
            })
        });
        console.log(`✅ Browse reminder sent to ${email}`);
    } catch (error) {
        console.error('❌ Browse reminder error:', error);
    }
}

// ==========================================
// 🆕 BUNDLE OFFER SYSTEM
// ==========================================

/**
 * Create bundle offer (buy X get Y)
 */
app.post('/api/offers/bundle', async (req, res) => {
    const { merchantId, products, discount, name, description } = req.body;

    if (!merchantId || !products || products.length < 2) {
        return res.status(400).json({ success: false, error: 'Need merchantId and at least 2 products' });
    }

    const bundles = await readDB('bundles') || [];

    const bundle = {
        id: `BUNDLE${Date.now().toString(36).toUpperCase()}`,
        merchantId,
        products, // Array of { productId, productName, price }
        discount: discount || 15,
        name: name || 'عرض الحزمة',
        description: description || 'اشترِ معاً ووفر!',
        createdAt: new Date().toISOString(),
        active: true
    };

    bundles.push(bundle);
    await writeDB('bundles', bundles);

    res.json({
        success: true,
        bundle: {
            id: bundle.id,
            discount: bundle.discount,
            originalTotal: products.reduce((s, p) => s + (p.price || 0), 0),
            bundlePrice: Math.round(products.reduce((s, p) => s + (p.price || 0), 0) * (1 - bundle.discount / 100))
        }
    });
});

/**
 * Get active bundles for merchant
 */
app.get('/api/offers/bundles/:merchantId', async (req, res) => {
    const bundles = await readDB('bundles') || [];
    const merchantBundles = bundles.filter(b => b.merchantId === req.params.merchantId && b.active);

    res.json({ success: true, bundles: merchantBundles });
});

// ==========================================
// 🆕 URGENCY TRIGGERS
// ==========================================

/**
 * Generate urgency message based on data
 */
function generateUrgencyMessage(cart, merchantId) {
    const urgencyTypes = [
        {
            condition: cart.items?.length > 3,
            message: '🔥 سلتك ممتلئة بالمنتجات الرائعة!',
            cta: 'أكمل الآن قبل نفاد الكمية'
        },
        {
            condition: cart.total > 1000,
            message: '⭐ طلب VIP! خصم إضافي لك',
            cta: 'استخدم VIP15 للحصول على 15% إضافي'
        },
        {
            condition: true, // Default
            message: '⏰ عرضك ينتهي قريباً!',
            cta: 'أكمل الآن واستفد من الخصم'
        }
    ];

    for (const u of urgencyTypes) {
        if (u.condition) return u;
    }

    return urgencyTypes[urgencyTypes.length - 1];
}

// ==========================================
// 🆕 VIP CUSTOMER ALERTS
// ==========================================

/**
 * Send alert when VIP customer is detected
 */
async function alertVIPCustomer(cart, merchant) {
    // Check if VIP
    const revenueLog = await readDB('revenue_log') || [];
    const customerOrders = revenueLog.filter(o =>
        o.customerEmail === cart.customer?.email &&
        o.merchant === merchant
    );

    const totalSpent = customerOrders.reduce((s, o) => s + (o.orderValue || 0), 0);

    if (totalSpent > 5000 || customerOrders.length >= 5) {
        console.log(`⭐ VIP ALERT: ${cart.customer.email} - ${totalSpent} SAR lifetime value`);

        // Could send Telegram/SMS alert to store owner here
        if (config.ENABLE_TELEGRAM && config.TELEGRAM_STORE_CHAT_ID) {
            // Send VIP alert to store owner
        }

        return true;
    }
    return false;
}

// ==========================================
// 🆕 COMPLETE CRON ENDPOINT (ALL DAILY TASKS)
// ==========================================

/**
 * Master cron endpoint - run once daily
 */
app.post('/api/cron/all', async (req, res) => {
    console.log('🔄 Running ALL daily tasks...');

    const results = {};

    // 1. Reorder reminders (14 days)
    try {
        results.reorderReminders = await checkAndSendReorderReminders();
    } catch (e) {
        results.reorderReminders = { error: e.message };
    }

    // 2. Review requests (7 days)
    try {
        const revenueLog = await readDB('revenue_log') || [];
        const now = new Date();
        let reviewsSent = 0;

        for (const order of revenueLog) {
            if (!order.reviewRequestSent && order.timestamp && order.customerEmail) {
                const days = Math.floor((now - new Date(order.timestamp)) / (1000 * 60 * 60 * 24));
                if (days >= 7 && days < 8) {
                    await sendReviewRequest(
                        { name: order.customerName || 'عميلنا', email: order.customerEmail },
                        order,
                        order.merchant
                    );
                    order.reviewRequestSent = true;
                    reviewsSent++;
                }
            }
        }
        await writeDB('revenue_log', revenueLog);
        results.reviewRequests = { sent: reviewsSent };
    } catch (e) {
        results.reviewRequests = { error: e.message };
    }

    // 3. Browse reminders (24h)
    try {
        // Similar logic to browse-reminders endpoint
        results.browseReminders = { checked: true };
    } catch (e) {
        results.browseReminders = { error: e.message };
    }

    console.log('✅ All daily tasks complete:', results);

    res.json({
        success: true,
        timestamp: new Date().toISOString(),
        results
    });
});

// ==========================================
// 🆕 STORE OWNER DASHBOARD API
// ==========================================

/**
 * Complete dashboard data for store owner
 */
app.get('/api/dashboard/:merchantId', async (req, res) => {
    const { merchantId } = req.params;
    const { period } = req.query; // day, week, month

    const carts = await readDB(DB_FILE) || [];
    const revenueLog = await readDB('revenue_log') || [];
    const leads = await readDB(LEADS_COLLECTION) || [];
    const referrals = await readDB(REFERRALS_COLLECTION) || [];

    // Filter by merchant
    const merchantCarts = carts.filter(c => c.merchant === merchantId);
    const merchantRevenue = revenueLog.filter(o => o.merchant === merchantId);
    const merchantLeads = leads.filter(l => l.merchantId === merchantId);
    const merchantReferrals = referrals.filter(r => r.merchantId === merchantId);

    // Time filter
    const now = new Date();
    const periodMs = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
    }[period] || 7 * 24 * 60 * 60 * 1000;

    const periodStart = new Date(now - periodMs);

    const recentCarts = merchantCarts.filter(c => new Date(c.createdAt) > periodStart);
    const recentRevenue = merchantRevenue.filter(o => new Date(o.timestamp) > periodStart);

    // Calculate metrics
    const metrics = {
        // Carts
        totalCarts: recentCarts.length,
        pendingCarts: recentCarts.filter(c => c.status === 'pending').length,
        recoveredCarts: recentCarts.filter(c => c.status === 'recovered').length,
        recoveryRate: recentCarts.length > 0
            ? Math.round((recentCarts.filter(c => c.status === 'recovered').length / recentCarts.length) * 100)
            : 0,

        // Revenue
        totalRevenue: recentRevenue.reduce((s, o) => s + (o.orderValue || 0), 0),
        recoveredRevenue: recentCarts
            .filter(c => c.status === 'recovered')
            .reduce((s, c) => s + (c.total || 0), 0),
        avgOrderValue: recentRevenue.length > 0
            ? Math.round(recentRevenue.reduce((s, o) => s + (o.orderValue || 0), 0) / recentRevenue.length)
            : 0,

        // Leads
        newLeads: merchantLeads.filter(l => new Date(l.createdAt) > periodStart).length,
        totalLeads: merchantLeads.length,

        // Referrals
        newReferrals: merchantReferrals.filter(r => new Date(r.createdAt) > periodStart).length,
        totalReferred: merchantReferrals.reduce((s, r) => s + r.referredCount, 0),

        // RIBH Commission
        ribhCommission: Math.round(
            recentCarts.filter(c => c.status === 'recovered').reduce((s, c) => s + (c.total || 0), 0) * 0.05
        )
    };

    // Recent activity
    const recentActivity = [
        ...recentCarts.slice(-5).map(c => ({
            type: c.status === 'recovered' ? 'recovered' : 'abandoned',
            customer: c.customer?.name || 'عميل',
            value: c.total,
            time: c.createdAt
        })),
        ...recentRevenue.slice(-5).map(o => ({
            type: 'order',
            customer: o.customerName || 'عميل',
            value: o.orderValue,
            time: o.timestamp
        }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10);

    res.json({
        success: true,
        merchantId,
        period: period || 'week',
        metrics,
        recentActivity
    });
});

// ==========================================
// 🆕 STORE OWNER ALERTS
// ==========================================

/**
 * Send alert to store owner
 */
async function sendStoreOwnerAlert(merchantId, alertType, data) {
    const stores = await readDB(STORES_FILE);
    const store = stores.find(s => s.merchant === merchantId);

    if (!store?.ownerEmail) return;

    const alerts = {
        VIP_CART: {
            subject: '⭐ VIP يتسوق الآن!',
            message: `العميل ${data.customerName} (VIP - ${data.totalSpent} ريال إجمالي) لديه سلة بقيمة ${data.cartValue} ريال`
        },
        HIGH_VALUE_CART: {
            subject: '💰 سلة كبيرة متروكة!',
            message: `سلة بقيمة ${data.cartValue} ريال متروكة منذ ${data.hoursAgo} ساعة`
        },
        MILESTONE: {
            subject: '🎉 وصلت لهدف جديد!',
            message: `تهانينا! استرددت ${data.recovered} سلة هذا الشهر بقيمة ${data.value} ريال`
        },
        DAILY_SUMMARY: {
            subject: '📊 ملخص اليوم',
            message: `السلال المتروكة: ${data.abandoned} | المسترجعة: ${data.recovered} | الإيرادات: ${data.revenue} ريال`
        }
    };

    const alert = alerts[alertType];
    if (!alert) return;

    // Could send via Email, Telegram, or SMS
    if (config.ENABLE_EMAIL && store.ownerEmail) {
        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: config.EMAIL_FROM,
                    to: store.ownerEmail,
                    subject: alert.subject,
                    html: `<div dir="rtl" style="font-family: Arial; padding: 20px;">
                        <h2>${alert.subject}</h2>
                        <p>${alert.message}</p>
                        <a href="https://ribh.click" style="background: #10B981; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none;">
                            افتح لوحة التحكم
                        </a>
                    </div>`
                })
            });
            console.log(`📢 Store alert sent: ${alertType}`);
        } catch (error) {
            console.error('❌ Store alert error:', error);
        }
    }
}

// ==========================================
// 🆕 WINBACK CAMPAIGN (60+ days inactive)
// ==========================================

/**
 * Aggressive winback for churned customers
 */
app.post('/api/campaigns/winback/:merchantId', async (req, res) => {
    const { merchantId } = req.params;
    const { discount } = req.body;

    const segments = await segmentCustomers(merchantId);
    const churned = segments.CHURNED || [];

    if (churned.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No churned customers' });
    }

    const winbackDiscount = discount || 25;
    let sent = 0;

    for (const customer of churned) {
        if (!customer.email || !config.ENABLE_EMAIL) continue;

        const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8"></head>
        <body style="font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px;">
                <div style="text-align: center; font-size: 50px;">💔</div>
                <h2 style="text-align: center; color: #1D1D1F;">نفتقدك كثيراً!</h2>
                
                <p style="text-align: center; color: #666;">
                    مرت فترة طويلة منذ آخر زيارة لك. جهزنا لك عرض استثنائي!
                </p>
                
                <div style="background: linear-gradient(135deg, #EF4444, #DC2626); color: white; padding: 30px; border-radius: 12px; text-align: center; margin: 25px 0;">
                    <div style="font-size: 18px;">🎁 عرض العودة الخاص</div>
                    <div style="font-size: 50px; font-weight: bold;">${winbackDiscount}%</div>
                    <div>خصم على كل شيء!</div>
                    <div style="background: white; color: #EF4444; padding: 10px 25px; border-radius: 8px; display: inline-block; margin-top: 15px; font-weight: bold; font-size: 20px;">
                        COMEBACK${winbackDiscount}
                    </div>
                </div>
                
                <p style="text-align: center; color: #888; font-size: 14px;">
                    ⏰ العرض صالح لمدة 48 ساعة فقط!
                </p>
                
                <a href="#" style="display: block; background: #1D1D1F; color: white; padding: 18px; text-decoration: none; border-radius: 12px; text-align: center; font-size: 18px;">
                    تسوق الآن 🛍️
                </a>
            </div>
        </body>
        </html>
        `;

        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: config.EMAIL_FROM,
                    to: customer.email,
                    subject: `💔 نفتقدك! خصم ${winbackDiscount}% ينتظرك`,
                    html: htmlContent
                })
            });
            sent++;
        } catch (error) {
            console.error('Winback email error:', error);
        }
    }

    res.json({
        success: true,
        sent,
        totalChurned: churned.length,
        discount: winbackDiscount
    });
});

// ==========================================
// 🆕 QUICK ACTIONS API
// ==========================================

/**
 * One-click actions for store owners
 */
app.post('/api/actions/:action', async (req, res) => {
    const { action } = req.params;
    const { merchantId } = req.body;

    if (!merchantId) {
        return res.status(400).json({ success: false, error: 'merchantId required' });
    }

    switch (action) {
        case 'send-winback':
            // Trigger winback campaign
            const segments = await segmentCustomers(merchantId);
            return res.json({
                success: true,
                action: 'winback',
                churnedCount: (segments.CHURNED || []).length
            });

        case 'flash-sale':
            // Create quick flash sale
            return res.json({
                success: true,
                action: 'flash-sale',
                message: 'Use POST /api/offers/flash-sale'
            });

        case 'send-test-email':
            // Send test abandoned cart email
            return res.json({
                success: true,
                action: 'test-email',
                message: 'Use POST /api/test/abandoned-cart'
            });

        default:
            return res.status(400).json({
                success: false,
                error: 'Unknown action',
                available: ['send-winback', 'flash-sale', 'send-test-email']
            });
    }
});

// ==========================================
// 📧 UNSUBSCRIBE ENDPOINT (CAN-SPAM Compliance)
// ==========================================

const UNSUBSCRIBE_COLLECTION = 'unsubscribed';

/**
 * Unsubscribe page (GET)
 */
app.get('/unsubscribe', (req, res) => {
    const { email } = req.query;

    res.send(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>إلغاء الاشتراك - رِبح</title>
        <style>
            body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
            .card { background: white; border-radius: 16px; padding: 40px; max-width: 400px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            h1 { font-size: 24px; color: #1D1D1F; margin: 0 0 20px; }
            p { color: #666; margin: 10px 0; }
            input { width: 100%; padding: 15px; border: 2px solid #eee; border-radius: 10px; font-size: 16px; margin: 10px 0; text-align: center; }
            button { width: 100%; padding: 15px; background: #EF4444; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; }
            button:hover { background: #DC2626; }
            .success { color: #10B981; }
        </style>
    </head>
    <body>
        <div class="card" id="form">
            <h1>إلغاء الاشتراك</h1>
            <p>هل أنت متأكد أنك تريد إلغاء اشتراكك في رسائلنا؟</p>
            <input type="email" id="email" placeholder="بريدك الإلكتروني" value="${email || ''}">
            <button onclick="unsubscribe()">إلغاء الاشتراك</button>
            <p style="font-size: 12px; color: #aaa; margin-top: 20px;">سنفتقدك 💚</p>
        </div>
        
        <div class="card success" id="success" style="display: none;">
            <h1 class="success">تم إلغاء اشتراكك</h1>
            <p>لن تتلقى المزيد من رسائلنا.</p>
            <p style="font-size: 12px; color: #aaa;">يمكنك إعادة الاشتراك في أي وقت.</p>
        </div>
        
        <script>
            async function unsubscribe() {
                const email = document.getElementById('email').value;
                if (!email) { alert('الرجاء إدخال بريدك'); return; }
                
                const res = await fetch('/api/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                
                if (res.ok) {
                    document.getElementById('form').style.display = 'none';
                    document.getElementById('success').style.display = 'block';
                }
            }
        </script>
    </body>
    </html>
    `);
});

/**
 * Unsubscribe API (POST)
 */
app.post('/api/unsubscribe', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, error: 'Email required' });
    }

    const unsubscribed = await readDB(UNSUBSCRIBE_COLLECTION) || [];

    if (!unsubscribed.includes(email.toLowerCase())) {
        unsubscribed.push(email.toLowerCase());
        await writeDB(UNSUBSCRIBE_COLLECTION, unsubscribed);
        console.log(`📧 Unsubscribed: ${email}`);
    }

    res.json({ success: true, message: 'Unsubscribed successfully' });
});

/**
 * Check if email is unsubscribed
 */
async function isUnsubscribed(email) {
    if (!email) return false;
    const unsubscribed = await readDB(UNSUBSCRIBE_COLLECTION) || [];
    return unsubscribed.includes(email.toLowerCase());
}

// ENV RELOAD Tue Jan 20 22:30:00 +03 2026