/**
 * Loyalty Points Engine - RIBH
 *
 * Complete loyalty program system for Saudi e-commerce merchants.
 * Points earning, redemption, tier progression, referrals, and leaderboards.
 *
 * Firestore structure:
 *   merchants/{id}/loyalty_config        - Merchant loyalty settings
 *   merchants/{id}/loyalty_accounts/{customerId} - Customer loyalty accounts
 *   merchants/{id}/loyalty_transactions/{txId}   - Points transaction log
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// ==========================================
// DEFAULT CONFIGURATION
// ==========================================

const DEFAULT_CONFIG = {
    pointsPerSAR: 1,        // 1 point per SAR spent
    welcomeBonus: 100,       // 100 points on first purchase
    referralBonus: 200,      // 200 points for referrer
    referralNewBonus: 100,   // 100 points for new customer
    redemptionRate: 0.01,    // 1 point = 0.01 SAR (100 points = 1 SAR)
    minRedemption: 100,      // Minimum 100 points to redeem
    tiers: [
        { name: 'برونزي', nameEn: 'Bronze', minPoints: 0, multiplier: 1 },
        { name: 'فضي', nameEn: 'Silver', minPoints: 500, multiplier: 1.5 },
        { name: 'ذهبي', nameEn: 'Gold', minPoints: 2000, multiplier: 2 },
        { name: 'بلاتيني', nameEn: 'Platinum', minPoints: 5000, multiplier: 3 }
    ]
};

// ==========================================
// PURE UTILITY FUNCTIONS
// ==========================================

/**
 * Get the tier for a given lifetime points total
 * @param {number} lifetimePoints
 * @param {Array} [tiers] - Custom tiers or DEFAULT_CONFIG.tiers
 * @returns {object} Tier object { name, nameEn, minPoints, multiplier }
 */
function getTierForPoints(lifetimePoints, tiers) {
    const tierList = tiers || DEFAULT_CONFIG.tiers;
    let currentTier = tierList[0];
    for (const tier of tierList) {
        if (lifetimePoints >= tier.minPoints) {
            currentTier = tier;
        }
    }
    return currentTier;
}

/**
 * Calculate points earned for an order value
 * @param {number} orderValue - Order total in SAR
 * @param {object} config - Loyalty config
 * @param {number} lifetimePoints - For tier multiplier calculation
 * @returns {number} Points to award
 */
function calculatePoints(orderValue, config, lifetimePoints = 0) {
    const cfg = config || DEFAULT_CONFIG;
    const tier = getTierForPoints(lifetimePoints, cfg.tiers);
    const basePoints = Math.floor(orderValue * cfg.pointsPerSAR);
    return Math.floor(basePoints * tier.multiplier);
}

/**
 * Calculate SAR value for points
 * @param {number} points
 * @param {object} [config]
 * @returns {number} SAR value
 */
function pointsToSAR(points, config) {
    const cfg = config || DEFAULT_CONFIG;
    return Math.round(points * cfg.redemptionRate * 100) / 100;
}

// ==========================================
// LOYALTY PROGRAM INIT
// ==========================================

/**
 * Initialize loyalty program for a merchant
 * @param {string} merchantId
 * @param {object} [customConfig] - Override defaults
 * @returns {object} Final config
 */
async function initLoyalty(merchantId, customConfig = {}) {
    const db = getDb();
    const config = { ...DEFAULT_CONFIG, ...customConfig };

    // Preserve tiers if not explicitly overridden
    if (!customConfig.tiers) {
        config.tiers = DEFAULT_CONFIG.tiers;
    }

    try {
        await db.collection('merchants').doc(merchantId).collection('loyalty_config').doc('settings').set({
            ...config,
            enabled: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log(`[LoyaltyEngine] Initialized loyalty for merchant ${merchantId}`);
        return config;
    } catch (error) {
        console.error('[LoyaltyEngine] Init error:', error.message);
        throw error;
    }
}

/**
 * Get merchant loyalty config (falls back to defaults)
 */
async function getConfig(merchantId) {
    const db = getDb();
    try {
        const doc = await db.collection('merchants').doc(merchantId).collection('loyalty_config').doc('settings').get();
        if (doc.exists) {
            const data = doc.data();
            return { ...DEFAULT_CONFIG, ...data };
        }
    } catch (error) {
        console.error('[LoyaltyEngine] Config load error:', error.message);
    }
    return { ...DEFAULT_CONFIG };
}

// ==========================================
// POINTS EARNING
// ==========================================

/**
 * Award points for a purchase
 * @param {string} merchantId
 * @param {string} customerId
 * @param {number} orderValue - Order total in SAR
 * @param {object} [meta] - { orderId, description }
 * @returns {object} { pointsEarned, newBalance, tier, isFirstPurchase }
 */
async function earnPoints(merchantId, customerId, orderValue, meta = {}) {
    const db = getDb();
    const config = await getConfig(merchantId);
    const accountRef = db.collection('merchants').doc(merchantId).collection('loyalty_accounts').doc(customerId);

    try {
        const result = await db.runTransaction(async (tx) => {
            const accountDoc = await tx.get(accountRef);
            const account = accountDoc.exists ? accountDoc.data() : null;

            const currentBalance = account ? (account.balance || 0) : 0;
            const lifetimePoints = account ? (account.lifetimePoints || 0) : 0;
            const isFirstPurchase = !account || (account.totalOrders || 0) === 0;

            // Calculate points with tier multiplier
            let pointsEarned = calculatePoints(orderValue, config, lifetimePoints);

            // Add welcome bonus on first purchase
            if (isFirstPurchase && config.welcomeBonus > 0) {
                pointsEarned += config.welcomeBonus;
            }

            const newBalance = currentBalance + pointsEarned;
            const newLifetime = lifetimePoints + pointsEarned;
            const newTier = getTierForPoints(newLifetime, config.tiers);

            // Update account
            tx.set(accountRef, {
                customerId,
                balance: newBalance,
                lifetimePoints: newLifetime,
                tier: newTier.nameEn,
                tierAr: newTier.name,
                tierMultiplier: newTier.multiplier,
                totalOrders: (account ? (account.totalOrders || 0) : 0) + 1,
                totalSpent: (account ? (account.totalSpent || 0) : 0) + orderValue,
                lastEarnedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                ...(isFirstPurchase ? { createdAt: admin.firestore.FieldValue.serverTimestamp() } : {})
            }, { merge: true });

            // Record transaction
            const txRef = db.collection('merchants').doc(merchantId).collection('loyalty_transactions').doc();
            tx.set(txRef, {
                customerId,
                type: 'earn',
                points: pointsEarned,
                balanceAfter: newBalance,
                orderValue,
                orderId: meta.orderId || null,
                description: meta.description || `نقاط مشتريات بقيمة ${orderValue} ر.س`,
                isWelcomeBonus: isFirstPurchase,
                tier: newTier.nameEn,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { pointsEarned, newBalance, tier: newTier, isFirstPurchase };
        });

        console.log(`[LoyaltyEngine] ${customerId} earned ${result.pointsEarned} pts (balance: ${result.newBalance})`);
        return result;
    } catch (error) {
        console.error('[LoyaltyEngine] Earn error:', error.message);
        throw error;
    }
}

// ==========================================
// POINTS REDEMPTION
// ==========================================

/**
 * Redeem points for a discount
 * @param {string} merchantId
 * @param {string} customerId
 * @param {number} points - Points to redeem
 * @param {object} [meta] - { orderId, description }
 * @returns {object} { discountSAR, remainingBalance, pointsRedeemed }
 */
async function redeemPoints(merchantId, customerId, points, meta = {}) {
    const db = getDb();
    const config = await getConfig(merchantId);
    const accountRef = db.collection('merchants').doc(merchantId).collection('loyalty_accounts').doc(customerId);

    if (points < config.minRedemption) {
        throw new Error(`الحد الأدنى للاستبدال ${config.minRedemption} نقطة`);
    }

    try {
        const result = await db.runTransaction(async (tx) => {
            const accountDoc = await tx.get(accountRef);
            if (!accountDoc.exists) throw new Error('حساب الولاء غير موجود');

            const account = accountDoc.data();
            if ((account.balance || 0) < points) {
                throw new Error(`رصيدك ${account.balance} نقطة فقط`);
            }

            const discountSAR = pointsToSAR(points, config);
            const remainingBalance = account.balance - points;

            // Update account
            tx.update(accountRef, {
                balance: remainingBalance,
                lastRedeemedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Record transaction
            const txRef = db.collection('merchants').doc(merchantId).collection('loyalty_transactions').doc();
            tx.set(txRef, {
                customerId,
                type: 'redeem',
                points: -points,
                balanceAfter: remainingBalance,
                discountSAR,
                orderId: meta.orderId || null,
                description: meta.description || `استبدال ${points} نقطة = خصم ${discountSAR} ر.س`,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { discountSAR, remainingBalance, pointsRedeemed: points };
        });

        console.log(`[LoyaltyEngine] ${customerId} redeemed ${points} pts for ${result.discountSAR} SAR`);
        return result;
    } catch (error) {
        console.error('[LoyaltyEngine] Redeem error:', error.message);
        throw error;
    }
}

// ==========================================
// BALANCE & LEADERBOARD
// ==========================================

/**
 * Get customer loyalty balance and tier info
 */
async function getBalance(merchantId, customerId) {
    const db = getDb();
    try {
        const doc = await db.collection('merchants').doc(merchantId).collection('loyalty_accounts').doc(customerId).get();
        if (!doc.exists) {
            return { balance: 0, lifetimePoints: 0, tier: 'Bronze', tierAr: 'برونزي', totalOrders: 0, totalSpent: 0 };
        }
        const data = doc.data();
        const config = await getConfig(merchantId);
        return {
            balance: data.balance || 0,
            lifetimePoints: data.lifetimePoints || 0,
            tier: data.tier || 'Bronze',
            tierAr: data.tierAr || 'برونزي',
            tierMultiplier: data.tierMultiplier || 1,
            totalOrders: data.totalOrders || 0,
            totalSpent: data.totalSpent || 0,
            balanceValueSAR: pointsToSAR(data.balance || 0, config),
            lastEarnedAt: data.lastEarnedAt || null,
            lastRedeemedAt: data.lastRedeemedAt || null
        };
    } catch (error) {
        console.error('[LoyaltyEngine] Balance error:', error.message);
        throw error;
    }
}

/**
 * Get top customers by lifetime points
 * @param {string} merchantId
 * @param {number} [limit=10]
 * @returns {Array} Leaderboard entries
 */
async function getLeaderboard(merchantId, limit = 10) {
    const db = getDb();
    try {
        const snap = await db.collection('merchants').doc(merchantId).collection('loyalty_accounts')
            .orderBy('lifetimePoints', 'desc')
            .limit(limit)
            .get();

        return snap.docs.map((doc, idx) => ({
            rank: idx + 1,
            customerId: doc.id,
            ...doc.data(),
            balance: doc.data().balance || 0,
            lifetimePoints: doc.data().lifetimePoints || 0,
            tier: doc.data().tier || 'Bronze',
            tierAr: doc.data().tierAr || 'برونزي'
        }));
    } catch (error) {
        console.error('[LoyaltyEngine] Leaderboard error:', error.message);
        return [];
    }
}

// ==========================================
// REFERRAL SYSTEM
// ==========================================

/**
 * Generate a referral link/code for a customer
 */
async function getReferralLink(merchantId, customerId) {
    const code = `REF-${merchantId.substring(0, 4).toUpperCase()}-${customerId.substring(0, 6).toUpperCase()}`;
    const db = getDb();
    try {
        const accountRef = db.collection('merchants').doc(merchantId).collection('loyalty_accounts').doc(customerId);
        await accountRef.set({ referralCode: code, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error('[LoyaltyEngine] Referral link error:', error.message);
    }
    return { code, link: `https://ribh-484706.web.app/ref/${code}` };
}

/**
 * Process a referral - award bonus to both referrer and new customer
 */
async function processReferral(merchantId, referrerId, newCustomerId) {
    const db = getDb();
    const config = await getConfig(merchantId);

    try {
        const batch = db.batch();
        const referrerRef = db.collection('merchants').doc(merchantId).collection('loyalty_accounts').doc(referrerId);
        const newCustRef = db.collection('merchants').doc(merchantId).collection('loyalty_accounts').doc(newCustomerId);

        // Award referrer bonus
        const referrerDoc = await referrerRef.get();
        const referrerData = referrerDoc.exists ? referrerDoc.data() : { balance: 0, lifetimePoints: 0 };
        const newReferrerBalance = (referrerData.balance || 0) + config.referralBonus;
        const newReferrerLifetime = (referrerData.lifetimePoints || 0) + config.referralBonus;

        batch.set(referrerRef, {
            balance: newReferrerBalance,
            lifetimePoints: newReferrerLifetime,
            referralCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Award new customer bonus
        batch.set(newCustRef, {
            customerId: newCustomerId,
            balance: config.referralNewBonus,
            lifetimePoints: config.referralNewBonus,
            referredBy: referrerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Log transactions
        const txRef1 = db.collection('merchants').doc(merchantId).collection('loyalty_transactions').doc();
        batch.set(txRef1, {
            customerId: referrerId,
            type: 'referral_bonus',
            points: config.referralBonus,
            balanceAfter: newReferrerBalance,
            description: `مكافأة إحالة عميل جديد`,
            referredCustomerId: newCustomerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const txRef2 = db.collection('merchants').doc(merchantId).collection('loyalty_transactions').doc();
        batch.set(txRef2, {
            customerId: newCustomerId,
            type: 'referral_welcome',
            points: config.referralNewBonus,
            balanceAfter: config.referralNewBonus,
            description: `مكافأة ترحيبية عبر الإحالة`,
            referredBy: referrerId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        console.log(`[LoyaltyEngine] Referral: ${referrerId} -> ${newCustomerId} (${config.referralBonus}/${config.referralNewBonus} pts)`);

        return {
            referrerBonus: config.referralBonus,
            newCustomerBonus: config.referralNewBonus,
            referrerNewBalance: newReferrerBalance
        };
    } catch (error) {
        console.error('[LoyaltyEngine] Referral error:', error.message);
        throw error;
    }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Config
    DEFAULT_CONFIG,
    initLoyalty,
    getConfig,

    // Pure functions
    getTierForPoints,
    calculatePoints,
    pointsToSAR,

    // Core operations
    earnPoints,
    redeemPoints,
    getBalance,
    getLeaderboard,

    // Referrals
    getReferralLink,
    processReferral
};
