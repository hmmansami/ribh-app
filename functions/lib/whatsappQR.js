/**
 * RIBH WhatsApp QR Connection
 * 
 * Uses whatsapp-web.js to provide instant WhatsApp connection via QR code
 * No Meta API approval needed - just scan and connect!
 * 
 * COMPARISON:
 * | Method      | Setup Time | Cost      | Scale    | Risk    |
 * |-------------|------------|-----------|----------|---------|
 * | QR (this)   | Instant    | FREE      | ~200/day | Medium  |
 * | Twilio      | 1-2 days   | $0.005/msg| Unlimited| Low     |
 * | Meta API    | 1-4 weeks  | $0.005/msg| Unlimited| Low     |
 * 
 * Best for: MVP, small-medium stores, getting started fast
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const EventEmitter = require('events');

class WhatsAppQRService extends EventEmitter {
    constructor(storeId) {
        super();
        this.storeId = storeId;
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
        this.connectionStatus = 'disconnected'; // disconnected, connecting, connected
    }

    /**
     * Initialize WhatsApp client for a store
     */
    async initialize() {
        console.log(`📱 [${this.storeId}] Initializing WhatsApp connection...`);

        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: this.storeId }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            }
        });

        // QR Code Generated - send to dashboard
        this.client.on('qr', async (qr) => {
            console.log(`📱 [${this.storeId}] QR Code generated`);
            this.connectionStatus = 'connecting';

            // Convert QR to base64 image
            try {
                this.qrCode = await qrcode.toDataURL(qr);
                this.emit('qr', this.qrCode);
            } catch (err) {
                console.error('QR generation error:', err);
            }
        });

        // Client is ready
        this.client.on('ready', () => {
            console.log(`✅ [${this.storeId}] WhatsApp connected!`);
            this.isReady = true;
            this.connectionStatus = 'connected';
            this.qrCode = null;
            this.emit('ready');
        });

        // Client authenticated
        this.client.on('authenticated', () => {
            console.log(`🔐 [${this.storeId}] WhatsApp authenticated`);
            this.emit('authenticated');
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            console.error(`❌ [${this.storeId}] Auth failed:`, msg);
            this.connectionStatus = 'disconnected';
            this.emit('auth_failure', msg);
        });

        // Disconnected
        this.client.on('disconnected', (reason) => {
            console.log(`📴 [${this.storeId}] Disconnected:`, reason);
            this.isReady = false;
            this.connectionStatus = 'disconnected';
            this.emit('disconnected', reason);
        });

        // Message received (for future chatbot features)
        this.client.on('message', (msg) => {
            this.emit('message', msg);
        });

        // Initialize the client
        await this.client.initialize();
    }

    /**
     * Send a WhatsApp message
     * @param {string} phone - Phone number with country code (e.g., +966501234567)
     * @param {string} message - Message text
     * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
     */
    async sendMessage(phone, message) {
        if (!this.isReady) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        try {
            // Format phone number for WhatsApp (remove + and spaces)
            const chatId = phone.replace(/[^0-9]/g, '') + '@c.us';

            const result = await this.client.sendMessage(chatId, message);

            console.log(`✅ [${this.storeId}] Message sent to ${phone}`);

            return {
                success: true,
                messageId: result.id._serialized,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ [${this.storeId}] Send error:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send cart recovery message
     */
    async sendCartRecovery(phone, customerName, cartTotal, checkoutUrl, discount = 0) {
        let message = `مرحباً ${customerName}! 👋\n\n`;
        message += `لاحظنا أنك تركت بعض المنتجات في سلتك 🛒\n`;
        message += `إجمالي السلة: ${cartTotal} ر.س\n\n`;

        if (discount > 0) {
            message += `🎁 خصم خاص لك: ${discount}%\n`;
            message += `كود الخصم: RIBH${discount}\n\n`;
        }

        message += `أكمل طلبك الآن: ${checkoutUrl}\n\n`;
        message += `💚 متجرك`;

        return await this.sendMessage(phone, message);
    }

    /**
     * Get current connection status
     */
    getStatus() {
        return {
            storeId: this.storeId,
            status: this.connectionStatus,
            isReady: this.isReady,
            qrCode: this.qrCode
        };
    }

    /**
     * Disconnect and cleanup
     */
    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.isReady = false;
            this.connectionStatus = 'disconnected';
            console.log(`📴 [${this.storeId}] WhatsApp disconnected`);
        }
    }
}

// Store manager - handles multiple store connections
class WhatsAppManager {
    constructor() {
        this.stores = new Map(); // storeId -> WhatsAppQRService
    }

    /**
     * Get or create WhatsApp service for a store
     */
    async getStore(storeId) {
        if (!this.stores.has(storeId)) {
            const service = new WhatsAppQRService(storeId);
            this.stores.set(storeId, service);
        }
        return this.stores.get(storeId);
    }

    /**
     * Initialize connection for a store
     */
    async connect(storeId) {
        const service = await this.getStore(storeId);
        if (service.connectionStatus === 'disconnected') {
            await service.initialize();
        }
        return service;
    }

    /**
     * Get status of all stores
     */
    getAllStatus() {
        const status = {};
        for (const [storeId, service] of this.stores) {
            status[storeId] = service.getStatus();
        }
        return status;
    }

    /**
     * Send message for a store
     */
    async sendMessage(storeId, phone, message) {
        const service = this.stores.get(storeId);
        if (!service) {
            return { success: false, error: 'Store not connected' };
        }
        return await service.sendMessage(phone, message);
    }

    /**
     * Send cart recovery for a store
     */
    async sendCartRecovery(storeId, phone, customerName, cartTotal, checkoutUrl, discount = 0) {
        const service = this.stores.get(storeId);
        if (!service) {
            return { success: false, error: 'Store not connected' };
        }
        return await service.sendCartRecovery(phone, customerName, cartTotal, checkoutUrl, discount);
    }
}

// Singleton instance
const whatsappManager = new WhatsAppManager();

module.exports = {
    WhatsAppQRService,
    WhatsAppManager,
    whatsappManager
};
