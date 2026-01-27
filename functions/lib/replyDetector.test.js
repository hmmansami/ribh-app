const { detectSentiment } = require('./replyDetector');

// Test cases: [message, expected_sentiment]
const testCases = [
  // Required 8 tests
  ["شكراً جزيلاً 😊", "positive"],
  ["وين طلبي؟؟ متأخر!", "negative"],
  ["تمام", "neutral"],
  ["worst service ever", "negative"],
  ["👍", "positive"],
  ["لا شكراً مو مهتم", "negative"],
  ["ok", "neutral"],
  ["الله يعطيك العافية ❤️", "positive"],
  
  // 10 edge cases
  ["😂😂😂", "positive"],                          // Multiple positive emoji only
  ["WHERE IS MY ORDER???", "negative"],           // Caps + multiple questions
  ["يعطيك العافية بس الطلب متأخر", "negative"],   // Mixed - negative wins
  ["مشكور 👍 ممتاز", "positive"],                 // Multiple positive signals
  ["...", "neutral"],                             // Just punctuation
  ["I guess it's fine", "neutral"],               // Weak/ambiguous
  ["TERRIBLE! 😡💔", "negative"],                  // Strong negative
  ["شكرا but there's a problem", "negative"],     // Mixed language, negative wins
  ["اوكي 👌", "neutral"],                         // Neutral word + ambiguous emoji
  ["لا", "neutral"],                              // Just "no" - ambiguous
];

let passed = 0;
let failed = [];
let totalTime = 0;

console.log("=== SENTIMENT DETECTOR TEST RESULTS ===\n");

for (const [msg, expected] of testCases) {
  const start = performance.now();
  const result = detectSentiment(msg);
  const elapsed = performance.now() - start;
  totalTime += elapsed;
  
  const status = result.sentiment === expected ? "✅" : "❌";
  if (result.sentiment === expected) {
    passed++;
  } else {
    failed.push({ msg, expected, got: result.sentiment, reason: result.reason });
  }
  
  console.log(`${status} "${msg}"`);
  console.log(`   Expected: ${expected} | Got: ${result.sentiment} (${result.confidence}%) | ${result.reason}`);
  console.log(`   Time: ${elapsed.toFixed(3)}ms\n`);
}

console.log("=== SUMMARY ===");
console.log(`Accuracy: ${passed}/${testCases.length} correct (${((passed/testCases.length)*100).toFixed(1)}%)`);
console.log(`Avg response time: ${(totalTime/testCases.length).toFixed(3)}ms`);
console.log(`Total time: ${totalTime.toFixed(3)}ms`);

if (failed.length > 0) {
  console.log(`\nFailed cases:`);
  for (const f of failed) {
    console.log(`  - "${f.msg}" → expected ${f.expected}, got ${f.got} (${f.reason})`);
  }
}

// File stats
const fs = require('fs');
const fileContent = fs.readFileSync('./replyDetector.js', 'utf8');
const lineCount = fileContent.split('\n').length;
console.log(`\nFile size: ${lineCount} lines`);
