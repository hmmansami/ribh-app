/**
 * ANALYTICS ENGINE
 * 
 * Track all events and calculate real metrics:
 * - Open rates
 * - Click rates  
 * - Conversion rates
 * - Revenue per channel
 */

const fs = require('fs');
const path = require('path');

const ANALYTICS_FILE = path.join(__dirname, '..', 'data', 'analytics.json');

if (!fs.existsSync(ANALYTICS_FILE)) {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ events: [], summary: {} }));
}

function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return { events: [], summary: {} }; }
}

function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Track an event
 */
function trackEvent(type, data) {
    const analytics = readJSON(ANALYTICS_FILE);

    const event = {
        id: Date.now().toString(),
        type: type,
        data: data,
        timestamp: new Date().toISOString()
    };

    analytics.events.push(event);

    // Keep last 10000 events
    if (analytics.events.length > 10000) {
        analytics.events.splice(0, analytics.events.length - 10000);
    }

    writeJSON(ANALYTICS_FILE, analytics);
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
function getStoreAnalytics(storeId, days = 30) {
    const analytics = readJSON(ANALYTICS_FILE);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = analytics.events.filter(e =>
        e.data?.storeId === storeId &&
        new Date(e.timestamp) > cutoff
    );

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
            const revenue = event.data.revenue || 0;
            metrics.revenue.total += revenue;

            const channel = event.data.type || 'cart_recovery';
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
function getGlobalSummary(days = 30) {
    const analytics = readJSON(ANALYTICS_FILE);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = analytics.events.filter(e => new Date(e.timestamp) > cutoff);

    return {
        totalEvents: events.length,
        emailsSent: events.filter(e => e.type === 'email_sent').length,
        conversions: events.filter(e => e.type === 'conversion').length,
        totalRevenue: events
            .filter(e => e.type === 'conversion' || e.type === 'cart_recovered')
            .reduce((sum, e) => sum + (e.data.revenue || 0), 0)
    };
}

/**
 * Get revenue by day (for charts)
 */
function getRevenueByDay(storeId, days = 7) {
    const analytics = readJSON(ANALYTICS_FILE);
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayRevenue = analytics.events
            .filter(e =>
                e.data?.storeId === storeId &&
                (e.type === 'conversion' || e.type === 'cart_recovered') &&
                new Date(e.timestamp) >= date &&
                new Date(e.timestamp) < nextDate
            )
            .reduce((sum, e) => sum + (e.data.revenue || 0), 0);

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
