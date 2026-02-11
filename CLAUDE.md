# CLAUDE.md - Project Rules & Codebase Guide for Claude Code

## Approach & Planning
- Before writing any code, describe the approach and wait for approval. Ask clarifying questions if requirements are ambiguous.
- If a task requires changes to more than 3 files, stop and break it into smaller tasks first.

## Code Quality
- After writing code, list what could break and suggest tests to cover it.
- When there's a bug, start by writing a test that reproduces it, then fix it until the test passes.

## Deployment
- GitHub PAT is available for direct pushes to main (no PRs needed).
- Pushes to main auto-deploy to Firebase Hosting via GitHub Actions.
- `claude/**` branches auto-merge to main via `.github/workflows/auto-merge-claude.yml`.
- Firebase service account currently lacks `serviceusage.serviceUsageConsumer` role — only hosting deploys work (no functions/firestore).
- Always verify deploy passes after pushing: `gh run list --repo hmmansami/ribh-app --limit 1`
- Deploy command (manual): `firebase deploy --project ribh-484706 --force`

---

## Project Context

RIBH (رِبح) is an abandoned cart recovery platform for Salla/Shopify stores in Saudi Arabia. It uses WhatsApp, email, and SMS to recover abandoned carts through AI-generated personalized offers.

- **Firebase project ID**: `ribh-484706`
- **Live URL**: https://ribh-484706.web.app
- **Cloud Functions region**: `europe-west1`

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| Backend | Express (single `functions/server.js` — 9,408 lines) |
| Hosting | Firebase Hosting (static files from `public/`) |
| Functions | Firebase Cloud Functions (`europe-west1`) |
| Database | Firestore (Admin SDK only, all client access blocked) |
| WhatsApp | Baileys 6.x (WebSocket, no Chrome needed) |
| Email | AWS SES (`@aws-sdk/client-ses`) |
| SMS | AWS SNS + Twilio |
| AI | Groq API (free tier), Gemini API (fallback) |
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| CI/CD | GitHub Actions → Firebase deploy |

### UI Conventions
- All UI is Arabic RTL
- Font: Tajawal (primary), IBM Plex Sans Arabic, Inter
- Dark theme: `#0a0a0a` background, `#10B981` green accent
- Icons: Lucide (embedded in HTML)

---

## Repository Structure

```
ribh-app/
├── functions/                  # Backend: Cloud Functions + Express API
│   ├── index.js               # Firebase exports: api, keepAlive, triggerKeepAlive (147 lines)
│   ├── server.js              # Main Express app (9,408 lines, ~160 routes)
│   ├── package.json           # Node 20, Baileys, AWS SDK, Firebase
│   ├── lib/                   # 48 business logic modules
│   ├── routes/                # Modular route files (salla.js, shopify.js)
│   ├── webhooks/              # Webhook handlers (sallaCart.js, sallaOrder.js)
│   ├── test/                  # Tests (fullFlowTest.js, quick-test.js, sample payloads)
│   └── data/                  # Local JSON file storage (customers, sequences, email_usage)
├── public/                    # Frontend: static HTML/CSS/JS served by Firebase Hosting
│   ├── index.html             # Marketing homepage
│   ├── login.html             # Magic link authentication
│   ├── onboarding.html        # Setup wizard
│   ├── privacy.html           # Privacy policy
│   ├── prototype.html         # Prototype/demo page
│   ├── platform/              # Multi-page platform dashboard (10 pages)
│   │   ├── shared/            # Shared shell.js + shell.css
│   │   └── blueprint/         # Reference design pages (engine, experience, outcome)
│   ├── js/                    # analytics.js
│   ├── archive/               # Archived UI pages
│   └── _redirects             # Redirect rules
├── whatsapp-bridge/           # Placeholder for WhatsApp bridge service (empty)
├── test/                      # Root-level tests (e2e-test.js, simulate-salla.js)
├── archive/                   # Archived designs and pages
├── bemo-avatar/               # Avatar assets
├── .github/workflows/         # CI/CD pipelines
│   ├── firebase-hosting.yml   # Deploy on push to main
│   └── auto-merge-claude.yml  # Auto-merge claude/** → main
├── docs/                      # Strategy docs & research
├── firebase.json              # Hosting config + function rewrites
├── firestore.rules            # All client access blocked (Admin SDK only)
├── .firebaserc                # Project: ribh-484706
├── server.js                  # Root entry point (Render/standalone mode, 39 lines)
├── render.yaml                # Render deployment config
└── vercel.json                # Vercel deployment config
```

### Key Entry Points
| Context | File | Purpose |
|---------|------|---------|
| Firebase Functions | `functions/index.js` | Exports `api` (Express), `keepAlive` (scheduler), `triggerKeepAlive` |
| Express App | `functions/server.js` | All ~160 API routes, middleware, integrations |
| Standalone/Render | `server.js` (root) | Wraps functions/server.js for non-Firebase hosting |

---

## Architecture Overview

```
Clients (public/*.html, public/platform/*.html)
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

### Data Storage
- **Firestore**: Persistent data — `salla_merchants`, `abandoned_carts`, `sequences`, `whatsapp_sessions`, `leads`
- **Local JSON** (`functions/data/`): Fast-access file storage — `customers.json`, `sequences.json`, `email_usage.json`
- **Firestore rules**: All client reads/writes blocked (`allow read, write: if false`). All access through Admin SDK in Cloud Functions.

---

## Core Business Logic Modules (`functions/lib/`)

48 JavaScript modules organized by function:

### Core Orchestration
| Module | Purpose |
|--------|---------|
| `lifecycleEngineV2.js` | Core orchestration — sequences, WhatsApp, offers, timing |
| `lifecycleEngine.js` | Legacy lifecycle engine (fallback) |
| `sequenceEngine.js` | Multi-step flow orchestration |
| `cartDetection.js` | Abandoned cart detection |
| `messageQueue.js` | Message queuing system |

### Platform Integrations
| Module | Purpose |
|--------|---------|
| `sallaWebhooks.js` | Salla webhook handler, phone normalization (+966 format) |
| `sallaApp.js` | Salla OAuth + token management |
| `shopifyApp.js` | Shopify OAuth + webhooks |

### WhatsApp (5 modules)
| Module | Purpose |
|--------|---------|
| `whatsappBridge.js` | Baileys WebSocket integration (local) |
| `whatsappBridgeV2.js` | Updated WhatsApp bridge |
| `whatsappClient.js` | HTTP client to Render bridge service |
| `whatsappAssistant.js` | AI-powered WhatsApp messaging |
| `whatsappSender.js` | WhatsApp message sending |

### Messaging & Communication
| Module | Purpose |
|--------|---------|
| `emailSender.js` | AWS SES email sending |
| `smsSender.js` | AWS SNS + Twilio SMS |
| `aiMessenger.js` | AI-powered personalized messaging |
| `messageVariants.js` | Message variant generation |
| `fallbackSender.js` | Fallback messaging system |
| `metaWhatsApp.js` | Meta WhatsApp API integration |
| `replyDetector.js` | Incoming message/reply detection |
| `orderNotifications.js` | Order notification handling |

### AI & Offers
| Module | Purpose |
|--------|---------|
| `offerGenerator.js` | AI offer generation via Groq API |
| `offer-generator.js` | Alternative offer generation module |
| `postPurchaseUpsell.js` | AI-powered post-purchase upsells |
| `toneAdapter.js` | Message tone adaptation |
| `aiLearning.js` | Continuous learning from behavior |

### Analytics & Segmentation
| Module | Purpose |
|--------|---------|
| `predictiveAnalytics.js` | CLV, churn prediction, next order |
| `rfmSegmentation.js` | RFM customer scoring |
| `analyticsEngine.js` | Comprehensive analytics |
| `analytics.js` | General analytics utilities |
| `eventTracker.js` | Event logging for analytics |
| `customerScoring.js` | Customer scoring system |
| `storeAnalyzer.js` | Store analysis for AI insights |

### Campaigns & Outreach
| Module | Purpose |
|--------|---------|
| `campaignLauncher.js` | Cold outreach campaign management |
| `campaignGenerator.js` | Campaign generation |
| `outreachTracker.js` | WhatsApp outreach A/B testing |
| `browseAbandonment.js` | Product view recovery |
| `reviewCollector.js` | WhatsApp review collection |
| `abTesting.js` | A/B test framework |

### Data & Utilities
| Module | Purpose |
|--------|---------|
| `customerImport.js` | CSV/POS customer import with deduplication |
| `discountCodes.js` | Discount code management |
| `referralSystem.js` | Referral tracking & management |
| `paymentTokens.js` | Payment token handling |
| `optOutManager.js` | Opt-out list management |
| `productMemory.js` | Product view tracking |
| `timingLearner.js` | Sending time optimization |
| `qrOptin.js` | QR code opt-in system |
| `antiBan.js` | Rate limiting + human-like sending delays |

---

## API Routes (in `functions/server.js`)

~160 routes total. Key route groups:

### Authentication
```
POST /api/auth/send-link     → Send magic link email
GET  /api/auth/verify        → Verify token, return store info
GET  /api/auth/logout        → Clear cookie, redirect to login
```

### WhatsApp
```
GET  /api/whatsapp/connect   → Start Baileys connection + QR
GET  /api/whatsapp/status    → Connection status
GET  /api/whatsapp/qr        → Current QR code
POST /api/whatsapp/send      → Send message
GET  /api/whatsapp/connected → Health check (keep-alive)
POST /api/whatsapp/disconnect → Disconnect session
```

### Webhooks
```
GET/POST /webhooks/salla        → Main Salla webhook receiver
GET/POST /api/webhooks/salla    → Alternative path
POST     /webhook               → Fallback path
```

### Salla/Shopify OAuth
```
GET /oauth/callback          → Salla OAuth token exchange
GET /salla/callback          → Alternative Salla callback
GET /shopify/install         → Shopify OAuth redirect
GET /shopify/callback        → Shopify token exchange
```

### AI
```
POST /api/ai/generate-message    → Personalized message
POST /api/ai/generate-offer      → Discount offer
POST /api/ai/generate-cart-offer → Cart-specific offer
GET  /api/ai/insights            → Store AI insights
```

### Analytics & Customers
```
GET /api/customers/:id/predictions  → CLV, churn, next order
GET /api/segments/dashboard         → Segment overview
GET /api/analytics/v2               → Comprehensive analytics
POST /api/events/track              → Track custom event
```

### Campaigns
```
POST /api/campaigns/broadcast  → Broadcast campaign
GET  /api/ab-tests             → A/B test management
GET  /api/referrals            → Referral tracking
```

### Admin & System
```
GET  /api/carts              → List abandoned carts
GET  /api/stats              → Global stats
GET  /api/stores             → List all stores
GET  /health                 → Health check
GET  /api/cron/*             → Cron job endpoints
GET  /widget.js              → Dynamic widget script
```

---

## Platform Pages (`public/platform/`)

10 separate HTML pages — each is a standalone page sharing shell.js + shell.css:

| Page | Purpose |
|------|---------|
| `dashboard.html` | Main dashboard with KPIs and overview |
| `analytics.html` | Analytics and reporting |
| `journeys.html` | Journey/sequence builder |
| `campaigns.html` | Campaign management |
| `settings.html` | Store settings (largest page) |
| `signup-tools.html` | Signup widgets and exit-intent popups |
| `subscribers.html` | Subscriber list view |
| `subscriber.html` | Individual subscriber detail |
| `segments.html` | Customer segments |
| `inbox.html` | Inbox/messages |

Blueprint reference pages in `blueprint/`: `engine.html`, `experience.html`, `outcome.html`

---

## Authentication Pattern

- **Method**: Magic links via email (no passwords)
- **Token**: `ribhToken` stored as HTTP-only cookie (30-day expiry, secure, sameSite=lax)
- **Middleware**: `verifyStoreToken()` — reads token from `req.query.token` or cookie, looks up store in local JSON, attaches `req.store`
- **Protected routes**: All `/api/*` routes use `verifyStoreToken` middleware (except auth, webhooks, health)
- **Webhook auth**: HMAC-SHA256 signature verification with timing-safe comparison

---

## Key Patterns

### Graceful Module Loading
All lib modules are loaded with try/catch in `server.js` so missing or broken modules don't crash the entire app:
```js
let moduleX;
try { moduleX = require('./lib/moduleX'); } catch(e) { moduleX = null; }
```

### Phone Normalization
Saudi numbers are normalized to `+966XXXXXXXXX` format. Input accepts: `05XXXXXXXX`, `5XXXXXXXX`, `9665XXXXXXXX`, `+9665XXXXXXXX`.

### AI with Fallbacks
AI calls (Groq/Gemini) always have template-based fallbacks if the API fails.

### Dual WhatsApp Strategy
1. **Baileys (primary)**: Direct WebSocket — free, uses merchant's own number
2. **Render Bridge (backup)**: HTTP API to external service

---

## Development Workflow

### Local Development
```bash
# Install dependencies
cd functions && npm install

# Run with Firebase emulators
npm run serve
# → Functions on :5001, Firestore on :8080, Hosting on :5000

# Or run standalone Express server
node functions/server.js

# Or run root server (Render mode)
node server.js
```

### Testing
```bash
# Run end-to-end test (mock Firebase, WhatsApp, Email)
node functions/test/fullFlowTest.js

# Run quick validation
node functions/test/quick-test.js

# Abandoned cart WhatsApp test
node functions/test/test-abandoned-cart-whatsapp.js

# Root-level e2e test
node test/e2e-test.js

# Salla simulation
node test/simulate-salla.js

# In-lib unit tests
node functions/lib/messageQueue.test.js
node functions/lib/replyDetector.test.js
```

### Linting
```bash
cd functions && npx eslint .
```

### Deploying
```bash
# Auto-deploy: push to main (or push to claude/** branch for auto-merge)
git push origin main

# Manual deploy
firebase deploy --project ribh-484706 --force

# Verify deployment
gh run list --repo hmmansami/ribh-app --limit 1
```

---

## Dependencies

### Functions (`functions/package.json`)
| Package | Version | Purpose |
|---------|---------|---------|
| `@aws-sdk/client-ses` | ^3.975.0 | AWS SES email sending |
| `@aws-sdk/client-sns` | ^3.750.0 | AWS SNS SMS sending |
| `axios` | ^1.6.0 | HTTP client |
| `baileys` | ^6.7.21 | WhatsApp WebSocket library |
| `cors` | ^2.8.5 | CORS middleware |
| `dotenv` | ^16.0.3 | Environment variables |
| `express` | ^4.18.2 | Web framework |
| `firebase-admin` | ^11.5.0 | Firebase Admin SDK |
| `firebase-functions` | ^4.3.1 | Cloud Functions SDK |
| `node-fetch` | ^2.7.0 | Fetch API for Node |
| `pino` | ^8.21.0 | Logging library |
| `qrcode` | ^1.5.4 | QR code generation |
| `twilio` | ^4.20.0 | SMS via Twilio |

Optional: `whatsapp-web.js@^1.23.0`

### Root (`package.json`)
| Package | Purpose |
|---------|---------|
| `axios`, `cors`, `dotenv`, `express`, `firebase-admin` | Standalone server deps |
| `firebase-tools` (dev) | Firebase CLI |

---

## Environment Variables

Secrets are managed in:
- **Local dev**: `functions/.env` (gitignored)
- **CI/CD**: GitHub repository secrets → injected by workflow
- **Template**: `functions/.env.example`

### Required Variables
| Variable | Service |
|----------|---------|
| `SALLA_CLIENT_ID` | Salla OAuth |
| `SALLA_CLIENT_SECRET` | Salla OAuth |
| `SALLA_WEBHOOK_SECRET` | Webhook signature verification |
| `GROQ_API_KEY` | AI offer generation (free) |
| `GEMINI_API_KEY` | AI fallback |
| `AWS_ACCESS_KEY` | AWS SES/SNS |
| `AWS_SECRET_KEY` | AWS SES/SNS |
| `AWS_REGION` | `eu-north-1` |
| `RESEND_API_KEY` | Email (Resend) |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications |
| `WHATSAPP_BRIDGE_URL` | Render bridge URL |
| `WHATSAPP_BRIDGE_KEY` | Bridge auth key |
| `EMAIL_FROM` | Sender email address |

---

## GitHub Actions Workflows

### `firebase-hosting.yml` — Deploy to Firebase
- **Trigger**: Push to `main` or manual dispatch
- **Steps**: Checkout → Node 20 → Create `.env` from secrets → Install deps → Auth to GCloud → `firebase deploy`
- **Secrets**: `FIREBASE_SERVICE_ACCOUNT_RIBH_484706` + all env vars above

### `auto-merge-claude.yml` — Auto-merge Claude branches
- **Trigger**: Push to `claude/**`
- **Steps**: Checkout → Merge to `main` → Trigger firebase deploy workflow
- **Effect**: Any `claude/*` branch push auto-deploys

---

## Firebase Configuration (`firebase.json`)

### Hosting
- Public directory: `public/`
- Clean URLs enabled (no `.html` extensions needed)
- Trailing slash disabled
- 1-year cache for JS/CSS assets

### Function Rewrites
| URL Pattern | Target |
|-------------|--------|
| `/api/**` | `api` function (europe-west1) |
| `/oauth/**` | `api` function |
| `/webhooks/**` | `api` function |
| `/shopify/**` | `api` function |
| `/salla/**` | `api` function |

### Emulators
- Functions: port 5001
- Firestore: port 8080
- Hosting: port 5000

---

## Firestore Collections

| Collection | Doc ID Pattern | Purpose |
|-----------|---------------|---------|
| `salla_merchants` | `{merchantId}` | OAuth tokens, store info, status |
| `abandoned_carts` | `{storeId}_{cartId}` | Cart data, recovery status, messages sent |
| `sequences` | `{sequenceId}` | Multi-step journeys (WhatsApp → email → SMS) |
| `whatsapp_sessions` | `{merchantId}` | Baileys auth state persistence |
| `leads` | `{storeId}` | Scraped store leads for outreach |

---

## Important Conventions

1. **server.js is monolithic** — 9,408 lines. All routes live here. Route files in `routes/` are modular additions, not replacements.
2. **No frontend framework** — Platform pages are vanilla HTML/CSS/JS with shared shell. No React/Vue/Svelte.
3. **Arabic-first** — All user-facing strings are Arabic. Variable names and code comments are in English.
4. **Free-tier focused** — Architecture optimizes for zero cost: Baileys (free WhatsApp), Groq (free AI), Firebase Spark (free hosting).
5. **Keep-alive scheduler** — `keepAlive` function runs every 5 minutes to prevent cold starts, process pending sequences, and check abandoned carts.
6. **Dual persistence** — Some data is in both Firestore and local JSON files (`functions/data/`). JSON files are the faster-access layer.
7. **Separate platform pages** — Each platform page is an independent HTML file. Never merge them.

---

## Protected Files — DO NOT MODIFY WITHOUT EXPLICIT PERMISSION

The following files contain the **approved, polished design** (tagged `v1-polished-dashboard`). Any AI session that modifies these files risks breaking the live site.

**RULES:**
1. **NEVER merge multiple platform pages** into fewer pages. Each page is separate on purpose.
2. **NEVER "simplify" or "redesign" the UI** unless the user explicitly asks for a specific change.
3. **NEVER delete platform pages** or restructure `public/platform/`.
4. **Before modifying any file below**, describe exactly what you plan to change and wait for approval.
5. **After any UI change**, provide the live URL so the user can verify before making more changes.
6. If something breaks, revert to tag `v1-polished-dashboard`: `git checkout v1-polished-dashboard -- public/platform/`

### Protected file list:
- `public/platform/shared/shell.css` — Design system (layout, colors, components)
- `public/platform/shared/shell.js` — Navigation shell (sidebar, topbar)
- `public/platform/dashboard.html` — Main dashboard
- `public/platform/analytics.html` — Analytics page
- `public/platform/journeys.html` — Journeys page
- `public/platform/campaigns.html` — Campaigns page
- `public/platform/settings.html` — Settings page
- `public/platform/signup-tools.html` — Signup tools page
- `public/platform/subscribers.html` — Subscribers page
- `public/platform/subscriber.html` — Subscriber detail page
- `public/platform/segments.html` — Customer segments page
- `public/platform/inbox.html` — Inbox/messages page

---

## Corrections Log
- NEVER merge platform pages into fewer pages — this broke the entire UI before
- NEVER modify shell.css or shell.js without explicit approval — sidebar/layout breaks easily
- Always show the user the live URL after UI changes so they can verify
- The `whatsapp-bridge/` directory is currently empty — WhatsApp integration lives in `functions/lib/whatsappBridge*.js`
- No `public/admin/`, `public/widget/`, or `scripts/` directories exist — features are in `public/platform/` and `functions/lib/`
