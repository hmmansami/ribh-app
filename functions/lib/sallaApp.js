/**
 * SALLA APP - OAuth & Token Management (Easy Mode)
 * Tokens come via app.store.authorize webhook
 */
const admin = require('firebase-admin');
const SALLA_TOKEN_URL = 'https://accounts.salla.sa/oauth2/token';
const getDb = () => admin.firestore();

/** Store tokens from app.store.authorize webhook */
async function storeTokens(merchantId, data) {
    const expiresAt = new Date(data.expires > 1e11 ? data.expires : data.expires * 1000);
    await getDb().collection('salla_merchants').doc(String(merchantId)).set({
        merchantId: String(merchantId), accessToken: data.access_token,
        refreshToken: data.refresh_token, expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        scope: data.scope || '', status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`[SallaApp] ✅ Tokens stored: ${merchantId}`);
}

/** Get valid token (auto-refresh if expired) */
async function getAccessToken(merchantId) {
    const doc = await getDb().collection('salla_merchants').doc(String(merchantId)).get();
    if (!doc.exists) throw new Error(`Merchant ${merchantId} not found`);
    const { accessToken, refreshToken, expiresAt } = doc.data();
    if (expiresAt?.toDate?.() - Date.now() < 5 * 60 * 1000) {
        return refreshAccessToken(merchantId, refreshToken);
    }
    return accessToken;
}

/** Refresh expired token */
async function refreshAccessToken(merchantId, refreshToken) {
    const res = await fetch(SALLA_TOKEN_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token', client_id: process.env.SALLA_CLIENT_ID,
            client_secret: process.env.SALLA_CLIENT_SECRET, refresh_token: refreshToken
        })
    });
    if (!res.ok) throw new Error('Token refresh failed');
    const tokens = await res.json();
    await storeTokens(merchantId, tokens);
    return tokens.access_token;
}

/** Handle app events */
const handleAuthorize = (mid, data) => storeTokens(mid, data);
const handleInstalled = async (mid, data) => {
    await getDb().collection('salla_merchants').doc(String(mid)).set({
        merchantId: String(mid), appId: data.id, appName: data.app_name,
        scopes: data.app_scopes || [], status: 'installed',
        installedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`[SallaApp] 📦 Installed: ${mid}`);
};
const handleUninstalled = async (mid) => {
    await getDb().collection('salla_merchants').doc(String(mid))
        .update({ status: 'uninstalled', uninstalledAt: admin.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    console.log(`[SallaApp] 👋 Uninstalled: ${mid}`);
};

/** Authenticated API call */
async function sallaApi(merchantId, endpoint, opts = {}) {
    const token = await getAccessToken(merchantId);
    const res = await fetch(`https://api.salla.dev/admin/v2${endpoint}`, {
        ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts.headers }
    });
    if (!res.ok) throw new Error(`Salla API ${res.status}`);
    return res.json();
}

module.exports = { storeTokens, getAccessToken, refreshAccessToken, handleAuthorize, handleInstalled, handleUninstalled, sallaApi, SALLA_TOKEN_URL };
