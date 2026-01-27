# Salla Store Integration Guide for RIBH

## Overview

This guide explains how to connect a Salla store to RIBH for abandoned cart recovery.

## Prerequisites

1. A Salla store (merchant account)
2. Firebase project deployed (`ribh-484706`)
3. RIBH app registered in Salla Partner Portal

## Current Status

| Component | Status | Details |
|-----------|--------|---------|
| Salla App | ✅ Registered | Client ID: `476e7ed1-796c-4731-b145-73a13d0019de` |
| Webhook Handler | ✅ Ready | `/webhooks/salla/cart` |
| Firebase Deploy | ⚠️ Required | Functions need deployment |

---

## Step 1: Deploy Firebase Functions

Before connecting stores, deploy the Firebase Functions:

```bash
cd /home/ubuntu/clawd/ribh-app
firebase deploy --only functions
```

After deployment, verify the API is accessible:
```bash
curl https://europe-west1-ribh-484706.cloudfunctions.net/api/health
```

### Fix 403 Errors (Make Function Public)

If you get 403, the function needs public access:

```bash
# Option 1: Via gcloud
gcloud functions add-iam-policy-binding api \
  --member="allUsers" \
  --role="roles/cloudfunctions.invoker" \
  --project=ribh-484706 \
  --region=europe-west1

# Option 2: Via Firebase Console
# Go to: Google Cloud Console > Cloud Functions > api > Permissions
# Add principal: allUsers
# Role: Cloud Functions Invoker
```

---

## Step 2: Configure Salla Partner Dashboard

### 2.1 Login to Salla Partners

Go to: https://salla.partners/

Login with your Salla developer account.

### 2.2 Find/Create Your App

Navigate to **Apps** → Select your app (RIBH)

### 2.3 Configure Webhooks

In your app settings, go to **Webhooks** tab and add:

| Event | URL |
|-------|-----|
| `abandoned.cart` | `https://europe-west1-ribh-484706.cloudfunctions.net/api/webhooks/salla/cart` |

**Webhook Settings:**
- **Secret Key**: Generate a secure secret and save it
- Set the secret as `SALLA_WEBHOOK_SECRET` in Firebase config:

```bash
firebase functions:config:set salla.webhook_secret="YOUR_WEBHOOK_SECRET"
firebase deploy --only functions
```

### 2.4 Set OAuth Callback URL

In **OAuth Settings**, set:
- **Callback URL**: `https://ribh.click/oauth/callback`

---

## Step 3: Install App on Store

### For Store Owner (Hmman)

1. Go to Salla App Store or the direct install URL:
   ```
   https://s.salla.sa/apps/install/476e7ed1-796c-4731-b145-73a13d0019de
   ```

2. Click **Install** and authorize the permissions

3. You'll be redirected to RIBH dashboard with a login token

4. Done! Abandoned carts will now flow to RIBH.

---

## Step 4: Test the Integration

### 4.1 Quick Webhook Test

Run the test script:

```bash
bash /home/ubuntu/clawd/ribh-app/scripts/test-salla-webhook.sh
```

Or use curl directly:

```bash
curl -X POST "https://europe-west1-ribh-484706.cloudfunctions.net/api/webhooks/salla/cart" \
  -H "Content-Type: application/json" \
  -H "X-Salla-Signature: test" \
  -d '{
    "event": "abandoned.cart",
    "merchant": 12345678,
    "data": {
      "id": "test_cart_001",
      "customer": {
        "name": "محمد أحمد",
        "mobile": "+966501234567",
        "email": "test@example.com"
      },
      "items": [
        {"name": "منتج تجريبي", "quantity": 1, "price": {"amount": 100}}
      ],
      "total": {"amount": 100, "currency": "SAR"},
      "checkout_url": "https://store.salla.sa/checkout/test"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Abandoned cart saved",
  "cartId": "test_cart_001",
  "storeId": "12345678",
  "total": 100,
  "itemCount": 1
}
```

### 4.2 Verify in Firestore

Check Firebase Console → Firestore → `abandoned_carts` collection

You should see a document with ID: `12345678_test_cart_001`

---

## Webhook Endpoint Reference

### URL
```
POST https://europe-west1-ribh-484706.cloudfunctions.net/api/webhooks/salla/cart
```

### Headers
| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-Salla-Signature` | HMAC-SHA256 signature (if secret configured) |

### Payload Structure

Salla sends this format for `abandoned.cart` events:

```json
{
  "event": "abandoned.cart",
  "merchant": 12345678,
  "created_at": "2025-01-27T12:00:00Z",
  "data": {
    "id": "cart_123",
    "customer": {
      "id": 987654,
      "name": "محمد أحمد",
      "email": "customer@example.com",
      "mobile": "+966501234567"
    },
    "items": [
      {
        "id": "prod_001",
        "name": "Product Name",
        "quantity": 2,
        "price": {
          "amount": 150,
          "currency": "SAR"
        }
      }
    ],
    "total": {
      "amount": 300,
      "currency": "SAR"
    },
    "checkout_url": "https://store.salla.sa/checkout/abc123",
    "age_in_minutes": 30,
    "status": "abandoned"
  }
}
```

### Responses

| Status | Meaning |
|--------|---------|
| 200 | Webhook received and processed |
| 400 | Missing required fields |
| 401 | Invalid signature (if secret configured) |
| 500 | Server error |

---

## Troubleshooting

### Webhook not receiving data?

1. **Check Salla Partner Dashboard** - Verify webhook URL is correct
2. **Check Cloud Function logs**:
   ```bash
   firebase functions:log --only api
   ```
3. **Verify function is deployed**:
   ```bash
   curl https://europe-west1-ribh-484706.cloudfunctions.net/api/health
   ```

### 403 Forbidden Error?

The Cloud Function needs public invoker permissions:
```bash
gcloud functions add-iam-policy-binding api \
  --member="allUsers" \
  --role="roles/cloudfunctions.invoker" \
  --project=ribh-484706 \
  --region=europe-west1
```

### Signature validation failing?

Ensure `SALLA_WEBHOOK_SECRET` matches exactly what's in Salla Partner Dashboard:
```bash
firebase functions:config:get salla.webhook_secret
```

### Customer phone not normalized?

The handler normalizes Saudi phones to `+966` format. Supported inputs:
- `0501234567` → `+966501234567`
- `501234567` → `+966501234567`
- `966501234567` → `+966501234567`
- `+966501234567` → `+966501234567`

---

## Files Reference

| File | Purpose |
|------|---------|
| `/functions/webhooks/sallaCart.js` | Abandoned cart webhook handler |
| `/functions/lib/sallaWebhooks.js` | General Salla webhooks library |
| `/scripts/test-salla-webhook.sh` | Test script for webhook |

---

## Next Steps After Connection

1. **Configure WhatsApp** - Connect merchant's WhatsApp for recovery messages
2. **Set Recovery Sequences** - Configure timing (1h, 6h, 24h reminders)
3. **Enable AI Messages** - Turn on personalized message generation
4. **Monitor Analytics** - Track recovery rates in dashboard

---

## Support

- **Salla Partner Docs**: https://docs.salla.dev/
- **Firebase Console**: https://console.firebase.google.com/project/ribh-484706
- **RIBH Dashboard**: https://ribh.click/
