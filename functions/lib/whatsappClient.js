/**
 * WHATSAPP CLIENT - HTTP Client for External Bridge
 * 
 * Calls the Render-hosted WhatsApp Bridge
 * This is what Firebase Functions should use!
 */

const fetch = require('node-fetch');

const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || 'https://ribh-whatsapp-1.onrender.com';
const API_KEY = process.env.WHATSAPP_BRIDGE_KEY || '';

/**
 * Initialize WhatsApp connection - get QR code
 */
async function initMerchantWhatsApp(merchantId) {
    try {
        const res = await fetch(`${BRIDGE_URL}/init/${merchantId}`, {
            headers: { 'x-api-key': API_KEY }
        });
        
        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Bridge error: ${res.status} - ${error}`);
        }
        
        return await res.json();
    } catch (error) {
        console.error(`❌ WhatsApp init error for ${merchantId}:`, error);
        throw error;
    }
}

/**
 * Get pending QR code for merchant
 */
async function getPendingQR(merchantId) {
    try {
        const res = await fetch(`${BRIDGE_URL}/qr/${merchantId}?key=${API_KEY}`);
        const data = await res.json();
        return data.qrCode || null;
    } catch (error) {
        console.error(`❌ QR fetch error:`, error);
        return null;
    }
}

/**
 * Get connection status
 */
async function getStatus(merchantId) {
    try {
        const res = await fetch(`${BRIDGE_URL}/status/${merchantId}?key=${API_KEY}`);
        const data = await res.json();
        return {
            status: data.connected ? 'connected' : 'disconnected',
            connected: data.connected,
            info: data.phone ? { phone: data.phone } : null
        };
    } catch (error) {
        console.error(`❌ Status check error:`, error);
        return { status: 'error', connected: false, info: null };
    }
}

/**
 * Send WhatsApp message
 */
async function sendMessage(merchantId, to, message, options = {}) {
    try {
        const res = await fetch(`${BRIDGE_URL}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                merchant: merchantId,
                phone: to,
                message: message
            })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            return {
                success: false,
                error: data.error || 'Unknown error'
            };
        }
        
        return {
            success: true,
            messageId: data.id,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error(`❌ Send error:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send cart recovery message
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

    message += `👉 أكمل طلبك الآن:\n${checkoutUrl}`;

    return sendMessage(merchantId, phone, message);
}

/**
 * Check if merchant is connected
 */
async function isConnected(merchantId) {
    const status = await getStatus(merchantId);
    return status.connected;
}

module.exports = {
    initMerchantWhatsApp,
    getPendingQR,
    getStatus,
    sendMessage,
    sendCartRecovery,
    isConnected,
    BRIDGE_URL,
    API_KEY
};
