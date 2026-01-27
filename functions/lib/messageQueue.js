/**
 * MESSAGE QUEUE - Firestore-backed WhatsApp Queue with Anti-Ban Protection
 * 
 * Rate limits: 20/hour, 100/day per store
 * Delay: 45 seconds to 3 minutes between messages (randomized)
 * Storage: Firestore "message_queue" collection
 * 
 * Uses antiBan.js for rate limiting and message humanization
 */

const admin = require('firebase-admin');
const antiBan = require('./antiBan');
const whatsappSender = require('./whatsappSender');

// Initialize Firestore if not already
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Collections
const QUEUE_COLLECTION = 'message_queue';
const STATS_COLLECTION = 'message_queue_stats';

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
    // Rate limits (from antiBan but enforced here with Firestore)
    MESSAGES_PER_HOUR: 20,
    MESSAGES_PER_DAY: 100,
    
    // Delays (milliseconds)
    MIN_DELAY_MS: 45000,   // 45 seconds
    MAX_DELAY_MS: 180000,  // 3 minutes
    
    // Batch processing
    MAX_BATCH_SIZE: 5,     // Process max 5 at a time
    BATCH_COOLDOWN_MS: 600000, // 10 min cooldown after batch
    
    // Active hours (Saudi time is UTC+3)
    ACTIVE_HOURS_START: 9,  // 9 AM
    ACTIVE_HOURS_END: 22,   // 10 PM
    
    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 300000, // 5 minutes
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Generate random delay between MIN and MAX
 */
function getRandomDelay() {
    const range = CONFIG.MAX_DELAY_MS - CONFIG.MIN_DELAY_MS;
    // Bell curve distribution for more natural variation
    const randomFactor = (Math.random() + Math.random() + Math.random()) / 3;
    return Math.floor(CONFIG.MIN_DELAY_MS + (range * randomFactor));
}

/**
 * Get current hour in Saudi Arabia (UTC+3)
 */
function getSaudiHour() {
    const now = new Date();
    return (now.getUTCHours() + 3) % 24;
}

/**
 * Check if we're in active hours
 */
function isActiveHours() {
    const hour = getSaudiHour();
    return hour >= CONFIG.ACTIVE_HOURS_START && hour < CONFIG.ACTIVE_HOURS_END;
}

/**
 * Calculate next active time if outside active hours
 */
function getNextActiveTime() {
    const now = new Date();
    const saudiHour = getSaudiHour();
    
    if (saudiHour >= CONFIG.ACTIVE_HOURS_END) {
        // After 10 PM - schedule for 9 AM tomorrow
        const hoursUntil9AM = 24 - saudiHour + CONFIG.ACTIVE_HOURS_START;
        return new Date(now.getTime() + hoursUntil9AM * 3600000);
    } else if (saudiHour < CONFIG.ACTIVE_HOURS_START) {
        // Before 9 AM - schedule for 9 AM today
        const hoursUntil9AM = CONFIG.ACTIVE_HOURS_START - saudiHour;
        return new Date(now.getTime() + hoursUntil9AM * 3600000);
    }
    
    return now; // We're in active hours
}

// ==========================================
// STATS MANAGEMENT (Firestore-backed)
// ==========================================

/**
 * Get or create store stats document
 */
async function getStoreStats(storeId) {
    const statsRef = db.collection(STATS_COLLECTION).doc(storeId);
    const doc = await statsRef.get();
    
    const now = Date.now();
    const hourStart = Math.floor(now / 3600000) * 3600000;
    const dayStart = Math.floor(now / 86400000) * 86400000;
    
    if (!doc.exists) {
        const defaultStats = {
            storeId,
            hourlyCount: 0,
            hourlyResetAt: hourStart + 3600000,
            dailyCount: 0,
            dailyResetAt: dayStart + 86400000,
            batchCount: 0,
            batchResetAt: null,
            totalSent: 0,
            totalFailed: 0,
            lastSentAt: null,
            isPaused: false,
            pauseUntil: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await statsRef.set(defaultStats);
        return defaultStats;
    }
    
    let stats = doc.data();
    let needsUpdate = false;
    
    // Reset hourly counter if needed
    if (now > stats.hourlyResetAt) {
        stats.hourlyCount = 0;
        stats.hourlyResetAt = hourStart + 3600000;
        needsUpdate = true;
    }
    
    // Reset daily counter if needed
    if (now > stats.dailyResetAt) {
        stats.dailyCount = 0;
        stats.dailyResetAt = dayStart + 86400000;
        stats.batchCount = 0;
        needsUpdate = true;
    }
    
    // Unpause if pause expired
    if (stats.isPaused && stats.pauseUntil && now > stats.pauseUntil) {
        stats.isPaused = false;
        stats.pauseUntil = null;
        needsUpdate = true;
    }
    
    if (needsUpdate) {
        await statsRef.update(stats);
    }
    
    return stats;
}

/**
 * Increment stats after sending
 */
async function incrementStats(storeId) {
    const statsRef = db.collection(STATS_COLLECTION).doc(storeId);
    await statsRef.update({
        hourlyCount: admin.firestore.FieldValue.increment(1),
        dailyCount: admin.firestore.FieldValue.increment(1),
        batchCount: admin.firestore.FieldValue.increment(1),
        totalSent: admin.firestore.FieldValue.increment(1),
        lastSentAt: Date.now(),
    });
}

/**
 * Increment failed count
 */
async function incrementFailed(storeId) {
    const statsRef = db.collection(STATS_COLLECTION).doc(storeId);
    await statsRef.update({
        totalFailed: admin.firestore.FieldValue.increment(1),
    });
}

/**
 * Check if store can send now (rate limit check)
 */
async function canSendNow(storeId) {
    const stats = await getStoreStats(storeId);
    const now = Date.now();
    
    // Check if paused
    if (stats.isPaused) {
        return {
            allowed: false,
            reason: 'account_paused',
            waitMs: stats.pauseUntil ? stats.pauseUntil - now : 3600000,
        };
    }
    
    // Check hourly limit
    if (stats.hourlyCount >= CONFIG.MESSAGES_PER_HOUR) {
        return {
            allowed: false,
            reason: 'hourly_limit_reached',
            waitMs: stats.hourlyResetAt - now,
        };
    }
    
    // Check daily limit
    if (stats.dailyCount >= CONFIG.MESSAGES_PER_DAY) {
        return {
            allowed: false,
            reason: 'daily_limit_reached',
            waitMs: stats.dailyResetAt - now,
        };
    }
    
    // Check batch cooldown
    if (stats.batchCount >= CONFIG.MAX_BATCH_SIZE && stats.batchResetAt) {
        if (now < stats.batchResetAt) {
            return {
                allowed: false,
                reason: 'batch_cooldown',
                waitMs: stats.batchResetAt - now,
            };
        }
        // Reset batch count
        const statsRef = db.collection(STATS_COLLECTION).doc(storeId);
        await statsRef.update({
            batchCount: 0,
            batchResetAt: null,
        });
    }
    
    // Check active hours
    if (!isActiveHours()) {
        const nextActive = getNextActiveTime();
        return {
            allowed: false,
            reason: 'outside_active_hours',
            waitMs: nextActive.getTime() - now,
        };
    }
    
    // Check minimum delay since last message
    if (stats.lastSentAt) {
        const timeSinceLast = now - stats.lastSentAt;
        if (timeSinceLast < CONFIG.MIN_DELAY_MS) {
            return {
                allowed: false,
                reason: 'too_soon',
                waitMs: CONFIG.MIN_DELAY_MS - timeSinceLast,
            };
        }
    }
    
    return { allowed: true };
}

// ==========================================
// QUEUE OPERATIONS
// ==========================================

/**
 * Add message to queue
 * @param {string} storeId - Store/merchant ID
 * @param {string} phone - Recipient phone number
 * @param {string} message - Message content
 * @param {object} options - Optional settings (templateName, language, metadata)
 * @returns {object} - { success, queueId, scheduledAt, position }
 */
async function addToQueue(storeId, phone, message, options = {}) {
    try {
        // Format phone number
        const formattedPhone = whatsappSender.formatPhone(phone);
        
        // Calculate scheduled time based on queue position
        const pendingQuery = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'pending')
            .orderBy('scheduledAt', 'desc')
            .limit(1)
            .get();
        
        let scheduledAt = Date.now();
        
        // If there are pending messages, schedule after the last one
        if (!pendingQuery.empty) {
            const lastMessage = pendingQuery.docs[0].data();
            scheduledAt = lastMessage.scheduledAt + getRandomDelay();
        } else {
            // Check if we can send now
            const canSend = await canSendNow(storeId);
            if (!canSend.allowed) {
                scheduledAt = Date.now() + (canSend.waitMs || 60000);
            } else {
                // Add small random delay even for first message
                scheduledAt = Date.now() + getRandomDelay();
            }
        }
        
        // Make sure we're in active hours
        if (!isActiveHours()) {
            const nextActive = getNextActiveTime();
            if (scheduledAt < nextActive.getTime()) {
                scheduledAt = nextActive.getTime() + getRandomDelay();
            }
        }
        
        // Create queue document
        const queueDoc = {
            storeId,
            phone: formattedPhone,
            message,
            templateName: options.templateName || null,
            language: options.language || 'ar',
            metadata: options.metadata || {},
            status: 'pending',
            scheduledAt,
            retryCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        const docRef = await db.collection(QUEUE_COLLECTION).add(queueDoc);
        
        // Get position in queue
        const positionQuery = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'pending')
            .get();
        
        console.log(`📝 [${storeId}] Queued message to ${formattedPhone} for ${new Date(scheduledAt).toISOString()}`);
        
        return {
            success: true,
            queueId: docRef.id,
            scheduledAt,
            scheduledAtISO: new Date(scheduledAt).toISOString(),
            position: positionQuery.size,
        };
    } catch (error) {
        console.error(`❌ [${storeId}] Failed to queue message:`, error);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Process the queue - sends due messages for all stores
 * Called by Cloud Scheduler or manually
 * @returns {object} - { processed, sent, failed, skipped }
 */
async function processQueue() {
    const now = Date.now();
    const results = {
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        errors: [],
    };
    
    try {
        // Get all pending messages that are due
        const dueMessages = await db.collection(QUEUE_COLLECTION)
            .where('status', '==', 'pending')
            .where('scheduledAt', '<=', now)
            .orderBy('scheduledAt', 'asc')
            .limit(50) // Process max 50 per run
            .get();
        
        if (dueMessages.empty) {
            console.log('📭 No messages to process');
            return results;
        }
        
        console.log(`📬 Processing ${dueMessages.size} due messages`);
        
        // Group by store for rate limiting
        const messagesByStore = new Map();
        dueMessages.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            if (!messagesByStore.has(data.storeId)) {
                messagesByStore.set(data.storeId, []);
            }
            messagesByStore.get(data.storeId).push(data);
        });
        
        // Process each store's messages
        for (const [storeId, messages] of messagesByStore) {
            for (const msg of messages) {
                results.processed++;
                
                // Check rate limits
                const canSend = await canSendNow(storeId);
                if (!canSend.allowed) {
                    // Reschedule the message
                    const newScheduledAt = now + (canSend.waitMs || 60000) + getRandomDelay();
                    await db.collection(QUEUE_COLLECTION).doc(msg.id).update({
                        scheduledAt: newScheduledAt,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        lastSkipReason: canSend.reason,
                    });
                    results.skipped++;
                    console.log(`⏭️ [${storeId}] Skipped ${msg.phone}: ${canSend.reason}`);
                    continue;
                }
                
                // Mark as processing
                await db.collection(QUEUE_COLLECTION).doc(msg.id).update({
                    status: 'processing',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                
                try {
                    // Humanize the message
                    const humanizedMessage = antiBan.humanizeMessage(msg.message, {
                        language: msg.language,
                    });
                    
                    // Send via WhatsApp
                    let result;
                    if (msg.templateName) {
                        result = await whatsappSender.sendTemplate(msg.phone, msg.templateName, {
                            language: msg.language,
                            components: msg.metadata.components || [],
                        });
                    } else {
                        result = await whatsappSender.sendMessage(msg.phone, humanizedMessage);
                    }
                    
                    if (result.success) {
                        // Mark as sent
                        await db.collection(QUEUE_COLLECTION).doc(msg.id).update({
                            status: 'sent',
                            sentAt: Date.now(),
                            messageId: result.messageId,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        
                        // Update stats
                        await incrementStats(storeId);
                        
                        // Also record in antiBan (for in-memory tracking)
                        antiBan.recordSent(storeId);
                        antiBan.recordContact(msg.phone);
                        
                        results.sent++;
                        console.log(`✅ [${storeId}] Sent to ${msg.phone}`);
                    } else {
                        throw new Error(result.error || 'Send failed');
                    }
                } catch (error) {
                    const retryCount = (msg.retryCount || 0) + 1;
                    
                    if (retryCount < CONFIG.MAX_RETRIES) {
                        // Retry later
                        const retryAt = now + CONFIG.RETRY_DELAY_MS * retryCount;
                        await db.collection(QUEUE_COLLECTION).doc(msg.id).update({
                            status: 'pending',
                            retryCount,
                            scheduledAt: retryAt,
                            lastError: error.message,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        console.log(`🔄 [${storeId}] Retry ${retryCount} for ${msg.phone}: ${error.message}`);
                    } else {
                        // Max retries reached - mark as failed
                        await db.collection(QUEUE_COLLECTION).doc(msg.id).update({
                            status: 'failed',
                            failedAt: Date.now(),
                            error: error.message,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        });
                        await incrementFailed(storeId);
                        console.log(`❌ [${storeId}] Failed ${msg.phone}: ${error.message}`);
                    }
                    
                    results.failed++;
                    results.errors.push({
                        queueId: msg.id,
                        phone: msg.phone,
                        error: error.message,
                    });
                }
                
                // Add delay between messages (even on failure)
                await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
            }
        }
        
        console.log(`📊 Queue processed: ${results.sent} sent, ${results.failed} failed, ${results.skipped} skipped`);
        return results;
        
    } catch (error) {
        console.error('❌ Queue processing error:', error);
        results.errors.push({ error: error.message });
        return results;
    }
}

/**
 * Get queue statistics for a store
 * @param {string} storeId - Store ID
 * @returns {object} - Detailed stats
 */
async function getQueueStats(storeId) {
    try {
        const stats = await getStoreStats(storeId);
        
        // Count queue items by status
        const pendingQuery = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'pending')
            .get();
        
        const processingQuery = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'processing')
            .get();
        
        // Get recent sent (last 24h)
        const dayAgo = Date.now() - 86400000;
        const sentQuery = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'sent')
            .where('sentAt', '>=', dayAgo)
            .get();
        
        // Get recent failed (last 24h)
        const failedQuery = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'failed')
            .where('failedAt', '>=', dayAgo)
            .get();
        
        // Get next scheduled message
        const nextMessage = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'pending')
            .orderBy('scheduledAt', 'asc')
            .limit(1)
            .get();
        
        let nextScheduledAt = null;
        if (!nextMessage.empty) {
            nextScheduledAt = nextMessage.docs[0].data().scheduledAt;
        }
        
        // Calculate limits
        const canSend = await canSendNow(storeId);
        
        return {
            storeId,
            queue: {
                pending: pendingQuery.size,
                processing: processingQuery.size,
                sentLast24h: sentQuery.size,
                failedLast24h: failedQuery.size,
                nextScheduledAt,
                nextScheduledAtISO: nextScheduledAt ? new Date(nextScheduledAt).toISOString() : null,
            },
            limits: {
                hourlyUsed: stats.hourlyCount,
                hourlyMax: CONFIG.MESSAGES_PER_HOUR,
                hourlyRemaining: CONFIG.MESSAGES_PER_HOUR - stats.hourlyCount,
                hourlyResetAt: new Date(stats.hourlyResetAt).toISOString(),
                dailyUsed: stats.dailyCount,
                dailyMax: CONFIG.MESSAGES_PER_DAY,
                dailyRemaining: CONFIG.MESSAGES_PER_DAY - stats.dailyCount,
                dailyResetAt: new Date(stats.dailyResetAt).toISOString(),
            },
            status: {
                canSendNow: canSend.allowed,
                reason: canSend.reason || null,
                waitMs: canSend.waitMs || null,
                isPaused: stats.isPaused,
                pauseUntil: stats.pauseUntil ? new Date(stats.pauseUntil).toISOString() : null,
            },
            totals: {
                sent: stats.totalSent,
                failed: stats.totalFailed,
                lastSentAt: stats.lastSentAt ? new Date(stats.lastSentAt).toISOString() : null,
            },
            config: {
                minDelaySeconds: CONFIG.MIN_DELAY_MS / 1000,
                maxDelaySeconds: CONFIG.MAX_DELAY_MS / 1000,
                activeHours: `${CONFIG.ACTIVE_HOURS_START}:00 - ${CONFIG.ACTIVE_HOURS_END}:00 (Saudi time)`,
            },
        };
    } catch (error) {
        console.error(`❌ [${storeId}] Failed to get queue stats:`, error);
        return {
            storeId,
            error: error.message,
        };
    }
}

/**
 * Cancel a queued message
 * @param {string} queueId - Queue document ID
 * @returns {object} - { success, message }
 */
async function cancelMessage(queueId) {
    try {
        const docRef = db.collection(QUEUE_COLLECTION).doc(queueId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return { success: false, error: 'Message not found' };
        }
        
        const data = doc.data();
        if (data.status !== 'pending') {
            return { success: false, error: `Cannot cancel message with status: ${data.status}` };
        }
        
        await docRef.update({
            status: 'cancelled',
            cancelledAt: Date.now(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        return { success: true, message: 'Message cancelled' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Clear all pending messages for a store
 * @param {string} storeId - Store ID
 * @returns {object} - { success, cleared }
 */
async function clearQueue(storeId) {
    try {
        const pendingQuery = await db.collection(QUEUE_COLLECTION)
            .where('storeId', '==', storeId)
            .where('status', '==', 'pending')
            .get();
        
        const batch = db.batch();
        pendingQuery.forEach(doc => {
            batch.update(doc.ref, {
                status: 'cancelled',
                cancelledAt: Date.now(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        
        await batch.commit();
        
        return { success: true, cleared: pendingQuery.size };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Core functions (required by task)
    addToQueue,
    processQueue,
    getQueueStats,
    
    // Additional utilities
    cancelMessage,
    clearQueue,
    canSendNow,
    
    // Config (for reference)
    CONFIG,
    
    // Helpers (for testing)
    getRandomDelay,
    isActiveHours,
    getNextActiveTime,
    getSaudiHour,
};
