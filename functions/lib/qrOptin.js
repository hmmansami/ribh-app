/**
 * QR OPT-IN - Physical Store Subscriber Acquisition
 *
 * Generate QR codes that link to WhatsApp opt-in for physical stores.
 * Customer scans QR → opens WhatsApp → sends pre-filled message → auto-subscribed.
 *
 * Flow:
 * 1. Store owner generates QR code via dashboard
 * 2. Prints QR on receipt, table tent, counter display
 * 3. Customer scans → wa.me/{number}?text=اشتراك+{storeCode}
 * 4. WhatsApp receives message → RIBH auto-adds subscriber
 * 5. Welcome journey starts automatically
 */

const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(file) {
    try {
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch { return []; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Generate a WhatsApp opt-in QR code for a physical store
 * @param {string} storeId - Merchant ID
 * @param {string} whatsappNumber - Store's WhatsApp number (966XXXXXXXXX)
 * @param {string} storeName - Store name for the pre-filled message
 * @returns {Object} { qrDataUrl, qrLink, storeCode }
 */
async function generateOptinQR(storeId, whatsappNumber, storeName) {
    // Create unique store code
    const storeCode = `R${storeId}`.substring(0, 10);

    // Build WhatsApp link with pre-filled opt-in message
    const optinMessage = encodeURIComponent(`اشتراك ${storeCode}`);
    const cleanNumber = whatsappNumber.replace(/\+/g, '').replace(/\s/g, '');
    const waLink = `https://wa.me/${cleanNumber}?text=${optinMessage}`;

    // Generate QR code as data URL (base64 PNG)
    const qrDataUrl = await QRCode.toDataURL(waLink, {
        width: 512,
        margin: 2,
        color: {
            dark: '#0a0a0a',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
    });

    // Also generate as SVG string for high-quality print
    const qrSvg = await QRCode.toString(waLink, {
        type: 'svg',
        width: 512,
        margin: 2,
        color: {
            dark: '#0a0a0a',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
    });

    console.log(`📱 [QR] Generated opt-in QR for store ${storeId}: ${waLink}`);

    return {
        qrDataUrl,
        qrSvg,
        qrLink: waLink,
        storeCode,
        whatsappNumber: cleanNumber,
        storeName
    };
}

/**
 * Process an incoming WhatsApp opt-in message
 * Called when a customer sends "اشتراك {storeCode}" to the store's WhatsApp
 * @param {string} storeId - Merchant ID
 * @param {string} phone - Customer's phone number
 * @param {string} name - Customer's WhatsApp name (if available)
 * @param {string} source - 'qr_physical', 'social', 'widget'
 */
function processOptin(storeId, phone, name, source = 'qr_physical') {
    const customersFile = path.join(DATA_DIR, 'customers.json');
    const customers = readJSON(customersFile);

    // Check if already subscribed
    const existing = customers.find(c =>
        c.storeId === String(storeId) && c.phone === phone
    );

    if (existing) {
        // Update existing — mark as re-subscribed
        existing.optInStatus = existing.optInStatus || {};
        existing.optInStatus.whatsapp = true;
        existing.lastActivity = new Date().toISOString();
        if (source === 'qr_physical' && !existing.tags) existing.tags = [];
        if (source === 'qr_physical' && existing.tags && !existing.tags.includes('physical_store')) {
            existing.tags.push('physical_store');
        }
        writeJSON(customersFile, customers);
        console.log(`📱 [QR] Existing subscriber re-opted in: ${phone} (${source})`);
        return { isNew: false, customer: existing };
    }

    // Create new subscriber
    const newCustomer = {
        storeId: String(storeId),
        phone,
        name: name || '',
        email: null,
        source,
        tags: source === 'qr_physical' ? ['physical_store'] : [],
        firstSeen: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        totalOrders: 0,
        totalSpent: 0,
        optInStatus: { whatsapp: true, sms: true, email: false },
        metadata: {}
    };

    customers.push(newCustomer);
    writeJSON(customersFile, customers);

    console.log(`📱 [QR] New subscriber: ${phone} from ${source} for store ${storeId}`);
    return { isNew: true, customer: newCustomer };
}

/**
 * Get subscriber stats for a store
 */
function getSubscriberStats(storeId) {
    const customersFile = path.join(DATA_DIR, 'customers.json');
    const customers = readJSON(customersFile);
    const storeCustomers = customers.filter(c => c.storeId === String(storeId));

    const bySource = {};
    for (const c of storeCustomers) {
        const src = c.source || 'unknown';
        bySource[src] = (bySource[src] || 0) + 1;
    }

    return {
        total: storeCustomers.length,
        whatsappOptedIn: storeCustomers.filter(c => c.optInStatus?.whatsapp).length,
        smsOptedIn: storeCustomers.filter(c => c.optInStatus?.sms).length,
        bySource,
        physicalStore: storeCustomers.filter(c => c.tags?.includes('physical_store')).length
    };
}

module.exports = {
    generateOptinQR,
    processOptin,
    getSubscriberStats
};
