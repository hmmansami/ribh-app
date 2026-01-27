/**
 * Reply Sentiment Detector
 * Rule-based sentiment analysis for Arabic + English WhatsApp messages
 */

// Positive indicators
const POSITIVE_ARABIC = [
  'شكرا', 'شكراً', 'مشكور', 'الله يعطيك العافية', 'يعطيك العافية',
  'ممتاز', 'رائع', 'حلو', 'جميل', 'زين',
  'مبسوط', 'سعيد', 'فرحان', 'الحمدلله', 'ماشاء الله', 'بارك الله',
  'احسنت', 'عظيم', 'خرافي', 'اسطوري', 'نار', 'قمة', 'روعة',
  'يسلمو', 'تسلم', 'الله يسلمك', 'الله يحفظك', 'جزاك الله خير',
  'موفق', 'الله يوفقك', 'حبيبي', 'يالغالي', 'ياغالي'
  // Note: تمام, طيب, اوكي moved to NEUTRAL - they're acknowledgments, not praise
];

const POSITIVE_ENGLISH = [
  'thank', 'thanks', 'thx', 'ty', 'appreciate', 'great', 'good', 'nice',
  'awesome', 'amazing', 'excellent', 'perfect', 'love', 'best', 'wonderful',
  'fantastic', 'brilliant', 'happy', 'glad', 'pleased', 'satisfied',
  'helpful', 'quick', 'fast', 'professional', 'recommend', 'yes', 'yep', 'yeah'
];

const POSITIVE_EMOJI = [
  '😊', '😃', '😄', '😁', '🙂', '😍', '🥰', '❤️', '💕', '💖', '💗', '💙', '💚',
  '👍', '👏', '🙏', '✅', '💯', '🎉', '🔥', '⭐', '🌟', '✨', '😘', '🤗', '💪',
  '😂', '🤣', '😆' // Laughing = positive sentiment
];

// Negative indicators
const NEGATIVE_ARABIC = [
  'سيء', 'سيئ', 'زفت', 'خرب', 'فاشل', 'مو زين', 'مب زين', 'مش كويس',
  'متأخر', 'تأخر', 'وين', 'فين', 'ليش', 'ليه', 'كيف', 'مشكلة', 'خطأ',
  'غلط', 'خربان', 'معطل', 'مكسور', 'ناقص', 'زعلان', 'مستاء', 'محبط',
  'الغاء', 'الغي', 'كنسل', 'ارجع', 'رجع', 'استرجع', 'فلوسي', 'رد فلوسي',
  'نصب', 'نصاب', 'غش', 'كذب', 'كذاب', 'حرامي', 'سرقة',
  'لا شكرا', 'لا شكراً', 'مو مهتم', 'مش مهتم', 'ما ابي', 'ما أبي', 'مابي',
  'لا اريد', 'لا أريد', 'ما اريد', 'ما أريد', 'مااريد', 'ماأريد',
  'مزعج', 'سبام', 'وقف', 'توقف', 'بطل', 'خلاص', 'كفاية', 'بس'
];

const NEGATIVE_ENGLISH = [
  'bad', 'terrible', 'horrible', 'awful', 'worst', 'hate', 'angry', 'upset',
  'disappointed', 'frustrated', 'annoyed', 'problem', 'issue', 'wrong',
  'broken', 'damaged', 'missing', 'late', 'slow', 'never', 'refund', 'cancel',
  'scam', 'fraud', 'fake', 'lie', 'cheat', 'steal', 'useless', 'waste',
  'no thanks', 'not interested', 'unsubscribe', 'stop', 'spam', 'annoying'
];

const NEGATIVE_EMOJI = [
  '😠', '😡', '🤬', '😤', '😢', '😭', '😞', '😔', '😒', '🙄', '👎', '💔',
  '❌', '⛔', '🚫', '😑', '😐', '🤮', '🤢', '💩'
];

// Neutral indicators (explicit) - acknowledgments, not sentiment
const NEUTRAL_WORDS = [
  'ok', 'okay', 'تمام', 'طيب', 'اوكي', 'ماشي', 'انشالله', 'ان شاء الله',
  'بكرة', 'لاحقا', 'بعدين', 'hmm', 'hm', 'ah', 'اها', 'اه', 'ايه'
];

// Strong negative words that override positive signals
const STRONG_NEGATIVE = [
  'problem', 'issue', 'مشكلة', 'خطأ', 'غلط', 'but', 'لكن', 'بس'
];

/**
 * Detect sentiment from message text
 * @param {string} message - The message to analyze
 * @returns {{ sentiment: 'positive'|'negative'|'neutral', confidence: number, reason: string }}
 */
function detectSentiment(message) {
  if (!message || typeof message !== 'string') {
    return { sentiment: 'neutral', confidence: 50, reason: 'empty_or_invalid' };
  }

  const text = message.toLowerCase().trim();
  const originalText = message.trim();
  
  let positiveScore = 0;
  let negativeScore = 0;
  let reasons = [];

  // Check emojis first (strong signals)
  for (const emoji of POSITIVE_EMOJI) {
    if (originalText.includes(emoji)) {
      positiveScore += 30;
      reasons.push(`emoji:${emoji}`);
    }
  }
  
  for (const emoji of NEGATIVE_EMOJI) {
    if (originalText.includes(emoji)) {
      negativeScore += 30;
      reasons.push(`neg_emoji:${emoji}`);
    }
  }

  // Check Arabic patterns
  for (const word of NEGATIVE_ARABIC) {
    if (originalText.includes(word)) {
      negativeScore += 25;
      reasons.push(`ar_neg:${word}`);
    }
  }
  
  for (const word of POSITIVE_ARABIC) {
    if (originalText.includes(word)) {
      positiveScore += 25;
      reasons.push(`ar_pos:${word}`);
    }
  }

  // Check English patterns
  for (const word of NEGATIVE_ENGLISH) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(text)) {
      negativeScore += 25;
      reasons.push(`en_neg:${word}`);
    }
  }
  
  for (const word of POSITIVE_ENGLISH) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(text)) {
      positiveScore += 25;
      reasons.push(`en_pos:${word}`);
    }
  }

  // Punctuation analysis
  const questionMarks = (originalText.match(/\?|؟/g) || []).length;
  const exclamationMarks = (originalText.match(/!/g) || []).length;
  
  if (questionMarks >= 2) {
    negativeScore += 15; // Multiple questions often indicate frustration
    reasons.push('multi_question');
  }
  
  if (exclamationMarks >= 2 && negativeScore > 0) {
    negativeScore += 10; // Exclamations amplify negative sentiment
    reasons.push('emphatic_negative');
  }

  // ALL CAPS detection (frustration in English)
  if (text.length > 3 && originalText === originalText.toUpperCase() && /[A-Z]/.test(originalText)) {
    negativeScore += 15;
    reasons.push('all_caps');
  }

  // Check for strong negative words that override ties
  let hasStrongNegative = false;
  for (const word of STRONG_NEGATIVE) {
    if (text.includes(word) || originalText.includes(word)) {
      hasStrongNegative = true;
      break;
    }
  }

  // Calculate final sentiment
  const totalScore = positiveScore + negativeScore;
  let sentiment, confidence;

  if (totalScore === 0) {
    // Check for explicit neutral words
    const isNeutral = NEUTRAL_WORDS.some(w => text === w || originalText === w);
    sentiment = 'neutral';
    confidence = isNeutral ? 70 : 50;
    reasons.push(isNeutral ? 'explicit_neutral' : 'no_signals');
  } else if (positiveScore > negativeScore) {
    sentiment = 'positive';
    confidence = Math.min(95, 50 + positiveScore - negativeScore);
  } else if (negativeScore > positiveScore) {
    sentiment = 'negative';
    confidence = Math.min(95, 50 + negativeScore - positiveScore);
  } else {
    // Tie or balanced - strong negative breaks the tie
    if (hasStrongNegative) {
      sentiment = 'negative';
      confidence = 60;
      reasons.push('strong_neg_tiebreak');
    } else {
      sentiment = 'neutral';
      confidence = 50;
      reasons.push('balanced_signals');
    }
  }

  return {
    sentiment,
    confidence,
    reason: reasons.slice(0, 3).join(', ') || 'default'
  };
}

module.exports = { detectSentiment };
