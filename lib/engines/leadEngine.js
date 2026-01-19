/**
 * RIBH LEAD ENGINE
 * Based on $100M Leads by Alex Hormozi
 * 
 * Purpose: More + Better + Cheaper ways to reach customers
 * 
 * Priority: WARM AUDIENCE FIRST
 * - They already know the store
 * - Higher conversion rate
 * - Lower cost to reach
 * 
 * Channels ranked by cost-effectiveness:
 * 1. Telegram (FREE unlimited)
 * 2. Email (FREE 3000/mo with Resend)
 * 3. SMS (Cheap $0.02/msg)
 * 4. WhatsApp (Needs Business API)
 */

// ==========================================
// CHANNEL CONFIGURATION
// ==========================================

const CHANNELS = {
    telegram: {
        name: 'Telegram',
        nameAr: 'تيليجرام',
        cost: 0,
        costPer: 0,
        priority: 1, // Highest priority (free!)
        maxLength: 4096,
        supportsMedia: true,
        icon: '✈️',
        pros: ['مجاني تماماً', 'لا قيود على الرسائل', 'يدعم الوسائط'],
        setup: 'requires_bot_token',
        enabled: false // Disabled by default until configured
    },

    email: {
        name: 'Email',
        nameAr: 'البريد الإلكتروني',
        cost: 0,
        costPer: 0, // Free with Resend up to 3000/mo
        freeLimit: 3000,
        priority: 2,
        maxLength: 50000,
        supportsMedia: true,
        supportsHTML: true,
        icon: '📧',
        pros: ['مجاني حتى 3000 رسالة/شهر', 'يدعم HTML والتصميم', 'رسمي وموثوق'],
        setup: 'requires_resend_key',
        enabled: true // Enabled by default
    },

    sms: {
        name: 'SMS',
        nameAr: 'رسالة نصية',
        cost: 0.02,
        costPer: 'message',
        currency: 'USD',
        priority: 3,
        maxLength: 160,
        supportsMedia: false,
        icon: '📱',
        pros: ['معدل فتح عالي جداً', 'فوري', 'لا يحتاج إنترنت'],
        setup: 'requires_aws_or_twilio',
        enabled: false
    },

    whatsapp: {
        name: 'WhatsApp',
        nameAr: 'واتساب',
        cost: 0.05,
        costPer: 'conversation',
        currency: 'USD',
        priority: 4,
        maxLength: 4096,
        supportsMedia: true,
        icon: '💬',
        pros: ['الأكثر استخداماً', 'تفاعل عالي', 'يدعم الوسائط'],
        setup: 'requires_business_api',
        enabled: false
    },

    push: {
        name: 'Push Notification',
        nameAr: 'إشعار',
        cost: 0,
        costPer: 0,
        priority: 5,
        maxLength: 200,
        supportsMedia: false,
        icon: '🔔',
        pros: ['مجاني', 'فوري', 'لا يحتاج بيانات العميل'],
        setup: 'requires_widget',
        enabled: false,
        comingSoon: true
    }
};

// ==========================================
// OPTIMAL SEND TIME ENGINE
// ==========================================

const SEND_TIME_CONFIG = {
    // Saudi Arabia timezone
    timezone: 'Asia/Riyadh',

    // Best hours by day type
    weekday: {
        morning: { start: 9, end: 11, weight: 0.7 },
        lunch: { start: 12, end: 14, weight: 0.5 },
        afternoon: { start: 15, end: 17, weight: 0.8 },
        evening: { start: 20, end: 23, weight: 1.0 } // Best time!
    },

    weekend: { // Thursday night + Friday in Saudi
        morning: { start: 10, end: 12, weight: 0.8 },
        afternoon: { start: 15, end: 18, weight: 0.9 },
        evening: { start: 21, end: 24, weight: 1.0 }
    },

    // Hours to AVOID
    avoidHours: [0, 1, 2, 3, 4, 5, 6, 7], // Late night / early morning

    // Special times during Ramadan
    ramadan: {
        preFajr: { start: 3, end: 5, weight: 0.5 }, // Suhoor
        postIftar: { start: 19, end: 22, weight: 1.0 }, // After iftar
        postTaraweeh: { start: 22, end: 24, weight: 0.9 }
    }
};

function calculateOptimalSendTime(customerData = {}, season = 'default') {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0 = Sunday

    // Check if weekend (Thursday evening or Friday in Saudi)
    const isWeekend = day === 5 || (day === 4 && hour >= 18);
    const timeConfig = isWeekend ? SEND_TIME_CONFIG.weekend : SEND_TIME_CONFIG.weekday;

    // Check if Ramadan (simplified check)
    const isRamadan = season === 'ramadan';

    // Find best slot
    let bestSlot = null;
    let highestWeight = 0;

    const slots = isRamadan ? SEND_TIME_CONFIG.ramadan : timeConfig;

    for (const [slotName, slot] of Object.entries(slots)) {
        if (slot.weight > highestWeight && hour < slot.start) {
            // This slot is in the future and has higher weight
            bestSlot = slot;
            highestWeight = slot.weight;
        }
    }

    // If no future slot found, schedule for tomorrow
    if (!bestSlot) {
        bestSlot = { start: 20, end: 22 }; // Default evening
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(bestSlot.start, 0, 0, 0);
        return tomorrow;
    }

    // Return optimal time
    const optimalTime = new Date(now);
    optimalTime.setHours(bestSlot.start, Math.floor(Math.random() * 30), 0, 0);

    return optimalTime;
}

// ==========================================
// CUSTOMER SEGMENTATION
// ==========================================

const CUSTOMER_SEGMENTS = {
    cart_abandoner: {
        name: 'تارك سلة',
        priority: 1, // Highest - closest to purchase
        channels: ['email', 'whatsapp', 'sms'],
        maxMessages: 3,
        delays: [1, 6, 24], // Hours between messages
        messageStyle: 'recovery'
    },

    browse_abandoner: {
        name: 'متصفح',
        priority: 2,
        channels: ['email', 'telegram'],
        maxMessages: 2,
        delays: [24, 72],
        messageStyle: 'nurture'
    },

    past_buyer: {
        name: 'عميل سابق',
        priority: 3,
        channels: ['email', 'telegram', 'whatsapp'],
        maxMessages: 2,
        delays: [168, 336], // 1 week, 2 weeks
        messageStyle: 'upsell'
    },

    inactive: {
        name: 'عميل غير نشط',
        priority: 4,
        channels: ['email'],
        maxMessages: 1,
        delays: [720], // 1 month
        messageStyle: 'winback'
    },

    vip: {
        name: 'عميل VIP',
        priority: 1, // Same as cart abandoner
        channels: ['whatsapp', 'email', 'sms'], // WhatsApp first for VIP
        maxMessages: 3,
        delays: [1, 4, 12], // More frequent for VIP
        messageStyle: 'exclusive'
    }
};

function segmentCustomer(customerData) {
    const { cartValue, hasCart, lastPurchase, totalPurchases } = customerData;

    // VIP check first
    if (cartValue >= 1000 || totalPurchases >= 5) {
        return CUSTOMER_SEGMENTS.vip;
    }

    // Cart abandoner
    if (hasCart && cartValue > 0) {
        return CUSTOMER_SEGMENTS.cart_abandoner;
    }

    // Past buyer (check for upsell)
    if (lastPurchase && totalPurchases > 0) {
        const daysSincePurchase = (Date.now() - new Date(lastPurchase).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePurchase > 30) {
            return CUSTOMER_SEGMENTS.inactive;
        }
        return CUSTOMER_SEGMENTS.past_buyer;
    }

    // Browser (viewed products but no cart)
    return CUSTOMER_SEGMENTS.browse_abandoner;
}

// ==========================================
// CHANNEL SELECTION ENGINE
// ==========================================

function selectBestChannel(customer, storeConfig = {}) {
    const segment = segmentCustomer(customer);
    const preferredChannels = segment.channels;

    // Filter by what's enabled and what customer has
    const availableChannels = preferredChannels.filter(channelKey => {
        const channel = CHANNELS[channelKey];
        if (!channel.enabled && !storeConfig[channelKey + 'Enabled']) return false;

        // Check if customer has required contact info
        if (channelKey === 'email' && !customer.email) return false;
        if (channelKey === 'sms' && !customer.phone) return false;
        if (channelKey === 'whatsapp' && !customer.phone) return false;
        if (channelKey === 'telegram' && !customer.telegramId) return false;

        return true;
    });

    // Return best available channel
    if (availableChannels.length > 0) {
        return {
            channel: availableChannels[0],
            config: CHANNELS[availableChannels[0]],
            alternatives: availableChannels.slice(1)
        };
    }

    // Fallback to email if nothing else available
    if (customer.email) {
        return {
            channel: 'email',
            config: CHANNELS.email,
            alternatives: []
        };
    }

    return null;
}

// ==========================================
// MESSAGE SEQUENCE ORCHESTRATOR
// ==========================================

function createMessageSequence(cart, customer, storeConfig = {}) {
    const segment = segmentCustomer({
        cartValue: cart.total,
        hasCart: true,
        ...customer
    });

    const sequence = [];
    const channelSelection = selectBestChannel(customer, storeConfig);

    if (!channelSelection) {
        return { error: 'No available channel for this customer', sequence: [] };
    }

    // Build sequence based on segment
    segment.delays.forEach((delayHours, index) => {
        const reminderNumber = index + 1;
        const sendTime = new Date(Date.now() + (delayHours * 60 * 60 * 1000));

        // Try different channels for each message
        const channelIndex = index % (channelSelection.alternatives.length + 1);
        const channels = [channelSelection.channel, ...channelSelection.alternatives];
        const channel = channels[channelIndex] || channelSelection.channel;

        sequence.push({
            id: `${cart.id}_${reminderNumber}`,
            reminderNumber,
            channel,
            scheduledFor: sendTime.toISOString(),
            delayHours,
            status: 'pending',
            segment: segment.name,
            messageStyle: segment.messageStyle,
            isLastReminder: reminderNumber === segment.delays.length
        });
    });

    return {
        cartId: cart.id,
        customerId: customer.id || customer.email,
        segment: segment.name,
        primaryChannel: channelSelection.channel,
        sequence,
        createdAt: new Date().toISOString()
    };
}

// ==========================================
// MULTI-CHANNEL DELIVERY COORDINATOR
// ==========================================

async function sendThroughChannel(channel, recipient, message, options = {}) {
    const channelConfig = CHANNELS[channel];

    if (!channelConfig) {
        throw new Error(`Unknown channel: ${channel}`);
    }

    // Truncate message if too long
    const truncatedMessage = message.length > channelConfig.maxLength
        ? message.substring(0, channelConfig.maxLength - 3) + '...'
        : message;

    const result = {
        channel,
        recipient,
        messageLength: truncatedMessage.length,
        timestamp: new Date().toISOString(),
        cost: channelConfig.costPer ? channelConfig.cost : 0
    };

    // Route to appropriate sender (implemented in separate files)
    switch (channel) {
        case 'email':
            result.handler = 'emailSender';
            break;
        case 'sms':
            result.handler = 'smsSender';
            break;
        case 'whatsapp':
            result.handler = 'whatsappSender';
            break;
        case 'telegram':
            result.handler = 'telegramSender';
            break;
        default:
            result.handler = 'unknown';
    }

    return result;
}

// ==========================================
// LEAD WARMING STRATEGIES
// ==========================================

const LEAD_WARMING_STRATEGIES = {
    // For cart abandoners - recover the sale
    recovery: {
        touchpoints: [
            { delay: 1, type: 'reminder', urgency: 'low' },
            { delay: 6, type: 'offer', urgency: 'medium' },
            { delay: 24, type: 'last_chance', urgency: 'high' }
        ],
        goal: 'complete_purchase'
    },

    // For browsers - nurture to cart
    nurture: {
        touchpoints: [
            { delay: 24, type: 'value_content', urgency: 'none' },
            { delay: 72, type: 'social_proof', urgency: 'low' },
            { delay: 168, type: 'special_offer', urgency: 'medium' }
        ],
        goal: 'add_to_cart'
    },

    // For past buyers - get repeat purchase
    upsell: {
        touchpoints: [
            { delay: 168, type: 'related_products', urgency: 'none' },
            { delay: 336, type: 'restock_reminder', urgency: 'low' }
        ],
        goal: 'repeat_purchase'
    },

    // For inactive - win them back
    winback: {
        touchpoints: [
            { delay: 720, type: 'miss_you', urgency: 'none' },
            { delay: 1440, type: 'exclusive_offer', urgency: 'medium' }
        ],
        goal: 'reactivation'
    }
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    // Core functions
    selectBestChannel,
    createMessageSequence,
    sendThroughChannel,

    // Customer segmentation
    segmentCustomer,
    CUSTOMER_SEGMENTS,

    // Timing
    calculateOptimalSendTime,
    SEND_TIME_CONFIG,

    // Channels
    CHANNELS,

    // Strategies
    LEAD_WARMING_STRATEGIES
};
