/**
 * 🎯 RIBH Offer Orchestrator - The Brain
 * 
 * Based on Alex Hormozi's frameworks from $100M Offers:
 * - Attraction → Upsell → Downsell → Continuity
 * - Right offer, right time, right customer
 * - Never random, always strategic
 * 
 * CORE PRINCIPLES:
 * 1. Upsells IMMEDIATELY after purchase (hyper-buying window)
 * 2. Downsells ONLY after explicit decline
 * 3. Never discount - add bonuses instead (value stacking)
 * 4. Continuity at day 7-21, not day 1
 * 5. Simple scales, complex fails
 */

const admin = require('firebase-admin');
const getDb = () => admin.firestore();

// ============================================================
// OFFER TYPES & THEIR PURPOSES
// ============================================================

const OFFER_TYPES = {
  // ATTRACTION: Getting them to buy first time
  CART_RECOVERY: 'cart_recovery',      // Abandoned cart - bring them back
  BROWSE_RECOVERY: 'browse_recovery',  // Looked but didn't cart
  WELCOME: 'welcome',                   // First-time buyer incentive
  
  // MONETIZATION: Getting more from current purchase
  UPSELL_IMMEDIATE: 'upsell_immediate',     // Right after purchase (5-15 min window)
  UPSELL_COMPLEMENTARY: 'upsell_complementary', // Related product
  UPSELL_QUANTITY: 'upsell_quantity',       // Buy more of same
  UPSELL_PREMIUM: 'upsell_premium',         // Better version
  CROSS_SELL: 'cross_sell',                 // Different category, same need
  BUNDLE: 'bundle',                         // Package deal
  
  // RECOVERY: When they decline
  DOWNSELL_CHEAPER: 'downsell_cheaper',     // Lower price version
  DOWNSELL_SMALLER: 'downsell_smaller',     // Smaller quantity
  DOWNSELL_PAYMENT: 'downsell_payment',     // Payment plan
  
  // RETENTION: Keeping them long-term
  CONTINUITY: 'continuity',            // Subscription/membership (day 7-21)
  REPLENISHMENT: 'replenishment',      // Time to reorder
  WINBACK: 'winback',                  // 30-90 days inactive
  LOYALTY: 'loyalty',                  // VIP rewards
};

// ============================================================
// TRIGGER TYPES - What event caused this offer opportunity?
// ============================================================

const TRIGGERS = {
  PURCHASE_COMPLETE: 'purchase_complete',
  OFFER_DECLINED: 'offer_declined',
  OFFER_IGNORED: 'offer_ignored',      // No response in X hours
  CART_ABANDONED: 'cart_abandoned',
  BROWSE_ABANDONED: 'browse_abandoned',
  CHECKOUT_ABANDONED: 'checkout_abandoned',
  TIME_BASED: 'time_based',            // Scheduled (continuity, winback)
  CHURN_RISK: 'churn_risk',            // High churn score detected
  REPLENISHMENT_DUE: 'replenishment_due',
};

// ============================================================
// CUSTOMER STATE - Track their offer journey
// ============================================================

async function getCustomerOfferState(storeId, customerId) {
  const doc = await getDb()
    .collection('stores').doc(storeId)
    .collection('customerOfferState').doc(customerId)
    .get();
  
  if (!doc.exists) {
    return {
      customerId,
      lastOfferShown: null,
      lastOfferResponse: null,
      offersShownToday: 0,
      offersAccepted: [],
      offersDeclined: [],
      offersIgnored: [],
      totalPurchases: 0,
      daysSinceLastPurchase: null,
      hasSeenContinuityOffer: false,
      lastContactAt: null,
      fatigueLevel: 0,  // 0-100, increases with ignored offers
    };
  }
  
  return doc.data();
}

async function updateCustomerOfferState(storeId, customerId, updates) {
  await getDb()
    .collection('stores').doc(storeId)
    .collection('customerOfferState').doc(customerId)
    .set({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

// ============================================================
// OFFER FATIGUE PROTECTION
// ============================================================

function checkOfferFatigue(state) {
  const now = Date.now();
  const hoursSinceLastContact = state.lastContactAt 
    ? (now - state.lastContactAt) / (1000 * 60 * 60)
    : 999;
  
  // Rule 1: Max 3 offers in 24 hours
  if (state.offersShownToday >= 3) {
    return { canSend: false, reason: 'daily_limit_reached', waitHours: 24 };
  }
  
  // Rule 2: If declined 2x in a row, back off 48 hours
  const recentDeclines = (state.offersDeclined || []).slice(-2);
  if (recentDeclines.length >= 2) {
    const lastDeclineTime = Math.max(...recentDeclines.map(d => d.timestamp || 0));
    const hoursSinceDecline = (now - lastDeclineTime) / (1000 * 60 * 60);
    if (hoursSinceDecline < 48) {
      return { canSend: false, reason: 'recent_declines', waitHours: 48 - hoursSinceDecline };
    }
  }
  
  // Rule 3: Minimum 2 hours between offers
  if (hoursSinceLastContact < 2) {
    return { canSend: false, reason: 'too_soon', waitHours: 2 - hoursSinceLastContact };
  }
  
  // Rule 4: High fatigue = back off
  if (state.fatigueLevel > 70) {
    return { canSend: false, reason: 'high_fatigue', waitHours: 72 };
  }
  
  return { canSend: true };
}

// ============================================================
// THE MAIN DECISION ENGINE
// ============================================================

/**
 * Determine the right offer for this customer at this moment
 * 
 * @param {string} storeId 
 * @param {string} customerId 
 * @param {string} trigger - What event caused this opportunity
 * @param {object} context - Additional context (cart, purchase, declined offer, etc)
 * @returns {object|null} - The offer to show, or null if no offer appropriate
 */
async function determineOffer(storeId, customerId, trigger, context = {}) {
  const state = await getCustomerOfferState(storeId, customerId);
  
  // Check fatigue first (unless it's a decline - we always respond to declines)
  if (trigger !== TRIGGERS.OFFER_DECLINED) {
    const fatigueCheck = checkOfferFatigue(state);
    if (!fatigueCheck.canSend) {
      console.log(`[Orchestrator] 🛑 Blocked: ${fatigueCheck.reason} for ${customerId}`);
      return { 
        offer: null, 
        blocked: true, 
        reason: fatigueCheck.reason,
        retryAfterHours: fatigueCheck.waitHours 
      };
    }
  }
  
  let offer = null;
  
  // ============================================================
  // TRIGGER-BASED DECISION LOGIC
  // ============================================================
  
  switch (trigger) {
    
    // ---------------------------------------------------------
    // PURCHASE COMPLETE → Immediate Upsell (Hyper-Buying Window)
    // ---------------------------------------------------------
    case TRIGGERS.PURCHASE_COMPLETE:
      // This is the GOLDEN MOMENT - 90% accept rate when done right
      offer = createPostPurchaseUpsell(state, context.purchase);
      break;
    
    // ---------------------------------------------------------
    // OFFER DECLINED → Immediate Downsell
    // ---------------------------------------------------------
    case TRIGGERS.OFFER_DECLINED:
      // They said no - but don't let them leave with nothing
      // Downsell based on WHY they declined (price vs interest)
      offer = createDownsell(state, context.declinedOffer, context.declineReason);
      break;
    
    // ---------------------------------------------------------
    // OFFER IGNORED → Softer follow-up
    // ---------------------------------------------------------
    case TRIGGERS.OFFER_IGNORED:
      // They didn't respond - maybe wrong timing, wrong channel
      // Don't repeat same offer, try different angle
      offer = createIgnoredFollowUp(state, context.ignoredOffer);
      break;
    
    // ---------------------------------------------------------
    // CART ABANDONED → Recovery Offer
    // ---------------------------------------------------------
    case TRIGGERS.CART_ABANDONED:
      offer = createCartRecoveryOffer(state, context.cart);
      break;
    
    // ---------------------------------------------------------
    // CHECKOUT ABANDONED → Stronger Recovery (they were close!)
    // ---------------------------------------------------------
    case TRIGGERS.CHECKOUT_ABANDONED:
      offer = createCheckoutRecoveryOffer(state, context.checkout);
      break;
    
    // ---------------------------------------------------------
    // BROWSE ABANDONED → Gentle Nudge
    // ---------------------------------------------------------
    case TRIGGERS.BROWSE_ABANDONED:
      offer = createBrowseRecoveryOffer(state, context.viewedProducts);
      break;
    
    // ---------------------------------------------------------
    // TIME BASED → Continuity or Winback
    // ---------------------------------------------------------
    case TRIGGERS.TIME_BASED:
      offer = createTimeBasedOffer(state, context);
      break;
    
    // ---------------------------------------------------------
    // CHURN RISK → Retention Offer
    // ---------------------------------------------------------
    case TRIGGERS.CHURN_RISK:
      offer = createRetentionOffer(state, context.churnScore);
      break;
    
    // ---------------------------------------------------------
    // REPLENISHMENT DUE → Reorder Reminder
    // ---------------------------------------------------------
    case TRIGGERS.REPLENISHMENT_DUE:
      offer = createReplenishmentOffer(state, context.product);
      break;
    
    default:
      console.log(`[Orchestrator] ⚠️ Unknown trigger: ${trigger}`);
      return { offer: null, reason: 'unknown_trigger' };
  }
  
  if (offer) {
    // Record that we're showing this offer
    await recordOfferShown(storeId, customerId, offer);
    console.log(`[Orchestrator] ✅ Offering ${offer.type} to ${customerId}`);
  }
  
  return { offer, state };
}

// ============================================================
// OFFER CREATORS - Each creates the right offer for the situation
// ============================================================

function createPostPurchaseUpsell(state, purchase) {
  const purchaseValue = purchase?.total || 0;
  const purchasedProducts = purchase?.items || [];
  
  // Determine upsell type based on customer and purchase
  let upsellType;
  let upsellMessage;
  let upsellDiscount = 0;
  
  if (state.totalPurchases === 0) {
    // First purchase - complementary upsell
    upsellType = OFFER_TYPES.UPSELL_COMPLEMENTARY;
    upsellMessage = {
      ar: 'شكراً لطلبك! 🎉 أضف هذا المنتج المكمّل بخصم خاص - فقط الآن',
      en: 'Thanks for your order! 🎉 Add this complementary product at a special price - now only'
    };
    // Not a discount - a BONUS: free shipping or free accessory
    upsellDiscount = 0; // We add value, not reduce price
  } else if (state.totalPurchases >= 3) {
    // Repeat customer - premium upsell
    upsellType = OFFER_TYPES.UPSELL_PREMIUM;
    upsellMessage = {
      ar: 'عميلنا المميز! ✨ احصل على النسخة المطورة مع مزايا حصرية',
      en: 'Valued customer! ✨ Get the premium version with exclusive benefits'
    };
  } else {
    // Regular customer - quantity upsell
    upsellType = OFFER_TYPES.UPSELL_QUANTITY;
    upsellMessage = {
      ar: 'أضف قطعة ثانية واحصل على شحن مجاني! 📦',
      en: 'Add a second item and get free shipping! 📦'
    };
  }
  
  return {
    type: upsellType,
    trigger: TRIGGERS.PURCHASE_COMPLETE,
    message: upsellMessage,
    timing: 'immediate', // Within 5-15 minutes
    expiryMinutes: 30,   // Urgency - but real urgency
    valueAdd: {
      type: 'free_shipping', // Add value, don't discount
      description: { ar: 'شحن مجاني', en: 'Free shipping' }
    },
    relatedTo: purchasedProducts[0]?.id,
    priority: 'high',
    // Never show downsell here - only if they decline
  };
}

function createDownsell(state, declinedOffer, declineReason) {
  // CRITICAL: Only create downsell if there was actually a declined offer
  if (!declinedOffer) {
    console.log('[Orchestrator] ⚠️ No declined offer - cannot downsell');
    return null;
  }
  
  // Determine WHY they declined to pick right downsell
  let downsellType;
  let downsellMessage;
  
  if (declineReason === 'price' || !declineReason) {
    // Price objection - offer cheaper version or payment plan
    if (declinedOffer.value > 500) {
      // High value item - offer payment plan
      downsellType = OFFER_TYPES.DOWNSELL_PAYMENT;
      downsellMessage = {
        ar: 'فهمتك! 💡 ممكن تقسّط على 3 دفعات بدون فوائد',
        en: 'I understand! 💡 You can split into 3 payments, interest-free'
      };
    } else {
      // Lower value - offer smaller quantity
      downsellType = OFFER_TYPES.DOWNSELL_SMALLER;
      downsellMessage = {
        ar: 'طيب، جرّب الحجم الأصغر أول؟ 🎁',
        en: 'How about trying the smaller size first? 🎁'
      };
    }
  } else if (declineReason === 'timing') {
    // Not now - schedule for later, don't push
    return {
      type: 'schedule_later',
      message: {
        ar: 'تمام! بنرسلك تذكير لما يناسبك 📅',
        en: 'Sure! We\'ll remind you when it suits you 📅'
      },
      scheduleForDays: 7
    };
  } else {
    // Not interested - don't push, offer alternative
    downsellType = OFFER_TYPES.DOWNSELL_CHEAPER;
    downsellMessage = {
      ar: 'شوف هذا البديل - نفس الجودة بسعر أقل 👀',
      en: 'Check this alternative - same quality, lower price 👀'
    };
  }
  
  return {
    type: downsellType,
    trigger: TRIGGERS.OFFER_DECLINED,
    message: downsellMessage,
    timing: 'immediate', // Right after decline
    expiryMinutes: 60,
    originalOffer: declinedOffer,
    priority: 'medium',
  };
}

function createIgnoredFollowUp(state, ignoredOffer) {
  // They didn't respond - increase fatigue, try different approach
  const newFatigue = Math.min(100, (state.fatigueLevel || 0) + 15);
  
  if (newFatigue > 50) {
    // Getting tired of us - back off
    return null;
  }
  
  // Try different angle: question instead of offer
  return {
    type: 'soft_followup',
    trigger: TRIGGERS.OFFER_IGNORED,
    message: {
      ar: 'هل تحتاج مساعدة في اختيارك؟ 🤔',
      en: 'Do you need help with your choice? 🤔'
    },
    timing: 'delayed',
    delayHours: 24, // Wait a day
    isQuestion: true, // Opens dialogue, not pushing sale
    fatigueIncrease: 15,
  };
}

function createCartRecoveryOffer(state, cart) {
  const cartValue = cart?.total || 0;
  const itemCount = cart?.items?.length || 0;
  
  // Check how many times we've tried to recover this cart
  const recoveryAttempts = state.offersShownToday || 0;
  
  let message;
  let valueAdd;
  
  if (recoveryAttempts === 0) {
    // First touch - friendly reminder, no discount
    message = {
      ar: `سلتك بانتظارك! 🛒 ${itemCount} منتجات محفوظة`,
      en: `Your cart is waiting! 🛒 ${itemCount} items saved`
    };
    valueAdd = null; // No offer yet, just reminder
  } else if (recoveryAttempts === 1) {
    // Second touch - add value (not discount!)
    message = {
      ar: 'لا تنسى طلبك! 🎁 أكمل الآن واحصل على شحن مجاني',
      en: 'Don\'t forget your order! 🎁 Complete now for free shipping'
    };
    valueAdd = { type: 'free_shipping' };
  } else {
    // Third touch - final offer with bonus
    message = {
      ar: 'آخر فرصة! 🔥 سلتك + هدية مجانية عند الطلب خلال ساعة',
      en: 'Last chance! 🔥 Your cart + free gift if you order within an hour'
    };
    valueAdd = { type: 'free_gift', description: { ar: 'هدية مجانية', en: 'Free gift' } };
  }
  
  return {
    type: OFFER_TYPES.CART_RECOVERY,
    trigger: TRIGGERS.CART_ABANDONED,
    message,
    cartValue,
    itemCount,
    valueAdd,
    timing: recoveryAttempts === 0 ? 'goldenhour' : 'immediate',
    expiryHours: recoveryAttempts >= 2 ? 1 : 24,
    recoveryAttempt: recoveryAttempts + 1,
    priority: cartValue > 300 ? 'high' : 'medium',
  };
}

function createCheckoutRecoveryOffer(state, checkout) {
  // They started checkout - they were CLOSE!
  // Stronger offer than cart abandon
  return {
    type: 'checkout_recovery',
    trigger: TRIGGERS.CHECKOUT_ABANDONED,
    message: {
      ar: 'كنت قريب من إتمام طلبك! 🎯 خلنا نساعدك - هل واجهتك مشكلة؟',
      en: 'You were so close! 🎯 Let us help - did you face any issues?'
    },
    checkoutValue: checkout?.total,
    timing: 'immediate', // They just left - reach them fast
    isQuestion: true, // Find out why they stopped
    valueAdd: { type: 'free_shipping', type: 'priority_support' },
    expiryMinutes: 30,
    priority: 'high',
  };
}

function createBrowseRecoveryOffer(state, viewedProducts) {
  // They looked but didn't cart - gentle nudge
  const topProduct = viewedProducts?.[0];
  
  return {
    type: OFFER_TYPES.BROWSE_RECOVERY,
    trigger: TRIGGERS.BROWSE_ABANDONED,
    message: {
      ar: `لاحظنا اهتمامك بـ ${topProduct?.name || 'منتجاتنا'} 👀 عندك سؤال؟`,
      en: `We noticed you were interested in ${topProduct?.name || 'our products'} 👀 Any questions?`
    },
    viewedProducts,
    timing: 'delayed',
    delayHours: 4, // Not too aggressive
    isQuestion: true,
    priority: 'low',
  };
}

function createTimeBasedOffer(state, context) {
  const daysSincePurchase = state.daysSinceLastPurchase || 999;
  
  // CONTINUITY: Day 7-21 (not day 1!)
  if (daysSincePurchase >= 7 && daysSincePurchase <= 21 && !state.hasSeenContinuityOffer) {
    return {
      type: OFFER_TYPES.CONTINUITY,
      trigger: TRIGGERS.TIME_BASED,
      message: {
        ar: 'استمتعت بتجربتك؟ 🌟 اشترك في برنامج VIP واحصل على خصم دائم + توصيل مجاني',
        en: 'Enjoyed your experience? 🌟 Join VIP for permanent discount + free shipping'
      },
      timing: 'smart_time', // Send at their active hour
      valueAdd: { type: 'vip_benefits' },
      priority: 'medium',
    };
  }
  
  // WINBACK: 30-90 days
  if (daysSincePurchase >= 30 && daysSincePurchase <= 90) {
    return {
      type: OFFER_TYPES.WINBACK,
      trigger: TRIGGERS.TIME_BASED,
      message: {
        // Hormozi's 9-word email style
        ar: 'هل مازلت مهتم بـ [المنتج]؟',
        en: 'Are you still interested in [product]?'
      },
      timing: 'smart_time',
      isQuestion: true, // Opens dialogue
      priority: 'medium',
    };
  }
  
  // REACTIVATION: 90+ days
  if (daysSincePurchase > 90) {
    return {
      type: OFFER_TYPES.WINBACK,
      trigger: TRIGGERS.TIME_BASED,
      message: {
        ar: 'وحشتنا! 💚 رجعنا بمنتجات جديدة - شوف الجديد',
        en: 'We miss you! 💚 We\'re back with new products - see what\'s new'
      },
      timing: 'smart_time',
      valueAdd: { type: 'comeback_bonus' },
      priority: 'low',
    };
  }
  
  return null;
}

function createRetentionOffer(state, churnScore) {
  if (churnScore < 50) return null; // Not at risk
  
  const isVIP = (state.totalPurchases || 0) >= 5;
  
  if (isVIP) {
    return {
      type: OFFER_TYPES.LOYALTY,
      trigger: TRIGGERS.CHURN_RISK,
      message: {
        ar: 'عميلنا المميز! 👑 لاحظنا غيابك - هل كل شي تمام؟',
        en: 'Valued customer! 👑 We noticed you\'ve been away - is everything okay?'
      },
      isQuestion: true,
      valueAdd: { type: 'vip_exclusive' },
      priority: 'high',
    };
  }
  
  return {
    type: OFFER_TYPES.WINBACK,
    trigger: TRIGGERS.CHURN_RISK,
    message: {
      ar: 'نبي نسمع رأيك! 📝 شاركنا تجربتك واحصل على خصم',
      en: 'We want your feedback! 📝 Share your experience and get a discount'
    },
    isQuestion: true,
    priority: 'medium',
  };
}

function createReplenishmentOffer(state, product) {
  return {
    type: OFFER_TYPES.REPLENISHMENT,
    trigger: TRIGGERS.REPLENISHMENT_DUE,
    message: {
      ar: `وقت تجديد ${product?.name}! 🔄 اطلب الآن قبل ما يخلص`,
      en: `Time to restock ${product?.name}! 🔄 Order now before it runs out`
    },
    product,
    timing: 'smart_time',
    valueAdd: { type: 'subscribe_save', discount: 10 },
    priority: 'medium',
  };
}

// ============================================================
// RECORDING & TRACKING
// ============================================================

async function recordOfferShown(storeId, customerId, offer) {
  const state = await getCustomerOfferState(storeId, customerId);
  
  await updateCustomerOfferState(storeId, customerId, {
    lastOfferShown: {
      type: offer.type,
      timestamp: Date.now(),
      offerId: offer.id || `${offer.type}_${Date.now()}`
    },
    lastOfferResponse: null, // Reset until they respond
    offersShownToday: (state.offersShownToday || 0) + 1,
    lastContactAt: Date.now(),
  });
}

async function recordOfferResponse(storeId, customerId, offerId, response, reason = null) {
  const state = await getCustomerOfferState(storeId, customerId);
  
  const responseRecord = {
    offerId,
    response, // 'accepted', 'declined', 'ignored'
    reason,
    timestamp: Date.now()
  };
  
  const updates = {
    lastOfferResponse: response,
  };
  
  if (response === 'accepted') {
    updates.offersAccepted = [...(state.offersAccepted || []), responseRecord];
    updates.fatigueLevel = Math.max(0, (state.fatigueLevel || 0) - 20); // Success reduces fatigue
  } else if (response === 'declined') {
    updates.offersDeclined = [...(state.offersDeclined || []), responseRecord];
    updates.fatigueLevel = Math.min(100, (state.fatigueLevel || 0) + 10);
  } else if (response === 'ignored') {
    updates.offersIgnored = [...(state.offersIgnored || []), responseRecord];
    updates.fatigueLevel = Math.min(100, (state.fatigueLevel || 0) + 15);
  }
  
  await updateCustomerOfferState(storeId, customerId, updates);
  
  return responseRecord;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Core decision engine
  determineOffer,
  
  // State management
  getCustomerOfferState,
  updateCustomerOfferState,
  recordOfferResponse,
  
  // Fatigue check (for external use)
  checkOfferFatigue,
  
  // Constants
  OFFER_TYPES,
  TRIGGERS,
};
