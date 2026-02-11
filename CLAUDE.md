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
| Backend | Express (single `functions/server.js` — 9,400+ lines) |
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
│   ├── index.js               # Firebase exports: api, keepAlive, triggerKeepAlive
│   ├── server.js              # Main Express app (9,400+ lines, ALL routes)
│   ├── package.json           # Node 20, Baileys, AWS SDK, Firebase
│   ├── lib/                   # 62 business logic modules
│   ├── routes/                # Modular route files (salla.js, shopify.js, payment.js)
│   ├── webhooks/              # Webhook handlers (sallaCart.js, sallaOrder.js + tests)
│   ├── test/                  # Tests (fullFlowTest.js, quick-test.js, sample payloads)
│   └── data/                  # Local JSON file storage (stores, customers, sequences)
├── public/                    # Frontend: static HTML/CSS/JS served by Firebase Hosting
│   ├── index.html             # Marketing homepage
│   ├── app.html               # Main SPA dashboard (~108KB, vanilla JS)
│   ├── login.html             # Magic link authentication
│   ├── onboarding.html        # Setup wizard
│   ├── setup.html             # WhatsApp QR connection
│   ├── admin/                 # Admin dashboard (signups, campaigns, outreach)
│   ├── platform/              # Klaviyo-like multi-page platform
│   │   └── shared/            # Shared shell.js + shell.css
│   ├── widget/                # Exit-intent popup (exit-popup.js)
│   └── js/                    # analytics.js, transitions.js
├── whatsapp-bridge/           # Standalone WhatsApp bridge service (Render)
├── .github/workflows/         # CI/CD pipelines
│   ├── firebase-hosting.yml   # Deploy on push to main
│   └── auto-merge-claude.yml  # Auto-merge claude/** → main
├── docs/                      # Strategy docs, research, deployment guides
├── scripts/                   # Build/deploy utility scripts
├── firebase.json              # Hosting config + function rewrites
├── firestore.rules            # All client access blocked (Admin SDK only)
├── .firebaserc                # Project: ribh-484706
├── server.js                  # Root entry point (Render/standalone mode)
└── render.yaml                # Render deployment config
```

### Key Entry Points
| Context | File | Purpose |
|---------|------|---------|
| Firebase Functions | `functions/index.js` | Exports `api` (Express), `keepAlive` (scheduler), `triggerKeepAlive` |
| Express App | `functions/server.js` | All 50+ API routes, middleware, integrations |
| Standalone/Render | `server.js` (root) | Wraps functions/server.js for non-Firebase hosting |

---

## Architecture Overview

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

### Data Storage
- **Firestore**: Persistent data — `salla_merchants`, `abandoned_carts`, `sequences`, `whatsapp_sessions`, `leads`
- **Local JSON** (`functions/data/`): Fast-access file storage — `stores.json`, `customers.json`, `sequences.json`, `discount_codes.json`, `ab_tests.json`, `personality.json`, `email_usage.json`, `popup_leads.json`, `referrals.json`, `store_settings.json`
- **Firestore rules**: All client reads/writes blocked (`allow read, write: if false`). All access through Admin SDK in Cloud Functions.

---

## Core Business Logic Modules (`functions/lib/`)

| Module | Purpose |
|--------|---------|
| `lifecycleEngineV2.js` | Core orchestration — sequences, WhatsApp, offers, timing |
| `sallaWebhooks.js` | Salla webhook handler, phone normalization (+966 format) |
| `sallaApp.js` | Salla OAuth + token management |
| `shopifyApp.js` | Shopify OAuth + webhooks |
| `whatsappBridge.js` | Baileys WebSocket integration (local) |
| `whatsappClient.js` | HTTP client to Render bridge service |
| `whatsappBridgeV2.js` | Updated WhatsApp bridge |
| `offerGenerator.js` | AI offer generation via Groq API |
| `emailSender.js` | AWS SES email sending |
| `smsSender.js` | AWS SNS + Twilio SMS |
| `sequenceEngine.js` | Multi-step flow orchestration |
| `messageQueue.js` | Message queuing system |
| `aiMessenger.js` | AI-powered personalized messaging |
| `antiBan.js` | Rate limiting + human-like sending delays |
| `rfmSegmentation.js` | RFM customer scoring |
| `predictiveAnalytics.js` | CLV, churn prediction, next order |
| `campaignLauncher.js` | Cold outreach campaigns |
| `customerImport.js` | CSV/POS customer import |
| `reviewCollector.js` | WhatsApp review collection |
| `postPurchaseUpsell.js` | AI-powered post-purchase upsells |
| `browseAbandonment.js` | Product view recovery |
| `eventTracker.js` | Event logging for analytics |
| `cartDetection.js` | Abandoned cart detection |
| `abTesting.js` | A/B test framework |

---

## API Routes (in `functions/server.js`)

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

### Admin
```
GET  /api/carts              → List abandoned carts
GET  /api/stats              → Global stats
GET  /api/stores             → List all stores
GET  /health                 → Health check
```

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
```

### Testing
```bash
# Run end-to-end test (mock Firebase, WhatsApp, Email)
node functions/test/fullFlowTest.js

# Run quick validation
node functions/test/quick-test.js

# Webhook-specific tests
node functions/webhooks/sallaCart.test.js
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
- **Steps**: Checkout → Node 20 → Create `.env` → Install deps → Auth to GCloud → `firebase deploy`
- **Secrets**: `FIREBASE_SERVICE_ACCOUNT_RIBH_484706` + all env vars above

### `auto-merge-claude.yml` — Auto-merge Claude branches
- **Trigger**: Push to `claude/**`
- **Steps**: Checkout → Merge to `main` → Trigger firebase deploy workflow
- **Effect**: Any `claude/*` branch push auto-deploys

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

1. **server.js is monolithic** — 9,400+ lines. All routes live here. Route files in `routes/` are modular additions, not replacements.
2. **No frontend framework** — Dashboard (`app.html`) is vanilla JS with inline state management. No React/Vue/Svelte.
3. **Arabic-first** — All user-facing strings are Arabic. Variable names and code comments are in English.
4. **Free-tier focused** — Architecture optimizes for zero cost: Baileys (free WhatsApp), Groq (free AI), Firebase Spark (free hosting).
5. **Keep-alive scheduler** — `keepAlive` function runs every 5 minutes to prevent cold starts and process pending sequences.
6. **Dual persistence** — Some data is in both Firestore and local JSON files (`functions/data/`). JSON files are the faster-access layer.

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
- `public/platform/settings.html` — Settings page
- `public/platform/signup-tools.html` — Signup tools page
- `public/platform/subscribers.html` — Subscribers page
- `public/platform/subscriber.html` — Subscriber detail page

---

## Corrections Log
- NEVER merge platform pages into fewer pages — this broke the entire UI before
- NEVER modify shell.css or shell.js without explicit approval — sidebar/layout breaks easily
- Always show the user the live URL after UI changes so they can verify
