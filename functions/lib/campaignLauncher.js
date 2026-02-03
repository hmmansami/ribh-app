/**
 * RIBH Campaign Launcher
 * Cold outreach campaign management for recruiting Salla merchants
 *
 * Features:
 * - Create and manage outreach campaigns
 * - Upload contact lists (CSV)
 * - Track message delivery, reads, replies
 * - A/B test different message templates
 * - Do-not-contact list management
 * - Campaign stats and export
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// ==========================================
// CAMPAIGN MANAGEMENT
// ==========================================

/**
 * Create a new outreach campaign
 */
async function createCampaign(campaignData) {
    const db = getDb();
    const campaign = {
        name: campaignData.name || 'Untitled Campaign',
        channel: campaignData.channel || 'whatsapp', // whatsapp, email, sms, all
        template: campaignData.template || '',
        templateVariant: campaignData.templateVariant || 'A',
        schedule: campaignData.schedule || 'spread_24h', // immediate, spread_24h, spread_48h
        dailyLimit: campaignData.dailyLimit || 200,
        status: 'draft', // draft, running, paused, completed
        stats: {
            total: 0,
            sent: 0,
            delivered: 0,
            read: 0,
            replied: 0,
            interested: 0,
            notInterested: 0,
            blocked: 0,
            activated: 0
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
        lastSentAt: null,
        sentToday: 0,
        lastResetDate: new Date().toISOString().split('T')[0]
    };

    const ref = await db.collection('campaigns').add(campaign);
    console.log(`✅ Campaign created: ${ref.id} - ${campaign.name}`);
    return { campaignId: ref.id, ...campaign };
}

/**
 * Upload contacts to a campaign
 */
async function uploadContacts(campaignId, contacts) {
    const db = getDb();
    const batch = db.batch();
    let count = 0;

    // Check do-not-contact list
    const dncDoc = await db.collection('global').doc('doNotContact').get();
    const dncPhones = dncDoc.exists ? (dncDoc.data().phones || []) : [];

    for (const contact of contacts) {
        // Skip if on do-not-contact list
        const phone = normalizePhone(contact.phone);
        if (dncPhones.includes(phone)) {
            console.log(`⏭️ Skipping ${phone} - on do-not-contact list`);
            continue;
        }

        const contactData = {
            name: contact.name || '',
            phone: phone,
            email: contact.email || '',
            storeName: contact.store_name || contact.storeName || '',
            storeUrl: contact.store_url || contact.storeUrl || '',
            niche: contact.niche || '',
            estimatedLoss: contact.estimated_loss || contact.estimatedLoss || '',
            status: 'pending', // pending, sent, delivered, read, replied, interested, not_interested, blocked, do_not_contact
            sentAt: null,
            deliveredAt: null,
            readAt: null,
            repliedAt: null,
            notes: [],
            followUpDate: null,
            messageVariant: null
        };

        const ref = db.collection('campaigns').doc(campaignId).collection('contacts').doc();
        batch.set(ref, contactData);
        count++;

        // Firestore batch limit is 500
        if (count % 450 === 0) {
            await batch.commit();
            console.log(`📤 Uploaded ${count} contacts...`);
        }
    }

    if (count % 450 !== 0) {
        await batch.commit();
    }

    // Update campaign total
    await db.collection('campaigns').doc(campaignId).update({
        'stats.total': admin.firestore.FieldValue.increment(count)
    });

    console.log(`✅ Uploaded ${count} contacts to campaign ${campaignId}`);
    return { uploaded: count, skippedDNC: contacts.length - count };
}

/**
 * Start a campaign
 */
async function startCampaign(campaignId) {
    const db = getDb();
    await db.collection('campaigns').doc(campaignId).update({
        status: 'running',
        startedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`▶️ Campaign ${campaignId} started`);
    return { status: 'running' };
}

/**
 * Pause a campaign
 */
async function pauseCampaign(campaignId) {
    const db = getDb();
    await db.collection('campaigns').doc(campaignId).update({
        status: 'paused'
    });
    console.log(`⏸️ Campaign ${campaignId} paused`);
    return { status: 'paused' };
}

/**
 * Send next batch of messages for a campaign
 * Called by scheduler or manually
 */
async function sendNextBatch(campaignId, batchSize = 20) {
    const db = getDb();
    const campaignDoc = await db.collection('campaigns').doc(campaignId).get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');
    const campaign = campaignDoc.data();

    if (campaign.status !== 'running') {
        return { sent: 0, message: 'Campaign is not running' };
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    let sentToday = campaign.sentToday || 0;
    if (campaign.lastResetDate !== today) {
        sentToday = 0;
        await db.collection('campaigns').doc(campaignId).update({
            sentToday: 0,
            lastResetDate: today
        });
    }

    if (sentToday >= campaign.dailyLimit) {
        return { sent: 0, message: `Daily limit reached (${campaign.dailyLimit})` };
    }

    const remaining = campaign.dailyLimit - sentToday;
    const limit = Math.min(batchSize, remaining);

    // Get next pending contacts
    const pendingSnap = await db.collection('campaigns').doc(campaignId)
        .collection('contacts')
        .where('status', '==', 'pending')
        .limit(limit)
        .get();

    if (pendingSnap.empty) {
        // Check if campaign is complete
        await db.collection('campaigns').doc(campaignId).update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { sent: 0, message: 'All contacts processed - campaign completed' };
    }

    let sent = 0;
    const results = [];

    for (const doc of pendingSnap.docs) {
        const contact = doc.data();

        try {
            // Fill template with contact data
            const message = fillTemplate(campaign.template, contact);

            // Send based on channel
            let sendResult = { success: true };

            if (campaign.channel === 'whatsapp' || campaign.channel === 'all') {
                try {
                    const whatsappClient = require('./whatsappClient');
                    await whatsappClient.sendMessage(contact.phone, message);
                } catch (e) {
                    console.log(`⚠️ WhatsApp send failed for ${contact.phone}:`, e.message);
                    sendResult = { success: false, error: e.message };
                }
            }

            if (campaign.channel === 'email' || campaign.channel === 'all') {
                if (contact.email) {
                    try {
                        const emailSender = require('./emailSender');
                        await emailSender.sendEmail({
                            to: contact.email,
                            subject: `${contact.storeName} - فرصة لزيادة مبيعاتك`,
                            body: message
                        });
                    } catch (e) {
                        console.log(`⚠️ Email send failed for ${contact.email}:`, e.message);
                    }
                }
            }

            // Update contact status
            await doc.ref.update({
                status: sendResult.success ? 'sent' : 'failed',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                messageVariant: campaign.templateVariant,
                messageSent: message
            });

            if (sendResult.success) sent++;
            results.push({ contactId: doc.id, ...sendResult });

            // Human-like delay between messages (2-5 seconds)
            await sleep(2000 + Math.random() * 3000);

        } catch (e) {
            console.error(`❌ Error sending to ${contact.phone}:`, e.message);
            results.push({ contactId: doc.id, success: false, error: e.message });
        }
    }

    // Update campaign stats
    await db.collection('campaigns').doc(campaignId).update({
        'stats.sent': admin.firestore.FieldValue.increment(sent),
        sentToday: admin.firestore.FieldValue.increment(sent),
        lastSentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`📤 Campaign ${campaignId}: Sent ${sent}/${pendingSnap.size} messages`);
    return { sent, total: pendingSnap.size, results };
}

/**
 * Update a contact's status
 */
async function updateContactStatus(campaignId, contactId, status, note = null) {
    const db = getDb();
    const updateData = { status };

    // Set timestamp based on status
    const timestampMap = {
        'delivered': 'deliveredAt',
        'read': 'readAt',
        'replied': 'repliedAt'
    };
    if (timestampMap[status]) {
        updateData[timestampMap[status]] = admin.firestore.FieldValue.serverTimestamp();
    }

    if (note) {
        updateData.notes = admin.firestore.FieldValue.arrayUnion({
            text: note,
            at: new Date().toISOString()
        });
    }

    await db.collection('campaigns').doc(campaignId)
        .collection('contacts').doc(contactId).update(updateData);

    // Update campaign stats
    const statKey = `stats.${status}`;
    await db.collection('campaigns').doc(campaignId).update({
        [statKey]: admin.firestore.FieldValue.increment(1)
    });

    console.log(`📝 Contact ${contactId} status → ${status}`);
}

/**
 * Get campaign statistics
 */
async function getCampaignStats(campaignId) {
    const db = getDb();
    const campaignDoc = await db.collection('campaigns').doc(campaignId).get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');
    const campaign = campaignDoc.data();

    // Calculate rates
    const stats = campaign.stats || {};
    const sent = stats.sent || 0;

    return {
        ...stats,
        deliveryRate: sent > 0 ? ((stats.delivered || 0) / sent * 100).toFixed(1) : 0,
        readRate: sent > 0 ? ((stats.read || 0) / sent * 100).toFixed(1) : 0,
        replyRate: sent > 0 ? ((stats.replied || 0) / sent * 100).toFixed(1) : 0,
        interestRate: sent > 0 ? ((stats.interested || 0) / sent * 100).toFixed(1) : 0,
        conversionRate: sent > 0 ? ((stats.activated || 0) / sent * 100).toFixed(1) : 0,
        funnel: {
            contacted: sent,
            read: stats.read || 0,
            replied: stats.replied || 0,
            interested: stats.interested || 0,
            activated: stats.activated || 0
        }
    };
}

/**
 * Get all campaigns
 */
async function getAllCampaigns() {
    const db = getDb();
    const snap = await db.collection('campaigns')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Mark a phone number as do-not-contact (global)
 */
async function markDoNotContact(phone) {
    const db = getDb();
    const normalized = normalizePhone(phone);

    await db.collection('global').doc('doNotContact').set({
        phones: admin.firestore.FieldValue.arrayUnion(normalized),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`🚫 Marked ${normalized} as do-not-contact`);
}

/**
 * Check if phone is on do-not-contact list
 */
async function isDoNotContact(phone) {
    const db = getDb();
    const normalized = normalizePhone(phone);
    const doc = await db.collection('global').doc('doNotContact').get();

    if (!doc.exists) return false;
    return (doc.data().phones || []).includes(normalized);
}

/**
 * Export campaign results as array
 */
async function exportResults(campaignId) {
    const db = getDb();
    const snap = await db.collection('campaigns').doc(campaignId)
        .collection('contacts')
        .orderBy('sentAt', 'desc')
        .get();

    return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || null,
        deliveredAt: doc.data().deliveredAt?.toDate?.()?.toISOString() || null,
        readAt: doc.data().readAt?.toDate?.()?.toISOString() || null,
        repliedAt: doc.data().repliedAt?.toDate?.()?.toISOString() || null
    }));
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Fill message template with contact data
 */
function fillTemplate(template, contact) {
    if (!template) return '';

    return template
        .replace(/\{owner_name\}/g, contact.name || 'صاحب المتجر')
        .replace(/\{store_name\}/g, contact.storeName || 'متجرك')
        .replace(/\{niche\}/g, contact.niche || '')
        .replace(/\{estimated_loss\}/g, contact.estimatedLoss || '10,000')
        .replace(/\{phone\}/g, contact.phone || '')
        .replace(/\{email\}/g, contact.email || '');
}

/**
 * Normalize Saudi phone number
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[\s\-\(\)]/g, '');

    // Saudi Arabia number normalization
    if (cleaned.startsWith('05')) {
        cleaned = '+966' + cleaned.substring(1);
    } else if (cleaned.startsWith('5') && cleaned.length === 9) {
        cleaned = '+966' + cleaned;
    } else if (cleaned.startsWith('966')) {
        cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    return cleaned;
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// PRE-BUILT TEMPLATES
// ==========================================

const TEMPLATES = {
    A: {
        name: 'Direct',
        nameAr: 'مباشر',
        template: `مرحبا {owner_name}! 👋

شفت متجرك {store_name} - عجبتني منتجاتك

سؤال سريع: تعرف إن 70% من زوارك يتركون سلاتهم بدون ما يشترون؟

عندنا أداة مجانية تسترد هالمبيعات تلقائياً عن طريق الواتساب والذكاء الاصطناعي.

مجانية بالكامل. تدفع بس لما نرجعلك فلوسك.

تبي تجربها؟ 🚀`
    },
    B: {
        name: 'Value-first',
        nameAr: 'قيمة أولاً',
        template: `{owner_name}، سويت تحليل سريع لمتجرك {store_name}

تقريباً تخسر {estimated_loss} ر.س شهرياً من السلات المتروكة 😱

نقدر نسترد 15% منها تلقائياً. مجاناً.

أرسل لك التقرير الكامل؟ 📊`
    },
    C: {
        name: 'Social Proof',
        nameAr: 'إثبات اجتماعي',
        template: `مرحبا {owner_name}! 👋

أكثر من 100 متجر على سلة يستخدمون رِبح لاسترداد السلات المتروكة

متوسط الاسترداد: 13,000 ر.س/شهر 💰

التفعيل مجاني ويأخذ 60 ثانية فقط

تبي تجرب؟ ⚡`
    }
};

module.exports = {
    createCampaign,
    uploadContacts,
    startCampaign,
    pauseCampaign,
    sendNextBatch,
    updateContactStatus,
    getCampaignStats,
    getAllCampaigns,
    markDoNotContact,
    isDoNotContact,
    exportResults,
    fillTemplate,
    TEMPLATES
};
