# 🧪 RIBH WhatsApp Testing Guide
## Real Customer Testing Flow

---

## STEP 1: Install Dependencies
Open your **regular terminal** (not in Antigravity) and run:

```bash
cd /Users/user/Downloads/app/ribh-app/functions
npm install
```

This will install:
- `whatsapp-web.js` - WhatsApp Web automation
- `qrcode` - QR code generation

---

## STEP 2: Run Local Server
In the same terminal:

```bash
cd /Users/user/Downloads/app/ribh-app/functions
node server.js
```

Or use Firebase emulator:
```bash
firebase emulators:start --only functions
```

You should see:
```
✅ WhatsApp Bridge loaded - FREE unlimited messaging via merchant QR!
🚀 Server running on port 3000
```

---

## STEP 3: Connect YOUR WhatsApp (as a Merchant)

### Option A: Via Web Page
1. Open browser: **http://localhost:3000/whatsapp?merchant=mohammed**
2. You'll see a QR code
3. Open WhatsApp on your phone
4. Go to: **Settings → Linked Devices → Link a Device**
5. Scan the QR code
6. Page will show "✅ متصل بنجاح!"

### Option B: Via API (for testing)
```bash
# Get QR code
curl "http://localhost:3000/api/whatsapp/connect?merchant=mohammed"

# Check status
curl "http://localhost:3000/api/whatsapp/status?merchant=mohammed"
```

---

## STEP 4: Test Sending a Message (as Customer Receives)

Once connected, send a test message to yourself or a friend:

### Via API:
```bash
curl -X POST "http://localhost:3000/api/whatsapp/send" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant": "mohammed",
    "to": "+966XXXXXXXXX",
    "message": "مرحباً! هذا اختبار من رِبح 💚"
  }'
```

Replace `+966XXXXXXXXX` with your real phone number.

### Via Cart Recovery (Full Test):
```bash
curl -X POST "http://localhost:3000/api/whatsapp/send-cart-recovery" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant": "mohammed",
    "phone": "+966XXXXXXXXX",
    "customerName": "أحمد",
    "cartValue": 299,
    "items": [{"name": "آيفون كيس"}, {"name": "شاحن سريع"}],
    "checkoutUrl": "https://mystore.salla.sa/checkout/123",
    "discount": 10
  }'
```

---

## STEP 5: Simulate Full Flow (Real Customer Experience)

### Scenario: Customer abandons cart

1. **Customer adds items to cart** (simulated by our webhook)
2. **Customer leaves** (doesn't complete checkout)
3. **RIBH detects abandoned cart** (after 1 hour)
4. **RIBH sends WhatsApp** via merchant's number:

```
مرحباً أحمد! 👋

لاحظنا أنك تركت سلة مشترياتك 🛒

📦 المنتجات:
• آيفون كيس
• شاحن سريع

💰 القيمة الإجمالية: 299 ر.س

🎁 *خصم خاص لك: 10%*

👉 أكمل طلبك الآن:
https://mystore.salla.sa/checkout/123

---
_رسالة آلية من رِبح_
```

5. **Customer receives WhatsApp** from STORE'S number (not RIBH!)
6. **Customer clicks link** → Completes purchase!

---

## STEP 6: Deploy to Production

Once tested locally:

```bash
cd /Users/user/Downloads/app/ribh-app
firebase deploy
```

Then test on live:
- **https://ribh.click/whatsapp?merchant=YOUR_MERCHANT_ID**

---

## 🔍 Debugging Commands

```bash
# Check connection status
curl "http://localhost:3000/api/whatsapp/status?merchant=mohammed"

# List all connected merchants
curl "http://localhost:3000/api/whatsapp/connected"

# Disconnect WhatsApp
curl -X POST "http://localhost:3000/api/whatsapp/disconnect" \
  -H "Content-Type: application/json" \
  -d '{"merchant": "mohammed"}'
```

---

## ⚠️ Important Notes

1. **First scan takes 30-60 seconds** - Puppeteer needs to launch Chrome
2. **Session persists** - After first scan, no need to rescan each time
3. **Don't send too fast** - Rate limit ~100 msgs/hour to avoid ban
4. **Test with your own number first** - Confirm it works before customers

---

## 📊 Expected Results

✅ QR code appears on web page
✅ Scanning connects successfully
✅ Status shows "connected" with your phone number
✅ Test message appears on recipient's WhatsApp
✅ Message shows FROM YOUR NUMBER (not a random API number!)

---

*Testing guide created: January 24, 2026*
