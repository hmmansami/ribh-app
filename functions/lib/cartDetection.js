/**
 * CART DETECTION - Abandoned Cart Tracker for Salla + Shopify
 * Events: checkout.created/updated (Salla), checkouts/create/update (Shopify)
 */
const admin = require('firebase-admin');
const ABANDON_DELAY_MS = 30 * 60 * 1000; // 30 minutes

function getDb() { return admin.firestore(); }

/** Normalize cart from Salla/Shopify into unified format */
function normalizeCart(platform, payload) {
    if (platform === 'salla') {
        const d = payload.data || payload;
        return {
            cartId: String(d.id || d.checkout_id || d.cart?.id),
            storeId: String(payload.merchant || d.store_id || 'unknown'),
            customerId: d.customer?.id ? String(d.customer.id) : null,
            email: d.customer?.email || d.email || null,
            phone: d.customer?.mobile || d.mobile || d.phone || null,
            totalAmount: parseFloat(d.total?.amount || d.total || d.cart?.total || 0),
            currency: d.total?.currency || d.currency || 'SAR',
            itemCount: d.items?.length || d.cart?.items?.length || 0,
            items: (d.items || d.cart?.items || []).slice(0, 5).map(i => ({
                name: i.name || i.product?.name, qty: i.quantity || 1,
                price: parseFloat(i.price?.amount || i.price || 0)
            })),
            checkoutUrl: d.checkout_url || d.urls?.checkout || d.url || null
        };
    }
    // Shopify
    const c = payload;
    return {
        cartId: String(c.id || c.token),
        storeId: String(c.shop_id || payload.shop_domain || 'unknown'),
        customerId: c.customer?.id ? String(c.customer.id) : null,
        email: c.email || c.customer?.email || null,
        phone: c.phone || c.billing_address?.phone || c.shipping_address?.phone || null,
        totalAmount: parseFloat(c.total_price || c.subtotal_price || 0),
        currency: c.currency || 'USD',
        itemCount: c.line_items?.length || 0,
        items: (c.line_items || []).slice(0, 5).map(i => ({
            name: i.title || i.name, qty: i.quantity || 1, price: parseFloat(i.price || 0)
        })),
        checkoutUrl: c.abandoned_checkout_url || c.web_url || null
    };
}

/**
 * Handle incoming cart webhook
 * Instead of setTimeout (lost on restart), stores an `abandonAt` timestamp in Firestore.
 * The keepAlive cron calls processAbandonedCarts() every 5 minutes to check for expired carts.
 */
async function handleCartWebhook(platform, event, payload, onAbandoned) {
    const cart = normalizeCart(platform, payload);
    const key = `${platform}:${cart.storeId}:${cart.cartId}`;

    if (!cart.cartId || cart.cartId === 'undefined') return { status: 'skipped', reason: 'no_cart_id' };
    if (!cart.phone && !cart.email) return { status: 'skipped', reason: 'no_contact' };

    // Save to Firestore with an abandonAt deadline (30 minutes from now)
    const db = getDb();
    await db.collection('carts').doc(key).set({
        ...cart, platform, key,
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        abandonAt: new Date(Date.now() + ABANDON_DELAY_MS).toISOString(),
        status: 'active', updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[CartDetection] Saved ${key} - $${cart.totalAmount} ${cart.currency} (abandon check in 30min)`);

    return { status: 'tracked', key, abandonIn: '30min' };
}

/**
 * Process abandoned carts — called by keepAlive cron every 5 minutes.
 * Finds carts where status=active and abandonAt has passed.
 */
async function processAbandonedCarts(onAbandoned) {
    const db = getDb();
    const now = new Date().toISOString();

    const snapshot = await db.collection('carts')
        .where('status', '==', 'active')
        .where('abandonAt', '<=', now)
        .limit(50)
        .get();

    if (snapshot.empty) return { processed: 0 };

    let processed = 0;
    for (const doc of snapshot.docs) {
        const cart = doc.data();
        await doc.ref.update({
            status: 'abandoned',
            abandonedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[CartDetection] 🛒 ABANDONED: ${doc.id}`);
        processed++;

        if (typeof onAbandoned === 'function') {
            try { await onAbandoned(cart); } catch (e) {
                console.error(`[CartDetection] callback error for ${doc.id}:`, e.message);
            }
        }
    }

    if (processed > 0) console.log(`[CartDetection] Processed ${processed} abandoned carts`);
    return { processed };
}

/** Mark cart as converted (order placed) */
async function markConverted(platform, storeId, cartId) {
    const key = `${platform}:${storeId}:${cartId}`;
    await getDb().collection('carts').doc(key).update({
        status: 'converted', convertedAt: admin.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
    console.log(`[CartDetection] ✅ Converted: ${key}`);
}

module.exports = { handleCartWebhook, markConverted, normalizeCart, processAbandonedCarts, ABANDON_DELAY_MS };
