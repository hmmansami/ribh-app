# Attentive → RIBH: Detailed Product Plan

## Customer Outcome (One Message)

**"تسويق شخصي. نتائج حقيقية."**
*(Personal marketing. Real results.)*

- **Word we own:** شخصي (personal)
- **Enemy:** Lost customers you never talk to
- **Category:** منصة تواصل شخصي (Personal Communication Platform)
- **Not** a cart recovery app. A personal marketing platform for ANY business.

---

## API Stack (Buy vs Build)

| Need | API | Cost | Replaces |
|------|-----|------|----------|
| WhatsApp API | **360dialog** ($50/mo + Meta fees) | ~$50/mo | Baileys (ban risk) |
| SMS (Saudi) | **Unifonic** (usage-based ~$0.05/msg) | ~$50/mo | Twilio ($0.14/msg) |
| Journey Engine | **Novu** (self-hosted, free) | $0 | Custom sequence engine |
| Analytics | **PostHog** (free 1M events/mo) | $0 | Custom eventTracker |
| CDP | **RudderStack** (free 1M events/mo) | $0 | Manual JSON files |
| AI (Arabic) | **Groq + Qwen3 32B** | ~$0-20/mo | Current Groq (model swap) |
| Send Time | **Custom histogram** (build, 2-3 days) | $0 | N/A |

**Total: ~$100-150/month → saves 30-50 weeks of dev**

---

## Full Feature Map: Attentive → RIBH

### 1. LIST GROWTH / SUBSCRIBER ACQUISITION

**What Attentive does:**
- Two-Tap sign-up (patented): tap CTA → pre-filled SMS → tap send → opted in
- Pop-up sign-up units: spin-to-win, countdown, exit-intent
- AI Grow: ML picks optimal moment + format to show sign-up
- Instagram Stories integration
- QR codes for desktop → mobile

**What RIBH builds:**

#### 1A. WhatsApp Opt-in Widget (Web — e-commerce stores)
- **File:** `public/widget/whatsapp-optin.js` (new)
- **How:** Embeddable JS widget for Salla/Shopify stores
- **Flow:** Visitor sees popup → enters phone or clicks WhatsApp link → redirects to `wa.me/{storeNumber}?text=اشتراك` → store's WhatsApp receives the message → RIBH auto-adds subscriber
- **Trigger:** Exit-intent, time-on-page, scroll depth (like Attentive's AI Grow)
- **Design:** Customizable popup matching store branding
- **Existing code to extend:** `public/widget/exit-popup.js` (already exists!)

#### 1B. Physical Store QR Opt-in (NEW — coffee shops, retail)
- **File:** `functions/lib/qrOptin.js` (new)
- **How:** Generate unique QR code per store → print on receipt/table/counter
- **Flow:** Customer scans QR → opens WhatsApp with pre-filled message → auto-subscribed
- **QR links to:** `wa.me/{storeNumber}?text=اشتراك+{storeCode}`
- **Backend:** API endpoint `POST /api/qr/generate` → returns QR image + printable PDF
- **Data:** Store subscriber in `customers.json` + Firestore with source: 'qr_physical'

#### 1C. Social Media Opt-in
- **How:** Store shares link on Instagram/Twitter bio: `wa.me/{number}?text=اشترك`
- **Backend:** Same subscriber handler as QR

**Implementation:**
- Extend `exit-popup.js` to support WhatsApp opt-in (not just email)
- New `qrOptin.js` module for generating QR codes (use `qrcode` npm package)
- New API routes: `POST /api/subscribers/optin`, `POST /api/qr/generate`
- Track source: 'widget', 'qr_physical', 'social', 'manual_import'

---

### 2. CUSTOMER IDENTITY / PROFILES

**What Attentive does:**
- Identity Graph: unified profile per subscriber
- Signal: server-side cookie (1-year persistence), cross-device matching
- Rich Data Capture: stores anonymous visitor data, backfills when identified
- Phone number as primary durable ID

**What RIBH builds:**

#### 2A. Unified Customer Profile
- **File:** `functions/lib/customerProfile.js` (new)
- **Schema:**
```json
{
  "id": "uuid",
  "storeId": "merchant_123",
  "phone": "+966501234567",     // PRIMARY ID (like Attentive)
  "email": "customer@email.com",
  "name": "محمد",
  "source": "qr_physical|widget|salla|shopify|import",
  "tags": ["vip", "coffee_lover", "repeat_buyer"],
  "firstSeen": "2026-01-15T...",
  "lastActivity": "2026-02-08T...",
  "totalOrders": 5,
  "totalSpent": 1250.00,
  "averageOrderValue": 250.00,
  "lastOrderDate": "2026-02-01T...",
  "rfmSegment": "champion",
  "predictedNextOrder": "2026-02-15T...",
  "predictedChurnRisk": 0.15,
  "optInStatus": { "whatsapp": true, "sms": true, "email": false },
  "preferredChannel": "whatsapp",
  "bestSendTime": "14:00",       // Learned from response patterns
  "engagementHistory": [
    { "date": "...", "type": "whatsapp_sent", "opened": true, "clicked": true },
    { "date": "...", "type": "sms_sent", "opened": true, "clicked": false }
  ],
  "purchaseHistory": [
    { "date": "...", "orderId": "...", "amount": 250, "products": [...] }
  ],
  "metadata": {
    "birthday": "1995-03-15",
    "city": "الرياض",
    "preferredLanguage": "ar"
  }
}
```

#### 2B. Identity Resolution
- **How:** Match customers across touchpoints using phone number as primary key
- When customer opts in via QR → check if phone exists in Salla/Shopify orders → merge
- When Salla webhook fires → check if phone exists in QR subscribers → merge
- Simple deterministic matching (phone-based), no ML needed initially

**Implementation:**
- New `customerProfile.js` replaces scattered customer data in `customers.json`
- Migrate existing customer data to new schema
- API routes: `GET /api/customers/:id/profile`, `PUT /api/customers/:id`
- Firestore collection: `customer_profiles` (replaces fragmented data)

---

### 3. AUDIENCE SEGMENTATION

**What Attentive does:**
- Dynamic segment builder
- Pre-built templates (VIP, window shoppers, repeat buyers)
- Audiences AI: auto-optimize campaign audience
- Segment-level reporting

**What RIBH builds:**

#### 3A. Enhanced Segments (extend existing RFM)
- **File:** `functions/lib/rfmSegmentation.js` (enhance)
- **Current:** 8 RFM segments
- **Add:**
  - `new_subscriber` — opted in < 7 days ago
  - `first_time_buyer` — exactly 1 order
  - `repeat_buyer` — 2+ orders
  - `high_value` — top 20% by spend
  - `at_risk` — no activity 30-60 days
  - `dormant` — no activity 60+ days
  - `birthday_this_month` — birthday coming up
  - `physical_store` — source is QR/physical
  - `online_store` — source is Salla/Shopify

#### 3B. Segment-Based Messaging
- Each segment gets different journey triggers
- Example: `at_risk` → auto-starts winback journey
- Example: `birthday_this_month` → auto-sends birthday offer
- Example: `new_subscriber` → welcome journey

**Implementation:**
- Extend `rfmSegmentation.js` with new segment types
- Add segment-based auto-triggers to `lifecycleEngineV2.js`
- New API: `GET /api/segments` (list all segments with counts)

---

### 4. JOURNEYS / AUTOMATION

**What Attentive does:**
- Cart abandonment, browse abandonment, welcome, post-purchase, winback
- Back-in-stock, price drop, low inventory alerts
- Birthday/anniversary
- If/else branching, multi-channel steps
- Pre-built journey templates

**What RIBH has now:**
- `cart_recovery` sequence (3 steps: WhatsApp → Email → WhatsApp+Email)
- `post_purchase` sequence (2 steps: WhatsApp thank you → Review request)

**What RIBH builds (WhatsApp & SMS focus):**

#### 4A. Welcome Journey (NEW)
```
Subscriber opts in (any source)
  ↓ Immediate
  WhatsApp: "مرحباً {name}! 🎉 شكراً لانضمامك. [store intro + first offer]"
  ↓ Wait 24 hours
  WhatsApp: "هل تعرف أن لدينا [top product]? 🔥 [product link]"
  ↓ Wait 3 days (if no purchase)
  SMS: "عرض خاص لك من {store}: خصم 10% على أول طلب 🎁 [link]"
```
- **File:** Add `welcome` template to `sequenceEngine.js`
- **Trigger:** `customer.created` event or new opt-in from any source

#### 4B. Winback Journey (NEW)
```
Customer inactive 30+ days (segment: at_risk)
  ↓ Immediate
  WhatsApp: "وحشتنا {name}! 💚 جهزنا لك عرض خاص..."
  ↓ Wait 3 days (if no response)
  WhatsApp: "آخر فرصة {name}! خصم 20% ينتهي اليوم ⏰"
  ↓ Wait 7 days (if still no purchase)
  SMS: "عرض حصري من {store}: خصم 25% + شحن مجاني [link]"
```
- **File:** Add `winback` template to `sequenceEngine.js`
- **Trigger:** Customer moves to `at_risk` or `dormant` segment

#### 4C. Birthday Journey (NEW)
```
Customer birthday = today (or 1 day before)
  ↓ Morning (best send time)
  WhatsApp: "عيد ميلاد سعيد {name}! 🎂🎁 هديتك: خصم 20% [code]"
  ↓ If not used in 3 days
  SMS: "هديتك لسا بانتظارك! خصم 20% [code] - ينتهي خلال 48 ساعة"
```
- **File:** Add `birthday` template to `sequenceEngine.js`
- **Trigger:** Daily cron checks `customer_profiles.metadata.birthday`

#### 4D. Enhanced Cart Recovery (improve existing)
```
Cart abandoned
  ↓ 30 minutes
  WhatsApp: AI-personalized message (current behavior)
  ↓ 2 hours (if no purchase)
  WhatsApp: "سلتك لسا بانتظارك! خصم 10% 🎁"
  ↓ 24 hours (if no purchase)
  SMS: "آخر فرصة! خصم 15% + شحن مجاني ⏰ [link]"
```
- **File:** Update `cart_recovery` in `sequenceEngine.js`
- Change: Step 2 from email-only to WhatsApp, Step 3 adds SMS fallback

#### 4E. Post-Purchase Enhanced (improve existing)
```
Order completed
  ↓ 10 minutes
  WhatsApp: "شكراً {name}! 💚 طلبك في الطريق"
  ↓ 3 days
  WhatsApp: "وصل طلبك؟ ⭐ شاركنا رأيك واحصل على خصم 15%"
  ↓ 14 days (NEW)
  WhatsApp: "جربت [product]؟ عملاء مثلك أحبوا أيضاً [recommendation]"
```
- **File:** Extend `post_purchase` in `sequenceEngine.js`
- New Step 3: AI-powered product recommendation

#### 4F. Back-in-Stock Alert (NEW — Phase 2)
```
Product back in stock + customer viewed it before
  ↓ Immediate
  WhatsApp: "خبر حلو {name}! [product] رجع بالمخزون 🎉 [link]"
```

#### 4G. Price Drop Alert (NEW — Phase 2)
```
Product price decreased + customer viewed/carted it
  ↓ Immediate
  WhatsApp: "[product] نزل سعره! من {old} إلى {new} ر.س 🔥 [link]"
```

**Implementation:**
- Add new sequence templates to `sequenceEngine.js`
- Update `lifecycleEngineV2.js` to handle new event types
- Add segment-based auto-triggers (winback, birthday)
- Add daily cron job for birthday checks in keep-alive function

---

### 5. AI SUITE

**What Attentive does:**
- AI Pro: Identity AI, Audiences AI, Send Time AI, Brand Voice AI
- AI Journeys: fully personalized triggered messages
- Concierge: two-way conversational AI commerce
- Copy Assistant: generate message copy

**What RIBH builds:**

#### 5A. Send Time Optimization (Build — 2-3 days)
- **File:** `functions/lib/timingLearner.js` (already exists! enhance it)
- **How:** Track when each customer opens/responds to messages
- Store response timestamps in customer profile
- Compute per-customer "best hour" using histogram of response times
- Use in sequence engine: instead of fixed delays, schedule for customer's best time

#### 5B. Brand Voice AI (Build — 1-2 days)
- **File:** `functions/lib/toneAdapter.js` (already exists! enhance it)
- **How:** During onboarding, ask store owner for 3 sample messages they'd send
- AI analyzes tone (formal/casual, emoji usage, dialect)
- All generated messages are passed through tone adapter before sending
- Store brand voice profile in store settings

#### 5C. AI Concierge / WhatsApp Assistant (Phase 3)
- **File:** `functions/lib/whatsappAssistant.js` (already exists!)
- **How:** When customer replies to a RIBH message, AI responds
- Uses Groq + Qwen3 32B for Arabic
- Can answer product questions, give recommendations, send discount codes
- Escalates to store owner if can't handle

#### 5D. AI Message Personalization (Enhance existing)
- **File:** `functions/lib/aiMessenger.js` (exists)
- **Enhance:** Pass customer profile (purchase history, segment, preferences) to AI
- Each message is unique per customer (like Attentive's AI Journeys)
- No two customers get the same message

**Implementation:**
- Enhance `timingLearner.js` with per-customer histograms
- Enhance `toneAdapter.js` with brand voice profiles
- Enhance `aiMessenger.js` with full customer context
- Switch Groq model to Qwen3 32B for better Arabic
- `whatsappAssistant.js` for Phase 3 conversational AI

---

### 6. ANALYTICS & REPORTING

**What Attentive does:**
- Revenue attribution (click, view, coupon)
- Campaign performance dashboards
- A/B test results
- Segment performance
- Revenue & cost reports

**What RIBH builds:**

#### 6A. Revenue Attribution (NEW)
- **File:** `functions/lib/revenueAttribution.js` (new)
- **How:** When RIBH sends a message and customer purchases within 24h → attribute to RIBH
- Track: message_sent → link_clicked → purchase_completed → revenue_attributed
- Attribution window: 24h for WhatsApp, 48h for SMS
- Coupon-based attribution: if customer uses RIBH-generated code → 100% attributed

#### 6B. Campaign Dashboard (Enhance existing)
- **File:** `public/app.html` (enhance analytics section)
- **Metrics:**
  - Messages sent (WhatsApp / SMS breakdown)
  - Delivery rate, read rate, click rate
  - Revenue attributed to RIBH
  - ROI (revenue / message cost)
  - Per-journey performance
  - Per-segment performance
- Later: integrate PostHog for deeper analytics

**Implementation:**
- New `revenueAttribution.js` module
- Add attribution tracking to order webhooks
- Enhance dashboard with revenue metrics
- Add per-journey and per-segment views

---

### 7. COMPLIANCE & OPT-OUT

**What Attentive does:**
- TCPA compliance built into sign-up
- Opt-out management
- Quiet hours enforcement
- Litigator Defender

**What RIBH builds:**

#### 7A. Opt-Out Management
- **File:** `functions/lib/optOutManager.js` (new)
- **How:** If customer sends "إلغاء" or "stop" or "الغاء الاشتراك" → auto opt-out
- Store opt-out status in customer profile
- NEVER message opted-out customers
- Provide opt-out link in every message

#### 7B. Quiet Hours (Saudi)
- Don't send messages between 10 PM - 8 AM Saudi time (AST)
- Configurable per store
- Integrated into sequence engine timing

#### 7C. Message Frequency Caps
- Max 3 WhatsApp messages per customer per week
- Max 2 SMS per customer per week
- Prevent message fatigue
- Integrated into antiBan.js (already has rate limiting)

**Implementation:**
- New `optOutManager.js` module
- Add quiet hours check to `sequenceEngine.js`
- Add frequency caps to `antiBan.js`
- Add reply detection for opt-out keywords (extend `replyDetector.js`)

---

## Execution Order

### Phase 1 — Foundation (THIS SESSION)

| # | Task | File(s) | Time |
|---|------|---------|------|
| 1 | Homepage rebrand (colors, messaging, positioning) | `public/index.html` | 30 min |
| 2 | Welcome journey template | `functions/lib/sequenceEngine.js` | 20 min |
| 3 | Winback journey template | `functions/lib/sequenceEngine.js` | 20 min |
| 4 | Birthday journey template | `functions/lib/sequenceEngine.js` | 15 min |
| 5 | Physical store QR opt-in | `functions/lib/qrOptin.js` + API route | 30 min |
| 6 | Opt-out management | `functions/lib/optOutManager.js` | 20 min |
| 7 | Customer profile schema | `functions/lib/customerProfile.js` | 30 min |

### Phase 2 — Intelligence (NEXT SESSION)

| # | Task | File(s) |
|---|------|---------|
| 8 | Enhanced segmentation | `functions/lib/rfmSegmentation.js` |
| 9 | Send time optimization | `functions/lib/timingLearner.js` |
| 10 | Brand voice AI | `functions/lib/toneAdapter.js` |
| 11 | Revenue attribution | `functions/lib/revenueAttribution.js` |
| 12 | Back-in-stock alerts | `functions/lib/sequenceEngine.js` |
| 13 | Price drop alerts | `functions/lib/sequenceEngine.js` |
| 14 | Quiet hours + frequency caps | `sequenceEngine.js` + `antiBan.js` |

### Phase 3 — Conversational + Scale (FUTURE)

| # | Task | File(s) |
|---|------|---------|
| 15 | AI Concierge (two-way WhatsApp) | `functions/lib/whatsappAssistant.js` |
| 16 | Visual journey builder | `public/platform/journeys.html` |
| 17 | 360dialog WhatsApp API integration | `functions/lib/whatsappClient.js` |
| 18 | Unifonic SMS integration | `functions/lib/smsSender.js` |
| 19 | Novu journey engine migration | `functions/lib/sequenceEngine.js` |
| 20 | PostHog analytics integration | `public/js/analytics.js` |
| 21 | Enhanced dashboard | `public/app.html` |

---

## Design System (Attentive-Inspired)

### Colors
```css
:root {
  --bg: #0a0a0a;           /* Dark background (keep) */
  --card: rgba(15, 15, 15, 0.95);
  --text: #FFFFFF;
  --text-dim: #71717A;
  --text-muted: #A1A1AA;
  --primary: #FBBF24;       /* Warm amber/gold (NEW) */
  --primary-glow: rgba(251, 191, 36, 0.3);
  --primary-hover: #F59E0B;
  --success: #22C55E;
  --danger: #EF4444;
}
```

### Typography
- Arabic: IBM Plex Sans Arabic (keep — clean, modern)
- Headings: Bold 700-800 weight
- Body: Regular 400 weight
- Keep light weights for elegance

### Tone
- Warm, personal, human (not corporate)
- Short punchy headlines (Attentive-style)
- Outcome-first, features second
- Arabic-first, always

---

## Success Metrics (What We Track)

| Metric | Target |
|--------|--------|
| Subscriber growth rate | 10%+ week-over-week |
| Message delivery rate | 95%+ |
| WhatsApp read rate | 90%+ |
| Cart recovery rate | 25%+ |
| Winback conversion | 10%+ |
| Revenue attributed to RIBH | Track from day 1 |
| Customer ROI | 10x+ message cost |
| Opt-out rate | <2% per month |
