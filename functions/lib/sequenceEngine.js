/**
 * SEQUENCE ENGINE - Multi-Step Email/SMS Sequences
 * 
 * Instead of 1 email, sends a smart sequence:
 * 
 * ABANDONED CART:
 * - Email 1 (30 min): "You left something behind" (no discount)
 * - Email 2 (2 hours): "Still thinking? Here's 10% off"
 * - Email 3 (24 hours): "Final chance - 15% off + free shipping"
 * 
 * Stops if customer completes purchase
 */

const fs = require('fs');
const path = require('path');

// Store active sequences
const SEQUENCES_FILE = path.join(__dirname, '..', 'data', 'sequences.json');

if (!fs.existsSync(SEQUENCES_FILE)) {
    fs.writeFileSync(SEQUENCES_FILE, JSON.stringify([]));
}

function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Sequence templates
const SEQUENCES = {
    cart_recovery: [
        {
            step: 1,
            delay: 30 * 60 * 1000, // 30 minutes
            channel: 'email',
            subject: '🛒 نسيت شيئاً في سلتك!',
            body: 'مرحباً! لاحظنا أنك تركت بعض المنتجات في سلتك. هل تحتاج مساعدة في إكمال طلبك؟',
            discount: 0
        },
        {
            step: 2,
            delay: 2 * 60 * 60 * 1000, // 2 hours
            channel: 'email',
            subject: '⏰ سلتك لا تزال في انتظارك - خصم 10%!',
            body: 'لأنك مميز، جهزنا لك خصم 10% على سلتك. العرض صالح لمدة ساعتين!',
            discount: 10
        },
        {
            step: 3,
            delay: 24 * 60 * 60 * 1000, // 24 hours
            channel: 'email',
            subject: '🚨 فرصة أخيرة! خصم 15% + شحن مجاني',
            body: 'هذه آخر فرصة لإتمام طلبك! خصم 15% + شحن مجاني. العرض ينتهي خلال ساعات.',
            discount: 15,
            bonus: 'شحن مجاني'
        }
    ],

    post_purchase: [
        {
            step: 1,
            delay: 10 * 60 * 1000, // 10 minutes
            channel: 'email',
            subject: '💚 شكراً لطلبك!',
            body: 'شكراً لثقتك بنا! طلبك في الطريق. هل تريد إضافة منتجات قبل الشحن؟',
            discount: 10
        },
        {
            step: 2,
            delay: 3 * 24 * 60 * 60 * 1000, // 3 days
            channel: 'email',
            subject: '⭐ كيف كانت تجربتك؟',
            body: 'نتمنى أن يكون طلبك قد وصل بأمان! شاركنا رأيك واحصل على خصم 15% على طلبك القادم.',
            discount: 15
        }
    ]
};

/**
 * Start a new sequence for a customer
 */
function startSequence(type, storeId, customerEmail, context = {}) {
    const sequences = readJSON(SEQUENCES_FILE);

    // Cancel any existing sequence for this customer + type
    const filtered = sequences.filter(s =>
        !(s.storeId === storeId && s.customerEmail === customerEmail && s.type === type)
    );

    // Create new sequence
    const sequence = {
        id: Date.now().toString(),
        type: type,
        storeId: storeId,
        customerEmail: customerEmail,
        context: context, // cart items, order info, etc.
        currentStep: 0,
        startedAt: new Date().toISOString(),
        nextStepAt: new Date(Date.now() + SEQUENCES[type][0].delay).toISOString(),
        status: 'active',
        history: []
    };

    filtered.push(sequence);
    writeJSON(SEQUENCES_FILE, filtered);

    console.log(`📧 [Sequence] Started ${type} sequence for ${customerEmail}`);
    return sequence;
}

/**
 * Cancel a sequence (e.g., when customer completes purchase)
 */
function cancelSequence(type, storeId, customerEmail) {
    const sequences = readJSON(SEQUENCES_FILE);

    const updated = sequences.map(s => {
        if (s.storeId === storeId && s.customerEmail === customerEmail && s.type === type && s.status === 'active') {
            s.status = 'cancelled';
            s.cancelledAt = new Date().toISOString();
            console.log(`✅ [Sequence] Cancelled ${type} sequence for ${customerEmail} (completed)`);
        }
        return s;
    });

    writeJSON(SEQUENCES_FILE, updated);
}

/**
 * Process pending sequence steps (run every minute)
 */
async function processPendingSteps(emailSender) {
    const sequences = readJSON(SEQUENCES_FILE);
    const now = new Date();
    let processed = 0;

    for (const sequence of sequences) {
        if (sequence.status !== 'active') continue;

        const nextStepTime = new Date(sequence.nextStepAt);
        if (nextStepTime > now) continue;

        const template = SEQUENCES[sequence.type];
        if (!template || sequence.currentStep >= template.length) {
            sequence.status = 'completed';
            continue;
        }

        const step = template[sequence.currentStep];

        // Send the message
        if (emailSender && step.channel === 'email') {
            const offer = {
                headline: step.subject,
                body: step.body,
                discount: step.discount,
                offer: step.discount > 0 ? `خصم ${step.discount}%` : null,
                urgency: step.bonus || null
            };

            await emailSender.sendOfferEmail(sequence.customerEmail, offer, {
                storeName: sequence.context.storeName || 'متجر رِبح',
                checkoutUrl: sequence.context.checkoutUrl || '#'
            });

            sequence.history.push({
                step: sequence.currentStep + 1,
                sentAt: new Date().toISOString(),
                subject: step.subject
            });

            processed++;
        }

        // Move to next step
        sequence.currentStep++;

        if (sequence.currentStep < template.length) {
            const nextDelay = template[sequence.currentStep].delay;
            sequence.nextStepAt = new Date(Date.now() + nextDelay).toISOString();
        } else {
            sequence.status = 'completed';
            sequence.completedAt = new Date().toISOString();
        }
    }

    writeJSON(SEQUENCES_FILE, sequences);

    if (processed > 0) {
        console.log(`📧 [Sequence] Processed ${processed} sequence steps`);
    }

    return processed;
}

/**
 * Get sequence stats
 */
function getSequenceStats(storeId) {
    const sequences = readJSON(SEQUENCES_FILE);
    const storeSequences = sequences.filter(s => s.storeId === storeId);

    return {
        active: storeSequences.filter(s => s.status === 'active').length,
        completed: storeSequences.filter(s => s.status === 'completed').length,
        cancelled: storeSequences.filter(s => s.status === 'cancelled').length,
        total: storeSequences.length
    };
}

module.exports = {
    SEQUENCES,
    startSequence,
    cancelSequence,
    processPendingSteps,
    getSequenceStats
};
