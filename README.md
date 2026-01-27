# 🚀 RIBH - Recover Sales via WhatsApp

**Turn abandoned carts into completed orders. Free WhatsApp messaging for Salla/Shopify stores.**

RIBH sends personalized WhatsApp messages when customers abandon carts, with AI-generated offers that actually convert.

---

## ✨ What It Does

1. **Customer abandons cart** → Salla/Shopify webhook fires
2. **RIBH generates smart offer** → AI picks the right discount + message
3. **WhatsApp message sent** → From YOUR number (not Meta's API)
4. **Customer completes purchase** → You keep the sale

**Result:** 15-30% cart recovery rate, ~$0 messaging cost.

---

## 🏃 Quick Start

### Prerequisites
- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Salla Partner account (for Salla stores)

### Deploy in 3 Commands

```bash
# 1. Install
cd ribh-app/functions && npm install && cd ..

# 2. Login to Firebase
firebase login

# 3. Deploy
firebase deploy
```

**That's it.** Dashboard: `https://YOUR-PROJECT.web.app`

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| **Abandoned Cart Recovery** | Auto-detect abandonment, send recovery messages |
| **AI Offer Generator** | GPT/Gemini creates personalized discounts |
| **WhatsApp (Free)** | Uses Baileys - your number, zero API cost |
| **Lifecycle Campaigns** | Welcome → Nurture → Win-back sequences |
| **A/B Testing** | Test message variants, auto-pick winners |
| **Anti-Ban System** | Rate limiting, human-like delays |
| **Fallback Sender** | WhatsApp → SMS → Email if needed |
| **Smart Timing** | Learn best times to message each customer |
| **RFM Segmentation** | Recency/Frequency/Monetary scoring |
| **Dashboard** | Real-time analytics + ROI tracking |

---

## 🏗️ Architecture

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────┐
│ Salla/Shopify│─────▶│ Firebase Functions│─────▶│ WhatsApp     │
│   Webhook    │      │ (RIBH Engine)    │      │ Bridge       │
└──────────────┘      └──────────────────┘      │ (Baileys)    │
                             │                  └──────────────┘
                             ▼
                      ┌──────────────┐
                      │  Firestore   │
                      │  (Customer   │
                      │   Data)      │
                      └──────────────┘
```

**Stack:** Firebase Hosting + Functions + Firestore, Render (WhatsApp Bridge)

---

## 📝 Customize Messages

Edit `functions/data/personality.json`:

```json
{
  "brand_voice": "friendly_arabic",
  "greeting": "مرحباً {name}! 👋",
  "urgency_style": "gentle",
  "offer_prefix": "خصم خاص لك:",
  "emoji_level": "moderate"
}
```

### Offer Templates

In `functions/lib/offerGenerator.js`:

```javascript
const offers = {
  first_cart: { discount: 10, type: 'percentage', message: '...' },
  repeat_abandoner: { discount: 15, type: 'percentage', message: '...' },
  high_value: { discount: 'free_shipping', message: '...' }
};
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/salla/webhooks` | POST | Salla webhook receiver |
| `/api/shopify/webhooks` | POST | Shopify webhook receiver |
| `/api/stores/:id/stats` | GET | Store analytics |
| `/api/recovery/trigger` | POST | Manual recovery trigger |
| `/api/whatsapp/qr` | GET | Get QR for WhatsApp linking |
| `/api/whatsapp/status` | GET | Connection status |

---

## 🏪 Salla Merchants

### Setup Guide
See **[SALLA_SETUP.md](./SALLA_SETUP.md)** for:
- Creating Salla Partner app
- Configuring webhooks
- OAuth flow setup
- Testing with real store

### Webhook Events
Subscribe to these in Salla Partner Dashboard:
- `cart.created`, `cart.updated`
- `order.created`, `order.completed`, `order.cancelled`
- `customer.created`

---

## 📂 Key Files

```
functions/
├── lib/
│   ├── lifecycleEngineV2.js  # Message orchestration
│   ├── aiMessenger.js        # AI-powered messaging
│   ├── whatsappBridge.js     # Baileys integration
│   ├── antiBan.js            # Rate limiting
│   ├── offerGenerator.js     # Smart discounts
│   └── sallaWebhooks.js      # Webhook handlers
├── routes/
│   ├── salla.js              # Salla API routes
│   └── shopify.js            # Shopify API routes
└── server.js                 # Express app
```

---

## 💰 Cost

| Component | Cost |
|-----------|------|
| Firebase (Spark) | $0 |
| WhatsApp (Baileys) | $0 |
| AI (Gemini) | $0 |
| **Total** | **$0/month** |

*For high volume, upgrade to Firebase Blaze (~$5-20/month for 1000+ stores)*

---

## 📖 More Docs

- [DEPLOY.md](./DEPLOY.md) - Full deployment guide
- [SALLA_SETUP.md](./SALLA_SETUP.md) - Salla integration
- [PROGRESS.md](./PROGRESS.md) - Feature status (91% complete)
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Test the system

---

## 🙏 Credits

Built by [@hmmansami](https://github.com/hmmansami)

**Powered by:**
- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Firebase](https://firebase.google.com) - Backend infrastructure
- [Gemini](https://ai.google.dev) - AI offer generation
- [Salla](https://salla.dev) - E-commerce platform

---

**License:** MIT
