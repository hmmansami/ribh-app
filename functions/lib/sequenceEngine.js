/**
 * SEQUENCE ENGINE V2 - Multi-Step Email + WhatsApp Sequences
 * 
 * Instead of 1 message, sends a smart sequence across channels:
 * 
 * ABANDONED CART:
 * - Step 1 (30 min): WhatsApp + Email - "You left something behind" (no discount)
 * - Step 2 (2 hours): Email - "Still thinking? Here's 10% off"
 * - Step 3 (24 hours): WhatsApp + Email - "Final chance - 15% off + free shipping"
 * 
 * POST PURCHASE:
 * - Step 1 (10 min): WhatsApp - Thank you!
 * - Step 2 (3 days): Email - Review request + upsell
 * 
 * Stops if customer completes purchase (cancelSequence)
 */

const fs = require('fs');
const path = require('path');

// WhatsApp Client for HTTP → Render Bridge
let whatsappClient;
try {
    whatsappClient = require('./whatsappClient');
} catch (e) {
    whatsappClient = null;
}

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

// Sequence templates - Now with multi-channel support!
const SEQUENCES = {
    cart_recovery: [
        {
            step: 1,
            delay: 30 * 60 * 1000, // 30 minutes
            channels: ['whatsapp', 'email'], // WhatsApp first, email fallback
            subject: '🛒 نسيت شيئاً في سلتك!',
            body: 'مرحباً! لاحظنا أنك تركت بعض المنتجات في سلتك. هل تحتاج مساعدة في إكمال طلبك؟',
            whatsappBody: 'مرحباً {name}! 👋\n\nلاحظنا أنك تركت سلتك 🛒\n\n💰 القيمة: {cartValue} ر.س\n\n👉 أكمل طلبك: {checkoutUrl}',
            discount: 0
        },
        {
            step: 2,
            delay: 2 * 60 * 60 * 1000, // 2 hours
            channels: ['email'], // Email only (don't spam WhatsApp)
            subject: '⏰ سلتك لا تزال في انتظارك - خصم 10%!',
            body: 'لأنك مميز، جهزنا لك خصم 10% على سلتك. العرض صالح لمدة ساعتين!',
            discount: 10
        },
        {
            step: 3,
            delay: 24 * 60 * 60 * 1000, // 24 hours
            channels: ['whatsapp', 'email'], // Final push - both channels
            subject: '🚨 فرصة أخيرة! خصم 15% + شحن مجاني',
            body: 'هذه آخر فرصة لإتمام طلبك! خصم 15% + شحن مجاني. العرض ينتهي خلال ساعات.',
            whatsappBody: '🚨 آخر فرصة {name}!\n\n*خصم 15% + شحن مجاني* على سلتك!\n\n⏰ ينتهي خلال ساعات\n\n👉 {checkoutUrl}',
            discount: 15,
            bonus: 'شحن مجاني'
        }
    ],

    post_purchase: [
        {
            step: 1,
            delay: 10 * 60 * 1000, // 10 minutes
            channels: ['whatsapp'], // WhatsApp thank you is more personal
            subject: '💚 شكراً لطلبك!',
            body: 'شكراً لثقتك بنا! طلبك في الطريق.',
            whatsappBody: 'شكراً لطلبك {name}! 💚\n\nطلبك بقيمة {orderValue} ر.س في الطريق.\n\n🙏 نتمنى لك تجربة رائعة!',
            discount: 0
        },
        {
            step: 2,
            delay: 3 * 24 * 60 * 60 * 1000, // 3 days
            channels: ['email', 'whatsapp'], // Review request
            subject: '⭐ كيف كانت تجربتك؟',
            body: 'نتمنى أن يكون طلبك قد وصل بأمان! شاركنا رأيك واحصل على خصم 15% على طلبك القادم.',
            whatsappBody: 'مرحباً {name}! ⭐\n\nهل وصل طلبك بأمان؟\n\nشاركنا رأيك واحصل على *خصم 15%* على طلبك القادم! 🎁',
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
 * Process pending sequence steps (run every 5 minutes via keep-alive)
 * Now supports both Email AND WhatsApp!
 */
async function processPendingSteps(emailSender) {
    const sequences = readJSON(SEQUENCES_FILE);
    const now = new Date();
    let processed = 0;
    let whatsappSent = 0;
    let emailsSent = 0;

    for (const sequence of sequences) {
        if (sequence.status !== 'active') continue;

        const nextStepTime = new Date(sequence.nextStepAt);
        if (nextStepTime > now) continue;

        const template = SEQUENCES[sequence.type];
        if (!template || sequence.currentStep >= template.length) {
            sequence.status = 'completed';
            sequence.completedAt = new Date().toISOString();
            continue;
        }

        const step = template[sequence.currentStep];
        const channels = step.channels || [step.channel || 'email'];
        
        const offer = {
            headline: step.subject,
            body: step.body,
            discount: step.discount,
            offer: step.discount > 0 ? `خصم ${step.discount}%` : null,
            urgency: step.bonus || null
        };

        const stepResult = {
            step: sequence.currentStep + 1,
            sentAt: new Date().toISOString(),
            subject: step.subject,
            channels: []
        };

        // ==========================================
        // SEND WHATSAPP (if channel includes whatsapp)
        // ==========================================
        if (channels.includes('whatsapp') && whatsappClient && sequence.context.phone) {
            try {
                const isConnected = await whatsappClient.isConnected(sequence.storeId);
                
                if (isConnected) {
                    // Build personalized WhatsApp message
                    let waMessage = step.whatsappBody || step.body;
                    waMessage = waMessage
                        .replace('{name}', sequence.context.customerName || 'عميلنا')
                        .replace('{cartValue}', sequence.context.cartValue || '')
                        .replace('{orderValue}', sequence.context.orderValue || '')
                        .replace('{checkoutUrl}', sequence.context.checkoutUrl || '')
                        .replace('{storeUrl}', sequence.context.storeUrl || '');

                    if (step.discount > 0) {
                        waMessage += `\n\n🎁 خصم ${step.discount}%`;
                    }

                    const result = await whatsappClient.sendMessage(
                        sequence.storeId,
                        sequence.context.phone,
                        waMessage
                    );

                    if (result.success) {
                        stepResult.channels.push('whatsapp');
                        whatsappSent++;
                        console.log(`📱 [Sequence] WhatsApp sent: ${sequence.type} step ${sequence.currentStep + 1}`);
                    }
                }
            } catch (e) {
                console.error(`❌ [Sequence] WhatsApp error:`, e.message);
            }
        }

        // ==========================================
        // SEND EMAIL (if channel includes email)
        // ==========================================
        if (channels.includes('email') && emailSender && sequence.customerEmail) {
            try {
                await emailSender.sendOfferEmail(sequence.customerEmail, offer, {
                    storeName: sequence.context.storeName || 'متجر رِبح',
                    checkoutUrl: sequence.context.checkoutUrl || '#'
                });

                stepResult.channels.push('email');
                emailsSent++;
                console.log(`📧 [Sequence] Email sent: ${sequence.type} step ${sequence.currentStep + 1}`);
            } catch (e) {
                console.error(`❌ [Sequence] Email error:`, e.message);
            }
        }

        // Only count as processed if at least one channel succeeded
        if (stepResult.channels.length > 0) {
            sequence.history.push(stepResult);
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
        console.log(`✅ [Sequence] Processed ${processed} steps (📧 ${emailsSent} emails, 📱 ${whatsappSent} WhatsApp)`);
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
