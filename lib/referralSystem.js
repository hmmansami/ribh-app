/**
 * REFERRAL SYSTEM - Free Customer Acquisition
 * 
 * Flow:
 * 1. Customer buys → Gets unique referral link
 * 2. Friend uses link → Gets 10% discount
 * 3. Original customer gets 15% credit when friend buys
 * 
 * "The best marketing is a happy customer" - Hormozi
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REFERRALS_FILE = path.join(__dirname, '..', 'data', 'referrals.json');

// Ensure file exists
if (!fs.existsSync(REFERRALS_FILE)) {
    fs.writeFileSync(REFERRALS_FILE, JSON.stringify([]));
}

function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Generate unique referral code for customer
 */
function generateReferralCode(email) {
    const hash = crypto.createHash('md5').update(email + Date.now()).digest('hex');
    return 'RIBH' + hash.substring(0, 6).toUpperCase();
}

/**
 * Create or get referral link for customer
 */
function getOrCreateReferral(storeId, customerEmail, storeDomain) {
    const referrals = readJSON(REFERRALS_FILE);

    // Check if customer already has a referral code
    let existing = referrals.find(r =>
        r.storeId === storeId && r.referrerEmail === customerEmail
    );

    if (existing) {
        return existing;
    }

    // Create new referral
    const code = generateReferralCode(customerEmail);
    const referral = {
        storeId: storeId,
        referrerEmail: customerEmail,
        code: code,
        link: `https://${storeDomain}?ref=${code}`,
        createdAt: new Date().toISOString(),
        referredCustomers: [],
        totalEarnings: 0,
        status: 'active'
    };

    referrals.push(referral);
    writeJSON(REFERRALS_FILE, referrals);

    console.log(`🔗 Created referral code ${code} for ${customerEmail}`);
    return referral;
}

/**
 * Track when someone uses a referral code
 */
function trackReferralUse(storeId, code, newCustomerEmail, orderValue) {
    const referrals = readJSON(REFERRALS_FILE);

    const referral = referrals.find(r =>
        r.storeId === storeId && r.code === code
    );

    if (!referral) {
        console.log(`❌ Referral code not found: ${code}`);
        return null;
    }

    // Calculate rewards
    const referrerReward = orderValue * 0.15; // 15% to referrer
    const newCustomerDiscount = orderValue * 0.10; // 10% to new customer

    // Track the referral
    referral.referredCustomers.push({
        email: newCustomerEmail,
        orderValue: orderValue,
        reward: referrerReward,
        date: new Date().toISOString()
    });
    referral.totalEarnings += referrerReward;

    writeJSON(REFERRALS_FILE, referrals);

    console.log(`🎉 Referral tracked! ${referral.referrerEmail} earned ${referrerReward} SAR`);

    return {
        referrer: referral.referrerEmail,
        referrerReward: referrerReward,
        newCustomerDiscount: newCustomerDiscount,
        code: code
    };
}

/**
 * Get referral stats for a customer
 */
function getReferralStats(storeId, customerEmail) {
    const referrals = readJSON(REFERRALS_FILE);

    const referral = referrals.find(r =>
        r.storeId === storeId && r.referrerEmail === customerEmail
    );

    if (!referral) return null;

    return {
        code: referral.code,
        link: referral.link,
        totalReferred: referral.referredCustomers.length,
        totalEarnings: referral.totalEarnings,
        referredCustomers: referral.referredCustomers
    };
}

/**
 * Get all referrals for a store
 */
function getStoreReferrals(storeId) {
    const referrals = readJSON(REFERRALS_FILE);
    return referrals.filter(r => r.storeId === storeId);
}

module.exports = {
    generateReferralCode,
    getOrCreateReferral,
    trackReferralUse,
    getReferralStats,
    getStoreReferrals
};
