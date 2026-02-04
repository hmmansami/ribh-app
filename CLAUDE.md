# CLAUDE.md - Project Rules & Codebase Guide

## Approach & Planning
- Before writing any code, describe the approach and wait for approval. Ask clarifying questions if requirements are ambiguous.
- If a task requires changes to more than 3 files, stop and break it into smaller tasks first.

## Code Quality
- After writing code, list what could break and suggest tests to cover it.
- When there's a bug, start by writing a test that reproduces it, then fix it until the test passes.

## Deployment
- GitHub PAT is available for direct pushes to main (no PRs needed).
- Pushes to main auto-deploy to Firebase Hosting via GitHub Actions (`.github/workflows/firebase-hosting.yml`).
- Firebase service account currently lacks `serviceusage.serviceUsageConsumer` role — only hosting deploys work (no functions/firestore).
- Always verify deploy passes after pushing: `gh run list --repo hmmansami/ribh-app --limit 1`
- Deploy command in CI: `firebase deploy --project ribh-484706 --force`

---

## Project Context

RIBH is an abandoned cart recovery platform for Salla/Shopify e-commerce stores in Saudi Arabia. It automates multi-channel outreach (WhatsApp, email, SMS) with AI-personalized messaging to recover abandoned carts, upsell post-purchase, and manage customer lifecycle sequences.

- **Firebase project ID:** ribh-484706
- **Live URL:** https://ribh-484706.web.app
- **Region:** europe-west1 (closest to Saudi Arabia)
- **Target market:** Saudi Arabia (Arabic-language, RTL)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20 |
| **Backend framework** | Express.js |
| **Hosting** | Firebase Hosting (static) + Cloud Functions (API) |
| **Database** | Cloud Firestore |
| **WhatsApp** | Baileys (free QR-based, no API fees) |
| **Email** | Resend / AWS SES |
| **SMS** | Twilio / AWS SNS (optional, disabled by default) |
| **AI** | Groq or Google Gemini (free tiers) |
| **E-commerce** | Salla OAuth (primary), Shopify (secondary) |
| **CI/CD** | GitHub Actions → Firebase auto-deploy |
| **Frontend** | Vanilla HTML/CSS/JS (no framework) |

---

## Repository Structure

```
ribh-app/
├── .github/workflows/
│   └── firebase-hosting.yml    # CI/CD: push to main → deploy
├── archive/                    # Historical designs and old public files
├── bemo-avatar/                # Avatar assets
├── docs/                       # 39 documentation files (guides, plans, roadmaps)
├── functions/                  # Backend (Firebase Cloud Functions)
│   ├── data/                   # JSON config (personality, sequences, etc.)
│   ├── lib/                    # 57 core library modules
│   ├── routes/                 # Express route handlers (salla.js, shopify.js)
│   ├── test/                   # Backend test files
│   ├── webhooks/               # Webhook handlers + tests
│   ├── index.js                # Firebase Functions entry point
│   ├── server.js               # Main Express app (all routes & middleware)
│   ├── server-standalone.js    # Standalone variant for Render deployment
│   ├── .env.example            # Environment variables template
│   └── package.json            # Backend dependencies (node 20)
├── public/                     # Frontend static files (Firebase Hosting)
│   ├── admin/                  # Admin panel pages
│   ├── js/                     # Frontend JavaScript
│   ├── widget/                 # Exit-intent popup widget
│   ├── index.html              # Landing page (Arabic RTL)
│   ├── dashboard.html          # Merchant analytics dashboard
│   ├── login.html              # OAuth login/signup
│   ├── onboarding.html         # New user setup wizard
│   ├── settings.html           # Store configuration
│   ├── whatsapp.html           # WhatsApp QR setup
│   └── ...                     # Other pages (faq, privacy, calculator, etc.)
├── scripts/                    # Utility scripts
├── test/                       # Root-level test files
├── whatsapp-bridge/            # WhatsApp Baileys bridge (deployed to Render)
├── firebase.json               # Firebase config (hosting + rewrites + emulators)
├── firestore.rules             # Firestore security rules
├── package.json                # Root package.json
├── render.yaml                 # Render deployment config (WhatsApp bridge)
└── server.js                   # Root Express server
```

---

## Key Files & Entry Points

| File | Purpose |
|------|---------|
| `functions/index.js` | Firebase Functions entry — exports `api` (HTTP) and `keepAlive` (scheduler) |
| `functions/server.js` | Main Express app (~302KB) — all routes, middleware, integrations |
| `functions/lib/lifecycleEngineV2.js` | Core orchestration engine — multi-step sequences (WhatsApp + email) |
| `functions/lib/aiMessenger.js` | AI-powered message personalization via Groq/Gemini |
| `functions/lib/sallaWebhooks.js` | Salla webhook processing with phone normalization (+966) |
| `functions/lib/whatsappBridge.js` | Baileys-based QR code integration for WhatsApp |
| `functions/lib/campaignLauncher.js` | Campaign orchestration and scheduling |
| `functions/lib/emailSender.js` | Resend/AWS SES email integration |
| `functions/routes/salla.js` | Salla OAuth callbacks and webhook routing |
| `functions/routes/shopify.js` | Shopify webhook routing |
| `firebase.json` | Firebase Hosting config + API rewrites to europe-west1 |
| `firestore.rules` | Firestore security rules (permissive — Cloud Functions use Admin SDK) |
| `.github/workflows/firebase-hosting.yml` | CI/CD pipeline |

---

## Backend Architecture

### Cloud Functions Exports (`functions/index.js`)
- **`api`** — Regional HTTP function (europe-west1) serving the Express app
- **`keepAlive`** — Pub/Sub scheduler running every 5 minutes:
  - Pings health endpoint to prevent cold starts
  - Keeps WhatsApp Baileys sessions warm
  - Processes pending lifecycle sequences via `lifecycleEngineV2`

### Core Library Modules (`functions/lib/`)

**Messaging channels:**
- `whatsappBridge.js` / `whatsappBridgeV2.js` — Baileys QR integration
- `whatsappSender.js` / `whatsappClient.js` — WhatsApp message sending
- `emailSender.js` — Email via Resend/AWS SES
- `smsSender.js` — SMS via Twilio/AWS SNS
- `fallbackSender.js` — Channel fallback logic

**Customer intelligence:**
- `predictiveAnalytics.js` — CLV and churn prediction
- `rfmSegmentation.js` — Recency/Frequency/Monetary scoring
- `customerScoring.js` — Engagement scoring
- `customerJourney.js` — Journey tracking
- `timingLearner.js` — Optimal send-time learning

**Conversion & lifecycle:**
- `lifecycleEngineV2.js` — Multi-step sequence orchestration (the "brain")
- `abandonedCart.js` — Cart recovery logic
- `browseAbandonment.js` — Browse abandonment tracking
- `postPurchaseUpsell.js` — Cross-sell/upsell automation
- `reviewCollector.js` — Post-purchase review collection
- `campaignLauncher.js` — Campaign orchestration

**AI & personalization:**
- `aiMessenger.js` — AI-powered messaging (Groq/Gemini)
- `toneAdapter.js` — Tone/voice adjustment
- `smartMessenger.js` — Smart message selection
- `messageVariants.js` — Message variant management

**Testing & optimization:**
- `abTesting.js` / `variantTester.js` — A/B testing framework
- `antiBan.js` — Rate limiting with human-like delays

**E-commerce integrations:**
- `sallaApp.js` — Salla OAuth token management
- `sallaWebhooks.js` — Salla webhook processing
- `shopifyApp.js` — Shopify integration

### Firebase Hosting Rewrites (`firebase.json`)
All API traffic is routed to the `api` Cloud Function (europe-west1):
- `/api/**`, `/oauth/**`, `/webhooks/**`, `/shopify/**`, `/salla/**`, `/app`

### Firestore Collections
- `stores` — Merchant store data
- `carts` — Abandoned cart records
- `logs` — Webhook and event logs
- `leads` — Lead capture data
- `templates` — Message templates
- `sequences` — Lifecycle sequence state

---

## Frontend Conventions

- **Language:** Arabic (RTL layout via `dir="rtl"`)
- **Font:** IBM Plex Sans Arabic (landing page), Tajawal (other pages)
- **Theme:** Dark background (`#050505` / `#0a0a0a`), emerald green accent (`#10B981`)
- **No framework** — vanilla HTML/CSS/JS throughout
- **Pages:** Each feature has its own HTML file in `public/`
- **Assets:** `public/js/` for shared scripts, `public/widget/` for embeddable components

---

## Environment Variables

Required secrets are managed in GitHub Actions secrets and injected into `functions/.env` during CI. See `functions/.env.example` for the full template.

**Required:**
- `SALLA_CLIENT_ID` / `SALLA_CLIENT_SECRET` — Salla OAuth
- `GROQ_API_KEY` or `GEMINI_API_KEY` — AI message generation
- `RESEND_API_KEY` or AWS credentials — Email sending
- `WHATSAPP_BRIDGE_URL` / `WHATSAPP_API_KEY` — WhatsApp bridge on Render

**Optional:**
- `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` — Shopify integration
- `TELEGRAM_BOT_TOKEN` — Telegram notifications
- `AWS_ACCESS_KEY` / `AWS_SECRET_KEY` — SES/SNS

---

## Development Workflow

### Local Development
```bash
# Install dependencies
npm install && cd functions && npm install

# Run with Firebase emulators
npx firebase emulators:start    # Hosting :5000, Functions :5001, Firestore :8080

# Or run standalone Express server
cd functions && node server-standalone.js
```

### Emulator Ports
| Service | Port |
|---------|------|
| Hosting | 5000 |
| Functions | 5001 |
| Firestore | 8080 |
| Emulator UI | auto |

### Testing
```bash
# Run webhook handler tests
node functions/webhooks/sallaCart.test.js

# Run integration tests
node functions/webhooks/sallaCart.integration.js

# Full flow test
node functions/test/fullFlowTest.js

# Quick smoke test
node functions/test/quick-test.js
```

No formal test framework (Jest/Mocha) is configured — tests are Node.js scripts run directly.

### Deploy
Push to `main` triggers auto-deploy via GitHub Actions. Only Firebase Hosting deploys due to service account permission limitations.

```bash
git push origin main
gh run list --repo hmmansami/ribh-app --limit 1   # verify deploy
```

---

## Git & Branching

- **Main branch:** `main` (production, auto-deploys)
- **Feature branches:** `claude/*` pattern for AI-assisted work
- **PRs:** Optional — direct pushes to main are acceptable
- **No branch protection** on main

---

## Key Design Decisions

1. **Zero-cost stack:** Baileys (free WhatsApp), Groq/Gemini (free AI tiers), Resend (free email tier) — no per-message API costs.
2. **Monolithic Express app:** All backend logic lives in `functions/server.js` with modules in `functions/lib/`. No microservices.
3. **Scheduler-based processing:** The `keepAlive` Cloud Function runs every 5 minutes to process pending sequences rather than using event-driven triggers.
4. **Saudi Arabia focus:** Phone normalization to +966, Arabic AI personality, europe-west1 region for latency.
5. **WhatsApp bridge on Render:** Baileys requires a persistent process for QR sessions, so the bridge runs on Render separately from Firebase Functions.

---

## Common Tasks for AI Assistants

- **Adding a new API route:** Add to `functions/server.js`, the monolithic Express app.
- **Adding a new library module:** Create in `functions/lib/`, then `require()` it in `server.js`.
- **Adding a new frontend page:** Create HTML file in `public/`, follow dark theme + RTL conventions.
- **Modifying webhooks:** See `functions/lib/sallaWebhooks.js` and `functions/webhooks/`.
- **Updating Firestore rules:** Edit `firestore.rules` (note: can't deploy rules via CI currently).
- **Checking deploy status:** `gh run list --repo hmmansami/ribh-app --limit 1`

---

## Corrections Log
- (Add new rules here every time the user corrects a mistake)
