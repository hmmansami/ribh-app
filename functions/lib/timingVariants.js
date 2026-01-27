/**
 * Timing Strategy Variants for Cart Recovery Messages
 * 
 * Each strategy determines optimal send time(s) based on abandonment time
 * and optional customer data (timezone, activity patterns).
 */

const SAUDI_TIMEZONE = 'Asia/Riyadh'; // UTC+3

/**
 * Helper: Add minutes to a date
 */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Helper: Add hours to a date
 */
function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Helper: Get next occurrence of a specific hour in a timezone
 */
function getNextTimeInTimezone(fromDate, targetHour, timezone = SAUDI_TIMEZONE) {
  // Create a date formatter for the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  // Get current time in target timezone
  const parts = formatter.formatToParts(fromDate);
  const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');
  
  const currentHour = getPart('hour');
  const currentMinute = getPart('minute');
  
  // Calculate time until target hour
  let hoursUntil = targetHour - currentHour;
  if (hoursUntil <= 0 || (hoursUntil === 0 && currentMinute > 0)) {
    hoursUntil += 24; // Next day
  }
  
  // Subtract current minutes to hit exactly the target hour
  const minutesToSubtract = currentMinute;
  
  return addMinutes(addHours(fromDate, hoursUntil), -minutesToSubtract);
}

/**
 * Helper: Check if time is within quiet hours (11 PM - 8 AM)
 */
function isQuietHours(date, timezone = SAUDI_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false
  });
  const hour = parseInt(formatter.format(date));
  return hour >= 23 || hour < 8;
}

/**
 * Helper: Adjust time to avoid quiet hours
 */
function avoidQuietHours(date, timezone = SAUDI_TIMEZONE) {
  if (isQuietHours(date, timezone)) {
    return getNextTimeInTimezone(date, 9, timezone); // Push to 9 AM
  }
  return date;
}

// =============================================================================
// TIMING STRATEGIES
// =============================================================================

/**
 * 1. IMMEDIATE Strategy
 * Send within 5-15 minutes of abandonment
 * Best for: High-intent customers who just left
 * 
 * @param {Date} abandonmentTime - When cart was abandoned
 * @param {string} customerTimezone - Customer's timezone (optional)
 * @returns {Date} Optimal send time
 */
function immediate(abandonmentTime, customerTimezone = SAUDI_TIMEZONE) {
  // Random delay between 5-15 minutes to feel natural
  const delayMinutes = 5 + Math.floor(Math.random() * 11); // 5-15 min
  let sendTime = addMinutes(new Date(abandonmentTime), delayMinutes);
  
  // Don't send during quiet hours - push to morning
  sendTime = avoidQuietHours(sendTime, customerTimezone);
  
  return sendTime;
}

/**
 * 2. GOLDEN HOUR Strategy
 * Send at exactly 1 hour mark
 * Best for: Standard recovery, proven effective timing
 * 
 * @param {Date} abandonmentTime - When cart was abandoned
 * @param {string} customerTimezone - Customer's timezone (optional)
 * @returns {Date} Optimal send time
 */
function goldenhour(abandonmentTime, customerTimezone = SAUDI_TIMEZONE) {
  let sendTime = addHours(new Date(abandonmentTime), 1);
  
  // Avoid quiet hours
  sendTime = avoidQuietHours(sendTime, customerTimezone);
  
  return sendTime;
}

/**
 * 3. NEXT DAY Strategy
 * Wait until next day morning (9 AM Saudi time)
 * Best for: Late-night abandonment, thoughtful purchases
 * 
 * @param {Date} abandonmentTime - When cart was abandoned
 * @param {string} customerTimezone - Customer's timezone (optional)
 * @returns {Date} Optimal send time (next day 9 AM)
 */
function nextday(abandonmentTime, customerTimezone = SAUDI_TIMEZONE) {
  // Get 9 AM in customer's timezone (next occurrence)
  const targetHour = 9;
  let sendTime = getNextTimeInTimezone(new Date(abandonmentTime), targetHour, customerTimezone);
  
  // Ensure it's actually next day (at least 4 hours from now)
  const minWait = addHours(new Date(abandonmentTime), 4);
  if (sendTime < minWait) {
    sendTime = addHours(sendTime, 24);
  }
  
  return sendTime;
}

/**
 * 4. SMART TIME Strategy
 * Send at customer's most active time based on past engagement
 * Best for: Repeat customers with engagement history
 * 
 * @param {Date} abandonmentTime - When cart was abandoned
 * @param {string} customerTimezone - Customer's timezone (optional)
 * @param {Object} customerActivityPattern - Historical activity data
 * @param {number[]} customerActivityPattern.activeHours - Hours when customer opens (0-23)
 * @param {number[]} customerActivityPattern.activeDays - Days when customer is active (0=Sun, 6=Sat)
 * @param {number} customerActivityPattern.peakHour - Most active hour
 * @returns {Date} Optimal send time
 */
function smart_time(abandonmentTime, customerTimezone = SAUDI_TIMEZONE, customerActivityPattern = null) {
  const now = new Date(abandonmentTime);
  
  // Default activity pattern if none provided
  const pattern = customerActivityPattern || {
    activeHours: [9, 10, 11, 12, 14, 15, 16, 17, 20, 21], // Default active hours
    activeDays: [0, 1, 2, 3, 4, 5, 6], // All days
    peakHour: 10 // Default peak at 10 AM
  };
  
  // Find the next occurrence of customer's peak hour
  let sendTime = getNextTimeInTimezone(now, pattern.peakHour, customerTimezone);
  
  // Ensure at least 30 minutes have passed
  const minWait = addMinutes(now, 30);
  if (sendTime < minWait) {
    sendTime = addHours(sendTime, 24);
  }
  
  // Check if the day is an active day
  const sendDay = sendTime.getDay();
  if (!pattern.activeDays.includes(sendDay)) {
    // Find next active day
    let daysToAdd = 1;
    while (!pattern.activeDays.includes((sendDay + daysToAdd) % 7) && daysToAdd < 7) {
      daysToAdd++;
    }
    sendTime = addHours(sendTime, daysToAdd * 24);
  }
  
  return sendTime;
}

/**
 * 5. SEQUENCE Strategy
 * Multi-touch approach: 30min, 4hr, 24hr
 * Best for: High-value carts, persistent recovery
 * 
 * @param {Date} abandonmentTime - When cart was abandoned
 * @param {string} customerTimezone - Customer's timezone (optional)
 * @returns {Date[]} Array of send times for the sequence
 */
function sequence(abandonmentTime, customerTimezone = SAUDI_TIMEZONE) {
  const now = new Date(abandonmentTime);
  
  // Define sequence intervals
  const intervals = [
    { minutes: 30, label: 'reminder' },      // 30 min - gentle reminder
    { minutes: 240, label: 'incentive' },    // 4 hours - maybe offer incentive
    { minutes: 1440, label: 'lastchance' }   // 24 hours - urgency/last chance
  ];
  
  const sendTimes = intervals.map(interval => {
    let time = addMinutes(now, interval.minutes);
    time = avoidQuietHours(time, customerTimezone);
    return {
      time,
      label: interval.label,
      minutesFromAbandonment: interval.minutes
    };
  });
  
  return sendTimes;
}

// =============================================================================
// SMART SELECTOR
// =============================================================================

/**
 * Customer segments for timing selection
 */
const SEGMENTS = {
  NEW_VISITOR: 'new_visitor',           // First-time visitor
  RETURNING_BROWSER: 'returning_browser', // Visited before, never bought
  FIRST_TIME_BUYER: 'first_time_buyer',   // Making first purchase
  REPEAT_CUSTOMER: 'repeat_customer',     // Has purchased before
  VIP: 'vip',                            // High-value repeat customer
  CART_ABANDONER: 'cart_abandoner'       // Has abandoned before
};

/**
 * Get best timing strategy based on customer segment
 * 
 * @param {string} segment - Customer segment from SEGMENTS
 * @param {Date} abandonmentTime - When cart was abandoned
 * @param {Object} options - Additional options
 * @param {string} options.timezone - Customer timezone
 * @param {Object} options.activityPattern - Customer activity data
 * @param {number} options.cartValue - Cart value in base currency
 * @param {boolean} options.isHighIntent - Shows high purchase intent
 * @returns {Object} Timing recommendation with strategy and time(s)
 */
function getBestTiming(segment, abandonmentTime, options = {}) {
  const {
    timezone = SAUDI_TIMEZONE,
    activityPattern = null,
    cartValue = 0,
    isHighIntent = false
  } = options;
  
  const time = new Date(abandonmentTime);
  
  // High-value carts get sequence treatment
  if (cartValue > 500) { // SAR 500+ = high value
    return {
      strategy: 'sequence',
      times: sequence(time, timezone),
      reason: 'High-value cart - multi-touch recovery'
    };
  }
  
  // Strategy selection by segment
  switch (segment) {
    case SEGMENTS.NEW_VISITOR:
      // New visitors - act fast before they forget
      return {
        strategy: 'immediate',
        times: [immediate(time, timezone)],
        reason: 'New visitor - quick follow-up before they forget'
      };
    
    case SEGMENTS.RETURNING_BROWSER:
      // They keep coming back - golden hour works well
      return {
        strategy: 'goldenhour',
        times: [goldenhour(time, timezone)],
        reason: 'Returning browser - standard 1-hour recovery'
      };
    
    case SEGMENTS.FIRST_TIME_BUYER:
      // First purchase attempt - high intent, act fast
      if (isHighIntent) {
        return {
          strategy: 'immediate',
          times: [immediate(time, timezone)],
          reason: 'First-time buyer with high intent - immediate recovery'
        };
      }
      return {
        strategy: 'goldenhour',
        times: [goldenhour(time, timezone)],
        reason: 'First-time buyer - golden hour recovery'
      };
    
    case SEGMENTS.REPEAT_CUSTOMER:
      // Know their patterns - use smart timing
      if (activityPattern) {
        return {
          strategy: 'smart_time',
          times: [smart_time(time, timezone, activityPattern)],
          reason: 'Repeat customer - personalized timing based on activity'
        };
      }
      return {
        strategy: 'goldenhour',
        times: [goldenhour(time, timezone)],
        reason: 'Repeat customer - standard golden hour'
      };
    
    case SEGMENTS.VIP:
      // VIPs get the sequence treatment
      return {
        strategy: 'sequence',
        times: sequence(time, timezone),
        reason: 'VIP customer - full sequence recovery'
      };
    
    case SEGMENTS.CART_ABANDONER:
      // Serial abandoners - try next day (pattern interrupt)
      return {
        strategy: 'nextday',
        times: [nextday(time, timezone)],
        reason: 'Serial abandoner - next day fresh approach'
      };
    
    default:
      // Default to golden hour
      return {
        strategy: 'goldenhour',
        times: [goldenhour(time, timezone)],
        reason: 'Default - proven golden hour timing'
      };
  }
}

// =============================================================================
// TEST CASES
// =============================================================================

function runTests() {
  console.log('🧪 Running Timing Strategy Tests\n');
  console.log('=' .repeat(60));
  
  // Test time: 3 PM Saudi time on a Wednesday
  const testTime = new Date('2024-01-17T12:00:00Z'); // 3 PM AST
  const lateNightTime = new Date('2024-01-17T21:00:00Z'); // Midnight AST
  
  // Test 1: Immediate strategy
  console.log('\n📍 Test 1: IMMEDIATE Strategy');
  const immediateResult = immediate(testTime);
  console.log(`  Abandonment: ${testTime.toISOString()}`);
  console.log(`  Send time: ${immediateResult.toISOString()}`);
  console.log(`  Delay: ${Math.round((immediateResult - testTime) / 60000)} minutes`);
  console.log(`  ✅ Should be 5-15 minutes after abandonment`);
  
  // Test 2: Golden Hour strategy
  console.log('\n📍 Test 2: GOLDEN HOUR Strategy');
  const goldenResult = goldenhour(testTime);
  console.log(`  Abandonment: ${testTime.toISOString()}`);
  console.log(`  Send time: ${goldenResult.toISOString()}`);
  console.log(`  Delay: ${Math.round((goldenResult - testTime) / 60000)} minutes`);
  console.log(`  ✅ Should be exactly 60 minutes after`);
  
  // Test 3: Next Day strategy
  console.log('\n📍 Test 3: NEXT DAY Strategy');
  const nextdayResult = nextday(testTime);
  console.log(`  Abandonment: ${testTime.toISOString()}`);
  console.log(`  Send time: ${nextdayResult.toISOString()}`);
  console.log(`  ✅ Should be 9 AM next day Saudi time`);
  
  // Test 4: Smart Time with activity pattern
  console.log('\n📍 Test 4: SMART TIME Strategy');
  const activityPattern = {
    activeHours: [8, 9, 10, 20, 21, 22],
    activeDays: [0, 1, 2, 3, 4], // Sun-Thu (Saudi work week)
    peakHour: 21 // 9 PM peak
  };
  const smartResult = smart_time(testTime, SAUDI_TIMEZONE, activityPattern);
  console.log(`  Abandonment: ${testTime.toISOString()}`);
  console.log(`  Customer peak hour: ${activityPattern.peakHour}:00`);
  console.log(`  Send time: ${smartResult.toISOString()}`);
  console.log(`  ✅ Should align with customer's peak hour`);
  
  // Test 5: Sequence strategy
  console.log('\n📍 Test 5: SEQUENCE Strategy');
  const sequenceResult = sequence(testTime);
  console.log(`  Abandonment: ${testTime.toISOString()}`);
  sequenceResult.forEach((item, i) => {
    console.log(`  Message ${i + 1} (${item.label}): ${item.time.toISOString()}`);
  });
  console.log(`  ✅ Should have 3 times: 30min, 4hr, 24hr`);
  
  // Test 6: Quiet hours handling
  console.log('\n📍 Test 6: QUIET HOURS Handling');
  const lateResult = immediate(lateNightTime);
  console.log(`  Abandonment: ${lateNightTime.toISOString()} (midnight Saudi)`);
  console.log(`  Send time: ${lateResult.toISOString()}`);
  console.log(`  ✅ Should be pushed to 9 AM, not sent at midnight`);
  
  // Test 7: getBestTiming for different segments
  console.log('\n📍 Test 7: getBestTiming() Segment Selection');
  
  const segments = [
    { segment: SEGMENTS.NEW_VISITOR, options: {} },
    { segment: SEGMENTS.VIP, options: { cartValue: 1000 } },
    { segment: SEGMENTS.REPEAT_CUSTOMER, options: { activityPattern } },
    { segment: SEGMENTS.CART_ABANDONER, options: {} }
  ];
  
  segments.forEach(({ segment, options }) => {
    const result = getBestTiming(segment, testTime, options);
    console.log(`\n  Segment: ${segment}`);
    console.log(`  Strategy: ${result.strategy}`);
    console.log(`  Reason: ${result.reason}`);
    console.log(`  Times: ${result.times.length} message(s)`);
  });
  
  // Test 8: High-value cart override
  console.log('\n📍 Test 8: HIGH-VALUE Cart Override');
  const highValueResult = getBestTiming(SEGMENTS.NEW_VISITOR, testTime, { cartValue: 800 });
  console.log(`  Segment: NEW_VISITOR, Cart: SAR 800`);
  console.log(`  Strategy: ${highValueResult.strategy}`);
  console.log(`  ✅ High-value should override to sequence`);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Core strategies
  immediate,
  goldenhour,
  nextday,
  smart_time,
  sequence,
  
  // Smart selector
  getBestTiming,
  
  // Constants
  SEGMENTS,
  SAUDI_TIMEZONE,
  
  // Helpers (for advanced use)
  avoidQuietHours,
  isQuietHours,
  getNextTimeInTimezone,
  
  // Testing
  runTests
};

// Run tests if executed directly
if (require.main === module) {
  runTests();
}
