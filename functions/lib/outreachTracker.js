/**
 * WhatsApp Outreach Tracker for RIBH
 * Tracks manual WhatsApp outreach and A/B test conversions
 * 
 * A/B Groups:
 * - A = 10% discount offer
 * - B = 30% discount offer
 */

const admin = require('firebase-admin');

// Initialize Firestore (assumes admin already initialized)
const db = admin.firestore();
const COLLECTION = 'outreach';

/**
 * Normalize Saudi phone number to international format
 */
function normalizePhone(phone) {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    
    // Handle various Saudi formats
    if (cleaned.startsWith('966')) {
        return '+' + cleaned;
    } else if (cleaned.startsWith('05')) {
        return '+966' + cleaned.substring(1);
    } else if (cleaned.startsWith('5') && cleaned.length === 9) {
        return '+966' + cleaned;
    } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
        return '+966' + cleaned.substring(1);
    }
    
    // Return as-is if not Saudi format
    return phone.startsWith('+') ? phone : '+' + cleaned;
}

/**
 * Log a new outreach message
 */
async function logOutreach({ phone, message, abGroup, notes }) {
    const normalizedPhone = normalizePhone(phone);
    
    if (!normalizedPhone) {
        throw new Error('Invalid phone number');
    }
    
    if (!['A', 'B'].includes(abGroup)) {
        throw new Error('abGroup must be "A" (10% discount) or "B" (30% discount)');
    }
    
    const doc = {
        phone: normalizedPhone,
        phoneRaw: phone,
        message: message || '',
        abGroup: abGroup,
        discount: abGroup === 'A' ? 10 : 30,
        notes: notes || '',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        converted: false,
        convertedAt: null,
        conversionNotes: ''
    };
    
    // Use phone as document ID for easy lookup
    const docId = normalizedPhone.replace(/\+/g, '');
    
    // Check if already exists
    const existing = await db.collection(COLLECTION).doc(docId).get();
    if (existing.exists) {
        // Update with new message but preserve conversion status
        const existingData = existing.data();
        doc.converted = existingData.converted;
        doc.convertedAt = existingData.convertedAt;
        doc.conversionNotes = existingData.conversionNotes;
        doc.previousMessages = existingData.previousMessages || [];
        doc.previousMessages.push({
            message: existingData.message,
            timestamp: existingData.timestamp,
            abGroup: existingData.abGroup
        });
    }
    
    await db.collection(COLLECTION).doc(docId).set(doc, { merge: true });
    
    console.log(`📱 Outreach logged: ${normalizedPhone} (Group ${abGroup})`);
    
    return {
        success: true,
        phone: normalizedPhone,
        abGroup,
        discount: doc.discount,
        isUpdate: existing?.exists || false
    };
}

/**
 * Mark a contact as converted
 */
async function markConverted(phone, notes = '') {
    const normalizedPhone = normalizePhone(phone);
    const docId = normalizedPhone.replace(/\+/g, '');
    
    const docRef = db.collection(COLLECTION).doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
        throw new Error('Contact not found');
    }
    
    await docRef.update({
        converted: true,
        convertedAt: admin.firestore.FieldValue.serverTimestamp(),
        conversionNotes: notes
    });
    
    console.log(`✅ Conversion marked: ${normalizedPhone}`);
    
    return {
        success: true,
        phone: normalizedPhone,
        abGroup: doc.data().abGroup
    };
}

/**
 * Unmark conversion (for corrections)
 */
async function unmarkConverted(phone) {
    const normalizedPhone = normalizePhone(phone);
    const docId = normalizedPhone.replace(/\+/g, '');
    
    const docRef = db.collection(COLLECTION).doc(docId);
    
    await docRef.update({
        converted: false,
        convertedAt: null,
        conversionNotes: ''
    });
    
    return { success: true, phone: normalizedPhone };
}

/**
 * Get all outreach contacts
 */
async function getAll(options = {}) {
    const { limit = 100, abGroup, convertedOnly } = options;
    
    let query = db.collection(COLLECTION).orderBy('timestamp', 'desc');
    
    if (abGroup) {
        query = query.where('abGroup', '==', abGroup);
    }
    
    if (convertedOnly) {
        query = query.where('converted', '==', true);
    }
    
    query = query.limit(limit);
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
        convertedAt: doc.data().convertedAt?.toDate?.() || doc.data().convertedAt
    }));
}

/**
 * Get stats for A/B testing
 */
async function getStats() {
    const snapshot = await db.collection(COLLECTION).get();
    
    const stats = {
        total: 0,
        groupA: { sent: 0, converted: 0, rate: 0 },
        groupB: { sent: 0, converted: 0, rate: 0 }
    };
    
    snapshot.forEach(doc => {
        const data = doc.data();
        stats.total++;
        
        if (data.abGroup === 'A') {
            stats.groupA.sent++;
            if (data.converted) stats.groupA.converted++;
        } else if (data.abGroup === 'B') {
            stats.groupB.sent++;
            if (data.converted) stats.groupB.converted++;
        }
    });
    
    // Calculate conversion rates
    stats.groupA.rate = stats.groupA.sent > 0 
        ? Math.round((stats.groupA.converted / stats.groupA.sent) * 100 * 10) / 10 
        : 0;
    stats.groupB.rate = stats.groupB.sent > 0 
        ? Math.round((stats.groupB.converted / stats.groupB.sent) * 100 * 10) / 10 
        : 0;
    
    // Determine winner
    if (stats.groupA.sent >= 5 && stats.groupB.sent >= 5) {
        if (stats.groupA.rate > stats.groupB.rate + 5) {
            stats.winner = 'A';
            stats.insight = `Group A (10% discount) performing ${Math.round(stats.groupA.rate - stats.groupB.rate)}% better`;
        } else if (stats.groupB.rate > stats.groupA.rate + 5) {
            stats.winner = 'B';
            stats.insight = `Group B (30% discount) performing ${Math.round(stats.groupB.rate - stats.groupA.rate)}% better`;
        } else {
            stats.winner = 'tie';
            stats.insight = 'Both groups performing similarly - need more data';
        }
    } else {
        stats.winner = 'pending';
        stats.insight = `Need at least 5 contacts per group (A: ${stats.groupA.sent}/5, B: ${stats.groupB.sent}/5)`;
    }
    
    return stats;
}

/**
 * Delete a contact
 */
async function deleteContact(phone) {
    const normalizedPhone = normalizePhone(phone);
    const docId = normalizedPhone.replace(/\+/g, '');
    
    await db.collection(COLLECTION).doc(docId).delete();
    
    return { success: true, phone: normalizedPhone };
}

/**
 * Update notes for a contact
 */
async function updateNotes(phone, notes) {
    const normalizedPhone = normalizePhone(phone);
    const docId = normalizedPhone.replace(/\+/g, '');
    
    await db.collection(COLLECTION).doc(docId).update({ notes });
    
    return { success: true, phone: normalizedPhone };
}

module.exports = {
    logOutreach,
    markConverted,
    unmarkConverted,
    getAll,
    getStats,
    deleteContact,
    updateNotes,
    normalizePhone
};
