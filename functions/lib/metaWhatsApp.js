/**
 * META WHATSAPP CLOUD API - Direct Integration
 * 
 * MUCH CHEAPER than Twilio:
 * - No middleman markup ($0.005/msg saved)
 * - Service conversations are FREE (since Nov 2024)
 * - Marketing: ~$0.03-0.08/conversation (vs $0.08-0.15 Twilio)
 * 
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

// Meta WhatsApp Cloud API credentials
const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN || '';
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || '';
const META_BUSINESS_ACCOUNT_ID = process.env.META_BUSINESS_ACCOUNT_ID || '';
const META_API_VERSION = 'v18.0';

const isConfigured = () => !!(META_WHATSAPP_TOKEN && META_PHONE_NUMBER_ID);

/**
 * Send WhatsApp message via Meta Cloud API
 * @param {string} to - Phone number (will be formatted)
 * @param {string} message - Text message to send
 * @param {object} options - Additional options (template, mediaUrl, etc)
 */
async function sendWhatsApp(to, message, options = {}) {
    if (!isConfigured()) {
        console.log('⚠️ Meta WhatsApp not configured, skipping');
        return { success: false, error: 'Not configured' };
    }

    // Format phone number (remove all non-digits, add country code if needed)
    let phone = to.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
        phone = '966' + phone.substring(1); // Saudi Arabia default
    }
    if (!phone.startsWith('966') && phone.length === 9) {
        phone = '966' + phone;
    }

    const url = `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`;

    try {
        let payload;

        if (options.template) {
            // Template message (for marketing, utility, authentication)
            payload = {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'template',
                template: {
                    name: options.template,
                    language: { code: options.language || 'ar' },
                    components: options.components || []
                }
            };
        } else {
            // Regular text message (for service/replies within 24hr window)
            payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: phone,
                type: 'text',
                text: {
                    preview_url: true,
                    body: message
                }
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.error) {
            console.error('❌ Meta WhatsApp error:', result.error.message);
            return { success: false, error: result.error.message, code: result.error.code };
        }

        console.log(`✅ WhatsApp sent to ${phone}: ${result.messages?.[0]?.id}`);
        return { 
            success: true, 
            messageId: result.messages?.[0]?.id,
            phone: phone
        };

    } catch (error) {
        console.error('❌ Meta WhatsApp error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Send WhatsApp message with media (image, video, document)
 */
async function sendWhatsAppMedia(to, mediaUrl, mediaType = 'image', caption = '') {
    if (!isConfigured()) {
        console.log('⚠️ Meta WhatsApp not configured');
        return { success: false, error: 'Not configured' };
    }

    let phone = to.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '966' + phone.substring(1);

    const url = `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: mediaType,
        [mediaType]: {
            link: mediaUrl,
            caption: caption
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.error) {
            return { success: false, error: result.error.message };
        }

        console.log(`✅ WhatsApp ${mediaType} sent to ${phone}`);
        return { success: true, messageId: result.messages?.[0]?.id };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Send cart recovery via WhatsApp template
 * Templates must be pre-approved by Meta
 */
async function sendCartRecoveryWhatsApp(phone, customerName, cartTotal, checkoutUrl, discount = 0) {
    // First try template (for proactive/marketing messages)
    // If no template approved, fall back to text (only works in 24hr service window)
    
    const message = `مرحباً ${customerName}! 👋\n\n` +
        `لاحظنا أنك تركت منتجات في سلتك بقيمة ${cartTotal} ر.س\n\n` +
        (discount > 0 ? `🎁 خصم خاص لك: ${discount}%\n\n` : '') +
        `أكمل طلبك الآن:\n${checkoutUrl}\n\n` +
        `رِبح 💚`;

    return sendWhatsApp(phone, message);
}

/**
 * Send upsell message
 */
async function sendUpsellWhatsApp(phone, customerName, discount = 10) {
    const message = `شكراً ${customerName}! 💚\n\n` +
        `طلبك في الطريق! 🚚\n\n` +
        `🎁 هدية خاصة: خصم ${discount}% على طلبك القادم\n\n` +
        `رِبح`;

    return sendWhatsApp(phone, message);
}

/**
 * Send referral link
 */
async function sendReferralWhatsApp(phone, customerName, referralLink) {
    const message = `مرحباً ${customerName}! 🎉\n\n` +
        `اربح مع أصدقائك!\n\n` +
        `🔗 رابطك الخاص:\n${referralLink}\n\n` +
        `• صديقك يحصل على خصم 10%\n` +
        `• أنت تحصل على 15% من كل طلب\n\n` +
        `رِبح 💚`;

    return sendWhatsApp(phone, message);
}

/**
 * Send interactive message with buttons
 */
async function sendInteractiveWhatsApp(phone, message, buttons) {
    if (!isConfigured()) return { success: false, error: 'Not configured' };

    let formattedPhone = phone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '966' + formattedPhone.substring(1);

    const url = `https://graph.facebook.com/${META_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: message },
            action: {
                buttons: buttons.slice(0, 3).map((btn, i) => ({
                    type: 'reply',
                    reply: {
                        id: btn.id || `btn_${i}`,
                        title: btn.title.substring(0, 20) // Max 20 chars
                    }
                }))
            }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${META_WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.error) return { success: false, error: result.error.message };
        
        return { success: true, messageId: result.messages?.[0]?.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Webhook verification for Meta
 * Meta sends a GET request to verify webhook URL
 */
function verifyWebhook(req, res, verifyToken) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ WhatsApp webhook verified');
        return res.status(200).send(challenge);
    }
    
    return res.sendStatus(403);
}

/**
 * Process incoming webhook from Meta
 */
function processWebhook(body) {
    const messages = [];
    
    if (body.object === 'whatsapp_business_account') {
        body.entry?.forEach(entry => {
            entry.changes?.forEach(change => {
                if (change.field === 'messages') {
                    const value = change.value;
                    
                    // Process incoming messages
                    value.messages?.forEach(msg => {
                        messages.push({
                            type: 'message',
                            from: msg.from,
                            messageId: msg.id,
                            timestamp: msg.timestamp,
                            text: msg.text?.body || '',
                            messageType: msg.type,
                            // For button replies
                            buttonReply: msg.interactive?.button_reply,
                            // For list replies
                            listReply: msg.interactive?.list_reply
                        });
                    });

                    // Process status updates
                    value.statuses?.forEach(status => {
                        messages.push({
                            type: 'status',
                            messageId: status.id,
                            recipientId: status.recipient_id,
                            status: status.status, // sent, delivered, read, failed
                            timestamp: status.timestamp,
                            error: status.errors?.[0]
                        });
                    });
                }
            });
        });
    }

    return messages;
}

module.exports = {
    sendWhatsApp,
    sendWhatsAppMedia,
    sendCartRecoveryWhatsApp,
    sendUpsellWhatsApp,
    sendReferralWhatsApp,
    sendInteractiveWhatsApp,
    verifyWebhook,
    processWebhook,
    isConfigured
};
