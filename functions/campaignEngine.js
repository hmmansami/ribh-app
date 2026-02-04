/**
 * Campaign Engine - Enhanced Campaign System for RIBH Merchants
 *
 * Provides pre-built Arabic campaign templates, smart audience segmentation,
 * AI-powered message generation, scheduling, and revenue tracking.
 *
 * Integrates with:
 *   - campaignLauncher.js (sending infrastructure)
 *   - offerGenerator.js (AI message generation)
 *   - whatsappBridge.js (WhatsApp delivery)
 *
 * Collections:
 *   merchant_campaigns          - Merchant-facing campaigns (distinct from admin outreach)
 *   merchant_campaigns/{id}/recipients - Recipients per campaign
 *   campaign_events             - Delivery/read/click/conversion events
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// Lazy-load optional dependencies
let offerGenerator, whatsappBridge, campaignLauncher;
try { offerGenerator = require('./lib/offerGenerator'); } catch (_) { offerGenerator = null; }
try { whatsappBridge = require('./lib/whatsappBridge'); } catch (_) { whatsappBridge = null; }
try { campaignLauncher = require('./lib/campaignLauncher'); } catch (_) { campaignLauncher = null; }

// ==========================================
// CAMPAIGN TEMPLATES (Arabic, ready to launch)
// ==========================================

const CAMPAIGN_TEMPLATES = [
    {
        id: 'cart_recovery',
        icon: '\uD83D\uDD25',
        name: '\u062D\u0645\u0644\u0629 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0627\u0644\u0633\u0644\u0627\u062A',
        nameEn: 'Cart Recovery Campaign',
        description: '\u0627\u0633\u062A\u0647\u062F\u0627\u0641 \u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0644\u064A \u062A\u0631\u0643\u0648\u0627 \u0633\u0644\u0627\u062A\u0647\u0645',
        descriptionEn: 'Auto-targets customers with abandoned carts',
        audienceType: 'abandoned_carts',
        estimatedImpact: '+25% \u0645\u0646 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0645\u0641\u0642\u0648\u062F\u0629',
        estimatedImpactEn: '+25% of lost sales recovered',
        category: 'recovery',
        defaultMessage: '{greeting} {customer_name}\n\n\uD83D\uDED2 \u0633\u0644\u062A\u0643 \u0644\u0633\u0627 \u0645\u0648\u062C\u0648\u062F\u0629!\n\n\u0639\u0646\u062F\u0643 \u0645\u0646\u062A\u062C\u0627\u062A \u0628\u0642\u064A\u0645\u0629 {cart_value} \u0631.\u0633 \u062A\u0646\u062A\u0638\u0631\u0643 \u0641\u064A {store_name}.\n\n\uD83C\uDF81 \u062E\u0635\u0645 {discount_code} \u062E\u0627\u0635 \u0644\u0643 \u0644\u0645\u062F\u0629 24 \u0633\u0627\u0639\u0629 \u0641\u0642\u0637!\n\n\u0623\u0643\u0645\u0644 \u0637\u0644\u0628\u0643 \u0627\u0644\u062D\u064A\u0646 \u2190',
        color: '#EF4444'
    },
    {
        id: 'winback',
        icon: '\uD83D\uDCB0',
        name: '\u062D\u0645\u0644\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u062E\u0627\u0645\u0644\u064A\u0646',
        nameEn: 'Win-Back Campaign',
        description: '\u0627\u0633\u062A\u0647\u062F\u0627\u0641 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0644\u064A \u0645\u0627 \u0627\u0634\u062A\u0631\u0648\u0627 \u0645\u0646 30 \u064A\u0648\u0645+',
        descriptionEn: 'Targets customers inactive for 30+ days',
        audienceType: 'dormant',
        estimatedImpact: '\u0627\u0633\u062A\u0631\u062C\u0627\u0639 15% \u0645\u0646 \u0627\u0644\u0639\u0645\u0644\u0627\u0621',
        estimatedImpactEn: 'Recover 15% of dormant customers',
        category: 'retention',
        defaultMessage: '{greeting} {customer_name}\n\n\uD83D\uDC94 \u0648\u062D\u0634\u062A\u0646\u0627!\n\n\u0645\u0631\u062A \u0641\u062A\u0631\u0629 \u0645\u0646 \u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629 \u0644\u0643 \u0641\u064A {store_name}.\n\u062C\u0647\u0632\u0646\u0627 \u0644\u0643 \u0639\u0631\u0636 \u062E\u0627\u0635 \uD83C\uDF81\n\n\u062E\u0635\u0645 {discount_code} \u0639\u0644\u0649 \u0643\u0644 \u0634\u064A \u0644\u0645\u062F\u0629 48 \u0633\u0627\u0639\u0629!\n\n\u062A\u0633\u0648\u0642 \u0627\u0644\u062D\u064A\u0646 \u2190',
        color: '#F59E0B'
    },
    {
        id: 'special_offer',
        icon: '\uD83C\uDF89',
        name: '\u062D\u0645\u0644\u0629 \u0639\u0631\u0636 \u062E\u0627\u0635',
        nameEn: 'Special Offer Campaign',
        description: '\u0639\u0631\u0636 \u0633\u0631\u064A\u0639 \u0623\u0648 \u062E\u0635\u0645 \u0644\u0643\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621',
        descriptionEn: 'Flash sale / discount to all customers',
        audienceType: 'all_customers',
        estimatedImpact: '\u0632\u064A\u0627\u062F\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A 20%+',
        estimatedImpactEn: 'Boost sales by 20%+',
        category: 'promotion',
        defaultMessage: '{greeting} {customer_name}\n\n\uD83D\uDD25 \u0639\u0631\u0636 \u062E\u0627\u0635 \u0645\u0646 {store_name}!\n\n\u062E\u0635\u0645 {discount_code} \u0639\u0644\u0649 \u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \uD83D\uDE0D\n\n\u2B50 \u0627\u0644\u0639\u0631\u0636 \u0644\u0641\u062A\u0631\u0629 \u0645\u062D\u062F\u0648\u062F\u0629\n\n\u062A\u0633\u0648\u0642 \u0627\u0644\u062D\u064A\u0646 \u2190',
        color: '#8B5CF6'
    },
    {
        id: 'vip',
        icon: '\u2B50',
        name: '\u062D\u0645\u0644\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0645\u0645\u064A\u0632\u064A\u0646',
        nameEn: 'VIP Campaign',
        description: '\u0639\u0631\u0636 \u062D\u0635\u0631\u064A \u0644\u0623\u0641\u0636\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0625\u0646\u0641\u0627\u0642\u0627\u064B',
        descriptionEn: 'Exclusive offer for top spenders',
        audienceType: 'high_value',
        estimatedImpact: '\u0632\u064A\u0627\u062F\u0629 \u0648\u0644\u0627\u0621 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 40%',
        estimatedImpactEn: '40% increase in loyalty',
        category: 'loyalty',
        defaultMessage: '{greeting} {customer_name}\n\n\uD83D\uDC51 \u0623\u0646\u062A \u0645\u0646 \u0639\u0645\u0644\u0627\u0626\u0646\u0627 \u0627\u0644\u0645\u0645\u064A\u0632\u064A\u0646!\n\n\u062D\u0628\u064A\u0646\u0627 \u0646\u0634\u0643\u0631\u0643 \u0628\u0639\u0631\u0636 \u062D\u0635\u0631\u064A \u0645\u0646 {store_name} \uD83C\uDF1F\n\n\uD83C\uDF81 \u062E\u0635\u0645 {discount_code} + \u0634\u062D\u0646 \u0645\u062C\u0627\u0646\u064A\n\n\u0647\u0627\u0644\u0639\u0631\u0636 \u0628\u0633 \u0644\u0643 \u2764\uFE0F',
        color: '#F59E0B'
    },
    {
        id: 'new_product',
        icon: '\uD83C\uDD95',
        name: '\u062D\u0645\u0644\u0629 \u0627\u0644\u0645\u0646\u062A\u062C \u0627\u0644\u062C\u062F\u064A\u062F',
        nameEn: 'New Product Launch',
        description: '\u0625\u0639\u0644\u0627\u0646 \u0645\u0646\u062A\u062C\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0644\u0643\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621',
        descriptionEn: 'Announce new products to customers',
        audienceType: 'all_customers',
        estimatedImpact: '\u0645\u0628\u064A\u0639\u0627\u062A \u0641\u0648\u0631\u064A\u0629 \u0645\u0646 \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0623\u0648\u0644',
        estimatedImpactEn: 'Instant sales from day one',
        category: 'launch',
        defaultMessage: '{greeting} {customer_name}\n\n\uD83C\uDD95 \u0648\u0635\u0644 \u062C\u062F\u064A\u062F \u0641\u064A {store_name}!\n\n\u0645\u0646\u062A\u062C\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0648\u0645\u0645\u064A\u0632\u0629 \u062A\u0646\u062A\u0638\u0631\u0643 \uD83D\uDE0D\n\n\uD83C\uDF81 \u0623\u0648\u0644 50 \u0637\u0644\u0628 \u064A\u062D\u0635\u0644 \u0639\u0644\u0649 \u0634\u062D\u0646 \u0645\u062C\u0627\u0646\u064A!\n\n\u0634\u0648\u0641 \u0627\u0644\u062C\u062F\u064A\u062F \u2190',
        color: '#3B82F6'
    },
    {
        id: 'review_collection',
        icon: '\uD83D\uDCCA',
        name: '\u062D\u0645\u0644\u0629 \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u0627\u062A',
        nameEn: 'Review Collection',
        description: '\u0637\u0644\u0628 \u062A\u0642\u064A\u064A\u0645\u0627\u062A \u0645\u0646 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0628\u0639\u062F \u0627\u0644\u0634\u0631\u0627\u0621',
        descriptionEn: 'Ask for reviews after purchase',
        audienceType: 'recent_buyers',
        estimatedImpact: '+35% \u062A\u0642\u064A\u064A\u0645\u0627\u062A \u062C\u062F\u064A\u062F\u0629',
        estimatedImpactEn: '+35% new reviews',
        category: 'engagement',
        defaultMessage: '{greeting} {customer_name}\n\n\u2764\uFE0F \u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0633\u0648\u0642\u0643 \u0645\u0646 {store_name}!\n\n\u0631\u0623\u064A\u0643 \u064A\u0647\u0645\u0646\u0627 \u062C\u062F\u0627\u064B \uD83C\uDF1F\n\n\u0644\u0648 \u062A\u0642\u062F\u0631 \u062A\u0639\u0637\u064A\u0646\u0627 \u062A\u0642\u064A\u064A\u0645 \u0633\u0631\u064A\u0639 \u0628\u064A\u0633\u0627\u0639\u062F\u0646\u0627 \u0646\u062A\u0637\u0648\u0631 \uD83D\uDE4F\n\n\uD83C\uDF81 \u0643\u0644 \u062A\u0642\u064A\u064A\u0645 = \u062E\u0635\u0645 5% \u0639\u0644\u0649 \u0637\u0644\u0628\u0643 \u0627\u0644\u062C\u0627\u064A!',
        color: '#10B981'
    },
    {
        id: 'birthday',
        icon: '\uD83C\uDF82',
        name: '\u062D\u0645\u0644\u0629 \u0623\u0639\u064A\u0627\u062F \u0627\u0644\u0645\u064A\u0644\u0627\u062F',
        nameEn: 'Birthday Campaign',
        description: '\u062E\u0635\u0648\u0645\u0627\u062A \u0639\u064A\u062F \u0645\u064A\u0644\u0627\u062F \u062A\u0644\u0642\u0627\u0626\u064A\u0629',
        descriptionEn: 'Automatic birthday discounts',
        audienceType: 'birthday_this_month',
        estimatedImpact: '\u0645\u0639\u062F\u0644 \u0627\u0633\u062A\u062C\u0627\u0628\u0629 45%+',
        estimatedImpactEn: '45%+ response rate',
        category: 'engagement',
        defaultMessage: '{greeting} {customer_name}\n\n\uD83C\uDF82\uD83C\uDF89 \u0643\u0644 \u0639\u0627\u0645 \u0648\u0623\u0646\u062A \u0628\u062E\u064A\u0631!\n\n\u0628\u0645\u0646\u0627\u0633\u0628\u0629 \u0639\u064A\u062F \u0645\u064A\u0644\u0627\u062F\u0643\u060C {store_name} \u064A\u0647\u062F\u064A\u0643:\n\n\uD83C\uDF81 \u062E\u0635\u0645 {discount_code} \u062E\u0627\u0635 \u0628\u0633 \u0644\u0643!\n\n\u0627\u0633\u062A\u0645\u062A\u0639 \u0628\u0647\u062F\u064A\u062A\u0643 \u2190 \u2764\uFE0F',
        color: '#EC4899'
    },
    {
        id: 'ramadan',
        icon: '\uD83D\uDD4C',
        name: '\u062D\u0645\u0644\u0629 \u0631\u0645\u0636\u0627\u0646',
        nameEn: 'Ramadan Campaign',
        description: '\u0639\u0631\u0648\u0636 \u0631\u0645\u0636\u0627\u0646 \u0627\u0644\u0645\u0648\u0633\u0645\u064A\u0629',
        descriptionEn: 'Seasonal Ramadan offers',
        audienceType: 'all_customers',
        estimatedImpact: '\u0645\u0628\u064A\u0639\u0627\u062A \u0645\u0648\u0633\u0645\u064A\u0629 +40%',
        estimatedImpactEn: '+40% seasonal sales',
        category: 'seasonal',
        defaultMessage: '{greeting} {customer_name}\n\n\uD83C\uDF19 \u0631\u0645\u0636\u0627\u0646 \u0643\u0631\u064A\u0645!\n\n{store_name} \u064A\u062C\u0647\u0632 \u0644\u0643 \u0639\u0631\u0648\u0636 \u0631\u0645\u0636\u0627\u0646 \u0627\u0644\u062D\u0635\u0631\u064A\u0629 \uD83C\uDF1F\n\n\uD83C\uDF81 \u062E\u0635\u0645 {discount_code} + \u0634\u062D\u0646 \u0645\u062C\u0627\u0646\u064A\n\u2728 \u0639\u0631\u0648\u0636 \u062A\u0646\u062A\u0647\u064A \u0645\u0639 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0634\u0647\u0631\n\n\u062A\u0633\u0648\u0642 \u0627\u0644\u062D\u064A\u0646 \u2190',
        color: '#059669'
    }
];

// ==========================================
// AUDIENCE SEGMENTS
// ==========================================

const AUDIENCE_SEGMENTS = {
    abandoned_carts: {
        name: '\u0633\u0644\u0627\u062A \u0645\u062A\u0631\u0648\u0643\u0629',
        nameEn: 'Abandoned Carts',
        description: '\u0639\u0645\u0644\u0627\u0621 \u062A\u0631\u0643\u0648\u0627 \u0633\u0644\u0627\u062A\u0647\u0645 \u062E\u0644\u0627\u0644 7 \u0623\u064A\u0627\u0645',
        icon: '\uD83D\uDED2'
    },
    dormant: {
        name: '\u0639\u0645\u0644\u0627\u0621 \u062E\u0627\u0645\u0644\u064A\u0646',
        nameEn: 'Dormant Customers',
        description: '\u0644\u0645 \u064A\u0634\u062A\u0631\u0648\u0627 \u0645\u0646\u0630 30+ \u064A\u0648\u0645',
        icon: '\uD83D\uDCA4'
    },
    all_customers: {
        name: '\u0643\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621',
        nameEn: 'All Customers',
        description: '\u062C\u0645\u064A\u0639 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0645\u0633\u062C\u0644\u064A\u0646',
        icon: '\uD83D\uDC65'
    },
    high_value: {
        name: '\u0639\u0645\u0644\u0627\u0621 \u0645\u0645\u064A\u0632\u064A\u0646',
        nameEn: 'High Value',
        description: '\u0623\u0639\u0644\u0649 20% \u0625\u0646\u0641\u0627\u0642\u0627\u064B',
        icon: '\uD83D\uDC8E'
    },
    recent_buyers: {
        name: '\u0645\u0634\u062A\u0631\u064A\u0646 \u062D\u062F\u064A\u062B\u0627\u064B',
        nameEn: 'Recent Buyers',
        description: '\u0627\u0634\u062A\u0631\u0648\u0627 \u062E\u0644\u0627\u0644 14 \u064A\u0648\u0645',
        icon: '\uD83D\uDED2'
    },
    birthday_this_month: {
        name: '\u0623\u0639\u064A\u0627\u062F \u0645\u064A\u0644\u0627\u062F \u0627\u0644\u0634\u0647\u0631',
        nameEn: 'Birthdays This Month',
        description: '\u0639\u0645\u0644\u0627\u0621 \u0639\u064A\u062F \u0645\u064A\u0644\u0627\u062F\u0647\u0645 \u0647\u0627\u0644\u0634\u0647\u0631',
        icon: '\uD83C\uDF82'
    },
    new_customers: {
        name: '\u0639\u0645\u0644\u0627\u0621 \u062C\u062F\u062F',
        nameEn: 'New Customers',
        description: '\u0627\u0646\u0636\u0645\u0648\u0627 \u062E\u0644\u0627\u0644 30 \u064A\u0648\u0645',
        icon: '\uD83C\uDD95'
    },
    loyal: {
        name: '\u0639\u0645\u0644\u0627\u0621 \u0623\u0648\u0641\u064A\u0627\u0621',
        nameEn: 'Loyal Customers',
        description: '3+ \u0637\u0644\u0628\u0627\u062A',
        icon: '\u2764\uFE0F'
    }
};

// ==========================================
// COLLECTIONS
// ==========================================

const MERCHANT_CAMPAIGNS = 'merchant_campaigns';
const CAMPAIGN_EVENTS = 'campaign_events';

// ==========================================
// TEMPLATE FUNCTIONS
// ==========================================

/**
 * Get all available campaign templates
 */
function getTemplates() {
    return CAMPAIGN_TEMPLATES.map(t => ({
        id: t.id,
        icon: t.icon,
        name: t.name,
        nameEn: t.nameEn,
        description: t.description,
        descriptionEn: t.descriptionEn,
        audienceType: t.audienceType,
        estimatedImpact: t.estimatedImpact,
        estimatedImpactEn: t.estimatedImpactEn,
        category: t.category,
        color: t.color
    }));
}

/**
 * Get a specific template with its default message
 */
function getTemplate(templateId) {
    return CAMPAIGN_TEMPLATES.find(t => t.id === templateId) || null;
}

// ==========================================
// AUDIENCE SEGMENTATION
// ==========================================

/**
 * Get audience count and sample for a given segment type
 * @param {string} merchantId
 * @param {string} audienceType - One of AUDIENCE_SEGMENTS keys
 * @param {object} [filters] - Optional custom filters
 * @returns {{ count: number, sample: Array, segment: object }}
 */
async function getAudience(merchantId, audienceType, filters = {}) {
    const db = getDb();
    const segment = AUDIENCE_SEGMENTS[audienceType];
    if (!segment) {
        return { count: 0, sample: [], segment: null };
    }

    let customers = [];
    const now = new Date();

    try {
        switch (audienceType) {
            case 'abandoned_carts': {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                const snap = await db.collection('abandoned_carts')
                    .where('merchantId', '==', merchantId)
                    .where('status', '==', 'abandoned')
                    .where('createdAt', '>=', sevenDaysAgo)
                    .limit(500)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().customerName || d.data().customer_name || '',
                    phone: d.data().customerPhone || d.data().customer_phone || '',
                    email: d.data().customerEmail || d.data().customer_email || '',
                    cartValue: d.data().cartValue || d.data().total || 0,
                    lastProduct: d.data().products?.[0]?.name || ''
                }));
                break;
            }

            case 'dormant': {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .where('lastOrderAt', '<', thirtyDaysAgo)
                    .limit(500)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.data().customerName || '',
                    phone: d.data().phone || d.data().customerPhone || '',
                    email: d.data().email || '',
                    totalSpent: d.data().totalSpent || 0,
                    lastOrderAt: d.data().lastOrderAt
                }));
                break;
            }

            case 'high_value': {
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .orderBy('totalSpent', 'desc')
                    .limit(100)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.data().customerName || '',
                    phone: d.data().phone || d.data().customerPhone || '',
                    email: d.data().email || '',
                    totalSpent: d.data().totalSpent || 0,
                    orderCount: d.data().orderCount || 0
                }));
                break;
            }

            case 'recent_buyers': {
                const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .where('lastOrderAt', '>=', fourteenDaysAgo)
                    .limit(500)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.data().customerName || '',
                    phone: d.data().phone || d.data().customerPhone || '',
                    email: d.data().email || '',
                    lastOrderAt: d.data().lastOrderAt
                }));
                break;
            }

            case 'new_customers': {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .where('createdAt', '>=', thirtyDaysAgo)
                    .limit(500)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.data().customerName || '',
                    phone: d.data().phone || d.data().customerPhone || '',
                    email: d.data().email || ''
                }));
                break;
            }

            case 'birthday_this_month': {
                const currentMonth = now.getMonth() + 1;
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .where('birthMonth', '==', currentMonth)
                    .limit(500)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.data().customerName || '',
                    phone: d.data().phone || d.data().customerPhone || '',
                    email: d.data().email || ''
                }));
                break;
            }

            case 'loyal': {
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .where('orderCount', '>=', 3)
                    .limit(500)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.data().customerName || '',
                    phone: d.data().phone || d.data().customerPhone || '',
                    email: d.data().email || '',
                    orderCount: d.data().orderCount || 0,
                    totalSpent: d.data().totalSpent || 0
                }));
                break;
            }

            case 'all_customers':
            default: {
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .limit(500)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.data().customerName || '',
                    phone: d.data().phone || d.data().customerPhone || '',
                    email: d.data().email || ''
                }));
                break;
            }
        }

        // Apply custom filters
        if (filters.minSpend) {
            customers = customers.filter(c => (c.totalSpent || 0) >= filters.minSpend);
        }
        if (filters.hasPhone) {
            customers = customers.filter(c => !!c.phone);
        }

    } catch (error) {
        console.error(`[CampaignEngine] Audience query error for ${audienceType}:`, error.message);
        // Return empty on error - don't block the UI
    }

    return {
        count: customers.length,
        sample: customers.slice(0, 5),
        segment
    };
}

// ==========================================
// MESSAGE GENERATION
// ==========================================

/**
 * Generate a campaign message using AI or template fallback
 * @param {string} templateId
 * @param {object} storeData - { storeName, storeUrl }
 * @param {object} [options] - { discountCode, discountPercent, customMessage }
 * @returns {{ message: string, isAI: boolean }}
 */
async function generateMessage(templateId, storeData, options = {}) {
    const template = getTemplate(templateId);
    if (!template) {
        return { message: '', isAI: false };
    }

    // Try AI generation first
    if (offerGenerator) {
        try {
            const offer = await offerGenerator.generateOffer({
                name: '\u0639\u0645\u064A\u0644\u0646\u0627',
                value: options.cartValue || 0,
                products: options.products || [],
                season: template.id === 'ramadan' ? 'ramadan' : 'default',
                productType: options.productType || 'default'
            });

            if (offer && offer.fullMessage) {
                // Inject store name and discount code
                let aiMessage = offer.fullMessage
                    .replace(/\{store_name\}/g, storeData.storeName || '\u0645\u062A\u062C\u0631\u0646\u0627')
                    .replace(/\{discount_code\}/g, options.discountCode || '10%');
                return { message: aiMessage, isAI: true };
            }
        } catch (e) {
            console.log('[CampaignEngine] AI generation failed, using template:', e.message);
        }
    }

    // Fallback to template
    const greeting = getTimeGreeting();
    let message = template.defaultMessage
        .replace(/\{greeting\}/g, greeting)
        .replace(/\{customer_name\}/g, '{customer_name}')
        .replace(/\{store_name\}/g, storeData.storeName || '\u0645\u062A\u062C\u0631\u0646\u0627')
        .replace(/\{discount_code\}/g, options.discountCode || '10%')
        .replace(/\{cart_value\}/g, options.cartValue || '0');

    return { message, isAI: false };
}

/**
 * Get time-appropriate Arabic greeting
 */
function getTimeGreeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return '\u0635\u0628\u0627\u062D \u0627\u0644\u062E\u064A\u0631 \u2600\uFE0F';
    if (h >= 12 && h < 21) return '\u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631 \uD83C\uDF19';
    return '\u0623\u0647\u0644\u0627\u064B \u2B50';
}

/**
 * Fill a message template with customer-specific data
 */
function fillMessage(messageTemplate, customer, storeData) {
    return messageTemplate
        .replace(/\{customer_name\}/g, customer.name || '\u0639\u0645\u064A\u0644\u0646\u0627')
        .replace(/\{store_name\}/g, storeData.storeName || '\u0645\u062A\u062C\u0631\u0646\u0627')
        .replace(/\{last_product\}/g, customer.lastProduct || '')
        .replace(/\{cart_value\}/g, customer.cartValue || '0')
        .replace(/\{total_saved\}/g, customer.totalSaved || '0')
        .replace(/\{greeting\}/g, getTimeGreeting());
}

// ==========================================
// CAMPAIGN CRUD
// ==========================================

/**
 * Create a campaign from a template
 * @param {string} merchantId
 * @param {string} templateId
 * @param {object} options - { message, discountCode, schedule, audienceFilters }
 * @returns {{ campaignId: string, campaign: object }}
 */
async function createFromTemplate(merchantId, templateId, options = {}) {
    const db = getDb();
    const template = getTemplate(templateId);

    if (!template) {
        throw new Error('Template not found: ' + templateId);
    }

    // Get audience count
    const audience = await getAudience(merchantId, template.audienceType, options.audienceFilters);

    const campaign = {
        merchantId,
        templateId,
        templateName: template.name,
        templateIcon: template.icon,
        name: options.name || template.name,
        message: options.message || template.defaultMessage,
        channel: options.channel || 'whatsapp',
        discountCode: options.discountCode || '',
        audienceType: template.audienceType,
        audienceCount: audience.count,
        status: 'draft',
        schedule: options.schedule || null, // null = send now, { date, time } = scheduled
        stats: {
            total: audience.count,
            sent: 0,
            delivered: 0,
            read: 0,
            clicked: 0,
            converted: 0,
            revenue: 0,
            failed: 0
        },
        rateLimit: options.rateLimit || 50, // messages per batch
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        launchedAt: null,
        completedAt: null,
        category: template.category,
        color: template.color
    };

    const ref = await db.collection(MERCHANT_CAMPAIGNS).add(campaign);
    console.log(`[CampaignEngine] Created campaign "${campaign.name}" (${ref.id}) for merchant ${merchantId}`);

    return { campaignId: ref.id, campaign: { id: ref.id, ...campaign } };
}

/**
 * Launch a campaign - start sending messages
 * @param {string} campaignId
 * @returns {{ status: string, message: string, sent: number }}
 */
async function launchCampaign(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(MERCHANT_CAMPAIGNS).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
        throw new Error('Campaign not found');
    }

    const campaign = campaignDoc.data();
    if (campaign.status === 'running') {
        return { status: 'running', message: '\u0627\u0644\u062D\u0645\u0644\u0629 \u062A\u0639\u0645\u0644 \u0628\u0627\u0644\u0641\u0639\u0644', sent: 0 };
    }
    if (campaign.status === 'completed') {
        throw new Error('\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0639\u0627\u062F\u0629 \u062A\u0634\u063A\u064A\u0644 \u062D\u0645\u0644\u0629 \u0645\u0643\u062A\u0645\u0644\u0629');
    }

    // Update status to running
    await campaignRef.update({
        status: 'running',
        launchedAt: campaign.launchedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Get audience and start sending
    const audience = await getAudience(campaign.merchantId, campaign.audienceType);
    let sent = 0;
    let failed = 0;

    // Get store data for message filling
    let storeData = { storeName: '' };
    try {
        const merchantDoc = await db.collection('merchants').doc(campaign.merchantId).get();
        if (merchantDoc.exists) {
            storeData = {
                storeName: merchantDoc.data().storeName || merchantDoc.data().store_name || '',
                storeUrl: merchantDoc.data().storeUrl || merchantDoc.data().store_url || ''
            };
        }
    } catch (e) {
        console.log('[CampaignEngine] Could not load merchant data:', e.message);
    }

    // Process recipients in batches
    const batchSize = campaign.rateLimit || 50;
    const recipients = audience.count > 0 ? (await getAudience(campaign.merchantId, campaign.audienceType)).sample : [];

    // For full audience, re-query without limit
    let fullAudience = [];
    try {
        const fullResult = await getFullAudience(campaign.merchantId, campaign.audienceType);
        fullAudience = fullResult;
    } catch (e) {
        fullAudience = recipients;
    }

    // Store recipients in subcollection for tracking
    const batch = db.batch();
    let batchCount = 0;

    for (const customer of fullAudience) {
        const recipientRef = campaignRef.collection('recipients').doc();
        const personalizedMessage = fillMessage(campaign.message, customer, storeData);

        batch.set(recipientRef, {
            customerId: customer.id,
            name: customer.name || '',
            phone: customer.phone || '',
            email: customer.email || '',
            message: personalizedMessage,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;
        if (batchCount >= 450) {
            await batch.commit();
            batchCount = 0;
        }
    }

    if (batchCount > 0) {
        await batch.commit();
    }

    // Start sending first batch via WhatsApp
    sent = await sendCampaignBatch(campaignId, batchSize);

    // Update stats
    await campaignRef.update({
        'stats.sent': sent,
        'stats.total': fullAudience.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[CampaignEngine] Launched campaign ${campaignId}: ${sent} sent to ${fullAudience.length} recipients`);

    return {
        status: 'running',
        message: `\u062A\u0645 \u0625\u0637\u0644\u0627\u0642 \u0627\u0644\u062D\u0645\u0644\u0629! \u062A\u0645 \u0625\u0631\u0633\u0627\u0644 ${sent} \u0631\u0633\u0627\u0644\u0629`,
        sent,
        total: fullAudience.length
    };
}

/**
 * Get full audience without the 5-sample limit
 */
async function getFullAudience(merchantId, audienceType) {
    const db = getDb();
    const now = new Date();
    let customers = [];

    try {
        switch (audienceType) {
            case 'abandoned_carts': {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                const snap = await db.collection('abandoned_carts')
                    .where('merchantId', '==', merchantId)
                    .where('status', '==', 'abandoned')
                    .where('createdAt', '>=', sevenDaysAgo)
                    .limit(1000)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().customerName || d.data().customer_name || '',
                    phone: d.data().customerPhone || d.data().customer_phone || '',
                    email: d.data().customerEmail || d.data().customer_email || '',
                    cartValue: d.data().cartValue || d.data().total || 0,
                    lastProduct: d.data().products?.[0]?.name || ''
                }));
                break;
            }

            case 'dormant': {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .where('lastOrderAt', '<', thirtyDaysAgo)
                    .limit(1000)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || '',
                    phone: d.data().phone || '',
                    email: d.data().email || '',
                    totalSpent: d.data().totalSpent || 0
                }));
                break;
            }

            default: {
                const snap = await db.collection('customers')
                    .where('merchantId', '==', merchantId)
                    .limit(1000)
                    .get();
                customers = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || '',
                    phone: d.data().phone || '',
                    email: d.data().email || ''
                }));
                break;
            }
        }
    } catch (error) {
        console.error('[CampaignEngine] Full audience query error:', error.message);
    }

    // Filter to only those with phone numbers (needed for WhatsApp)
    return customers.filter(c => !!c.phone);
}

/**
 * Send a batch of campaign messages
 */
async function sendCampaignBatch(campaignId, batchSize = 50) {
    const db = getDb();
    const campaignRef = db.collection(MERCHANT_CAMPAIGNS).doc(campaignId);

    const pendingSnap = await campaignRef.collection('recipients')
        .where('status', '==', 'pending')
        .limit(batchSize)
        .get();

    if (pendingSnap.empty) return 0;

    let sent = 0;

    for (const doc of pendingSnap.docs) {
        const recipient = doc.data();

        try {
            // Send via WhatsApp Bridge
            if (whatsappBridge && recipient.phone) {
                // Use the bridge's sendMessage
                const campaignDoc = await campaignRef.get();
                const merchantId = campaignDoc.data().merchantId;

                try {
                    await whatsappBridge.sendMessage(merchantId, recipient.phone, recipient.message);
                    await doc.ref.update({
                        status: 'sent',
                        sentAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    sent++;
                } catch (sendErr) {
                    await doc.ref.update({
                        status: 'failed',
                        error: sendErr.message,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else {
                // Mark as sent (simulated) if no WhatsApp bridge
                await doc.ref.update({
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                sent++;
            }

            // Add human-like delay (2-5 seconds)
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

        } catch (e) {
            console.error(`[CampaignEngine] Send error for ${recipient.phone}:`, e.message);
        }
    }

    // Update campaign stats
    await campaignRef.update({
        'stats.sent': admin.firestore.FieldValue.increment(sent),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Check if all recipients processed
    const stillPending = await campaignRef.collection('recipients')
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    if (stillPending.empty) {
        await campaignRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return sent;
}

/**
 * Pause a running campaign
 */
async function pauseCampaign(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(MERCHANT_CAMPAIGNS).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');

    if (campaignDoc.data().status !== 'running') {
        return { status: campaignDoc.data().status, message: '\u0627\u0644\u062D\u0645\u0644\u0629 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062A\u0634\u063A\u064A\u0644' };
    }

    await campaignRef.update({
        status: 'paused',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { status: 'paused', message: '\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u062D\u0645\u0644\u0629' };
}

// ==========================================
// CAMPAIGN STATS & ANALYTICS
// ==========================================

/**
 * Get detailed stats for a specific campaign
 */
async function getCampaignStats(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(MERCHANT_CAMPAIGNS).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');

    const campaign = campaignDoc.data();
    const stats = campaign.stats || {};

    // Calculate rates
    const total = stats.total || 0;
    const sent = stats.sent || 0;
    const delivered = stats.delivered || sent; // Assume delivered = sent if no tracking
    const read = stats.read || 0;
    const clicked = stats.clicked || 0;
    const converted = stats.converted || 0;
    const revenue = stats.revenue || 0;

    return {
        campaignId,
        name: campaign.name,
        templateId: campaign.templateId,
        templateIcon: campaign.templateIcon,
        status: campaign.status,
        channel: campaign.channel,
        audienceType: campaign.audienceType,
        launchedAt: campaign.launchedAt,
        completedAt: campaign.completedAt,
        stats: {
            total,
            sent,
            delivered,
            read,
            clicked,
            converted,
            failed: stats.failed || 0,
            revenue
        },
        rates: {
            deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
            readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
            clickRate: read > 0 ? Math.round((clicked / read) * 100) : 0,
            conversionRate: sent > 0 ? Math.round((converted / sent) * 100) : 0,
            roi: revenue > 0 ? Math.round(revenue / (total * 0.1)) : 0 // Estimated ROI
        }
    };
}

/**
 * Get all campaigns for a merchant
 */
async function getMerchantCampaigns(merchantId) {
    const db = getDb();
    const snap = await db.collection(MERCHANT_CAMPAIGNS)
        .where('merchantId', '==', merchantId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            templateId: data.templateId,
            templateIcon: data.templateIcon,
            templateName: data.templateName,
            status: data.status,
            channel: data.channel,
            audienceType: data.audienceType,
            audienceCount: data.audienceCount || 0,
            stats: data.stats || {},
            category: data.category,
            color: data.color,
            createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt) : null,
            launchedAt: data.launchedAt ? (data.launchedAt.toDate ? data.launchedAt.toDate() : data.launchedAt) : null,
            completedAt: data.completedAt ? (data.completedAt.toDate ? data.completedAt.toDate() : data.completedAt) : null
        };
    });
}

/**
 * Get total revenue generated from all campaigns for a merchant
 */
async function getCampaignRevenue(merchantId) {
    const db = getDb();
    const snap = await db.collection(MERCHANT_CAMPAIGNS)
        .where('merchantId', '==', merchantId)
        .get();

    let totalRevenue = 0;
    let totalSent = 0;
    let totalConverted = 0;
    let campaignCount = 0;
    let activeCampaigns = 0;

    snap.docs.forEach(doc => {
        const data = doc.data();
        const stats = data.stats || {};
        totalRevenue += stats.revenue || 0;
        totalSent += stats.sent || 0;
        totalConverted += stats.converted || 0;
        campaignCount++;
        if (data.status === 'running') activeCampaigns++;
    });

    return {
        totalRevenue,
        totalSent,
        totalConverted,
        campaignCount,
        activeCampaigns,
        averageROI: totalSent > 0 ? Math.round((totalRevenue / (totalSent * 0.1)) * 10) / 10 : 0,
        conversionRate: totalSent > 0 ? Math.round((totalConverted / totalSent) * 100) : 0
    };
}

/**
 * Record a campaign event (delivery, read, click, conversion)
 */
async function recordEvent(campaignId, eventType, data = {}) {
    const db = getDb();

    // Valid event types
    const validEvents = ['delivered', 'read', 'clicked', 'converted'];
    if (!validEvents.includes(eventType)) {
        throw new Error('Invalid event type');
    }

    // Record event
    await db.collection(CAMPAIGN_EVENTS).add({
        campaignId,
        type: eventType,
        recipientId: data.recipientId || null,
        customerId: data.customerId || null,
        revenue: data.revenue || 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update campaign stats
    const campaignRef = db.collection(MERCHANT_CAMPAIGNS).doc(campaignId);
    const updates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    updates[`stats.${eventType}`] = admin.firestore.FieldValue.increment(1);
    if (eventType === 'converted' && data.revenue) {
        updates['stats.revenue'] = admin.firestore.FieldValue.increment(data.revenue);
    }

    await campaignRef.update(updates);
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Templates
    getTemplates,
    getTemplate,
    CAMPAIGN_TEMPLATES,

    // Audience
    getAudience,
    AUDIENCE_SEGMENTS,

    // Message Generation
    generateMessage,
    fillMessage,
    getTimeGreeting,

    // Campaign CRUD
    createFromTemplate,
    launchCampaign,
    pauseCampaign,

    // Stats & Analytics
    getCampaignStats,
    getMerchantCampaigns,
    getCampaignRevenue,
    recordEvent,

    // Batch Sending
    sendCampaignBatch
};
