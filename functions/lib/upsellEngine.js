/**
 * 🚀 RIBH Post-Purchase Upsell Engine
 * Order → AI upsell → WhatsApp → One-click add | Target: 20-30% AOV increase
 */
const { sendMessage } = require('./whatsappSender');
const { createDiscountCode } = require('./discountCodes');
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const RIBH_BASE_URL = process.env.RIBH_BASE_URL || 'https://ribh.app';

const UPSELL_MAP = {
  fashion: ['accessories', 'shoes', 'bags'], electronics: ['accessories', 'protection', 'cables'],
  beauty: ['skincare', 'tools', 'sets'], food: ['drinks', 'snacks', 'combos'],
  furniture: ['decor', 'lighting', 'textiles'], default: ['bestsellers', 'trending', 'bundles']
};

const DISCOUNT_TIERS = [
  { min: 500, discount: 25, emoji: '👑' }, { min: 300, discount: 20, emoji: '🔥' },
  { min: 150, discount: 15, emoji: '⚡' }, { min: 0, discount: 10, emoji: '🎁' }
];

/** Find related upsell products based on what customer bought */
function getUpsellProducts(orderProducts, storeProducts = []) {
  const boughtIds = new Set(orderProducts.map(p => p.id || p.product_id));
  const boughtCategories = orderProducts.map(p => p.category || 'default');
  
  // Find related categories
  const relatedCategories = new Set();
  boughtCategories.forEach(cat => {
    (UPSELL_MAP[cat] || UPSELL_MAP.default).forEach(r => relatedCategories.add(r));
  });
  
  // Filter store products: not already bought, in related categories, in stock
  const candidates = storeProducts.filter(p => 
    !boughtIds.has(p.id) && 
    relatedCategories.has(p.category) &&
    (p.quantity > 0 || p.in_stock !== false)
  );
  
  const scored = candidates.map(p => ({
    ...p,
    score: (p.sales_count || 0) * 2 + (p.margin || 0) + (p.featured ? 50 : 0)
  }));
  
  // Return top 3 upsell candidates
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** AI generates personalized Arabic upsell message */
async function generateUpsellOffer(customer, products, orderValue) {
  const tier = DISCOUNT_TIERS.find(t => orderValue >= t.min) || DISCOUNT_TIERS[3];
  const productNames = products.map(p => p.name).slice(0, 2).join(' أو ');
  
  const fallback = {
    message: `شكراً على طلبك ${customer.name || 'عميلنا'}! 🎉\n${tier.emoji} عرض خاص: أضف ${productNames} بخصم ${tier.discount}%\n⏰ ينتهي خلال 24 ساعة - اضغط للإضافة ←`,
    discount: tier.discount, product: products[0]
  };
  
  if (!GROQ_API_KEY) return fallback;
  
  try {
    const prompt = `أنت خبير تسويق سعودي. اكتب رسالة واتساب قصيرة (3 أسطر) لعرض بعد الشراء.
العميل: ${customer.name || 'عميل'} | قيمة الطلب: ${orderValue} ريال
المنتج المقترح: ${productNames} | الخصم: ${tier.discount}%
اكتب رسالة ودية تشكره وتعرض المنتج. ابدأ بـ "شكراً" وانتهي بـ "←"`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8, max_tokens: 200
      })
    });
    
    const data = await res.json();
    const aiMessage = data.choices?.[0]?.message?.content;
    
    return aiMessage ? { message: aiMessage, discount: tier.discount, product: products[0] } : fallback;
  } catch (e) {
    return fallback;
  }
}

/** Generate one-click upsell link (adds to order or creates new with discount) */
function createUpsellLink(orderId, productId, discount, storeId, platform = 'salla') {
  const token = Buffer.from(`${orderId}:${productId}:${discount}:${Date.now()}`).toString('base64url');
  return `${RIBH_BASE_URL}/upsell/${storeId}/${token}?platform=${platform}`;
}

/** 🎯 Main: Process order for upsell (called by order.created webhook) */
async function processOrderForUpsell(order, storeConfig = {}) {
  const { storeId, platform = 'salla', storeProducts = [], accessToken } = storeConfig;
  
  // Extract order data (normalize Salla/Shopify)
  const customer = {
    name: order.customer?.first_name || order.customer?.name || order.billing?.first_name,
    phone: order.customer?.mobile || order.customer?.phone || order.billing?.phone,
    email: order.customer?.email || order.billing?.email
  };
  
  const orderProducts = order.items || order.line_items || [];
  const orderValue = parseFloat(order.total || order.total_price || 0);
  
  if (!customer.phone || orderProducts.length === 0) {
    return { success: false, reason: 'Missing phone or products' };
  }
  
  // 1. Find upsell products
  const upsellProducts = getUpsellProducts(orderProducts, storeProducts);
  if (upsellProducts.length === 0) {
    return { success: false, reason: 'No upsell products found' };
  }
  
  // 2. Generate AI upsell offer
  const offer = await generateUpsellOffer(customer, upsellProducts, orderValue);
  
  // 3. Create discount code
  const discountCode = await createDiscountCode(
    storeId, customer.email || customer.phone, offer.discount, 24, accessToken
  );
  
  // 4. Create one-click link
  const upsellLink = createUpsellLink(
    order.id, offer.product.id, offer.discount, storeId, platform
  );
  
  // 5. Send WhatsApp
  const fullMessage = `${offer.message}\n\n🏷️ كود الخصم: ${discountCode.code}\n🔗 ${upsellLink}`;
  const result = await sendMessage(customer.phone, fullMessage);
  
  return {
    success: result.success,
    orderId: order.id,
    upsellProduct: offer.product.name,
    discount: offer.discount,
    discountCode: discountCode.code,
    link: upsellLink,
    messageId: result.messageId
  };
}

module.exports = {
  getUpsellProducts,
  generateUpsellOffer,
  createUpsellLink,
  processOrderForUpsell,
  UPSELL_MAP,
  DISCOUNT_TIERS
};
