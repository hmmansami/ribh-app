# 🚀 Firebase Deployment Guide for RIBH

Complete guide to deploy RIBH to Firebase Hosting + Cloud Functions.

## Prerequisites

1. **Firebase CLI installed**
   ```bash
   npm install -g firebase-tools
   ```

2. **Logged into Firebase**
   ```bash
   firebase login
   ```

3. **Firebase project created**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create project: `ribh-8a479` (or your project ID)
   - Enable **Firestore** in Native mode
   - Enable **Cloud Functions** (requires Blaze plan)

---

## 📋 Pre-Deployment Checklist

### 1. Install Dependencies
```bash
cd /home/ubuntu/clawd/ribh-app/functions
npm install
```

### 2. Verify Project Config
Check `.firebaserc`:
```json
{
  "projects": {
    "default": "ribh-8a479"
  }
}
```

### 3. Set Environment Variables
Firebase Functions need environment variables. Set them using:

```bash
# Required for core functionality
firebase functions:config:set \
  salla.client_id="476e7ed1-796c-4731-b145-73a13d0019de" \
  salla.client_secret="YOUR_SALLA_SECRET" \
  salla.webhook_secret="YOUR_WEBHOOK_SECRET"

# Email (Resend - FREE 3000/month)
firebase functions:config:set \
  resend.api_key="re_xxxxxxxxxxxxx" \
  email.from="Ribh <noreply@ribh.click>"

# AI (Optional - Gemini is FREE)
firebase functions:config:set \
  gemini.api_key="YOUR_GEMINI_KEY"

# OR OpenAI (paid)
firebase functions:config:set \
  openai.api_key="sk-xxxxxxxxxxxxx"

# SMS/WhatsApp via Twilio (Optional)
firebase functions:config:set \
  twilio.account_sid="ACxxxx" \
  twilio.auth_token="xxxx" \
  twilio.whatsapp_number="+14155238886" \
  twilio.sms_number="+1xxxxxxxxxx"

# AWS SNS for SMS (Optional - cheaper than Twilio)
firebase functions:config:set \
  aws.access_key="AKIA..." \
  aws.secret_key="xxxx" \
  aws.region="eu-west-1"

# Shopify (Optional)
firebase functions:config:set \
  shopify.api_key="xxxx" \
  shopify.api_secret="xxxx"
```

### 4. Verify Config
```bash
firebase functions:config:get
```

---

## 🔥 Deployment Commands

### Deploy Everything
```bash
cd /home/ubuntu/clawd/ribh-app
firebase deploy
```

### Deploy Only Functions
```bash
firebase deploy --only functions
```

### Deploy Only Hosting (Static Files)
```bash
firebase deploy --only hosting
```

### Deploy Only Firestore Rules
```bash
firebase deploy --only firestore:rules
```

---

## 🌍 Environment Variables Needed

### Required (Core)
| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `SALLA_CLIENT_ID` | Salla Partner App ID | [Salla Partners](https://salla.partners) |
| `SALLA_CLIENT_SECRET` | Salla App Secret | Salla Partners Dashboard |
| `SALLA_WEBHOOK_SECRET` | Webhook verification | Salla Partners Dashboard |

### Recommended (Email)
| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `RESEND_API_KEY` | Email sending | [Resend.com](https://resend.com) - FREE 3000/mo |
| `EMAIL_FROM` | From address | Your verified domain |

### Optional (AI)
| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `GEMINI_API_KEY` | Google AI (FREE!) | [Google AI Studio](https://aistudio.google.com) |
| `OPENAI_API_KEY` | OpenAI (paid) | [OpenAI](https://platform.openai.com) |

### Optional (Messaging)
| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `TWILIO_ACCOUNT_SID` | Twilio account | [Twilio Console](https://console.twilio.com) |
| `TWILIO_AUTH_TOKEN` | Twilio auth | Twilio Console |
| `TWILIO_WHATSAPP_NUMBER` | WhatsApp sender | Twilio WhatsApp Sandbox |
| `AWS_ACCESS_KEY` | AWS for SNS SMS | AWS IAM Console |
| `AWS_SECRET_KEY` | AWS secret | AWS IAM Console |

---

## 📁 Project Structure

```
ribh-app/
├── firebase.json          # Firebase config
├── .firebaserc           # Project aliases
├── firestore.rules       # Database security rules
├── public/               # Static files (hosting)
│   ├── index.html
│   ├── dashboard.html
│   ├── login.html
│   └── ...
└── functions/            # Cloud Functions
    ├── index.js          # Function exports
    ├── server.js         # Express app
    ├── package.json      # Dependencies
    ├── lib/              # Core libraries
    │   ├── lifecycleEngineV2.js
    │   ├── whatsappBridge.js
    │   ├── aiMessenger.js
    │   └── ...
    └── routes/           # API routes
        ├── salla.js
        └── shopify.js
```

---

## 🔗 Post-Deployment

### 1. Get Your URLs
After deployment, you'll have:
- **Hosting**: `https://ribh-8a479.web.app` or custom domain
- **Functions**: `https://us-central1-ribh-8a479.cloudfunctions.net/api`

### 2. Configure Salla Webhooks
In Salla Partners Dashboard, set webhook URL:
```
https://us-central1-ribh-8a479.cloudfunctions.net/api/salla/webhooks
```

Events to subscribe:
- `order.created`
- `order.updated`
- `order.completed`
- `order.cancelled`
- `cart.created`
- `cart.updated`
- `customer.created`

### 3. Set OAuth Callback
In Salla app settings:
```
https://ribh-8a479.web.app/oauth/callback
```

### 4. Custom Domain (Optional)
```bash
firebase hosting:channel:deploy production --expires 30d
firebase hosting:sites:create ribh-click
```

Or connect custom domain in Firebase Console → Hosting → Add custom domain.

---

## 🧪 Testing Locally

### Start Emulators
```bash
cd /home/ubuntu/clawd/ribh-app
firebase emulators:start
```

Access:
- Hosting: http://localhost:5000
- Functions: http://localhost:5001
- Firestore: http://localhost:8080
- Emulator UI: http://localhost:4000

### Test Endpoints
```bash
# Health check
curl http://localhost:5001/ribh-8a479/us-central1/api/health

# Test webhook
curl -X POST http://localhost:5001/ribh-8a479/us-central1/api/salla/webhooks \
  -H "Content-Type: application/json" \
  -d '{"event":"cart.created","data":{"id":"test"}}'
```

---

## 🐛 Troubleshooting

### "Functions deployment failed"
```bash
# Check logs
firebase functions:log

# Redeploy with debug
firebase deploy --only functions --debug
```

### "Missing dependencies"
```bash
cd functions
rm -rf node_modules package-lock.json
npm install
```

### "Permission denied"
Make sure you're logged in:
```bash
firebase login --reauth
```

### "Quota exceeded"
Upgrade to Blaze plan (pay-as-you-go). Cloud Functions require Blaze.

---

## 💰 Cost Estimates (Blaze Plan)

| Service | Free Tier | Beyond Free |
|---------|-----------|-------------|
| Functions Invocations | 2M/month | $0.40/million |
| Functions GB-seconds | 400K/month | $0.0000025/GB-sec |
| Firestore Reads | 50K/day | $0.06/100K |
| Firestore Writes | 20K/day | $0.18/100K |
| Hosting Bandwidth | 360MB/day | $0.15/GB |

**Expected cost for ~1000 stores**: $5-20/month

---

## 🚀 Quick Deploy Commands

```bash
# Full deployment
cd /home/ubuntu/clawd/ribh-app
npm install --prefix functions
firebase deploy

# Or step by step
firebase deploy --only firestore:rules
firebase deploy --only functions
firebase deploy --only hosting
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] `https://ribh-8a479.web.app` shows dashboard
- [ ] `https://ribh-8a479.web.app/api/health` returns OK
- [ ] Salla OAuth flow works (`/oauth/callback`)
- [ ] Webhooks receive events
- [ ] Firestore shows data in Console
- [ ] Cloud Scheduler shows `keepAlive` job

---

**Need help?** Check Firebase docs or contact Hmman.
