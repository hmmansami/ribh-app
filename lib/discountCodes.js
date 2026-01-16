/**
 * DISCOUNT CODE GENERATOR
 * 
 * Creates unique one-time discount codes via Salla API
 * Prevents code sharing/abuse
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CODES_FILE = path.join(__dirname, '..', 'data', 'discount_codes.json');

if (!fs.existsSync(CODES_FILE)) {
    fs.writeFileSync(CODES_FILE, JSON.stringify([]));
}

function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Generate a unique discount code
 */
function generateCode(prefix = 'RIBH') {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}${random}`;
}

/**
 * Create a discount code for a store/customer
 * Also creates the code in Salla if store has access token
 */
async function createDiscountCode(storeId, customerEmail, discountPercent, expiresInHours = 48, storeAccessToken = null) {
    const codes = readJSON(CODES_FILE);

    // Check if customer already has an active code
    const existing = codes.find(c =>
        c.storeId === storeId &&
        c.customerEmail === customerEmail &&
        c.status === 'active' &&
        new Date(c.expiresAt) > new Date()
    );

    if (existing) {
        console.log(`♻️ Reusing existing code ${existing.code} for ${customerEmail}`);
        return existing;
    }

    // Create new code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const discountCode = {
        id: Date.now().toString(),
        storeId: storeId,
        customerEmail: customerEmail,
        code: code,
        discountPercent: discountPercent,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: 'active',
        usedAt: null,
        sallaCreated: false
    };

    codes.push(discountCode);
    writeJSON(CODES_FILE, codes);

    console.log(`🏷️ Created discount code ${code} (${discountPercent}%) for ${customerEmail}`);

    // Create code in Salla via API if access token available
    if (storeAccessToken) {
        try {
            const axios = require('axios');
            const response = await axios.post('https://api.salla.dev/admin/v2/coupons', {
                code: code,
                type: 'percentage',
                discount: discountPercent,
                maximum_usage: 1,
                expiry_date: expiresAt.toISOString().split('T')[0],
                status: 'active'
            }, {
                headers: {
                    'Authorization': `Bearer ${storeAccessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data?.data?.id) {
                discountCode.sallaId = response.data.data.id;
                discountCode.sallaCreated = true;
                writeJSON(CODES_FILE, codes);
                console.log(`✅ Code ${code} created in Salla (ID: ${response.data.data.id})`);
            }
        } catch (error) {
            console.log(`⚠️ Could not create code in Salla: ${error.message}`);
            // Code still works locally, just not in Salla
        }
    }

    return discountCode;
}

/**
 * Mark code as used
 */
function markCodeUsed(code) {
    const codes = readJSON(CODES_FILE);
    const discountCode = codes.find(c => c.code === code);

    if (discountCode) {
        discountCode.status = 'used';
        discountCode.usedAt = new Date().toISOString();
        writeJSON(CODES_FILE, codes);
        console.log(`✅ Code ${code} marked as used`);
        return true;
    }

    return false;
}

/**
 * Validate a code
 */
function validateCode(code, storeId) {
    const codes = readJSON(CODES_FILE);
    const discountCode = codes.find(c =>
        c.code === code &&
        c.storeId === storeId
    );

    if (!discountCode) {
        return { valid: false, reason: 'Code not found' };
    }

    if (discountCode.status === 'used') {
        return { valid: false, reason: 'Code already used' };
    }

    if (new Date(discountCode.expiresAt) < new Date()) {
        return { valid: false, reason: 'Code expired' };
    }

    return {
        valid: true,
        discount: discountCode.discountPercent,
        code: discountCode
    };
}

/**
 * Get all codes for a store
 */
function getStoreCodes(storeId) {
    const codes = readJSON(CODES_FILE);
    return codes.filter(c => c.storeId === storeId);
}

/**
 * Clean up expired codes
 */
function cleanupExpiredCodes() {
    const codes = readJSON(CODES_FILE);
    const now = new Date();

    const active = codes.filter(c => {
        if (c.status === 'used') return true; // Keep used codes for history
        return new Date(c.expiresAt) > now;
    });

    const removed = codes.length - active.length;
    if (removed > 0) {
        writeJSON(CODES_FILE, active);
        console.log(`🧹 Cleaned up ${removed} expired codes`);
    }

    return removed;
}

module.exports = {
    generateCode,
    createDiscountCode,
    markCodeUsed,
    validateCode,
    getStoreCodes,
    cleanupExpiredCodes
};
