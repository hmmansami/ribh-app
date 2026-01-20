# RIBH BEHAVIORAL INTELLIGENCE SYSTEM
## Tools & Detection Systems for Smart Offer Deployment

---

## 🎯 CORE PRINCIPLE

> "The right offer to the right person at the right time through the right channel"

RIBH needs intelligent detection systems to know:
1. **WHO** is this customer? (segment)
2. **WHAT** are they doing? (behavior)
3. **WHY** might they leave? (intent)
4. **WHEN** to reach them? (timing)
5. **HOW** to reach them? (channel)
6. **WHAT** offer to make? (offer type)

---

## 🔍 DETECTION TOOLS WE NEED

### 1. Customer Lifecycle Detection

**Purpose:** Know where each customer is in their journey

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   VISITOR   │──▶│   LEAD      │──▶│  CUSTOMER   │──▶│   REPEAT    │──▶│    VIP      │
│  (Unknown)  │   │ (Cart/Email)│   │ (1 Purchase)│   │ (2+ Orders) │   │ (High LTV)  │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
       ↓                 ↓                 ↓                 ↓                 ↓
  ATTRACTION         ATTRACTION        CONTINUITY        UPSELL          CONTINUITY
    OFFER              OFFER             OFFER            OFFER            OFFER
```

**Detection Signals:**
| Signal | Detection Method |
|--------|------------------|
| New visitor | No cookies, no session history |
| Return visitor | Cookie present, no purchase |
| Lead | Cart created OR email captured |
| Customer | At least 1 completed order |
| Repeat | 2+ orders in database |
| VIP | Top 10% by LTV or frequency |
| At-Risk | No activity in 30-60 days |
| Churned | No activity in 90+ days |

---

### 2. Exit Intent Detection

**Purpose:** Know when someone is about to leave without buying

**Technical Implementation:**
```javascript
// Browser-side detection
const exitIntentSignals = {
  // Mouse moves toward browser close/tab
  mousePosition: 'cursor leaves viewport upward',
  
  // Rapid scrolling to top (looking for exit)
  scrollBehavior: 'fast scroll to top',
  
  // Tab switching detected
  visibilityChange: 'tab hidden/blurred',
  
  // Back button pressed
  navigation: 'popstate event',
  
  // Long idle time on checkout
  idleTime: '>3 minutes on checkout page',
  
  // Mobile: swipe gesture toward back
  mobileGesture: 'swipe from left edge'
}
```

**Response Map:**
| Signal | Urgency | Offer Type |
|--------|---------|------------|
| Mouse to close | HIGH | Immediate popup with downsell |
| Tab switch | MEDIUM | Email within 10 minutes |
| Idle on checkout | MEDIUM | WhatsApp with payment plan |
| Back button | HIGH | "Wait! Before you go..." modal |

---

### 3. Price Sensitivity Detection

**Purpose:** Know if someone is hesitant due to price

**Signals:**
| Behavior | Indicates |
|----------|-----------|
| Multiple product comparisons | Shopping around |
| Removing items from cart | Budget conscious |
| Checking shipping costs repeatedly | Cost sensitive |
| Long time on pricing page | Considering value |
| Adding/removing items | Testing what they can afford |
| Viewed product but didn't add | Above budget |

**Offer Response:**
```yaml
High Price Sensitivity:
  - Payment plan offer (Tamara/Tabby)
  - Smaller quantity offer
  - "Pay less now, more later"
  - Free shipping threshold deal

Medium Price Sensitivity:
  - Bundle discount
  - First-time buyer discount
  - Limited time offer

Low Price Sensitivity:
  - Premium upsell
  - Extended warranty
  - VIP membership
```

---

### 4. Purchase Intent Scoring

**Purpose:** Score how likely someone is to buy (0-100)

**Scoring Model:**
```
Base Score: 0

+ 5 points: Viewed product page
+ 10 points: Viewed multiple products
+ 15 points: Added to cart
+ 10 points: Viewed cart
+ 20 points: Started checkout
+ 5 points: Entered email
+ 10 points: Entered payment info
+ 15 points: Return visitor (bought before)
+ 10 points: Came from paid ad (higher intent)
+ 5 points: Mobile visitor (often lower intent)
- 10 points: Removed items from cart
- 5 points: Idle for >5 minutes on checkout
- 15 points: Exit intent detected
```

**Score-Based Actions:**
| Score | Status | Action |
|-------|--------|--------|
| 0-20 | Cold | Attraction offer only |
| 20-40 | Warm | Lead magnet, discount offer |
| 40-60 | Hot | Reminder, small incentive |
| 60-80 | Very Hot | Urgency message only |
| 80-100 | Buying | Don't interrupt! Just confirm |

---

### 5. Optimal Send Time Detection

**Purpose:** Learn when each customer opens/engages with messages

**AI Learning System:**
```yaml
Data Points Collected:
  - Email open times (hour of day, day of week)
  - WhatsApp read times
  - Website visit times
  - Purchase completion times
  - Link click times

Learning Algorithm:
  1. Start with population average (e.g., 8pm Sundays)
  2. Track individual behavior
  3. Weight recent behavior higher
  4. Factor in timezone
  5. Avoid known "bad" times (midnight, prayer times)

Output:
  customer_optimal_time: "Sunday 20:30"
  confidence: 0.85
  fallback_times: ["Tuesday 21:00", "Friday 16:00"]
```

---

### 6. Channel Preference Detection

**Purpose:** Know which channel works best for each customer

**Detection Method:**
```yaml
Track per customer:
  - WhatsApp: delivered, read, clicked, replied
  - Email: delivered, opened, clicked
  - SMS: delivered, clicked
  - Telegram: delivered, read, clicked

Preference Score:
  WhatsApp Score = (read_rate × 0.3) + (click_rate × 0.5) + (reply_rate × 0.2)
  Email Score = (open_rate × 0.4) + (click_rate × 0.6)
  SMS Score = (click_rate × 1.0)

Channel Priority:
  1. Highest scoring channel = Primary
  2. Second highest = Backup (if primary fails)
  3. Use multi-channel for high-value offers
```

---

### 7. Seasonal/Contextual Detection

**Purpose:** Adjust offers based on time of year and context

**Seasonal Calendar:**
```yaml
Ramadan:
  - Timing: Adjust for iftar/suhoor
  - Offers: Family bundles, gift sets
  - Messaging: بركة، عطاء، تجمعات عائلية

Eid Al-Fitr:
  - Timing: Pre-Eid shopping peak
  - Offers: New arrivals, fashion, gifts
  - Messaging: العيد، هدايا، ملابس جديدة

Eid Al-Adha:
  - Offers: Grilling equipment, family gatherings
  - Messaging: ضيافة، تجمعات

Saudi National Day (Sept 23):
  - Offers: Patriotic themes, green/white products
  - Messaging: احتفال، وطني

White Friday (November):
  - Timing: Highest shopping season
  - Offers: Biggest discounts, bundles
  - Urgency: Maximum

Year End:
  - Offers: Clearance, last chance
  - Messaging: تصفية، آخر فرصة
```

---

### 8. Product Affinity Detection

**Purpose:** Know what products each customer is interested in

**Affinity Scoring:**
```yaml
Data Sources:
  - Products viewed (weight: 1)
  - Products added to cart (weight: 3)
  - Products purchased (weight: 5)
  - Products in wishlist (weight: 2)
  - Time spent on product pages (weight: 0.5)

Category Affinity:
  Customer A:
    Electronics: 0.7
    Fashion: 0.2
    Home: 0.1

Product Recommendations:
  - Show related products in preferred category
  - Cross-sell from secondary category
  - Personalize recovery messages with relevant products
```

---

## 🔗 INTEGRATION ARCHITECTURE

### Data Flow:

```
┌─────────────────────────────────────────────────────────────────┐
│                        SALLA STORE                               │
├─────────────────────────────────────────────────────────────────┤
│  Products │ Orders │ Customers │ Carts │ Analytics │ Webhooks   │
└─────────────┬───────────┬──────────┬────────┬─────────┬─────────┘
              │           │          │        │         │
              ▼           ▼          ▼        ▼         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RIBH DATA COLLECTOR                           │
│                                                                  │
│  • Customer Profile Builder                                      │
│  • Event Stream Processor                                        │
│  • Behavioral Signal Aggregator                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RIBH INTELLIGENCE ENGINE                      │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Lifecycle │ │ Intent   │ │ Timing   │ │ Channel  │           │
│  │ Detection │ │ Scoring  │ │ AI       │ │ Selector │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Exit     │ │ Price    │ │ Product  │ │ Seasonal │           │
│  │ Intent   │ │ Sensitive│ │ Affinity │ │ Context  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RIBH OFFER SELECTOR                           │
│                                                                  │
│  Input: Customer Profile + Signals + Context                     │
│  Output: Best Offer (type, content, timing, channel)            │
│                                                                  │
│  Decision Tree:                                                  │
│  1. Is customer leaving? → Downsell                             │
│  2. Is customer buying? → Upsell                                │
│  3. Is customer new? → Attraction                               │
│  4. Is customer inactive? → Reactivation                        │
│  5. Is customer engaged? → Continuity                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RIBH MESSAGE ENGINE                           │
│                                                                  │
│  • AI Personalization (Gemini)                                  │
│  • Multi-Channel Dispatch (WhatsApp, Email, SMS, Telegram)      │
│  • Optimal Timing Scheduler                                      │
│  • A/B Testing Controller                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 METRICS TO TRACK

### Per Detection System:

| System | Key Metrics |
|--------|-------------|
| Lifecycle | Conversion rate between stages |
| Exit Intent | Save rate (% who don't leave after offer) |
| Price Sensitivity | Discount effectiveness by segment |
| Intent Scoring | Score accuracy (predicted vs actual purchase) |
| Optimal Timing | Open rate improvement over baseline |
| Channel Preference | Engagement rate by channel |
| Seasonal | Revenue lift during campaigns |
| Product Affinity | Recommendation click-through rate |

---

## 🚀 IMPLEMENTATION PRIORITY

### Phase 1 (MVP - Now):
1. ✅ Basic cart abandonment detection
2. ✅ Multi-channel messaging
3. ◻️ Customer lifecycle tagging (New/Customer/Repeat)

### Phase 2 (Intelligence - Q2):
4. ◻️ Exit intent detection (browser-side script)
5. ◻️ Purchase intent scoring
6. ◻️ Optimal send time AI

### Phase 3 (Optimization - Q3):
7. ◻️ Price sensitivity detection
8. ◻️ Channel preference learning
9. ◻️ Product affinity engine

### Phase 4 (Excellence - Q4):
10. ◻️ Seasonal campaign automation
11. ◻️ Advanced A/B testing
12. ◻️ Predictive analytics (who will buy next)

---

*This system will make RIBH the most intelligent offer engine in the MENA e-commerce market.*
