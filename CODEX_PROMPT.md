# Build RIBH (رِبح) — Abandoned Cart Recovery Platform for Saudi E-commerce

## What You're Building

RIBH is a SaaS platform that helps Salla and Shopify store owners in Saudi Arabia recover abandoned carts using WhatsApp, Email, and SMS — powered by AI-generated personalized offers. Think Klaviyo but Arabic-first, WhatsApp-first, and built for the Saudi market.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Backend | Express.js (single server entry point) |
| Hosting | Firebase Hosting (static frontend) + Cloud Functions (API) |
| Database | Firestore (all client access blocked — Admin SDK only) |
| WhatsApp | Baileys 6.x (free WebSocket-based, merchant scans QR to connect their own number) |
| Email | AWS SES |
| SMS | AWS SNS + Twilio |
| AI | Groq API (free tier, primary), Google Gemini (fallback), template fallback if both fail |
| Frontend | Vanilla HTML/CSS/JS — NO frameworks (no React, no Vue, no Svelte) |
| Auth | Magic links via email (no passwords) |
| CI/CD | GitHub Actions → Firebase deploy on push to main |

---

## Core Features to Build

### 1. Authentication (Magic Links)
- User enters email → backend sends a login link with a unique token
- Token stored as HTTP-only cookie (`ribhToken`, 30-day expiry, secure, sameSite=lax)
- `verifyStoreToken` middleware protects all `/api/*` routes
- No passwords anywhere

### 2. Salla & Shopify OAuth Integration
- **Salla**: OAuth flow → store `accessToken` + `refreshToken` in Firestore. Auto-refresh expired tokens. Register webhooks on install.
- **Shopify**: OAuth with nonce CSRF protection → token exchange → register webhooks (checkouts/create, orders/create, app/uninstalled)
- Handle `app.installed`, `app.uninstalled`, `app.store.authorize` events

### 3. Webhook Processing
- **Salla webhooks**: Receive `cart.abandoned`, `order.created`, `order.updated`, `customer.created` events
- **Shopify webhooks**: Receive `checkouts/create`, `checkouts/update`, `orders/create`
- Verify all webhooks with HMAC-SHA256 signature (timing-safe comparison)
- Normalize Saudi phone numbers to `+966XXXXXXXXX` format (accept: `05X`, `5X`, `966X`, `+966X`, `00966X`)

### 4. Abandoned Cart Recovery (Core Business Logic)
- When a cart is abandoned:
  1. Detect customer type (VIP: >5000 SAR spent or ≥5 orders, REPEAT: ≥1 order, PRICE_SENSITIVE: >500 SAR cart, NEW: 0 orders)
  2. Select smart offer based on type (VIP=15% off, REPEAT=10%, PRICE_SENSITIVE=5%+payment plan, NEW=welcome)
  3. Generate AI personalized message via Groq/Gemini
  4. Send multi-step recovery sequence:
     - **Immediate**: WhatsApp message (highest conversion)
     - **1 hour**: Email #1 (friendly, no discount)
     - **6 hours**: Email #2 (5% discount)
     - **24 hours**: Email #3 (10% discount, last chance)
- When order is created: mark cart as recovered, cancel pending sequences, trigger post-purchase upsell

### 5. WhatsApp Integration (Baileys)
- Merchant scans QR code → connects their own WhatsApp number (FREE, unlimited messages)
- Persist session in Firestore so reconnection doesn't need new QR
- Anti-ban protection: rate limits (20/hr, 100/day), warm-up period (7 days progressive), human-like delays (45sec-3min between messages), active hours only (9am-10pm Saudi time), batch cooldowns
- Message queue: Firestore-backed queue with retry logic (3 retries, 5min apart)

### 6. AI Offer Generation
- Use Groq API (free) to generate 6-part Arabic offers: headline, urgency, scarcity, bonus, guarantee, CTA
- Context-aware: seasonal themes (Ramadan, Eid, National Day), cart value tiers, customer segments, time-of-day greetings
- Fallback chain: Groq → Gemini → hardcoded Arabic templates
- AI learning: feed A/B test winners back into offer weights

### 7. Multi-Channel Messaging
- **WhatsApp**: Via Baileys (primary) or Twilio WhatsApp API (fallback)
- **Email**: AWS SES with HTML templates (Arabic RTL, Tajawal font)
- **SMS**: AWS SNS or Twilio
- **Telegram**: Bot integration for notifications
- Track: sent, delivered, opened, clicked, converted per message

### 8. Customer Intelligence
- **RFM Segmentation**: Score customers into 9 segments (Champions, Loyal, Potential Loyalists, New, Promising, Need Attention, About to Sleep, Dormant, Lost)
- **Predictive Analytics**: Customer Lifetime Value (CLV), churn risk score, predicted next order date
- **A/B Testing**: Test subject lines, discount amounts, urgency messages. Auto-pick winners by conversion rate.

### 9. Campaign System
- Create multi-channel campaigns (WhatsApp, Email, SMS, or all)
- Batch contact uploads, do-not-contact list
- Pre-built templates: Direct, Value-first, Social Proof
- Per-campaign stats: sent, delivered, opened, clicked, converted, revenue

### 10. Post-Purchase Features
- **Upsell**: 2hr after order, AI-recommended product with 10-15% discount, 24hr expiry, max 1/order, 2/week
- **Review Collection**: 3-5 days after delivery via WhatsApp. Route 4-5 stars to public review page, 1-3 stars to support (with SORRY20 discount)
- **Referral System**: Unique codes, referrer gets 15% credit on friend's purchase
- **Browse Abandonment**: Detect product views without cart adds, send recovery after 1-4 hours

### 11. Dashboard & Analytics (Vanilla JS Frontend)
Build a multi-page platform dashboard with these pages:
- **Dashboard**: KPIs (carts received, recovered, recovery rate, revenue recovered), charts
- **Autopilot**: Toggle automated recovery flows on/off, see revenue by channel
- **Inbox**: WhatsApp conversation interface (chat bubbles, RTL)
- **Customers**: Customer list with RFM segment badges, filter by segment
- **Customer Detail**: Profile, order history, RFM score, CLV, churn risk, conversation history
- **Flows**: Automation workflows (cart recovery, post-purchase, browse abandonment, reviews, referrals)
- **Flow Builder**: Drag-drop canvas for building multi-step automations (trigger → delay → condition → action → branch)
- **Campaigns**: Campaign cards with status, metrics, create/edit/launch/pause
- **Analytics**: Line charts (revenue over time), donut charts (by channel/segment), open rate, click rate, conversion rate, ROI
- **Segments**: RFM segment cards (count, CLV, recommended actions)
- **Settings**: Store info, WhatsApp connection, email config, API keys, billing
- **Popup Builder**: Exit-intent popup configurator with live preview

### 12. Additional Pages
- **Marketing Homepage** (`index.html`): Dark theme, animated background, ROI calculator, pricing tiers (Starter 199 SAR, Growth 399 SAR, Enterprise 10,000 SAR), FAQ, Arabic RTL
- **Login** (`login.html`): Email input → magic link, token input alternative
- **Onboarding** (`onboarding.html`): 3-step wizard (Connect Store → Scan WhatsApp QR → Activate Features → Success with confetti)
- **WhatsApp Setup** (`whatsapp.html`): QR code display, 60-sec timer, connection status, disconnect option

---

## API Routes to Implement (~85 routes)

### Auth
```
POST /api/auth/send-link        — Send magic link email
GET  /api/auth/verify           — Verify token, return store info
GET  /api/auth/logout           — Clear cookie, redirect
```

### WhatsApp
```
GET  /api/whatsapp/connect      — Init Baileys connection, return QR
GET  /api/whatsapp/status       — Connection status
GET  /api/whatsapp/qr           — Current QR code
POST /api/whatsapp/send         — Send message
POST /api/whatsapp/disconnect   — Disconnect session
GET  /api/whatsapp/connected    — Health check (keep-alive)
```

### Webhooks
```
GET/POST /webhooks/salla        — Main Salla webhook
GET/POST /api/webhooks/salla    — Alt path
GET/POST /webhook               — Fallback path
POST /api/shopify/webhook/*     — Shopify webhooks
```

### AI
```
POST /api/ai/generate-message   — Personalized recovery message
POST /api/ai/generate-offer     — Context-aware offer
POST /api/ai/generate-cart-offer — Cart-specific offer
GET  /api/ai/insights           — AI learning insights
```

### Analytics & Customers
```
GET  /api/analytics/v2          — Comprehensive analytics
GET  /api/customers/:id/predictions — CLV, churn, next order
GET  /api/segments/dashboard    — RFM segment overview
POST /api/events/track          — Track custom events
```

### Campaigns
```
POST /api/campaigns/create      — Create campaign
POST /api/campaigns/:id/start   — Start campaign
POST /api/campaigns/:id/pause   — Pause campaign
GET  /api/campaigns/:id/stats   — Campaign stats
GET  /api/campaigns/list        — List all campaigns
POST /api/campaigns/broadcast   — Broadcast to segment
```

### Reviews, Upsells, Browse, Loyalty, Referrals, COD, Leads, Store Settings
— Full CRUD for each feature (see feature descriptions above)

### Admin & Debug
```
GET  /api/carts                 — List abandoned carts
GET  /api/stats                 — Global stats
GET  /api/stores                — List all stores
GET  /health                    — Health check
```

---

## Architecture

```
Clients (public/*.html)
        │ HTTPS
        ▼
Firebase Hosting → Cloud Functions (europe-west1)
        │
   Express API (functions/server.js)
        │
   ┌────┼────┬────────┬──────────┐
   ▼    ▼    ▼        ▼          ▼
Firestore  Baileys  AWS SES   Groq AI
(data)   (WhatsApp) (email)  (offers)
```

### Data Storage (Dual Persistence)
- **Firestore**: `salla_merchants`, `abandoned_carts`, `sequences`, `whatsapp_sessions`, `leads`, `campaigns`, `message_queue`, `analytics_events`
- **Local JSON** (`functions/data/`): `stores.json`, `customers.json`, `sequences.json`, `discount_codes.json`, `ab_tests.json`, `email_usage.json`, `popup_leads.json`, `referrals.json` — fast-access layer for hot data

---

## Project Structure

```
ribh-app/
├── functions/
│   ├── index.js                # Firebase exports: api, keepAlive, triggerKeepAlive
│   ├── server.js               # Main Express app — ALL routes + middleware
│   ├── package.json            # Node 20, deps: baileys, @aws-sdk/client-ses, firebase-admin, groq-sdk
│   ├── lib/                    # Business logic modules (one file per feature)
│   │   ├── lifecycleEngineV2.js    # Core orchestration
│   │   ├── sequenceEngine.js       # Multi-step sequences
│   │   ├── cartDetection.js        # Cart processing
│   │   ├── whatsappBridge.js       # Baileys integration
│   │   ├── offerGenerator.js       # AI offers (Groq)
│   │   ├── aiMessenger.js          # Personalized messaging
│   │   ├── emailSender.js          # AWS SES
│   │   ├── smsSender.js            # AWS SNS + Twilio
│   │   ├── sallaApp.js             # Salla OAuth
│   │   ├── shopifyApp.js           # Shopify OAuth
│   │   ├── sallaWebhooks.js        # Webhook handler
│   │   ├── rfmSegmentation.js      # Customer segmentation
│   │   ├── predictiveAnalytics.js  # CLV, churn prediction
│   │   ├── campaignLauncher.js     # Campaign management
│   │   ├── postPurchaseUpsell.js   # Upsells
│   │   ├── browseAbandonment.js    # Browse recovery
│   │   ├── reviewCollector.js      # Review collection
│   │   ├── referralSystem.js       # Referral program
│   │   ├── abTesting.js            # A/B testing
│   │   ├── antiBan.js              # WhatsApp rate limiting
│   │   ├── messageQueue.js         # Message queue
│   │   ├── customerImport.js       # CSV import
│   │   ├── eventTracker.js         # Event logging
│   │   ├── discountCodes.js        # Code generation
│   │   └── ...                     # Other modules
│   ├── routes/
│   │   ├── salla.js                # Salla OAuth routes
│   │   └── shopify.js              # Shopify OAuth routes
│   ├── webhooks/
│   │   ├── sallaCart.js            # Cart webhook handler
│   │   └── sallaOrder.js          # Order webhook handler
│   ├── test/                       # Tests
│   └── data/                       # Local JSON storage
├── public/                         # Frontend (Firebase Hosting)
│   ├── index.html                  # Marketing homepage
│   ├── login.html                  # Magic link login
│   ├── onboarding.html             # Setup wizard
│   ├── whatsapp.html               # WhatsApp QR setup
│   ├── platform/                   # Dashboard pages
│   │   ├── shared/
│   │   │   ├── shell.js            # Sidebar + topbar (injected into all pages)
│   │   │   └── shell.css           # Shared styles
│   │   ├── dashboard.html
│   │   ├── autopilot.html
│   │   ├── inbox.html
│   │   ├── customers.html
│   │   ├── customer.html
│   │   ├── flows.html
│   │   ├── flow-builder.html
│   │   ├── campaigns.html
│   │   ├── analytics.html
│   │   ├── segments.html
│   │   ├── settings.html
│   │   └── popup-builder.html
│   └── widget/                     # Exit-intent popup embed script
├── firebase.json                   # Hosting config + function rewrites
├── firestore.rules                 # All client access blocked
├── .firebaserc                     # Project: ribh-484706
├── server.js                       # Root entry (standalone/Render mode)
└── .github/workflows/
    ├── firebase-hosting.yml        # Deploy on push to main
    └── auto-merge-claude.yml       # Auto-merge claude/** branches
```

---

## UI/Design Rules

- **ALL UI is Arabic RTL** (`dir="rtl"`, `lang="ar"`)
- **Dark theme**: `#0a0a0a` background, `#10B981` green accent, `#6366F1` purple secondary
- **Fonts**: IBM Plex Sans Arabic (primary), Inter (numbers/English), Tajawal (marketing pages)
- **Icons**: Lucide (CDN or embedded SVG)
- **No framework**: Pure vanilla HTML/CSS/JS. Each page is a standalone HTML file.
- **Shared shell**: All platform pages load `shared/shell.js` which injects sidebar + topbar
- **Glass morphism**: Cards use `backdrop-filter: blur()` with semi-transparent borders
- **Animations**: Subtle — fade-in, slide-up, scale-in. Confetti on onboarding success.

---

## Key Business Rules

1. **Free-tier focused**: Architecture optimizes for zero cost — Baileys (free WhatsApp), Groq (free AI), Firebase Spark (free hosting)
2. **Graceful module loading**: Every `require()` in server.js is wrapped in try/catch so missing modules don't crash the app
3. **AI always has fallbacks**: Groq → Gemini → hardcoded Arabic templates
4. **Keep-alive scheduler**: Cloud Function runs every 5 min to prevent cold starts and process pending sequences
5. **Dual persistence**: Critical data in both Firestore and local JSON for speed
6. **Email limit**: Free tier = 500 emails/month per store, tracked in `email_usage.json`
7. **All Firestore rules block client access**: `allow read, write: if false` — everything goes through Admin SDK in Cloud Functions

---

## Environment Variables Needed

```
SALLA_CLIENT_ID, SALLA_CLIENT_SECRET, SALLA_WEBHOOK_SECRET
SHOPIFY_API_KEY, SHOPIFY_API_SECRET
GROQ_API_KEY, GEMINI_API_KEY
AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION=eu-north-1
RESEND_API_KEY
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
TELEGRAM_BOT_TOKEN
WHATSAPP_BRIDGE_URL, WHATSAPP_BRIDGE_KEY
EMAIL_FROM
```

---

## What "Done" Looks Like

1. `npm install` works in `functions/`
2. `node functions/server.js` starts Express on port 3000 with all routes working
3. All frontend pages render correctly in Arabic RTL with dark theme
4. Salla/Shopify OAuth flows complete successfully
5. WhatsApp QR scanning connects via Baileys
6. Abandoned cart webhook → AI message → WhatsApp/Email/SMS delivery works end-to-end
7. Dashboard shows real analytics data from Firestore
8. Campaign creation, launch, and tracking works
9. Customer segmentation (RFM) displays correctly
10. A/B testing records and picks winners
11. `firebase deploy` succeeds
12. All features degrade gracefully when APIs are unavailable

Build everything. Make it functional. Ship it.
