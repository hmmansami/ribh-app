/**
 * Outreach Automation - RIBH Cold Outreach Pipeline
 *
 * Automated multi-channel outreach system based on Alex Hormozi's
 * 100M Leads framework: Build list -> Personalize + Big Fast Value ->
 * Volume (automate delivery + distribution + follow-up multiple times multiple ways).
 *
 * Features:
 *   - Message personalization with store-specific variables
 *   - Multi-step outreach sequences (WhatsApp Day 0,1,5 + Email Day 3)
 *   - Arabic templates in Saudi dialect
 *   - Category-specific estimated loss calculations
 *   - Campaign management with Firestore persistence
 *   - Real-time stats: sent, delivered, read, replied, interested, converted
 *   - Pause/resume campaigns
 *
 * Firestore structure:
 *   outreach_campaigns/{campaignId}
 *   outreach_campaigns/{campaignId}/steps/{stepId}
 *
 * Integrates with:
 *   - sallaScraper.js (lead source)
 *   - whatsappBridge.js (WhatsApp delivery)
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// Lazy-load optional dependencies
let whatsappBridge;
try { whatsappBridge = require('./lib/whatsappBridge'); } catch (_) { whatsappBridge = null; }

// ==========================================
// CATEGORY DATA (Estimated losses by vertical)
// ==========================================

const CATEGORY_DATA = {
    fashion: { avgMonthlyLoss: 15000, caseStudyAmount: 8500, arabicName: 'الأزياء والملابس' },
    electronics: { avgMonthlyLoss: 25000, caseStudyAmount: 12000, arabicName: 'الإلكترونيات' },
    beauty: { avgMonthlyLoss: 10000, caseStudyAmount: 5500, arabicName: 'العناية والجمال' },
    food: { avgMonthlyLoss: 8000, caseStudyAmount: 4000, arabicName: 'الأغذية والمشروبات' },
    home: { avgMonthlyLoss: 18000, caseStudyAmount: 9000, arabicName: 'المنزل والأثاث' },
    health: { avgMonthlyLoss: 12000, caseStudyAmount: 6000, arabicName: 'الصحة واللياقة' },
    kids: { avgMonthlyLoss: 11000, caseStudyAmount: 5000, arabicName: 'الأطفال والألعاب' },
    gifts: { avgMonthlyLoss: 9000, caseStudyAmount: 4500, arabicName: 'الهدايا والتغليف' },
    other: { avgMonthlyLoss: 12000, caseStudyAmount: 6000, arabicName: 'متاجر أخرى' }
};

// ==========================================
// OUTREACH TEMPLATES (Arabic, Saudi dialect)
// ==========================================

const OUTREACH_TEMPLATES = {
    first_touch: {
        channel: 'whatsapp',
        delayDays: 0,
        whatsapp: `مرحبا {store_name}! 👋

شفت متجركم على سلة وعجبني شغلكم في {category} 🔥

بدون مقدمات - متاجر {category} تخسر بالمتوسط {estimated_loss} ريال شهرياً من السلات المتروكة.

عندنا أداة مجانية تحسب لكم بالضبط كم تخسرون + تسترجع المبيعات المفقودة تلقائياً عبر واتساب.

أكثر من {social_proof_count} متجر بدأوا يسترجعون مبيعاتهم.

تبون أفعّلها لكم مجاناً؟ حرفياً دقيقتين ✅`
    },

    follow_up_1: {
        channel: 'whatsapp',
        delayDays: 1,
        whatsapp: `مرحبا مرة ثانية! 😊

متجر في نفس مجالكم ({category}) استرجع {case_study_amount} ريال في أول أسبوع.

الأداة مجانية بالكامل - ما تدفعون شي إلا لما نسترجع لكم مبيعات فعلية.

يعني لو ما استرجعنا شي = ما تدفعون شي. بسيطة 🤝

تبون تجربونها؟`
    },

    follow_up_email: {
        channel: 'email',
        delayDays: 3,
        subject: `{store_name} - كم تخسرون من السلات المتروكة؟`,
        body: `مرحباً،

تواصلت معكم قبل كم يوم بخصوص استرجاع السلات المتروكة.

حبيت أشارككم هالإحصائية:
• 70% من العملاء يتركون سلاتهم قبل الشراء
• متاجر {category} تخسر بالمتوسط {estimated_loss} ريال شهرياً
• نسبة استرجاع عبر واتساب تصل 25% (مقارنة بـ 3% للإيميل)

نقدر نفعّل لكم النظام مجاناً بالكامل.
ما تدفعون إلا نسبة بسيطة من المبيعات اللي نسترجعها لكم.

لو ما استرجعنا شي = ما تدفعون شي. ضمان كامل.

رد على هذا الإيميل أو راسلني واتساب وأنا أجهز كل شي.

مع التحية`
    },

    final_touch: {
        channel: 'whatsapp',
        delayDays: 5,
        whatsapp: `آخر رسالة مني 🙏

عرض الإعداد المجاني متاح لآخر {spots_remaining} متجر هالأسبوع.

ملخص سريع:
✅ مجاني بالكامل
✅ إعداد في دقيقتين
✅ استرجاع تلقائي عبر واتساب
✅ ما تدفعون إلا من المبيعات المسترجعة

لو تبون تسترجعون مبيعاتكم المفقودة - رد على هذي الرسالة وأنا أجهز كل شي لكم 🚀`
    }
};

// ==========================================
// OUTREACH SEQUENCES (Pre-built multi-step)
// ==========================================

const OUTREACH_SEQUENCES = {
    standard: {
        name: 'تسلسل قياسي',
        nameEn: 'Standard Sequence',
        description: '4 خطوات خلال 5 أيام - واتساب + إيميل',
        steps: [
            { templateKey: 'first_touch', delayDays: 0, channel: 'whatsapp' },
            { templateKey: 'follow_up_1', delayDays: 1, channel: 'whatsapp' },
            { templateKey: 'follow_up_email', delayDays: 3, channel: 'email' },
            { templateKey: 'final_touch', delayDays: 5, channel: 'whatsapp' }
        ]
    },
    whatsapp_only: {
        name: 'واتساب فقط',
        nameEn: 'WhatsApp Only',
        description: '3 رسائل واتساب خلال 5 أيام',
        steps: [
            { templateKey: 'first_touch', delayDays: 0, channel: 'whatsapp' },
            { templateKey: 'follow_up_1', delayDays: 1, channel: 'whatsapp' },
            { templateKey: 'final_touch', delayDays: 5, channel: 'whatsapp' }
        ]
    },
    aggressive: {
        name: 'تسلسل مكثف',
        nameEn: 'Aggressive Sequence',
        description: '4 خطوات خلال 3 أيام - متابعة سريعة',
        steps: [
            { templateKey: 'first_touch', delayDays: 0, channel: 'whatsapp' },
            { templateKey: 'follow_up_1', delayDays: 1, channel: 'whatsapp' },
            { templateKey: 'follow_up_email', delayDays: 2, channel: 'email' },
            { templateKey: 'final_touch', delayDays: 3, channel: 'whatsapp' }
        ]
    }
};

// ==========================================
// COLLECTIONS
// ==========================================

const OUTREACH_CAMPAIGNS_COLLECTION = 'outreach_campaigns';
const STEPS_SUBCOLLECTION = 'steps';

// ==========================================
// MESSAGE PERSONALIZATION
// ==========================================

/**
 * Calculate estimated monthly abandoned cart loss for a category
 * @param {string} category - Store category
 * @returns {number} Estimated monthly loss in SAR
 */
function calculateEstimatedLoss(category) {
    const data = CATEGORY_DATA[category] || CATEGORY_DATA.other;
    return data.avgMonthlyLoss;
}

/**
 * Generate a personalized opening line based on lead/store data
 * @param {object} lead - Lead data from scraper
 * @returns {string} Personal opener in Arabic
 */
function generatePersonalOpener(lead) {
    const parts = [];

    if (lead.storeName) {
        parts.push(`شفت متجر ${lead.storeName} وعجبني`);
    }

    if (lead.category && CATEGORY_DATA[lead.category]) {
        parts.push(`شغلكم في ${CATEGORY_DATA[lead.category].arabicName}`);
    }

    if (lead.city) {
        parts.push(`وأنتم في ${lead.city}`);
    }

    if (lead.socialLinks && lead.socialLinks.instagram) {
        parts.push(`وتابعت حسابكم في انستقرام`);
    }

    if (parts.length === 0) {
        return 'شفت متجركم على سلة وعجبني شغلكم';
    }

    return parts.join(' ') + ' 🔥';
}

/**
 * Personalize a message template with lead and store data
 * @param {string} template - Message template with {variable} placeholders
 * @param {object} lead - Lead data
 * @param {object} [storeData] - Additional store data
 * @returns {string} Personalized message
 */
function personalizeMessage(template, lead, storeData = {}) {
    if (!template || typeof template !== 'string') return '';

    const category = lead.category || 'other';
    const catData = CATEGORY_DATA[category] || CATEGORY_DATA.other;

    let message = template
        .replace(/\{store_name\}/g, lead.storeName || storeData.storeName || 'متجركم')
        .replace(/\{category\}/g, catData.arabicName)
        .replace(/\{estimated_loss\}/g, catData.avgMonthlyLoss.toLocaleString())
        .replace(/\{case_study_amount\}/g, catData.caseStudyAmount.toLocaleString())
        .replace(/\{city\}/g, lead.city || storeData.city || 'السعودية')
        .replace(/\{social_proof_count\}/g, storeData.socialProofCount || '150+')
        .replace(/\{spots_remaining\}/g, storeData.spotsRemaining || '10')
        .replace(/\{personal_opener\}/g, generatePersonalOpener(lead));

    return message;
}

// ==========================================
// CAMPAIGN MANAGEMENT
// ==========================================

/**
 * Create a new outreach campaign
 * @param {string} name - Campaign name
 * @param {object} filters - Lead filters { status, category, hasPhone }
 * @param {string} [sequenceKey='standard'] - Which sequence to use
 * @param {object} [options] - { socialProofCount, spotsRemaining }
 * @returns {{ campaignId: string, campaign: object }}
 */
async function createOutreachCampaign(name, filters = {}, sequenceKey = 'standard', options = {}) {
    const db = getDb();

    const sequence = OUTREACH_SEQUENCES[sequenceKey] || OUTREACH_SEQUENCES.standard;

    // Count leads matching filters
    let query = db.collection('leads');
    if (filters.status) query = query.where('status', '==', filters.status);
    if (filters.category) query = query.where('category', '==', filters.category);

    const leadsSnap = await query.limit(1000).get();
    let leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Client-side filters
    if (filters.hasPhone) {
        leads = leads.filter(l => !!l.phone);
    }

    const campaign = {
        name,
        sequenceKey,
        sequenceName: sequence.name,
        filters,
        leadCount: leads.length,
        status: 'draft', // draft, running, paused, completed
        currentStep: 0,
        totalSteps: sequence.steps.length,
        stats: {
            total: leads.length,
            sent: 0,
            delivered: 0,
            read: 0,
            replied: 0,
            interested: 0,
            converted: 0,
            failed: 0
        },
        options: {
            socialProofCount: options.socialProofCount || '150+',
            spotsRemaining: options.spotsRemaining || '10'
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
        pausedAt: null
    };

    const ref = await db.collection(OUTREACH_CAMPAIGNS_COLLECTION).add(campaign);
    console.log(`[OutreachAutomation] Created campaign "${name}" (${ref.id}) with ${leads.length} leads`);

    return { campaignId: ref.id, campaign: { id: ref.id, ...campaign } };
}

/**
 * Start an outreach campaign - begin processing first step
 * @param {string} campaignId
 * @param {object} [options] - { batchSize: 50, delayBetweenMs: 3000 }
 * @returns {object} Start result with stats
 */
async function startOutreachCampaign(campaignId, options = {}) {
    const db = getDb();
    const campaignRef = db.collection(OUTREACH_CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
        throw new Error('Campaign not found');
    }

    const campaign = campaignDoc.data();

    if (campaign.status === 'running') {
        return { status: 'already_running', message: 'الحملة تعمل بالفعل' };
    }
    if (campaign.status === 'completed') {
        throw new Error('لا يمكن إعادة تشغيل حملة مكتملة');
    }

    // Update status
    await campaignRef.update({
        status: 'running',
        startedAt: campaign.startedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Get the current step in the sequence
    const sequenceKey = campaign.sequenceKey || 'standard';
    const sequence = OUTREACH_SEQUENCES[sequenceKey] || OUTREACH_SEQUENCES.standard;
    const currentStepIndex = campaign.currentStep || 0;

    if (currentStepIndex >= sequence.steps.length) {
        await campaignRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { status: 'completed', message: 'جميع الخطوات مكتملة' };
    }

    const step = sequence.steps[currentStepIndex];

    // Get leads matching campaign filters
    let query = db.collection('leads');
    const filters = campaign.filters || {};
    if (filters.status) query = query.where('status', '==', filters.status);
    if (filters.category) query = query.where('category', '==', filters.category);

    const leadsSnap = await query.limit(1000).get();
    let leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (filters.hasPhone) {
        leads = leads.filter(l => !!l.phone);
    }

    // Process the current step
    const result = await processOutreachStep(campaignId, leads, step, campaign.options || {});

    // Update campaign stats
    await campaignRef.update({
        'stats.sent': admin.firestore.FieldValue.increment(result.sent),
        'stats.failed': admin.firestore.FieldValue.increment(result.failed),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
        status: 'running',
        step: currentStepIndex + 1,
        totalSteps: sequence.steps.length,
        sent: result.sent,
        failed: result.failed,
        message: `تم إرسال ${result.sent} رسالة في الخطوة ${currentStepIndex + 1}`
    };
}

/**
 * Process one step of an outreach sequence for a list of leads
 * @param {string} campaignId - Campaign ID
 * @param {object[]} leads - Array of lead objects
 * @param {object} step - Sequence step { templateKey, delayDays, channel }
 * @param {object} campaignOptions - Campaign options for personalization
 * @returns {{ sent: number, failed: number, steps: string[] }}
 */
async function processOutreachStep(campaignId, leads, step, campaignOptions = {}) {
    const db = getDb();
    const template = OUTREACH_TEMPLATES[step.templateKey];

    if (!template) {
        throw new Error('Template not found: ' + step.templateKey);
    }

    let sent = 0;
    let failed = 0;
    const stepIds = [];

    for (const lead of leads) {
        try {
            // Get the message text based on channel
            let messageText = '';
            if (step.channel === 'whatsapp') {
                messageText = template.whatsapp || '';
            } else if (step.channel === 'email') {
                messageText = template.body || '';
            }

            // Personalize the message
            const personalizedMessage = personalizeMessage(messageText, lead, campaignOptions);

            // Store the step in Firestore
            const stepData = {
                campaignId,
                leadId: lead.id,
                storeName: lead.storeName || '',
                phone: lead.phone || '',
                email: lead.email || '',
                channel: step.channel,
                templateKey: step.templateKey,
                message: personalizedMessage,
                subject: step.channel === 'email' ? personalizeMessage(template.subject || '', lead, campaignOptions) : null,
                status: 'pending',
                scheduledAt: admin.firestore.FieldValue.serverTimestamp(),
                sentAt: null,
                deliveredAt: null,
                readAt: null,
                repliedAt: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const stepRef = await db.collection(OUTREACH_CAMPAIGNS_COLLECTION)
                .doc(campaignId)
                .collection(STEPS_SUBCOLLECTION)
                .add(stepData);

            stepIds.push(stepRef.id);

            // Attempt to send
            let sendSuccess = false;
            if (step.channel === 'whatsapp' && lead.phone) {
                sendSuccess = await sendWhatsAppMessage(lead.phone, personalizedMessage);
            } else if (step.channel === 'email' && lead.email) {
                sendSuccess = await sendEmailMessage(
                    lead.email,
                    personalizeMessage(template.subject || '', lead, campaignOptions),
                    personalizedMessage
                );
            }

            // Update step status
            if (sendSuccess) {
                await stepRef.update({
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp()
                });
                sent++;
            } else {
                await stepRef.update({
                    status: 'failed',
                    error: 'Send failed or no delivery channel available'
                });
                failed++;
            }

            // Rate limiting: 3-5 second delay between messages
            await sleep(3000 + Math.random() * 2000);

        } catch (error) {
            console.error(`[OutreachAutomation] Error processing lead ${lead.id}:`, error.message);
            failed++;
        }
    }

    return { sent, failed, steps: stepIds };
}

/**
 * Schedule the next step for a lead in a campaign
 * @param {string} campaignId
 * @param {number} currentStepIndex - Current step index (0-based)
 * @returns {{ hasNext: boolean, nextStep: number, scheduledFor: Date | null }}
 */
async function scheduleNextStep(campaignId, currentStepIndex) {
    const db = getDb();
    const campaignRef = db.collection(OUTREACH_CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
        throw new Error('Campaign not found');
    }

    const campaign = campaignDoc.data();
    const sequence = OUTREACH_SEQUENCES[campaign.sequenceKey || 'standard'] || OUTREACH_SEQUENCES.standard;
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex >= sequence.steps.length) {
        // No more steps
        await campaignRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { hasNext: false, nextStep: null, scheduledFor: null };
    }

    const nextStep = sequence.steps[nextStepIndex];
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + nextStep.delayDays);

    await campaignRef.update({
        currentStep: nextStepIndex,
        nextStepAt: admin.firestore.Timestamp.fromDate(scheduledFor),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
        hasNext: true,
        nextStep: nextStepIndex,
        scheduledFor: scheduledFor.toISOString()
    };
}

/**
 * Check for replies on a campaign and categorize them
 * @param {string} campaignId
 * @returns {object} Reply stats
 */
async function checkForReplies(campaignId) {
    const db = getDb();
    const stepsSnap = await db.collection(OUTREACH_CAMPAIGNS_COLLECTION)
        .doc(campaignId)
        .collection(STEPS_SUBCOLLECTION)
        .where('status', '==', 'sent')
        .get();

    const stats = {
        checked: stepsSnap.size,
        replied: 0,
        interested: 0,
        notInterested: 0
    };

    // In a real implementation, this would check WhatsApp/email
    // for incoming replies and categorize them.
    // For now, return the stats structure.

    return stats;
}

// ==========================================
// CAMPAIGN STATUS MANAGEMENT
// ==========================================

/**
 * Pause a running outreach campaign
 * @param {string} campaignId
 * @returns {{ status: string, message: string }}
 */
async function pauseOutreach(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(OUTREACH_CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');

    if (campaignDoc.data().status !== 'running') {
        return { status: campaignDoc.data().status, message: 'الحملة ليست قيد التشغيل' };
    }

    await campaignRef.update({
        status: 'paused',
        pausedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { status: 'paused', message: 'تم إيقاف الحملة مؤقتاً' };
}

/**
 * Resume a paused outreach campaign
 * @param {string} campaignId
 * @returns {{ status: string, message: string }}
 */
async function resumeOutreach(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(OUTREACH_CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');

    if (campaignDoc.data().status !== 'paused') {
        return { status: campaignDoc.data().status, message: 'الحملة ليست متوقفة مؤقتاً' };
    }

    await campaignRef.update({
        status: 'running',
        pausedAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { status: 'running', message: 'تم استئناف الحملة' };
}

// ==========================================
// STATS & TRACKING
// ==========================================

/**
 * Get real-time stats for an outreach campaign
 * @param {string} campaignId
 * @returns {object} Campaign stats with rates
 */
async function getOutreachStats(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(OUTREACH_CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');

    const campaign = campaignDoc.data();
    const stats = campaign.stats || {};

    const total = stats.total || 0;
    const sent = stats.sent || 0;
    const delivered = stats.delivered || sent;
    const read = stats.read || 0;
    const replied = stats.replied || 0;
    const interested = stats.interested || 0;
    const converted = stats.converted || 0;
    const failed = stats.failed || 0;

    // Get step-level breakdown
    const stepsSnap = await campaignRef.collection(STEPS_SUBCOLLECTION).get();
    const stepBreakdown = {};
    stepsSnap.forEach(doc => {
        const step = doc.data();
        const key = step.templateKey || 'unknown';
        if (!stepBreakdown[key]) {
            stepBreakdown[key] = { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0 };
        }
        if (step.status === 'sent') stepBreakdown[key].sent++;
        if (step.status === 'delivered') stepBreakdown[key].delivered++;
        if (step.status === 'read') stepBreakdown[key].read++;
        if (step.status === 'replied') stepBreakdown[key].replied++;
        if (step.status === 'failed') stepBreakdown[key].failed++;
    });

    return {
        campaignId,
        name: campaign.name,
        status: campaign.status,
        sequenceKey: campaign.sequenceKey,
        currentStep: campaign.currentStep || 0,
        totalSteps: campaign.totalSteps || 0,
        stats: {
            total,
            sent,
            delivered,
            read,
            replied,
            interested,
            converted,
            failed
        },
        rates: {
            deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
            readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
            replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
            interestedRate: sent > 0 ? Math.round((interested / sent) * 100) : 0,
            conversionRate: sent > 0 ? Math.round((converted / sent) * 100) : 0,
            costPerLead: total > 0 ? Math.round((total * 0.05) * 100) / 100 : 0 // Estimated
        },
        stepBreakdown,
        createdAt: campaign.createdAt,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt
    };
}

/**
 * Get all outreach campaigns
 * @param {object} [filters] - { status }
 * @returns {object[]} Array of campaign summaries
 */
async function getOutreachCampaigns(filters = {}) {
    const db = getDb();
    let query = db.collection(OUTREACH_CAMPAIGNS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(50);

    if (filters.status) {
        query = db.collection(OUTREACH_CAMPAIGNS_COLLECTION)
            .where('status', '==', filters.status)
            .orderBy('createdAt', 'desc')
            .limit(50);
    }

    const snap = await query.get();
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            sequenceKey: data.sequenceKey,
            sequenceName: data.sequenceName,
            status: data.status,
            leadCount: data.leadCount || 0,
            currentStep: data.currentStep || 0,
            totalSteps: data.totalSteps || 0,
            stats: data.stats || {},
            createdAt: data.createdAt,
            startedAt: data.startedAt,
            completedAt: data.completedAt
        };
    });
}

/**
 * Record an outreach event (delivered, read, replied, interested, converted)
 * @param {string} campaignId
 * @param {string} stepId - Step document ID
 * @param {string} eventType - Event type
 * @param {object} [data] - Additional data
 */
async function recordOutreachEvent(campaignId, stepId, eventType, data = {}) {
    const db = getDb();
    const validEvents = ['delivered', 'read', 'replied', 'interested', 'converted'];

    if (!validEvents.includes(eventType)) {
        throw new Error('Invalid event type: ' + eventType);
    }

    // Update the step
    const stepRef = db.collection(OUTREACH_CAMPAIGNS_COLLECTION)
        .doc(campaignId)
        .collection(STEPS_SUBCOLLECTION)
        .doc(stepId);

    const updates = {
        status: eventType,
        [`${eventType}At`]: admin.firestore.FieldValue.serverTimestamp()
    };

    await stepRef.update(updates);

    // Update campaign-level stats
    const campaignRef = db.collection(OUTREACH_CAMPAIGNS_COLLECTION).doc(campaignId);
    await campaignRef.update({
        [`stats.${eventType}`]: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // If lead replied or is interested, update lead status in leads collection
    if (eventType === 'replied' || eventType === 'interested' || eventType === 'converted') {
        const stepDoc = await stepRef.get();
        if (stepDoc.exists) {
            const stepData = stepDoc.data();
            if (stepData.leadId) {
                const leadRef = db.collection('leads').doc(stepData.leadId);
                await leadRef.update({
                    status: eventType,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }
}

// ==========================================
// DELIVERY HELPERS
// ==========================================

/**
 * Send a WhatsApp message (via bridge or simulated)
 * @param {string} phone - Phone number
 * @param {string} message - Message text
 * @returns {boolean} Success
 */
async function sendWhatsAppMessage(phone, message) {
    if (!phone) return false;

    if (whatsappBridge) {
        try {
            await whatsappBridge.sendMessage(null, phone, message);
            return true;
        } catch (e) {
            console.error(`[OutreachAutomation] WhatsApp send failed to ${phone}:`, e.message);
            return false;
        }
    }

    // Simulated send (log only)
    console.log(`[OutreachAutomation] [SIMULATED] WhatsApp to ${phone}: ${message.substring(0, 50)}...`);
    return true;
}

/**
 * Send an email message (placeholder for email integration)
 * @param {string} email - Email address
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @returns {boolean} Success
 */
async function sendEmailMessage(email, subject, body) {
    if (!email) return false;

    // Placeholder: In production, integrate with Resend/AWS SES via server.js sendProfessionalEmail
    console.log(`[OutreachAutomation] [SIMULATED] Email to ${email}: ${subject}`);
    return true;
}

// ==========================================
// UTILITY
// ==========================================

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Personalization
    personalizeMessage,
    calculateEstimatedLoss,
    generatePersonalOpener,

    // Campaign Management
    createOutreachCampaign,
    startOutreachCampaign,
    pauseOutreach,
    resumeOutreach,

    // Outreach Execution
    processOutreachStep,
    scheduleNextStep,
    checkForReplies,

    // Stats & Tracking
    getOutreachStats,
    getOutreachCampaigns,
    recordOutreachEvent,

    // Templates & Sequences
    OUTREACH_TEMPLATES,
    OUTREACH_SEQUENCES,
    CATEGORY_DATA,

    // Constants
    OUTREACH_CAMPAIGNS_COLLECTION,
    STEPS_SUBCOLLECTION
};
