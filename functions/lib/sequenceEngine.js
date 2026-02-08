/**
 * SEQUENCE ENGINE V2 - Multi-Step WhatsApp + SMS + Email Sequences
 *
 * Personal marketing journeys across channels:
 *
 * ABANDONED CART:
 * - Step 1 (30 min): WhatsApp - "You left something behind" (no discount)
 * - Step 2 (2 hours): WhatsApp - "Still thinking? Here's 10% off"
 * - Step 3 (24 hours): SMS - "Final chance - 15% off + free shipping"
 *
 * POST PURCHASE:
 * - Step 1 (10 min): WhatsApp - Thank you!
 * - Step 2 (3 days): WhatsApp - Review request + upsell
 * - Step 3 (14 days): WhatsApp - Product recommendation
 *
 * WELCOME (new subscriber from any source):
 * - Step 1 (immediate): WhatsApp - Welcome + first offer
 * - Step 2 (24 hours): WhatsApp - Top product recommendation
 * - Step 3 (3 days): SMS - Reminder offer if no purchase
 *
 * WINBACK (dormant customer 30+ days):
 * - Step 1 (immediate): WhatsApp - "We miss you" + personal offer
 * - Step 2 (3 days): WhatsApp - Urgency + bigger discount
 * - Step 3 (7 days): SMS - Final offer
 *
 * BIRTHDAY:
 * - Step 1 (morning): WhatsApp - Birthday greeting + gift code
 * - Step 2 (3 days): SMS - Reminder if code unused
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

// SMS Sender
let smsSender;
try {
    smsSender = require('./smsSender');
} catch (e) {
    smsSender = null;
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
            channels: ['whatsapp'],
            subject: 'سلتك بانتظارك',
            body: 'مرحباً! لاحظنا أنك تركت بعض المنتجات في سلتك. هل تحتاج مساعدة في إكمال طلبك؟',
            whatsappBody: 'مرحباً {name}! 👋\n\nلاحظنا أنك تركت سلتك\n\n💰 القيمة: {cartValue} ر.س\n\n👉 أكمل طلبك: {checkoutUrl}',
            discount: 0
        },
        {
            step: 2,
            delay: 2 * 60 * 60 * 1000, // 2 hours
            channels: ['whatsapp'],
            subject: 'سلتك لا تزال في انتظارك',
            body: 'لأنك مميز، جهزنا لك خصم 10% على سلتك. العرض صالح لمدة ساعتين!',
            whatsappBody: 'مرحباً {name}!\n\nسلتك لسا بانتظارك 🛒\n\nجهزنا لك *خصم 10%* لأنك مميز!\n\n⏰ العرض صالح لمدة ساعتين\n\n👉 {checkoutUrl}',
            discount: 10
        },
        {
            step: 3,
            delay: 24 * 60 * 60 * 1000, // 24 hours — SMS fallback
            channels: ['sms'],
            subject: 'فرصة أخيرة',
            body: 'آخر فرصة! خصم 15% + شحن مجاني. العرض ينتهي خلال ساعات.',
            smsBody: 'آخر فرصة {name}! خصم 15% + شحن مجاني على سلتك من {storeName}. أكمل طلبك: {checkoutUrl}',
            discount: 15,
            bonus: 'شحن مجاني'
        }
    ],

    post_purchase: [
        {
            step: 1,
            delay: 10 * 60 * 1000, // 10 minutes
            channels: ['whatsapp'],
            subject: 'شكراً لطلبك!',
            body: 'شكراً لثقتك بنا! طلبك في الطريق.',
            whatsappBody: 'شكراً لطلبك {name}! 💚\n\nطلبك بقيمة {orderValue} ر.س في الطريق.\n\n🙏 نتمنى لك تجربة رائعة!',
            discount: 0
        },
        {
            step: 2,
            delay: 3 * 24 * 60 * 60 * 1000, // 3 days
            channels: ['whatsapp'],
            subject: 'كيف كانت تجربتك؟',
            body: 'شاركنا رأيك واحصل على خصم 15% على طلبك القادم.',
            whatsappBody: 'مرحباً {name}!\n\nهل وصل طلبك بأمان؟\n\nشاركنا رأيك واحصل على *خصم 15%* على طلبك القادم! 🎁',
            discount: 15
        },
        {
            step: 3,
            delay: 14 * 24 * 60 * 60 * 1000, // 14 days — product recommendation
            channels: ['whatsapp'],
            subject: 'منتجات تناسبك',
            body: 'عملاء مثلك أحبوا أيضاً هذه المنتجات.',
            whatsappBody: 'مرحباً {name}!\n\nجربت {lastProduct}؟ عملاء مثلك أحبوا أيضاً:\n\n{recommendation}\n\n👉 {storeUrl}',
            discount: 0
        }
    ],

    welcome: [
        {
            step: 1,
            delay: 0, // Immediate
            channels: ['whatsapp'],
            subject: 'أهلاً بك!',
            body: 'مرحباً وأهلاً بك! شكراً لانضمامك.',
            whatsappBody: 'أهلاً بك {name}! 🎉\n\nشكراً لانضمامك لـ {storeName}!\n\nكهدية ترحيبية، خصم 10% على أول طلب:\n🎁 الكود: WELCOME10\n\n👉 {storeUrl}',
            discount: 10
        },
        {
            step: 2,
            delay: 24 * 60 * 60 * 1000, // 24 hours
            channels: ['whatsapp'],
            subject: 'منتجاتنا الأكثر مبيعاً',
            body: 'تعرّف على منتجاتنا الأكثر طلباً.',
            whatsappBody: 'مرحباً {name}!\n\nهل تعرف أن أكثر منتجاتنا طلباً هي:\n\n{topProducts}\n\nلسا عندك خصم 10% على أول طلب! 🎁\n\n👉 {storeUrl}',
            discount: 0
        },
        {
            step: 3,
            delay: 3 * 24 * 60 * 60 * 1000, // 3 days — SMS if no purchase
            channels: ['sms'],
            subject: 'عرض خاص لك',
            body: 'عرض خاص لأنك لسا ما طلبت.',
            smsBody: 'عرض خاص من {storeName}: خصم 10% على أول طلب لك! الكود: WELCOME10 | {storeUrl}',
            discount: 10
        }
    ],

    winback: [
        {
            step: 1,
            delay: 0, // Immediate (triggered when customer becomes dormant)
            channels: ['whatsapp'],
            subject: 'وحشتنا!',
            body: 'مرحباً! وحشتنا وجهزنا لك عرض خاص.',
            whatsappBody: 'وحشتنا {name}! 💚\n\nصار لنا فترة ما شفناك.\n\nجهزنا لك عرض خاص — *خصم 15%* على طلبك القادم:\n🎁 الكود: COMEBACK15\n\n👉 {storeUrl}',
            discount: 15
        },
        {
            step: 2,
            delay: 3 * 24 * 60 * 60 * 1000, // 3 days
            channels: ['whatsapp'],
            subject: 'عرضك ينتهي قريب',
            body: 'آخر فرصة للاستفادة من خصم 20%.',
            whatsappBody: 'مرحباً {name}!\n\nلسا عرضك الخاص متاح ⏰\n\nارفعنا الخصم لك: *خصم 20%*!\n🎁 الكود: COMEBACK20\n\n👉 {storeUrl}',
            discount: 20
        },
        {
            step: 3,
            delay: 7 * 24 * 60 * 60 * 1000, // 7 days — SMS final push
            channels: ['sms'],
            subject: 'فرصة أخيرة',
            body: 'آخر فرصة! خصم 25% + شحن مجاني.',
            smsBody: 'آخر فرصة {name}! خصم 25% + شحن مجاني من {storeName}. الكود: COMEBACK25 | {storeUrl}',
            discount: 25,
            bonus: 'شحن مجاني'
        }
    ],

    birthday: [
        {
            step: 1,
            delay: 0, // Triggered on birthday morning
            channels: ['whatsapp'],
            subject: 'عيد ميلاد سعيد!',
            body: 'كل عام وأنت بخير! هديتك بانتظارك.',
            whatsappBody: 'عيد ميلاد سعيد {name}! 🎂🎁\n\nكل عام وأنت بخير!\n\nهديتك من {storeName}:\n*خصم 20%* على أي طلب!\n🎁 الكود: BDAY20\n\n⏰ صالح لمدة أسبوع\n\n👉 {storeUrl}',
            discount: 20
        },
        {
            step: 2,
            delay: 3 * 24 * 60 * 60 * 1000, // 3 days — SMS reminder
            channels: ['sms'],
            subject: 'هديتك لسا بانتظارك',
            body: 'هديتك لسا بانتظارك! خصم 20%.',
            smsBody: 'هديتك من {storeName} لسا بانتظارك! خصم 20% الكود: BDAY20 ينتهي خلال 4 أيام | {storeUrl}',
            discount: 20
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
                        .replace(/{name}/g, sequence.context.customerName || 'عميلنا')
                        .replace(/{storeName}/g, sequence.context.storeName || '')
                        .replace(/{cartValue}/g, sequence.context.cartValue || '')
                        .replace(/{orderValue}/g, sequence.context.orderValue || '')
                        .replace(/{checkoutUrl}/g, sequence.context.checkoutUrl || '')
                        .replace(/{storeUrl}/g, sequence.context.storeUrl || '')
                        .replace(/{lastProduct}/g, sequence.context.lastProduct || '')
                        .replace(/{recommendation}/g, sequence.context.recommendation || '')
                        .replace(/{topProducts}/g, sequence.context.topProducts || '');

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
        // SEND SMS (if channel includes sms)
        // ==========================================
        if (channels.includes('sms') && smsSender && sequence.context.phone) {
            try {
                let smsMessage = step.smsBody || step.body;
                smsMessage = smsMessage
                    .replace(/{name}/g, sequence.context.customerName || 'عميلنا')
                    .replace(/{storeName}/g, sequence.context.storeName || '')
                    .replace(/{checkoutUrl}/g, sequence.context.checkoutUrl || '')
                    .replace(/{storeUrl}/g, sequence.context.storeUrl || '');

                await smsSender.sendSMS(sequence.context.phone, smsMessage);
                stepResult.channels.push('sms');
                console.log(`💬 [Sequence] SMS sent: ${sequence.type} step ${sequence.currentStep + 1}`);
            } catch (e) {
                console.error(`❌ [Sequence] SMS error:`, e.message);
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

            // Move to next step only when at least one channel delivered
            sequence.currentStep++;

            if (sequence.currentStep < template.length) {
                const nextDelay = template[sequence.currentStep].delay;
                sequence.nextStepAt = new Date(Date.now() + nextDelay).toISOString();
            } else {
                sequence.status = 'completed';
                sequence.completedAt = new Date().toISOString();
            }
        } else {
            // Both channels failed — retry this step later
            sequence.nextStepAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
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
