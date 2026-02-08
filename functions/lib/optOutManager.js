/**
 * OPT-OUT MANAGER - Compliance & Subscriber Preferences
 *
 * Handles:
 * - Auto opt-out when customer sends "إلغاء", "stop", "الغاء الاشتراك"
 * - Quiet hours enforcement (10 PM - 8 AM Saudi time)
 * - Message frequency caps per customer per week
 * - Opt-in/out status tracking per channel
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

function readJSON(file) {
    try {
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Arabic and English opt-out keywords
const OPT_OUT_KEYWORDS = [
    'إلغاء', 'الغاء', 'الغاء الاشتراك', 'إلغاء الاشتراك',
    'وقف', 'أوقف', 'لا أريد', 'ما أبي', 'ماابي',
    'stop', 'unsubscribe', 'cancel', 'opt out', 'optout'
];

// Re-opt-in keywords
const OPT_IN_KEYWORDS = [
    'اشتراك', 'اشترك', 'سجلني', 'أبي أشترك',
    'subscribe', 'start', 'opt in', 'optin'
];

/**
 * Check if a message is an opt-out request
 */
function isOptOutMessage(message) {
    if (!message) return false;
    const normalized = message.trim().toLowerCase();
    return OPT_OUT_KEYWORDS.some(keyword =>
        normalized === keyword || normalized.includes(keyword)
    );
}

/**
 * Check if a message is an opt-in request
 */
function isOptInMessage(message) {
    if (!message) return false;
    const normalized = message.trim().toLowerCase();
    return OPT_IN_KEYWORDS.some(keyword =>
        normalized === keyword || normalized.startsWith(keyword)
    );
}

/**
 * Process opt-out for a customer
 * @returns {boolean} true if customer was opted out
 */
function processOptOut(storeId, phone, channel = 'whatsapp') {
    const customers = readJSON(CUSTOMERS_FILE);
    const customer = customers.find(c =>
        c.storeId === String(storeId) && c.phone === phone
    );

    if (!customer) return false;

    customer.optInStatus = customer.optInStatus || {};
    customer.optInStatus[channel] = false;
    customer.optOutDate = customer.optOutDate || {};
    customer.optOutDate[channel] = new Date().toISOString();

    writeJSON(CUSTOMERS_FILE, customers);
    console.log(`🚫 [OptOut] ${phone} opted out of ${channel} for store ${storeId}`);
    return true;
}

/**
 * Check if a customer is opted in for a specific channel
 */
function isOptedIn(storeId, phone, channel = 'whatsapp') {
    const customers = readJSON(CUSTOMERS_FILE);
    const customer = customers.find(c =>
        c.storeId === String(storeId) && c.phone === phone
    );

    if (!customer) return false;
    if (!customer.optInStatus) return true; // Legacy customers assumed opted in
    return customer.optInStatus[channel] !== false;
}

/**
 * Check if current time is within quiet hours (Saudi Arabia)
 * Quiet hours: 10 PM - 8 AM AST (UTC+3)
 */
function isQuietHours() {
    const now = new Date();
    // Convert to Saudi time (UTC+3)
    const saudiHour = (now.getUTCHours() + 3) % 24;
    // Quiet hours: 22:00 - 08:00
    return saudiHour >= 22 || saudiHour < 8;
}

/**
 * Check if sending to this customer would exceed frequency cap
 * Caps: 3 WhatsApp/week, 2 SMS/week
 */
function isFrequencyCapped(storeId, phone, channel = 'whatsapp') {
    const customers = readJSON(CUSTOMERS_FILE);
    const customer = customers.find(c =>
        c.storeId === String(storeId) && c.phone === phone
    );

    if (!customer || !customer.messageLog) return false;

    const caps = { whatsapp: 3, sms: 2 };
    const cap = caps[channel] || 3;

    // Count messages in last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentMessages = customer.messageLog.filter(m =>
        m.channel === channel && new Date(m.sentAt) > oneWeekAgo
    );

    return recentMessages.length >= cap;
}

/**
 * Log a sent message for frequency tracking
 */
function logMessage(storeId, phone, channel, messageType) {
    const customers = readJSON(CUSTOMERS_FILE);
    const customer = customers.find(c =>
        c.storeId === String(storeId) && c.phone === phone
    );

    if (!customer) return;

    customer.messageLog = customer.messageLog || [];
    customer.messageLog.push({
        channel,
        messageType,
        sentAt: new Date().toISOString()
    });

    // Keep only last 50 messages
    if (customer.messageLog.length > 50) {
        customer.messageLog = customer.messageLog.slice(-50);
    }

    writeJSON(CUSTOMERS_FILE, customers);
}

/**
 * Check if it's safe to send a message to this customer
 * Returns { canSend: boolean, reason: string }
 */
function canSendMessage(storeId, phone, channel = 'whatsapp') {
    if (!isOptedIn(storeId, phone, channel)) {
        return { canSend: false, reason: 'opted_out' };
    }

    if (isQuietHours()) {
        return { canSend: false, reason: 'quiet_hours' };
    }

    if (isFrequencyCapped(storeId, phone, channel)) {
        return { canSend: false, reason: 'frequency_cap' };
    }

    return { canSend: true, reason: 'ok' };
}

module.exports = {
    isOptOutMessage,
    isOptInMessage,
    processOptOut,
    isOptedIn,
    isQuietHours,
    isFrequencyCapped,
    logMessage,
    canSendMessage,
    OPT_OUT_KEYWORDS,
    OPT_IN_KEYWORDS
};
