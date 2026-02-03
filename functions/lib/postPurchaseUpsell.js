/**
 * POST-PURCHASE UPSELL ENGINE - RIBH
 *
 * Trigger: order.created webhook
 * Flow: Order completed → Analyze products → AI recommendation →
 *       Schedule WhatsApp (2hr delay) → Track click → Track conversion
 *
 * RULES:
 * - Max 1 upsell per order
 * - Max 2 upsells per customer per week
 * - 10-15% discount on suggested product
 * - Arabic messages at 3rd grade reading level
 * - Upsell expires after 24 hours
 *
 * Firestore: stores/{storeId}/upsells/{upsellId}
 */

const admin = require('firebase-admin');
const getDb = () => admin.firestore();

// ==========================================
// MODULE IMPORTS (graceful fallbacks)
// ==========================================

let whatsappClient;
try {
    whatsappClient = require('./whatsappClient');
    console.log('✅ [Upsell] WhatsApp Client loaded');
} catch (e) {
    console.log('⚠️ [Upsell] WhatsApp client not available');
    whatsappClient = null;
}

let offerGenerator;
try {
    offerGenerator = require('./offerGenerator');
    console.log('✅ [Upsell] Offer Generator loaded');
} catch (e) {
    console.log('⚠️ [Upsell] Offer generator not available');
    offerGenerator = null;
}

let productMemory;
try {
    productMemory = require('./productMemory');
    console.log('✅ [Upsell] Product Memory loaded');
} catch (e) {
    console.log('⚠️ [Upsell] Product memory not available');
    productMemory = null;
}

const { normalizeSaudiPhone, extractCustomerPhone, extractCustomerName } = require('./sallaWebhooks');

// ==========================================
// CONSTANTS
// ==========================================

const UPSELL_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours
const UPSELL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_UPSELLS_PER_WEEK = 2;
const MAX_UPSELLS_PER_ORDER = 1;
const DEFAULT_DISCOUNT = 15; // 15% off
const MIN_DISCOUNT = 10;
const MAX_DISCOUNT = 15;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODELS = { primary: 'allam-2-7b', fallback: 'llama-3.1-8b-instant' };

// ==========================================
// UPSELL MESSAGE TEMPLATES (Arabic, simple)
// ==========================================

const UPSELL_TEMPLATES = [
    // Template 1: Social proof style
    (ctx) => {
        const { customerName, storeName, suggestedProduct, discount, productUrl } = ctx;
        return `مرحبا ${customerName}! 🎉\n` +
            `شكراً على طلبك من ${storeName}\n` +
            `عملاء مثلك اشتروا أيضاً ${suggestedProduct.name}\n` +
            `خصم خاص لك: ${discount}% لمدة 24 ساعة فقط\n` +
            `${productUrl}`;
    },
    // Template 2: Complementary product style
    (ctx) => {
        const { customerName, purchasedProduct, suggestedProduct, discount, discountCode, productUrl } = ctx;
        return `${customerName}! طلبك في الطريق 🚚\n` +
            `بما إنك حبيت ${purchasedProduct}, شوف ${suggestedProduct.name}\n` +
            `يناسب اللي اخذته تماماً\n` +
            `استخدم كود ${discountCode} واحصل على ${discount}% خصم\n` +
            `${productUrl}`;
    },
    // Template 3: Exclusive offer style
    (ctx) => {
        const { customerName, suggestedProduct, discount, productUrl } = ctx;
        return `${customerName} 👋\n` +
            `جهزنا لك عرض حصري!\n` +
            `${suggestedProduct.name} بخصم ${discount}%\n` +
            `العرض ينتهي خلال 24 ساعة ⏰\n` +
            `اطلبه الحين:\n` +
            `${productUrl}`;
    }
];

// ==========================================
// PRODUCT CATEGORY MAPPINGS (for recommendations)
// ==========================================

const COMPLEMENTARY_CATEGORIES = {
    'electronics': ['accessories', 'cases', 'chargers', 'cables'],
    'phones': ['cases', 'screen_protectors', 'chargers', 'earphones'],
    'fashion': ['accessories', 'bags', 'shoes', 'jewelry'],
    'beauty': ['skincare', 'makeup', 'perfume', 'tools'],
    'skincare': ['beauty', 'sunscreen', 'moisturizer', 'serum'],
    'home': ['decor', 'kitchen', 'storage', 'lighting'],
    'kitchen': ['appliances', 'utensils', 'storage', 'cleaning'],
    'sports': ['supplements', 'gear', 'clothing', 'shoes'],
    'baby': ['toys', 'clothing', 'feeding', 'care'],
    'food': ['snacks', 'drinks', 'supplements', 'cooking']
};

// ==========================================
// MAIN TRIGGER: Handle Order Created
// ==========================================

/**
 * Main entry point - called when order.created webhook fires
 * @param {Object} orderData - Parsed order data from sallaWebhooks
 * @param {Object} storeSettings - Store configuration
 * @returns {Object} Result with upsell scheduling info
 */
async function handleOrderCreated(orderData, storeSettings) {
    const storeId = String(orderData.merchant || storeSettings?.merchant || storeSettings?.storeId);
    const customerId = String(orderData.customer?.id || orderData.customer?.phone || 'unknown');
    const customerPhone = extractCustomerPhone(orderData._raw || orderData) || orderData.customer?.phone;
    const customerName = extractCustomerName(orderData._raw || orderData) || orderData.customer?.name || 'عميلنا';
    const orderId = String(orderData.id || orderData.referenceId);
    const products = orderData.items || [];
    const orderTotal = orderData.total || 0;

    console.log(`🛍️ [Upsell] Order created: ${orderId} | Customer: ${customerName} | Total: ${orderTotal} SAR`);

    // Validate required data
    if (!storeId || storeId === 'undefined') {
        console.log('❌ [Upsell] No storeId, skipping upsell');
        return { success: false, error: 'missing_store_id' };
    }

    if (!customerPhone) {
        console.log('⚠️ [Upsell] No phone number, skipping upsell');
        return { success: false, error: 'no_phone' };
    }

    if (!products || products.length === 0) {
        console.log('⚠️ [Upsell] No products in order, skipping upsell');
        return { success: false, error: 'no_products' };
    }

    // Normalize phone
    const normalizedPhone = normalizeSaudiPhone(customerPhone);
    if (!normalizedPhone) {
        console.log('⚠️ [Upsell] Could not normalize phone, skipping upsell');
        return { success: false, error: 'invalid_phone' };
    }

    try {
        // Check: already sent upsell for this order?
        const existingUpsell = await checkExistingOrderUpsell(storeId, orderId);
        if (existingUpsell) {
            console.log(`⚠️ [Upsell] Already sent upsell for order ${orderId}`);
            return { success: false, error: 'upsell_already_sent', upsellId: existingUpsell.id };
        }

        // Check: customer weekly limit
        const weeklyCount = await getCustomerWeeklyUpsellCount(storeId, customerId);
        if (weeklyCount >= MAX_UPSELLS_PER_WEEK) {
            console.log(`⚠️ [Upsell] Customer ${customerId} hit weekly limit (${weeklyCount}/${MAX_UPSELLS_PER_WEEK})`);
            return { success: false, error: 'weekly_limit_reached', weeklyCount };
        }

        // Generate AI product recommendations
        const recommendations = await generateUpsellRecommendations(products, storeId, customerId);
        if (!recommendations || recommendations.length === 0) {
            console.log('⚠️ [Upsell] No recommendations generated');
            return { success: false, error: 'no_recommendations' };
        }

        // Schedule the upsell message
        const result = await scheduleUpsellMessage({
            storeId,
            orderId,
            customerId,
            customerPhone: normalizedPhone,
            customerName,
            originalProducts: products,
            suggestedProducts: recommendations,
            storeName: storeSettings?.merchantName || storeSettings?.name || orderData.merchantName || 'المتجر',
            storeUrl: storeSettings?.storeUrl || `https://${storeId}.salla.sa`,
            orderTotal
        });

        console.log(`✅ [Upsell] Scheduled for order ${orderId} | Send at: ${result.sendAt}`);
        return { success: true, upsellId: result.upsellId, sendAt: result.sendAt };

    } catch (error) {
        console.error(`❌ [Upsell] Error processing order ${orderId}:`, error.message);
        return { success: false, error: error.message };
    }
}

// ==========================================
// AI PRODUCT RECOMMENDATIONS
// ==========================================

/**
 * Use AI to pick the best upsell products based on what was purchased
 * @param {Array} products - Products from the order
 * @param {string} storeId - Store identifier
 * @param {string} customerId - Customer identifier (optional, for history)
 * @returns {Array} Recommended products for upsell
 */
async function generateUpsellRecommendations(products, storeId, customerId) {
    console.log(`🤖 [Upsell] Generating recommendations for ${products.length} products`);

    // Strategy 1: Try product memory for history-based recommendations
    if (productMemory && customerId) {
        try {
            const related = await productMemory.getRelatedProducts(storeId, customerId, 3);
            if (related.recommendations && related.recommendations.length > 0) {
                console.log(`📊 [Upsell] Found ${related.recommendations.length} history-based recommendations`);
                return related.recommendations.map(rec => ({
                    id: rec.productId,
                    name: rec.name || 'منتج مقترح',
                    category: rec.category || 'general',
                    score: rec.score,
                    source: 'history'
                }));
            }
        } catch (e) {
            console.log(`⚠️ [Upsell] Product memory lookup failed: ${e.message}`);
        }
    }

    // Strategy 2: Try AI-powered recommendations via Groq
    if (GROQ_API_KEY) {
        try {
            const aiRecs = await getAIRecommendations(products);
            if (aiRecs && aiRecs.length > 0) {
                console.log(`🤖 [Upsell] AI generated ${aiRecs.length} recommendations`);
                return aiRecs;
            }
        } catch (e) {
            console.log(`⚠️ [Upsell] AI recommendation failed: ${e.message}`);
        }
    }

    // Strategy 3: Fallback - category-based complementary products
    const fallbackRecs = getCategoryBasedRecommendations(products);
    console.log(`📋 [Upsell] Fallback: ${fallbackRecs.length} category-based recommendations`);
    return fallbackRecs;
}

/**
 * Call Groq API for AI-powered product recommendations
 */
async function getAIRecommendations(products, model = GROQ_MODELS.primary) {
    const productNames = products.map(p => p.name || p.product_name || 'منتج').slice(0, 5).join('، ');
    const categories = [...new Set(products.map(p => p.category || 'general'))].join('، ');

    const prompt = `أنت خبير تجارة إلكترونية سعودي. العميل اشترى: ${productNames}
الفئات: ${categories}

اقترح 3 منتجات تكميلية يحتاجها العميل.
أرجع JSON فقط بهذا الشكل:
[{"name":"اسم المنتج","category":"الفئة","reason":"سبب قصير"}]

القواعد:
- منتجات مكملة وليست نفس المنتجات
- أسماء عربية بسيطة
- أسباب مقنعة وقصيرة`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8,
                max_tokens: 300
            })
        });

        // Rate limit fallback
        if (res.status === 429 && model === GROQ_MODELS.primary) {
            return getAIRecommendations(products, GROQ_MODELS.fallback);
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        const match = content?.match(/\[[\s\S]*\]/);

        if (match) {
            const recs = JSON.parse(match[0]);
            return recs.slice(0, 3).map((rec, i) => ({
                id: `ai_rec_${Date.now()}_${i}`,
                name: rec.name || 'منتج مقترح',
                category: rec.category || 'general',
                reason: rec.reason || '',
                score: 10 - i,
                source: 'ai'
            }));
        }

        throw new Error('Invalid AI response format');
    } catch (e) {
        if (model === GROQ_MODELS.primary) {
            return getAIRecommendations(products, GROQ_MODELS.fallback);
        }
        throw e;
    }
}

/**
 * Fallback: Generate recommendations based on product categories
 */
function getCategoryBasedRecommendations(products) {
    const purchasedCategories = products.map(p =>
        (p.category || 'general').toLowerCase()
    );

    const suggestions = new Set();

    for (const cat of purchasedCategories) {
        const complementary = COMPLEMENTARY_CATEGORIES[cat] || COMPLEMENTARY_CATEGORIES['default'] || [];
        for (const comp of complementary) {
            if (!purchasedCategories.includes(comp)) {
                suggestions.add(comp);
            }
        }
    }

    // If no complementary found, suggest from popular categories
    if (suggestions.size === 0) {
        suggestions.add('accessories');
        suggestions.add('gifts');
    }

    return Array.from(suggestions).slice(0, 3).map((cat, i) => ({
        id: `cat_rec_${Date.now()}_${i}`,
        name: getCategoryDisplayName(cat),
        category: cat,
        reason: 'يكمل طلبك',
        score: 5 - i,
        source: 'category'
    }));
}

/**
 * Get Arabic display name for category
 */
function getCategoryDisplayName(category) {
    const names = {
        'accessories': 'إكسسوارات',
        'cases': 'أغطية حماية',
        'chargers': 'شواحن',
        'cables': 'كيبلات',
        'screen_protectors': 'حماية شاشة',
        'earphones': 'سماعات',
        'bags': 'حقائب',
        'shoes': 'أحذية',
        'jewelry': 'مجوهرات',
        'skincare': 'عناية بالبشرة',
        'makeup': 'مكياج',
        'perfume': 'عطور',
        'tools': 'أدوات',
        'decor': 'ديكور',
        'kitchen': 'مطبخ',
        'storage': 'تنظيم',
        'lighting': 'إضاءة',
        'supplements': 'مكملات',
        'gear': 'معدات',
        'clothing': 'ملابس',
        'toys': 'ألعاب',
        'feeding': 'رضاعة',
        'care': 'عناية',
        'snacks': 'سناكات',
        'drinks': 'مشروبات',
        'cooking': 'طبخ',
        'gifts': 'هدايا',
        'sunscreen': 'واقي شمس',
        'moisturizer': 'مرطب',
        'serum': 'سيروم',
        'appliances': 'أجهزة',
        'utensils': 'أواني',
        'cleaning': 'تنظيف'
    };
    return names[category] || category;
}

// ==========================================
// AI UPSELL MESSAGE GENERATION
// ==========================================

/**
 * Generate a personalized Arabic upsell message using AI
 */
async function generateUpsellMessage(context) {
    const { customerName, storeName, purchasedProduct, suggestedProduct, discount } = context;

    // Try AI generation first
    if (GROQ_API_KEY) {
        try {
            const aiMessage = await generateAIUpsellMessage(context);
            if (aiMessage) return aiMessage;
        } catch (e) {
            console.log(`⚠️ [Upsell] AI message generation failed: ${e.message}`);
        }
    }

    // Fallback: pick a random template
    const templateIndex = Math.floor(Math.random() * UPSELL_TEMPLATES.length);
    const template = UPSELL_TEMPLATES[templateIndex];

    return template({
        customerName,
        storeName,
        purchasedProduct: purchasedProduct || 'طلبك',
        suggestedProduct: suggestedProduct || { name: 'منتج مميز' },
        discount: discount || DEFAULT_DISCOUNT,
        discountCode: `UPSELL${discount || DEFAULT_DISCOUNT}`,
        productUrl: context.productUrl || context.storeUrl || '#'
    });
}

/**
 * Use Groq AI to craft a natural Arabic upsell message
 */
async function generateAIUpsellMessage(context, model = GROQ_MODELS.primary) {
    const { customerName, storeName, purchasedProduct, suggestedProduct, discount } = context;

    const prompt = `أنت كاتب رسائل واتساب سعودي محترف. اكتب رسالة upsell قصيرة وطبيعية.

المعلومات:
- اسم العميل: ${customerName}
- المتجر: ${storeName}
- المنتج المشترى: ${purchasedProduct}
- المنتج المقترح: ${suggestedProduct.name}
- سبب الاقتراح: ${suggestedProduct.reason || 'يكمل طلبك'}
- الخصم: ${discount}%
- الرابط: [LINK]

القواعد:
- لهجة سعودية بسيطة (مستوى الصف الثالث)
- قصيرة (4-6 أسطر)
- ليست بيعية - تبدو كنصيحة صديق
- استخدم إيموجي واحد أو اثنين فقط
- اذكر أن الخصم لمدة 24 ساعة

أرجع الرسالة فقط، بدون شرح.`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.85,
                max_tokens: 250
            })
        });

        if (res.status === 429 && model === GROQ_MODELS.primary) {
            return generateAIUpsellMessage(context, GROQ_MODELS.fallback);
        }

        const data = await res.json();
        const message = data.choices?.[0]?.message?.content;

        if (message && message.length > 20 && message.length < 500) {
            // Replace [LINK] placeholder with actual URL
            return message.replace(/\[LINK\]/g, context.productUrl || context.storeUrl || '#');
        }

        return null;
    } catch (e) {
        if (model === GROQ_MODELS.primary) {
            return generateAIUpsellMessage(context, GROQ_MODELS.fallback);
        }
        return null;
    }
}

// ==========================================
// SCHEDULING & SENDING
// ==========================================

/**
 * Schedule upsell message for delayed sending (2 hours after order)
 * @param {Object} params - Upsell parameters
 * @returns {Object} Scheduled upsell info
 */
async function scheduleUpsellMessage(params) {
    const {
        storeId, orderId, customerId, customerPhone, customerName,
        originalProducts, suggestedProducts, storeName, storeUrl, orderTotal
    } = params;

    const now = Date.now();
    const sendAt = new Date(now + UPSELL_DELAY_MS);
    const expiresAt = new Date(now + UPSELL_DELAY_MS + UPSELL_EXPIRY_MS);

    // Pick the top recommendation
    const topSuggestion = suggestedProducts[0];

    // Calculate discount (10-15% based on order value)
    const discount = orderTotal >= 500 ? MAX_DISCOUNT :
                     orderTotal >= 200 ? 13 :
                     MIN_DISCOUNT;

    // Build discount code
    const discountCode = `UPSELL${discount}`;

    // Build product URL
    const productUrl = topSuggestion.url || `${storeUrl}?ref=upsell&code=${discountCode}`;

    // Get the first purchased product name for the message
    const purchasedProductName = originalProducts[0]?.name || originalProducts[0]?.product_name || 'طلبك';

    // Generate the personalized message
    const message = await generateUpsellMessage({
        customerName,
        storeName,
        purchasedProduct: purchasedProductName,
        suggestedProduct: topSuggestion,
        discount,
        discountCode,
        productUrl,
        storeUrl
    });

    // Create upsell document in Firestore
    const upsellData = {
        orderId,
        customerId,
        customerPhone,
        customerName,
        originalProducts: originalProducts.map(p => ({
            id: p.id || p.product_id,
            name: p.name || p.product_name || 'منتج',
            price: p.price || 0,
            quantity: p.quantity || 1
        })),
        suggestedProducts: suggestedProducts.slice(0, 3).map(p => ({
            id: p.id,
            name: p.name,
            category: p.category,
            reason: p.reason || '',
            source: p.source || 'unknown'
        })),
        message,
        discount,
        discountCode,
        productUrl,
        storeName,
        storeUrl,
        orderTotal,

        // Timing
        createdAt: new Date(now).toISOString(),
        sendAt: sendAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        sentAt: null,
        clickedAt: null,
        convertedAt: null,

        // Tracking
        revenue: 0,
        status: 'scheduled' // scheduled → sent → clicked → converted | expired
    };

    const upsellRef = await getDb()
        .collection('stores').doc(storeId)
        .collection('upsells')
        .add(upsellData);

    console.log(`📝 [Upsell] Created: ${upsellRef.id} | Send at: ${sendAt.toISOString()}`);

    return {
        upsellId: upsellRef.id,
        sendAt: sendAt.toISOString(),
        message,
        discount,
        suggestedProduct: topSuggestion.name
    };
}

/**
 * Send a scheduled upsell message via WhatsApp
 * Called by the cron/keep-alive processor
 * @param {string} upsellId - Firestore document ID
 * @param {string} storeId - Store identifier
 * @returns {Object} Send result
 */
async function sendUpsellMessage(upsellId, storeId) {
    console.log(`📤 [Upsell] Sending upsell ${upsellId} for store ${storeId}`);

    try {
        // Get the upsell document
        const upsellRef = getDb()
            .collection('stores').doc(storeId)
            .collection('upsells').doc(upsellId);

        const upsellDoc = await upsellRef.get();

        if (!upsellDoc.exists) {
            console.log(`❌ [Upsell] Document not found: ${upsellId}`);
            return { success: false, error: 'not_found' };
        }

        const upsell = upsellDoc.data();

        // Check if already sent
        if (upsell.status !== 'scheduled') {
            console.log(`⚠️ [Upsell] Already processed: ${upsellId} (status: ${upsell.status})`);
            return { success: false, error: 'already_processed', status: upsell.status };
        }

        // Check if expired (past send window)
        if (new Date(upsell.expiresAt) < new Date()) {
            await upsellRef.update({ status: 'expired' });
            console.log(`⏰ [Upsell] Expired: ${upsellId}`);
            return { success: false, error: 'expired' };
        }

        // Send via WhatsApp
        if (!whatsappClient) {
            console.log('❌ [Upsell] WhatsApp client not available');
            return { success: false, error: 'whatsapp_unavailable' };
        }

        const isConnected = await whatsappClient.isConnected(storeId);
        if (!isConnected) {
            console.log(`⚠️ [Upsell] WhatsApp not connected for store ${storeId}`);
            return { success: false, error: 'whatsapp_disconnected' };
        }

        const sendResult = await whatsappClient.sendMessage(
            storeId,
            upsell.customerPhone,
            upsell.message
        );

        if (sendResult.success) {
            // Update status to sent
            await upsellRef.update({
                status: 'sent',
                sentAt: new Date().toISOString(),
                messageId: sendResult.messageId || null
            });

            console.log(`✅ [Upsell] Sent to ${upsell.customerPhone} | Message ID: ${sendResult.messageId}`);
            return { success: true, messageId: sendResult.messageId };
        } else {
            console.log(`❌ [Upsell] Send failed: ${sendResult.error}`);
            await upsellRef.update({
                status: 'failed',
                failReason: sendResult.error
            });
            return { success: false, error: sendResult.error };
        }

    } catch (error) {
        console.error(`❌ [Upsell] Send error for ${upsellId}:`, error.message);
        return { success: false, error: error.message };
    }
}

// ==========================================
// PENDING UPSELL PROCESSOR (Cron/Keep-alive)
// ==========================================

/**
 * Process all pending upsell messages that are due for sending
 * Call this from your keep-alive or cron job (every 5 minutes)
 * @param {string} storeId - Optional: process specific store only
 * @returns {Object} Processing results
 */
async function processPendingUpsells(storeId) {
    const now = new Date().toISOString();
    console.log(`⏰ [Upsell] Processing pending upsells...`);

    try {
        let query;

        if (storeId) {
            // Process specific store
            query = getDb()
                .collection('stores').doc(storeId)
                .collection('upsells')
                .where('status', '==', 'scheduled')
                .where('sendAt', '<=', now);
        } else {
            // Process all stores - need to iterate
            const storesSnap = await getDb().collection('stores').get();
            const results = { processed: 0, sent: 0, failed: 0, expired: 0 };

            for (const storeDoc of storesSnap.docs) {
                const storeResult = await processPendingUpsells(storeDoc.id);
                results.processed += storeResult.processed || 0;
                results.sent += storeResult.sent || 0;
                results.failed += storeResult.failed || 0;
                results.expired += storeResult.expired || 0;
            }

            console.log(`✅ [Upsell] All stores processed:`, results);
            return results;
        }

        const pendingSnap = await query.get();
        const results = { processed: 0, sent: 0, failed: 0, expired: 0 };

        for (const doc of pendingSnap.docs) {
            results.processed++;
            const upsell = doc.data();

            // Check expiry
            if (new Date(upsell.expiresAt) < new Date()) {
                await doc.ref.update({ status: 'expired' });
                results.expired++;
                continue;
            }

            // Send it
            const sendResult = await sendUpsellMessage(doc.id, storeId);
            if (sendResult.success) {
                results.sent++;
            } else {
                results.failed++;
            }
        }

        console.log(`✅ [Upsell] Store ${storeId}: ${results.sent} sent, ${results.failed} failed, ${results.expired} expired`);
        return results;

    } catch (error) {
        console.error(`❌ [Upsell] Processing error:`, error.message);
        return { processed: 0, sent: 0, failed: 0, expired: 0, error: error.message };
    }
}

// ==========================================
// TRACKING: Clicks & Conversions
// ==========================================

/**
 * Record when customer clicks the upsell link
 * @param {string} upsellId - Upsell document ID
 * @param {string} storeId - Store identifier
 * @returns {Object} Update result
 */
async function trackUpsellClick(upsellId, storeId) {
    console.log(`👆 [Upsell] Click tracked: ${upsellId}`);

    try {
        const upsellRef = getDb()
            .collection('stores').doc(storeId)
            .collection('upsells').doc(upsellId);

        const doc = await upsellRef.get();
        if (!doc.exists) {
            return { success: false, error: 'not_found' };
        }

        const upsell = doc.data();

        // Only update if status is 'sent' (first click)
        if (upsell.status === 'sent') {
            await upsellRef.update({
                status: 'clicked',
                clickedAt: new Date().toISOString()
            });
        }

        // Log analytics event
        await getDb().collection('analytics_events').add({
            type: 'upsell_clicked',
            data: {
                storeId,
                upsellId,
                orderId: upsell.orderId,
                customerId: upsell.customerId,
                suggestedProduct: upsell.suggestedProducts?.[0]?.name,
                discount: upsell.discount
            },
            timestamp: new Date().toISOString()
        });

        return { success: true, status: 'clicked' };

    } catch (error) {
        console.error(`❌ [Upsell] Click tracking error:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Record when customer completes the upsell purchase
 * @param {string} upsellId - Upsell document ID
 * @param {string} storeId - Store identifier
 * @param {number} revenue - Revenue from the upsell purchase
 * @returns {Object} Update result
 */
async function trackUpsellConversion(upsellId, storeId, revenue) {
    console.log(`💰 [Upsell] Conversion tracked: ${upsellId} | Revenue: ${revenue} SAR`);

    try {
        const upsellRef = getDb()
            .collection('stores').doc(storeId)
            .collection('upsells').doc(upsellId);

        const doc = await upsellRef.get();
        if (!doc.exists) {
            return { success: false, error: 'not_found' };
        }

        const upsell = doc.data();

        await upsellRef.update({
            status: 'converted',
            convertedAt: new Date().toISOString(),
            revenue: revenue || 0
        });

        // Log analytics event
        await getDb().collection('analytics_events').add({
            type: 'upsell_converted',
            data: {
                storeId,
                upsellId,
                orderId: upsell.orderId,
                customerId: upsell.customerId,
                suggestedProduct: upsell.suggestedProducts?.[0]?.name,
                discount: upsell.discount,
                revenue: revenue || 0
            },
            timestamp: new Date().toISOString()
        });

        return { success: true, status: 'converted', revenue };

    } catch (error) {
        console.error(`❌ [Upsell] Conversion tracking error:`, error.message);
        return { success: false, error: error.message };
    }
}

// ==========================================
// STATS & ANALYTICS
// ==========================================

/**
 * Get upsell performance stats for a store
 * @param {string} storeId - Store identifier
 * @param {number} days - Number of days to look back (default 30)
 * @returns {Object} Dashboard-ready stats
 */
async function getUpsellStats(storeId, days = 30) {
    console.log(`📊 [Upsell] Getting stats for store ${storeId} (${days} days)`);

    try {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const upsellsSnap = await getDb()
            .collection('stores').doc(storeId)
            .collection('upsells')
            .where('createdAt', '>=', cutoff)
            .get();

        const upsells = upsellsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Count by status
        const byStatus = {
            scheduled: 0,
            sent: 0,
            clicked: 0,
            converted: 0,
            expired: 0,
            failed: 0
        };

        let totalRevenue = 0;
        let totalDiscount = 0;
        const dailyRevenue = {};

        for (const upsell of upsells) {
            byStatus[upsell.status] = (byStatus[upsell.status] || 0) + 1;

            if (upsell.status === 'converted' && upsell.revenue) {
                totalRevenue += upsell.revenue;
                const day = (upsell.convertedAt || upsell.createdAt).split('T')[0];
                dailyRevenue[day] = (dailyRevenue[day] || 0) + upsell.revenue;
            }

            if (upsell.discount) {
                totalDiscount += upsell.discount;
            }
        }

        const totalSent = byStatus.sent + byStatus.clicked + byStatus.converted;
        const totalClicked = byStatus.clicked + byStatus.converted;

        return {
            period: `${days} days`,
            total: upsells.length,
            byStatus,
            rates: {
                sendRate: pct(totalSent, upsells.length),
                clickRate: pct(totalClicked, totalSent),
                conversionRate: pct(byStatus.converted, totalSent),
                overallConversion: pct(byStatus.converted, upsells.length)
            },
            revenue: {
                total: totalRevenue,
                average: byStatus.converted > 0 ? Math.round(totalRevenue / byStatus.converted) : 0,
                daily: dailyRevenue
            },
            averageDiscount: upsells.length > 0 ? Math.round(totalDiscount / upsells.length) : 0,
            topProducts: getTopUpsellProducts(upsells)
        };

    } catch (error) {
        console.error(`❌ [Upsell] Stats error:`, error.message);
        return {
            period: `${days} days`,
            total: 0,
            byStatus: {},
            rates: {},
            revenue: { total: 0, average: 0, daily: {} },
            error: error.message
        };
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check if an upsell was already sent for this order
 */
async function checkExistingOrderUpsell(storeId, orderId) {
    const snap = await getDb()
        .collection('stores').doc(storeId)
        .collection('upsells')
        .where('orderId', '==', orderId)
        .limit(1)
        .get();

    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Get how many upsells were sent to this customer in the past week
 */
async function getCustomerWeeklyUpsellCount(storeId, customerId) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const snap = await getDb()
        .collection('stores').doc(storeId)
        .collection('upsells')
        .where('customerId', '==', customerId)
        .where('createdAt', '>=', oneWeekAgo)
        .get();

    return snap.size;
}

/**
 * Get top performing upsell products
 */
function getTopUpsellProducts(upsells) {
    const products = {};

    for (const upsell of upsells) {
        const suggested = upsell.suggestedProducts?.[0];
        if (!suggested) continue;

        const key = suggested.name || suggested.id;
        if (!products[key]) {
            products[key] = {
                name: suggested.name,
                category: suggested.category,
                sent: 0,
                clicked: 0,
                converted: 0,
                revenue: 0
            };
        }

        products[key].sent++;
        if (upsell.status === 'clicked' || upsell.status === 'converted') {
            products[key].clicked++;
        }
        if (upsell.status === 'converted') {
            products[key].converted++;
            products[key].revenue += upsell.revenue || 0;
        }
    }

    return Object.values(products)
        .sort((a, b) => b.converted - a.converted || b.revenue - a.revenue)
        .slice(0, 10);
}

/**
 * Calculate percentage safely
 */
function pct(numerator, denominator) {
    if (!denominator || denominator === 0) return '0%';
    return `${Math.round((numerator / denominator) * 100)}%`;
}

/**
 * Expire all old upsells that were never sent
 * Call periodically from cron
 */
async function expireOldUpsells(storeId) {
    const now = new Date().toISOString();

    try {
        const snap = await getDb()
            .collection('stores').doc(storeId)
            .collection('upsells')
            .where('status', '==', 'scheduled')
            .where('expiresAt', '<', now)
            .get();

        let expired = 0;
        for (const doc of snap.docs) {
            await doc.ref.update({ status: 'expired' });
            expired++;
        }

        if (expired > 0) {
            console.log(`🧹 [Upsell] Expired ${expired} old upsells for store ${storeId}`);
        }

        // Also expire sent-but-not-clicked after 24h
        const sentSnap = await getDb()
            .collection('stores').doc(storeId)
            .collection('upsells')
            .where('status', '==', 'sent')
            .where('expiresAt', '<', now)
            .get();

        for (const doc of sentSnap.docs) {
            await doc.ref.update({ status: 'expired' });
            expired++;
        }

        return { expired };

    } catch (error) {
        console.error(`❌ [Upsell] Expiry error:`, error.message);
        return { expired: 0, error: error.message };
    }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Main trigger
    handleOrderCreated,

    // AI recommendations
    generateUpsellRecommendations,

    // Scheduling & sending
    scheduleUpsellMessage,
    sendUpsellMessage,

    // Cron processor
    processPendingUpsells,

    // Tracking
    trackUpsellClick,
    trackUpsellConversion,

    // Stats
    getUpsellStats,

    // Maintenance
    expireOldUpsells,

    // Constants (for testing/config)
    UPSELL_DELAY_MS,
    UPSELL_EXPIRY_MS,
    MAX_UPSELLS_PER_WEEK,
    MAX_UPSELLS_PER_ORDER,
    DEFAULT_DISCOUNT
};
