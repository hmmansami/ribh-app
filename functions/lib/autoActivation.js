/**
 * 🚀 AUTO-ACTIVATION ENGINE - One-Click → Money Flows
 *
 * When a merchant connects Salla + WhatsApp, this module:
 * 1. Auto-deploys pre-built recovery sequences (no manual config)
 * 2. Activates AI-personalized messaging (Groq/Gemini)
 * 3. Starts timing learner from day 1
 * 4. Enables all channels (WhatsApp → Email → SMS fallback)
 *
 * Inspired by:
 * - Attentive: AI personalization per customer (Identity AI, Send Time AI)
 * - Klaviyo: Pre-built flows auto-activate (abandoned cart, winback, post-purchase)
 * - ReConvert: One-click, zero config, "set and forget"
 */

const admin = require('firebase-admin');

// Graceful module loading (same pattern as server.js)
let sequenceEngine, lifecycleEngine, whatsappBridge, emailSender, offerGenerator,
    aiMessenger, timingLearner, messageQueue, contentGenerator;

try { sequenceEngine = require('./sequenceEngine'); } catch(e) { sequenceEngine = null; }
try { lifecycleEngine = require('./lifecycleEngineV2'); } catch(e) { lifecycleEngine = null; }
try { whatsappBridge = require('./whatsappBridge'); } catch(e) { whatsappBridge = null; }
try { emailSender = require('./emailSender'); } catch(e) { emailSender = null; }
try { offerGenerator = require('./offerGenerator'); } catch(e) { offerGenerator = null; }
try { aiMessenger = require('./aiMessenger'); } catch(e) { aiMessenger = null; }
try { timingLearner = require('./timingLearner'); } catch(e) { timingLearner = null; }
try { messageQueue = require('./messageQueue'); } catch(e) { messageQueue = null; }
try { contentGenerator = require('./contentGenerator'); } catch(e) { contentGenerator = null; }

// ==========================================
// ACTIVATION STATUS TRACKING
// ==========================================
const ACTIVATION_STEPS = {
  SALLA_CONNECTED: 'salla_connected',
  WHATSAPP_CONNECTED: 'whatsapp_connected',
  SEQUENCES_DEPLOYED: 'sequences_deployed',
  AI_ENABLED: 'ai_enabled',
  FULLY_ACTIVE: 'fully_active'
};

/**
 * Get activation status for a merchant
 */
async function getActivationStatus(merchantId) {
  try {
    const db = admin.firestore();
    const doc = await db.collection('store_activation').doc(String(merchantId)).get();
    if (doc.exists) return doc.data();
    return {
      merchantId: String(merchantId),
      status: 'not_started',
      steps: {},
      activatedAt: null,
      sequencesDeployed: [],
      channelsActive: []
    };
  } catch (e) {
    console.log('⚠️ getActivationStatus error:', e.message);
    return { merchantId: String(merchantId), status: 'not_started', steps: {}, sequencesDeployed: [], channelsActive: [] };
  }
}

/**
 * Save activation status
 */
async function saveActivationStatus(merchantId, status) {
  try {
    const db = admin.firestore();
    await db.collection('store_activation').doc(String(merchantId)).set(status, { merge: true });
  } catch (e) {
    console.log('⚠️ saveActivationStatus error:', e.message);
  }
}

// ==========================================
// CORE: ONE-CLICK ACTIVATION
// ==========================================

/**
 * Called when merchant completes Salla OAuth.
 * Marks Salla as connected and checks if we can fully activate.
 */
async function onSallaConnected(merchantId, storeData) {
  const id = String(merchantId);
  console.log(`🔗 [AutoActivation] Salla connected for ${id}`);

  const status = await getActivationStatus(id);
  status.steps[ACTIVATION_STEPS.SALLA_CONNECTED] = {
    completedAt: new Date().toISOString(),
    storeName: storeData?.storeName || storeData?.name || 'متجر',
    email: storeData?.email || '',
    category: storeData?.category || 'general'
  };
  status.status = 'salla_connected';
  await saveActivationStatus(id, status);

  // Check if WhatsApp is already connected → if so, fully activate
  if (status.steps[ACTIVATION_STEPS.WHATSAPP_CONNECTED]) {
    return await activateAll(id, status);
  }

  // Deploy email-only sequences immediately (WhatsApp sequences wait for QR)
  await deployEmailSequences(id, storeData);

  return {
    status: 'salla_connected',
    nextStep: 'Connect WhatsApp to enable full recovery (WhatsApp + Email + SMS)',
    emailOnly: true
  };
}

/**
 * Called when merchant scans WhatsApp QR and connects.
 * If Salla is already connected → fully activate everything.
 */
async function onWhatsAppConnected(merchantId, phoneInfo) {
  const id = String(merchantId);
  console.log(`📱 [AutoActivation] WhatsApp connected for ${id}`);

  const status = await getActivationStatus(id);
  status.steps[ACTIVATION_STEPS.WHATSAPP_CONNECTED] = {
    completedAt: new Date().toISOString(),
    phone: phoneInfo?.phone || '',
    platform: phoneInfo?.platform || 'unknown'
  };
  status.status = 'whatsapp_connected';
  await saveActivationStatus(id, status);

  // Check if Salla is already connected → if so, fully activate
  if (status.steps[ACTIVATION_STEPS.SALLA_CONNECTED]) {
    return await activateAll(id, status);
  }

  return {
    status: 'whatsapp_connected',
    nextStep: 'Connect your Salla store to start recovering abandoned carts'
  };
}

/**
 * FULL ACTIVATION — Both Salla + WhatsApp are connected.
 * Deploys all sequences, enables AI, starts timing learner.
 */
async function activateAll(merchantId, existingStatus) {
  const id = String(merchantId);
  console.log(`🚀 [AutoActivation] FULL ACTIVATION for ${id}`);

  const status = existingStatus || await getActivationStatus(id);
  const storeData = status.steps[ACTIVATION_STEPS.SALLA_CONNECTED] || {};
  const results = {
    sequences: [],
    channels: [],
    ai: false,
    errors: []
  };

  // 1. Deploy all sequence templates
  try {
    const deployed = await deployAllSequences(id, storeData);
    results.sequences = deployed;
    status.sequencesDeployed = deployed;
    status.steps[ACTIVATION_STEPS.SEQUENCES_DEPLOYED] = {
      completedAt: new Date().toISOString(),
      count: deployed.length,
      types: deployed.map(s => s.type)
    };
  } catch (e) {
    console.error('❌ [AutoActivation] Sequence deployment failed:', e.message);
    results.errors.push(`Sequences: ${e.message}`);
  }

  // 2. Enable AI content generation
  try {
    const aiEnabled = await enableAIContent(id, storeData);
    results.ai = aiEnabled;
    status.steps[ACTIVATION_STEPS.AI_ENABLED] = {
      completedAt: new Date().toISOString(),
      provider: aiEnabled.provider
    };
  } catch (e) {
    console.log('⚠️ [AutoActivation] AI enablement skipped:', e.message);
    results.ai = { enabled: false, fallback: 'templates' };
  }

  // 3. Track active channels
  results.channels = ['email']; // Always available
  if (status.steps[ACTIVATION_STEPS.WHATSAPP_CONNECTED]) {
    results.channels.push('whatsapp');
  }
  status.channelsActive = results.channels;

  // 4. Mark fully active
  status.status = 'fully_active';
  status.activatedAt = new Date().toISOString();
  status.steps[ACTIVATION_STEPS.FULLY_ACTIVE] = {
    completedAt: new Date().toISOString()
  };
  await saveActivationStatus(id, status);

  console.log(`✅ [AutoActivation] ${id} FULLY ACTIVE:`, {
    sequences: results.sequences.length,
    channels: results.channels,
    ai: results.ai?.provider || 'templates'
  });

  return {
    status: 'fully_active',
    ...results,
    message: `تم تفعيل المتجر بالكامل! ${results.sequences.length} رحلات تسويقية جاهزة.`
  };
}

// ==========================================
// SEQUENCE DEPLOYMENT
// ==========================================

/**
 * Deploy email-only sequences (before WhatsApp is connected)
 */
async function deployEmailSequences(merchantId, storeData) {
  const id = String(merchantId);
  const category = storeData?.category || 'general';
  const deployed = [];

  // Cart recovery - email only
  try {
    const cartRecovery = buildCartRecoverySequence(id, category, ['email']);
    await saveSequenceConfig(id, 'cart_recovery', cartRecovery);
    deployed.push({ type: 'cart_recovery', channels: ['email'] });
  } catch (e) {
    console.log('⚠️ Email cart_recovery deploy failed:', e.message);
  }

  console.log(`📧 [AutoActivation] Deployed ${deployed.length} email sequences for ${id}`);
  return deployed;
}

/**
 * Deploy ALL sequences (WhatsApp + Email + SMS)
 */
async function deployAllSequences(merchantId, storeData) {
  const id = String(merchantId);
  const category = storeData?.category || 'general';
  const channels = ['whatsapp', 'email', 'sms'];
  const deployed = [];

  // 1. Abandoned Cart Recovery (the money-maker)
  try {
    const cartRecovery = buildCartRecoverySequence(id, category, channels);
    await saveSequenceConfig(id, 'cart_recovery', cartRecovery);
    deployed.push({ type: 'cart_recovery', channels, steps: cartRecovery.steps.length });
  } catch (e) {
    console.log('⚠️ cart_recovery deploy failed:', e.message);
  }

  // 2. Post-Purchase (builds loyalty + upsell)
  try {
    const postPurchase = buildPostPurchaseSequence(id, category, channels);
    await saveSequenceConfig(id, 'post_purchase', postPurchase);
    deployed.push({ type: 'post_purchase', channels, steps: postPurchase.steps.length });
  } catch (e) {
    console.log('⚠️ post_purchase deploy failed:', e.message);
  }

  // 3. Welcome (new subscriber)
  try {
    const welcome = buildWelcomeSequence(id, category, channels);
    await saveSequenceConfig(id, 'welcome', welcome);
    deployed.push({ type: 'welcome', channels, steps: welcome.steps.length });
  } catch (e) {
    console.log('⚠️ welcome deploy failed:', e.message);
  }

  // 4. Winback (dormant 30+ days)
  try {
    const winback = buildWinbackSequence(id, category, channels);
    await saveSequenceConfig(id, 'winback', winback);
    deployed.push({ type: 'winback', channels, steps: winback.steps.length });
  } catch (e) {
    console.log('⚠️ winback deploy failed:', e.message);
  }

  console.log(`🚀 [AutoActivation] Deployed ${deployed.length} sequences for ${id}`);
  return deployed;
}

// ==========================================
// SEQUENCE BUILDERS (Pre-built, AI-enhanced)
// ==========================================

/**
 * Build cart recovery sequence
 * Inspired by Attentive: AI personalizes each message
 * Inspired by Klaviyo: 3-step flow with escalating urgency
 */
function buildCartRecoverySequence(merchantId, category, channels) {
  return {
    type: 'cart_recovery',
    merchantId,
    active: true,
    createdAt: new Date().toISOString(),
    aiPersonalization: true,
    steps: [
      {
        step: 1,
        delay: 30 * 60 * 1000, // 30 minutes
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'gentle_reminder',
        discount: 0,
        aiPrompt: 'gentle_nudge',
        template: {
          whatsapp: 'مرحباً {name}! 👋\n\nلاحظنا أنك تصفحت بعض المنتجات الرائعة 🛍️\n\n{products}\n\n💰 القيمة: {cartValue} ر.س\n\nهل تحتاج مساعدة؟ 🤝\n\n👈 أكمل طلبك: {checkoutUrl}',
          email: {
            subject: 'سلتك بانتظارك 🛒',
            body: 'مرحباً {name}، تركت بعض المنتجات في سلتك. نحتفظ بها لك!'
          }
        }
      },
      {
        step: 2,
        delay: 6 * 60 * 60 * 1000, // 6 hours
        channels: channels.includes('whatsapp') ? ['whatsapp', 'email'] : ['email'],
        messageType: 'offer',
        discount: 10,
        aiPrompt: 'personalized_offer',
        template: {
          whatsapp: '{name}، لسا مهتم؟ 🤔\n\nعندنا عرض خاص لك:\n🎁 خصم {discount}% على سلتك!\n\n{products}\n\n⏰ العرض صالح لمدة {hours} ساعات فقط\n\n🔗 {checkoutUrl}',
          email: {
            subject: '🎁 خصم خاص على سلتك - {discount}%',
            body: 'مرحباً {name}، جهزنا لك عرض خاص! خصم {discount}% على منتجاتك.'
          }
        }
      },
      {
        step: 3,
        delay: 24 * 60 * 60 * 1000, // 24 hours
        channels: channels.includes('whatsapp') ? ['whatsapp', 'sms'] : ['email', 'sms'],
        messageType: 'final_chance',
        discount: 15,
        aiPrompt: 'urgency_scarcity',
        template: {
          whatsapp: '⚡ فرصة أخيرة {name}!\n\nمنتجاتك على وشك النفاد:\n{products}\n\n🏷️ خصم {discount}% + شحن مجاني\n⏰ ينتهي خلال 3 ساعات!\n\n👉 {checkoutUrl}',
          sms: '⚡ {name}، آخر فرصة! خصم {discount}% على سلتك ({cartValue} ر.س). ينتهي اليوم: {checkoutUrl}',
          email: {
            subject: '⚡ آخر فرصة - خصم {discount}% ينتهي اليوم!',
            body: 'مرحباً {name}، هذا آخر تذكير. خصم {discount}% + شحن مجاني.'
          }
        }
      }
    ]
  };
}

/**
 * Build post-purchase sequence
 * Inspired by Klaviyo: Thank you → Review → Upsell
 */
function buildPostPurchaseSequence(merchantId, category, channels) {
  return {
    type: 'post_purchase',
    merchantId,
    active: true,
    createdAt: new Date().toISOString(),
    aiPersonalization: true,
    steps: [
      {
        step: 1,
        delay: 10 * 60 * 1000, // 10 minutes after purchase
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'thank_you',
        aiPrompt: 'warm_thanks',
        template: {
          whatsapp: 'شكراً لك {name}! 🎉\n\nتم تأكيد طلبك بنجاح ✅\n\n📦 رقم الطلب: {orderNumber}\n💰 المبلغ: {orderValue} ر.س\n\nسنعلمك فور شحن طلبك! 🚚',
          email: {
            subject: 'شكراً لطلبك! 🎉',
            body: 'مرحباً {name}، شكراً لتسوقك معنا. طلبك #{orderNumber} قيد التحضير.'
          }
        }
      },
      {
        step: 2,
        delay: 3 * 24 * 60 * 60 * 1000, // 3 days
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'review_request',
        aiPrompt: 'friendly_review',
        template: {
          whatsapp: 'مرحباً {name}! 😊\n\nنتمنى أن منتجاتك أعجبتك!\n\n⭐ شاركنا رأيك وساعد عملاء آخرين:\n{reviewUrl}\n\n🎁 كمكافأة: خصم 5% على طلبك القادم!',
          email: {
            subject: 'كيف كانت تجربتك؟ ⭐',
            body: 'مرحباً {name}، نود سماع رأيك! شاركنا تقييمك واحصل على خصم 5%.'
          }
        }
      },
      {
        step: 3,
        delay: 14 * 24 * 60 * 60 * 1000, // 14 days
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'upsell',
        aiPrompt: 'smart_recommendation',
        template: {
          whatsapp: 'مرحباً {name}! 👋\n\nبناءً على مشترياتك السابقة، ننصحك بـ:\n\n{recommendations}\n\n🎁 خصم 10% لعملائنا المميزين\n\n🛍️ تسوق الآن: {storeUrl}',
          email: {
            subject: '🎁 منتجات مختارة لك خصيصاً',
            body: 'مرحباً {name}، بناءً على ذوقك، اخترنا لك هذه المنتجات.'
          }
        }
      }
    ]
  };
}

/**
 * Build welcome sequence for new subscribers
 */
function buildWelcomeSequence(merchantId, category, channels) {
  return {
    type: 'welcome',
    merchantId,
    active: true,
    createdAt: new Date().toISOString(),
    aiPersonalization: true,
    steps: [
      {
        step: 1,
        delay: 0, // Immediate
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'welcome',
        discount: 10,
        aiPrompt: 'warm_welcome',
        template: {
          whatsapp: 'أهلاً وسهلاً {name}! 🎉\n\nشكراً لانضمامك!\n\n🎁 هديتك: كود خصم {discount}% على أول طلب\n💳 الكود: WELCOME{discount}\n\n🛍️ تسوق الآن: {storeUrl}',
          email: {
            subject: '🎉 أهلاً بك! هديتك بالداخل',
            body: 'مرحباً {name}، شكراً لانضمامك! استخدم كود WELCOME{discount} للحصول على خصم {discount}%.'
          }
        }
      },
      {
        step: 2,
        delay: 24 * 60 * 60 * 1000, // 24 hours
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'top_products',
        aiPrompt: 'curated_picks',
        template: {
          whatsapp: 'مرحباً {name}! 😊\n\nشوف أكثر منتجاتنا مبيعاً:\n\n{topProducts}\n\n🔥 الأكثر طلباً هذا الأسبوع!\n\n🛍️ {storeUrl}',
          email: {
            subject: '🔥 الأكثر مبيعاً - اختيارات مميزة لك',
            body: 'مرحباً {name}، تعرف على أكثر منتجاتنا مبيعاً!'
          }
        }
      }
    ]
  };
}

/**
 * Build winback sequence for dormant customers (30+ days)
 */
function buildWinbackSequence(merchantId, category, channels) {
  return {
    type: 'winback',
    merchantId,
    active: true,
    createdAt: new Date().toISOString(),
    aiPersonalization: true,
    steps: [
      {
        step: 1,
        delay: 0, // Immediate when marked dormant
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'miss_you',
        discount: 15,
        aiPrompt: 'personal_winback',
        template: {
          whatsapp: 'مرحباً {name}! 💙\n\nاشتقنا لك! مرّ وقت من آخر زيارة.\n\n🎁 عرض خاص لك: خصم {discount}%\n💳 الكود: MISSYOU{discount}\n⏰ صالح لمدة 48 ساعة\n\n🛍️ {storeUrl}',
          email: {
            subject: '💙 اشتقنا لك! عرض خاص بانتظارك',
            body: 'مرحباً {name}، مرت فترة من آخر زيارة. جهزنا لك خصم {discount}%!'
          }
        }
      },
      {
        step: 2,
        delay: 3 * 24 * 60 * 60 * 1000, // 3 days
        channels: channels.includes('whatsapp') ? ['whatsapp'] : ['email'],
        messageType: 'bigger_offer',
        discount: 20,
        aiPrompt: 'urgency_winback',
        template: {
          whatsapp: '{name}، آخر فرصة! 🔥\n\nرفعنا الخصم لـ {discount}%!\n\n🎁 أكبر خصم نقدمه\n⏰ ينتهي غداً\n💳 الكود: COMEBACK{discount}\n\n👉 {storeUrl}',
          email: {
            subject: '🔥 رفعنا الخصم! {discount}% ينتهي غداً',
            body: '{name}، هذا أكبر خصم نقدمه. {discount}% على كل شيء. ينتهي غداً!'
          }
        }
      }
    ]
  };
}

// ==========================================
// SEQUENCE CONFIG STORAGE (Firestore)
// ==========================================

async function saveSequenceConfig(merchantId, type, config) {
  try {
    const db = admin.firestore();
    await db.collection('store_sequences').doc(`${merchantId}_${type}`).set({
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`💾 Saved sequence config: ${merchantId}/${type}`);
  } catch (e) {
    console.log('⚠️ saveSequenceConfig error:', e.message);
  }
}

async function getSequenceConfig(merchantId, type) {
  try {
    const db = admin.firestore();
    const doc = await db.collection('store_sequences').doc(`${merchantId}_${type}`).get();
    return doc.exists ? doc.data() : null;
  } catch (e) {
    return null;
  }
}

async function getAllSequenceConfigs(merchantId) {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('store_sequences')
      .where('merchantId', '==', String(merchantId))
      .get();
    const configs = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      configs[data.type] = data;
    });
    return configs;
  } catch (e) {
    return {};
  }
}

// ==========================================
// AI CONTENT ENABLEMENT
// ==========================================

async function enableAIContent(merchantId, storeData) {
  const provider = process.env.GROQ_API_KEY ? 'groq' :
                   process.env.GEMINI_API_KEY ? 'gemini' : 'templates';

  console.log(`🤖 [AutoActivation] AI provider for ${merchantId}: ${provider}`);

  // Save AI config for this merchant
  try {
    const db = admin.firestore();
    await db.collection('store_activation').doc(String(merchantId)).set({
      ai: {
        provider,
        enabled: provider !== 'templates',
        storeCategory: storeData?.category || 'general',
        language: 'ar',
        tone: 'friendly_saudi',
        enabledAt: new Date().toISOString()
      }
    }, { merge: true });
  } catch (e) {
    console.log('⚠️ AI config save error:', e.message);
  }

  return { enabled: provider !== 'templates', provider };
}

// ==========================================
// SMART MESSAGE PERSONALIZATION
// ==========================================

/**
 * Generate a personalized message using AI (Groq/Gemini) for a specific
 * sequence step + customer context. Falls back to templates if AI unavailable.
 *
 * This is the "Attentive AI" equivalent — every message is unique per customer.
 */
async function personalizeMessage(step, customerData, cartData, merchantId) {
  const template = step.template;
  const channel = step.channels[0]; // Primary channel

  // Basic variable replacement (always works, even without AI)
  const baseVars = {
    '{name}': customerData?.name || 'عميلنا العزيز',
    '{cartValue}': cartData?.total || cartData?.value || '0',
    '{checkoutUrl}': cartData?.checkoutUrl || cartData?.url || '#',
    '{storeUrl}': cartData?.storeUrl || '#',
    '{discount}': String(step.discount || 0),
    '{hours}': '6',
    '{orderNumber}': cartData?.orderNumber || cartData?.orderId || '',
    '{orderValue}': cartData?.orderValue || '0',
    '{products}': formatProductList(cartData?.items || cartData?.products || []),
    '{topProducts}': 'أكثر منتجاتنا مبيعاً ✨',
    '{recommendations}': 'منتجات مختارة لك ✨',
    '{reviewUrl}': cartData?.reviewUrl || '#'
  };

  let message = '';
  if (channel === 'whatsapp' && template?.whatsapp) {
    message = template.whatsapp;
  } else if (channel === 'sms' && template?.sms) {
    message = template.sms;
  } else if (template?.email) {
    message = template.email.body;
  }

  // Replace template variables
  for (const [key, value] of Object.entries(baseVars)) {
    message = message.split(key).join(value);
  }

  // Try AI personalization if available
  if (step.aiPersonalization !== false && contentGenerator) {
    try {
      const aiMessage = await contentGenerator.personalizeForCustomer({
        baseMessage: message,
        customerName: customerData?.name,
        cartValue: cartData?.total || cartData?.value,
        products: cartData?.items || cartData?.products,
        messageType: step.messageType,
        channel,
        category: customerData?.segment || 'general'
      });
      if (aiMessage) {
        message = aiMessage;
      }
    } catch (e) {
      // AI failed, use template (graceful fallback)
      console.log('⚠️ AI personalization failed, using template:', e.message);
    }
  }

  return message;
}

/**
 * Format product list for WhatsApp/SMS messages
 */
function formatProductList(items) {
  if (!items || items.length === 0) return 'منتجاتك المفضلة';
  return items.slice(0, 3).map((item, i) => {
    const name = item.name || item.title || item.product_name || `منتج ${i + 1}`;
    const price = item.price || item.amount || '';
    return price ? `• ${name} - ${price} ر.س` : `• ${name}`;
  }).join('\n');
}

// ==========================================
// PROCESS INCOMING EVENTS (Auto-routing)
// ==========================================

/**
 * Process an abandoned cart event automatically.
 * Uses the merchant's deployed sequence config (or falls back to default).
 */
async function processAbandonedCart(merchantId, cartData) {
  const id = String(merchantId);

  // Get merchant's sequence config
  const config = await getSequenceConfig(id, 'cart_recovery');
  if (!config || !config.active) {
    console.log(`⚠️ [AutoActivation] No active cart_recovery for ${id}, using lifecycleEngine fallback`);
    // Fall back to existing lifecycleEngine
    if (lifecycleEngine) {
      return lifecycleEngine.processEvent('cart.abandoned', id, cartData);
    }
    return null;
  }

  // Use existing sequenceEngine with our config
  if (sequenceEngine) {
    const customerEmail = cartData?.customer?.email || cartData?.email || '';
    const customerPhone = cartData?.customer?.phone || cartData?.phone || '';

    await sequenceEngine.startSequence('cart_recovery', id, customerEmail, {
      phone: customerPhone,
      name: cartData?.customer?.name || cartData?.name || '',
      cartValue: cartData?.total || cartData?.amounts?.total || 0,
      items: cartData?.items || cartData?.products || [],
      checkoutUrl: cartData?.checkout_url || cartData?.url || '',
      cartId: cartData?.id || cartData?.cart_id || ''
    });

    console.log(`🛒 [AutoActivation] Cart recovery started for ${customerEmail || customerPhone} (${id})`);
    return { started: true, type: 'cart_recovery' };
  }

  return null;
}

/**
 * Process order created — cancel recovery, start post-purchase
 */
async function processOrderCreated(merchantId, orderData) {
  const id = String(merchantId);
  const customerEmail = orderData?.customer?.email || orderData?.email || '';

  // Cancel any active cart recovery
  if (sequenceEngine && customerEmail) {
    await sequenceEngine.cancelSequence('cart_recovery', id, customerEmail);
    console.log(`🛑 [AutoActivation] Cancelled cart recovery for ${customerEmail} — they purchased!`);
  }

  // Start post-purchase sequence
  const config = await getSequenceConfig(id, 'post_purchase');
  if (config && config.active && sequenceEngine) {
    await sequenceEngine.startSequence('post_purchase', id, customerEmail, {
      name: orderData?.customer?.name || '',
      orderNumber: orderData?.reference_id || orderData?.id || '',
      orderValue: orderData?.amounts?.total || orderData?.total || 0,
      items: orderData?.items || [],
      storeUrl: orderData?.store_url || ''
    });
    console.log(`🎉 [AutoActivation] Post-purchase started for ${customerEmail} (${id})`);
  }

  // Record for timing learner
  if (timingLearner && customerEmail) {
    try {
      await timingLearner.recordReply(id, customerEmail, new Date(), 0);
    } catch (e) { /* silent */ }
  }

  return { cartRecoveryCancelled: true, postPurchaseStarted: !!config?.active };
}

/**
 * Process new customer — start welcome sequence
 */
async function processNewCustomer(merchantId, customerData) {
  const id = String(merchantId);
  const email = customerData?.email || '';

  const config = await getSequenceConfig(id, 'welcome');
  if (config && config.active && sequenceEngine) {
    await sequenceEngine.startSequence('welcome', id, email, {
      name: customerData?.name || customerData?.first_name || '',
      phone: customerData?.phone || customerData?.mobile || '',
      storeUrl: customerData?.store_url || ''
    });
    console.log(`👋 [AutoActivation] Welcome sequence started for ${email} (${id})`);
    return { started: true, type: 'welcome' };
  }

  return null;
}

// ==========================================
// TOGGLE SEQUENCES ON/OFF
// ==========================================

async function toggleSequence(merchantId, type, active) {
  const id = String(merchantId);
  const config = await getSequenceConfig(id, type);
  if (config) {
    config.active = active;
    await saveSequenceConfig(id, type, config);
    console.log(`🔄 [AutoActivation] ${type} ${active ? 'enabled' : 'disabled'} for ${id}`);
    return { type, active };
  }
  return null;
}

// ==========================================
// DASHBOARD DATA
// ==========================================

async function getActivationDashboard(merchantId) {
  const id = String(merchantId);
  const status = await getActivationStatus(id);
  const sequences = await getAllSequenceConfigs(id);

  return {
    status: status.status,
    activatedAt: status.activatedAt,
    channels: status.channelsActive || [],
    sequences: Object.entries(sequences).map(([type, config]) => ({
      type,
      active: config.active,
      steps: config.steps?.length || 0,
      aiPersonalization: config.aiPersonalization || false,
      channels: config.steps?.[0]?.channels || [],
      createdAt: config.createdAt
    })),
    steps: {
      sallaConnected: !!status.steps[ACTIVATION_STEPS.SALLA_CONNECTED],
      whatsappConnected: !!status.steps[ACTIVATION_STEPS.WHATSAPP_CONNECTED],
      sequencesDeployed: !!status.steps[ACTIVATION_STEPS.SEQUENCES_DEPLOYED],
      aiEnabled: !!status.steps[ACTIVATION_STEPS.AI_ENABLED],
      fullyActive: status.status === 'fully_active'
    }
  };
}

module.exports = {
  // Core activation
  onSallaConnected,
  onWhatsAppConnected,
  activateAll,

  // Event processors (auto-routing)
  processAbandonedCart,
  processOrderCreated,
  processNewCustomer,

  // Sequence management
  toggleSequence,
  getSequenceConfig,
  getAllSequenceConfigs,

  // Message personalization
  personalizeMessage,

  // Dashboard
  getActivationStatus,
  getActivationDashboard,

  // Constants
  ACTIVATION_STEPS
};
