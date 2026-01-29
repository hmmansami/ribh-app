# Salla API Research - Official Documentation

**Research Date:** January 28, 2026  
**Source:** https://docs.salla.dev (Official Salla Documentation)  
**Purpose:** Build strategy for RIBH abandoned cart recovery app

---

## 1. 📚 Official Documentation URLs

All information sourced from **https://docs.salla.dev**:

| Resource | URL |
|----------|-----|
| **Main Docs Portal** | https://docs.salla.dev |
| **Merchant API - Get Started** | https://docs.salla.dev/doc-421117 |
| **Authorization (OAuth)** | https://docs.salla.dev/doc-421118 |
| **Webhooks** | https://docs.salla.dev/doc-421119 |
| **Conditional Webhooks** | https://docs.salla.dev/doc-421120 |
| **Multi-Language Support** | https://docs.salla.dev/doc-421122 |
| **Rate Limiting** | https://docs.salla.dev/doc-421125 |
| **App Events** | https://docs.salla.dev/doc-421413 |
| **Abandoned Cart Webhooks** | https://docs.salla.dev/doc-433812 |
| **Create Your First App** | https://docs.salla.dev/doc-421410 |

### Related Portals:
| Portal | URL |
|--------|-----|
| Partners Portal | https://salla.partners |
| App Store | https://apps.salla.sa |
| Developer Community | https://t.me/salladev |
| API Status | https://status.salla.sa |
| Support | support@salla.dev |

---

## 2. 🔐 OAuth 2.0 Authorization

**Source:** https://docs.salla.dev/doc-421118

### OAuth Endpoints:

| Endpoint | URL |
|----------|-----|
| Authorization | `https://accounts.salla.sa/oauth2/auth` |
| Token | `https://accounts.salla.sa/oauth2/token` |
| Refresh Token | `https://accounts.salla.sa/oauth2/token` |
| User Info | `https://accounts.salla.sa/oauth2/user/info` |
| Installation URL | `https://s.salla.sa/apps/install/{app-id}` |

### Authorization Header Format:
```
Authorization: Bearer <ACCESS_TOKEN>
```

### Token Expiration:
- **Access Token:** 14 days (2 weeks)
- **Refresh Token:** 1 month
- **Important:** Refresh tokens are **single-use only** - new one issued with each refresh

### Two OAuth Modes:

#### A) Easy Mode (Recommended)
- Salla handles token generation automatically
- Receive access token via `app.store.authorize` webhook event
- **Required for published apps on Salla App Store**

#### B) Custom Mode
- Manual OAuth flow with callback URL
- For development and testing purposes
- **Not allowed for production apps in App Store**

### Query Parameters for Authorization:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `client_id` | Your app's client ID | `1311508470xxx` |
| `client_secret` | Your app's secret key | `362985662xxx` |
| `response_type` | Response type | `code` |
| `redirect_uri` | Callback URL | `https://your-app.com/callback` |
| `scope` | Requested permissions | `offline_access` |
| `state` | CSRF protection | `1234xxxx` |
| `code` | Authorization code | `xxxxxxxx` |
| `grant_type` | Grant type | `authorization_code` |

### Important Notes:
- Access tokens expire after 2 weeks
- Set `scope = offline_access` to receive refresh token
- `expires` variable returned as unix timestamp for `app.store.authorize` event
- Refresh tokens become invalid after first use
- **Reusing refresh tokens will invalidate ALL tokens and require app reinstall**

---

## 3. 📦 Merchant API Endpoints

**Source:** https://docs.salla.dev/doc-421117

### Base URI:
```
https://api.salla.dev/admin/v2
```

### Available API Categories:

| Category | Description |
|----------|-------------|
| **Abandoned Carts** | Track and manage abandoned shopping carts |
| **Orders** | Handle order management and details |
| **Order Assignments** | Assign orders to employees or branches |
| **Order Histories** | Track and manage order history |
| **Order Invoices** | Generate and manage order invoices |
| **Order Items** | Manage individual items within an order |
| **Order Reservations** | Handle order reservations |
| **Order Statuses** | Manage different statuses for orders |
| **Order Tags** | Assign and manage tags for orders |
| **Exports** | Export data (products, orders, etc.) |
| **Products** | Product management |
| **Customers** | Customer management |
| **Categories** | Category management |
| **Brands** | Brand management |
| **Shipments** | Shipment tracking |
| **Webhooks** | Webhook subscription management |

### Key Endpoints for RIBH:

```
GET  /carts/abandoned           - List abandoned carts
GET  /carts/abandoned/{id}      - Abandoned cart details
GET  /orders                    - List orders
GET  /orders/{id}               - Order details
GET  /customers                 - List customers
GET  /customers/{id}            - Customer details
POST /webhooks/subscribe        - Register webhook
```

---

## 4. 🔑 Scopes (Permissions)

**Source:** https://docs.salla.dev/doc-421413

Available scopes from app installation payload:

```
settings.read           - Read store settings
customers.read          - Read customers
customers.read_write    - Read/Write customers
orders.read             - Read orders
orders.read_write       - Read/Write orders
carts.read              - Read carts ⭐ (Required for abandoned carts)
branches.read           - Read branches
branches.read_write     - Read/Write branches
categories.read         - Read categories
categories.read_write   - Read/Write categories
brands.read             - Read brands
brands.read_write       - Read/Write brands
products.read           - Read products
products.read_write     - Read/Write products
webhooks.read_write     - Read/Write webhooks ⭐ (Required for events)
payments.read           - Read payments
taxes.read              - Read taxes
taxes.read_write        - Read/Write taxes
specialoffers.read      - Read special offers
specialoffers.read_write - Read/Write special offers
countries.read          - Read countries
metadata.read_write     - Read/Write metadata
offline_access          - Required for refresh token ⭐
```

### Minimum Scopes for RIBH App:
```
carts.read           - Read abandoned carts
customers.read       - Read customer details (name, phone, email)
orders.read          - Check order status (for recovery tracking)
webhooks.read_write  - Receive real-time events
offline_access       - Maintain long-term access via refresh token
```

---

## 5. ⚡ Rate Limits

**Source:** https://docs.salla.dev/doc-421125

### Rate Limits by Store Plan:

| Plan | Max Requests/Minute | Leak Rate |
|------|---------------------|-----------|
| **Plus** | 120 | 1 request/second |
| **Pro** | 360 | 1 request/second |
| **Special** | 720 | 1 request/second |

### How It Works:
- Each plan has max API calls per minute
- If exceeded, can still send 1 request/second until minute resets
- Uses leaky bucket algorithm

### Rate Limit Headers:
```
X-RateLimit-Limit      - Total calls allowed per minute
X-RateLimit-Remaining  - Remaining calls this minute
Retry-After            - Wait time if rate limited
X-RateLimit-Reset      - Reset timestamp
```

### Special Limits:
- **Customers Endpoint:** Limited to 500 requests per 10 minutes

### Warning:
> "Exceeding rate limits or exhibiting unusual behavior may result in temporary access restrictions."

---

## 6. 📡 Webhooks System

**Source:** https://docs.salla.dev/doc-421119

### Two Types of Webhook Events:

#### A) App Events (Automatic)
Sent automatically when app-related actions occur:

| Event | Description |
|-------|-------------|
| `app.store.authorize` | App authorized - **includes access token!** |
| `app.installed` | App installed on merchant store |
| `app.updated` | App updated |
| `app.uninstalled` | App uninstalled |
| `app.trial.started` | Trial subscription started |
| `app.trial.expired` | Trial subscription expired |
| `app.trial.canceled` | Trial subscription canceled |
| `app.subscription.started` | Paid subscription started |
| `app.subscription.expired` | Subscription expired |
| `app.subscription.canceled` | Subscription canceled |
| `app.subscription.renewed` | Subscription renewed |
| `app.feedback.created` | Merchant wrote a review |
| `app.settings.updated` | App settings changed |

#### B) Store Events (Subscribe via API/Portal)
Must explicitly subscribe to these:

**Orders:**
- `order.created`, `order.updated`, `order.status.updated`
- `order.cancelled`, `order.refunded`, `order.deleted`
- `order.products.updated`, `order.payment.updated`, `order.coupon.updated`
- `order.total.price.updated`
- `order.shipment.creating`, `order.shipment.created`, `order.shipment.cancelled`
- `order.shipment.return.creating`, `order.shipment.return.created`, `order.shipment.return.cancelled`
- `order.shipping.address.updated`

**Products:**
- `product.created`, `product.updated`, `product.deleted`
- `product.available`, `product.quantity.low`
- `product.price.updated`, `product.status.updated`
- `product.image.updated`, `product.category.updated`, `product.brand.updated`, `product.tags.updated`

**Customers:**
- `customer.created`, `customer.updated`
- `customer.login`, `customer.otp.request`

**Cart:** ⭐
- `abandoned.cart` - **Triggered when abandoned cart is created**
- `coupon.applied` - Triggered when coupon applied

**Categories:**
- `category.created`, `category.updated`

**Brands:**
- `brand.created`, `brand.updated`, `brand.deleted`

**Store:**
- `store.branch.created`, `store.branch.updated`, `store.branch.setDefault`
- `store.branch.activated`, `store.branch.deleted`
- `storetax.created`

**Shipments:**
- `shipment.creating`, `shipment.created`
- `shipment.cancelled`, `shipment.updated`

**Shipping Companies:**
- `shipping.zone.created`, `shipping.zone.updated`
- `shipping.company.created`, `shipping.company.updated`, `shipping.company.deleted`

**Invoice:**
- `invoice.created`

**Special Offers:**
- `specialoffer.created`, `specialoffer.updated`

**Miscellaneous:**
- `review.added`

### Webhook Security Strategies:

**1. Signature (Default)**
- SHA256 hash verification
- Headers: `X-Salla-Security-Strategy: Signature`, `X-Salla-Signature: {hash}`

**2. Token**
- Custom header with secret value

### Webhook Timeout:
- 30 seconds to respond
- 3 retry attempts if no successful response
- ~5 minutes between retries

---

## 7. 🛒 Abandoned Cart Data Access

**Source:** https://docs.salla.dev/doc-433812

### YES! Abandoned cart data is fully available!

### Webhook Events:

| Event | Description |
|-------|-------------|
| `abandoned.cart` | Triggered when cart becomes abandoned |
| `abandoned.cart.status_changed` | When abandoned cart status changes |
| `abandoned.cart.purchased` | When cart is recovered (purchased) |

### API Endpoints:
```
GET https://api.salla.dev/admin/v2/carts/abandoned      - List all
GET https://api.salla.dev/admin/v2/carts/abandoned/{id} - Details
```

### Required Scope:
```
carts.read
```

### Conditional Webhooks for Carts:

**Source:** https://docs.salla.dev/doc-421120

You can filter cart webhooks with conditions. Available properties for `abandoned.cart` event include cart attributes that can be used in rules.

Example rule:
```json
{
  "event": "abandoned.cart",
  "rule": "total > 100"
}
```

---

## 8. 🏗️ App Events - Authorization Flow

**Source:** https://docs.salla.dev/doc-421413

### app.store.authorize Event Payload:

When merchant authorizes your app, you receive:

```json
{
  "event": "app.store.authorize",
  "merchant": 1234509876,
  "created_at": "2022-12-31 12:31:25",
  "data": {
    "access_token": "KGsnBcNNkR2AgHnrd0U9lCIjrUiukF...",
    "expires": 1634819484,
    "refresh_token": "fWcceFWF9eFH4yPVOCaYHy-UolnU7iJNDH...",
    "scope": "settings.read branches.read offline_access",
    "token_type": "bearer"
  }
}
```

### app.installed Event Payload:

```json
{
  "event": "app.installed",
  "merchant": 1234509876,
  "created_at": "2022-12-31 12:31:25",
  "data": {
    "id": 6789012345,
    "app_name": "Your App Name",
    "description": "App Description",
    "app_type": "app",
    "app_scopes": [
      "settings.read",
      "customers.read_write",
      "orders.read_write",
      "carts.read",
      "webhooks.read_write",
      "offline_access"
    ],
    "installation_date": "2021-09-28 06:06:56",
    "store_type": "development"
  }
}
```

---

## 9. 🔗 Official Open-Source Libraries

**Source:** https://docs.salla.dev/doc-421118

| Language | Library |
|----------|---------|
| **PHP** | `composer require salla/oauth2-merchant` |
| **Node.js** | `npm install @salla.sa/passport-strategy` |
| **Laravel** | Built into oauth2-merchant + Starter Kit |

GitHub: https://github.com/sallaApp

---

## 10. ✅ Requirements to Get Started

**Source:** https://docs.salla.dev/doc-421117

1. **Basic understanding** of programming, API consumption, webhooks, JSON
2. **Verified Salla Partners account** at https://salla.partners
3. **OAuth 2.0 implementation** for authorization
4. **Demo store** for testing (available free in Partners Portal)

---

## 11. 📊 Summary for RIBH Build

### What Salla Provides:

| Requirement | Available | How |
|-------------|-----------|-----|
| Abandoned cart data | ✅ YES | API endpoint + Webhooks |
| Customer contact info | ✅ YES | Included in cart/customer data |
| Real-time notifications | ✅ YES | `abandoned.cart` webhook |
| Phone numbers | ✅ YES | Customer data includes mobile |
| OAuth integration | ✅ YES | Easy Mode for production |
| Rate limits | ✅ OK | 120-720 req/min by plan |

### Critical Findings:

1. **Abandoned Cart Webhook EXISTS** - `abandoned.cart` event will notify us in real-time
2. **API Access to Carts** - Can poll `/carts/abandoned` endpoint
3. **Customer Data Available** - Phone, email, name accessible
4. **Easy Mode OAuth** - Production apps must use Easy Mode (tokens via webhook)
5. **Refresh Token Single-Use** - Must handle carefully to avoid token invalidation

### Build Strategy:

```
1. Register app at https://salla.partners
2. Set scopes: carts.read, customers.read, webhooks.read_write, offline_access
3. Configure webhook URL to receive events
4. Use Easy Mode OAuth (receive tokens via app.store.authorize)
5. Store tokens securely (encrypted in Firestore)
6. Subscribe to abandoned.cart webhook event
7. When event received → trigger WhatsApp message flow
```

### Verdict: **FULLY SUPPORTED - BUILD IT!** 🚀

The official Salla documentation confirms complete support for abandoned cart recovery:
- Real-time webhook for abandoned carts
- API access to cart details
- Customer contact information
- Official Node.js library available

**Next Step:** Register app on https://salla.partners
