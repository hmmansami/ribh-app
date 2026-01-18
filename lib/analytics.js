/**
 * ANALYTICS ENGINE (Firestore Version)
 * 
 * Track all events and calculate real metrics:
 * - Open rates
 * - Click rates  
 * - Conversion rates
 * - Revenue per channel
 * 
 * Uses Firestore instead of file system (Firebase Cloud Functions are read-only)
 */

const admin = require('firebase-admin');

// Get Firestore reference (assumes admin is already initialized)
function getDb() {
    try {
        return admin.firestore();
    } catch (e) {
        console.warn('⚠️ Firestore not available for analytics');
        return null;
    }
}

const ANALYTICS_COLLECTION = 'analytics_events';

/**
 * Track an event
 */
async function trackEvent(type, data) {
    const db = getDb();

    const event = {
        id: Date.now().toString(),
        type: type,
        data: data,
        timestamp: new Date().toISOString()
    };

    // If Firestore is available, save to it
    if (db) {
        try {
            await db.collection(ANALYTICS_COLLECTION).add(event);
        } catch (e) {
            console.warn('⚠️ Could not save analytics event to Firestore:', e.message);
        }
    }

    // Log the event regardless
    console.log(`📊 Analytics: ${type}`, JSON.stringify(data).substring(0, 100));
    return event;
}

// Convenience functions
const track = {
    emailSent: (storeId, channel, type, email) =>
        trackEvent('email_sent', { storeId, channel, type, email }),

    emailOpened: (storeId, type, email) =>
        trackEvent('email_opened', { storeId, type, email }),

    emailClicked: (storeId, type, email) =>
        trackEvent('email_clicked', { storeId, type, email }),

    conversion: (storeId, type, email, revenue) =>
        trackEvent('conversion', { storeId, type, email, revenue }),

    referral: (storeId, referrerEmail, newCustomerEmail, revenue) =>
        trackEvent('referral', { storeId, referrerEmail, newCustomerEmail, revenue }),

    cartRecovered: (storeId, email, revenue) =>
        trackEvent('cart_recovered', { storeId, email, revenue })
};

/**
 * Get analytics for a store
 */
async function getStoreAnalytics(storeId, days = 30) {
    const db = getDb();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let events = [];

    if (db) {
        try {
            const snapshot = await db.collection(ANALYTICS_COLLECTION)
                .where('data.storeId', '==', storeId)
                .where('timestamp', '>=', cutoff.toISOString())
                .orderBy('timestamp', 'desc')
                .limit(1000)
                .get();

            events = snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.warn('⚠️ Could not fetch analytics from Firestore:', e.message);
            // Return empty metrics if Firestore query fails
        }
    }

    // Calculate metrics
    const metrics = {
        period: days,
        emails: {
            sent: events.filter(e => e.type === 'email_sent').length,
            opened: events.filter(e => e.type === 'email_opened').length,
            clicked: events.filter(e => e.type === 'email_clicked').length
        },
        conversions: events.filter(e => e.type === 'conversion').length,
        revenue: {
            total: 0,
            byChannel: {
                cart_recovery: 0,
                upsell: 0,
                referral: 0,
                winback: 0
            }
        }
    };

    // Calculate revenue by channel
    for (const event of events) {
        if (event.type === 'conversion' || event.type === 'cart_recovered') {
            const revenue = event.data?.revenue || 0;
            metrics.revenue.total += revenue;

            const channel = event.data?.type || 'cart_recovery';
            if (metrics.revenue.byChannel[channel] !== undefined) {
                metrics.revenue.byChannel[channel] += revenue;
            }
        }
    }

    // Calculate rates
    metrics.emails.openRate = metrics.emails.sent > 0
        ? ((metrics.emails.opened / metrics.emails.sent) * 100).toFixed(1) + '%'
        : '0%';
    metrics.emails.clickRate = metrics.emails.sent > 0
        ? ((metrics.emails.clicked / metrics.emails.sent) * 100).toFixed(1) + '%'
        : '0%';
    metrics.conversionRate = metrics.emails.sent > 0
        ? ((metrics.conversions / metrics.emails.sent) * 100).toFixed(1) + '%'
        : '0%';

    return metrics;
}

/**
 * Get summary for all stores
 */
async function getGlobalSummary(days = 30) {
    const db = getDb();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let events = [];

    if (db) {
        try {
            const snapshot = await db.collection(ANALYTICS_COLLECTION)
                .where('timestamp', '>=', cutoff.toISOString())
                .orderBy('timestamp', 'desc')
                .limit(5000)
                .get();

            events = snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.warn('⚠️ Could not fetch global analytics:', e.message);
        }
    }

    return {
        totalEvents: events.length,
        emailsSent: events.filter(e => e.type === 'email_sent').length,
        conversions: events.filter(e => e.type === 'conversion').length,
        totalRevenue: events
            .filter(e => e.type === 'conversion' || e.type === 'cart_recovered')
            .reduce((sum, e) => sum + (e.data?.revenue || 0), 0)
    };
}

/**
 * Get revenue by day (for charts)
 */
async function getRevenueByDay(storeId, days = 7) {
    const db = getDb();
    const result = [];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    let events = [];

    if (db) {
        try {
            const snapshot = await db.collection(ANALYTICS_COLLECTION)
                .where('data.storeId', '==', storeId)
                .where('timestamp', '>=', startDate.toISOString())
                .get();

            events = snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.warn('⚠️ Could not fetch revenue by day:', e.message);
        }
    }

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRevenue = events
            .filter(e =>
                (e.type === 'conversion' || e.type === 'cart_recovered') &&
                new Date(e.timestamp) >= date &&
                new Date(e.timestamp) < nextDate
            )
            .reduce((sum, e) => sum + (e.data?.revenue || 0), 0);

        result.push({
            date: date.toISOString().split('T')[0],
            revenue: dayRevenue
        });
    }

    return result;
}

module.exports = {
    trackEvent,
    track,
    getStoreAnalytics,
    getGlobalSummary,
    getRevenueByDay
};
