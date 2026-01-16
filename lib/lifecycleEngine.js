/**
 * LIFECYCLE ENGINE - The Brain of رِبح
 * 
 * Simple logic:
 * - New Customer → Welcome + Mystery Gift (Attraction)
 * - Abandoned Cart → AI Recovery + Discount (Conversion)
 * - Order Created → AI Upsell based on purchase (Upsell)
 * - 30 days no buy → Win-back offer (Continuity)
 */

const fs = require('fs');
const path = require('path');

// AI Offer Generator
let offerGenerator;
try {
    offerGenerator = require('./offerGenerator');
} catch (e) {
    console.log('⚠️ Offer generator not available, using fallbacks');
    offerGenerator = null;
}

// Email Sender
let emailSender;
try {
    emailSender = require('./emailSender');
} catch (e) {
    console.log('⚠️ Email sender not available');
    emailSender = null;
}

// Referral System
let referralSystem;
try {
    referralSystem = require('./referralSystem');
} catch (e) {
    console.log('⚠️ Referral system not available');
    referralSystem = null;
}

// Sequence Engine (multi-step emails)
let sequenceEngine;
try {
    sequenceEngine = require('./sequenceEngine');
} catch (e) {
    console.log('⚠️ Sequence engine not available');
    sequenceEngine = null;
}

// SMS/WhatsApp Sender
let smsSender;
try {
    smsSender = require('./smsSender');
} catch (e) {
    console.log('⚠️ SMS sender not available');
    smsSender = null;
}

// Telegram Sender (FREE notifications to store owners)
let telegramSender;
try {
    telegramSender = require('./telegramSender');
} catch (e) {
    console.log('⚠️ Telegram sender not available');
    telegramSender = null;
}

// Data files
const STORES_FILE = path.join(__dirname, '..', 'data', 'stores.json');
const CUSTOMERS_FILE = path.join(__dirname, '..', 'data', 'customers.json');

// Ensure customers file exists
if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify([]));
}

function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Main event processor - handles all store events
 */
async function processEvent(eventType, merchantId, data) {
    console.log(`🧠 [Lifecycle] Processing: ${eventType} for merchant ${merchantId}`);

    const stores = readJSON(STORES_FILE);
    const store = stores.find(s => String(s.merchant) === String(merchantId));

    if (!store) {
        console.log(`❌ Store not found: ${merchantId}`);
        return;
    }

    switch (eventType) {
        case 'customer.created':
        case 'app.installed':
            await handleNewCustomer(store, data);
            break;

        case 'cart.abandoned':
        case 'abandoned_cart.created':
            await handleAbandonedCart(store, data);
            break;

        case 'order.created':
            await handleOrderCreated(store, data);
            break;
    }
}

/**
 * ATTRACTION: New Customer → Welcome + Mystery Gift
 */
async function handleNewCustomer(store, data) {
    const email = data.email || data.customer?.email;
    if (!email) return;

    console.log(`🎉 [Attraction] New customer: ${email}`);

    // Track customer
    const customers = readJSON(CUSTOMERS_FILE);
    customers.push({
        storeId: store.merchant,
        email: email,
        firstSeen: new Date().toISOString(),
        lastPurchase: null,
        totalOrders: 0
    });
    writeJSON(CUSTOMERS_FILE, customers);

    // Generate AI welcome offer
    let offer;
    if (offerGenerator) {
        offer = await offerGenerator.createOffer(store, 'attraction', {
            customerEmail: email
        });
        console.log(`🤖 AI Generated Welcome Offer:`, offer.headline);
    } else {
        offer = {
            headline: "🎁 هدية ترحيبية خاصة!",
            body: "أهلاً بك! احصل على خصم 15% على طلبك الأول",
            discount: 15
        };
    }

    console.log(`📧 Welcome offer ready for ${email}: ${offer.headline}`);
    return offer;
}

/**
 * CONVERSION: Abandoned Cart → AI Recovery + Discount
 */
async function handleAbandonedCart(store, data) {
    const email = data.email || data.customer?.email;
    const cartValue = data.total || data.cart_total || 0;
    const products = data.products || data.items || [];
    const checkoutUrl = data.checkout_url || data.checkoutUrl || '#';

    if (!email) return;

    console.log(`🛒 [Conversion] Abandoned cart: ${email} - Value: ${cartValue}`);

    // Use AI to create personalized offer
    let offer;
    if (offerGenerator) {
        offer = await offerGenerator.createOffer(store, 'conversion', {
            products,
            customerEmail: email,
            cartValue
        });
        console.log(`🤖 AI Generated Offer:`, offer.headline);
    } else {
        // Fallback discount based on cart value
        let discount = 5;
        if (cartValue > 500) discount = 10;
        if (cartValue > 1000) discount = 15;
        offer = {
            headline: "🛒 سلتك تنتظرك!",
            body: `أكمل طلبك واحصل على خصم ${discount}%`,
            offer: `خصم ${discount}%`,
            discount,
            urgency: "العرض صالح لمدة ساعتين فقط"
        };
    }

    // START MULTI-STEP SEQUENCE (if available)
    if (sequenceEngine) {
        sequenceEngine.startSequence('cart_recovery', store.merchant, email, {
            storeName: store.merchantName || 'متجر رِبح',
            checkoutUrl: checkoutUrl,
            cartValue: cartValue,
            products: products
        });
        console.log(`📧 Multi-step sequence started for ${email}`);
    } else if (emailSender) {
        // Fallback: single email
        await emailSender.sendOfferEmail(email, offer, {
            storeName: store.merchantName || 'متجر رِبح',
            checkoutUrl: checkoutUrl
        });
    }

    // ALSO SEND WHATSAPP (if phone available)
    const phone = data.mobile || data.phone || data.customer?.mobile;
    if (smsSender && phone) {
        await smsSender.sendCartRecoveryWhatsApp(
            phone,
            data.customer?.name || 'عميلنا',
            cartValue,
            checkoutUrl,
            offer.discount || 10
        );
    }

    // NOTIFY STORE OWNER VIA TELEGRAM (FREE!)
    if (telegramSender) {
        await telegramSender.notifyAbandonedCart(store.merchant, {
            customer: data.customer,
            items: products,
            total: cartValue
        });
    }

    return offer;
}

/**
 * UPSELL: Order Created → AI Upsell based on purchase
 */
async function handleOrderCreated(store, data) {
    const email = data.email || data.customer?.email;
    const products = data.products || data.items || [];
    const storeUrl = data.store_url || `https://${store.merchant}.salla.sa`;

    if (!email) return;

    console.log(`💰 [Upsell] Order completed: ${email}`);

    // Update customer record
    const customers = readJSON(CUSTOMERS_FILE);
    const customer = customers.find(c => c.email === email && c.storeId === store.merchant);
    if (customer) {
        customer.lastPurchase = new Date().toISOString();
        customer.totalOrders = (customer.totalOrders || 0) + 1;
        writeJSON(CUSTOMERS_FILE, customers);
    }

    // Generate AI upsell offer based on purchased products
    let offer;
    if (offerGenerator) {
        offer = await offerGenerator.createOffer(store, 'upsell', {
            products,
            customerEmail: email
        });
        console.log(`🤖 AI Generated Upsell Offer:`, offer.headline);
    } else {
        offer = {
            headline: "💎 أكمل تجربتك!",
            body: "شكراً لطلبك! احصل على خصم 20% على طلبك القادم",
            offer: "خصم 20% على الطلب القادم",
            discount: 20,
            urgency: "صالح لمدة 7 أيام",
            bonuses: ["نقاط ولاء مضاعفة"]
        };
    }

    // SEND THE EMAIL (with delay so it doesn't feel like a bot)
    if (emailSender) {
        // Wait 10 minutes before sending upsell
        setTimeout(async () => {
            await emailSender.sendOfferEmail(email, offer, {
                storeName: store.merchantName || 'متجر رِبح',
                checkoutUrl: storeUrl
            });
        }, 10 * 60 * 1000); // 10 minutes
        console.log(`📧 Upsell email scheduled for ${email} in 10 minutes`);
    }

    // CREATE REFERRAL LINK for customer
    if (referralSystem) {
        const storeDomain = `${store.merchant}.salla.sa`;
        const referral = referralSystem.getOrCreateReferral(store.merchant, email, storeDomain);

        // Send referral email 1 hour after order
        if (emailSender) {
            setTimeout(async () => {
                const referralOffer = {
                    headline: "🎁 اربح مع أصدقائك!",
                    body: `شكراً لطلبك! شارك رابطك الخاص مع أصدقائك - يحصلون على خصم 10% وتحصل أنت على 15% من كل طلب!`,
                    offer: `رابطك الخاص: ${referral.link}`,
                    bonuses: ["صديقك يحصل على 10% خصم", "أنت تحصل على 15% من كل طلب", "لا حد أقصى للأرباح!"]
                };
                await emailSender.sendOfferEmail(email, referralOffer, {
                    storeName: store.merchantName || 'متجر رِبح',
                    checkoutUrl: referral.link
                });
            }, 60 * 60 * 1000); // 1 hour after order
            console.log(`🔗 Referral email scheduled for ${email} in 1 hour`);
        }
    }

    return offer;
}

/**
 * CONTINUITY: Check for customers who haven't bought in 30 days
 * Run this on a schedule (e.g., daily cron)
 */
async function checkInactiveCustomers() {
    console.log(`🔄 [Continuity] Checking for inactive customers...`);

    const customers = readJSON(CUSTOMERS_FILE);
    const stores = readJSON(STORES_FILE);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveCustomers = customers.filter(c => {
        if (!c.lastPurchase) return false;
        // Skip if already sent win-back in last 14 days
        if (c.lastWinbackSent) {
            const lastSent = new Date(c.lastWinbackSent);
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            if (lastSent > fourteenDaysAgo) return false;
        }
        return new Date(c.lastPurchase) < thirtyDaysAgo;
    });

    console.log(`📋 Found ${inactiveCustomers.length} inactive customers to contact`);

    let sentCount = 0;
    for (const customer of inactiveCustomers) {
        const store = stores.find(s => String(s.merchant) === String(customer.storeId));
        if (!store) continue;

        // Generate AI win-back offer
        let offer;
        if (offerGenerator) {
            offer = await offerGenerator.createOffer(store, 'continuity', {
                customerEmail: customer.email
            });
            console.log(`🤖 AI Generated Win-back Offer:`, offer.headline);
        } else {
            offer = {
                headline: "😊 اشتقنا لك!",
                body: "مر وقت منذ آخر زيارة لنا. جهزنا لك عرض خاص: خصم 25% على أي طلب!",
                offer: "خصم 25% على أي طلب",
                discount: 25,
                urgency: "صالح لمدة 7 أيام فقط",
                bonuses: ["شحن مجاني", "هدية مفاجأة مع الطلب"]
            };
        }

        // SEND THE EMAIL
        if (emailSender) {
            const storeUrl = `https://${store.merchant}.salla.sa`;
            await emailSender.sendOfferEmail(customer.email, offer, {
                storeName: store.merchantName || 'متجر رِبح',
                checkoutUrl: storeUrl
            });

            // Mark as contacted
            customer.lastWinbackSent = new Date().toISOString();
            sentCount++;
        }
    }

    // Save updated customer records
    writeJSON(CUSTOMERS_FILE, customers);

    console.log(`✅ Win-back emails sent: ${sentCount}`);
    return { checked: inactiveCustomers.length, sent: sentCount };
}

module.exports = {
    processEvent,
    handleNewCustomer,
    handleAbandonedCart,
    handleOrderCreated,
    checkInactiveCustomers
};
