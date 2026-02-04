/**
 * Customer Data Import System - RIBH
 *
 * Handles CSV/Excel file parsing, phone normalization for Saudi numbers,
 * auto-detection of column headers (Arabic + English), smart deduplication
 * with merge, POS import flows, source tagging, and Firestore storage.
 *
 * Firestore structure:
 *   stores/{storeId}/customers/{customerId}
 *
 * Features:
 *   - CSV parsing with UTF-8 BOM handling and Arabic text support
 *   - Auto-detect columns: name, phone, email, amount, date (Arabic + English)
 *   - Saudi phone normalization (05x -> +9665x, 9665x -> +9665x, 009665x -> +9665x)
 *   - Smart deduplication: merge records instead of skip
 *   - Source tagging: online, physical, imported, salla, shopify, other_app
 *   - POS import: Foodics, Marn, Qoyod export formats
 *   - Import stats: totalProcessed, newCustomers, duplicatesMerged, errors, readyForCampaign
 */

const admin = require('firebase-admin');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// Valid customer sources
const CUSTOMER_SOURCES = ['online', 'physical', 'imported', 'salla', 'shopify', 'other_app'];

// ==========================================
// COLUMN AUTO-DETECTION
// ==========================================

/**
 * Known column header patterns for auto-detection
 * Maps our field names to possible CSV header names (Arabic + English)
 */
const COLUMN_PATTERNS = {
    name: [
        'name', 'customer_name', 'full_name', 'first_name', 'client_name',
        'customer', 'الاسم', 'اسم_العميل', 'اسم', 'العميل', 'الاسم_الكامل',
        'اسم_الزبون', 'اسم العميل', 'الاسم الكامل'
    ],
    phone: [
        'phone', 'mobile', 'phone_number', 'cell', 'telephone', 'tel',
        'contact', 'whatsapp', 'الجوال', 'الهاتف', 'رقم_الجوال', 'رقم_الهاتف',
        'الموبايل', 'رقم الجوال', 'رقم الهاتف', 'جوال', 'هاتف'
    ],
    email: [
        'email', 'e-mail', 'email_address', 'mail', 'البريد', 'البريد_الإلكتروني',
        'الايميل', 'ايميل', 'البريد الإلكتروني', 'بريد'
    ],
    amount: [
        'amount', 'total', 'total_spent', 'total_spend', 'revenue', 'value',
        'order_total', 'spent', 'المبلغ', 'المجموع', 'الإجمالي', 'إجمالي_المشتريات',
        'قيمة_المشتريات', 'المبلغ الإجمالي', 'إجمالي المشتريات', 'مبلغ'
    ],
    date: [
        'date', 'last_order', 'last_order_date', 'last_visit', 'last_purchase',
        'order_date', 'created_at', 'التاريخ', 'تاريخ_آخر_طلب', 'آخر_طلب',
        'تاريخ_آخر_زيارة', 'تاريخ', 'آخر زيارة', 'تاريخ آخر طلب'
    ],
    orderCount: [
        'order_count', 'orders', 'total_orders', 'visit_count', 'visits',
        'num_orders', 'عدد_الطلبات', 'عدد_الزيارات', 'عدد الطلبات', 'عدد الزيارات',
        'طلبات'
    ]
};

/**
 * Auto-detect column mapping from CSV headers
 * @param {string[]} headers - CSV column headers (already lowercased/cleaned)
 * @returns {object} Detected mapping { name: 'headerName', phone: 'headerName', ... }
 */
function autoDetectColumns(headers) {
    const mapping = {};
    const normalizedHeaders = headers.map(h =>
        h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '_')
    );

    for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        for (const pattern of patterns) {
            const normalizedPattern = pattern.replace(/\s+/g, '_');
            const idx = normalizedHeaders.findIndex(h =>
                h === normalizedPattern || h.includes(normalizedPattern)
            );
            if (idx !== -1) {
                mapping[field] = normalizedHeaders[idx];
                break;
            }
        }
    }

    return mapping;
}

/**
 * Get detection confidence score
 * @param {object} mapping
 * @returns {object} { score: 0-100, hasPhone: bool, hasName: bool, ... }
 */
function getMappingConfidence(mapping) {
    const result = {
        score: 0,
        hasPhone: !!mapping.phone,
        hasName: !!mapping.name,
        hasEmail: !!mapping.email,
        hasAmount: !!mapping.amount,
        hasDate: !!mapping.date,
        hasOrderCount: !!mapping.orderCount
    };

    // Phone is worth 40 points (critical)
    if (result.hasPhone) result.score += 40;
    // Name is worth 25 points
    if (result.hasName) result.score += 25;
    // Email is worth 15 points
    if (result.hasEmail) result.score += 15;
    // Amount is worth 10 points
    if (result.hasAmount) result.score += 10;
    // Date is worth 5 points
    if (result.hasDate) result.score += 5;
    // Order count is worth 5 points
    if (result.hasOrderCount) result.score += 5;

    return result;
}

// ==========================================
// PHONE NORMALIZATION (Saudi Numbers)
// ==========================================

/**
 * Normalize Saudi phone number to international format (+966XXXXXXXXX)
 * Handles: 05x, 5x, 9665x, +9665x, 009665x
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

    // 0XXXXXXXXX (10 digits starting with 0, landline) -> 966XXXXXXXXX
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '966' + cleaned.substring(1);
    }

    // Already 966XXXXXXXXX (12 digits)
    if (cleaned.startsWith('966') && cleaned.length === 12) {
        return '+' + cleaned;
    }

    // If it doesn't look like a Saudi number, return with + prefix if long enough
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
 * @returns {{ headers: string[], rows: object[] }}
 */
function parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') return { headers: [], rows: [] };

    // Remove UTF-8 BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) {
        csvText = csvText.substring(1);
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return { headers: [], rows: [] };

    // Parse header row
    const rawHeaders = parseCSVLine(lines[0]);
    const headers = rawHeaders.map(h =>
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

    return { headers, rows };
}

/**
 * Parse a single CSV line respecting quoted fields
 * @param {string} line
 * @returns {string[]}
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
            } else if (ch === ',' || ch === '\t' || ch === ';') {
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
// POS DATA PARSING
// ==========================================

/**
 * Parse POS export data (Foodics, Marn, Qoyod)
 * Accepts JSON or CSV with POS-specific field mapping
 * @param {string|object} data - Raw POS export (JSON string, object, or CSV)
 * @param {string} posSystem - 'foodics', 'marn', 'qoyod', or 'generic'
 * @returns {{ headers: string[], rows: object[] }}
 */
function parsePOSData(data, posSystem = 'generic') {
    // If it's a string, try JSON first, then CSV
    let records = [];

    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            records = Array.isArray(parsed) ? parsed : (parsed.data || parsed.customers || parsed.records || [parsed]);
        } catch (e) {
            // Not JSON, try CSV
            const csvResult = parseCSV(data);
            return csvResult;
        }
    } else if (Array.isArray(data)) {
        records = data;
    } else if (data && typeof data === 'object') {
        records = data.data || data.customers || data.records || [data];
    }

    if (records.length === 0) return { headers: [], rows: [] };

    // Map POS-specific fields to our standard format
    const fieldMap = getPOSFieldMap(posSystem);
    const headers = ['name', 'phone', 'email', 'amount', 'date', 'order_count'];
    const rows = records.map(record => {
        const row = {};
        for (const [ourField, posFields] of Object.entries(fieldMap)) {
            for (const posField of posFields) {
                const value = getNestedValue(record, posField);
                if (value !== undefined && value !== null && value !== '') {
                    row[ourField] = String(value);
                    break;
                }
            }
        }
        return row;
    });

    return { headers, rows };
}

/**
 * Get field mapping for a POS system
 * @param {string} posSystem
 * @returns {object}
 */
function getPOSFieldMap(posSystem) {
    const baseMappings = {
        name: ['name', 'customer_name', 'full_name', 'first_name', 'الاسم'],
        phone: ['phone', 'mobile', 'phone_number', 'الجوال', 'الهاتف'],
        email: ['email', 'e_mail', 'البريد'],
        amount: ['total_spent', 'total', 'revenue', 'المبلغ', 'الإجمالي'],
        date: ['last_visit', 'last_order', 'updated_at', 'التاريخ'],
        order_count: ['visit_count', 'order_count', 'visits', 'orders', 'عدد_الزيارات']
    };

    const posSpecific = {
        foodics: {
            name: ['name', 'customer.name', 'first_name'],
            phone: ['phone', 'customer.phone', 'dial_code'],
            email: ['email', 'customer.email'],
            amount: ['total_money.amount', 'total_paid', 'total'],
            date: ['updated_at', 'last_visit_at', 'created_at'],
            order_count: ['visits_count', 'orders_count', 'total_visits']
        },
        marn: {
            name: ['customerName', 'name', 'اسم العميل'],
            phone: ['customerMobile', 'mobile', 'phone', 'رقم الجوال'],
            email: ['customerEmail', 'email', 'البريد الإلكتروني'],
            amount: ['totalPurchases', 'totalAmount', 'إجمالي المشتريات'],
            date: ['lastPurchaseDate', 'lastVisit', 'تاريخ آخر عملية'],
            order_count: ['purchasesCount', 'visitCount', 'عدد العمليات']
        },
        qoyod: {
            name: ['name', 'contact_name', 'اسم جهة الاتصال'],
            phone: ['phone', 'mobile', 'الهاتف'],
            email: ['email', 'البريد الإلكتروني'],
            amount: ['balance', 'total_invoiced', 'إجمالي الفواتير'],
            date: ['updated_at', 'last_invoice_date', 'تاريخ آخر فاتورة'],
            order_count: ['invoices_count', 'عدد الفواتير']
        }
    };

    return posSpecific[posSystem] || baseMappings;
}

/**
 * Get nested value from object using dot notation
 * @param {object} obj
 * @param {string} path
 * @returns {*}
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

// ==========================================
// COLUMN MAPPING
// ==========================================

/**
 * Map raw CSV row to customer record using column mapping
 * @param {object} row - Raw CSV row
 * @param {object} mapping - { name: 'csvColumn', phone: 'csvColumn', ... }
 * @param {string} defaultSource - Default source tag
 * @returns {object} Mapped customer data
 */
function mapColumns(row, mapping, defaultSource = 'imported') {
    const customer = {
        name: '',
        phone: '',
        email: '',
        totalSpend: 0,
        orderCount: 0,
        lastOrderDate: null,
        source: defaultSource,
        tags: [],
        status: 'active'
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
        customer.totalSpend = isNaN(amount) ? 0 : amount;
    }
    if (mapping.date && row[mapping.date]) {
        const parsed = new Date(row[mapping.date]);
        customer.lastOrderDate = isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if (mapping.orderCount && row[mapping.orderCount]) {
        const count = parseInt(row[mapping.orderCount], 10);
        customer.orderCount = isNaN(count) ? 0 : count;
    }

    // Auto-tag based on data
    if (customer.totalSpend >= 500) customer.tags.push('high_value');
    if (customer.orderCount >= 5) customer.tags.push('repeat_buyer');

    return customer;
}

// ==========================================
// PREVIEW IMPORT
// ==========================================

/**
 * Preview import without saving - returns detected columns and sample data
 * @param {string} csvText - Raw CSV/JSON content
 * @param {string} format - 'csv', 'json', 'foodics', 'marn', 'qoyod'
 * @returns {object} Preview result
 */
function previewImport(csvText, format = 'csv') {
    let headers, rows;

    if (format === 'csv') {
        const result = parseCSV(csvText);
        headers = result.headers;
        rows = result.rows;
    } else {
        const posSystem = ['foodics', 'marn', 'qoyod'].includes(format) ? format : 'generic';
        const result = parsePOSData(csvText, posSystem);
        headers = result.headers;
        rows = result.rows;
    }

    if (!headers || headers.length === 0) {
        return {
            success: false,
            error: 'no_headers',
            message: 'Could not detect any columns in the file'
        };
    }

    // Auto-detect column mapping
    const detectedMapping = autoDetectColumns(headers);
    const confidence = getMappingConfidence(detectedMapping);

    // Get sample rows (first 5)
    const sampleRows = rows.slice(0, 5).map(row => {
        const mapped = mapColumns(row, detectedMapping);
        return {
            raw: row,
            mapped
        };
    });

    // Count rows with valid phone numbers
    let validPhones = 0;
    let validEmails = 0;
    for (const row of rows) {
        const mapped = mapColumns(row, detectedMapping);
        if (mapped.phone) validPhones++;
        if (mapped.email) validEmails++;
    }

    return {
        success: true,
        totalRows: rows.length,
        headers,
        detectedMapping,
        confidence,
        sampleRows,
        validPhones,
        validEmails,
        readyForImport: confidence.hasPhone || confidence.hasEmail
    };
}

// ==========================================
// IMPORT TO FIRESTORE (with Smart Merge)
// ==========================================

/**
 * Import customers from parsed data into Firestore
 * Smart deduplication: merges records (combines data, keeps highest values)
 *
 * @param {string} storeId - Store identifier
 * @param {object[]} rawRows - Parsed rows
 * @param {object} columnMapping - Column mapping { name, phone, email, amount, date, orderCount }
 * @param {string} [defaultSource='imported'] - Default source tag
 * @returns {object} Import stats
 */
async function importCustomers(storeId, rawRows, columnMapping, defaultSource = 'imported') {
    const db = getDb();

    if (!storeId) throw new Error('Store ID is required');
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error('No data to import');
    }

    const stats = {
        totalProcessed: rawRows.length,
        newCustomers: 0,
        duplicatesMerged: 0,
        errors: 0,
        errorDetails: [],
        readyForCampaign: 0
    };

    // Map and validate rows
    const customers = [];
    for (let i = 0; i < rawRows.length; i++) {
        try {
            const mapped = mapColumns(rawRows[i], columnMapping, defaultSource);

            // Must have at least phone or email
            if (!mapped.phone && !mapped.email) {
                stats.errors++;
                stats.errorDetails.push({
                    row: i + 2,
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

    // Build phone -> doc lookup for existing customers
    const customersRef = db.collection('stores').doc(storeId).collection('customers');
    const existingByPhone = new Map(); // phone -> { docId, data }

    const existingSnap = await customersRef.get();
    existingSnap.forEach(doc => {
        const data = doc.data();
        if (data.phone) {
            existingByPhone.set(data.phone, { docId: doc.id, data });
        }
    });

    // Also track within this import batch
    const seenPhones = new Map(); // phone -> mapped customer (for intra-batch dedup)

    // Process in batches of 450 (Firestore limit is 500 per batch)
    const BATCH_LIMIT = 450;
    let batch = db.batch();
    let batchCount = 0;

    for (const customer of customers) {
        const phone = customer.phone;

        // Check existing in Firestore
        if (phone && existingByPhone.has(phone)) {
            // SMART MERGE: update existing record with new data
            const existing = existingByPhone.get(phone);
            const mergedData = mergeCustomerData(existing.data, customer);
            const docRef = customersRef.doc(existing.docId);
            batch.update(docRef, {
                ...mergedData,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            batchCount++;
            stats.duplicatesMerged++;

            if (mergedData.phone) stats.readyForCampaign++;

        } else if (phone && seenPhones.has(phone)) {
            // Intra-batch duplicate: merge into the pending record
            const prev = seenPhones.get(phone);
            const merged = mergeCustomerData(prev, customer);
            seenPhones.set(phone, merged);
            stats.duplicatesMerged++;

        } else {
            // New customer
            if (phone) {
                seenPhones.set(phone, customer);
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
            stats.newCustomers++;

            if (customer.phone) stats.readyForCampaign++;
        }

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
            customerCount: admin.firestore.FieldValue.increment(stats.newCustomers),
            lastImportAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } else {
        await storeRef.set({
            customerCount: stats.newCustomers,
            lastImportAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    console.log(`[CustomerImport] Store ${storeId}: ${stats.newCustomers} new, ${stats.duplicatesMerged} merged, ${stats.errors} errors`);

    return stats;
}

/**
 * Smart merge: combine two customer records, keeping highest/best values
 * @param {object} existing - Existing customer data
 * @param {object} incoming - New customer data
 * @returns {object} Merged data (fields to update)
 */
function mergeCustomerData(existing, incoming) {
    const merged = {};

    // Name: keep existing unless empty
    if (!existing.name && incoming.name) {
        merged.name = incoming.name;
    }

    // Email: keep existing unless empty
    if (!existing.email && incoming.email) {
        merged.email = incoming.email;
    }

    // TotalSpend: keep highest
    const existingSpend = existing.totalSpend || existing.totalSpent || 0;
    const incomingSpend = incoming.totalSpend || incoming.totalSpent || 0;
    if (incomingSpend > existingSpend) {
        merged.totalSpend = incomingSpend;
    }

    // OrderCount: keep highest
    const existingCount = existing.orderCount || 0;
    const incomingCount = incoming.orderCount || 0;
    if (incomingCount > existingCount) {
        merged.orderCount = incomingCount;
    }

    // LastOrderDate: keep most recent
    if (incoming.lastOrderDate) {
        const existingDate = existing.lastOrderDate ? new Date(existing.lastOrderDate) : new Date(0);
        const incomingDate = new Date(incoming.lastOrderDate);
        if (incomingDate > existingDate) {
            merged.lastOrderDate = incoming.lastOrderDate;
        }
    }

    // Tags: combine unique
    const existingTags = existing.tags || [];
    const incomingTags = incoming.tags || [];
    const combinedTags = [...new Set([...existingTags, ...incomingTags])];
    if (combinedTags.length > existingTags.length) {
        merged.tags = combinedTags;
    }

    // Source: add the new source as a tag if different
    if (incoming.source && incoming.source !== existing.source) {
        merged.tags = merged.tags || [...existingTags];
        if (!merged.tags.includes(incoming.source)) {
            merged.tags.push(incoming.source);
        }
    }

    // Phone: keep existing (primary key)
    merged.phone = existing.phone || incoming.phone;

    return merged;
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
        bySource: {},
        withPhone: 0,
        withEmail: 0,
        totalRevenue: 0,
        avgSpent: 0,
        readyForCampaign: 0
    };

    // Initialize source counts
    for (const source of CUSTOMER_SOURCES) {
        stats.bySource[source] = 0;
    }

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
        if (data.phone) {
            stats.withPhone++;
            stats.readyForCampaign++;
        }
        if (data.email) stats.withEmail++;

        // Revenue
        const spend = data.totalSpend || data.totalSpent || 0;
        if (spend) stats.totalRevenue += spend;
    });

    stats.avgSpent = stats.total > 0 ? Math.round(stats.totalRevenue / stats.total) : 0;

    return stats;
}

/**
 * Get customer segments for campaign targeting
 * @param {string} storeId
 * @param {string} segment - 'all', 'physical', 'online', 'high_value', 'inactive'
 * @returns {object} { count, customers }
 */
async function getCustomerSegment(storeId, segment = 'all') {
    const db = getDb();

    if (!storeId) throw new Error('Store ID is required');

    const customersRef = db.collection('stores').doc(storeId).collection('customers');
    let query = customersRef;

    switch (segment) {
        case 'physical':
            query = customersRef.where('source', '==', 'physical');
            break;
        case 'online':
            query = customersRef.where('source', '==', 'online');
            break;
        case 'high_value':
            query = customersRef.where('totalSpend', '>=', 500);
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
        if (data.phone) {
            customers.push({
                id: doc.id,
                name: data.name,
                phone: data.phone,
                email: data.email || '',
                source: data.source,
                totalSpend: data.totalSpend || data.totalSpent || 0,
                tags: data.tags || []
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

    // Preview & Detection
    previewImport,
    autoDetectColumns,
    getMappingConfidence,

    // POS
    parsePOSData,

    // Utilities
    normalizePhone,
    parseCSV,
    parseCSVLine,
    mapColumns,
    mergeCustomerData,

    // Constants
    CUSTOMER_SOURCES,
    COLUMN_PATTERNS
};
