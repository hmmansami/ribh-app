# Salla Integration Reference — RIBH App

> Last updated: 2026-02-04
> Source: Official Salla docs (docs.salla.dev) + account manager email

---

## 1. App Requirements (from Salla Account Manager)

- **Classification**: Communication (must be recreated with this category)
- **Linking**: API-only for Salla merchants (no embedded dashboard)
- **Account Manager**: Available via Salla Partners portal
- **Publishing**: Must follow Salla App Publishing Standards

---

## 2. Partner Portal Setup

### App Creation (https://salla.partners)
| Field | Value |
|-------|-------|
| App Type | Public |
| Category | **Communication** |
| Icon | Min 250×250px, 1:1 ratio |
| Name | Arabic + English |
| Description | Max 50 chars |
| Website | https://ribh-484706.web.app |
| Support Email | hmmansami10@gmail.com |

### OAuth Mode
- **Easy Mode** (recommended): Salla handles token generation. Sends `app.store.authorize` webhook with access token on install.
- **Custom Mode**: Manual OAuth redirect flow. App handles code exchange.
- Current code supports both modes.

### Publishing Process (6 sections)
1. Basic Information
2. App Configurations
3. App Features
4. Pricing (subscription plans)
5. Contact Information
6. Service Trial

---

## 3. OAuth 2.0

### Endpoints
| Purpose | URL |
|---------|-----|
| Authorization | `https://accounts.salla.sa/oauth2/auth` |
| Token Exchange | `https://accounts.salla.sa/oauth2/token` |
| Refresh Token | `https://accounts.salla.sa/oauth2/token` |
| User Info | `https://accounts.salla.sa/oauth2/user/info` |

### Parameters
```
client_id     = from Partners Portal
client_secret = from Partners Portal
response_type = code
redirect_uri  = https://ribh-484706.web.app/salla/callback
scope         = offline_access carts.read customers.read_write orders.read_write webhooks.read_write
state         = CSRF token
grant_type    = authorization_code | refresh_token
```

### Token Lifecycle
- **Access token**: 14 days
- **Refresh token**: 1 month
- **CRITICAL**: Refresh tokens are **single-use**. Using one twice invalidates everything → merchant must reinstall app.
- Implement mutex locking for concurrent refresh operations.

### Required Scopes for RIBH
| Scope | Why |
|-------|-----|
| `carts.read` | List/get abandoned carts |
| `customers.read_write` | Customer data for targeting |
| `orders.read_write` | Order tracking, post-purchase flows |
| `webhooks.read_write` | Register/manage webhook subscriptions |
| `offline_access` | Required for refresh tokens |
| `marketing.read_write` | Campaign data (if needed) |

---

## 4. API Reference

### Base URL
```
https://api.salla.dev/admin/v2
```

### Authentication Header
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Rate Limits
| Merchant Plan | Requests/Minute | Leak Rate |
|---------------|----------------|-----------|
| Plus | 120 | 1 req/sec |
| Pro | 360 | 1 req/sec |
| Special | 720 | 1 req/sec |

**Customers endpoint**: 500 requests per 10 minutes (separate limit)

**Response Headers**:
- `X-RateLimit-Limit` — Total allowed per minute
- `X-RateLimit-Remaining` — Remaining in current window
- `Retry-After` — Seconds until retry
- `X-RateLimit-Reset` — UTC epoch reset time

### Abandoned Carts

#### List Abandoned Carts
```
GET /carts/abandoned
Scope: carts.read
```

**Query Params**: `page`, `offset` (minutes), `per_page` (max 60), `keyword` (customer_id or mobile)

**Response** (key fields per cart):
```json
{
  "id": 123,
  "total": { "amount": 99.99, "currency": "SAR" },
  "subtotal": { "amount": 85.00, "currency": "SAR" },
  "total_discount": { "amount": 10.00, "currency": "SAR" },
  "checkout_url": "https://store.salla.sa/checkout/...",
  "status": "active|purchased",
  "age_in_minutes": 45,
  "customer": {
    "id": 456, "name": "Ahmed", "mobile": "+966560000000",
    "email": "ahmed@example.com", "country": "Saudi Arabia", "city": "Riyadh"
  },
  "coupon": { "id": 789, "code": "SUMMER20", "status": "active", "type": "percentage" },
  "items": [{ "id": 101, "product_id": 202, "quantity": 2, "amounts": { "total": { "amount": 80 } } }]
}
```

**Pagination**: `count`, `total`, `perPage`, `currentPage`, `totalPages`, `links.next/previous`

#### Get Abandoned Cart Details
```
GET /carts/abandoned/{cart-id}
Scope: carts.read
```
Same response structure as list item, plus full item details.

### Customers

#### List Customers
```
GET /customers
Scope: customers.read
Rate: 500 req / 10 min
```

**Query Params**: `page`, `keyword` (mobile/name/email), `date_from`, `date_to` (YYYY-MM-DD), `fields[]` (is_blocked, block_reason, total_points, etc.)

**Response** per customer: `id`, `first_name`, `last_name`, `mobile`, `email`, `avatar`, `gender`, `birthday`, `city`, `country`, `urls`, `updated_at`, `group_ids`

#### Other Customer Endpoints
- `POST /customers` — Create customer
- `GET /customers/{id}` — Customer details
- `PUT /customers/{id}` — Update customer
- `DELETE /customers/{id}` — Delete customer
- `POST /customers/{id}/ban` — Ban customer

### Orders
Base endpoints under `/orders`. Used for post-purchase flows, review requests, winback timing.

### Webhooks

#### Register Webhook
```
POST /webhooks/subscribe
Scope: webhooks.read_write
```

**Request Body**:
```json
{
  "name": "RIBH Abandoned Cart",
  "event": "abandoned.cart",
  "url": "https://ribh-484706.web.app/webhooks/salla",
  "version": 2,
  "headers": [{ "key": "X-RIBH-Secret", "value": "..." }]
}
```

**Optional**: `rule` field for conditional filtering (e.g. `"price > 50"`)

---

## 5. Webhook Events

### Webhook Security
- **Default**: Signature strategy
- **Header**: `X-Salla-Signature` — HMAC-SHA256 of payload with webhook secret
- **Verification** (Node.js):
```javascript
const computed = crypto.createHmac('sha256', secret)
  .update(JSON.stringify(req.body)).digest('hex');
const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
```

### Retry Policy
- Timeout: ~30 seconds
- Retries: 3 attempts with ~5-minute intervals
- Stops on successful response

### Events RIBH Needs

| Event | Trigger | Use Case |
|-------|---------|----------|
| `abandoned.cart` | Cart abandoned | **Core**: Send recovery WhatsApp |
| `abandoned.cart.purchased` | Abandoned cart converted | Track recovery success |
| `abandoned.cart.status.changed` | Cart status change | Update cart tracking |
| `order.created` | New order | Cancel recovery sequence, track revenue |
| `order.status.updated` | Order shipped/delivered | Post-purchase flow, review request |
| `order.cancelled` | Order cancelled | Winback opportunity |
| `customer.created` | New customer signup | Welcome flow |
| `app.store.authorize` | App installed (Easy Mode) | Store OAuth tokens |
| `app.installed` | App installed | Log installation |
| `app.uninstalled` | App removed | Cleanup |

### Abandoned Cart Webhook Payload
```json
{
  "event": "abandoned.cart",
  "merchant": 12345,
  "created_at": "2026-01-15T10:30:00+03:00",
  "data": {
    "id": 123,
    "total": { "amount": 99.99, "currency": "SAR" },
    "subtotal": { "amount": 85.00, "currency": "SAR" },
    "checkout_url": "https://store.salla.sa/checkout/...",
    "age_in_minutes": 45,
    "customer": {
      "id": 456, "name": "أحمد محمد",
      "mobile": "+966560000000", "email": "ahmed@example.com",
      "country": "Saudi Arabia", "city": "Riyadh"
    },
    "items": [...]
  }
}
```

### Order Webhook Payload (key fields)
```json
{
  "event": "order.created",
  "merchant": 12345,
  "data": {
    "id": 789, "reference_id": "REF-001",
    "source": "store|abandoned-cart|campaign",
    "status": { "slug": "under_review|completed|..." },
    "amounts": { "sub_total": {}, "shipping_cost": {}, "tax": {}, "total": {} },
    "customer": { "id": 456, "first_name": "أحمد", "mobile": "+966..." },
    "items": [{ "name": "...", "quantity": 1, "amounts": {} }],
    "shipping": { "receiver": {}, "shipper": {} }
  }
}
```

**Order sources**: `store`, `landing`, `forgotten_basket`, `abandoned-cart`, `campaign`, `dashboard`, `buy_as_gift`, `buy_now`, `one-click`, `complete_order`

→ Track `source: "abandoned-cart"` to attribute recoveries to RIBH.

---

## 6. Existing Codebase (Already Built)

### Files
| File | Purpose | Lines |
|------|---------|-------|
| `functions/routes/salla.js` | OAuth + webhook routes | 162 |
| `functions/lib/sallaApp.js` | Token management + API client | 221 |
| `functions/lib/sallaWebhooks.js` | Webhook handler class + parsers | 806 |
| `functions/webhooks/sallaCart.js` | Abandoned cart handler + WhatsApp | 601 |
| `functions/sallaScraper.js` | Store discovery + lead gen | 967 |
| `functions/server.js` | Express routes (mounts all above) | — |
| `test/simulate-salla.js` | Webhook simulator | 624 |

### Current OAuth Credentials (in code)
```
SALLA_CLIENT_ID = 476e7ed1-796c-4731-b145-73a13d0019de
SALLA_CLIENT_SECRET = ca8e6de4265c8faa553c8ac45af0acb6306de00a388bf4e06027e4229944f5fe
```

### Firestore Collections
- `salla_merchants` — OAuth tokens, merchant info, status
- `abandoned_carts` — Cart tracking (doc ID: `{storeId}_{cartId}`)
- `leads` — Scraped store leads

### Webhook Routes (server.js)
```
GET/POST /webhooks/salla           → main webhook handler
GET/POST /api/webhooks/salla       → main webhook handler
POST     /webhook                  → fallback webhook handler
GET/POST /webhooks/salla/cart      → abandoned cart handler
POST     /api/webhooks/salla/cart  → abandoned cart handler
```

### What's Working
- OAuth 2.0 (both Easy + Custom mode)
- Token refresh with Firestore persistence
- Webhook signature verification (HMAC-SHA256, timing-safe)
- Abandoned cart detection + WhatsApp sending
- Order lifecycle tracking (created → shipped → delivered)
- Review request scheduling for delivered orders
- Saudi phone number normalization
- Customer event parsing
- Lead scraping + status management

---

## 7. What's Needed for Launch

### Portal Configuration
- [ ] Recreate app with category "Communication" on Partners Portal
- [ ] Set OAuth redirect URI to production URL
- [ ] Configure webhook URL: `https://ribh-484706.web.app/webhooks/salla`
- [ ] Enable required scopes: carts.read, customers.read_write, orders.read_write, webhooks.read_write, offline_access
- [ ] Set up trusted IPs (if using fixed IPs)
- [ ] Define subscription plans (pricing tiers)

### Code Changes Needed
- [ ] Connect app.html frontend to real API data (replace demo numbers)
- [ ] Add Salla OAuth install button/link in app settings
- [ ] Show real merchant data (store name, customer count, last sync)
- [ ] Fetch and display real abandoned cart data
- [ ] Display real flow statistics (sent, revenue recovered)
- [ ] Test with Salla demo store

### Publishing Checklist
- [ ] App icon (250×250px, 1:1)
- [ ] Arabic + English app name and description
- [ ] Define subscription tiers (e.g., Basic 200 SAR/mo, Pro 500 SAR/mo)
- [ ] Set 7-day free trial
- [ ] Contact information
- [ ] Test on demo store and document results
- [ ] Submit for review

---

## 8. Key Salla Docs Links

- OAuth: https://docs.salla.dev/421118m0
- API Overview: https://docs.salla.dev/doc-426392
- Abandoned Carts List: https://docs.salla.dev/api-5394138
- Abandoned Cart Details: https://docs.salla.dev/api-5394139
- Customers: https://docs.salla.dev/5394121e0
- Webhooks Guide: https://docs.salla.dev/421119m0
- Register Webhook: https://docs.salla.dev/5394134e0
- Cart Events: https://docs.salla.dev/doc-433812
- Order Events: https://docs.salla.dev/433804m0
- Rate Limits: https://docs.salla.dev/421125m0
- Create First App: https://docs.salla.dev/421410m0
- Publish App: https://docs.salla.dev/422990m0
- App Publishing Standards: https://salla.dev/blog/standards-salla-apps-publications/
- Pricing Strategies: https://salla.dev/blog/ultimate-app-pricing-strategies-guide/
- Custom Plans: https://salla.dev/blog/comprehensive-guide-to-custom-plans-on-salla-partners/
- Demo Store Testing: https://salla.dev/blog/how-to-test-your-app-using-salla-demo-stores/
- Developer Portal: https://salla.dev/
- Telegram Community: https://t.me/salladev
- Schedule Meeting: https://calendly.com/salla-community/partners
