/**
 * ToneAdapter - Matches customer communication style
 * Rule-based, lightweight, no ML required
 */

// Arabic formal indicators
const FORMAL_AR = ['حضرتك', 'سيدي', 'سيدتي', 'أستاذ', 'تفضل', 'لو سمحت', 'من فضلك', 'شكراً جزيلاً'];
const CASUAL_AR = ['هلا', 'كيفك', 'وش', 'ايش', 'يب', 'اوكي', 'تمام', 'حبيبي', 'يالغالي'];

// Common emojis to detect
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

/**
 * Analyze messages to detect communication style
 * @param {string[]} messages - Array of customer's past messages
 * @returns {Object} Style profile
 */
function detectStyle(messages) {
  if (!messages || messages.length === 0) {
    return getDefaultStyle();
  }

  const allText = messages.join(' ');
  const avgLength = messages.reduce((sum, m) => sum + m.length, 0) / messages.length;
  
  // Emoji detection
  const emojiCount = (allText.match(EMOJI_REGEX) || []).length;
  const usesEmojis = emojiCount >= messages.length * 0.3; // ~30% of messages have emojis
  
  // Length preference
  const isShort = avgLength < 30;
  const isLong = avgLength > 100;
  
  // Formality detection (Arabic-aware)
  const formalScore = FORMAL_AR.filter(w => allText.includes(w)).length;
  const casualScore = CASUAL_AR.filter(w => allText.includes(w)).length;
  const isFormal = formalScore > casualScore;
  
  // Rushed detection (multiple ? or !, very short, no greetings)
  const hasUrgency = (allText.match(/[?!]{2,}/g) || []).length > 0;
  const isRushed = isShort && hasUrgency;
  
  // Question frequency (they ask lots of questions = give detailed answers)
  const questionCount = (allText.match(/[?؟]/g) || []).length;
  const asksQuestions = questionCount >= messages.length * 0.5;

  return {
    usesEmojis,
    length: isShort ? 'short' : isLong ? 'long' : 'medium',
    formal: isFormal,
    rushed: isRushed,
    asksQuestions,
    // Raw metrics for debugging
    _metrics: { avgLength, emojiCount, formalScore, casualScore, questionCount }
  };
}

function getDefaultStyle() {
  return {
    usesEmojis: false,
    length: 'medium',
    formal: true,
    rushed: false,
    asksQuestions: false
  };
}

/**
 * Adapt a message to match customer's style
 * @param {string} message - Our original message
 * @param {Object} style - Style profile from detectStyle()
 * @returns {string} Adapted message
 */
function adaptMessage(message, style) {
  if (!style) return message;
  
  let adapted = message;
  
  // 1. Handle length - trim if they prefer short
  if (style.rushed || style.length === 'short') {
    adapted = trimMessage(adapted);
  }
  
  // 2. Add emojis if they use them
  if (style.usesEmojis && !hasEmojis(adapted)) {
    adapted = addEmojis(adapted);
  }
  
  // 3. Remove emojis if they don't use them (keep it professional)
  if (!style.usesEmojis) {
    adapted = removeEmojis(adapted);
  }
  
  // 4. Adjust formality
  if (!style.formal) {
    adapted = makeCasual(adapted);
  }
  
  return adapted.trim();
}

// Helper: Trim to essential info
function trimMessage(msg) {
  // Remove filler phrases
  const fillers = [
    'نود أن نعلمك', 'يسعدنا أن', 'نتمنى لك يوماً سعيداً',
    'شكراً لتواصلك معنا', 'نحن سعداء بخدمتك'
  ];
  let trimmed = msg;
  fillers.forEach(f => { trimmed = trimmed.replace(f, ''); });
  
  // Take first 2 sentences max if still long
  const sentences = trimmed.split(/[.،!؟]/).filter(s => s.trim());
  if (sentences.length > 2) {
    trimmed = sentences.slice(0, 2).join('. ');
  }
  return trimmed.replace(/\s+/g, ' ').replace(/[\s.]+$/g, '').trim();
}

// Helper: Check for emojis
function hasEmojis(text) {
  return /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(text);
}

// Helper: Remove emojis
function removeEmojis(text) {
  return text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
}

// Helper: Add contextual emojis
function addEmojis(msg) {
  // Add emoji based on message type
  if (msg.includes('شكر') || msg.includes('شحن')) return msg + ' 🙏';
  if (msg.includes('طلب') || msg.includes('منتج')) return msg + ' 📦';
  if (msg.includes('مساعد')) return msg + ' 💬';
  if (msg.includes('تم') || msg.includes('جاهز')) return msg + ' ✅';
  return msg + ' 😊';
}

// Helper: Make Arabic more casual
function makeCasual(msg) {
  return msg
    .replace('حضرتك', 'أنت')
    .replace('من فضلك', 'لو سمحت')
    .replace('شكراً جزيلاً', 'شكراً')
    .replace('نود إعلامكم', 'بنبلغك');
}

// ==================== TESTS ====================
function runTests() {
  console.log('🧪 ToneAdapter Tests\n');
  
  // Test 1: Emoji user
  const emojiStyle = detectStyle(['هلا 😊', 'وين طلبي؟ 📦', 'شكراً ❤️']);
  console.log('Test 1 - Emoji user:', emojiStyle.usesEmojis ? '✅' : '❌');
  
  // Test 2: Formal user
  const formalStyle = detectStyle(['السلام عليكم، لو سمحت أريد الاستفسار', 'شكراً جزيلاً حضرتك']);
  console.log('Test 2 - Formal user:', formalStyle.formal ? '✅' : '❌');
  
  // Test 3: Rushed user
  const rushedStyle = detectStyle(['وين طلبي??', 'متى؟!']);
  console.log('Test 3 - Rushed user:', rushedStyle.rushed ? '✅' : '❌');
  
  // Test 4: Short messages
  const shortStyle = detectStyle(['هلا', 'اوكي', 'تمام']);
  console.log('Test 4 - Short style:', shortStyle.length === 'short' ? '✅' : '❌');
  
  // Test 5: Adapt message - add emoji
  const adapted1 = adaptMessage('تم شحن طلبك', { usesEmojis: true, length: 'medium', formal: true });
  console.log('Test 5 - Add emoji:', hasEmojis(adapted1) ? '✅' : '❌', adapted1);
  
  // Test 6: Adapt message - keep formal, no emoji
  const adapted2 = adaptMessage('تم شحن طلبك 📦', { usesEmojis: false, length: 'medium', formal: true });
  console.log('Test 6 - Remove emoji:', !hasEmojis(adapted2) ? '✅' : '❌', adapted2);
  
  // Test 7: Trim for rushed
  const longMsg = 'نود أن نعلمك أن طلبك تم شحنه. نتمنى لك يوماً سعيداً. شكراً لتواصلك معنا.';
  const adapted3 = adaptMessage(longMsg, { rushed: true, usesEmojis: false });
  console.log('Test 7 - Trim rushed:', adapted3.length < longMsg.length ? '✅' : '❌', adapted3);
  
  console.log('\n✅ All tests complete!');
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

module.exports = { detectStyle, adaptMessage, runTests };
