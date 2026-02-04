/**
 * Salla Store Scraper - RIBH Lead Generation
 *
 * Discovers and scrapes Salla e-commerce stores to build a lead list
 * for outreach. Extracts store name, category, contact info (phone, email,
 * WhatsApp, social links) from store pages and contact/about pages.
 *
 * Features:
 *   - Google search query generation for Salla store discovery
 *   - URL parsing for Salla store slugs
 *   - HTML scraping with contact info extraction (Saudi phone, email, social)
 *   - Batch processing with rate limiting (max 5 req/sec)
 *   - Exponential backoff on failures
 *   - Firestore lead storage with deduplication by store URL
 *   - Lead status tracking: new -> contacted -> replied -> interested -> converted
 *
 * Firestore structure:
 *   leads/{leadId}
 *
 * Dependencies:
 *   - axios (HTTP requests)
 *   - firebase-admin (Firestore)
 */

const admin = require('firebase-admin');
const axios = require('axios');

function getDb() {
    if (!admin.apps.length) admin.initializeApp();
    return admin.firestore();
}

// ==========================================
// CONSTANTS
// ==========================================

const LEADS_COLLECTION = 'leads';

const VALID_STATUSES = ['new', 'contacted', 'replied', 'interested', 'converted', 'not_interested'];

const STORE_CATEGORIES = [
    'fashion', 'electronics', 'beauty', 'food', 'home',
    'health', 'kids', 'gifts', 'jewelry', 'sports', 'other'
];

/**
 * Arabic category names for display
 */
const CATEGORY_NAMES = {
    fashion: 'أزياء وملابس',
    electronics: 'إلكترونيات',
    beauty: 'عناية وجمال',
    food: 'أغذية ومشروبات',
    home: 'منزل وأثاث',
    health: 'صحة ولياقة',
    kids: 'أطفال وألعاب',
    gifts: 'هدايا وتغليف',
    jewelry: 'مجوهرات وإكسسوارات',
    sports: 'رياضة',
    other: 'أخرى'
};

/**
 * Contact page paths to check on Salla stores
 */
const CONTACT_PATHS = ['/contact', '/about', '/pages/about', '/pages/contact-us', '/pages/about-us'];

// ==========================================
// STORE DISCOVERY
// ==========================================

/**
 * Generate Google search queries to discover Salla stores by category
 * @param {string} category - Store category (fashion, electronics, etc.)
 * @returns {string[]} Array of search query strings
 */
function buildSearchQueries(category) {
    const categoryName = CATEGORY_NAMES[category] || category;

    const queries = [
        `site:salla.sa ${categoryName}`,
        `site:salla.sa ${category}`,
        `"powered by salla" ${categoryName}`,
        `"مدعوم من سلة" ${categoryName}`,
        `site:salla.sa متجر ${categoryName}`,
        `inurl:salla.sa ${category} store`,
        `"salla.sa" ${categoryName} متجر`,
        `site:salla.sa ${categoryName} السعودية`,
        `"متجر سلة" ${categoryName}`,
        `site:salla.sa shop ${category}`
    ];

    return queries;
}

/**
 * Parse a Salla store URL to extract the store slug/name
 * @param {string} url - Full Salla URL (e.g., https://store-name.salla.sa)
 * @returns {{ slug: string, fullUrl: string } | null}
 */
function parseStoreFromUrl(url) {
    if (!url || typeof url !== 'string') return null;

    // Clean the URL
    let cleaned = url.trim().toLowerCase();
    if (!cleaned.startsWith('http')) {
        cleaned = 'https://' + cleaned;
    }

    try {
        const parsed = new URL(cleaned);
        const hostname = parsed.hostname;

        // Pattern: store-name.salla.sa
        const sallaMatch = hostname.match(/^([a-z0-9\-]+)\.salla\.sa$/);
        if (sallaMatch) {
            return {
                slug: sallaMatch[1],
                fullUrl: `https://${sallaMatch[1]}.salla.sa`
            };
        }

        // Pattern: salla.sa/store-name
        if (hostname === 'salla.sa' || hostname === 'www.salla.sa') {
            const pathParts = parsed.pathname.split('/').filter(Boolean);
            if (pathParts.length > 0) {
                return {
                    slug: pathParts[0],
                    fullUrl: `https://salla.sa/${pathParts[0]}`
                };
            }
        }

        return null;
    } catch (e) {
        return null;
    }
}

// ==========================================
// CONTACT INFO EXTRACTION
// ==========================================

/**
 * Extract contact info (Saudi phones, emails, social links) from raw HTML
 * @param {string} html - Raw HTML content
 * @returns {{ phones: string[], emails: string[], whatsapp: string, socialLinks: object }}
 */
function extractContactInfo(html) {
    if (!html || typeof html !== 'string') {
        return { phones: [], emails: [], whatsapp: '', socialLinks: {} };
    }

    const result = {
        phones: [],
        emails: [],
        whatsapp: '',
        socialLinks: {}
    };

    // ---- Phone Numbers (Saudi) ----
    // Matches: 05XXXXXXXX, +9665XXXXXXXX, 009665XXXXXXXX, 9665XXXXXXXX, 5XXXXXXXX
    const phonePatterns = [
        /(?:\+?966|00966|0)5\d{8}/g,                    // +9665x, 009665x, 05x
        /(?<!\d)5\d{8}(?!\d)/g,                          // 5XXXXXXXX standalone
        /\+966\s*5\d[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{3}/g // +966 5X XX XX XXX
    ];

    const seenPhones = new Set();
    for (const pattern of phonePatterns) {
        const matches = html.match(pattern) || [];
        for (const match of matches) {
            const normalized = normalizePhone(match);
            if (normalized && !seenPhones.has(normalized)) {
                seenPhones.add(normalized);
                result.phones.push(normalized);
            }
        }
    }

    // ---- Email Addresses ----
    const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = html.match(emailPattern) || [];
    const seenEmails = new Set();
    for (const email of emailMatches) {
        const normalized = email.toLowerCase().trim();
        // Filter out common non-contact emails
        if (!normalized.includes('example.com') &&
            !normalized.includes('salla.sa') &&
            !normalized.includes('noreply') &&
            !normalized.includes('no-reply') &&
            !seenEmails.has(normalized)) {
            seenEmails.add(normalized);
            result.emails.push(normalized);
        }
    }

    // ---- WhatsApp Link ----
    const waPatterns = [
        /wa\.me\/(\+?\d+)/i,
        /api\.whatsapp\.com\/send\?phone=(\+?\d+)/i,
        /whatsapp\.com\/send\?phone=(\+?\d+)/i,
        /whatsapp[:\s]*(\+?[\d\s\-]+)/i
    ];
    for (const pattern of waPatterns) {
        const waMatch = html.match(pattern);
        if (waMatch) {
            const waPhone = normalizePhone(waMatch[1]);
            if (waPhone) {
                result.whatsapp = waPhone;
                break;
            }
        }
    }

    // ---- Social Links ----
    const socialPatterns = {
        twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i,
        instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/i,
        snapchat: /snapchat\.com\/add\/([a-zA-Z0-9_.]+)/i,
        tiktok: /tiktok\.com\/@([a-zA-Z0-9_.]+)/i,
        facebook: /facebook\.com\/([a-zA-Z0-9_.]+)/i
    };

    for (const [platform, pattern] of Object.entries(socialPatterns)) {
        const match = html.match(pattern);
        if (match) {
            result.socialLinks[platform] = match[1];
        }
    }

    return result;
}

/**
 * Normalize Saudi phone number to international format (+966XXXXXXXXX)
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
// STORE SCRAPING
// ==========================================

/**
 * Scrape a Salla store page and extract store info + contact details
 * @param {string} storeUrl - Full store URL
 * @param {object} [options] - { timeout: ms, headers: {} }
 * @returns {object} Scraped store data
 */
async function scrapeStorePage(storeUrl, options = {}) {
    const timeout = options.timeout || 10000;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        ...options.headers
    };

    const result = {
        storeUrl,
        storeName: '',
        storeSlug: '',
        category: 'other',
        phone: '',
        email: '',
        whatsapp: '',
        socialLinks: {},
        city: '',
        contactSource: '',
        estimatedSize: 'small',
        success: false,
        error: null
    };

    try {
        const response = await axios.get(storeUrl, {
            timeout,
            headers,
            maxRedirects: 3,
            validateStatus: (status) => status < 400
        });

        const html = response.data;
        if (typeof html !== 'string') {
            result.error = 'Response is not HTML';
            return result;
        }

        // Extract store name from title tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            result.storeName = titleMatch[1].trim()
                .replace(/\s*[-|]\s*سلة.*$/i, '')
                .replace(/\s*[-|]\s*Salla.*$/i, '')
                .trim();
        }

        // Extract slug from URL
        const parsed = parseStoreFromUrl(storeUrl);
        if (parsed) {
            result.storeSlug = parsed.slug;
        }

        // Extract contact info from main page
        const contacts = extractContactInfo(html);
        if (contacts.phones.length > 0) {
            result.phone = contacts.phones[0];
            result.contactSource = 'homepage';
        }
        if (contacts.emails.length > 0) {
            result.email = contacts.emails[0];
            if (!result.contactSource) result.contactSource = 'homepage';
        }
        if (contacts.whatsapp) {
            result.whatsapp = contacts.whatsapp;
            if (!result.contactSource) result.contactSource = 'homepage';
        }
        result.socialLinks = contacts.socialLinks;

        // Try to detect category from page content
        result.category = detectCategory(html);

        // Try to detect city
        result.city = detectCity(html);

        // Estimate store size based on page indicators
        result.estimatedSize = estimateStoreSize(html);

        result.success = true;
    } catch (error) {
        result.error = error.message;
        if (error.response) {
            result.error = `HTTP ${error.response.status}: ${error.message}`;
        }
    }

    return result;
}

/**
 * Check contact/about pages for additional contact info
 * @param {string} storeUrl - Base store URL
 * @param {object} [options] - Request options
 * @returns {object} Additional contact info found
 */
async function scrapeStoreContactPage(storeUrl, options = {}) {
    const timeout = options.timeout || 8000;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
        ...options.headers
    };

    const result = {
        phone: '',
        email: '',
        whatsapp: '',
        socialLinks: {},
        contactSource: '',
        pagesChecked: []
    };

    // Clean base URL
    let baseUrl = storeUrl.replace(/\/+$/, '');

    for (const pagePath of CONTACT_PATHS) {
        const pageUrl = baseUrl + pagePath;
        try {
            const response = await axios.get(pageUrl, {
                timeout,
                headers,
                maxRedirects: 3,
                validateStatus: (status) => status < 400
            });

            const html = response.data;
            if (typeof html !== 'string') continue;

            result.pagesChecked.push(pagePath);

            const contacts = extractContactInfo(html);

            // Update result with newly found info
            if (!result.phone && contacts.phones.length > 0) {
                result.phone = contacts.phones[0];
                result.contactSource = pagePath.replace('/', '');
            }
            if (!result.email && contacts.emails.length > 0) {
                result.email = contacts.emails[0];
                if (!result.contactSource) result.contactSource = pagePath.replace('/', '');
            }
            if (!result.whatsapp && contacts.whatsapp) {
                result.whatsapp = contacts.whatsapp;
                if (!result.contactSource) result.contactSource = pagePath.replace('/', '');
            }

            // Merge social links
            result.socialLinks = { ...result.socialLinks, ...contacts.socialLinks };

            // If we have phone + email, stop checking more pages
            if (result.phone && result.email) break;

        } catch (e) {
            // Page not found or error - continue to next path
            continue;
        }
    }

    return result;
}

// ==========================================
// CONTENT DETECTION HELPERS
// ==========================================

/**
 * Detect store category from HTML content using keyword matching
 * @param {string} html
 * @returns {string} Detected category
 */
function detectCategory(html) {
    const lowerHtml = html.toLowerCase();

    const categoryKeywords = {
        fashion: ['ملابس', 'أزياء', 'فاشن', 'fashion', 'clothing', 'عبايات', 'فساتين', 'ثوب', 'حجاب', 'dress', 'shoes', 'أحذية'],
        electronics: ['إلكتروني', 'جوال', 'لابتوب', 'كمبيوتر', 'electronic', 'phone', 'laptop', 'شاشة', 'سماعات'],
        beauty: ['تجميل', 'مكياج', 'عطر', 'عناية', 'بشرة', 'beauty', 'makeup', 'perfume', 'skincare', 'عطور'],
        food: ['طعام', 'قهوة', 'شوكولاتة', 'حلويات', 'coffee', 'food', 'chocolate', 'تمور', 'عسل', 'مأكولات'],
        home: ['أثاث', 'منزل', 'ديكور', 'مطبخ', 'furniture', 'home', 'kitchen', 'decor', 'سرير', 'مفروشات'],
        health: ['صحة', 'لياقة', 'مكملات', 'رياضة', 'health', 'fitness', 'gym', 'بروتين', 'فيتامين'],
        kids: ['أطفال', 'ألعاب', 'مواليد', 'kids', 'baby', 'toys', 'children', 'طفل', 'رضيع'],
        gifts: ['هدايا', 'تغليف', 'gift', 'حفلات', 'تذكار', 'ورد', 'زهور', 'flowers'],
        jewelry: ['مجوهرات', 'ذهب', 'فضة', 'إكسسوارات', 'jewelry', 'gold', 'silver', 'ساعات', 'watches']
    };

    let bestCategory = 'other';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        let score = 0;
        for (const keyword of keywords) {
            const regex = new RegExp(keyword, 'gi');
            const matches = lowerHtml.match(regex);
            if (matches) {
                score += matches.length;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    return bestCategory;
}

/**
 * Detect city from HTML content
 * @param {string} html
 * @returns {string} Detected city or empty
 */
function detectCity(html) {
    const cities = {
        'الرياض': 'الرياض',
        'جدة': 'جدة',
        'الدمام': 'الدمام',
        'مكة': 'مكة',
        'المدينة': 'المدينة',
        'الخبر': 'الخبر',
        'الطائف': 'الطائف',
        'تبوك': 'تبوك',
        'بريدة': 'بريدة',
        'خميس مشيط': 'خميس مشيط',
        'أبها': 'أبها',
        'حائل': 'حائل',
        'نجران': 'نجران',
        'جازان': 'جازان',
        'ينبع': 'ينبع',
        'riyadh': 'الرياض',
        'jeddah': 'جدة',
        'dammam': 'الدمام',
        'makkah': 'مكة',
        'madinah': 'المدينة'
    };

    for (const [keyword, cityName] of Object.entries(cities)) {
        if (html.includes(keyword)) {
            return cityName;
        }
    }

    return '';
}

/**
 * Estimate store size based on page indicators
 * @param {string} html
 * @returns {string} 'small', 'medium', or 'large'
 */
function estimateStoreSize(html) {
    let score = 0;

    // Check for indicators of larger stores
    if (html.includes('instagram') || html.includes('twitter') || html.includes('snapchat')) score += 1;
    if (html.includes('تطبيق') || html.includes('app')) score += 2;         // Has app
    if (html.includes('فروع') || html.includes('branches')) score += 2;     // Has branches
    if (html.includes('الدعم') || html.includes('support')) score += 1;
    if (html.includes('سياسة الاسترجاع') || html.includes('return policy')) score += 1;

    // Product count hints
    const productCountMatch = html.match(/(\d+)\s*(?:منتج|product)/i);
    if (productCountMatch) {
        const count = parseInt(productCountMatch[1], 10);
        if (count > 500) score += 3;
        else if (count > 100) score += 2;
        else if (count > 20) score += 1;
    }

    if (score >= 5) return 'large';
    if (score >= 2) return 'medium';
    return 'small';
}

// ==========================================
// BATCH PROCESSING
// ==========================================

/**
 * Process a list of URLs with rate limiting
 * @param {string[]} urls - List of store URLs to scrape
 * @param {object} [options] - { maxRPS: 5, scrapeContactPages: true, timeout: 10000 }
 * @returns {object} Job result with stats and leads
 */
async function startScrapeJob(urls, options = {}) {
    const maxRPS = options.maxRPS || 5;
    const scrapeContactPages = options.scrapeContactPages !== false;
    const delayMs = Math.ceil(1000 / maxRPS);

    const stats = {
        total: urls.length,
        processed: 0,
        found: 0,
        errors: 0,
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    const results = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        try {
            // Scrape main page
            const storeData = await scrapeStorePage(url, { timeout: options.timeout });

            // If no contact found on main page, check contact pages
            if (scrapeContactPages && (!storeData.phone || !storeData.email)) {
                const contactData = await scrapeStoreContactPage(url, { timeout: options.timeout });

                if (!storeData.phone && contactData.phone) {
                    storeData.phone = contactData.phone;
                    storeData.contactSource = contactData.contactSource;
                }
                if (!storeData.email && contactData.email) {
                    storeData.email = contactData.email;
                    if (!storeData.contactSource) storeData.contactSource = contactData.contactSource;
                }
                if (!storeData.whatsapp && contactData.whatsapp) {
                    storeData.whatsapp = contactData.whatsapp;
                }
                storeData.socialLinks = { ...storeData.socialLinks, ...contactData.socialLinks };
            }

            results.push(storeData);
            stats.processed++;

            if (storeData.success && (storeData.phone || storeData.email)) {
                stats.found++;
            }
        } catch (error) {
            stats.errors++;
            stats.processed++;
            results.push({
                storeUrl: url,
                success: false,
                error: error.message
            });
        }

        // Rate limiting delay
        if (i < urls.length - 1) {
            await sleep(delayMs);
        }
    }

    stats.completedAt = new Date().toISOString();

    return { stats, results };
}

/**
 * Process URLs in batches with progress tracking
 * @param {string[]} urls - All URLs to process
 * @param {number} [batchSize=50] - URLs per batch
 * @param {object} [options] - Scraping options
 * @returns {object} Combined results
 */
async function processBatch(urls, batchSize = 50, options = {}) {
    const totalBatches = Math.ceil(urls.length / batchSize);
    const allResults = [];
    const combinedStats = {
        total: urls.length,
        processed: 0,
        found: 0,
        errors: 0,
        batches: totalBatches,
        batchesCompleted: 0,
        startedAt: new Date().toISOString(),
        completedAt: null
    };

    for (let b = 0; b < totalBatches; b++) {
        const start = b * batchSize;
        const end = Math.min(start + batchSize, urls.length);
        const batchUrls = urls.slice(start, end);

        console.log(`[SallaScraper] Processing batch ${b + 1}/${totalBatches} (${batchUrls.length} URLs)`);

        const batchResult = await startScrapeJob(batchUrls, options);

        allResults.push(...batchResult.results);
        combinedStats.processed += batchResult.stats.processed;
        combinedStats.found += batchResult.stats.found;
        combinedStats.errors += batchResult.stats.errors;
        combinedStats.batchesCompleted++;

        // Pause between batches to avoid overloading
        if (b < totalBatches - 1) {
            await sleep(2000);
        }
    }

    combinedStats.completedAt = new Date().toISOString();

    return { stats: combinedStats, results: allResults };
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} [maxRetries=3] - Max retry attempts
 * @param {number} [baseDelay=1000] - Base delay in ms
 * @returns {*} Function result
 */
async function withBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
                console.log(`[SallaScraper] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}

// ==========================================
// LEAD STORAGE (Firestore)
// ==========================================

/**
 * Save a lead to Firestore with deduplication by store URL
 * @param {object} leadData - Lead data matching the schema
 * @returns {{ leadId: string, isNew: boolean, lead: object }}
 */
async function saveLead(leadData) {
    const db = getDb();

    if (!leadData.storeUrl) {
        throw new Error('storeUrl is required');
    }

    // Normalize the URL for dedup
    const normalizedUrl = leadData.storeUrl.toLowerCase().replace(/\/+$/, '');

    // Check for existing lead with same store URL
    const existingSnap = await db.collection(LEADS_COLLECTION)
        .where('storeUrl', '==', normalizedUrl)
        .limit(1)
        .get();

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!existingSnap.empty) {
        // Update existing lead with new info (merge, don't overwrite)
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();

        const updates = {};
        if (leadData.phone && !existingData.phone) updates.phone = leadData.phone;
        if (leadData.email && !existingData.email) updates.email = leadData.email;
        if (leadData.whatsapp && !existingData.whatsapp) updates.whatsapp = leadData.whatsapp;
        if (leadData.storeName && !existingData.storeName) updates.storeName = leadData.storeName;
        if (leadData.category && existingData.category === 'other') updates.category = leadData.category;
        if (leadData.city && !existingData.city) updates.city = leadData.city;

        // Merge social links
        if (leadData.socialLinks && Object.keys(leadData.socialLinks).length > 0) {
            updates.socialLinks = { ...(existingData.socialLinks || {}), ...leadData.socialLinks };
        }

        if (Object.keys(updates).length > 0) {
            updates.updatedAt = now;
            await existingDoc.ref.update(updates);
        }

        return {
            leadId: existingDoc.id,
            isNew: false,
            lead: { id: existingDoc.id, ...existingData, ...updates }
        };
    }

    // Create new lead
    const lead = {
        storeName: leadData.storeName || '',
        storeUrl: normalizedUrl,
        storeSlug: leadData.storeSlug || '',
        category: leadData.category || 'other',
        phone: leadData.phone || '',
        email: leadData.email || '',
        whatsapp: leadData.whatsapp || '',
        socialLinks: leadData.socialLinks || {},
        estimatedSize: leadData.estimatedSize || 'small',
        city: leadData.city || '',
        contactSource: leadData.contactSource || '',
        status: 'new',
        scrapedAt: now,
        contactedAt: null,
        lastOutreachAt: null,
        outreachCount: 0,
        notes: leadData.notes || '',
        createdAt: now,
        updatedAt: now
    };

    const ref = await db.collection(LEADS_COLLECTION).add(lead);
    console.log(`[SallaScraper] New lead saved: ${lead.storeName || lead.storeUrl} (${ref.id})`);

    return {
        leadId: ref.id,
        isNew: true,
        lead: { id: ref.id, ...lead }
    };
}

/**
 * Get leads with optional filters
 * @param {object} [filters] - { status, category, hasPhone, hasEmail, limit }
 * @returns {object[]} Array of lead objects
 */
async function getLeads(filters = {}) {
    const db = getDb();
    let query = db.collection(LEADS_COLLECTION);

    if (filters.status) {
        query = query.where('status', '==', filters.status);
    }
    if (filters.category) {
        query = query.where('category', '==', filters.category);
    }

    const limit = filters.limit || 100;
    query = query.orderBy('createdAt', 'desc').limit(limit);

    const snap = await query.get();
    let leads = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Client-side filters (Firestore doesn't support != or checking non-empty strings)
    if (filters.hasPhone) {
        leads = leads.filter(l => !!l.phone);
    }
    if (filters.hasEmail) {
        leads = leads.filter(l => !!l.email);
    }

    return leads;
}

/**
 * Update a lead's status
 * @param {string} leadId - Firestore document ID
 * @param {string} status - New status
 * @param {string} [notes] - Optional notes to append
 * @returns {object} Updated lead
 */
async function updateLeadStatus(leadId, status, notes) {
    const db = getDb();

    if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const leadRef = db.collection(LEADS_COLLECTION).doc(leadId);
    const leadDoc = await leadRef.get();

    if (!leadDoc.exists) {
        throw new Error('Lead not found: ' + leadId);
    }

    const updates = {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status === 'contacted') {
        updates.contactedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.lastOutreachAt = admin.firestore.FieldValue.serverTimestamp();
        updates.outreachCount = admin.firestore.FieldValue.increment(1);
    }

    if (notes) {
        const existing = leadDoc.data().notes || '';
        updates.notes = existing ? `${existing}\n${notes}` : notes;
    }

    await leadRef.update(updates);

    return { leadId, status, ...updates };
}

/**
 * Get lead counts by status for dashboard
 * @returns {object} { total, new, contacted, replied, interested, converted, not_interested }
 */
async function getLeadStats() {
    const db = getDb();
    const snap = await db.collection(LEADS_COLLECTION).get();

    const stats = {
        total: snap.size,
        new: 0,
        contacted: 0,
        replied: 0,
        interested: 0,
        converted: 0,
        not_interested: 0,
        withPhone: 0,
        withEmail: 0,
        withWhatsApp: 0,
        byCategory: {}
    };

    snap.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'new';
        if (stats.hasOwnProperty(status)) {
            stats[status]++;
        }

        if (data.phone) stats.withPhone++;
        if (data.email) stats.withEmail++;
        if (data.whatsapp) stats.withWhatsApp++;

        const cat = data.category || 'other';
        stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    return stats;
}

// ==========================================
// UTILITY
// ==========================================

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Discovery
    buildSearchQueries,
    parseStoreFromUrl,

    // Scraping
    scrapeStorePage,
    scrapeStoreContactPage,
    extractContactInfo,

    // Detection helpers
    detectCategory,
    detectCity,
    estimateStoreSize,

    // Batch Processing
    startScrapeJob,
    processBatch,
    withBackoff,

    // Lead Storage
    saveLead,
    getLeads,
    updateLeadStatus,
    getLeadStats,

    // Utilities
    normalizePhone,
    sleep,

    // Constants
    LEADS_COLLECTION,
    VALID_STATUSES,
    STORE_CATEGORIES,
    CATEGORY_NAMES,
    CONTACT_PATHS
};
