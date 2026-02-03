/**
 * BROWSE ABANDONMENT - Detection & Recovery System
 *
 * Detects when customers browse products but don't add to cart,
 * then recovers them via personalized WhatsApp messages.
 *
 * FLOW:
 * 1. Customer views product(s) on Salla store
 * 2. trackProductView() logs the view in Firestore
 * 3. detectBrowseAbandonment() runs periodically (cron/keep-alive)
 * 4. shouldTrigger() checks all conditions (frequency, cart status, etc.)
 * 5. sendBrowseRecovery() sends WhatsApp with product + discount
 * 6. trackClick()/trackConversion() close the loop
 *
 * Firestore collections:
 *   stores/{storeId}/browseEvents/{eventId}
 *   stores/{storeId}/browseAbandonment/{id}
 */

const admin = require('firebase-admin');

function getDb() { return admin.firestore(); }

// ==========================================
// MODULE IMPORTS (with graceful fallbacks)
// ==========================================

let whatsappClient;
try {
    whatsappClient = require('./whatsappClient');
    console.log('[BrowseAbandonment] WhatsApp Client loaded');
} catch (e) {
    console.log('[BrowseAbandonment] WhatsApp client not available');
    whatsappClient = null;
}

let discountCodes;
try {
    discountCodes = require('./discountCodes');
    console.log('[BrowseAbandonment] Discount Codes loaded');
} catch (e) {
    console.log('[BrowseAbandonment] Discount codes not available');
    discountCodes = null;
}

let sallaWebhooks;
try {
    sallaWebhooks = require('./sallaWebhooks');
    console.log('[BrowseAbandonment] Salla Webhooks loaded (phone utils)');
} catch (e) {
    console.log('[BrowseAbandonment] Salla webhooks not available');
    sallaWebhooks = null;
}

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
    // Time window: customer must NOT add to cart within this period
    ABANDON_DELAY_HOURS_MIN: 1,       // Minimum wait before triggering (hours)
    ABANDON_DELAY_HOURS_MAX: 4,       // Maximum window to look back (hours)

    // Frequency caps
    MIN_VIEWS_TO_TRIGGER: 2,          // Must view at least 2 products
    COOLDOWN_HOURS: 48,               // Max 1 message per customer per 48h

    // Cleanup
    EVENT_TTL_DAYS: 7,                // Remove browse events older than 7 days
    ABANDONMENT_TTL_DAYS: 30,         // Keep abandonment records for 30 days

    // Discount
    DEFAULT_DISCOUNT_PERCENT: 10,     // Default browse recovery discount
    DISCOUNT_EXPIRY_HOURS: 48,        // Discount code valid for 48 hours

    // Processing
    BATCH_LIMIT: 50,                  // Max customers to process per run

    // Discount code prefix
    DISCOUNT_CODE_PREFIX: 'BROWSE'
};

// ==========================================
// 1. TRACK PRODUCT VIEW
// ==========================================

/**
 * Log a product view event
 * Called when customer views a product page (via Salla webhook or pixel)
 *
 * @param {string} customerId - Salla customer ID or phone
 * @param {object} productData - Product details
 * @param {string} storeId - Store/merchant ID
 * @returns {object} - { eventId, tracked: true }
 */
async function trackProductView(customerId, productData, storeId) {
    try {
        if (!customerId || !storeId) {
            console.log('[BrowseAbandonment] Skipped: missing customerId or storeId');
            return { tracked: false, reason: 'missing_ids' };
        }

        const db = getDb();

        // Normalize phone if customerId looks like a phone number
        const customerPhone = productData.customerPhone || productData.phone || null;
        const normalizedPhone = customerPhone && sallaWebhooks
            ? sallaWebhooks.normalizeSaudiPhone(customerPhone)
            : customerPhone;

        const browseEvent = {
            customerId: String(customerId),
            customerPhone: normalizedPhone,
            customerName: productData.customerName || null,
            customerEmail: productData.customerEmail || null,
            productId: String(productData.productId || productData.id || ''),
            productName: productData.productName || productData.name || '',
            productPrice: parseFloat(productData.productPrice || productData.price || 0),
            productUrl: productData.productUrl || productData.url || null,
            productImage: productData.productImage || productData.image || productData.thumbnail || null,
            category: productData.category || productData.productCategory || null,
            viewedAt: admin.firestore.FieldValue.serverTimestamp(),
            viewedAtMs: Date.now(),
            source: productData.source || 'salla_webhook',
            sessionId: productData.sessionId || null
        };

        // Store the browse event
        const eventRef = await db
            .collection('stores').doc(storeId)
            .collection('browseEvents')
            .add(browseEvent);

        // Update customer's last browse activity
        await db
            .collection('stores').doc(storeId)
            .collection('customers').doc(String(customerId))
            .set({
                lastBrowseAt: admin.firestore.FieldValue.serverTimestamp(),
                lastViewedProduct: productData.productName || productData.name || null,
                customerPhone: normalizedPhone,
                customerName: productData.customerName || null,
                customerEmail: productData.customerEmail || null
            }, { merge: true });

        console.log(`[BrowseAbandonment] Tracked view: ${productData.productName || productData.id} by ${customerId} (store: ${storeId})`);

        return { tracked: true, eventId: eventRef.id };
    } catch (error) {
        console.error('[BrowseAbandonment] trackProductView error:', error.message);
        return { tracked: false, reason: error.message };
    }
}

// ==========================================
// 2. DETECT BROWSE ABANDONMENT
// ==========================================

/**
 * Check for unrecovered browse events and create abandonment records
 * Run this periodically (every 5-15 minutes via cron/keep-alive)
 *
 * @param {string} storeId - Store/merchant ID
 * @returns {object} - { detected: number, skipped: number, errors: number }
 */
async function detectBrowseAbandonment(storeId) {
    const results = { detected: 0, skipped: 0, errors: 0 };

    try {
        if (!storeId) {
            console.log('[BrowseAbandonment] detectBrowseAbandonment: missing storeId');
            return results;
        }

        const db = getDb();
        const now = Date.now();

        // Look for views between ABANDON_DELAY_HOURS_MIN and ABANDON_DELAY_HOURS_MAX ago
        const minCutoff = now - (CONFIG.ABANDON_DELAY_HOURS_MIN * 60 * 60 * 1000);
        const maxCutoff = now - (CONFIG.ABANDON_DELAY_HOURS_MAX * 60 * 60 * 1000);

        // Get browse events in the detection window
        const browseEventsSnap = await db
            .collection('stores').doc(storeId)
            .collection('browseEvents')
            .where('viewedAtMs', '>=', maxCutoff)
            .where('viewedAtMs', '<=', minCutoff)
            .orderBy('viewedAtMs', 'desc')
            .limit(500)
            .get();

        if (browseEventsSnap.empty) {
            console.log(`[BrowseAbandonment] No browse events in detection window for store ${storeId}`);
            return results;
        }

        // Group events by customer
        const customerViews = {};
        browseEventsSnap.forEach(doc => {
            const event = doc.data();
            const cid = event.customerId;
            if (!cid) return;

            if (!customerViews[cid]) {
                customerViews[cid] = {
                    customerId: cid,
                    customerPhone: event.customerPhone,
                    customerName: event.customerName,
                    customerEmail: event.customerEmail,
                    products: [],
                    productIds: new Set(),
                    lastViewMs: 0
                };
            }

            // Deduplicate products by ID
            const pid = event.productId;
            if (pid && !customerViews[cid].productIds.has(pid)) {
                customerViews[cid].productIds.add(pid);
                customerViews[cid].products.push({
                    productId: event.productId,
                    productName: event.productName,
                    productPrice: event.productPrice,
                    productUrl: event.productUrl,
                    productImage: event.productImage,
                    category: event.category,
                    viewedAtMs: event.viewedAtMs
                });
            }

            // Update phone/name/email if newer event has them
            if (event.customerPhone) customerViews[cid].customerPhone = event.customerPhone;
            if (event.customerName) customerViews[cid].customerName = event.customerName;
            if (event.customerEmail) customerViews[cid].customerEmail = event.customerEmail;

            customerViews[cid].lastViewMs = Math.max(
                customerViews[cid].lastViewMs,
                event.viewedAtMs || 0
            );
        });

        console.log(`[BrowseAbandonment] Found ${Object.keys(customerViews).length} customers with browse events (store: ${storeId})`);

        // Evaluate each customer
        let processedCount = 0;
        for (const [customerId, views] of Object.entries(customerViews)) {
            if (processedCount >= CONFIG.BATCH_LIMIT) break;

            try {
                // Check minimum product views
                if (views.products.length < CONFIG.MIN_VIEWS_TO_TRIGGER) {
                    results.skipped++;
                    continue;
                }

                // Run all conditions
                const triggerResult = await shouldTrigger(customerId, storeId);
                if (!triggerResult.shouldSend) {
                    results.skipped++;
                    continue;
                }

                // Sort products by view time (most recent first) and price (highest first as tiebreaker)
                views.products.sort((a, b) => {
                    const timeDiff = (b.viewedAtMs || 0) - (a.viewedAtMs || 0);
                    if (timeDiff !== 0) return timeDiff;
                    return (b.productPrice || 0) - (a.productPrice || 0);
                });

                // Create abandonment record
                const abandonmentData = {
                    customerId: views.customerId,
                    customerPhone: views.customerPhone,
                    customerName: views.customerName || null,
                    customerEmail: views.customerEmail || null,
                    products: views.products.slice(0, 5), // Keep top 5 products
                    productCount: views.products.length,
                    topProduct: views.products[0] || null,
                    lastViewAt: new Date(views.lastViewMs).toISOString(),
                    lastViewMs: views.lastViewMs,
                    messageSent: false,
                    sentAt: null,
                    clickedAt: null,
                    convertedAt: null,
                    convertedRevenue: 0,
                    discountCode: null,
                    status: 'detected',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    createdAtMs: Date.now()
                };

                // Check if we already have an active abandonment for this customer
                const existingSnap = await db
                    .collection('stores').doc(storeId)
                    .collection('browseAbandonment')
                    .where('customerId', '==', customerId)
                    .where('status', 'in', ['detected', 'sent'])
                    .limit(1)
                    .get();

                if (!existingSnap.empty) {
                    // Update existing record with new products
                    const existingDoc = existingSnap.docs[0];
                    await existingDoc.ref.update({
                        products: abandonmentData.products,
                        productCount: abandonmentData.productCount,
                        topProduct: abandonmentData.topProduct,
                        lastViewAt: abandonmentData.lastViewAt,
                        lastViewMs: abandonmentData.lastViewMs
                    });
                    results.skipped++;
                    continue;
                }

                // Create new abandonment record
                await db
                    .collection('stores').doc(storeId)
                    .collection('browseAbandonment')
                    .add(abandonmentData);

                results.detected++;
                processedCount++;

                console.log(`[BrowseAbandonment] Detected: customer ${customerId} viewed ${views.products.length} products (store: ${storeId})`);
            } catch (err) {
                console.error(`[BrowseAbandonment] Error evaluating customer ${customerId}:`, err.message);
                results.errors++;
            }
        }

        console.log(`[BrowseAbandonment] Detection complete (store: ${storeId}): ${results.detected} detected, ${results.skipped} skipped, ${results.errors} errors`);
        return results;
    } catch (error) {
        console.error('[BrowseAbandonment] detectBrowseAbandonment error:', error.message);
        results.errors++;
        return results;
    }
}

// ==========================================
// 3. SHOULD TRIGGER - Smart Filtering
// ==========================================

/**
 * Check all conditions before sending a browse recovery message
 *
 * @param {string} customerId - Customer ID
 * @param {string} storeId - Store/merchant ID
 * @returns {object} - { shouldSend: boolean, reason: string }
 */
async function shouldTrigger(customerId, storeId) {
    try {
        const db = getDb();

        // 1. Must be an identified customer (has phone or email)
        const customerDoc = await db
            .collection('stores').doc(storeId)
            .collection('customers').doc(String(customerId))
            .get();

        const customerData = customerDoc.exists ? customerDoc.data() : {};
        const hasPhone = !!(customerData.customerPhone || customerData.phone || customerData.mobile);
        const hasEmail = !!(customerData.customerEmail || customerData.email);

        if (!hasPhone && !hasEmail) {
            return { shouldSend: false, reason: 'no_contact_info' };
        }

        // 2. Don't trigger if customer has an active cart
        const recentCartAdds = await db
            .collection('stores').doc(storeId)
            .collection('events')
            .where('customerId', '==', customerId)
            .where('eventType', '==', 'cart_add')
            .where('timestampMs', '>=', Date.now() - (24 * 60 * 60 * 1000))
            .limit(1)
            .get();

        if (!recentCartAdds.empty) {
            return { shouldSend: false, reason: 'has_active_cart' };
        }

        // 3. Don't trigger if customer bought recently (last 24 hours)
        const recentOrders = await db
            .collection('stores').doc(storeId)
            .collection('events')
            .where('customerId', '==', customerId)
            .where('eventType', '==', 'order_placed')
            .where('timestampMs', '>=', Date.now() - (24 * 60 * 60 * 1000))
            .limit(1)
            .get();

        if (!recentOrders.empty) {
            return { shouldSend: false, reason: 'recently_purchased' };
        }

        // 4. Max 1 browse abandon message per customer per 48 hours (cooldown)
        const cooldownCutoff = Date.now() - (CONFIG.COOLDOWN_HOURS * 60 * 60 * 1000);
        const recentMessages = await db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment')
            .where('customerId', '==', customerId)
            .where('messageSent', '==', true)
            .where('createdAtMs', '>=', cooldownCutoff)
            .limit(1)
            .get();

        if (!recentMessages.empty) {
            return { shouldSend: false, reason: 'cooldown_active' };
        }

        return { shouldSend: true, reason: 'all_checks_passed' };
    } catch (error) {
        console.error('[BrowseAbandonment] shouldTrigger error:', error.message);
        // Fail closed - don't send if we can't verify conditions
        return { shouldSend: false, reason: `error: ${error.message}` };
    }
}

// ==========================================
// 4. SEND BROWSE RECOVERY MESSAGE
// ==========================================

/**
 * Send WhatsApp recovery message for a detected browse abandonment
 *
 * @param {string} abandonmentId - The browseAbandonment document ID
 * @param {string} storeId - Store/merchant ID (required to locate the document)
 * @returns {object} - { success: boolean, messageId?, error? }
 */
async function sendBrowseRecovery(abandonmentId, storeId) {
    try {
        if (!abandonmentId || !storeId) {
            return { success: false, error: 'missing_abandonmentId_or_storeId' };
        }

        const db = getDb();

        // Load the abandonment record
        const abandonDoc = await db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment').doc(abandonmentId)
            .get();

        if (!abandonDoc.exists) {
            return { success: false, error: 'abandonment_not_found' };
        }

        const abandonment = abandonDoc.data();

        // Skip if already sent or expired
        if (abandonment.messageSent) {
            return { success: false, error: 'already_sent' };
        }
        if (abandonment.status === 'converted' || abandonment.status === 'expired') {
            return { success: false, error: `status_${abandonment.status}` };
        }

        // Must have a phone number
        const phone = abandonment.customerPhone;
        if (!phone) {
            await abandonDoc.ref.update({ status: 'expired', expiredReason: 'no_phone' });
            return { success: false, error: 'no_phone_number' };
        }

        // Check WhatsApp connectivity
        if (!whatsappClient) {
            return { success: false, error: 'whatsapp_not_available' };
        }

        const isConnected = await whatsappClient.isConnected(storeId);
        if (!isConnected) {
            return { success: false, error: 'whatsapp_not_connected' };
        }

        // Load store info for the message
        const storeDoc = await db.collection('stores').doc(storeId).get();
        const storeData = storeDoc.exists ? storeDoc.data() : {};
        const storeName = storeData.merchantName || storeData.name || storeData.storeName || '';

        // Generate discount code
        let discountCode = CONFIG.DISCOUNT_CODE_PREFIX + '10';
        if (discountCodes) {
            try {
                const codeResult = await discountCodes.createDiscountCode(
                    storeId,
                    abandonment.customerEmail || phone,
                    CONFIG.DEFAULT_DISCOUNT_PERCENT,
                    CONFIG.DISCOUNT_EXPIRY_HOURS,
                    storeData.accessToken || null
                );
                discountCode = codeResult.code || discountCode;
            } catch (e) {
                console.log(`[BrowseAbandonment] Discount code creation failed, using default: ${e.message}`);
            }
        }

        // Build the message
        const customerName = abandonment.customerName || '';
        const products = abandonment.products || [];
        const topProduct = abandonment.topProduct || products[0] || {};

        let message;
        if (products.length <= 1) {
            // Template 1: Single product
            message = buildSingleProductMessage({
                customerName,
                productName: topProduct.productName || '',
                productPrice: topProduct.productPrice,
                productUrl: topProduct.productUrl || '',
                productImage: topProduct.productImage || '',
                storeName,
                discountCode,
                discountPercent: CONFIG.DEFAULT_DISCOUNT_PERCENT
            });
        } else {
            // Template 2: Multiple products
            message = buildMultiProductMessage({
                customerName,
                topProductName: topProduct.productName || '',
                productCount: products.length,
                storeName,
                storeUrl: storeData.storeUrl || storeData.url || `https://${storeId}.salla.sa`,
                discountCode,
                discountPercent: CONFIG.DEFAULT_DISCOUNT_PERCENT
            });
        }

        // Send via WhatsApp
        const sendResult = await whatsappClient.sendMessage(storeId, phone, message);

        if (sendResult.success) {
            // Update abandonment record
            await abandonDoc.ref.update({
                messageSent: true,
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                sentAtMs: Date.now(),
                discountCode: discountCode,
                messageId: sendResult.messageId || null,
                status: 'sent'
            });

            console.log(`[BrowseAbandonment] Recovery sent to ${phone} for ${products.length} product(s) (store: ${storeId})`);

            return {
                success: true,
                messageId: sendResult.messageId,
                phone,
                productsCount: products.length,
                discountCode
            };
        } else {
            console.log(`[BrowseAbandonment] WhatsApp send failed: ${sendResult.error}`);
            return { success: false, error: sendResult.error || 'send_failed' };
        }
    } catch (error) {
        console.error('[BrowseAbandonment] sendBrowseRecovery error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Process all pending browse abandonments: detect + send
 * Convenience function to run both detection and recovery in one call.
 * Ideal for cron/keep-alive.
 *
 * @param {string} storeId - Store/merchant ID
 * @returns {object} - { detected, sent, errors }
 */
async function processAllPending(storeId) {
    const result = { detected: 0, sent: 0, errors: 0 };

    try {
        // Step 1: Detect new abandonments
        const detectResult = await detectBrowseAbandonment(storeId);
        result.detected = detectResult.detected;

        // Step 2: Send recovery for all unsent detected abandonments
        const db = getDb();
        const pendingSnap = await db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment')
            .where('status', '==', 'detected')
            .where('messageSent', '==', false)
            .limit(CONFIG.BATCH_LIMIT)
            .get();

        for (const doc of pendingSnap.docs) {
            try {
                const sendResult = await sendBrowseRecovery(doc.id, storeId);
                if (sendResult.success) {
                    result.sent++;
                } else {
                    console.log(`[BrowseAbandonment] Skip send for ${doc.id}: ${sendResult.error}`);
                }
                // Rate limit: 1 second between messages
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.error(`[BrowseAbandonment] Error sending recovery ${doc.id}:`, e.message);
                result.errors++;
            }
        }

        console.log(`[BrowseAbandonment] processAllPending (store: ${storeId}): ${result.detected} detected, ${result.sent} sent, ${result.errors} errors`);
        return result;
    } catch (error) {
        console.error('[BrowseAbandonment] processAllPending error:', error.message);
        result.errors++;
        return result;
    }
}

// ==========================================
// 5. TRACKING: CLICKS & CONVERSIONS
// ==========================================

/**
 * Record when customer clicks the recovery link
 *
 * @param {string} abandonmentId - The browseAbandonment document ID
 * @param {string} storeId - Store/merchant ID
 * @returns {object} - { success: boolean }
 */
async function trackClick(abandonmentId, storeId) {
    try {
        if (!abandonmentId || !storeId) {
            return { success: false, error: 'missing_ids' };
        }

        const db = getDb();
        const docRef = db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment').doc(abandonmentId);

        const doc = await docRef.get();
        if (!doc.exists) {
            return { success: false, error: 'not_found' };
        }

        // Only update if not already clicked
        const data = doc.data();
        if (!data.clickedAt) {
            await docRef.update({
                clickedAt: admin.firestore.FieldValue.serverTimestamp(),
                clickedAtMs: Date.now(),
                status: 'clicked'
            });
        }

        console.log(`[BrowseAbandonment] Click tracked: ${abandonmentId} (store: ${storeId})`);
        return { success: true };
    } catch (error) {
        console.error('[BrowseAbandonment] trackClick error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Record when customer converts (places an order) after browse recovery
 *
 * @param {string} abandonmentId - The browseAbandonment document ID
 * @param {string} storeId - Store/merchant ID
 * @param {number} revenue - Order revenue amount
 * @returns {object} - { success: boolean }
 */
async function trackConversion(abandonmentId, storeId, revenue = 0) {
    try {
        if (!abandonmentId || !storeId) {
            return { success: false, error: 'missing_ids' };
        }

        const db = getDb();
        const docRef = db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment').doc(abandonmentId);

        const doc = await docRef.get();
        if (!doc.exists) {
            return { success: false, error: 'not_found' };
        }

        await docRef.update({
            convertedAt: admin.firestore.FieldValue.serverTimestamp(),
            convertedAtMs: Date.now(),
            convertedRevenue: parseFloat(revenue) || 0,
            status: 'converted'
        });

        console.log(`[BrowseAbandonment] Conversion tracked: ${abandonmentId}, revenue: ${revenue} SAR (store: ${storeId})`);
        return { success: true, revenue };
    } catch (error) {
        console.error('[BrowseAbandonment] trackConversion error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Auto-detect conversions: check if any customer with a browse abandonment
 * placed an order recently. Call this when order.created fires.
 *
 * @param {string} storeId - Store/merchant ID
 * @param {string} customerId - Customer who placed the order
 * @param {number} orderRevenue - Order total
 * @returns {object} - { matched: boolean, abandonmentId? }
 */
async function checkOrderForBrowseConversion(storeId, customerId, orderRevenue) {
    try {
        const db = getDb();

        // Find recent sent/clicked browse abandonment for this customer
        const abandonSnap = await db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment')
            .where('customerId', '==', String(customerId))
            .where('status', 'in', ['sent', 'clicked'])
            .orderBy('sentAtMs', 'desc')
            .limit(1)
            .get();

        if (abandonSnap.empty) {
            return { matched: false };
        }

        const doc = abandonSnap.docs[0];
        const data = doc.data();

        // Only attribute if the message was sent within the last 72 hours
        const sentAtMs = data.sentAtMs || 0;
        const attributionWindow = 72 * 60 * 60 * 1000; // 72 hours
        if (Date.now() - sentAtMs > attributionWindow) {
            return { matched: false, reason: 'outside_attribution_window' };
        }

        // Mark as converted
        await trackConversion(doc.id, storeId, orderRevenue);

        console.log(`[BrowseAbandonment] Auto-conversion: customer ${customerId} ordered ${orderRevenue} SAR after browse recovery`);
        return { matched: true, abandonmentId: doc.id, revenue: orderRevenue };
    } catch (error) {
        console.error('[BrowseAbandonment] checkOrderForBrowseConversion error:', error.message);
        return { matched: false, error: error.message };
    }
}

// ==========================================
// 6. STATS & ANALYTICS
// ==========================================

/**
 * Get browse abandonment statistics for dashboard
 *
 * @param {string} storeId - Store/merchant ID
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {object} - Dashboard stats
 */
async function getBrowseStats(storeId, days = 30) {
    try {
        const db = getDb();
        const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);

        // Get all browse abandonment records in the period
        const abandonSnap = await db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment')
            .where('createdAtMs', '>=', cutoffMs)
            .get();

        // Count browse events (unique customers who browsed)
        const browseEventsSnap = await db
            .collection('stores').doc(storeId)
            .collection('browseEvents')
            .where('viewedAtMs', '>=', cutoffMs)
            .get();

        // Count unique browsing customers
        const uniqueBrowsers = new Set();
        browseEventsSnap.forEach(doc => {
            const d = doc.data();
            if (d.customerId) uniqueBrowsers.add(d.customerId);
        });

        const stats = {
            period: `${days} days`,
            totalBrowseEvents: browseEventsSnap.size,
            uniqueBrowsers: uniqueBrowsers.size,
            abandonmentsDetected: 0,
            messagesSent: 0,
            clicks: 0,
            conversions: 0,
            revenueRecovered: 0,
            browseAbandonRate: '0%',
            recoveryRate: '0%',
            clickRate: '0%',
            conversionRate: '0%',
            avgRevenuePerConversion: 0
        };

        abandonSnap.forEach(doc => {
            const d = doc.data();
            stats.abandonmentsDetected++;

            if (d.messageSent) stats.messagesSent++;
            if (d.clickedAt) stats.clicks++;
            if (d.status === 'converted') {
                stats.conversions++;
                stats.revenueRecovered += (d.convertedRevenue || 0);
            }
        });

        // Calculate rates
        if (uniqueBrowsers.size > 0) {
            stats.browseAbandonRate = ((stats.abandonmentsDetected / uniqueBrowsers.size) * 100).toFixed(1) + '%';
        }
        if (stats.messagesSent > 0) {
            stats.clickRate = ((stats.clicks / stats.messagesSent) * 100).toFixed(1) + '%';
            stats.recoveryRate = ((stats.conversions / stats.messagesSent) * 100).toFixed(1) + '%';
        }
        if (stats.conversions > 0) {
            stats.conversionRate = ((stats.conversions / stats.abandonmentsDetected) * 100).toFixed(1) + '%';
            stats.avgRevenuePerConversion = Math.round(stats.revenueRecovered / stats.conversions);
        }

        // Round revenue
        stats.revenueRecovered = Math.round(stats.revenueRecovered * 100) / 100;

        return stats;
    } catch (error) {
        console.error('[BrowseAbandonment] getBrowseStats error:', error.message);
        return {
            error: error.message,
            totalBrowseEvents: 0,
            uniqueBrowsers: 0,
            abandonmentsDetected: 0,
            messagesSent: 0,
            conversions: 0,
            revenueRecovered: 0,
            recoveryRate: '0%'
        };
    }
}

// ==========================================
// 7. CLEANUP
// ==========================================

/**
 * Remove browse events older than EVENT_TTL_DAYS
 * Run daily to keep Firestore lean
 *
 * @param {string} storeId - Store/merchant ID
 * @returns {object} - { deleted: number }
 */
async function cleanupOldEvents(storeId) {
    try {
        const db = getDb();
        const cutoffMs = Date.now() - (CONFIG.EVENT_TTL_DAYS * 24 * 60 * 60 * 1000);

        // Delete old browse events
        const oldEventsSnap = await db
            .collection('stores').doc(storeId)
            .collection('browseEvents')
            .where('viewedAtMs', '<', cutoffMs)
            .limit(500)
            .get();

        let deletedEvents = 0;
        const batch = db.batch();
        oldEventsSnap.forEach(doc => {
            batch.delete(doc.ref);
            deletedEvents++;
        });

        if (deletedEvents > 0) {
            await batch.commit();
        }

        // Expire old unprocessed abandonment records
        const abandonCutoffMs = Date.now() - (CONFIG.ABANDONMENT_TTL_DAYS * 24 * 60 * 60 * 1000);
        const oldAbandonSnap = await db
            .collection('stores').doc(storeId)
            .collection('browseAbandonment')
            .where('createdAtMs', '<', abandonCutoffMs)
            .where('status', 'in', ['detected', 'sent', 'clicked'])
            .limit(500)
            .get();

        let expiredAbandonments = 0;
        const abandonBatch = db.batch();
        oldAbandonSnap.forEach(doc => {
            abandonBatch.update(doc.ref, { status: 'expired' });
            expiredAbandonments++;
        });

        if (expiredAbandonments > 0) {
            await abandonBatch.commit();
        }

        console.log(`[BrowseAbandonment] Cleanup (store: ${storeId}): ${deletedEvents} events deleted, ${expiredAbandonments} abandonments expired`);
        return { deletedEvents, expiredAbandonments };
    } catch (error) {
        console.error('[BrowseAbandonment] cleanupOldEvents error:', error.message);
        return { deletedEvents: 0, expiredAbandonments: 0, error: error.message };
    }
}

// ==========================================
// MESSAGE TEMPLATES (Arabic)
// ==========================================

/**
 * Build WhatsApp message for single product browse abandonment
 */
function buildSingleProductMessage({ customerName, productName, productPrice, productUrl, productImage, storeName, discountCode, discountPercent }) {
    const name = customerName || '';
    const greeting = name ? `${name}` : '';

    let msg = '';
    msg += greeting ? `${greeting}!\n` : '';
    msg += `\u0645\u0631\u062d\u0628\u0627 \ud83d\udc4b\n`;
    msg += `\u0644\u0627\u062d\u0638\u0646\u0627 \u0625\u0646\u0643 \u0634\u0641\u062a *${productName}*`;
    if (storeName) msg += ` \u0641\u064a ${storeName}`;
    msg += `\n\n`;

    if (productPrice) {
        msg += `\u0627\u0644\u0633\u0639\u0631: ${productPrice} \u0631.\u0633\n`;
    }

    msg += `\u0644\u0633\u0627 \u0645\u062a\u0648\u0641\u0631! \u0648\u0639\u0646\u062f\u0643 \u062e\u0635\u0645 ${discountPercent}% \u0644\u0648 \u0637\u0644\u0628\u062a\u0647 \u0627\u0644\u064a\u0648\u0645 \ud83c\udf81\n\n`;

    if (productUrl) {
        msg += `\ud83d\udc49 ${productUrl}\n\n`;
    }

    msg += `\u0643\u0648\u062f \u0627\u0644\u062e\u0635\u0645: *${discountCode}*`;

    return msg;
}

/**
 * Build WhatsApp message for multiple products browse abandonment
 */
function buildMultiProductMessage({ customerName, topProductName, productCount, storeName, storeUrl, discountCode, discountPercent }) {
    const name = customerName || '';

    let msg = '';
    msg += name ? `${name}! \ud83d\ude0a\n` : `\u0645\u0631\u062d\u0628\u0627! \ud83d\ude0a\n`;
    msg += `\u0643\u0646\u062a \u062a\u062a\u0635\u0641\u062d`;
    if (storeName) msg += ` ${storeName}`;
    msg += ` \u0648\u0634\u0641\u062a \u0645\u0646\u062a\u062c\u0627\u062a \u062d\u0644\u0648\u0629\n\n`;

    msg += `\u0623\u0643\u062b\u0631 \u0645\u0646\u062a\u062c \u0634\u0641\u062a\u0647: *${topProductName}*\n`;
    if (productCount > 1) {
        msg += `\u0648 ${productCount - 1} \u0645\u0646\u062a\u062c\u0627\u062a \u062b\u0627\u0646\u064a\u0629\n`;
    }
    msg += `\n`;

    msg += `\u062d\u0627\u0628\u064a\u0646 \u0646\u0633\u0627\u0639\u062f\u0643 \u062a\u062e\u062a\u0627\u0631\u061f \u0639\u0646\u062f\u0643 ${discountPercent}% \u062e\u0635\u0645 \u0639\u0644\u0649 \u0623\u064a \u0645\u0646\u062a\u062c \u0634\u0641\u062a\u0647 \ud83c\udf81\n\n`;

    if (storeUrl) {
        msg += `\ud83d\udc49 ${storeUrl}\n\n`;
    }

    msg += `\u0643\u0648\u062f \u0627\u0644\u062e\u0635\u0645: *${discountCode}*`;

    return msg;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Core tracking
    trackProductView,

    // Detection
    detectBrowseAbandonment,

    // Smart filtering
    shouldTrigger,

    // Recovery messaging
    sendBrowseRecovery,

    // All-in-one processor (for cron/keep-alive)
    processAllPending,

    // Click & conversion tracking
    trackClick,
    trackConversion,
    checkOrderForBrowseConversion,

    // Dashboard stats
    getBrowseStats,

    // Maintenance
    cleanupOldEvents,

    // Message builders (exported for testing/customization)
    buildSingleProductMessage,
    buildMultiProductMessage,

    // Config (exported for inspection/override)
    CONFIG
};
