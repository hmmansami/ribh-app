/**
 * Campaign Launcher - Outreach Campaign Management for RIBH
 *
 * Manages multi-channel (WhatsApp, Email, SMS) outreach campaigns
 * with contact management, status tracking, and do-not-contact lists.
 *
 * Collections:
 *   campaigns                 - Campaign documents
 *   campaigns/{id}/contacts   - Contact subcollection per campaign
 *   do_not_contact            - Global do-not-contact phone list
 *
 * Features:
 *   - Create, start, pause, delete campaigns
 *   - Upload contacts via batch writes (respects Firestore 500-doc limit)
 *   - Multi-channel sending: WhatsApp, Email, SMS, or All
 *   - Anti-ban integration (human delays, message humanization)
 *   - Global do-not-contact list
 *   - Per-campaign stats aggregation
 *   - Export contacts for CSV generation
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// Lazy-loaded senders (optional deps - may not be present in all environments)
let whatsappSender, emailSender, smsSender, antiBan;
try { whatsappSender = require('./whatsappSender'); } catch (_) { whatsappSender = null; }
try { emailSender = require('./emailSender'); } catch (_) { emailSender = null; }
try { smsSender = require('./smsSender'); } catch (_) { smsSender = null; }
try { antiBan = require('./antiBan'); } catch (_) { antiBan = null; }

const CAMPAIGNS_COLLECTION = 'campaigns';
const DNC_COLLECTION = 'do_not_contact';

// Valid campaign statuses
const CAMPAIGN_STATUSES = ['draft', 'running', 'paused', 'completed'];

// Valid contact statuses
const CONTACT_STATUSES = [
    'pending', 'sent', 'read', 'replied',
    'interested', 'not_interested', 'blocked', 'do_not_contact'
];

// Pre-built message templates
const TEMPLATES = {
    A: {
        name: 'Direct',
        nameAr: 'مباشر',
        template: 'مرحبا {owner_name}! شفت متجرك {store_name}. 70% من زوارك يتركون سلاتهم. عندنا أداة مجانية تسترد هالمبيعات بالواتساب والذكاء الاصطناعي. تدفع بس لما نرجعلك فلوسك. تبي تجربها؟'
    },
    B: {
        name: 'Value-first',
        nameAr: 'قيمة أولاً',
        template: '{owner_name}، سويت تحليل سريع لمتجرك {store_name}. تقريباً تخسر {estimated_loss} ر.س شهرياً من السلات المتروكة. نقدر نسترد 15% منها تلقائياً. مجاناً. أرسل لك التقرير الكامل؟'
    },
    C: {
        name: 'Social Proof',
        nameAr: 'إثبات اجتماعي',
        template: 'مرحبا {owner_name}! أكثر من 100 متجر على سلة يستخدمون رِبح. متوسط الاسترداد: 13,000 ر.س/شهر. التفعيل مجاني ويأخذ 60 ثانية. تبي تجرب؟'
    }
};

// ==========================================
// HELPERS
// ==========================================

/**
 * Normalize Saudi phone number to international format
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[\s\-\(\)]/g, '');

    if (cleaned.startsWith('05')) {
        cleaned = '+966' + cleaned.substring(1);
    } else if (cleaned.startsWith('5') && cleaned.length === 9) {
        cleaned = '+966' + cleaned;
    } else if (cleaned.startsWith('966')) {
        cleaned = '+' + cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
        cleaned = '+966' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    return cleaned;
}

/**
 * Fill message template with contact data
 */
function fillTemplate(template, contact) {
    if (!template) return '';

    return template
        .replace(/\{owner_name\}/g, contact.name || contact.storeName || 'صاحب المتجر')
        .replace(/\{store_name\}/g, contact.storeName || contact.store_name || 'متجرك')
        .replace(/\{niche\}/g, contact.niche || '')
        .replace(/\{estimated_loss\}/g, contact.estimatedLoss || contact.estimated_loss || estimateLoss(contact.niche))
        .replace(/\{phone\}/g, contact.phone || '')
        .replace(/\{email\}/g, contact.email || '');
}

/**
 * Estimate monthly loss by niche (for {estimated_loss} variable)
 */
function estimateLoss(niche) {
    const losses = {
        'fashion': '12,000',
        'electronics': '18,000',
        'beauty': '8,000',
        'food': '6,000',
        'jewelry': '25,000',
        'sports': '10,000',
        'home': '14,000',
        'kids': '9,000'
    };
    const n = (niche || '').toLowerCase();
    return losses[n] || '10,000';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// CAMPAIGN CRUD
// ==========================================

/**
 * Create a new outreach campaign
 * @param {object} campaignData - { name, channel, message, dailyLimit, templateVariant }
 * @returns {{ campaignId: string, ... }}
 */
async function createCampaign(campaignData) {
    const db = getDb();

    const name = campaignData.name || 'Untitled Campaign';
    const channel = campaignData.channel || 'whatsapp';
    const validChannels = ['whatsapp', 'email', 'sms', 'all'];

    if (!validChannels.includes(channel)) {
        throw new Error('Invalid channel. Must be: ' + validChannels.join(', '));
    }

    const campaign = {
        name,
        channel,
        message: campaignData.message || campaignData.template || '',
        templateVariant: campaignData.templateVariant || null,
        dailyLimit: campaignData.dailyLimit || 200,
        status: 'draft',
        stats: {
            total: 0,
            pending: 0,
            sent: 0,
            read: 0,
            replied: 0,
            interested: 0,
            not_interested: 0,
            blocked: 0,
            do_not_contact: 0
        },
        sentToday: 0,
        sentTodayDate: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        startedAt: null,
        completedAt: null,
        lastSentAt: null
    };

    const ref = await db.collection(CAMPAIGNS_COLLECTION).add(campaign);
    console.log(`[CampaignLauncher] Created campaign "${name}" (${ref.id})`);

    return { campaignId: ref.id, ...campaign };
}

/**
 * Upload contacts to a campaign as a subcollection
 * @param {string} campaignId
 * @param {Array<object>} contacts - [{ name, phone, email, store_name, store_url, niche }]
 * @returns {{ uploaded: number, skippedDNC: number }}
 */
async function uploadContacts(campaignId, contacts) {
    const db = getDb();
    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
        throw new Error('Campaign not found');
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
        throw new Error('No contacts provided');
    }

    const contactsRef = campaignRef.collection('contacts');
    let uploaded = 0;
    let skipped = 0;

    // Process in batches of 450 (stay under Firestore 500 limit)
    const BATCH_LIMIT = 450;
    let batch = db.batch();
    let batchCount = 0;

    for (const contact of contacts) {
        const phone = normalizePhone(contact.phone);

        // Check do-not-contact list
        if (phone) {
            const dnc = await isDoNotContact(phone);
            if (dnc) {
                skipped++;
                continue;
            }
        }

        const contactDoc = {
            name: contact.name || '',
            phone: phone,
            email: contact.email || '',
            storeName: contact.store_name || contact.storeName || '',
            storeUrl: contact.store_url || contact.storeUrl || '',
            niche: contact.niche || '',
            estimatedLoss: contact.estimated_loss || contact.estimatedLoss || '',
            status: 'pending',
            sentAt: null,
            readAt: null,
            repliedAt: null,
            notes: [],
            messageVariant: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const ref = contactsRef.doc();
        batch.set(ref, contactDoc);
        batchCount++;
        uploaded++;

        // Commit when batch is full
        if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            console.log(`[CampaignLauncher] Uploaded ${uploaded} contacts...`);
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    // Update campaign totals
    await campaignRef.update({
        'stats.total': admin.firestore.FieldValue.increment(uploaded),
        'stats.pending': admin.firestore.FieldValue.increment(uploaded),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[CampaignLauncher] Uploaded ${uploaded} contacts to campaign ${campaignId} (${skipped} skipped)`);

    return { uploaded, skippedDNC: skipped };
}

/**
 * Start a campaign (set status to running)
 * @param {string} campaignId
 * @returns {{ status: string }}
 */
async function startCampaign(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
        throw new Error('Campaign not found');
    }

    const data = campaignDoc.data();
    if (data.status === 'running') {
        return { status: 'running', message: 'Campaign is already running' };
    }
    if (data.status === 'completed') {
        throw new Error('Cannot start a completed campaign');
    }

    await campaignRef.update({
        status: 'running',
        startedAt: data.startedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[CampaignLauncher] Started campaign ${campaignId}`);
    return { status: 'running' };
}

/**
 * Pause a campaign
 * @param {string} campaignId
 * @returns {{ status: string }}
 */
async function pauseCampaign(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) {
        throw new Error('Campaign not found');
    }

    if (campaignDoc.data().status !== 'running') {
        return { status: campaignDoc.data().status, message: 'Campaign is not running' };
    }

    await campaignRef.update({
        status: 'paused',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[CampaignLauncher] Paused campaign ${campaignId}`);
    return { status: 'paused' };
}

// ==========================================
// BATCH SENDING
// ==========================================

/**
 * Send next batch of messages for a campaign.
 * Respects daily limits and anti-ban rules.
 *
 * @param {string} campaignId
 * @param {number} [batchSize=20]
 * @returns {{ sent: number, failed: number, message?: string, results?: Array }}
 */
async function sendNextBatch(campaignId, batchSize = 20) {
    const db = getDb();
    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');
    const campaign = campaignDoc.data();

    if (campaign.status !== 'running') {
        return { sent: 0, failed: 0, message: 'Campaign is not running' };
    }

    // Check daily limit (reset if new day)
    const today = new Date().toISOString().split('T')[0];
    let sentToday = campaign.sentToday || 0;
    if (campaign.sentTodayDate !== today) {
        sentToday = 0;
        await campaignRef.update({ sentToday: 0, sentTodayDate: today });
    }

    if (sentToday >= campaign.dailyLimit) {
        return { sent: 0, failed: 0, message: 'Daily limit reached (' + campaign.dailyLimit + ')' };
    }

    const remaining = campaign.dailyLimit - sentToday;
    const limit = Math.min(batchSize, remaining);

    // Get next pending contacts
    const pendingSnap = await campaignRef.collection('contacts')
        .where('status', '==', 'pending')
        .limit(limit)
        .get();

    if (pendingSnap.empty) {
        // All contacts processed - mark complete
        await campaignRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { sent: 0, failed: 0, message: 'All contacts processed - campaign completed' };
    }

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const doc of pendingSnap.docs) {
        const contact = doc.data();

        // Check if campaign was paused mid-batch
        const freshCampaign = await campaignRef.get();
        if (freshCampaign.data().status !== 'running') {
            console.log(`[CampaignLauncher] Campaign ${campaignId} paused mid-batch`);
            break;
        }

        // Check anti-ban rate limits
        if (antiBan) {
            const canSend = antiBan.canSendNow(campaignId);
            if (!canSend.allowed) {
                console.log(`[CampaignLauncher] Rate limit hit: ${canSend.reason}`);
                break;
            }
        }

        // Check do-not-contact
        if (contact.phone) {
            const dnc = await isDoNotContact(contact.phone);
            if (dnc) {
                await doc.ref.update({
                    status: 'do_not_contact',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                await updateCampaignStatCounters(campaignRef, 'pending', 'do_not_contact');
                continue;
            }
        }

        try {
            // Fill template with contact data
            let message = fillTemplate(campaign.message, contact);

            // Humanize message if antiBan available
            if (antiBan && antiBan.humanizeMessage) {
                message = antiBan.humanizeMessage(message, { language: 'ar' });
            }

            // Send via appropriate channel(s)
            const sendResult = await sendViaChannel(campaign.channel, contact, message);

            if (sendResult.success) {
                await doc.ref.update({
                    status: 'sent',
                    sentAt: admin.firestore.FieldValue.serverTimestamp(),
                    messageVariant: campaign.templateVariant || null,
                    messageSent: message,
                    messageId: sendResult.messageId || null,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                await updateCampaignStatCounters(campaignRef, 'pending', 'sent');

                if (antiBan) antiBan.recordSent(campaignId);
                sent++;
                results.push({ contactId: doc.id, success: true });
            } else {
                // Keep as pending for retry, log error
                await doc.ref.update({
                    lastError: sendResult.error,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                failed++;
                results.push({ contactId: doc.id, success: false, error: sendResult.error });
            }

            // Add human-like delay between messages
            if (antiBan) {
                await sleep(antiBan.getHumanDelay());
            } else {
                // Default 2-5 second delay
                await sleep(2000 + Math.random() * 3000);
            }
        } catch (e) {
            console.error(`[CampaignLauncher] Error sending to ${contact.phone}:`, e.message);
            failed++;
            results.push({ contactId: doc.id, success: false, error: e.message });
        }
    }

    // Update campaign daily counter and last sent
    await campaignRef.update({
        sentToday: admin.firestore.FieldValue.increment(sent),
        'stats.sent': admin.firestore.FieldValue.increment(sent),
        lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Check if all contacts processed
    const stillPending = await campaignRef.collection('contacts')
        .where('status', '==', 'pending')
        .limit(1)
        .get();

    if (stillPending.empty) {
        await campaignRef.update({
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    console.log(`[CampaignLauncher] Batch complete for ${campaignId}: ${sent} sent, ${failed} failed`);
    return { sent, failed, total: pendingSnap.size, results };
}

/**
 * Send message via the appropriate channel
 */
async function sendViaChannel(channel, contact, message) {
    try {
        switch (channel) {
            case 'whatsapp':
                if (!whatsappSender) return { success: false, error: 'WhatsApp sender not configured' };
                if (!contact.phone) return { success: false, error: 'No phone number' };
                return await whatsappSender.sendMessage(contact.phone, message);

            case 'email':
                if (!emailSender) return { success: false, error: 'Email sender not configured' };
                if (!contact.email) return { success: false, error: 'No email address' };
                return await emailSender.sendEmail({
                    to: contact.email,
                    subject: (contact.storeName || 'متجرك') + ' - فرصة لزيادة مبيعاتك',
                    text: message,
                    html: '<div dir="rtl" style="font-family:sans-serif;line-height:1.8;">' +
                          message.replace(/\n/g, '<br>') + '</div>'
                });

            case 'sms':
                if (!smsSender) return { success: false, error: 'SMS sender not configured' };
                if (!contact.phone) return { success: false, error: 'No phone number' };
                const smsOk = await smsSender.sendSMS(contact.phone, message);
                return { success: !!smsOk, messageId: null };

            case 'all': {
                // Send via all available channels, prioritize WhatsApp
                const channelResults = [];

                if (contact.phone && whatsappSender) {
                    channelResults.push(await whatsappSender.sendMessage(contact.phone, message));
                }
                if (contact.email && emailSender) {
                    channelResults.push(await emailSender.sendEmail({
                        to: contact.email,
                        subject: (contact.storeName || 'متجرك') + ' - فرصة لزيادة مبيعاتك',
                        text: message,
                        html: '<div dir="rtl" style="font-family:sans-serif;line-height:1.8;">' +
                              message.replace(/\n/g, '<br>') + '</div>'
                    }));
                }
                if (contact.phone && smsSender) {
                    const sms = await smsSender.sendSMS(contact.phone, message);
                    channelResults.push({ success: !!sms });
                }

                const anySuccess = channelResults.some(r => r && r.success);
                const firstMessageId = (channelResults.find(r => r && r.messageId) || {}).messageId || null;
                return { success: anySuccess, messageId: firstMessageId, channels: channelResults.length };
            }

            default:
                return { success: false, error: 'Unknown channel: ' + channel };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Helper: update campaign stat counters when a contact status changes
 */
async function updateCampaignStatCounters(campaignRef, fromStatus, toStatus) {
    const updates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (fromStatus) {
        updates['stats.' + fromStatus] = admin.firestore.FieldValue.increment(-1);
    }
    if (toStatus) {
        updates['stats.' + toStatus] = admin.firestore.FieldValue.increment(1);
    }
    await campaignRef.update(updates);
}

// ==========================================
// CONTACT STATUS MANAGEMENT
// ==========================================

/**
 * Update a contact's status and optional note
 * @param {string} campaignId
 * @param {string} contactId
 * @param {string} status - One of CONTACT_STATUSES
 * @param {string} [note]
 */
async function updateContactStatus(campaignId, contactId, status, note) {
    const db = getDb();

    if (!CONTACT_STATUSES.includes(status)) {
        throw new Error('Invalid status. Must be: ' + CONTACT_STATUSES.join(', '));
    }

    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const contactRef = campaignRef.collection('contacts').doc(contactId);

    const contactDoc = await contactRef.get();
    if (!contactDoc.exists) {
        throw new Error('Contact not found');
    }

    const oldStatus = contactDoc.data().status;

    const updateData = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Set timestamps based on new status
    if (status === 'sent') updateData.sentAt = admin.firestore.FieldValue.serverTimestamp();
    if (status === 'read') updateData.readAt = admin.firestore.FieldValue.serverTimestamp();
    if (status === 'replied') updateData.repliedAt = admin.firestore.FieldValue.serverTimestamp();

    if (note) {
        updateData.notes = admin.firestore.FieldValue.arrayUnion({
            text: note,
            at: new Date().toISOString()
        });
    }

    await contactRef.update(updateData);

    // Update campaign stat counters
    if (oldStatus !== status) {
        await updateCampaignStatCounters(campaignRef, oldStatus, status);
    }

    // If marked do_not_contact, add to global list
    if (status === 'do_not_contact' && contactDoc.data().phone) {
        await markDoNotContact(contactDoc.data().phone);
    }

    console.log(`[CampaignLauncher] Contact ${contactId} status: ${oldStatus} -> ${status}`);
}

// ==========================================
// CAMPAIGN STATS
// ==========================================

/**
 * Get aggregated stats for a campaign (recalculated from contacts)
 * @param {string} campaignId
 * @returns {object} stats with rates
 */
async function getCampaignStats(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');
    const campaign = campaignDoc.data();

    // Aggregate from contacts subcollection for accuracy
    const contactsSnap = await campaignRef.collection('contacts').get();

    const stats = {
        total: contactsSnap.size,
        pending: 0,
        sent: 0,
        read: 0,
        replied: 0,
        interested: 0,
        not_interested: 0,
        blocked: 0,
        do_not_contact: 0
    };

    contactsSnap.forEach(doc => {
        const s = doc.data().status;
        if (stats.hasOwnProperty(s)) {
            stats[s]++;
        }
    });

    // Calculate rates
    const totalReached = stats.total - stats.pending - stats.do_not_contact;
    stats.reachRate = stats.total > 0
        ? Math.round((totalReached / stats.total) * 1000) / 10
        : 0;
    stats.replyRate = totalReached > 0
        ? Math.round(((stats.replied + stats.interested) / totalReached) * 1000) / 10
        : 0;
    stats.interestRate = totalReached > 0
        ? Math.round((stats.interested / totalReached) * 1000) / 10
        : 0;

    // Sync stats back to campaign document
    await campaignRef.update({
        'stats.total': stats.total,
        'stats.pending': stats.pending,
        'stats.sent': stats.sent,
        'stats.read': stats.read,
        'stats.replied': stats.replied,
        'stats.interested': stats.interested,
        'stats.not_interested': stats.not_interested,
        'stats.blocked': stats.blocked,
        'stats.do_not_contact': stats.do_not_contact,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
        campaignId,
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        ...stats,
        funnel: {
            contacted: totalReached,
            read: stats.read,
            replied: stats.replied,
            interested: stats.interested
        }
    };
}

/**
 * Get all campaigns with their stats
 * @returns {Array<object>}
 */
async function getAllCampaigns() {
    const db = getDb();
    const snap = await db.collection(CAMPAIGNS_COLLECTION)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name,
            channel: data.channel,
            status: data.status,
            dailyLimit: data.dailyLimit,
            stats: data.stats || {},
            createdAt: data.createdAt ? data.createdAt.toDate() : null,
            updatedAt: data.updatedAt ? data.updatedAt.toDate() : null,
            startedAt: data.startedAt ? data.startedAt.toDate() : null,
            completedAt: data.completedAt ? data.completedAt.toDate() : null
        };
    });
}

// ==========================================
// DO NOT CONTACT LIST
// ==========================================

/**
 * Add a phone to the global do-not-contact list
 * @param {string} phone
 */
async function markDoNotContact(phone) {
    const db = getDb();
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error('Invalid phone number');

    const docId = normalized.replace(/\+/g, '');
    await db.collection(DNC_COLLECTION).doc(docId).set({
        phone: normalized,
        addedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[CampaignLauncher] Added ${normalized} to do-not-contact list`);
}

/**
 * Check if a phone is in the do-not-contact list
 * @param {string} phone
 * @returns {boolean}
 */
async function isDoNotContact(phone) {
    try {
        const db = getDb();
        const normalized = normalizePhone(phone);
        if (!normalized) return false;

        const docId = normalized.replace(/\+/g, '');
        const doc = await db.collection(DNC_COLLECTION).doc(docId).get();
        return doc.exists;
    } catch (error) {
        console.error('[CampaignLauncher] isDoNotContact error:', error);
        return false;
    }
}

/**
 * Remove a phone from the do-not-contact list
 * @param {string} phone
 */
async function removeDoNotContact(phone) {
    const db = getDb();
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error('Invalid phone number');

    const docId = normalized.replace(/\+/g, '');
    await db.collection(DNC_COLLECTION).doc(docId).delete();

    console.log(`[CampaignLauncher] Removed ${normalized} from do-not-contact list`);
}

// ==========================================
// EXPORT RESULTS
// ==========================================

/**
 * Export all contacts for a campaign (for CSV generation)
 * @param {string} campaignId
 * @returns {Array<object>}
 */
async function exportResults(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');

    const snap = await campaignRef.collection('contacts')
        .orderBy('createdAt', 'asc')
        .get();

    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || '',
            phone: data.phone || '',
            email: data.email || '',
            storeName: data.storeName || '',
            storeUrl: data.storeUrl || '',
            niche: data.niche || '',
            status: data.status || 'pending',
            sentAt: data.sentAt ? (data.sentAt.toDate ? data.sentAt.toDate().toISOString() : data.sentAt) : null,
            readAt: data.readAt ? (data.readAt.toDate ? data.readAt.toDate().toISOString() : data.readAt) : null,
            repliedAt: data.repliedAt ? (data.repliedAt.toDate ? data.repliedAt.toDate().toISOString() : data.repliedAt) : null,
            notes: data.notes || [],
            note: (data.notes || []).map(n => n.text).join('; ')
        };
    });
}

// ==========================================
// DELETE CAMPAIGN
// ==========================================

/**
 * Delete a campaign and all its contacts
 * @param {string} campaignId
 * @returns {{ deleted: boolean, contactsDeleted: number }}
 */
async function deleteCampaign(campaignId) {
    const db = getDb();
    const campaignRef = db.collection(CAMPAIGNS_COLLECTION).doc(campaignId);
    const campaignDoc = await campaignRef.get();

    if (!campaignDoc.exists) throw new Error('Campaign not found');

    // Delete all contacts in subcollection (batch delete)
    const contactsSnap = await campaignRef.collection('contacts').get();
    const docs = contactsSnap.docs;

    const BATCH_LIMIT = 450;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        docs.slice(i, i + BATCH_LIMIT).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    // Delete campaign document
    await campaignRef.delete();

    console.log(`[CampaignLauncher] Deleted campaign ${campaignId} with ${docs.length} contacts`);
    return { deleted: true, contactsDeleted: docs.length };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Campaign CRUD
    createCampaign,
    uploadContacts,
    startCampaign,
    pauseCampaign,
    deleteCampaign,
    getAllCampaigns,

    // Sending
    sendNextBatch,

    // Contact management
    updateContactStatus,

    // Stats
    getCampaignStats,

    // Do Not Contact
    markDoNotContact,
    isDoNotContact,
    removeDoNotContact,

    // Export
    exportResults,

    // Utilities
    fillTemplate,
    normalizePhone,
    estimateLoss,

    // Constants / Templates
    TEMPLATES,
    CAMPAIGN_STATUSES,
    CONTACT_STATUSES
};
