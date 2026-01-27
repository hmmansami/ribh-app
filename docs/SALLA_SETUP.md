# Salla Partner Dashboard Configuration Guide

**App Name:** RIBH (رِبح)  
**App Client ID:** `476e7ed1-796c-4731-b145-73a13d0019de`  
**API Base URL:** `https://europe-west1-ribh-484706.cloudfunctions.net/api`

---

## 📋 Quick Checklist

- [ ] Authentication Mode: **Easy Mode**
- [ ] Callback URL configured
- [ ] Webhook URL configured  
- [ ] Webhook events subscribed
- [ ] Scopes selected
- [ ] Webhook secret set (optional but recommended)

---

## 1️⃣ Authentication Mode

**Select: Easy Mode (الوضع السهل)**

RIBH uses **Easy Mode** authentication. In this mode:
- Salla sends access tokens directly via the `app.store.authorize` webhook
- No manual OAuth flow needed for basic operations
- Tokens are automatically managed and refreshed

> **Why Easy Mode?** Simpler integration, tokens arrive via webhook, less code to maintain.

---

## 2️⃣ URLs Configuration

### OAuth Callback URL
```
https://europe-west1-ribh-484706.cloudfunctions.net/api/oauth/callback
```

### Webhook URL (Primary)
```
https://europe-west1-ribh-484706.cloudfunctions.net/api/webhooks/salla
```

### Alternative Webhook URLs (all work)
```
https://europe-west1-ribh-484706.cloudfunctions.net/api/api/webhooks/salla
https://europe-west1-ribh-484706.cloudfunctions.net/api/webhook
```

### Abandoned Cart Webhook (Optional - Dedicated)
```
https://europe-west1-ribh-484706.cloudfunctions.net/api/webhooks/salla/cart
```

---

## 3️⃣ Webhook Events to Subscribe

Subscribe to **ALL** of these events in Salla Partner Dashboard:

### 🛒 Cart & Checkout Events (CRITICAL for cart recovery)
| Event | Purpose |
|-------|---------|
| `cart.abandoned` | Triggers cart recovery sequence |
| `abandoned_cart.created` | Alternative cart abandonment event |
| `abandoned.cart` | Alternative cart abandonment event |
| `checkout.abandoned` | Checkout abandonment |
| `checkout.started` | Track checkout initiation |
| `checkout.created` | Track checkout creation |

### 📦 Order Events (CRITICAL to stop recovery when customer buys)
| Event | Purpose |
|-------|---------|
| `order.created` | Cancel recovery sequence, track conversion |
| `order.updated` | Track order status changes |
| `order.status.updated` | Delivery tracking, analytics |

### 👤 Customer Events
| Event | Purpose |
|-------|---------|
| `customer.created` | Welcome sequence, customer profiling |

### 🔧 App Lifecycle Events (REQUIRED)
| Event | Purpose |
|-------|---------|
| `app.installed` | Store setup on install |
| `app.store.authorize` | **Receive access tokens** (Easy Mode) |
| `app.uninstalled` | Cleanup on uninstall |

---

## 4️⃣ Required Scopes

Select these scopes in the Partner Dashboard:

### Essential Scopes
| Scope | Why Needed |
|-------|------------|
| `offline_access` | Refresh tokens for long-term access |
| `orders.read` | Read order data for conversion tracking |
| `customers.read` | Read customer info for personalization |
| `products.read` | Read product info for cart recovery messages |

### Recommended Additional Scopes
| Scope | Why Needed |
|-------|------------|
| `carts.read` | Access abandoned cart details |
| `checkouts.read` | Access checkout information |
| `settings.read` | Read store settings |
| `store.read` | Read store information |

### Scope String (for reference)
```
offline_access orders.read customers.read products.read carts.read checkouts.read
```

---

## 5️⃣ Webhook Security (Recommended)

### Webhook Secret
Set a webhook secret in Salla Partner Dashboard and add it to your environment:

```bash
# Add to your .env or Firebase config
SALLA_WEBHOOK_SECRET=your-webhook-secret-here
```

The app verifies the `x-salla-signature` header using HMAC-SHA256.

> **Note:** If no secret is configured, signature verification is skipped (development mode).

---

## 6️⃣ Environment Variables

Ensure these are set in your deployment:

```bash
# Required
SALLA_CLIENT_ID=476e7ed1-796c-4731-b145-73a13d0019de
SALLA_CLIENT_SECRET=c8faa553c8ac45af0acb6306de00a388bf4e06027e4229944f5fe

# Recommended
SALLA_WEBHOOK_SECRET=your-webhook-secret-here
```

---

## 7️⃣ Testing the Integration

### Test Webhook URL Validation
Salla validates webhook URLs by sending a GET request. Test it:
```bash
curl https://europe-west1-ribh-484706.cloudfunctions.net/api/webhooks/salla
```

Expected response:
```json
{
  "success": true,
  "message": "رِبح Webhook endpoint is ready",
  "app": "ribh",
  "version": "1.0.0",
  "status": "active"
}
```

### Test OAuth Callback
Visit this URL (you'll be redirected to Salla login):
```
https://europe-west1-ribh-484706.cloudfunctions.net/api/salla/install
```

---

## 8️⃣ Firestore Collections

The app stores data in these Firestore collections:

| Collection | Purpose |
|------------|---------|
| `salla_merchants` | OAuth tokens, merchant status |
| `merchants` | Merchant profile data |
| `carts` | Abandoned cart data |
| `logs` | Webhook event logs |

---

## 9️⃣ How Events Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SALLA PARTNER APP                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Store installs app → app.installed webhook              │
│  2. Salla sends tokens → app.store.authorize webhook        │
│  3. Customer abandons cart → cart.abandoned webhook         │
│  4. RIBH sends recovery messages                            │
│  5. Customer purchases → order.created webhook              │
│  6. RIBH stops recovery, tracks conversion                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### "رابط غير صحيح" (Invalid URL) Error
- Ensure the webhook URL responds to GET requests with 200 OK
- Test: `curl https://europe-west1-ribh-484706.cloudfunctions.net/api/webhooks/salla`

### Tokens Not Arriving
- Ensure `app.store.authorize` event is subscribed
- Check Easy Mode is selected (not Custom Mode)

### Signature Verification Failing
- Ensure `SALLA_WEBHOOK_SECRET` matches the secret in Partner Dashboard
- Check payload is not being modified by middleware

### Missing Cart Data
- Ensure `cart.abandoned` and `abandoned_cart.created` events are subscribed
- Check `carts.read` scope is enabled

---

## 📞 Support

- **Salla Partner Docs:** https://docs.salla.dev
- **RIBH Support:** [Your support contact]

---

*Last Updated: June 2025*
