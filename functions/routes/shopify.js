/** SHOPIFY ROUTES - OAuth + Webhook Endpoints */
const express = require('express');
const router = express.Router();
const shopifyApp = require('../lib/shopifyApp');
const cartDetection = require('../lib/cartDetection');
const admin = require('firebase-admin');

const getDb = () => admin.firestore();

const nonceStore = new Map(); // Nonce store

router.get('/install', (req, res) => {
    const { shop } = req.query;
    if (!shop || !shop.includes('.myshopify.com')) {
        return res.status(400).json({ error: 'Missing or invalid shop parameter' });
    }
    
    const { url, nonce } = shopifyApp.getInstallUrl(shop);
    nonceStore.set(nonce, { shop, createdAt: Date.now() });
    
    // Clean old nonces
    for (const [k, v] of nonceStore) if (Date.now() - v.createdAt > 600000) nonceStore.delete(k);
    res.redirect(url);
});

router.get('/callback', async (req, res) => {
    const { shop, code, state } = req.query;
    
    // Verify nonce
    const stored = nonceStore.get(state);
    if (!stored || stored.shop !== shop) {
        return res.status(403).json({ error: 'Invalid state parameter' });
    }
    nonceStore.delete(state);
    
    try {
        // Exchange code for token
        const { access_token, scope } = await shopifyApp.getAccessToken(shop, code);
        
        // Save to Firestore
        await shopifyApp.saveStore(shop, access_token, scope, getDb());
        
        // Register webhooks
        const webhooks = await shopifyApp.registerWebhooks(shop, access_token);
        console.log(`[Shopify] ✅ Installed ${shop}, webhooks:`, webhooks);
        
        // Redirect to success page
        res.redirect(`https://${shop}/admin/apps?installed=ribh`);
    } catch (e) {
        console.error(`[Shopify] OAuth error:`, e.message);
        res.status(500).json({ error: 'Installation failed', details: e.message });
    }
});

router.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const topic = req.headers['x-shopify-topic'];
    const shop = req.headers['x-shopify-shop-domain'];
    
    // Verify signature
    const rawBody = req.body.toString('utf8');
    if (!shopifyApp.verifyWebhook(rawBody, hmac)) {
        console.warn(`[Shopify] Invalid webhook signature from ${shop}`);
        return res.status(401).send('Unauthorized');
    }
    
    const payload = JSON.parse(rawBody);
    payload.shop_domain = shop; // Add shop for context
    
    console.log(`[Shopify] Webhook: ${topic} from ${shop}`);
    
    try {
        switch (topic) {
            case 'checkouts/create':
            case 'checkouts/update':
                const result = await cartDetection.handleCartWebhook('shopify', topic, payload, async (cart) => {
                    console.log(`[Shopify] 🛒 ABANDONED: ${cart.email || cart.phone} - $${cart.totalAmount}`);
                });
                console.log(`[Shopify] Cart tracked:`, result);
                break;
                
            case 'orders/create':
                // Cart converted! Cancel abandon timer
                const cartId = payload.checkout_token || payload.cart_token;
                if (cartId) {
                    await cartDetection.markConverted('shopify', shop, cartId);
                }
                break;
                
            case 'app/uninstalled':
                await shopifyApp.handleUninstall(shop, getDb());
                break;
                
            default:
                console.log(`[Shopify] Unhandled topic: ${topic}`);
        }
        
        res.status(200).send('OK');
    } catch (e) {
        console.error(`[Shopify] Webhook error:`, e.message);
        res.status(500).send('Error');
    }
});

module.exports = router;
