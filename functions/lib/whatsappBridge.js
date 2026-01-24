/**
 * WHATSAPP BRIDGE - QR Code Connection (Baileys Version)
 * 
 * Uses merchant's own WhatsApp number via QR code scan
 * NO per-message costs - sends from merchant's phone!
 * 
 * Baileys = WebSocket based, no Chrome needed = works on Firebase!
 */

const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('baileys');
const admin = require('firebase-admin');
const qrcode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Store active WhatsApp sessions per merchant
const activeSessions = new Map();

// Store QR codes waiting to be scanned
const pendingQRs = new Map();

// Store connection status
const connectionStatus = new Map();

// Logger
const logger = pino({ level: 'silent' }); // Reduce noise

// Firestore for session persistence
let db;
try {
    db = admin.firestore();
} catch (e) {
    console.log('⚠️ Firestore not available for WhatsApp sessions');
}

/**
 * Save auth state to Firestore (for persistence across cold starts)
 */
async function saveAuthToFirestore(merchantId, state) {
    if (!db) return;
    try {
        await db.collection('whatsapp_sessions').doc(merchantId).set({
            creds: JSON.stringify(state.creds),
            updatedAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error('Error saving auth to Firestore:', e);
    }
}

/**
 * Load auth state from Firestore
 */
async function loadAuthFromFirestore(merchantId) {
    if (!db) return null;
    try {
        const doc = await db.collection('whatsapp_sessions').doc(merchantId).get();
        if (doc.exists) {
            const data = doc.data();
            return {
                creds: JSON.parse(data.creds),
                keys: {} // Keys will be regenerated
            };
        }
    } catch (e) {
        console.error('Error loading auth from Firestore:', e);
    }
    return null;
}

/**
 * Initialize WhatsApp connection for a merchant
 * @param {string} merchantId - Unique merchant identifier
 * @returns {Promise<{qrCode: string}|{ready: boolean}>}
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

    // Store pending status
    connectionStatus.set(merchantId, 'initializing');

    return new Promise(async (resolve, reject) => {
        let qrResolved = false;

        try {
            // Use file-based auth for local, Firestore for production
            const authPath = path.join(__dirname, '../data/whatsapp-sessions', merchantId);

            // Ensure directory exists
            if (!fs.existsSync(authPath)) {
                fs.mkdirSync(authPath, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(authPath);

            // Get latest Baileys version
            const { version } = await fetchLatestBaileysVersion();

            // Create socket
            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, logger)
                },
                printQRInTerminal: false,
                logger,
                browser: ['RIBH', 'Chrome', '120.0.0'],
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
                keepAliveIntervalMs: 25000
            });

            // Handle connection updates
            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log(`🔲 QR code generated for merchant: ${merchantId}`);
                    connectionStatus.set(merchantId, 'waiting_scan');

                    try {
                        // Convert QR to base64 data URL for web display
                        const qrDataUrl = await qrcode.toDataURL(qr, {
                            width: 300,
                            margin: 2,
                            color: {
                                dark: '#000000',
                                light: '#FFFFFF'
                            }
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
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    console.log(`📵 WhatsApp disconnected for ${merchantId}, code: ${statusCode}`);
                    connectionStatus.set(merchantId, 'disconnected');
                    activeSessions.delete(merchantId);

                    if (shouldReconnect && !qrResolved) {
                        // Try to reconnect
                        console.log(`🔄 Reconnecting WhatsApp for ${merchantId}...`);
                        setTimeout(() => initMerchantWhatsApp(merchantId), 3000);
                    }
                }

                if (connection === 'open') {
                    console.log(`✅ WhatsApp connected for merchant: ${merchantId}`);
                    connectionStatus.set(merchantId, 'connected');
                    pendingQRs.delete(merchantId);
                    activeSessions.set(merchantId, sock);

                    const phone = sock.user?.id?.split(':')[0] || sock.user?.id;
                    const name = sock.user?.name || 'WhatsApp';
                    console.log(`📱 Connected as: ${name} (${phone})`);

                    // If we haven't resolved yet (was already authenticated)
                    if (!qrResolved) {
                        qrResolved = true;
                        resolve({ ready: true, phone, name });
                    }
                }
            });

            // Save credentials when updated
            sock.ev.on('creds.update', saveCreds);

            // Handle messages (optional - for future bot features)
            sock.ev.on('messages.upsert', async ({ messages }) => {
                // Could add auto-reply or logging here
            });

        } catch (error) {
            console.error(`❌ WhatsApp init error for ${merchantId}:`, error);
            connectionStatus.set(merchantId, 'error');
            if (!qrResolved) {
                qrResolved = true;
                reject(error);
            }
        }

        // Timeout after 90 seconds if no QR or connection
        setTimeout(() => {
            if (!qrResolved) {
                qrResolved = true;
                if (activeSessions.has(merchantId)) {
                    const sock = activeSessions.get(merchantId);
                    resolve({
                        ready: true,
                        phone: sock.user?.id?.split(':')[0],
                        name: sock.user?.name
                    });
                } else {
                    reject(new Error('Timeout waiting for WhatsApp connection'));
                }
            }
        }, 90000);
    });
}

/**
 * Get current QR code for a merchant (if waiting to be scanned)
 */
function getPendingQR(merchantId) {
    return pendingQRs.get(merchantId) || null;
}

/**
 * Get connection status for a merchant
 */
function getStatus(merchantId) {
    const status = connectionStatus.get(merchantId) || 'not_initialized';
    const sock = activeSessions.get(merchantId);

    let info = null;
    if (sock && sock.user) {
        info = {
            phone: sock.user.id?.split(':')[0] || sock.user.id,
            name: sock.user.name,
            platform: 'Baileys'
        };
    }

    return {
        status,
        connected: status === 'connected',
        info,
        hasPendingQR: pendingQRs.has(merchantId)
    };
}

/**
 * Send WhatsApp message using merchant's connected number
 * @param {string} merchantId - Merchant identifier
 * @param {string} to - Recipient phone number (e.g., "+966501234567")
 * @param {string} message - Message text
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendMessage(merchantId, to, message) {
    const sock = activeSessions.get(merchantId);

    if (!sock) {
        console.log(`⚠️ No WhatsApp session for merchant: ${merchantId}`);
        return {
            success: false,
            error: 'not_connected',
            message: 'WhatsApp not connected. Please scan QR code first.'
        };
    }

    try {
        // Format phone number (remove +, spaces, dashes)
        let phone = to.replace(/[^0-9]/g, '');

        // Ensure it starts with country code
        if (phone.startsWith('0')) {
            phone = '966' + phone.substring(1); // Saudi Arabia default
        }

        // WhatsApp JID format
        const jid = phone + '@s.whatsapp.net';

        // Check if number exists on WhatsApp (optional, can be slow)
        try {
            const [result] = await sock.onWhatsApp(jid);
            if (!result?.exists) {
                console.log(`⚠️ Number ${phone} may not be on WhatsApp`);
                // Continue anyway - let WhatsApp handle it
            }
        } catch (e) {
            // Ignore check errors, try to send anyway
        }

        // Send the message
        const result = await sock.sendMessage(jid, { text: message });

        console.log(`✅ WhatsApp sent via merchant ${merchantId} to ${phone}`);

        return {
            success: true,
            messageId: result.key.id,
            timestamp: Date.now()
        };

    } catch (error) {
        console.error(`❌ WhatsApp send error for ${merchantId}:`, error);
        return {
            success: false,
            error: 'send_failed',
            message: error.message
        };
    }
}

/**
 * Send cart recovery message via merchant's WhatsApp
 */
async function sendCartRecovery(merchantId, { phone, customerName, cartValue, items, checkoutUrl, discount }) {
    let message = `مرحباً ${customerName}! 👋\n\n`;
    message += `لاحظنا أنك تركت سلة مشترياتك 🛒\n\n`;

    if (items && items.length > 0) {
        message += `📦 المنتجات:\n`;
        items.slice(0, 3).forEach(item => {
            const name = item.name || item.product_name || 'منتج';
            message += `• ${name}\n`;
        });
        if (items.length > 3) {
            message += `• و ${items.length - 3} منتجات أخرى...\n`;
        }
        message += `\n`;
    }

    message += `💰 القيمة الإجمالية: ${cartValue} ر.س\n\n`;

    if (discount && discount > 0) {
        message += `🎁 *خصم خاص لك: ${discount}%*\n\n`;
    }

    message += `👉 أكمل طلبك الآن:\n${checkoutUrl}\n\n`;
    message += `---\n_رسالة آلية من رِبح_`;

    return sendMessage(merchantId, phone, message);
}

/**
 * Disconnect merchant's WhatsApp
 */
async function disconnect(merchantId) {
    const sock = activeSessions.get(merchantId);
    if (sock) {
        try {
            await sock.logout();
            sock.end();
        } catch (e) {
            console.error(`Error disconnecting ${merchantId}:`, e);
        }
        activeSessions.delete(merchantId);
        connectionStatus.set(merchantId, 'disconnected');
        pendingQRs.delete(merchantId);
    }
    return { success: true };
}

/**
 * Get all connected merchants
 */
function getConnectedMerchants() {
    const connected = [];
    for (const [merchantId, sock] of activeSessions) {
        if (sock.user) {
            connected.push({
                merchantId,
                phone: sock.user.id?.split(':')[0] || sock.user.id,
                name: sock.user.name
            });
        }
    }
    return connected;
}

module.exports = {
    initMerchantWhatsApp,
    getPendingQR,
    getStatus,
    sendMessage,
    sendCartRecovery,
    disconnect,
    getConnectedMerchants,
    isConnected: (merchantId) => activeSessions.has(merchantId)
};
