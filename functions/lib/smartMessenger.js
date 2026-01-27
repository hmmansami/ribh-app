/**
 * 🎯 RIBH Smart Messenger
 * 
 * Simple AI that detects:
 * 1. Store type → adjusts tone
 * 2. Customer type → adjusts approach
 * 3. Product interests → personalizes content
 * 4. Best timing → optimizes send time
 * 
 * Result: Right message for right person at right store at right time
 * 
 * NOT complicated. Just smart if-then + personalization.
 */

// ============================================================
// PERSONALIZATION TOOLS
// ============================================================

// Import personalization modules (graceful fallback if not available)
let productMemory, timingLearner, toneAdapter;
try {
  productMemory = require('./productMemory');
} catch (e) {
  productMemory = null;
}
try {
  timingLearner = require('./timingLearner');
} catch (e) {
  timingLearner = null;
}
try {
  toneAdapter = require('./toneAdapter');
} catch (e) {
  toneAdapter = null;
}

// ============================================================
// STORE TYPES - How should this store sound?
// ============================================================

const STORE_TYPES = {
  luxury: {
    tone: 'elegant',
    urgency: 'never',      // Never use urgency/scarcity
    discounts: 'rare',     // Discounts cheapen brand
    emojis: 'minimal',     // 1 max, sophisticated ones
    approach: 'relationship',
    example: 'نتمنى أن نكون قد نلنا رضاكم'
  },
  value: {
    tone: 'friendly',
    urgency: 'ok',         // Can use urgency
    discounts: 'welcome',  // Deals are expected
    emojis: 'moderate',    // 2-3, fun ones
    approach: 'helpful',
    example: 'وفّر 50 ريال على طلبك! 🎉'
  },
  niche: {
    tone: 'passionate',
    urgency: 'subtle',     // Community-based urgency
    discounts: 'member',   // Exclusive to community
    emojis: 'themed',      // Related to niche
    approach: 'community',
    example: 'كمحب للقهوة، هذا العرض لك ☕'
  },
  mainstream: {
    tone: 'balanced',
    urgency: 'moderate',
    discounts: 'strategic',
    emojis: 'moderate',
    approach: 'helpful',
    example: 'سلتك بانتظارك 🛒'
  },
  local: {
    tone: 'warm',
    urgency: 'gentle',
    discounts: 'personal',
    emojis: 'warm',
    approach: 'neighbor',
    example: 'هلا فيك! شفنا طلبك'
  }
};

// ============================================================
// CUSTOMER TYPES - What does this person need?
// ============================================================

const CUSTOMER_TYPES = {
  new_visitor: {
    trust: 'low',
    approach: 'introduce',   // Build trust first
    offers: 'avoid',         // Don't sell yet
    priority: 'help'
  },
  first_buyer: {
    trust: 'building',
    approach: 'welcome',     // Make them feel valued
    offers: 'gentle',        // Small incentive ok
    priority: 'experience'
  },
  returning: {
    trust: 'established',
    approach: 'familiar',    // They know you
    offers: 'relevant',      // Based on history
    priority: 'convenience'
  },
  vip: {
    trust: 'high',
    approach: 'exclusive',   // Make them feel special
    offers: 'premium',       // Best deals for best customers
    priority: 'recognition'
  },
  price_hunter: {
    trust: 'varies',
    approach: 'value',       // Show the value
    offers: 'expected',      // They want deals
    priority: 'savings'
  },
  browser: {
    trust: 'uncertain',
    approach: 'curious',     // Ask questions
    offers: 'none',          // Don't push
    priority: 'discovery'
  },
  abandoner: {
    trust: 'varies',
    approach: 'helpful',     // Solve their problem
    offers: 'conditional',   // Only if needed
    priority: 'completion'
  }
};

// ============================================================
// DETECT STORE TYPE
// ============================================================

function detectStoreType(storeData) {
  const {
    avgProductPrice = 0,
    productCategories = [],
    brandTone = '',
    targetAudience = '',
    discountFrequency = 'normal'
  } = storeData;

  // Luxury indicators
  if (avgProductPrice > 500 || 
      brandTone.includes('premium') || 
      brandTone.includes('luxury') ||
      discountFrequency === 'rare') {
    return 'luxury';
  }

  // Value/discount store
  if (avgProductPrice < 100 || 
      discountFrequency === 'frequent' ||
      brandTone.includes('value') ||
      brandTone.includes('affordable')) {
    return 'value';
  }

  // Niche/specialty
  const nicheCategories = ['coffee', 'fitness', 'gaming', 'beauty', 'organic', 'handmade'];
  if (productCategories.some(c => nicheCategories.includes(c.toLowerCase()))) {
    return 'niche';
  }

  // Local business
  if (brandTone.includes('local') || brandTone.includes('family')) {
    return 'local';
  }

  return 'mainstream';
}

// ============================================================
// DETECT CUSTOMER TYPE
// ============================================================

function detectCustomerType(customerData) {
  const {
    totalOrders = 0,
    totalSpent = 0,
    daysSinceFirstOrder = 0,
    cartAbandons = 0,
    productViews = 0,
    avgOrderValue = 0,
    usedDiscountCodes = 0
  } = customerData;

  // VIP: High value, repeat customer
  if (totalOrders >= 5 || totalSpent >= 2000) {
    return 'vip';
  }

  // Price hunter: Uses lots of discount codes, compares
  if (usedDiscountCodes >= 3 || (productViews > 20 && totalOrders < 2)) {
    return 'price_hunter';
  }

  // Browser: Looks a lot, buys little
  if (productViews > 10 && totalOrders === 0) {
    return 'browser';
  }

  // Abandoner: Has abandoned carts
  if (cartAbandons >= 2) {
    return 'abandoner';
  }

  // Returning customer
  if (totalOrders >= 2) {
    return 'returning';
  }

  // First buyer
  if (totalOrders === 1) {
    return 'first_buyer';
  }

  // New visitor
  return 'new_visitor';
}

// ============================================================
// MESSAGE TEMPLATES - By Store × Customer
// ============================================================

const MESSAGES = {
  // ---- CART RECOVERY ----
  cart_recovery: {
    // LUXURY STORE
    luxury: {
      new_visitor: {
        ar: 'مرحباً، لاحظنا اهتمامك بمنتجاتنا. هل يمكننا مساعدتك في أي استفسار؟',
        style: 'no_emoji'
      },
      vip: {
        ar: 'عميلنا العزيز، محفوظات سلتك بانتظارك. نسعد بخدمتك في أي وقت.',
        style: 'no_emoji'
      },
      default: {
        ar: 'نأمل أن تكون قد وجدت ما يناسبك. سلتك محفوظة لدينا.',
        style: 'no_emoji'
      }
    },
    // VALUE STORE
    value: {
      new_visitor: {
        ar: 'هلا! 👋 سلتك موجودة - تحتاج مساعدة؟',
        style: 'friendly'
      },
      price_hunter: {
        ar: 'سلتك بانتظارك! 🛒 بالمناسبة، الشحن مجاني للطلبات فوق 200 ريال',
        style: 'helpful'
      },
      vip: {
        ar: 'هلا بعميلنا المميز! 🌟 سلتك جاهزة + شحن مجاني لك دايماً',
        style: 'warm'
      },
      default: {
        ar: 'سلتك بانتظارك 🛒 كمّل طلبك وقت ما تحب!',
        style: 'friendly'
      }
    },
    // NICHE STORE
    niche: {
      new_visitor: {
        ar: 'أهلاً بك في مجتمعنا! 🙌 شفنا اهتمامك - عندك أي سؤال عن المنتجات؟',
        style: 'community'
      },
      returning: {
        ar: 'أهلاً من جديد! سلتك محفوظة - جاهز تكمل؟',
        style: 'familiar'
      },
      default: {
        ar: 'سلتك موجودة! تبي نساعدك تختار؟',
        style: 'helpful'
      }
    },
    // LOCAL STORE
    local: {
      new_visitor: {
        ar: 'هلا والله! 😊 سلتك عندنا - تحتاج شي؟',
        style: 'warm'
      },
      returning: {
        ar: 'هلا فيك مرة ثانية! سلتك جاهزة متى ما تبي',
        style: 'neighbor'
      },
      default: {
        ar: 'أهلين! سلتك بانتظارك 🛒',
        style: 'warm'
      }
    },
    // MAINSTREAM (default)
    mainstream: {
      new_visitor: {
        ar: 'هلا! لاحظنا سلتك - تحتاج مساعدة في شي؟',
        style: 'helpful'
      },
      vip: {
        ar: 'هلا بعميلنا المميز! ✨ سلتك جاهزة',
        style: 'appreciative'
      },
      abandoner: {
        ar: 'سلتك لسا موجودة - هل واجهتك مشكلة؟',
        style: 'concerned'
      },
      default: {
        ar: 'سلتك بانتظارك 🛒',
        style: 'neutral'
      }
    }
  },

  // ---- POST PURCHASE ----
  post_purchase: {
    luxury: {
      default: {
        ar: 'شكراً لثقتك بنا. طلبك قيد التجهيز وسيصلك قريباً.',
        style: 'elegant'
      }
    },
    value: {
      first_buyer: {
        ar: 'يسعدنا إنك صرت من عملائنا! 🎉 طلبك في الطريق',
        style: 'celebratory'
      },
      vip: {
        ar: 'شكراً لك دايماً! 💚 طلبك له أولوية في الشحن',
        style: 'appreciative'
      },
      default: {
        ar: 'تم! طلبك في الطريق 🚚',
        style: 'simple'
      }
    },
    mainstream: {
      default: {
        ar: 'شكراً لطلبك! ✅ راح نرسلك تحديثات الشحن',
        style: 'informative'
      }
    }
  },

  // ---- FOLLOW UP (no reply) ----
  follow_up: {
    luxury: {
      default: {
        ar: 'نأمل أن يكون كل شيء على ما يرام. نحن هنا إذا احتجت أي مساعدة.',
        style: 'subtle'
      }
    },
    value: {
      default: {
        ar: 'هل كل شي تمام؟ 🤔 رد علينا إذا تحتاج شي!',
        style: 'casual'
      }
    },
    mainstream: {
      default: {
        ar: 'تحتاج أي مساعدة؟',
        style: 'simple'
      }
    }
  }
};

// ============================================================
// GET RIGHT MESSAGE
// ============================================================

function getMessage(messageType, storeData, customerData) {
  const storeType = detectStoreType(storeData);
  const customerType = detectCustomerType(customerData);

  // Get message templates for this type
  const typeMessages = MESSAGES[messageType] || MESSAGES.cart_recovery;
  const storeMessages = typeMessages[storeType] || typeMessages.mainstream;
  
  // Get specific message for customer type, or default
  const message = storeMessages[customerType] || storeMessages.default;

  return {
    text: message.ar,
    style: message.style,
    storeType,
    customerType,
    // Metadata for learning
    meta: {
      detectedStore: storeType,
      detectedCustomer: customerType,
      messageType,
      timestamp: Date.now()
    }
  };
}

// ============================================================
// SHOULD WE SEND AN OFFER?
// ============================================================

function shouldIncludeOffer(storeType, customerType) {
  // Matrix: Store × Customer → Offer decision
  const offerMatrix = {
    luxury: {
      new_visitor: false,    // Never push new luxury visitors
      first_buyer: false,    // Let them enjoy, don't sell more
      returning: 'subtle',   // Very subtle
      vip: 'exclusive',      // Exclusive only
      default: false
    },
    value: {
      new_visitor: 'gentle', // Small welcome offer ok
      price_hunter: true,    // They expect it
      vip: true,             // Best deals
      default: true
    },
    niche: {
      new_visitor: false,    // Build community first
      returning: 'member',   // Community perks
      vip: 'exclusive',
      default: 'subtle'
    },
    local: {
      new_visitor: 'welcome',
      returning: true,
      vip: true,
      default: 'friendly'
    },
    mainstream: {
      new_visitor: 'gentle',
      browser: false,        // Don't push browsers
      abandoner: 'helpful',  // Help, not push
      vip: true,
      default: 'moderate'
    }
  };

  const storeMatrix = offerMatrix[storeType] || offerMatrix.mainstream;
  return storeMatrix[customerType] ?? storeMatrix.default ?? 'moderate';
}

// ============================================================
// GENERATE COMPLETE MESSAGE
// ============================================================

function generateMessage(messageType, storeData, customerData, context = {}) {
  const baseMessage = getMessage(messageType, storeData, customerData);
  const offerDecision = shouldIncludeOffer(baseMessage.storeType, baseMessage.customerType);

  let finalText = baseMessage.text;
  let includeOffer = null;

  // ---- PERSONALIZATION: Product Memory ----
  // Replace [product] placeholders with recently viewed products
  if (productMemory && context.customerId) {
    try {
      const recentProducts = productMemory.getRecentProducts(context.customerId, 1);
      if (recentProducts && recentProducts.length > 0) {
        const productName = recentProducts[0].name || recentProducts[0].title;
        if (productName) {
          finalText = finalText.replace(/\[product\]/gi, productName);
        }
      }
    } catch (e) {
      // Graceful fallback - continue without product personalization
    }
  }

  // ---- PERSONALIZATION: Timing Learner ----
  // Get optimal send time based on customer behavior
  let timing = getTiming(baseMessage.storeType, baseMessage.customerType);
  if (timingLearner && context.customerId) {
    try {
      const optimalTime = timingLearner.getBestSendTime(context.customerId);
      if (optimalTime) {
        timing = {
          ...timing,
          optimalHour: optimalTime.hour,
          optimalDay: optimalTime.dayOfWeek,
          confidence: optimalTime.confidence,
          reason: optimalTime.reason || timing.reason
        };
      }
    } catch (e) {
      // Graceful fallback - use default timing
    }
  }

  // ---- PERSONALIZATION: Tone Adapter ----
  // Adapt tone based on customer preferences and history
  if (toneAdapter && context.customerId) {
    try {
      const adaptedMessage = toneAdapter.adaptTone(finalText, {
        customerId: context.customerId,
        storeType: baseMessage.storeType,
        customerType: baseMessage.customerType,
        messageType
      });
      if (adaptedMessage) {
        finalText = adaptedMessage.text || finalText;
        baseMessage.style = adaptedMessage.style || baseMessage.style;
      }
    } catch (e) {
      // Graceful fallback - keep original tone
    }
  }

  // Add offer only if appropriate
  if (offerDecision && offerDecision !== false) {
    const offerStyle = typeof offerDecision === 'string' ? offerDecision : 'moderate';
    includeOffer = {
      style: offerStyle,
      // Don't add offer text here - let the offer system handle it
      // Just flag that an offer CAN be included
      canInclude: true
    };
  }

  return {
    text: finalText,
    style: baseMessage.style,
    storeType: baseMessage.storeType,
    customerType: baseMessage.customerType,
    offer: includeOffer,
    timing: timing,
    meta: baseMessage.meta
  };
}

// ============================================================
// TIMING BASED ON STORE/CUSTOMER
// ============================================================

function getTiming(storeType, customerType) {
  // Luxury: Always patient
  if (storeType === 'luxury') {
    return { delay: 'long', hours: 24, reason: 'Luxury never rushes' };
  }

  // VIPs: Responsive but not pushy
  if (customerType === 'vip') {
    return { delay: 'medium', hours: 2, reason: 'VIPs deserve attention' };
  }

  // Browsers: Long delay, soft touch
  if (customerType === 'browser') {
    return { delay: 'long', hours: 24, reason: 'Browsers need space' };
  }

  // Abandoners with high cart: Faster
  if (customerType === 'abandoner') {
    return { delay: 'short', hours: 1, reason: 'Recovery window' };
  }

  // Default
  return { delay: 'medium', hours: 4, reason: 'Balanced approach' };
}

// ============================================================
// FULLY PERSONALIZED MESSAGE (ALL-IN-ONE)
// ============================================================

/**
 * Generate a fully personalized message with all available data
 * 
 * @param {string} messageType - Type of message (cart_recovery, post_purchase, etc.)
 * @param {object} storeData - Store configuration and data
 * @param {object} customerData - Customer history and stats
 * @param {string} customerId - Customer identifier for personalization lookups
 * @returns {object} Complete personalized message with timing and metadata
 */
async function generatePersonalizedMessage(messageType, storeData, customerData, customerId) {
  // Start with base message generation
  const context = { customerId };
  
  // Gather all personalization data in parallel
  const [recentProducts, optimalTiming, tonePrefs] = await Promise.all([
    // Get recent viewed products
    productMemory ? 
      safeAsync(() => productMemory.getRecentProducts(customerId, 3)) : 
      Promise.resolve([]),
    
    // Get optimal send time
    timingLearner ? 
      safeAsync(() => timingLearner.getBestSendTime(customerId)) : 
      Promise.resolve(null),
    
    // Get tone preferences
    toneAdapter ? 
      safeAsync(() => toneAdapter.getCustomerPreferences(customerId)) : 
      Promise.resolve(null)
  ]);

  // Generate the base message
  const baseMessage = getMessage(messageType, storeData, customerData);
  const offerDecision = shouldIncludeOffer(baseMessage.storeType, baseMessage.customerType);
  
  let finalText = baseMessage.text;

  // ---- Apply Product Personalization ----
  if (recentProducts && recentProducts.length > 0) {
    const primaryProduct = recentProducts[0];
    const productName = primaryProduct.name || primaryProduct.title || '';
    
    // Replace [product] placeholders
    if (productName) {
      finalText = finalText.replace(/\[product\]/gi, productName);
    }
    
    // Replace [products] with list (for templates that support it)
    if (recentProducts.length > 1) {
      const productList = recentProducts
        .slice(0, 3)
        .map(p => p.name || p.title)
        .filter(Boolean)
        .join('، ');
      finalText = finalText.replace(/\[products\]/gi, productList);
    }
  }

  // ---- Apply Tone Adaptation ----
  let style = baseMessage.style;
  if (toneAdapter && tonePrefs) {
    try {
      const adapted = toneAdapter.adaptTone(finalText, {
        customerId,
        storeType: baseMessage.storeType,
        customerType: baseMessage.customerType,
        messageType,
        preferences: tonePrefs
      });
      if (adapted) {
        finalText = adapted.text || finalText;
        style = adapted.style || style;
      }
    } catch (e) {
      // Keep original
    }
  }

  // ---- Build Timing ----
  let timing = getTiming(baseMessage.storeType, baseMessage.customerType);
  if (optimalTiming) {
    timing = {
      ...timing,
      optimalHour: optimalTiming.hour,
      optimalDay: optimalTiming.dayOfWeek,
      confidence: optimalTiming.confidence,
      learned: true,
      reason: optimalTiming.reason || timing.reason
    };
  }

  // ---- Build Offer ----
  let includeOffer = null;
  if (offerDecision && offerDecision !== false) {
    const offerStyle = typeof offerDecision === 'string' ? offerDecision : 'moderate';
    includeOffer = {
      style: offerStyle,
      canInclude: true
    };
  }

  return {
    text: finalText,
    style,
    storeType: baseMessage.storeType,
    customerType: baseMessage.customerType,
    offer: includeOffer,
    timing,
    personalization: {
      productsUsed: recentProducts?.length || 0,
      timingLearned: !!optimalTiming,
      toneAdapted: !!tonePrefs,
      customerId
    },
    meta: {
      ...baseMessage.meta,
      personalized: true,
      timestamp: Date.now()
    }
  };
}

/**
 * Helper: Safe async call with fallback
 */
async function safeAsync(fn, fallback = null) {
  try {
    const result = fn();
    return result instanceof Promise ? await result : result;
  } catch (e) {
    return fallback;
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Main functions
  generateMessage,
  generatePersonalizedMessage,  // NEW: Full personalization
  getMessage,
  shouldIncludeOffer,
  
  // Detection
  detectStoreType,
  detectCustomerType,
  
  // Timing
  getTiming,
  
  // Data (for customization)
  STORE_TYPES,
  CUSTOMER_TYPES,
  MESSAGES,
  
  // Personalization tools availability check
  hasPersonalization: () => ({
    productMemory: !!productMemory,
    timingLearner: !!timingLearner,
    toneAdapter: !!toneAdapter
  })
};
