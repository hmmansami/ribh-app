/**
 * TELEGRAM SENDER - Free notification channel!
 * 
 * Uses Telegram Bot API (FREE unlimited messages)
 * Store owners subscribe via bot, get instant cart alerts
 */

const fs = require('fs');
const path = require('path');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUBSCRIBERS_FILE = path.join(__dirname, '..', 'data', 'telegram_subscribers.json');

// Ensure file exists
if (!fs.existsSync(SUBSCRIBERS_FILE)) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify([]));
}

function readSubscribers() {
    try { return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8')); }
    catch { return []; }
}

function writeSubscribers(data) {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Send a Telegram message
 */
async function sendMessage(chatId, message, parseMode = 'HTML') {
    if (!TELEGRAM_BOT_TOKEN) {
        console.log('⚠️ Telegram not configured (TELEGRAM_BOT_TOKEN missing)');
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: parseMode
            })
        });

        const data = await response.json();
        if (data.ok) {
            console.log(`📨 Telegram sent to ${chatId}`);
            return true;
        } else {
            console.log(`❌ Telegram error: ${data.description}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Telegram send failed:', error.message);
        return false;
    }
}

/**
 * Subscribe a store owner to notifications
 */
function subscribeStore(storeId, chatId, username = null) {
    const subscribers = readSubscribers();

    // Check if already subscribed
    const existing = subscribers.find(s => s.storeId === storeId);
    if (existing) {
        existing.chatId = chatId;
        existing.username = username;
        existing.updatedAt = new Date().toISOString();
    } else {
        subscribers.push({
            storeId: storeId,
            chatId: chatId,
            username: username,
            subscribedAt: new Date().toISOString()
        });
    }

    writeSubscribers(subscribers);
    console.log(`✅ Store ${storeId} subscribed to Telegram (${chatId})`);
    return true;
}

/**
 * Get subscriber for a store
 */
function getStoreSubscriber(storeId) {
    const subscribers = readSubscribers();
    return subscribers.find(s => s.storeId === storeId);
}

/**
 * Send cart abandoned notification to store owner
 */
async function notifyAbandonedCart(storeId, cart) {
    const subscriber = getStoreSubscriber(storeId);
    if (!subscriber) return false;

    const items = cart.items?.map(i => `• ${i.name || i.title}`).join('\n') || 'منتجات متنوعة';

    const message = `
🛒 <b>سلة متروكة جديدة!</b>

👤 <b>العميل:</b> ${cart.customer?.name || 'غير معروف'}
📧 <b>البريد:</b> ${cart.customer?.email || 'غير متوفر'}
📱 <b>الهاتف:</b> ${cart.customer?.mobile || 'غير متوفر'}

📦 <b>المنتجات:</b>
${items}

💰 <b>المبلغ:</b> ${cart.total || 0} ر.س

⏰ تم إرسال تذكير تلقائي للعميل!
    `.trim();

    return sendMessage(subscriber.chatId, message);
}

/**
 * Send recovery success notification
 */
async function notifyRecoverySuccess(storeId, customerEmail, amount) {
    const subscriber = getStoreSubscriber(storeId);
    if (!subscriber) return false;

    const message = `
🎉 <b>تم استرداد سلة!</b>

👤 العميل: ${customerEmail}
💰 المبلغ: ${amount} ر.س

✅ رِبح يعمل لصالحك!
    `.trim();

    return sendMessage(subscriber.chatId, message);
}

/**
 * Send daily summary
 */
async function notifyDailySummary(storeId, stats) {
    const subscriber = getStoreSubscriber(storeId);
    if (!subscriber) return false;

    const message = `
📊 <b>ملخص اليوم</b>

📧 رسائل مرسلة: ${stats.emailsSent || 0}
🛒 سلات متروكة: ${stats.cartsAbandoned || 0}
✅ سلات مستردة: ${stats.cartsRecovered || 0}
💰 الأرباح: ${stats.revenue || 0} ر.س

🚀 استمر بالنمو مع رِبح!
    `.trim();

    return sendMessage(subscriber.chatId, message);
}

module.exports = {
    sendMessage,
    subscribeStore,
    getStoreSubscriber,
    notifyAbandonedCart,
    notifyRecoverySuccess,
    notifyDailySummary,
    isConfigured: () => !!TELEGRAM_BOT_TOKEN
};
