# Abandoned Cart → WhatsApp Recovery

## Overview

When a Salla `abandoned.cart` webhook arrives, the system:
1. Saves the cart to Firestore (`abandoned_carts` collection)
2. Checks if the merchant has WhatsApp connected via the bridge
3. Generates an AI-powered personalized message
4. Sends via the WhatsApp bridge at `https://ribh-whatsapp-1.onrender.com/send`

## Architecture

```
Salla Store
    │
    ▼ abandoned.cart webhook
┌──────────────────────────────────────┐
│  ribh-app (Firebase/Render)          │
│  /webhooks/salla/cart                │
│                                      │
│  1. Parse & save to Firestore        │
│  2. Check merchant WhatsApp status   │
│  3. Generate AI message              │
│  4. Send via bridge →                │
└──────────────────────────────────────┘
                    │
                    ▼ POST /send
┌──────────────────────────────────────┐
│  ribh-whatsapp-1 (Render)            │
│  WhatsApp Bridge (Baileys)           │
│                                      │
│  - Merchant sessions (QR-based)      │
│  - Multi-tenant                      │
│  - Rate limiting & anti-ban          │
└──────────────────────────────────────┘
                    │
                    ▼
            Customer WhatsApp
```

## Files Modified

- `/functions/webhooks/sallaCart.js` - Main webhook handler with WhatsApp integration
- `/functions/lib/whatsappClient.js` - HTTP client for the WhatsApp bridge
- `/functions/lib/aiMessenger.js` - AI message generation

## How to Test

### 1. Check WhatsApp Bridge Status

```bash
# List all sessions
curl https://ribh-whatsapp-1.onrender.com/sessions

# Check specific merchant status
curl https://ribh-whatsapp-1.onrender.com/status/YOUR_STORE_ID
```

### 2. Connect a Merchant to WhatsApp

```bash
# Get QR code URL
curl https://ribh-whatsapp-1.onrender.com/qr/YOUR_STORE_ID

# Or open in browser to see QR visually:
# https://ribh-whatsapp-1.onrender.com/qr/YOUR_STORE_ID
```

Then scan with WhatsApp on the merchant's phone.

### 3. Test the Webhook Manually

```bash
# Simulate an abandoned cart webhook
curl -X POST https://ribh-app.onrender.com/webhooks/salla/cart \
  -H "Content-Type: application/json" \
  -d '{
    "event": "abandoned.cart",
    "merchant": "YOUR_STORE_ID",
    "data": {
      "id": "test_cart_123",
      "customer": {
        "name": "محمد أحمد",
        "mobile": "+966501234567",
        "email": "test@example.com"
      },
      "items": [
        {"name": "سماعات بلوتوث", "quantity": 1, "price": {"amount": 299}}
      ],
      "total": {"amount": 299},
      "currency": {"code": "SAR"},
      "checkout_url": "https://store.salla.sa/checkout/abc"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Abandoned cart saved",
  "cartId": "test_cart_123",
  "storeId": "YOUR_STORE_ID",
  "total": 299,
  "itemCount": 1,
  "whatsapp": {
    "attempted": true,
    "sent": true,
    "messageId": "xxx",
    "discountOffered": 5
  }
}
```

### 4. Run the Test Script

```bash
cd ribh-app/functions

# Test against Render deployment
node test/test-abandoned-cart-whatsapp.js --render

# Test against local server (start with: npm run serve)
node test/test-abandoned-cart-whatsapp.js --local
```

## Configuration

Environment variables needed:

```env
# WhatsApp Bridge (optional - defaults work)
WHATSAPP_BRIDGE_URL=https://ribh-whatsapp-1.onrender.com
WHATSAPP_BRIDGE_KEY=ribh-secret-2026

# Salla Webhook Secret (optional - skips verification if not set)
SALLA_WEBHOOK_SECRET=your_webhook_secret
```

## Message Generation

The system generates personalized messages based on:

- **Cart value** → Determines discount percentage
  - VIP (>1000 SAR): 15-25% discount
  - High Value (>500 SAR): 10-15% discount
  - Medium Value (>200 SAR): 5-10% discount
  - Price Sensitive (>50 SAR): 5-10% discount
  
- **Customer name** → Personalized greeting

- **Items** → Listed in message (max 3 shown)

- **Payment plans** → تقسيط offer for carts >200 SAR

Example message:
```
مرحباً محمد! 👋

سلتك محفوظة لك 💚
📦 منتجاتك:
• سماعات بلوتوث لاسلكية
• حافظة جوال

💰 المجموع: 397 ر.س

🎁 خصم خاص لك: 10%
كود: RIBH10

قسّط على 4 دفعات: 99 ر.س/شهر 💳

👉 أكمل طلبك الآن:
https://store.salla.sa/checkout/abc
```

## Troubleshooting

### WhatsApp not sending?

1. **Check merchant connection**:
   ```bash
   curl https://ribh-whatsapp-1.onrender.com/status/STORE_ID
   ```
   If `connected: false`, merchant needs to scan QR.

2. **Check if phone number is valid**:
   The system normalizes Saudi numbers (+966, 05xx, etc.)

3. **Check bridge logs**:
   - Go to Render dashboard → ribh-whatsapp-1 → Logs

### Getting rate limited?

The bridge has anti-ban limits: 30 messages/hour per merchant.
Wait an hour or use a different merchant account.

### Message not personalized?

Check if `aiMessenger` is loading:
```bash
node -e "require('./lib/aiMessenger'); console.log('OK')"
```

## Firestore Document Structure

Documents saved to `abandoned_carts` collection:

```javascript
{
  // IDs
  cartId: "cart_123",
  storeId: "1234567",
  
  // Customer
  customer: {
    id: "cust_123",
    name: "محمد أحمد",
    phone: "+966501234567",
    email: "test@example.com"
  },
  
  // Cart
  items: [
    { id: "prod_1", name: "Product", quantity: 1, price: 100 }
  ],
  itemCount: 1,
  total: 100,
  currency: "SAR",
  checkoutUrl: "https://...",
  
  // Status
  status: "abandoned",
  whatsappSent: true,
  whatsappSentAt: "2025-01-15T...",
  whatsappMessageId: "xxx",
  discountOffered: 10,
  discountCode: "RIBH10",
  
  // Timestamps
  createdAt: "2025-01-15T...",
  abandonedAt: "2025-01-15T...",
  savedAt: Timestamp
}
```

## Next Steps

1. **Deploy changes**: Push to main branch → Render auto-deploys
2. **Connect merchants**: Have real merchants scan QR codes
3. **Monitor**: Check Firestore and Render logs for success/failures
4. **Add scheduled reminders**: 2nd reminder at 6h, 3rd at 24h
