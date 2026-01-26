# 🛒 Salla Webhook Setup Guide

Complete guide for setting up Salla webhooks for the RIBH cart recovery system.

## 📋 Overview

Salla webhooks allow your app to receive real-time notifications when events happen in a merchant's store. This is the backbone of cart recovery - you need to know when:

1. **Cart is abandoned** → Start recovery sequence
2. **Order is created** → Cancel recovery sequence (they bought!)
3. **Order is updated** → Track delivery, update analytics
4. **Customer is created** → Send welcome offer

## 🔗 Webhook URLs

Your RIBH app accepts webhooks at these URLs:

| URL | Purpose |
|-----|---------|
| `https://ribh.click/webhooks/salla` | Primary webhook endpoint |
| `https://ribh.click/api/webhooks/salla` | Alternative endpoint |
| `https://ribh.click/webhook` | Simple fallback |

**All three work identically** - use whichever you prefer.

## 📡 Events to Subscribe

### Required Events (Core Functionality)

| Event | Salla Name | Purpose |
|-------|------------|---------|
| Cart Abandoned | `cart.abandoned` | Triggers recovery sequence |
| Order Created | `order.created` | Stops recovery + celebrates |

### Recommended Events (Enhanced Features)

| Event | Salla Name | Purpose |
|-------|------------|---------|
| Order Updated | `order.updated` | Track fulfillment, analytics |
| Customer Created | `customer.created` | Welcome sequence, lead capture |

### App Lifecycle Events (Auto-handled)

| Event | Salla Name | Purpose |
|-------|------------|---------|
| App Installed | `app.installed` | Store onboarding |
| App Uninstalled | `app.uninstalled` | Cleanup |

## 🔧 Setup Instructions

### Method 1: Salla Partner Dashboard (Recommended)

1. **Login to Salla Partners**
   - Go to [partners.salla.sa](https://partners.salla.sa)
   - Navigate to your app settings

2. **Add Webhook URL**
   - Find "Webhooks" or "Events" section
   - Add URL: `https://ribh.click/webhooks/salla`

3. **Select Events**
   - ✅ `cart.abandoned`
   - ✅ `order.created`
   - ✅ `order.updated`
   - ✅ `customer.created`

4. **Get Webhook Secret** (Optional but recommended)
   - Generate a webhook secret
   - Add to your `.env`: `SALLA_WEBHOOK_SECRET=your_secret_here`

5. **Save & Test**
   - Salla will validate the URL (sends GET request)
   - Test with "Send Test Webhook" if available

### Method 2: Salla API (Programmatic)

```javascript
// Register webhook via Salla API
const response = await fetch('https://api.salla.dev/admin/v2/webhooks', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${merchantAccessToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: 'RIBH Cart Recovery',
        url: 'https://ribh.click/webhooks/salla',
        events: [
            'cart.abandoned',
            'order.created',
            'order.updated',
            'customer.created'
        ],
        headers: {
            'X-Custom-Header': 'ribh'
        }
    })
});
```

## 📱 Saudi Phone Number Handling

RIBH automatically normalizes Saudi phone numbers:

```
Input                 → Output
0501234567           → +966501234567
501234567            → +966501234567
966501234567         → +966501234567
+966501234567        → +966501234567
00966501234567       → +966501234567
```

### Phone Extraction Priority

When extracting customer phone from webhook data, we check in order:
1. `data.customer.mobile`
2. `data.customer.phone`
3. `data.mobile`
4. `data.phone`
5. `data.billing_address.phone`
6. `data.shipping_address.phone`

## 🔐 Security

### Webhook Signature Verification

Salla signs webhooks with HMAC-SHA256. To verify:

1. Get your webhook secret from Salla Partner dashboard
2. Add to `.env`:
   ```
   SALLA_WEBHOOK_SECRET=your_secret_here
   ```
3. RIBH automatically verifies the `x-salla-signature` header

### IP Whitelisting (Optional)

Salla webhook IPs (verify current list with Salla):
- Contact Salla support for IP ranges

## 📊 Webhook Data Examples

### cart.abandoned

```json
{
    "event": "cart.abandoned",
    "merchant": {
        "id": 123456,
        "name": "متجر تجريبي"
    },
    "created_at": "2024-01-26T12:00:00Z",
    "data": {
        "id": 789,
        "customer": {
            "id": 456,
            "name": "أحمد محمد",
            "mobile": "+966501234567",
            "email": "ahmed@example.com"
        },
        "items": [
            {
                "id": 111,
                "name": "قميص أزرق",
                "quantity": 2,
                "price": 150
            }
        ],
        "total": 300,
        "currency": "SAR",
        "checkout_url": "https://store.salla.sa/cart/123",
        "store": {
            "name": "متجر تجريبي",
            "url": "https://store.salla.sa"
        }
    }
}
```

### order.created

```json
{
    "event": "order.created",
    "merchant": {
        "id": 123456,
        "name": "متجر تجريبي"
    },
    "created_at": "2024-01-26T12:30:00Z",
    "data": {
        "id": 999,
        "reference_id": "ORD-12345",
        "customer": {
            "id": 456,
            "name": "أحمد محمد",
            "mobile": "+966501234567",
            "email": "ahmed@example.com"
        },
        "items": [...],
        "total": 300,
        "status": {
            "id": 1,
            "name": "pending"
        },
        "payment_method": "credit_card",
        "cart_id": 789
    }
}
```

### order.updated

```json
{
    "event": "order.updated",
    "merchant": { "id": 123456 },
    "data": {
        "id": 999,
        "reference_id": "ORD-12345",
        "old_status": { "name": "pending" },
        "status": { "name": "shipped" },
        "customer": {...}
    }
}
```

### customer.created

```json
{
    "event": "customer.created",
    "merchant": { "id": 123456 },
    "data": {
        "id": 456,
        "first_name": "أحمد",
        "last_name": "محمد",
        "mobile": "+966501234567",
        "email": "ahmed@example.com",
        "gender": "male"
    }
}
```

## 🔄 Recovery Flow

```
┌─────────────────┐
│ Customer adds   │
│ items to cart   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Customer leaves │
│ without buying  │
└────────┬────────┘
         │
         ▼ (Salla detects ~30 min)
┌─────────────────┐
│ cart.abandoned  │──────► RIBH receives webhook
│ webhook sent    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ RIBH Recovery Sequence              │
├─────────────────────────────────────┤
│ IMMEDIATE: WhatsApp/SMS (if enabled)│
│ 1 HOUR: Email #1 (no discount)      │
│ 6 HOURS: Email #2 (5% discount)     │
│ 24 HOURS: Email #3 (10% discount)   │
└────────┬────────────────────────────┘
         │
         ▼ (Customer comes back and buys)
┌─────────────────┐
│ order.created   │──────► RIBH receives webhook
│ webhook sent    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ RIBH stops recovery sequence        │
│ + Sends thank you + upsell offer    │
│ + Logs recovered revenue            │
└─────────────────────────────────────┘
```

## 🧪 Testing

### Manual Test

```bash
# Test webhook endpoint is responding
curl https://ribh.click/webhooks/salla

# Should return:
# {"success":true,"message":"رِبح Webhook endpoint is ready",...}
```

### Test Cart Abandonment

```bash
curl -X POST https://ribh.click/webhooks/salla \
  -H "Content-Type: application/json" \
  -d '{
    "event": "cart.abandoned",
    "merchant": {"id": "test_store"},
    "data": {
        "id": 123,
        "customer": {
            "name": "Test User",
            "mobile": "0501234567",
            "email": "test@example.com"
        },
        "items": [{"name": "Test Product", "quantity": 1, "price": 100}],
        "total": 100,
        "checkout_url": "https://example.com/cart"
    }
}'
```

### Test Order Created

```bash
curl -X POST https://ribh.click/webhooks/salla \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.created",
    "merchant": {"id": "test_store"},
    "data": {
        "id": 456,
        "customer": {
            "name": "Test User",
            "mobile": "0501234567",
            "email": "test@example.com"
        },
        "total": 100
    }
}'
```

## 🚨 Troubleshooting

### "رابط غير صحيح" (Invalid URL)

Salla validates webhook URLs by sending a GET request. Make sure:
- URL is publicly accessible
- Returns 200 OK
- Has valid SSL certificate

### Webhooks not received

1. Check Salla Partner dashboard for delivery logs
2. Check RIBH logs: `firebase functions:log`
3. Verify URL is correct and accessible
4. Check if webhook events are enabled

### Signature verification failing

1. Verify `SALLA_WEBHOOK_SECRET` matches Salla dashboard
2. Check for extra whitespace in secret
3. Try temporarily disabling verification for debugging

### Phone numbers not normalized

Check logs for the raw phone format Salla sends. Update extraction logic if needed.

## 📈 Analytics

RIBH tracks:
- Carts received
- Carts recovered
- Recovery rate (%)
- Revenue recovered (SAR)
- Messages sent per channel

View at: `https://ribh.click/analytics?token=YOUR_TOKEN`

## 🔗 Related Links

- [Salla Developer Docs](https://docs.salla.dev)
- [Salla Webhook Events](https://docs.salla.dev/docs/webhooks)
- [Salla Partners Portal](https://partners.salla.sa)

---

💚 **RIBH** - Recovering Revenue, One Cart at a Time
