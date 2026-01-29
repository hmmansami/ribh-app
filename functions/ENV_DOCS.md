# RIBH Environment Variables Documentation

## Required for Production

### Salla OAuth (Already in code defaults)
```
SALLA_CLIENT_ID=476e7ed1-796c-4731-b145-73a13d0019de
SALLA_CLIENT_SECRET=ca8e6de4265c8faa553c8ac45af0acb6306de00a388bf4e06027e4229944f5fe
SALLA_WEBHOOK_SECRET=  # Optional - for webhook signature verification
```

### AI (At least one required for smart offers)
```
GROQ_API_KEY=         # FREE - For offer generation (preferred)
GEMINI_API_KEY=       # FREE - Fallback AI
OPENAI_API_KEY=       # Paid - Optional fallback
```

### Email (Required for email sequences)
```
RESEND_API_KEY=       # 3000 free/month - RECOMMENDED
EMAIL_FROM=ribh@ribh.click

# OR AWS SES (for scale)
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=eu-west-1
EMAIL_PROVIDER=resend  # or 'aws'
```

### WhatsApp Bridge (Required for WhatsApp)
```
WHATSAPP_BRIDGE_URL=https://ribh-whatsapp-1.onrender.com
WHATSAPP_BRIDGE_KEY=ribh-secret-2026
```

### Meta Cloud API (Optional - Alternative to QR Bridge)
```
WHATSAPP_TOKEN=       # Meta Business API token
WHATSAPP_PHONE_ID=    # Meta Phone Number ID
```

## Optional Services

### SMS (Disabled by default)
```
ENABLE_SMS=false
# AWS SNS (cheapest)
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
# OR Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_SMS_NUMBER=
SMS_PROVIDER=aws  # or 'twilio'
```

### Telegram (Disabled by default)
```
ENABLE_TELEGRAM=false
TELEGRAM_BOT_TOKEN=
```

## Feature Toggles
```
ENABLE_EMAIL=true      # Enable email channel
ENABLE_WHATSAPP=true   # Enable WhatsApp channel
ENABLE_SMS=false       # Enable SMS channel
ENABLE_TELEGRAM=false  # Enable Telegram channel
```

## Firebase (Auto-detected)
```
GCLOUD_PROJECT=ribh-8a479
FIREBASE_CONFIG=       # Auto-set by Firebase Functions
FIREBASE_SERVICE_ACCOUNT=  # JSON string for external deployment (Render)
```

## App URLs
```
APP_URL=https://ribh.click
RIBH_WHATSAPP_API=https://ribh-whatsapp-1.onrender.com
```

---

## Current Status

| Service | Status | Notes |
|---------|--------|-------|
| Salla OAuth | ✅ Working | Tokens stored in Firestore |
| WhatsApp (QR Bridge) | ✅ Ready | Needs Render service running |
| Email (Resend) | ⚠️ Needs key | Add RESEND_API_KEY |
| AI Offers | ⚠️ Needs key | Add GROQ_API_KEY or GEMINI_API_KEY |
| Analytics | ✅ Working | Firestore-based |
| Sequences | ✅ Working | Multi-step email + WhatsApp |
| Anti-Ban | ✅ Working | Rate limiting built-in |

## Deployment Checklist

1. Set GROQ_API_KEY or GEMINI_API_KEY for AI offers
2. Set RESEND_API_KEY for email (or AWS SES credentials)
3. Deploy WhatsApp bridge to Render (ribh-whatsapp-1)
4. Verify Salla app webhook URL is set to: `https://europe-west1-ribh-8a479.cloudfunctions.net/api/webhooks/salla`
