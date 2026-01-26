# RIBH Integration Flow - Wired Together! 🔌

## Overview

All modules are now **fully integrated**:

```
Cart Abandoned
    │
    ▼
┌───────────────────────────────────────┐
│  lifecycleEngineV2.handleAbandonedCart │
├───────────────────────────────────────┤
│  1. Generate AI Offer (offerGenerator) │
│  2. Start SequenceEngine (email flow)  │
│  3. Send IMMEDIATE WhatsApp (first!)   │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│  Every 5 min (keepAlive)              │
├───────────────────────────────────────┤
│  sequenceEngine.processPendingSteps() │
│  - Check active sequences             │
│  - Send scheduled emails/WhatsApp     │
│  - Uses antiBan via whatsappClient    │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│  Order Created (Webhook)              │
├───────────────────────────────────────┤
│  lifecycleEngineV2.handleOrderCreated │
│  1. CANCEL cart_recovery sequence! ✓  │
│  2. Update customer record            │
│  3. Start post_purchase sequence      │
│  4. Send thank you WhatsApp           │
└───────────────────────────────────────┘
```

## Module Connections

### 1. lifecycleEngineV2.js (The Brain)
```
Imports:
├── offerGenerator.js      → AI-powered offers
├── sequenceEngine.js      → Multi-step sequences
├── whatsappClient.js      → HTTP to Render bridge
├── emailSender.js         → Email delivery
└── referralSystem.js      → Referral links

Exports:
├── processEvent()         → Main webhook router
├── handleAbandonedCart()  → Cart → Sequence + WhatsApp
├── handleOrderCreated()   → Order → Cancel + Thank you
└── processPendingSequenceSteps() → Called by keepAlive
```

### 2. sequenceEngine.js (Multi-Step Automation)
```
Features:
├── Multi-channel: email + WhatsApp per step
├── Personalized messages with {name}, {cartValue}
├── Automatic progression based on time
└── Cancelled when customer converts!

Sequences:
├── cart_recovery (3 steps over 24h)
│   ├── Step 1 (30min): WhatsApp + Email
│   ├── Step 2 (2h): Email only
│   └── Step 3 (24h): WhatsApp + Email (final offer)
│
└── post_purchase (2 steps over 3 days)
    ├── Step 1 (10min): WhatsApp thank you
    └── Step 2 (3 days): Review request
```

### 3. whatsappClient.js (HTTP Bridge)
```
Flow:
Firebase Functions → HTTP → Render Bridge → WhatsApp

Uses:
- WHATSAPP_BRIDGE_URL (Render service)
- WHATSAPP_BRIDGE_KEY (API auth)

The Render bridge has antiBan.js built-in:
├── Rate limiting (20/hr, 100/day)
├── Human-like delays (45s-3min)
├── Message humanization
├── Typing indicators
└── Queue system
```

### 4. index.js (Firebase Entry)
```
keepAlive (every 5 min):
├── Health check
├── Ping WhatsApp bridge
└── processPendingSequenceSteps() ← KEY INTEGRATION
```

## API Endpoints

### Sequence Management
```
POST /api/sequences/process   - Manually trigger processing
GET  /api/sequences/stats     - Get sequence stats
POST /api/sequences/cancel    - Cancel a sequence
```

### WhatsApp
```
GET  /api/whatsapp/connect    - Get QR code
GET  /api/whatsapp/status     - Check connection
POST /api/whatsapp/send       - Send message (queued)
POST /api/whatsapp/send-cart-recovery - Cart recovery
```

## Key Fixes Made

1. **SequenceEngine now processes!**
   - `processPendingSteps()` called every 5 min via keepAlive
   - Previously existed but was never called

2. **No more setTimeout!**
   - Upsells/referrals use SequenceEngine now
   - Survives function restarts

3. **WhatsApp properly wired!**
   - Uses whatsappClient.js (HTTP to Render)
   - Not the non-existent smsSender

4. **Sequences get cancelled!**
   - Order created → cancelSequence('cart_recovery')
   - No more messages after purchase

5. **AntiBan integrated!**
   - Built into Render bridge (whatsappBridgeV2)
   - Rate limiting, humanization, etc.

## Testing the Flow

### 1. Test Cart Abandoned
```bash
curl -X POST https://ribh.click/api/webhooks/salla \
  -H "Content-Type: application/json" \
  -d '{
    "event": "cart.abandoned",
    "merchant": "YOUR_MERCHANT_ID",
    "data": {
      "customer": {
        "name": "Test",
        "email": "test@example.com",
        "mobile": "0501234567"
      },
      "total": 500,
      "checkout_url": "https://store.salla.sa/checkout/123"
    }
  }'
```

### 2. Test Sequence Processing
```bash
curl -X POST https://ribh.click/api/sequences/process
```

### 3. Check Stats
```bash
curl "https://ribh.click/api/sequences/stats?merchant=YOUR_MERCHANT_ID"
```

### 4. Cancel Sequence
```bash
curl -X POST https://ribh.click/api/sequences/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "merchant": "YOUR_MERCHANT_ID",
    "email": "test@example.com",
    "type": "cart_recovery"
  }'
```

## Environment Variables

```env
# WhatsApp Bridge (Render)
WHATSAPP_BRIDGE_URL=https://ribh-whatsapp-1.onrender.com
WHATSAPP_BRIDGE_KEY=ribh-secret-2026

# AI (Gemini is FREE!)
GEMINI_API_KEY=xxx

# Email (Resend FREE tier)
RESEND_API_KEY=xxx
EMAIL_FROM=ribh@ribh.click
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     FIREBASE (FREE TIER)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌──────────────────┐     ┌──────────┐ │
│  │  Webhooks   │────▶│ lifecycleEngineV2│────▶│ Firestore│ │
│  └─────────────┘     └──────────────────┘     └──────────┘ │
│         │                    │                              │
│         │                    ▼                              │
│         │            ┌──────────────────┐                   │
│         │            │  sequenceEngine  │                   │
│         │            └──────────────────┘                   │
│         │                    │                              │
│         │        ┌──────────┴──────────┐                    │
│         │        ▼                     ▼                    │
│         │  ┌──────────┐         ┌─────────────┐            │
│         │  │emailSender│        │whatsappClient│            │
│         │  └──────────┘         └─────────────┘            │
│         │        │                     │                    │
└─────────┼────────┼─────────────────────┼────────────────────┘
          │        │                     │
          │        ▼                     ▼
          │   ┌────────┐         ┌────────────────┐
          │   │ Resend │         │ RENDER (FREE)  │
          │   │ (FREE) │         │ WhatsApp Bridge│
          │   └────────┘         │ + antiBan.js   │
          │                      └────────────────┘
          │                              │
          │                              ▼
          │                      ┌────────────────┐
          │                      │ Merchant's     │
          │                      │ WhatsApp (FREE)│
          └──────────────────────┴────────────────┘
```

## Zero Cost Stack ✅

| Service | Cost | Usage |
|---------|------|-------|
| Firebase Functions | FREE | 2M invocations/month |
| Firebase Firestore | FREE | 50K reads/day |
| Render | FREE | WhatsApp bridge |
| Resend | FREE | 3000 emails/month |
| Gemini AI | FREE | Unlimited API calls |
| WhatsApp | FREE | Merchant's own number |

**Total: $0/month** 🎉
