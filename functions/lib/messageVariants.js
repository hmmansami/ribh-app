/**
 * WhatsApp Cart Abandonment Message Variants
 * For A/B testing different messaging styles
 */

/**
 * Urgency variant - Heavy urgency/scarcity messaging
 * @param {string} customerName 
 * @param {number} cartValue 
 * @param {string[]} productNames 
 * @returns {string}
 */
function urgency(customerName, cartValue, productNames) {
  const products = productNames.slice(0, 2).join(' و ');
  return `⚠️ ${customerName}، سلتك على وشك الانتهاء!

🔥 ${products} ${productNames.length > 2 ? `و ${productNames.length - 2} منتجات أخرى` : ''}
💰 المجموع: ${cartValue} ر.س

⏰ *ينتهي العرض خلال ساعة واحدة!*
الكمية محدودة جداً - لا تفوّت الفرصة

أكمل طلبك الآن 👇`;
}

/**
 * Friendly variant - Casual, warm tone like a friend
 * @param {string} customerName 
 * @param {number} cartValue 
 * @param {string[]} productNames 
 * @returns {string}
 */
function friendly(customerName, cartValue, productNames) {
  const product = productNames[0];
  return `هلا ${customerName} 👋

شفت إنك اخترت ${product} - ذوقك حلو والله! 😍

سلتك لسه موجودة (${cartValue} ر.س) وجاهزة لك متى ما حبيت تكمل.

لو عندك أي سؤال أو محتاج مساعدة، أنا هنا! 💬`;
}

/**
 * Minimal variant - Super short, essentials only
 * @param {string} customerName 
 * @param {number} cartValue 
 * @param {string[]} productNames 
 * @returns {string}
 */
function minimal(customerName, cartValue, productNames) {
  return `${customerName}، سلتك بانتظارك (${cartValue} ر.س) 🛒
أكمل الطلب: ribh.store/cart`;
}

/**
 * Social proof variant - Mentions others buying
 * @param {string} customerName 
 * @param {number} cartValue 
 * @param {string[]} productNames 
 * @returns {string}
 */
function socialProof(customerName, cartValue, productNames) {
  const product = productNames[0];
  const buyersCount = Math.floor(Math.random() * 100) + 80; // 80-179
  return `مرحباً ${customerName} 👋

${product} من أكثر المنتجات طلباً عندنا!
📊 *${buyersCount} شخص اشتروا هذا المنتج اليوم*

سلتك جاهزة: ${cartValue} ر.س

انضم للعملاء السعداء وأكمل طلبك الآن ✨`;
}

/**
 * Question variant - Asks if there was a problem
 * @param {string} customerName 
 * @param {number} cartValue 
 * @param {string[]} productNames 
 * @returns {string}
 */
function question(customerName, cartValue, productNames) {
  const products = productNames.slice(0, 2).join(' و ');
  return `مرحباً ${customerName} 🤔

لاحظنا إنك ما أكملت طلبك (${products})

*هل واجهتك مشكلة؟*

• مشكلة في الدفع؟
• عندك سؤال عن المنتج؟
• تحتاج مساعدة؟

رد على هذه الرسالة وبنساعدك فوراً! 💬

سلتك: ${cartValue} ر.س`;
}

/**
 * All variant functions
 */
const variants = {
  urgency,
  friendly,
  minimal,
  socialProof,
  question
};

/**
 * Get a random variant for A/B testing
 * @returns {{ name: string, generator: Function }}
 */
function getRandomVariant() {
  const names = Object.keys(variants);
  const randomName = names[Math.floor(Math.random() * names.length)];
  return {
    name: randomName,
    generator: variants[randomName]
  };
}

/**
 * Get a specific variant by name
 * @param {string} name 
 * @returns {Function|null}
 */
function getVariant(name) {
  return variants[name] || null;
}

module.exports = {
  urgency,
  friendly,
  minimal,
  socialProof,
  question,
  variants,
  getRandomVariant,
  getVariant
};

// Test when run directly
if (require.main === module) {
  const testData = {
    customerName: 'أحمد',
    cartValue: 299,
    productNames: ['ساعة ذكية', 'سماعات بلوتوث', 'شاحن سريع']
  };

  console.log('='.repeat(50));
  console.log('🧪 Testing Message Variants');
  console.log('='.repeat(50));
  
  console.log('\n📌 1. URGENCY:\n');
  console.log(urgency(testData.customerName, testData.cartValue, testData.productNames));
  
  console.log('\n' + '-'.repeat(50));
  console.log('\n📌 2. FRIENDLY:\n');
  console.log(friendly(testData.customerName, testData.cartValue, testData.productNames));
  
  console.log('\n' + '-'.repeat(50));
  console.log('\n📌 3. MINIMAL:\n');
  console.log(minimal(testData.customerName, testData.cartValue, testData.productNames));
  
  console.log('\n' + '-'.repeat(50));
  console.log('\n📌 4. SOCIAL PROOF:\n');
  console.log(socialProof(testData.customerName, testData.cartValue, testData.productNames));
  
  console.log('\n' + '-'.repeat(50));
  console.log('\n📌 5. QUESTION:\n');
  console.log(question(testData.customerName, testData.cartValue, testData.productNames));
  
  console.log('\n' + '='.repeat(50));
  console.log('\n🎲 Random Variant Test (3x):');
  for (let i = 0; i < 3; i++) {
    const { name } = getRandomVariant();
    console.log(`  → Pick ${i + 1}: ${name}`);
  }
  console.log('\n' + '='.repeat(50));
}
