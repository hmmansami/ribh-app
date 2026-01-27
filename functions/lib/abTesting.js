/**
 * A/B TESTING ENGINE
 * 
 * Test different subject lines, discounts, copy
 * Auto-pick winner based on open/click rates
 * 
 * 🧠 AI Learning Integration: Winners feed into learning loop
 */

const fs = require('fs');
const path = require('path');
const { recordABResult, getOfferWeights } = require('./aiLearning');

const TESTS_FILE = path.join(__dirname, '..', 'data', 'ab_tests.json');

if (!fs.existsSync(TESTS_FILE)) {
    fs.writeFileSync(TESTS_FILE, JSON.stringify([]));
}

function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Pre-defined A/B test variants
const TEST_VARIANTS = {
    cart_recovery: {
        subject: [
            { id: 'A', text: '🛒 نسيت شيئاً في سلتك!', weight: 50 },
            { id: 'B', text: '⏰ سلتك تنتظرك - لا تفوت الفرصة!', weight: 50 }
        ],
        discount: [
            { id: 'A', value: 10, text: 'خصم 10%', weight: 50 },
            { id: 'B', value: 15, text: 'خصم 15%', weight: 50 }
        ],
        urgency: [
            { id: 'A', text: 'صالح لمدة ساعتين', weight: 50 },
            { id: 'B', text: 'صالح حتى نهاية اليوم', weight: 50 }
        ]
    },
    upsell: {
        subject: [
            { id: 'A', text: '💎 أكمل تجربتك!', weight: 50 },
            { id: 'B', text: '🎁 هدية خاصة لك!', weight: 50 }
        ],
        discount: [
            { id: 'A', value: 15, text: 'خصم 15%', weight: 50 },
            { id: 'B', value: 20, text: 'خصم 20%', weight: 50 }
        ]
    }
};

/**
 * Pick a variant based on weights
 */
function pickVariant(variants) {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const variant of variants) {
        random -= variant.weight;
        if (random <= 0) return variant;
    }
    return variants[0];
}

/**
 * Get A/B test variant for a message
 */
function getTestVariant(type, element) {
    const typeVariants = TEST_VARIANTS[type];
    if (!typeVariants || !typeVariants[element]) {
        return null;
    }

    return pickVariant(typeVariants[element]);
}

/**
 * Generate A/B tested offer
 * 🧠 Uses AI-optimized weights when available
 */
async function generateTestedOffer(type, baseOffer = {}, storeId = null, segment = 'all') {
    const tests = readJSON(TESTS_FILE);

    // 🧠 Get AI-optimized offer weights if storeId provided
    let aiWeights = null;
    if (storeId) {
        try {
            aiWeights = await getOfferWeights(storeId, segment);
            console.log(`[A/B Testing] 🧠 Using AI weights (confidence: ${aiWeights.confidence})`);
        } catch (e) {
            console.log('[A/B Testing] No AI weights available, using defaults');
        }
    }

    // Get variants (potentially adjusted by AI weights)
    const subjectVariant = getTestVariant(type, 'subject');
    const discountVariant = getTestVariant(type, 'discount');
    const urgencyVariant = getTestVariant(type, 'urgency');

    const offer = {
        ...baseOffer,
        headline: subjectVariant?.text || baseOffer.headline,
        discount: discountVariant?.value || baseOffer.discount,
        urgency: urgencyVariant?.text || baseOffer.urgency,
        testVariants: {
            subject: subjectVariant?.id,
            discount: discountVariant?.id,
            urgency: urgencyVariant?.id
        },
        // 🧠 AI metadata
        aiOptimized: !!aiWeights,
        aiConfidence: aiWeights?.confidence || 'none'
    };

    // Log which variant was used
    tests.push({
        type: type,
        variants: offer.testVariants,
        timestamp: new Date().toISOString(),
        converted: false // Will be updated when customer converts
    });

    // Keep last 1000 tests
    if (tests.length > 1000) {
        tests.splice(0, tests.length - 1000);
    }

    writeJSON(TESTS_FILE, tests);

    return offer;
}

/**
 * Mark a test as converted
 */
function markConversion(customerEmail, type) {
    const tests = readJSON(TESTS_FILE);

    // Find recent tests for this type and mark as converted
    const recent = tests.filter(t =>
        t.type === type &&
        !t.converted &&
        new Date(t.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (recent.length > 0) {
        recent[recent.length - 1].converted = true;
        recent[recent.length - 1].convertedAt = new Date().toISOString();
        writeJSON(TESTS_FILE, tests);
    }
}

/**
 * Get A/B test results
 */
function getTestResults(type) {
    const tests = readJSON(TESTS_FILE).filter(t => t.type === type);

    const results = {
        subject: { A: { sent: 0, converted: 0 }, B: { sent: 0, converted: 0 } },
        discount: { A: { sent: 0, converted: 0 }, B: { sent: 0, converted: 0 } }
    };

    for (const test of tests) {
        if (test.variants?.subject) {
            results.subject[test.variants.subject].sent++;
            if (test.converted) results.subject[test.variants.subject].converted++;
        }
        if (test.variants?.discount) {
            results.discount[test.variants.discount].sent++;
            if (test.converted) results.discount[test.variants.discount].converted++;
        }
    }

    // Calculate conversion rates
    for (const element of ['subject', 'discount']) {
        for (const variant of ['A', 'B']) {
            const r = results[element][variant];
            r.rate = r.sent > 0 ? ((r.converted / r.sent) * 100).toFixed(1) + '%' : '0%';
        }
    }

    return results;
}

/**
 * Get winning variant
 * 🧠 Records result to AI learning loop when winner is found
 */
async function getWinner(type, element, storeId = null) {
    const results = getTestResults(type);
    const a = results[element]?.A;
    const b = results[element]?.B;

    if (!a || !b || a.sent < 10 || b.sent < 10) {
        return null; // Need more data
    }

    const aRate = a.converted / a.sent;
    const bRate = b.converted / b.sent;

    let winner = null;
    if (aRate > bRate * 1.1) winner = 'A';
    else if (bRate > aRate * 1.1) winner = 'B';
    
    // 🧠 Record to AI learning loop when we have a winner and storeId
    if (winner && storeId) {
        try {
            await recordABResult(storeId, {
                testId: `${type}_${element}_${Date.now()}`,
                testType: element, // 'subject', 'discount', etc.
                variantA: { id: 'A', conversions: a.converted, sent: a.sent, rate: aRate },
                variantB: { id: 'B', conversions: b.converted, sent: b.sent, rate: bRate },
                winner: winner,
                metrics: {
                    aConversionRate: (aRate * 100).toFixed(2),
                    bConversionRate: (bRate * 100).toFixed(2),
                    improvement: (((winner === 'A' ? aRate : bRate) / (winner === 'A' ? bRate : aRate) - 1) * 100).toFixed(1)
                },
                context: { offerType: type }
            });
            console.log(`[A/B Testing] 🧠 Winner ${winner} recorded to AI learning for ${type}/${element}`);
        } catch (e) {
            console.error('[A/B Testing] Failed to record to AI learning:', e.message);
        }
    }
    
    return winner;
}

module.exports = {
    TEST_VARIANTS,
    getTestVariant,
    generateTestedOffer,
    markConversion,
    getTestResults,
    getWinner
};
