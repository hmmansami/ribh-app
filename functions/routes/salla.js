/**
 * SALLA ROUTES - OAuth & Webhooks
 * GET /salla/install, GET /salla/callback, POST /salla/webhooks
 */
const express = require('express');
const router = express.Router();
const sallaApp = require('../lib/sallaApp');
const { handleCartWebhook, markConverted } = require('../lib/cartDetection');
const { normalizeSaudiPhone, verifySallaSignature } = require('../lib/sallaWebhooks');

// Install redirect
router.get('/install', (req, res) => {
    const appId = process.env.SALLA_APP_ID;
    res.redirect(`https://s.salla.sa/apps/install/${appId}`);
});

// OAuth callback (Custom Mode fallback)
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error || !code) return res.status(400).json({ error: error || 'Missing code' });
    try {
        const tokenRes = await fetch(sallaApp.SALLA_TOKEN_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code', client_id: process.env.SALLA_CLIENT_ID,
                client_secret: process.env.SALLA_CLIENT_SECRET, code,
                redirect_uri: `${process.env.APP_URL}/salla/callback`
            })
        });
        if (!tokenRes.ok) throw new Error('Token exchange failed');
        const tokens = await tokenRes.json();
        const userRes = await fetch('https://accounts.salla.sa/oauth2/user/info', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
        const merchantId = (await userRes.json()).data?.merchant?.id || 'unknown';
        await sallaApp.storeTokens(merchantId, tokens);
        res.json({ success: true, message: 'تم التثبيت! 🎉', merchantId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Webhook handler
router.post('/webhooks', async (req, res) => {
    const { event: eventType, merchant, data = {} } = req.body;
    const mid = merchant?.id || merchant;
    console.log(`[Salla] 📨 ${eventType} merchant:${mid}`);
    
    // Verify signature
    const secret = process.env.SALLA_WEBHOOK_SECRET;
    if (secret && !verifySallaSignature(req.body, req.headers['x-salla-signature'], secret)) {
        return res.status(401).json({ error: 'Invalid signature' });
    }
    res.json({ success: true, event: eventType }); // Fast response
    
    // Async processing
    setImmediate(async () => {
        try {
            if (eventType === 'app.store.authorize') await sallaApp.handleAuthorize(mid, data);
            else if (eventType === 'app.installed') await sallaApp.handleInstalled(mid, data);
            else if (eventType === 'app.uninstalled') await sallaApp.handleUninstalled(mid);
            else if (['checkout.created', 'checkout.updated', 'cart.created', 'cart.updated'].includes(eventType)) {
                await handleCartWebhook('salla', eventType, { ...data, merchant: mid }, (cart) => {
                    cart.phone = normalizeSaudiPhone(cart.phone);
                    console.log(`[Salla] 🛒 ABANDONED: ${cart.phone} ${cart.totalAmount} ${cart.currency}`);
                });
            } else if (eventType === 'order.created') {
                const cartId = data.cart_id || data.checkout_id || data.id;
                if (cartId) await markConverted('salla', mid, cartId);
                console.log(`[Salla] ✅ Order ${data.id}`);
            }
        } catch (e) { console.error(`[Salla] ❌ ${eventType}:`, e.message); }
    });
});

module.exports = router;
