# 🧪 RIBH Test Suite

## Salla Webhook Simulator

Test RIBH locally without a real Salla store!

### Quick Start

```bash
# Start your local server first
cd /home/ubuntu/clawd/ribh-app/functions
node server-standalone.js

# In another terminal, send test webhooks
cd /home/ubuntu/clawd/ribh-app/test
node simulate-salla.js cart.abandoned
```

### Available Events

| Event | Description |
|-------|-------------|
| `cart.created` | Customer adds items to cart |
| `cart.abandoned` | Cart abandoned (triggers recovery) |
| `order.created` | Customer completes purchase |
| `order.updated:shipped` | Order marked as shipped |
| `order.updated:delivered` | Order delivered to customer |
| `customer.created` | New customer registration |
| `all` | **Full journey** (all events in sequence) |

### Options

```bash
# Custom URL (default: http://localhost:3000/salla/webhook)
node simulate-salla.js cart.abandoned --url=https://ribh.click/salla/webhook

# Custom delay between events in 'all' mode
node simulate-salla.js all --delay=5000

# Use specific merchant ID
node simulate-salla.js order.created --merchant=my_store_123

# Show full response bodies
node simulate-salla.js cart.abandoned --verbose
```

### Test Data Features

- 🇸🇦 **Realistic Saudi data**: Arabic names, +966 phone numbers, SAR prices
- 🏪 **Saudi cities**: Riyadh, Jeddah, Dammam, Makkah, etc.
- 🛍️ **Saudi products**: Oud perfume, dates, coffee, abayas, etc.
- 📱 **Valid phone formats**: 05X-XXX-XXXX

### Full Customer Journey

```bash
node simulate-salla.js all
```

This runs a complete customer journey:
1. Customer registers
2. Customer adds items to cart
3. Cart is abandoned (1 hour later)
4. Customer completes purchase
5. Order shipped
6. Order delivered

Perfect for testing the complete recovery flow!
