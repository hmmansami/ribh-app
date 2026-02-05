/**
 * Store Analyzer - Unified data analysis across all sources
 * Works with: Salla, Zid, Shopify, CSV uploads, Physical stores
 *
 * Core principle: Extract what we need for campaigns
 * - Abandoned carts (phone, name, cart contents, value)
 * - Dormant customers (phone, name, last purchase date, total spent)
 * - Recent buyers (phone, name, what they bought, for upsell)
 */

const { sallaApi } = require('./sallaApp');
const { scoreUrgency, scorePotential } = require('./customerScoring');

/**
 * Analyze a store and return campaign-ready data
 * @param {string} source - 'salla' | 'zid' | 'shopify' | 'csv' | 'manual'
 * @param {string} merchantId - for API sources
 * @param {array} csvData - for CSV/manual uploads
 * @returns {object} - { abandonedCarts, dormantCustomers, recentBuyers, totals }
 */
async function analyzeStore(source, merchantId, csvData = null) {
    console.log(`[StoreAnalyzer] Analyzing ${source} store ${merchantId || 'CSV'}`);

    let result = {
        source,
        analyzedAt: new Date().toISOString(),
        abandonedCarts: [],
        dormantCustomers: [],
        recentBuyers: [],
        totals: {
            abandonedCartsCount: 0,
            abandonedCartsValue: 0,
            dormantCustomersCount: 0,
            dormantCustomersValue: 0,
            recentBuyersCount: 0,
            recentBuyersValue: 0,
            totalMoneyWaiting: 0
        }
    };

    try {
        switch (source) {
            case 'salla':
                result = await analyzeSalla(merchantId, result);
                break;
            case 'zid':
                result = await analyzeZid(merchantId, result);
                break;
            case 'shopify':
                result = await analyzeShopify(merchantId, result);
                break;
            case 'csv':
            case 'manual':
                result = await analyzeCSV(csvData, result);
                break;
            default:
                throw new Error(`Unknown source: ${source}`);
        }

        // Calculate totals
        result.totals.abandonedCartsCount = result.abandonedCarts.length;
        result.totals.abandonedCartsValue = result.abandonedCarts.reduce((s, c) => s + (c.value || 0), 0);
        result.totals.dormantCustomersCount = result.dormantCustomers.length;
        result.totals.dormantCustomersValue = Math.round(result.dormantCustomers.reduce((s, c) => s + (c.estimatedValue || 0), 0));
        result.totals.recentBuyersCount = result.recentBuyers.length;
        result.totals.recentBuyersValue = Math.round(result.recentBuyers.reduce((s, c) => s + (c.upsellValue || 0), 0));

        // Total money waiting = abandoned carts (recoverable) + dormant potential + upsell potential
        // Conservative estimates: 35% cart recovery, 10% dormant reactivation, 15% upsell conversion
        result.totals.totalMoneyWaiting = Math.round(
            (result.totals.abandonedCartsValue * 0.35) +
            (result.totals.dormantCustomersValue * 0.10) +
            (result.totals.recentBuyersValue * 0.15)
        );

        console.log(`[StoreAnalyzer] Analysis complete:`, result.totals);

    } catch (error) {
        console.error(`[StoreAnalyzer] Error analyzing ${source}:`, error);
        result.error = error.message;
    }

    return result;
}

/**
 * Analyze Salla store via API
 */
async function analyzeSalla(merchantId, result) {
    // 1. Get abandoned carts (last 90 days)
    try {
        const cartsResp = await sallaApi(merchantId, '/abandoned-carts?per_page=100');
        const carts = cartsResp.data || [];

        result.abandonedCarts = carts
            .filter(c => c.customer?.mobile)
            .map(c => ({
                id: c.id,
                phone: normalizePhone(c.customer.mobile),
                name: c.customer.first_name || c.customer.name || 'عميل',
                email: c.customer.email,
                value: parseFloat(c.total?.amount || c.total || 0),
                currency: c.total?.currency || 'SAR',
                items: (c.items || []).map(i => ({
                    name: i.product?.name || i.name,
                    quantity: i.quantity,
                    price: parseFloat(i.price?.amount || i.price || 0)
                })),
                abandonedAt: c.created_at,
                hoursSinceAbandon: Math.round((Date.now() - new Date(c.created_at).getTime()) / 3600000),
                cartUrl: c.checkout_url || c.cart_url,
                urgencyScore: 0 // Will calculate below
            }));

        // Calculate urgency scores
        result.abandonedCarts.forEach(c => {
            c.urgencyScore = scoreUrgency({ cartValue: c.value, hoursSinceAbandon: c.hoursSinceAbandon });
        });

        // Sort by urgency (highest first)
        result.abandonedCarts.sort((a, b) => b.urgencyScore - a.urgencyScore);

    } catch (e) {
        console.log(`[StoreAnalyzer] Salla abandoned carts error:`, e.message);
    }

    // 2. Get customers for dormant analysis
    try {
        const customersResp = await sallaApi(merchantId, '/customers?per_page=100');
        const customers = customersResp.data || [];

        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        for (const customer of customers) {
            if (!customer.mobile) continue;

            const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date).getTime() : 0;
            const totalSpent = parseFloat(customer.total_spent?.amount || customer.total_spent || 0);
            const orderCount = customer.orders_count || 0;

            // Dormant = has ordered before, but not in last 30 days
            if (lastOrderDate > 0 && lastOrderDate < thirtyDaysAgo && orderCount > 0) {
                result.dormantCustomers.push({
                    id: customer.id,
                    phone: normalizePhone(customer.mobile),
                    name: customer.first_name || customer.name || 'عميل',
                    email: customer.email,
                    lastOrderDate: customer.last_order_date,
                    daysSinceOrder: Math.round((now - lastOrderDate) / (24 * 60 * 60 * 1000)),
                    totalSpent,
                    orderCount,
                    avgOrderValue: orderCount > 0 ? Math.round(totalSpent / orderCount) : 0,
                    estimatedValue: orderCount > 0 ? Math.round(totalSpent / orderCount) : 100, // Avg order or default
                    potentialScore: scorePotential({
                        predictedCLV: totalSpent * 2,
                        pastOrderCount: orderCount,
                        pastOrderTotal: totalSpent,
                        segment: orderCount >= 5 ? 'loyal' : orderCount >= 2 ? 'returning' : 'new'
                    })
                });
            }

            // Recent buyers = ordered in last 7 days (for upsell)
            if (lastOrderDate >= sevenDaysAgo) {
                result.recentBuyers.push({
                    id: customer.id,
                    phone: normalizePhone(customer.mobile),
                    name: customer.first_name || customer.name || 'عميل',
                    email: customer.email,
                    lastOrderDate: customer.last_order_date,
                    totalSpent,
                    orderCount,
                    avgOrderValue: orderCount > 0 ? Math.round(totalSpent / orderCount) : 0,
                    upsellValue: orderCount > 0 ? Math.round(totalSpent / orderCount * 0.3) : 30 // 30% of avg order
                });
            }
        }

        // Sort dormant by potential (highest first)
        result.dormantCustomers.sort((a, b) => b.potentialScore - a.potentialScore);

    } catch (e) {
        console.log(`[StoreAnalyzer] Salla customers error:`, e.message);
    }

    return result;
}

/**
 * Analyze Zid store (placeholder - implement when needed)
 */
async function analyzeZid(merchantId, result) {
    // TODO: Implement Zid API integration
    console.log(`[StoreAnalyzer] Zid integration coming soon`);
    return result;
}

/**
 * Analyze Shopify store (placeholder - implement when needed)
 */
async function analyzeShopify(merchantId, result) {
    // TODO: Implement Shopify API integration
    console.log(`[StoreAnalyzer] Shopify integration coming soon`);
    return result;
}

/**
 * Analyze CSV/manual upload data
 * Expected format: [{ phone, name, type, value, lastPurchase?, items? }]
 */
async function analyzeCSV(data, result) {
    if (!Array.isArray(data)) return result;

    for (const row of data) {
        if (!row.phone) continue;

        const customer = {
            phone: normalizePhone(row.phone),
            name: row.name || 'عميل',
            value: parseFloat(row.value || row.amount || row.total || 100),
            email: row.email || null
        };

        const type = (row.type || 'dormant').toLowerCase();

        if (type === 'cart' || type === 'abandoned') {
            result.abandonedCarts.push({
                ...customer,
                items: row.items || [],
                abandonedAt: row.date || new Date().toISOString(),
                hoursSinceAbandon: row.hours || 24,
                urgencyScore: scoreUrgency({ cartValue: customer.value, hoursSinceAbandon: row.hours || 24 })
            });
        } else if (type === 'recent' || type === 'buyer') {
            result.recentBuyers.push({
                ...customer,
                lastOrderDate: row.lastPurchase || row.date,
                upsellValue: customer.value * 0.3
            });
        } else {
            // Default to dormant
            result.dormantCustomers.push({
                ...customer,
                lastOrderDate: row.lastPurchase || row.date,
                daysSinceOrder: row.days || 30,
                estimatedValue: customer.value,
                potentialScore: 50
            });
        }
    }

    return result;
}

/**
 * Normalize phone number to international format
 */
function normalizePhone(phone) {
    if (!phone) return null;
    let p = String(phone).replace(/[^\d+]/g, '');

    // Saudi Arabia normalization
    if (p.startsWith('0')) {
        p = '966' + p.substring(1);
    }
    if (!p.startsWith('+') && !p.startsWith('966')) {
        // Assume Saudi if no country code
        if (p.length === 9) {
            p = '966' + p;
        }
    }
    if (!p.startsWith('+')) {
        p = '+' + p;
    }

    return p;
}

/**
 * Generate campaign summary from analysis
 */
function generateCampaignSummary(analysis) {
    const { abandonedCarts, dormantCustomers, recentBuyers, totals } = analysis;

    return {
        overview: {
            totalCustomers: abandonedCarts.length + dormantCustomers.length + recentBuyers.length,
            totalMoneyWaiting: totals.totalMoneyWaiting,
            breakdown: {
                abandonedCarts: {
                    count: totals.abandonedCartsCount,
                    value: totals.abandonedCartsValue,
                    recoveryEstimate: Math.round(totals.abandonedCartsValue * 0.35)
                },
                dormantCustomers: {
                    count: totals.dormantCustomersCount,
                    value: totals.dormantCustomersValue,
                    reactivationEstimate: Math.round(totals.dormantCustomersValue * 0.10)
                },
                recentBuyers: {
                    count: totals.recentBuyersCount,
                    value: totals.recentBuyersValue,
                    upsellEstimate: Math.round(totals.recentBuyersValue * 0.15)
                }
            }
        },
        campaigns: {
            cartRecovery: {
                audience: abandonedCarts.length,
                estimatedRevenue: Math.round(totals.abandonedCartsValue * 0.35),
                priority: 'high',
                ready: abandonedCarts.length > 0
            },
            winback: {
                audience: dormantCustomers.length,
                estimatedRevenue: Math.round(totals.dormantCustomersValue * 0.10),
                priority: 'medium',
                ready: dormantCustomers.length > 0
            },
            upsell: {
                audience: recentBuyers.length,
                estimatedRevenue: Math.round(totals.recentBuyersValue * 0.15),
                priority: 'low',
                ready: recentBuyers.length > 0
            }
        }
    };
}

module.exports = {
    analyzeStore,
    generateCampaignSummary,
    normalizePhone
};
