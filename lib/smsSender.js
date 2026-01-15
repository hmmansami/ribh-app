/**
 * SMS/WHATSAPP SENDER - Multi-channel messaging
 * 
 * Uses Twilio for SMS and WhatsApp
 * WhatsApp has 98% open rate vs 20% for email
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const TWILIO_SMS_NUMBER = process.env.TWILIO_SMS_NUMBER;

let twilioClient = null;

// Initialize Twilio if credentials exist
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    try {
        const twilio = require('twilio');
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio SMS/WhatsApp ready');
    } catch (e) {
        console.log('⚠️ Twilio not available:', e.message);
    }
}

/**
 * Send WhatsApp message
 */
async function sendWhatsApp(to, message, mediaUrl = null) {
    if (!twilioClient) {
        console.log('⚠️ Twilio not configured, skipping WhatsApp');
        return false;
    }

    // Format phone number for WhatsApp
    let phone = to.replace(/[^0-9+]/g, '');
    if (!phone.startsWith('+')) {
        phone = '+966' + phone.replace(/^0/, ''); // Default to Saudi Arabia
    }

    try {
        const msgOptions = {
            from: TWILIO_WHATSAPP_NUMBER,
            to: `whatsapp:${phone}`,
            body: message
        };

        if (mediaUrl) {
            msgOptions.mediaUrl = [mediaUrl];
        }

        const result = await twilioClient.messages.create(msgOptions);
        console.log(`✅ WhatsApp sent to ${phone}: ${result.sid}`);
        return true;
    } catch (error) {
        console.error('❌ WhatsApp error:', error.message);
        return false;
    }
}

/**
 * Send SMS message
 */
async function sendSMS(to, message) {
    if (!twilioClient || !TWILIO_SMS_NUMBER) {
        console.log('⚠️ Twilio SMS not configured');
        return false;
    }

    let phone = to.replace(/[^0-9+]/g, '');
    if (!phone.startsWith('+')) {
        phone = '+966' + phone.replace(/^0/, '');
    }

    try {
        const result = await twilioClient.messages.create({
            from: TWILIO_SMS_NUMBER,
            to: phone,
            body: message
        });
        console.log(`✅ SMS sent to ${phone}: ${result.sid}`);
        return true;
    } catch (error) {
        console.error('❌ SMS error:', error.message);
        return false;
    }
}

/**
 * Send cart recovery message via WhatsApp
 */
async function sendCartRecoveryWhatsApp(phone, customerName, cartTotal, checkoutUrl, discount = 0) {
    let message = `مرحباً ${customerName}! 👋\n\n`;
    message += `لاحظنا أنك تركت منتجات في سلتك بقيمة ${cartTotal} ر.س\n\n`;

    if (discount > 0) {
        message += `🎁 خصم خاص لك: ${discount}%\n\n`;
    }

    message += `أكمل طلبك الآن:\n${checkoutUrl}\n\n`;
    message += `رِبح 💚`;

    return sendWhatsApp(phone, message);
}

/**
 * Send upsell message via WhatsApp
 */
async function sendUpsellWhatsApp(phone, customerName, discount = 10) {
    let message = `شكراً ${customerName}! 💚\n\n`;
    message += `طلبك في الطريق! 🚚\n\n`;
    message += `🎁 هدية خاصة: خصم ${discount}% على طلبك القادم\n\n`;
    message += `رِبح`;

    return sendWhatsApp(phone, message);
}

/**
 * Send referral link via WhatsApp
 */
async function sendReferralWhatsApp(phone, customerName, referralLink) {
    let message = `مرحباً ${customerName}! 🎉\n\n`;
    message += `اربح مع أصدقائك!\n\n`;
    message += `🔗 رابطك الخاص:\n${referralLink}\n\n`;
    message += `• صديقك يحصل على خصم 10%\n`;
    message += `• أنت تحصل على 15% من كل طلب\n\n`;
    message += `رِبح 💚`;

    return sendWhatsApp(phone, message);
}

module.exports = {
    sendWhatsApp,
    sendSMS,
    sendCartRecoveryWhatsApp,
    sendUpsellWhatsApp,
    sendReferralWhatsApp,
    isConfigured: () => !!twilioClient
};
