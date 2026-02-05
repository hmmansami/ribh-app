/**
 * SALLA ROUTES - OAuth & Webhooks
 * GET /salla/install, GET /salla/callback, POST /salla/webhooks
 */
const express = require('express');
const router = express.Router();
const sallaApp = require('../lib/sallaApp');
const { handleCartWebhook, markConverted } = require('../lib/cartDetection');
const { normalizeSaudiPhone, verifySallaSignature } = require('../lib/sallaWebhooks');

// RIBH lib modules for order lifecycle
const orderNotifications = require('../lib/orderNotifications');
const reviewCollector = require('../lib/reviewCollector');
const { sendWelcomeEmail } = require('../lib/emailSender');

// Inline helpers for order status detection
const isShippingStatus = (status) => {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return ['shipped', 'shipping', 'in_transit', 'in transit', 'on_the_way', 'out_for_delivery', 'dispatched'].includes(s);
};

const isDeliveredStatus = (status) => {
    if (!status) return false;
    const s = String(status).toLowerCase();
    return ['delivered', 'completed', 'complete', 'fulfilled', 'received'].includes(s);
};

// Install redirect (App Store / Easy Mode)
router.get('/install', (req, res) => {
    const appId = process.env.SALLA_APP_ID;
    if (appId) {
        // Easy Mode - redirect to Salla App Store
        res.redirect(`https://s.salla.sa/apps/install/${appId}`);
    } else {
        // Custom Mode - direct OAuth
        const clientId = process.env.SALLA_CLIENT_ID;
        const redirectUri = encodeURIComponent(`${process.env.APP_URL}/salla/callback`);
        res.redirect(`https://accounts.salla.sa/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=offline_access`);
    }
});

// OAuth callback (Custom Mode fallback)
router.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error || !code) {
        return res.redirect(`/setup.html?error=${encodeURIComponent(error || 'لم يتم استلام رمز التفويض')}`);
    }
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
        const userData = (await userRes.json()).data;
        const merchantId = userData?.merchant?.id || 'unknown';
        await sallaApp.storeTokens(merchantId, tokens);
        
        // Send welcome email (async, don't block redirect)
        const email = userData?.merchant?.email || userData?.email;
        if (email) {
            sendWelcomeEmail({
                to: email,
                merchantName: userData?.merchant?.name || userData?.name,
                storeName: userData?.merchant?.store_name || userData?.merchant?.name
            }).then(() => console.log(`[Salla] 📧 Welcome email sent to ${email}`))
              .catch(e => console.error(`[Salla] ❌ Welcome email failed:`, e.message));
        }
        
        // Redirect to setup page for WhatsApp connection
        res.redirect(`/setup.html?connected=salla&merchant=${merchantId}`);
    } catch (e) { 
        // Redirect to setup with error
        res.redirect(`/setup.html?error=${encodeURIComponent(e.message)}`);
    }
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

    // Process webhook BEFORE responding (critical operations must complete)
    try {
        if (eventType === 'app.store.authorize') await sallaApp.handleAuthorize(mid, data);
        else if (eventType === 'app.installed') await sallaApp.handleInstalled(mid, data);
        else if (eventType === 'app.uninstalled') await sallaApp.handleUninstalled(mid);

        // Cart events → track for abandonedCart module
        else if (['checkout.created', 'checkout.updated', 'cart.created', 'cart.updated'].includes(eventType)) {
            await handleCartWebhook('salla', eventType, { ...data, merchant: mid }, (cart) => {
                cart.phone = normalizeSaudiPhone(cart.phone);
                console.log(`[Salla] 🛒 ABANDONED: ${cart.phone} ${cart.totalAmount} ${cart.currency}`);
            });
        }

        // Order created → send confirmation notification
        else if (eventType === 'order.created') {
            const cartId = data.cart_id || data.checkout_id || data.id;
            if (cartId) await markConverted('salla', mid, cartId);
            console.log(`[Salla] ✅ Order ${data.id}`);

            // Send order created WhatsApp notification
            const orderData = orderNotifications.extractFromSalla(mid, data);
            if (orderData.phone) {
                await orderNotifications.onOrderCreated(orderData);
            }
        }

        // Order updated → check for shipping/delivered status
        else if (eventType === 'order.updated') {
            const orderData = orderNotifications.extractFromSalla(mid, data);
            const status = orderData.status;

            // Shipped → send tracking notification
            if (isShippingStatus(status)) {
                console.log(`[Salla] 🚚 Order ${data.id} shipped`);
                if (orderData.phone) {
                    await orderNotifications.onOrderShipped(orderData);
                }
            }

            // Delivered → send notification AND schedule review request
            else if (isDeliveredStatus(status)) {
                console.log(`[Salla] ✅ Order ${data.id} delivered`);
                if (orderData.phone) {
                    await orderNotifications.onOrderDelivered(orderData);

                    // Schedule review request 2 days after delivery
                    await reviewCollector.scheduleReviewRequest({
                        storeId: mid,
                        orderId: String(orderData.orderId),
                        phone: normalizeSaudiPhone(orderData.phone),
                        customerName: orderData.customerName,
                        products: orderData.items,
                        reviewLink: orderData.reviewLink
                    });
                    console.log(`[Salla] 📝 Review request scheduled for order ${data.id}`);
                }
            }
        }
    } catch (e) { console.error(`[Salla] ❌ ${eventType}:`, e.message); }

    res.json({ success: true, event: eventType });
});

module.exports = router;
