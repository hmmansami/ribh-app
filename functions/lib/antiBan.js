/**
 * ANTI-BAN SYSTEM - Bulletproof WhatsApp Protection
 * 
 * WHY ACCOUNTS GET BANNED:
 * 1. Too many messages too fast
 * 2. Same/similar messages (template detection)
 * 3. New numbers sending bulk = no warm-up
 * 4. Getting reported/blocked by recipients
 * 5. Abnormal patterns (24/7 no breaks)
 * 
 * THIS MODULE MAKES MESSAGING IMPOSSIBLE TO DETECT
 */

// ==========================================
// CONFIGURATION
// ==========================================

const CONFIG = {
    // Rate limits (conservative for safety)
    MESSAGES_PER_HOUR: 20,          // Max 20/hour
    MESSAGES_PER_DAY: 100,          // Max 100/day
    MESSAGES_PER_BATCH: 5,          // Max 5 before forced break

    // Warm-up period for new numbers (days)
    WARMUP_DAYS: 7,
    WARMUP_DAILY_LIMITS: [5, 10, 15, 25, 40, 60, 80], // Day 1-7 limits

    // Delays (milliseconds)
    MIN_DELAY_BETWEEN_MSGS: 45000,   // 45 seconds minimum
    MAX_DELAY_BETWEEN_MSGS: 180000,  // 3 minutes maximum
    TYPING_MIN_DURATION: 2000,       // 2 seconds
    TYPING_MAX_DURATION: 8000,       // 8 seconds
    BATCH_COOLDOWN: 600000,          // 10 min break after 5 messages

    // Active hours (avoid suspicious 3am messages)
    ACTIVE_HOURS_START: 9,           // 9 AM
    ACTIVE_HOURS_END: 22,            // 10 PM

    // Message variation
    EMOJI_VARIATIONS: ['👋', '😊', '🙂', '👍', '💚', '🌟', '✨'],
    GREETING_VARIATIONS_AR: ['مرحباً', 'أهلاً', 'هلا', 'السلام عليكم', 'أهلين'],
    GREETING_VARIATIONS_EN: ['Hi', 'Hello', 'Hey', 'Hi there'],

    // Reputation thresholds
    MAX_BLOCKS_BEFORE_PAUSE: 3,      // 3 blocks = pause account
    BLOCK_COOLDOWN_HOURS: 24,        // 24h pause after blocks
};

// ==========================================
// STATE TRACKING
// ==========================================

// Track per-merchant statistics
const merchantStats = new Map();  // merchantId -> { hourly, daily, warmupDay, lastSent, blocked, etc }

// Message queue for scheduled delivery
const messageQueue = new Map();   // merchantId -> [{to, message, scheduledAt}, ...]

// Track recipient interactions
const recipientHistory = new Map(); // phone -> { lastContact, blocked, responded }

/**
 * Initialize or get merchant stats
 */
function getMerchantStats(merchantId) {
    if (!merchantStats.has(merchantId)) {
        merchantStats.set(merchantId, {
            hourlyCount: 0,
            hourlyResetAt: Date.now() + 3600000,
            dailyCount: 0,
            dailyResetAt: Date.now() + 86400000,
            batchCount: 0,
            batchResetAt: null,
            warmupStarted: Date.now(),
            totalSent: 0,
            totalBlocked: 0,
            lastSentAt: null,
            isPaused: false,
            pauseUntil: null
        });
    }
    return merchantStats.get(merchantId);
}

// ==========================================
// RATE LIMITING
// ==========================================

/**
 * Check if merchant can send a message right now
 * Returns: { allowed: boolean, reason?: string, waitMs?: number }
 */
function canSendNow(merchantId) {
    const stats = getMerchantStats(merchantId);
    const now = Date.now();

    // Reset hourly counter if needed
    if (now > stats.hourlyResetAt) {
        stats.hourlyCount = 0;
        stats.hourlyResetAt = now + 3600000;
    }

    // Reset daily counter if needed
    if (now > stats.dailyResetAt) {
        stats.dailyCount = 0;
        stats.dailyResetAt = now + 86400000;
        stats.batchCount = 0; // Reset batch too
    }

    // Check if account is paused (due to blocks)
    if (stats.isPaused && stats.pauseUntil > now) {
        return {
            allowed: false,
            reason: 'account_paused',
            waitMs: stats.pauseUntil - now
        };
    } else if (stats.isPaused) {
        stats.isPaused = false;
        stats.totalBlocked = 0; // Reset block count
    }

    // Check warm-up period limits
    const warmupDay = Math.floor((now - stats.warmupStarted) / 86400000);
    const warmupLimit = warmupDay < CONFIG.WARMUP_DAYS
        ? CONFIG.WARMUP_DAILY_LIMITS[warmupDay] || CONFIG.MESSAGES_PER_DAY
        : CONFIG.MESSAGES_PER_DAY;

    // Check hourly limit
    if (stats.hourlyCount >= CONFIG.MESSAGES_PER_HOUR) {
        return {
            allowed: false,
            reason: 'hourly_limit',
            waitMs: stats.hourlyResetAt - now
        };
    }

    // Check daily limit (respect warm-up)
    if (stats.dailyCount >= warmupLimit) {
        return {
            allowed: false,
            reason: 'daily_limit',
            waitMs: stats.dailyResetAt - now
        };
    }

    // Check batch limit (need cooldown)
    if (stats.batchCount >= CONFIG.MESSAGES_PER_BATCH) {
        if (!stats.batchResetAt) {
            stats.batchResetAt = now + CONFIG.BATCH_COOLDOWN;
        }
        if (now < stats.batchResetAt) {
            return {
                allowed: false,
                reason: 'batch_cooldown',
                waitMs: stats.batchResetAt - now
            };
        }
        stats.batchCount = 0;
        stats.batchResetAt = null;
    }

    // Check active hours
    const hour = new Date().getHours();
    if (hour < CONFIG.ACTIVE_HOURS_START || hour >= CONFIG.ACTIVE_HOURS_END) {
        // Calculate wait until active hours
        let waitHours = CONFIG.ACTIVE_HOURS_START - hour;
        if (waitHours < 0) waitHours += 24;
        return {
            allowed: false,
            reason: 'outside_active_hours',
            waitMs: waitHours * 3600000
        };
    }

    // Check minimum delay since last message
    if (stats.lastSentAt) {
        const timeSinceLast = now - stats.lastSentAt;
        if (timeSinceLast < CONFIG.MIN_DELAY_BETWEEN_MSGS) {
            return {
                allowed: false,
                reason: 'too_soon',
                waitMs: CONFIG.MIN_DELAY_BETWEEN_MSGS - timeSinceLast
            };
        }
    }

    return { allowed: true };
}

/**
 * Record that a message was sent
 */
function recordSent(merchantId) {
    const stats = getMerchantStats(merchantId);
    stats.hourlyCount++;
    stats.dailyCount++;
    stats.batchCount++;
    stats.totalSent++;
    stats.lastSentAt = Date.now();
}

/**
 * Record that a message was blocked/reported
 */
function recordBlocked(merchantId, phone) {
    const stats = getMerchantStats(merchantId);
    stats.totalBlocked++;

    // Mark recipient as blocked
    recipientHistory.set(phone, {
        ...recipientHistory.get(phone),
        blocked: true,
        blockedAt: Date.now()
    });

    // Check if we should pause the account
    if (stats.totalBlocked >= CONFIG.MAX_BLOCKS_BEFORE_PAUSE) {
        stats.isPaused = true;
        stats.pauseUntil = Date.now() + (CONFIG.BLOCK_COOLDOWN_HOURS * 3600000);
        console.log(`⚠️ Account ${merchantId} paused due to ${stats.totalBlocked} blocks`);
        return true;
    }
    return false;
}

// ==========================================
// MESSAGE HUMANIZATION
// ==========================================

/**
 * Generate a random delay in human-like range
 */
function getHumanDelay() {
    // Use a bell curve distribution for more natural variation
    const range = CONFIG.MAX_DELAY_BETWEEN_MSGS - CONFIG.MIN_DELAY_BETWEEN_MSGS;
    const randomFactor = (Math.random() + Math.random() + Math.random()) / 3; // Bell curve
    return Math.floor(CONFIG.MIN_DELAY_BETWEEN_MSGS + (range * randomFactor));
}

/**
 * Generate typing duration
 */
function getTypingDuration(messageLength) {
    // Longer messages = longer typing
    const baseTyping = CONFIG.TYPING_MIN_DURATION;
    const extraPerChar = 50; // 50ms per character
    const calculated = baseTyping + (messageLength * extraPerChar);
    const max = CONFIG.TYPING_MAX_DURATION;

    // Add randomness
    const variation = Math.random() * 2000 - 1000; // ±1 second
    return Math.min(Math.max(calculated + variation, baseTyping), max);
}

/**
 * Add invisible variations to make each message unique
 */
function addInvisibleVariations(text) {
    const variations = [
        '\u200B', // Zero-width space
        '\u200C', // Zero-width non-joiner
        '\u200D', // Zero-width joiner
        '\uFEFF', // Zero-width no-break space
    ];

    // Add 1-3 random invisible characters at random positions
    let result = text;
    const numVariations = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numVariations; i++) {
        const pos = Math.floor(Math.random() * result.length);
        const char = variations[Math.floor(Math.random() * variations.length)];
        result = result.slice(0, pos) + char + result.slice(pos);
    }

    return result;
}

/**
 * Vary the greeting to avoid pattern detection
 */
function varyGreeting(text, language = 'ar') {
    const greetings = language === 'ar'
        ? CONFIG.GREETING_VARIATIONS_AR
        : CONFIG.GREETING_VARIATIONS_EN;

    // Replace common greetings with variations
    for (const greeting of greetings) {
        if (text.includes(greeting)) {
            const replacement = greetings[Math.floor(Math.random() * greetings.length)];
            text = text.replace(greeting, replacement);
            break;
        }
    }

    return text;
}

/**
 * Vary emoji usage
 */
function varyEmoji(text) {
    // Sometimes remove emoji
    if (Math.random() < 0.2) {
        return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    }

    // Sometimes swap emoji
    if (Math.random() < 0.3) {
        const emojis = CONFIG.EMOJI_VARIATIONS;
        return text.replace(/[\u{1F300}-\u{1F9FF}]/gu, () => {
            return emojis[Math.floor(Math.random() * emojis.length)];
        });
    }

    return text;
}

/**
 * Add natural typos and corrections (makes it look human)
 */
function addNaturalVariation(text) {
    // 10% chance to add a slight pause word
    if (Math.random() < 0.1) {
        const pauseWords = ['..', '،', ' -'];
        const pos = Math.floor(Math.random() * text.length * 0.5) + text.length * 0.25;
        const pause = pauseWords[Math.floor(Math.random() * pauseWords.length)];
        text = text.slice(0, pos) + pause + text.slice(pos);
    }

    return text;
}

/**
 * Full message humanization pipeline
 */
function humanizeMessage(originalMessage, options = {}) {
    let message = originalMessage;

    // Step 1: Vary greeting
    message = varyGreeting(message, options.language || 'ar');

    // Step 2: Vary emoji
    message = varyEmoji(message);

    // Step 3: Add natural variations
    message = addNaturalVariation(message);

    // Step 4: Add invisible variations (always do this)
    message = addInvisibleVariations(message);

    return message;
}

// ==========================================
// RECIPIENT SAFETY
// ==========================================

/**
 * Check if we should contact this recipient
 */
function shouldContactRecipient(phone) {
    const history = recipientHistory.get(phone);

    if (!history) return { safe: true };

    // Never contact blocked numbers
    if (history.blocked) {
        return { safe: false, reason: 'previously_blocked' };
    }

    // Don't spam - wait 24h between contacts
    if (history.lastContact) {
        const hoursSinceContact = (Date.now() - history.lastContact) / 3600000;
        if (hoursSinceContact < 24) {
            return {
                safe: false,
                reason: 'contacted_recently',
                waitHours: 24 - hoursSinceContact
            };
        }
    }

    return { safe: true };
}

/**
 * Record contact with recipient
 */
function recordContact(phone) {
    recipientHistory.set(phone, {
        ...recipientHistory.get(phone),
        lastContact: Date.now()
    });
}

/**
 * Record response from recipient (good signal!)
 */
function recordResponse(phone) {
    const history = recipientHistory.get(phone) || {};
    recipientHistory.set(phone, {
        ...history,
        responded: true,
        lastResponse: Date.now()
    });
}

// ==========================================
// MESSAGE QUEUE
// ==========================================

/**
 * Add message to queue for scheduled delivery
 */
function queueMessage(merchantId, to, message, options = {}) {
    if (!messageQueue.has(merchantId)) {
        messageQueue.set(merchantId, []);
    }

    const queue = messageQueue.get(merchantId);

    // Check recipient safety
    const safety = shouldContactRecipient(to);
    if (!safety.safe) {
        console.log(`⚠️ Skipping ${to}: ${safety.reason}`);
        return { queued: false, reason: safety.reason };
    }

    // Calculate scheduled time
    const canSend = canSendNow(merchantId);
    let scheduledAt = Date.now();

    if (!canSend.allowed) {
        scheduledAt = Date.now() + (canSend.waitMs || 60000);
    }

    // Add delay based on queue position
    const queueDelay = queue.length * getHumanDelay();
    scheduledAt += queueDelay;

    queue.push({
        to,
        message,
        options,
        scheduledAt,
        status: 'pending'
    });

    console.log(`📝 Queued message to ${to} for ${new Date(scheduledAt).toISOString()}`);

    return {
        queued: true,
        scheduledAt,
        position: queue.length
    };
}

/**
 * Get next message to send from queue
 */
function getNextMessage(merchantId) {
    const queue = messageQueue.get(merchantId);
    if (!queue || queue.length === 0) return null;

    const now = Date.now();
    const canSend = canSendNow(merchantId);

    if (!canSend.allowed) return null;

    // Find first message that's ready
    const index = queue.findIndex(msg =>
        msg.status === 'pending' && msg.scheduledAt <= now
    );

    if (index === -1) return null;

    const msg = queue[index];
    msg.status = 'processing';

    return {
        index,
        ...msg
    };
}

/**
 * Mark message as sent
 */
function markSent(merchantId, index, messageId) {
    const queue = messageQueue.get(merchantId);
    if (queue && queue[index]) {
        queue[index].status = 'sent';
        queue[index].messageId = messageId;
        queue[index].sentAt = Date.now();

        recordSent(merchantId);
        recordContact(queue[index].to);
    }
}

/**
 * Mark message as failed
 */
function markFailed(merchantId, index, error) {
    const queue = messageQueue.get(merchantId);
    if (queue && queue[index]) {
        queue[index].status = 'failed';
        queue[index].error = error;
        queue[index].failedAt = Date.now();

        // If it's a block, record it
        if (error === 'blocked' || error === 'reported') {
            recordBlocked(merchantId, queue[index].to);
        }
    }
}

/**
 * Get queue stats for a merchant
 */
function getQueueStats(merchantId) {
    const queue = messageQueue.get(merchantId) || [];
    const stats = getMerchantStats(merchantId);

    return {
        queueLength: queue.filter(m => m.status === 'pending').length,
        processing: queue.filter(m => m.status === 'processing').length,
        sent: queue.filter(m => m.status === 'sent').length,
        failed: queue.filter(m => m.status === 'failed').length,
        hourlyRemaining: CONFIG.MESSAGES_PER_HOUR - stats.hourlyCount,
        dailyRemaining: CONFIG.MESSAGES_PER_DAY - stats.dailyCount,
        isPaused: stats.isPaused,
        pauseUntil: stats.pauseUntil,
        warmupDay: Math.floor((Date.now() - stats.warmupStarted) / 86400000) + 1
    };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Config
    CONFIG,

    // Rate limiting
    canSendNow,
    recordSent,
    recordBlocked,

    // Message humanization
    getHumanDelay,
    getTypingDuration,
    humanizeMessage,

    // Recipient safety
    shouldContactRecipient,
    recordContact,
    recordResponse,

    // Queue management
    queueMessage,
    getNextMessage,
    markSent,
    markFailed,
    getQueueStats,

    // Stats
    getMerchantStats
};
