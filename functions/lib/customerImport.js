/**
 * Customer Data Import System - RIBH
 *
 * Handles CSV file parsing, phone normalization for Saudi numbers,
 * deduplication by phone, source tagging, and Firestore storage.
 *
 * Firestore structure:
 *   stores/{storeId}/customers/{customerId}
 *
 * Features:
 *   - CSV parsing with UTF-8 BOM handling and Arabic text support
 *   - Saudi phone normalization (05x -> +9665x, 9665x -> +9665x)
 *   - Deduplication by phone number
 *   - Source tagging (physical_store, online, imported, other_app)
 *   - Import stats (total, new, duplicates, errors)
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// Valid customer sources
const CUSTOMER_SOURCES = ['physical_store', 'online', 'imported', 'other_app'];

// ==========================================
// PHONE NORMALIZATION (Saudi Numbers)
// ==========================================

/**
 * Normalize Saudi phone number to international format (+966XXXXXXXXX)
 * Handles: 05x, 5x, 9665x, +9665x, 00966x
 * @param {string} phone - Raw phone number
 * @returns {string} Normalized phone or empty string
 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/[\s\-\(\)\+\.]/g, '');

    // Remove leading zeros from international prefix (00966 -> 966)
    if (cleaned.startsWith('00966')) {
        cleaned = '966' + cleaned.substring(5);
    }

    // 05XXXXXXXX -> 9665XXXXXXXX
    if (cleaned.startsWith('05') && cleaned.length === 10) {
        cleaned = '966' + cleaned.substring(1);
    }

    // 5XXXXXXXX (9 digits starting with 5) -> 9665XXXXXXXX
    if (cleaned.startsWith('5') && cleaned.length === 9) {
        cleaned = '966' + cleaned;
    }

    // 0XXXXXXXXX (10 digits starting with 0) -> 966XXXXXXXXX
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '966' + cleaned.substring(1);
    }

    // Already 966XXXXXXXXX (12 digits)
    if (cleaned.startsWith('966') && cleaned.length === 12) {
        return '+' + cleaned;
    }

    // If it doesn't look like a Saudi number, return with + prefix
    if (cleaned.length >= 10) {
        return '+' + cleaned;
    }

    return '';
}

// ==========================================
// CSV PARSING
// ==========================================

/**
 * Parse CSV text into array of row objects
 * Handles UTF-8 BOM, Arabic text, quoted fields, various line endings
 * @param {string} csvText - Raw CSV content
 * @returns {Array<object>} Parsed rows
 */
function parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];

    // Remove UTF-8 BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.substring(1);
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Parse header row
    const headers = parseCSVLine(lines[0]).map(h =>
        h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '_')
    );

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;

        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = (values[j] || '').trim().replace(/^['"]|['"]$/g, '');
        }
        rows.push(row);
    }

    return rows;
}

/**
 * Parse a single CSV line respecting quoted fields
 * @param {string} line
 * @returns {Array<string>}
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',' || ch === '\t') {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result;
}

// ==========================================
// COLUMN MAPPING
// ==========================================

/**
 * Map raw CSV row to customer record using column mapping
 * @param {object} row - Raw CSV row
 * @param {object} mapping - { name: 'csvColumn', phone: 'csvColumn', ... }
 * @returns {object} Mapped customer data
 */
function mapColumns(row, mapping) {
    const customer = {
        name: '',
        phone: '',
        email: '',
        totalSpent: 0,
        lastOrderDate: null,
        source: 'imported'
    };

    if (mapping.name && row[mapping.name]) {
        customer.name = row[mapping.name].trim();
    }
    if (mapping.phone && row[mapping.phone]) {
        customer.phone = normalizePhone(row[mapping.phone]);
    }
    if (mapping.email && row[mapping.email]) {
        customer.email = row[mapping.email].trim().toLowerCase();
    }
    if (mapping.amount && row[mapping.amount]) {
        const amount = parseFloat(row[mapping.amount].replace(/[^\d.]/g, ''));
        customer.totalSpent = isNaN(amount) ? 0 : amount;
    }
    if (mapping.date && row[mapping.date]) {
        const parsed = new Date(row[mapping.date]);
        customer.lastOrderDate = isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if (mapping.source && row[mapping.source]) {
        const src = row[mapping.source].trim().toLowerCase().replace(/\s+/g, '_');
        customer.source = CUSTOMER_SOURCES.includes(src) ? src : 'imported';
    }

    return customer;
}

// ==========================================
// IMPORT TO FIRESTORE
// ==========================================

/**
 * Import customers from parsed CSV data into Firestore
 * Deduplicates by phone number, updates existing records
 *
 * @param {string} storeId - Store identifier
 * @param {Array<object>} rawRows - Parsed CSV rows
 * @param {object} columnMapping - Column mapping { name, phone, email, amount, date, source }
 * @param {string} [defaultSource='imported'] - Default source tag
 * @returns {object} Import stats { total, imported, duplicates, errors, customers }
 */
async function importCustomers(storeId, rawRows, columnMapping, defaultSource = 'imported') {
    const db = getDb();

    if (!storeId) throw new Error('Store ID is required');
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error('No data to import');
    }

    const stats = {
        total: rawRows.length,
        imported: 0,
        duplicates: 0,
        errors: 0,
        errorDetails: []
    };

    // Map and validate rows
    const customers = [];
    for (let i = 0; i < rawRows.length; i++) {
        try {
            const mapped = mapColumns(rawRows[i], columnMapping);

            // Override source if provided
            if (defaultSource && CUSTOMER_SOURCES.includes(defaultSource)) {
                mapped.source = defaultSource;
            }

            // Must have at least phone or email
            if (!mapped.phone && !mapped.email) {
                stats.errors++;
                stats.errorDetails.push({
                    row: i + 2, // +2 for 1-indexed header row
                    reason: 'no_phone_or_email'
                });
                continue;
            }

            customers.push(mapped);
        } catch (e) {
            stats.errors++;
            stats.errorDetails.push({
                row: i + 2,
                reason: e.message
            });
        }
    }

    // Build phone lookup for existing customers (for deduplication)
    const customersRef = db.collection('stores').doc(storeId).collection('customers');
    const existingPhones = new Set();

    // Fetch existing customer phones in batches
    const existingSnap = await customersRef.select('phone').get();
    existingSnap.forEach(doc => {
        const phone = doc.data().phone;
        if (phone) existingPhones.add(phone);
    });

    // Also deduplicate within the import batch itself
    const seenPhones = new Set();

    // Process in batches of 450 (Firestore limit is 500)
    const BATCH_LIMIT = 450;
    let batch = db.batch();
    let batchCount = 0;

    for (const customer of customers) {
        // Deduplicate by phone
        if (customer.phone) {
            if (existingPhones.has(customer.phone) || seenPhones.has(customer.phone)) {
                stats.duplicates++;
                continue;
            }
            seenPhones.add(customer.phone);
        }

        const docRef = customersRef.doc();
        batch.set(docRef, {
            ...customer,
            storeId,
            importedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        batchCount++;
        stats.imported++;

        if (batchCount >= BATCH_LIMIT) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await batch.commit();
    }

    // Update store-level customer count
    const storeRef = db.collection('stores').doc(storeId);
    const storeDoc = await storeRef.get();
    if (storeDoc.exists) {
        await storeRef.update({
            customerCount: admin.firestore.FieldValue.increment(stats.imported),
            lastImportAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        await storeRef.set({
            customerCount: stats.imported,
            lastImportAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    console.log(`[CustomerImport] Store ${storeId}: ${stats.imported} imported, ${stats.duplicates} duplicates, ${stats.errors} errors`);

    return stats;
}

// ==========================================
// CUSTOMER STATS
// ==========================================

/**
 * Get customer statistics for a store
 * @param {string} storeId
 * @returns {object} Stats by source, total count, etc.
 */
async function getCustomerStats(storeId) {
    const db = getDb();

    if (!storeId) throw new Error('Store ID is required');

    const customersRef = db.collection('stores').doc(storeId).collection('customers');
    const snap = await customersRef.get();

    const stats = {
        total: snap.size,
        bySource: {
            physical_store: 0,
            online: 0,
            imported: 0,
            other_app: 0
        },
        withPhone: 0,
        withEmail: 0,
        totalRevenue: 0,
        avgSpent: 0
    };

    snap.forEach(doc => {
        const data = doc.data();

        // Count by source
        const source = data.source || 'imported';
        if (stats.bySource.hasOwnProperty(source)) {
            stats.bySource[source]++;
        } else {
            stats.bySource.imported++;
        }

        // Count with contact info
        if (data.phone) stats.withPhone++;
        if (data.email) stats.withEmail++;

        // Revenue
        if (data.totalSpent) stats.totalRevenue += data.totalSpent;
    });

    stats.avgSpent = stats.total > 0 ? Math.round(stats.totalRevenue / stats.total) : 0;

    return stats;
}

/**
 * Get customer segments for campaign targeting
 * @param {string} storeId
 * @param {string} segment - 'all', 'physical_store', 'online', 'high_value', 'inactive'
 * @returns {object} { count, customers }
 */
async function getCustomerSegment(storeId, segment = 'all') {
    const db = getDb();

    if (!storeId) throw new Error('Store ID is required');

    const customersRef = db.collection('stores').doc(storeId).collection('customers');
    let query = customersRef;

    switch (segment) {
        case 'physical_store':
            query = customersRef.where('source', '==', 'physical_store');
            break;
        case 'online':
            query = customersRef.where('source', '==', 'online');
            break;
        case 'high_value':
            query = customersRef.where('totalSpent', '>=', 500);
            break;
        case 'inactive': {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = customersRef.where('lastOrderDate', '<=', thirtyDaysAgo.toISOString());
            break;
        }
        case 'all':
        default:
            break;
    }

    const snap = await query.get();
    const customers = [];

    snap.forEach(doc => {
        const data = doc.data();
        // Only include customers with phone for campaign targeting
        if (data.phone) {
            customers.push({
                id: doc.id,
                name: data.name,
                phone: data.phone,
                email: data.email || '',
                source: data.source,
                totalSpent: data.totalSpent || 0
            });
        }
    });

    return {
        segment,
        count: customers.length,
        customers
    };
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Core
    importCustomers,
    getCustomerStats,
    getCustomerSegment,

    // Utilities
    normalizePhone,
    parseCSV,
    parseCSVLine,
    mapColumns,

    // Constants
    CUSTOMER_SOURCES
};
