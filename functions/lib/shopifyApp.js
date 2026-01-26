/** SHOPIFY APP - OAuth + Webhooks (No SDK) */
const crypto = require('crypto');

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || 'read_checkouts,read_orders';
const APP_URL = process.env.APP_URL || 'https://ribh-app.onrender.com';

function getInstallUrl(shop) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const redirectUri = `${APP_URL}/shopify/callback`;
    return {
        url: `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SHOPIFY_SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`,
        nonce
    };
}

async function getAccessToken(shop, code) {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: SHOPIFY_API_KEY,
            client_secret: SHOPIFY_API_SECRET,
            code
        })
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    return res.json(); // { access_token, scope }
}

async function registerWebhooks(shop, accessToken) {
    const webhooks = [
        { topic: 'checkouts/create', address: `${APP_URL}/shopify/webhooks` },
        { topic: 'checkouts/update', address: `${APP_URL}/shopify/webhooks` },
        { topic: 'orders/create', address: `${APP_URL}/shopify/webhooks` },
        { topic: 'app/uninstalled', address: `${APP_URL}/shopify/webhooks` }
    ];
    
    const results = [];
    for (const wh of webhooks) {
        const res = await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify({ webhook: wh })
        });
        const data = await res.json();
        results.push({ topic: wh.topic, success: res.ok, id: data.webhook?.id });
    }
    return results;
}

function verifyWebhook(body, hmacHeader) {
    if (!SHOPIFY_API_SECRET || !hmacHeader) return false;
    const hash = crypto.createHmac('sha256', SHOPIFY_API_SECRET)
        .update(body, 'utf8')
        .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

async function handleUninstall(shop, db) {
    try {
        const storeRef = db.collection('stores').doc(`shopify:${shop}`);
        await storeRef.delete();
        console.log(`[Shopify] Uninstalled: ${shop}`);
        return true;
    } catch (e) {
        console.error(`[Shopify] Uninstall error:`, e.message);
        return false;
    }
}

async function saveStore(shop, accessToken, scope, db) {
    await db.collection('stores').doc(`shopify:${shop}`).set({
        platform: 'shopify',
        shop,
        accessToken,
        scope,
        installedAt: new Date().toISOString(),
        status: 'active'
    }, { merge: true });
}

module.exports = {
    getInstallUrl,
    getAccessToken,
    registerWebhooks,
    verifyWebhook,
    handleUninstall,
    saveStore
};
