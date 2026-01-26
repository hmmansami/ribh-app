/**
 * WHATSAPP BRIDGE V2 - Bulletproof Anti-Ban Edition
 * 
 * Uses merchant's own WhatsApp number via QR code scan
 * NO per-message costs - sends from merchant's phone!
 * 
 * ANTI-BAN FEATURES:
 * - Human-like delays (45s-3min between messages)
 * - Typing indicators with realistic duration
 * - Message variations (never same text twice)
 * - Rate limiting (20/hr, 100/day)
 * - Warm-up period (7 days gradual increase)
 * - Active hours only (9am-10pm)
 * - Batch cooldowns (5 msgs then 10min break)
 * - Recipient safety checks
 * - Queue system for scheduled delivery
 */

const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('baileys');
const admin = require('firebase-admin');
const qrcode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Import anti-ban system
const antiBan = require('./antiBan');

// Store active WhatsApp sessions per merchant
const activeSessions = new Map();
const pendingQRs = new Map();
const connectionStatus = new Map();

// Logger (silent to reduce noise)
const logger = pino({ level: 'silent' });

// Firestore
let db;
try {
    db = admin.firestore();
} catch (e) {
    console.log('⚠️ Firestore not available');
}

// ==========================================
// CONNECTION MANAGEMENT
// ==========================================

/**
 * Initialize WhatsApp connection for a merchant
 */
async function initMerchantWhatsApp(merchantId) {
    console.log(`📱 Initializing WhatsApp for merchant: ${merchantId}`);

    // If already connected, return ready status
    if (activeSessions.has(merchantId)) {
        const sock = activeSessions.get(merchantId);
        if (sock.user) {
            return {
                ready: true,
                phone: sock.user.id?.split(':')[0] || sock.user.id,
                name: sock.user.name || 'WhatsApp'
            };
        }
    }

    connectionStatus.set(merchantId, 'initializing');

    return new Promise(async (resolve, reject) => {
        let qrResolved = false;

        try {
            const authPath = `/tmp/whatsapp-sessions/${merchantId}`;
            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(authPath);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                printQRInTerminal: false,
                logger,
                browser: ['RIBH Business', 'Chrome', '120.0.0'],
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 25000,
                // Anti-detection settings
                markOnlineOnConnect: false, // Don't show online immediately
                syncFullHistory: false      // Don't sync all history
            });

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log(`🔲 QR code generated for: ${merchantId}`);
                    connectionStatus.set(merchantId, 'waiting_scan');

                    try {
                        const qrDataUrl = await qrcode.toDataURL(qr, {
                            width: 300,
                            margin: 2
                        });
                        pendingQRs.set(merchantId, qrDataUrl);

                        if (!qrResolved) {
                            qrResolved = true;
                            resolve({ qrCode: qrDataUrl, status: 'scan_required' });
                        }
                    } catch (err) {
                        console.error('❌ QR generation error:', err);
                    }
                }

                if (connection === 'close') {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    console.log(`📵 Disconnected: ${merchantId}, code: ${statusCode}`);
                    connectionStatus.set(merchantId, 'disconnected');
                    activeSessions.delete(merchantId);

                    // Handle specific disconnect reasons
                    if (statusCode === DisconnectReason.loggedOut) {
                        console.log(`🚪 ${merchantId} logged out - need new QR`);
                    } else if (statusCode === DisconnectReason.badSession) {
                        // Clear bad session
                        fs.rmSync(authPath, { recursive: true, force: true });
                        console.log(`🧹 Cleared bad session for ${merchantId}`);
                    }
                }

                if (connection === 'open') {
                    console.log(`✅ WhatsApp connected: ${merchantId}`);
                    connectionStatus.set(merchantId, 'connected');
                    pendingQRs.delete(merchantId);
                    activeSessions.set(merchantId, sock);

                    // Start queue processor for this merchant
                    startQueueProcessor(merchantId);

                    if (!qrResolved) {
                        qrResolved = true;
                        resolve({
                            ready: true,
                            phone: sock.user?.id?.split(':')[0],
                            name: sock.user?.name
                        });
                    }
                }
            });

            sock.ev.on('creds.update', saveCreds);

            // Handle incoming messages (for response tracking)
            sock.ev.on('messages.upsert', async ({ messages }) => {
                for (const msg of messages) {
                    if (!msg.key.fromMe && msg.key.remoteJid) {
                        const phone = msg.key.remoteJid.split('@')[0];
                        antiBan.recordResponse(phone);
                        console.log(`📥 Response from ${phone} - reputation improved!`);
                    }
                }
            });

        } catch (error) {
            console.error(`❌ Init error for ${merchantId}:`, error);
            connectionStatus.set(merchantId, 'error');
            if (!qrResolved) {
                qrResolved = true;
                reject(error);
            }
        }

        // Timeout
        setTimeout(() => {
            if (!qrResolved) {
                qrResolved = true;
                reject(new Error('Connection timeout'));
            }
        }, 90000);
    });
}

// ==========================================
// QUEUE PROCESSOR - Background message sender
// ==========================================

const processorIntervals = new Map();

function startQueueProcessor(merchantId) {
    // Don't start multiple processors
    if (processorIntervals.has(merchantId)) return;

    console.log(`🔄 Starting queue processor for ${merchantId}`);

    const interval = setInterval(async () => {
        const sock = activeSessions.get(merchantId);
        if (!sock) {
            console.log(`⚠️ No session for ${merchantId}, stopping processor`);
            clearInterval(interval);
            processorIntervals.delete(merchantId);
            return;
        }

        // Get next message from queue
        const msg = antiBan.getNextMessage(merchantId);
        if (!msg) return; // Nothing to send

        try {
            // Format phone
            let phone = msg.to.replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) phone = '966' + phone.substring(1);
            const jid = phone + '@s.whatsapp.net';

            // Check if on WhatsApp
            try {
                const [result] = await sock.onWhatsApp(jid);
                if (!result?.exists) {
                    console.log(`⚠️ ${phone} not on WhatsApp`);
                    antiBan.markFailed(merchantId, msg.index, 'not_on_whatsapp');
                    return;
                }
            } catch (e) { /* Continue anyway */ }

            // Humanize the message
            const humanizedMessage = antiBan.humanizeMessage(msg.message, msg.options);

            // Show typing indicator
            const typingDuration = antiBan.getTypingDuration(humanizedMessage.length);
            await sock.sendPresenceUpdate('composing', jid);
            await new Promise(r => setTimeout(r, typingDuration));

            // Send message
            const result = await sock.sendMessage(jid, { text: humanizedMessage });

            // Clear typing
            await sock.sendPresenceUpdate('paused', jid);

            // Mark as sent
            antiBan.markSent(merchantId, msg.index, result.key.id);
            console.log(`✅ Sent to ${phone} (queue #${msg.index})`);

        } catch (error) {
            console.error(`❌ Send failed:`, error.message);
            antiBan.markFailed(merchantId, msg.index, error.message);

            // Check for ban indicators
            if (error.message?.includes('blocked') || error.message?.includes('banned')) {
                antiBan.recordBlocked(merchantId, msg.to);
            }
        }

    }, 5000); // Check queue every 5 seconds

    processorIntervals.set(merchantId, interval);
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Send message (queued with anti-ban protection)
 */
async function sendMessage(merchantId, to, message, options = {}) {
    const sock = activeSessions.get(merchantId);
    if (!sock) {
        return {
            success: false,
            error: 'not_connected',
            message: 'WhatsApp not connected. Scan QR first.'
        };
    }

    // Option for immediate send (use carefully!)
    if (options.immediate) {
        return sendImmediate(merchantId, to, message, options);
    }

    // Queue the message
    const result = antiBan.queueMessage(merchantId, to, message, options);

    if (result.queued) {
        return {
            success: true,
            queued: true,
            scheduledAt: result.scheduledAt,
            position: result.position,
            message: `Message queued for delivery at ${new Date(result.scheduledAt).toLocaleTimeString()}`
        };
    } else {
        return {
            success: false,
            error: result.reason,
            message: `Cannot send: ${result.reason}`
        };
    }
}

/**
 * Send immediately (bypasses queue - use for replies within 24hr window)
 */
async function sendImmediate(merchantId, to, message, options = {}) {
    const sock = activeSessions.get(merchantId);
    if (!sock) {
        return { success: false, error: 'not_connected' };
    }

    const canSend = antiBan.canSendNow(merchantId);
    if (!canSend.allowed) {
        return {
            success: false,
            error: canSend.reason,
            waitMs: canSend.waitMs
        };
    }

    try {
        let phone = to.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '966' + phone.substring(1);
        const jid = phone + '@s.whatsapp.net';

        // Humanize
        const humanizedMessage = antiBan.humanizeMessage(message, options);

        // Typing indicator
        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(r => setTimeout(r, antiBan.getTypingDuration(message.length)));

        // Send
        const result = await sock.sendMessage(jid, { text: humanizedMessage });

        // Clear typing
        await sock.sendPresenceUpdate('paused', jid);

        // Record
        antiBan.recordSent(merchantId);
        antiBan.recordContact(to);

        return {
            success: true,
            messageId: result.key.id
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Send cart recovery message
 */
async function sendCartRecovery(merchantId, { phone, customerName, cartValue, items, checkoutUrl, discount }) {
    // Build message with variations
    const greetings = ['مرحباً', 'أهلاً', 'هلا'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];

    let message = `${greeting} ${customerName}! 👋\n\n`;

    const cartPhrases = [
        'لاحظنا أنك تركت سلة مشترياتك',
        'سلتك في انتظارك',
        'منتجاتك ما زالت محفوظة'
    ];
    message += cartPhrases[Math.floor(Math.random() * cartPhrases.length)] + ' 🛒\n\n';

    if (items && items.length > 0) {
        message += `📦 المنتجات:\n`;
        items.slice(0, 3).forEach(item => {
            message += `• ${item.name || item.product_name || 'منتج'}\n`;
        });
        if (items.length > 3) {
            message += `• و ${items.length - 3} منتجات أخرى\n`;
        }
        message += `\n`;
    }

    message += `💰 القيمة: ${cartValue} ر.س\n\n`;

    if (discount && discount > 0) {
        const discountPhrases = ['خصم خاص لك', 'عرض حصري', 'هدية منا'];
        message += `🎁 *${discountPhrases[Math.floor(Math.random() * discountPhrases.length)]}: ${discount}%*\n\n`;
    }

    message += `👉 أكمل طلبك:\n${checkoutUrl}`;

    return sendMessage(merchantId, phone, message, { customerName, language: 'ar' });
}

/**
 * Get status and stats
 */
function getStatus(merchantId) {
    const status = connectionStatus.get(merchantId) || 'not_initialized';
    const sock = activeSessions.get(merchantId);
    const stats = antiBan.getQueueStats(merchantId);

    return {
        status,
        connected: status === 'connected',
        info: sock?.user ? {
            phone: sock.user.id?.split(':')[0],
            name: sock.user.name
        } : null,
        hasPendingQR: pendingQRs.has(merchantId),
        queue: stats
    };
}

function getPendingQR(merchantId) {
    return pendingQRs.get(merchantId) || null;
}

async function disconnect(merchantId) {
    // Stop processor
    if (processorIntervals.has(merchantId)) {
        clearInterval(processorIntervals.get(merchantId));
        processorIntervals.delete(merchantId);
    }

    const sock = activeSessions.get(merchantId);
    if (sock) {
        try {
            await sock.logout();
            sock.end();
        } catch (e) {}
        activeSessions.delete(merchantId);
        connectionStatus.set(merchantId, 'disconnected');
        pendingQRs.delete(merchantId);
    }
    return { success: true };
}

function getConnectedMerchants() {
    const connected = [];
    for (const [merchantId, sock] of activeSessions) {
        if (sock.user) {
            connected.push({
                merchantId,
                phone: sock.user.id?.split(':')[0],
                name: sock.user.name,
                stats: antiBan.getQueueStats(merchantId)
            });
        }
    }
    return connected;
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    initMerchantWhatsApp,
    getPendingQR,
    getStatus,
    sendMessage,
    sendImmediate,
    sendCartRecovery,
    disconnect,
    getConnectedMerchants,
    isConnected: (merchantId) => activeSessions.has(merchantId),

    // Expose anti-ban for direct access
    antiBan
};
