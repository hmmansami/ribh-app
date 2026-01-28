# 🔍 Zid API Research - Complete Guide

> **Research Date:** January 28, 2026  
> **Purpose:** Enable multi-platform support for RIBH (Salla + Zid + Shopify)

## 📋 Executive Summary

Zid is Saudi Arabia's second-largest e-commerce platform after Salla, with **12,000+ merchants**. Their API is mature, well-documented, and very similar to Salla in structure - making integration relatively straightforward.

| Feature | Zid | Salla |
|---------|-----|-------|
| **Merchants** | 12,000+ | 35,000+ |
| **API Maturity** | ✅ Mature | ✅ Mature |
| **OAuth 2.0** | ✅ Authorization Code | ✅ Authorization Code |
| **Webhooks** | ✅ Full Support | ✅ Full Support |
| **Abandoned Carts** | ✅ API + Webhooks | ✅ API + Webhooks |
| **Token Expiry** | 1 year | 2 weeks |
| **Documentation** | ✅ Good | ✅ Excellent |

---

## 🔗 1. API Documentation URLs

### Primary Documentation
- **Main Docs Portal:** https://docs.zid.sa
- **Partner Dashboard:** https://partner.zid.sa
- **Developer Portal:** https://developers.zid.sa
- **Partner Help Center:** https://help-partner.zid.sa

### API Reference
- **Postman Collection:** https://www.postman.com/zid-developers/workspace/zid-developers-s-public-workspace
- **Apidog Reference:** https://apidog.com/apidoc/shared/7c0c7772-6e1f-4280-8172-b19e78cfd371

### Sample Code
- **Laravel Sample App:** https://github.com/zidsa/laravel-sample-app
- **Express.js Sample App:** https://github.com/zidsa/express-sample-app

---

## 🔐 2. OAuth 2.0 Flow

Zid uses **OAuth 2.0 Authorization Code Grant** - identical to Salla.

### Base URLs

```
OAuth Server:    https://oauth.zid.sa
API Base:        https://api.zid.sa/v1
```

### Flow Overview

```
┌─────────────────┐
│ 1. Merchant     │
│ clicks Install  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Redirect to Authorization URL                        │
│ https://oauth.zid.sa/oauth/authorize?                   │
│   client_id={CLIENT_ID}&                                │
│   redirect_uri={CALLBACK_URL}&                          │
│   response_type=code                                    │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ 3. Merchant     │
│ logs in & grants│
│ permissions     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Zid redirects to your callback with code             │
│ https://your-app.com/callback?code={AUTH_CODE}          │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Exchange code for tokens                             │
│ POST https://oauth.zid.sa/oauth/token                   │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ 6. Store tokens │
│ access_token    │
│ refresh_token   │
│ Authorization   │
└─────────────────┘
```

### Step-by-Step Implementation

#### Step 1: Create Partner Account & App
1. Register at https://partner.zid.sa
2. Create a new app (public or private)
3. Get **Client ID** and **Client Secret**
4. Set **Redirect URL** and **Callback URL**

#### Step 2: Authorization Request

```javascript
// Redirect merchant to:
const authUrl = `https://oauth.zid.sa/oauth/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(CALLBACK_URL)}&` +
  `response_type=code`;
```

#### Step 3: Token Exchange (Callback Handler)

```javascript
// POST to exchange authorization code for tokens
const response = await fetch('https://oauth.zid.sa/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: CALLBACK_URL,
    code: authorizationCode
  })
});

const tokens = await response.json();
// {
//   access_token: "eyJ...",    // X-Manager-Token header
//   authorization: "Bearer...", // Authorization header
//   refresh_token: "eyJ...",
//   expires_in: 31536000        // 1 year in seconds
// }
```

#### Step 4: Making API Requests

```javascript
// Every API request needs TWO headers
const response = await fetch('https://api.zid.sa/v1/managers/store/orders', {
  headers: {
    'Authorization': `Bearer ${tokens.authorization}`,
    'X-Manager-Token': tokens.access_token,
    'Content-Type': 'application/json'
  }
});
```

#### Step 5: Token Refresh

```javascript
// Refresh before 1 year expires (recommend at 10 months)
const response = await fetch('https://oauth.zid.sa/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: tokens.refresh_token
  })
});
```

### Key Differences from Salla

| Aspect | Zid | Salla |
|--------|-----|-------|
| **Token Expiry** | 1 year | 2 weeks |
| **Headers Required** | `Authorization` + `X-Manager-Token` | `Authorization` only |
| **OAuth Mode** | Custom only | Easy Mode + Custom Mode |
| **Refresh Token Expiry** | 1 year | 1 month |

---

## 📡 3. Available Endpoints

### Base URL: `https://api.zid.sa/v1`

### Orders API

| Method | Endpoint | Description | Scope |
|--------|----------|-------------|-------|
| GET | `/managers/store/orders` | List all orders | `orders.read` |
| GET | `/managers/store/orders/{id}` | Get order by ID | `orders.read` |
| POST | `/managers/store/orders/draft` | Create draft order | `orders.write` |
| PUT | `/managers/store/orders/{id}` | Update order | `orders.write` |
| PUT | `/managers/store/orders/{id}/note` | Update order note | `orders.write` |

**Query Parameters for List Orders:**
- `page`, `per_page` - Pagination
- `order_status` - Filter by status (new, preparing, ready, inDelivery, delivered, cancelled)
- `payment_method` - Cash On Delivery, Credit Card, Bank Transfer
- `customer_id` - Filter by customer
- `date_from`, `date_to` - Date range
- `payload_type=default` - Include product details

### Abandoned Carts API ⭐

| Method | Endpoint | Description | Scope |
|--------|----------|-------------|-------|
| GET | `/managers/store/abandoned-carts` | List abandoned carts | `abandoned_carts.read` |
| GET | `/managers/store/abandoned-carts/{cart-id}` | Get cart details | `abandoned_carts.read` |

**Query Parameters:**
- `page`, `page_size` - Pagination
- `phase` - Cart phase filter
- `search_term` - Search by customer
- `date_from`, `date_to` - Date range
- `cart_total` - Filter by value

**Cart Phases:**
- Customer info entered
- Shipping selected
- Payment selected
- `completed` - Converted to order

**Response includes:**
- Cart ID & URL (for retargeting!)
- Customer info (name, phone, email)
- Products in cart
- Total value
- Phase/stage of abandonment

### Customers API

| Method | Endpoint | Description | Scope |
|--------|----------|-------------|-------|
| GET | `/managers/store/customers` | List customers | `customers.read` |
| GET | `/managers/store/customers/{id}` | Get customer | `customers.read` |

**Response includes:**
- ID, name, email, mobile
- Order count & total payments
- City, country info
- Business info (for B2B)

### Products API

| Method | Endpoint | Description | Scope |
|--------|----------|-------------|-------|
| GET | `/v1/products/` | List products | `products.read` |
| POST | `/v1/products/` | Create product | `products.write` |
| PUT | `/v1/products/{id}` | Update product | `products.write` |
| DELETE | `/v1/products/{id}` | Delete product | `products.write` |

**Query Parameters:**
- `extended=true` - Include variants
- `ordering=created_at` or `updated_at` - Sort order

### Webhooks API

| Method | Endpoint | Description | Scope |
|--------|----------|-------------|-------|
| GET | `/managers/webhooks` | List webhooks | `webhooks.read` |
| POST | `/managers/webhooks` | Create webhook | `webhooks.write` |
| DELETE | `/managers/webhooks/{id}` | Delete webhook | `webhooks.write` |

### Other Endpoints

- **Inventories:** Stock management across locations
- **Shipping:** Shipping options setup
- **Marketing:** Promotions and discounts
- **Store Settings:** General store config
- **Categories:** Product categories

---

## 🔔 4. Webhooks

### Available Events

#### Order Events
| Event | Description | Conditions Support |
|-------|-------------|-------------------|
| `order.create` | New order created | ✅ Yes |
| `order.status.update` | Order status changed | ✅ Yes |
| `order.payment_status.update` | Payment status changed | ❌ No |

#### Abandoned Cart Events ⭐
| Event | Description |
|-------|-------------|
| `abandoned_cart.created` | Cart abandoned (10 min inactivity) |
| `abandoned_cart.completed` | Abandoned cart converted to order |

#### Product Events
| Event | Description |
|-------|-------------|
| `product.create` | Product created |
| `product.update` | Product updated |
| `product.publish` | Product published |
| `product.delete` | Product deleted |

#### Customer Events
| Event | Description |
|-------|-------------|
| `customer.create` | New customer |
| `customer.update` | Customer updated |
| `customer.merchant.update` | Merchant info on customer updated |
| `customer.login` | Customer logged in |

#### Category Events
| Event | Description |
|-------|-------------|
| `category.create` | Category created |
| `category.update` | Category updated |
| `category.delete` | Category deleted |

### Webhook Conditions (Order Events Only)

```json
{
  "event": "order.status.update",
  "target_url": "https://ribh.click/webhooks/zid",
  "conditions": {
    "status": "delivered",
    "payment_method": "Cash On Delivery",
    "delivery_option_id": 55
  }
}
```

**Supported Condition Keys:**
- `status`: new, preparing, ready, inDelivery, delivered, cancelled
- `payment_method`: Cash On Delivery, Credit Card, Bank Transfer
- `delivery_option_id`: Specific delivery option ID

### Registering Webhooks

```javascript
// Create webhook subscription
const response = await fetch('https://api.zid.sa/v1/managers/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authorization}`,
    'X-Manager-Token': accessToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event: 'abandoned_cart.created',
    target_url: 'https://ribh.click/webhooks/zid',
    subscriber: 'your_app_id'
  })
});
```

### Webhook Payload Example - Abandoned Cart

```json
{
  "event": "abandoned_cart.created",
  "store_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "data": {
    "id": "cart-uuid-123",
    "url": "https://store.zid.store/cart/recovery/abc123",
    "phase": "shipping_selected",
    "customer": {
      "id": 456,
      "name": "أحمد محمد",
      "email": "ahmed@example.com",
      "mobile": "966501234567"
    },
    "products": [
      {
        "id": 789,
        "name": "قميص أزرق",
        "quantity": 2,
        "price": 150,
        "sku": "SHIRT-BLU-M"
      }
    ],
    "total": 300,
    "currency": "SAR",
    "created_at": "2026-01-28T10:00:00Z",
    "updated_at": "2026-01-28T10:15:00Z"
  }
}
```

---

## 🔑 5. Permissions/Scopes

Scopes are selected in the **Partner Dashboard** when creating your app.

### Core Scopes for RIBH

| Scope | Description | Required |
|-------|-------------|----------|
| `orders.read` | Read orders | ✅ Yes |
| `abandoned_carts.read` | Read abandoned carts | ✅ Yes |
| `customers.read` | Read customer info | ✅ Yes |
| `webhooks.read` | Read webhook subscriptions | ✅ Yes |
| `webhooks.write` | Create/delete webhooks | ✅ Yes |

### Additional Scopes

| Scope | Description |
|-------|-------------|
| `products.read` | Read products |
| `products.write` | Manage products |
| `inventories.read` | Read stock levels |
| `inventories.write` | Update stock |
| `shipping.read` | Read shipping options |
| `marketing.read` | Read promotions |
| `marketing.write` | Create promotions |
| `store_settings.read` | Read store config |

### Scope Selection Best Practices

1. **Select all needed scopes upfront** - Changing scopes requires re-authentication
2. **Minimal scope principle** - Only request what you need for app approval
3. **Zid reviews scopes** - Public apps get scopes reviewed before approval

---

## ⚡ 6. Rate Limits

### Current Policy

| Limit | Value |
|-------|-------|
| **Requests per minute** | 60 per app per store |
| **Currently enforced on** | Product endpoints only |
| **Algorithm** | Leaky Bucket |

### Rate Limit Response

```
HTTP 429 Too Many Requests
```

### Best Practices

1. **Use webhooks instead of polling** - Real-time data without API calls
2. **Implement exponential backoff** - On 429 responses
3. **Batch operations** - Where API supports
4. **Cache responses** - For data that doesn't change often

### Requesting Exceptions

If you have a valid use case for higher limits:
- Email: appmarket@zid.sa
- Provide: Use case, expected volume, app ID

---

## 📊 7. Zid vs Salla Comparison

### API Structure

| Feature | Zid | Salla |
|---------|-----|-------|
| **API Version** | v1 | v2 |
| **Base URL** | `api.zid.sa/v1` | `api.salla.dev/admin/v2` |
| **Auth Headers** | 2 (Auth + X-Manager-Token) | 1 (Authorization) |
| **Response Format** | JSON | JSON |
| **Pagination** | `page`, `per_page` | `page`, `per_page` |

### OAuth

| Feature | Zid | Salla |
|---------|-----|-------|
| **Flow** | Authorization Code | Authorization Code |
| **Easy Mode** | ❌ No | ✅ Yes |
| **Token Expiry** | 1 year | 2 weeks |
| **Refresh Token** | 1 year | 1 month |
| **Refresh Strategy** | Every ~10 months | Every ~2 weeks |

### Webhooks

| Feature | Zid | Salla |
|---------|-----|-------|
| **Abandoned Cart Event** | ✅ `abandoned_cart.created` | ✅ `abandoned.cart` |
| **Order Events** | ✅ Full | ✅ Full |
| **Customer Events** | ✅ Full | ✅ Full |
| **Conditional Webhooks** | ✅ (orders only) | ✅ (all events) |
| **Webhook Security** | Basic | Signature + Token |
| **Retry on Failure** | 3 times, 5 min interval | 3 times, 5 min interval |
| **Timeout** | 30 seconds | 30 seconds |

### Abandoned Carts

| Feature | Zid | Salla |
|---------|-----|-------|
| **Webhook Trigger** | 10 min inactivity | ~30 min inactivity |
| **Recovery URL** | ✅ Included | ✅ Included |
| **Customer Phone** | ✅ Included | ✅ Included |
| **List Endpoint** | ✅ Full | ✅ Full |
| **Cart Phases** | ✅ Tracked | ❌ Not tracked |

### Partner Program

| Feature | Zid | Salla |
|---------|-----|-------|
| **Partner Portal** | partner.zid.sa | partners.salla.sa |
| **App Store** | Zid App Market | Salla App Store |
| **Private Apps** | ✅ (requires Pro store) | ✅ |
| **Public Apps** | ✅ (reviewed) | ✅ (reviewed) |
| **Revenue Share** | Yes | Yes |

---

## 🚀 8. RIBH Implementation Plan

### Data Model Updates

```typescript
// Store model - add platform field
interface Store {
  id: string;
  platform: 'salla' | 'zid' | 'shopify';
  merchantId: string;
  name: string;
  // Platform-specific tokens
  tokens: {
    accessToken: string;
    authorization?: string;      // Zid only
    refreshToken: string;
    expiresAt: number;
  };
}
```

### Webhook Handler

```typescript
// /webhooks/zid endpoint
export async function handleZidWebhook(req, res) {
  const { event, data, store_id } = req.body;
  
  switch (event) {
    case 'abandoned_cart.created':
      await handleZidAbandonedCart(store_id, data);
      break;
    case 'abandoned_cart.completed':
      await cancelRecoverySequence(store_id, data.id);
      break;
    case 'order.create':
      await handleZidOrderCreated(store_id, data);
      break;
  }
  
  res.json({ success: true });
}
```

### Phone Number Normalization

Zid phone format: `966501234567` (no + prefix typically)

```typescript
function normalizeZidPhone(phone: string): string {
  // Remove any non-digits
  let digits = phone.replace(/\D/g, '');
  
  // Handle Saudi numbers
  if (digits.startsWith('966')) {
    return '+' + digits;
  }
  if (digits.startsWith('05') || digits.startsWith('5')) {
    return '+966' + digits.replace(/^0/, '');
  }
  
  return '+' + digits;
}
```

### Token Refresh Strategy

```typescript
// Zid: Check monthly, refresh at 10 months
async function refreshZidTokensIfNeeded(store: Store) {
  const tenMonthsMs = 10 * 30 * 24 * 60 * 60 * 1000;
  const tokenAge = Date.now() - store.tokens.issuedAt;
  
  if (tokenAge > tenMonthsMs) {
    await refreshZidTokens(store);
  }
}
```

---

## 📚 9. Resources

### Official Documentation
- [Zid Docs](https://docs.zid.sa)
- [Authorization Guide](https://docs.zid.sa/authorization)
- [Webhooks Guide](https://docs.zid.sa/webhooks)
- [Rate Limiting](https://docs.zid.sa/doc-644369)

### Sample Apps
- [Laravel Sample](https://github.com/zidsa/laravel-sample-app)
- [Express.js Sample](https://github.com/zidsa/express-sample-app)

### Support
- Email: appmarket@zid.sa
- Partner Help: https://help-partner.zid.sa
- Slack: Available for partners

---

## ✅ 10. Next Steps for RIBH

1. **Create Zid Partner Account**
   - Register at partner.zid.sa
   - Create RIBH app
   - Select required scopes

2. **Implement OAuth Flow**
   - `/auth/zid` - Redirect to Zid
   - `/auth/zid/callback` - Handle tokens

3. **Add Webhook Endpoints**
   - `/webhooks/zid` - Handle all Zid events
   - Register for `abandoned_cart.created`, `order.create`

4. **Update Data Models**
   - Add `platform` field to stores
   - Store Zid-specific token format

5. **Test with Demo Store**
   - Create test store on Zid
   - Install private app
   - Verify cart abandonment flow

---

*Last updated: January 28, 2026*
