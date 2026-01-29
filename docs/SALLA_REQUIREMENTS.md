# Salla App Publication Requirements

> Complete guide to publishing apps on Salla App Store, focused on cart recovery/communication apps.

## Table of Contents
- [Required App Fields](#required-app-fields)
- [Communication App Category](#communication-app-category)
- [OAuth & Scopes](#oauth--scopes)
- [Webhook Events](#webhook-events)
- [Screenshot & Media Requirements](#screenshot--media-requirements)
- [Description Requirements](#description-requirements)
- [Pricing Models](#pricing-models)
- [App Approval Checklist](#app-approval-checklist)

---

## Required App Fields

### Basic Information (Step 1)
| Field | Requirements |
|-------|-------------|
| **App Icon** | Minimum 250x250 pixels, 1:1 aspect ratio, high-quality |
| **App Name (English)** | Max 30 characters |
| **App Name (Arabic)** | Max 30 characters, required for Salla marketplace |
| **Category** | `Communication App` for cart recovery/WhatsApp messaging |
| **Short Description** | Max 200 characters, clear and straightforward |
| **App Website** | Valid URL to your app's website |
| **Support Email** | Active support email address |
| **Search Terms** | SEO keywords for app discovery |
| **Promotional Video** | Optional, YouTube video max 2 minutes |

### App Configurations (Step 2)
- **App Scopes**: Define what data your app accesses (see OAuth section)
- **Justification**: Required if scopes exceed expected app functionality
- **Webhook URL**: Where Salla sends event notifications
- **Webhook Events**: Only subscribe to relevant events

### App Features (Step 3)
| Asset | Dimensions | Quantity |
|-------|-----------|----------|
| **App Gallery Images** | 1366 x 768 px | 3 images minimum |
| **Key Benefits Images** | 1600 x 1600 px | 3 images with titles/descriptions |

### Contact Information (Step 5)
- Primary support email
- Support phone (optional)
- Privacy Policy URL
- FAQ URL (optional)

---

## Communication App Category

### What Makes an App "Communication"?
Communication Apps are specifically for **messaging service providers** that handle store communications:
- SMS providers
- WhatsApp Business API providers
- Email service providers

### API-Only Linking (Technical Requirements)
Communication Apps work via **webhook interception**:

1. **Salla intercepts outgoing messages** (SMS, Email, WhatsApp)
2. **Sends webhook to your app** with message details
3. **Your app delivers** via your own channel (WhatsApp API, etc.)
4. **No UI required** in merchant dashboard - pure API integration

```
Salla Store → Communication Webhook → Your App → WhatsApp/SMS/Email
```

### Communication Webhook Events
**Only available to Communication Apps:**
```
communication.sms.send      # Outgoing SMS messages
communication.email.send    # Outgoing email messages  
communication.whatsapp.send # Outgoing WhatsApp messages
```

### Webhook Payload Example
```json
{
  "event": "communication.sms.send",
  "merchant": 292111819,
  "created_at": "Mon Nov 10 2025 17:18:13 GMT+0300",
  "data": {
    "notifiable": ["+96656000000"],
    "type": "product.digital.code",
    "content": "أصبحت حالة طلبك #218103278 [تم التنفيذ]",
    "entity": {
      "id": 1741773897,
      "type": "order"
    },
    "meta": {
      "customer_id": 239462497
    }
  }
}
```

### Message Types Sent via Communication Webhooks
- Order updates
- Payment reminders
- Product availability alerts
- Marketing broadcasts
- Customer engagement messages
- Abandoned cart notifications

---

## OAuth & Scopes

### Required Scopes for Cart Recovery App

| Scope | Description | Required |
|-------|-------------|----------|
| `carts.read` | Read abandoned cart data | ✅ Yes |
| `customers.read` | Read customer info (name, mobile, email) | ✅ Yes |
| `customers.read_write` | Full customer access (if updating) | Optional |
| `orders.read` | Read order data | ✅ Yes |
| `webhooks.read_write` | Register/manage webhooks | ✅ Yes |
| `settings.read` | Read store settings | Recommended |
| `offline_access` | Get refresh tokens (14-day access tokens) | ✅ Yes |

### OAuth Flow
1. **Easy Mode (Recommended)**: Salla handles token generation
   - Listen to `app.store.authorize` webhook event
   - Receive access_token, refresh_token, expires automatically
   
2. **Custom Mode**: Manual OAuth implementation
   - Only for testing, **not allowed for published apps**

### Token Lifecycle
- **Access Token**: Valid 14 days (2 weeks)
- **Refresh Token**: Valid 1 month, single-use only
- ⚠️ **Never reuse refresh tokens** - causes complete auth failure

### Authorization Endpoints
```
Authorization: https://accounts.salla.sa/oauth2/auth
Token:         https://accounts.salla.sa/oauth2/token
User Info:     https://accounts.salla.sa/oauth2/user/info
Installation:  https://s.salla.sa/apps/install/{app-id}
```

---

## Webhook Events

### Cart Events (Most Important for Recovery)
| Event | Description |
|-------|-------------|
| `abandoned.cart` | Triggered when cart is abandoned |
| `abandoned.cart.status.changed` | Cart status changed |
| `abandoned.cart.purchased` | Abandoned cart was recovered |
| `coupon.applied` | Coupon applied to cart |

### Customer Events
| Event | Description |
|-------|-------------|
| `customer.created` | New customer registered |
| `customer.updated` | Customer info updated |
| `customer.login` | Customer logged in |
| `customer.otp.request` | OTP requested |

### Order Events (For Recovery Tracking)
| Event | Description |
|-------|-------------|
| `order.created` | New order placed |
| `order.updated` | Order modified |
| `order.status.updated` | Status changed |
| `order.payment.updated` | Payment status changed |

### App Events (Required for OAuth)
| Event | Description |
|-------|-------------|
| `app.store.authorize` | App authorized, contains access token |
| `app.installed` | App installed on store |
| `app.uninstalled` | App removed from store |
| `app.settings.updated` | Merchant updated app settings |
| `app.subscription.started` | Paid subscription began |
| `app.subscription.expired` | Subscription ended |
| `app.trial.started` | Trial period began |
| `app.trial.expired` | Trial ended |

---

## Screenshot & Media Requirements

### App Gallery (Required)
- **Quantity**: 3 images minimum
- **Dimensions**: 1366 x 768 pixels
- **Content**: Show actual app functionality
- **Language**: Include both Arabic and English versions

### Key Benefits Images (Required)
- **Quantity**: 3 images
- **Dimensions**: 1600 x 1600 pixels
- **Each image needs**: Title + Description (Arabic & English)

### Promotional Video (Optional)
- **Platform**: YouTube only
- **Max Duration**: 2 minutes
- **Content**: Demo app features and benefits

### Screenshot Content Recommendations
1. **Main Dashboard** - Overview of recovery stats
2. **Message Templates** - WhatsApp/SMS message customization
3. **Analytics** - Recovery rate, revenue recovered
4. **Settings** - Easy configuration interface
5. **Mobile View** - WhatsApp message preview on phone

---

## Description Requirements

### Short Description
- **Max Length**: 200 characters
- **Languages**: Arabic AND English required
- **Style**: Clear, direct, value-focused

### Full Description
- **Languages**: Arabic AND English
- **Content**:
  - What the app does
  - Key features and benefits
  - How to use it
  - Support contact info

### Example Descriptions

**English (Short)**:
```
Recover abandoned carts with smart WhatsApp messages. Automated reminders, personalized templates, and detailed analytics to boost your sales.
```

**Arabic (Short)**:
```
استرجع السلات المتروكة برسائل واتساب ذكية. تذكيرات تلقائية، قوالب مخصصة، وتحليلات مفصلة لزيادة مبيعاتك.
```

---

## Pricing Models

### Available Pricing Types

| Type | Description | Best For |
|------|-------------|----------|
| **Free** | No charge, unlimited use | MVP, lead generation |
| **One-Time** | Single payment, lifetime access | Simple tools |
| **Recurring** | Monthly/yearly subscription | SaaS apps |

### Recurring Pricing Options
- Monthly billing
- Yearly billing (often discounted)
- **Free Trial**: Can offer freemium trial period
- **Maximum Plans**: 4 pricing tiers per app

### Plan Features
Each plan should clearly list:
- Feature availability
- Usage limits (if any)
- Support level
- Message quotas (for communication apps)

### Recommended Pricing Structure for Cart Recovery
```
Free Tier:       10 recovery messages/month
Basic (49 SAR):  100 messages/month + basic templates
Pro (149 SAR):   Unlimited messages + advanced analytics
Enterprise:      Custom, multi-store support
```

---

## API Endpoints

### Abandoned Carts API
```
Base URL: https://api.salla.dev/admin/v2

GET /abandoned-carts              # List all abandoned carts
GET /abandoned-carts/{cart_id}    # Get cart details
```

### Cart Data Available
```json
{
  "id": 12345,
  "checkout_url": "https://store.salla.sa/checkout/...",
  "total": { "amount": 299, "currency": "SAR" },
  "age_in_minutes": 120,
  "customer": {
    "id": 67890,
    "name": "أحمد",
    "mobile": "+966500000000",
    "email": "ahmed@example.com"
  },
  "items": [
    {
      "product_id": 111,
      "quantity": 2,
      "amounts": { "total": { "amount": 149.5 } }
    }
  ]
}
```

### Webhook Registration
```bash
POST /webhooks/subscribe
{
  "name": "Cart Recovery Webhook",
  "event": "abandoned.cart",
  "url": "https://your-app.com/webhook",
  "version": 2
}
```

---

## App Approval Checklist

### ✅ Basic Information
- [ ] App icon uploaded (250x250px minimum, 1:1 ratio)
- [ ] App name in English (≤30 chars)
- [ ] App name in Arabic (≤30 chars)
- [ ] Category set to "Communication App"
- [ ] Short description in English (≤200 chars)
- [ ] Short description in Arabic (≤200 chars)
- [ ] App website URL provided
- [ ] Support email active and monitored

### ✅ Technical Setup
- [ ] OAuth Easy Mode selected (required for published apps)
- [ ] Scopes defined and justified
- [ ] Webhook URL configured and responding
- [ ] Webhook secret set up for security
- [ ] Communication webhook events subscribed

### ✅ Scopes Configured
- [ ] `carts.read` enabled
- [ ] `customers.read` enabled
- [ ] `orders.read` enabled
- [ ] `webhooks.read_write` enabled
- [ ] `offline_access` enabled (for refresh tokens)

### ✅ Webhooks Subscribed
- [ ] `app.store.authorize` (auto - for OAuth)
- [ ] `app.installed` (auto)
- [ ] `app.uninstalled` (auto)
- [ ] `abandoned.cart` event
- [ ] `communication.sms.send` or `communication.whatsapp.send`

### ✅ Media Assets
- [ ] 3+ App Gallery images (1366x768px)
- [ ] 3 Key Benefits images (1600x1600px)
- [ ] Titles for Key Benefits (Arabic + English)
- [ ] Descriptions for Key Benefits (Arabic + English)
- [ ] Optional: YouTube promo video (≤2 min)

### ✅ Descriptions
- [ ] Full description in English
- [ ] Full description in Arabic
- [ ] Features clearly listed
- [ ] Use cases explained

### ✅ Pricing
- [ ] At least one pricing plan configured
- [ ] Plan features clearly defined
- [ ] Free trial configured (recommended)
- [ ] Maximum 4 pricing tiers

### ✅ Contact & Legal
- [ ] Support email provided
- [ ] Privacy Policy URL
- [ ] FAQ page (optional but recommended)

### ✅ Testing
- [ ] App tested on demo store
- [ ] OAuth flow working
- [ ] Webhooks receiving events
- [ ] Core functionality verified
- [ ] Error handling tested

---

## Important Notes

### ⚠️ Communication App Requirements
1. Communication webhooks are **ONLY available to Communication Apps**
2. Must select "Communication App" category during creation
3. API-only linking means no storefront UI - pure backend integration

### ⚠️ OAuth Restrictions
1. **Easy Mode ONLY** for published apps (Custom Mode is testing only)
2. Never reuse refresh tokens - causes auth failure
3. Store merchant tokens securely

### ⚠️ Webhook Best Practices
1. Respond to webhooks within 30 seconds
2. Return 2xx status code for success
3. Salla retries failed webhooks 3 times (5-minute intervals)
4. Use signature verification for security

### 📞 Support Resources
- Developer Community: https://t.me/salladev
- Documentation: https://docs.salla.dev
- Email: support@salla.dev
- API Changelog: https://t.me/SallaAPI

---

*Last Updated: January 2026*
*Source: Salla Developer Documentation + Research*
