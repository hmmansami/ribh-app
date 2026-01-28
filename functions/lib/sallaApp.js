/**
 * SALLA APP - OAuth & Token Management (Easy Mode)
 * Tokens come via app.store.authorize webhook
 */
const admin = require('firebase-admin');
const SALLA_TOKEN_URL = 'https://accounts.salla.sa/oauth2/token';
const getDb = () => admin.firestore();

/** Store tokens from app.store.authorize webhook */
async function storeTokens(merchantId, data) {
    // Handle various expiry formats from Salla
    let expiresAt;
    if (data.expires) {
        // Already an absolute timestamp
        expiresAt = new Date(data.expires > 1e11 ? data.expires : data.expires * 1000);
    } else if (data.expires_in) {
        // Relative seconds from now
        expiresAt = new Date(Date.now() + (data.expires_in * 1000));
    } else {
        // Default to 24 hours
        expiresAt = new Date(Date.now() + 86400000);
    }
    
    console.log(`[SallaApp] 📝 Storing tokens for ${merchantId}:`, {
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        expiresAt: expiresAt.toISOString()
    });
    
    await getDb().collection('salla_merchants').doc(String(merchantId)).set({
        merchantId: String(merchantId), 
        accessToken: data.access_token,
        refreshToken: data.refresh_token, 
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        scope: data.scope || '', 
        status: 'active',
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
const handleAuthorize = async (mid, data) => {
    // Store tokens first
    await storeTokens(mid, data);
    
    // Now we have tokens - send welcome messages!
    // Dashboard URL for this merchant
    const dashboardUrl = `https://europe-west1-ribh-484706.cloudfunctions.net/api/app?merchant=${mid}`;
    
    // Send welcome messages (async, don't block webhook response)
    setImmediate(async () => {
        try {
            // Fetch merchant info from Salla API (now we have valid tokens!)
            const merchantInfo = await sallaApi(mid, '/store/info');
            const store = merchantInfo.data;
            const email = store?.email || store?.owner?.email;
            const phone = store?.owner?.mobile || store?.mobile || store?.phone;
            const merchantName = store?.owner?.name || store?.name || 'التاجر';
            const storeName = store?.name || 'المتجر';
            
            console.log(`[SallaApp] 🔍 Merchant info for ${mid}:`, { email, phone, merchantName, storeName });
            
            // Save phone/email to merchant doc for future use
            await getDb().collection('salla_merchants').doc(String(mid)).set({
                ownerPhone: phone,
                ownerEmail: email,
                storeName: storeName,
                ownerName: merchantName,
                welcomeSentAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            // 1. Send welcome email
            if (email) {
                try {
                    const { sendWelcomeEmail } = require('./emailSender');
                    await sendWelcomeEmail({
                        to: email,
                        merchantName: merchantName,
                        storeName: storeName,
                        merchantId: mid,
                        dashboardUrl: dashboardUrl
                    });
                    console.log(`[SallaApp] 📧 Welcome email sent to ${email}`);
                } catch (e) {
                    console.error(`[SallaApp] ❌ Welcome email failed:`, e.message);
                }
            } else {
                console.log(`[SallaApp] ⚠️ No email found for merchant ${mid}`);
            }
            
            // 2. Send welcome WhatsApp message with dashboard link
            if (phone) {
                try {
                    await sendWelcomeWhatsApp(mid, phone, merchantName, storeName, dashboardUrl);
                    console.log(`[SallaApp] 📱 Welcome WhatsApp sent to ${phone}`);
                } catch (e) {
                    console.error(`[SallaApp] ❌ Welcome WhatsApp failed:`, e.message);
                }
            } else {
                console.log(`[SallaApp] ⚠️ No phone found for merchant ${mid}`);
            }
        } catch (e) {
            console.error(`[SallaApp] ❌ Welcome messages failed for ${mid}:`, e.message, e.stack);
        }
    });
};

const handleInstalled = async (mid, data) => {
    // Just record the install - tokens come later via app.store.authorize
    await getDb().collection('salla_merchants').doc(String(mid)).set({
        merchantId: String(mid), appId: data.id, appName: data.app_name,
        scopes: data.app_scopes || [], status: 'installed',
        installedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`[SallaApp] 📦 Installed: ${mid} (waiting for authorize webhook to send welcome)`);
};

/** Send welcome WhatsApp to new merchant */
async function sendWelcomeWhatsApp(merchantId, phone, merchantName, storeName, dashboardUrl) {
    // Normalize Saudi phone number
    let normalizedPhone = String(phone).replace(/[^\d]/g, '');
    if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '966' + normalizedPhone.substring(1);
    }
    if (!normalizedPhone.startsWith('966')) {
        normalizedPhone = '966' + normalizedPhone;
    }
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

    // Try WhatsApp via Hmman's Business Number (using external API)
    const RIBH_WHATSAPP = process.env.RIBH_WHATSAPP_API || 'https://ribh-whatsapp.onrender.com';
    
    try {
        const response = await fetch(`${RIBH_WHATSAPP}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: normalizedPhone,
                message: message
            })
        });
        
        if (response.ok) {
            console.log(`[SallaApp] ✅ Welcome WhatsApp sent via bridge to ${normalizedPhone}`);
            return { success: true };
        } else {
            const err = await response.text();
            console.log(`[SallaApp] ⚠️ WhatsApp bridge error: ${err}`);
        }
    } catch (e) {
        console.log(`[SallaApp] ⚠️ WhatsApp bridge unavailable: ${e.message}`);
    }
    
    // Log for manual follow-up if WhatsApp fails
    console.log(`[SallaApp] 📝 Manual WhatsApp needed for ${normalizedPhone}:`);
    console.log(message);
    
    return { success: false, phone: normalizedPhone, message };
}
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
