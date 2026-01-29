# 🎬 RIBH Demo Script - Salla Pre-Launch Meeting

**Meeting:** Salla App Store Approval  
**App:** رِبح (RIBH) - Cart Recovery via WhatsApp  
**Duration:** 15-20 minutes  
**Goal:** Get approval for Salla App Store listing

---

## 📋 Pre-Demo Checklist

Before the meeting:
- [ ] `https://ribh.click` is live ✅
- [ ] `https://ribh-app.onrender.com/health` returns healthy
- [ ] Firebase console open (show Firestore if needed)
- [ ] Test merchant account ready in Firestore
- [ ] WhatsApp bridge running: `https://ribh-whatsapp-1.onrender.com`
- [ ] Phone ready to scan QR code

---

## 🎯 Demo Flow (15 mins)

### Part 1: Install Flow (3 mins)
**Show:** What happens when a merchant installs RIBH from Salla App Store

### Part 2: Onboarding Experience (3 mins)
**Show:** WhatsApp QR connection + setup wizard

### Part 3: Dashboard & Features (5 mins)
**Show:** Analytics, settings, AI-powered messaging

### Part 4: Live Cart Recovery (4 mins)
**Show:** Real webhook → WhatsApp message flow

---

## 📝 Detailed Script

---

### Step 1: App Installation (OAuth Flow)

**What to do:**
1. Open Salla Partners dashboard (or simulate install)
2. Show the OAuth callback flow

**What to say:**
> "عندما التاجر يثبت التطبيق من متجر سلة، يحصل الآتي تلقائياً..."
> 
> "When a merchant installs RIBH from the Salla App Store, this happens automatically:"

**Show on screen:**
- OAuth redirect to Salla → user approves → callback to RIBH
- URL: `https://ribh-app.onrender.com/api/salla/callback?code=xxx`

**Technical details (if asked):**
```
OAuth 2.0 Flow:
1. Merchant clicks "Install" on Salla App Store
2. Salla redirects to our callback with authorization code
3. We exchange code for access_token + refresh_token
4. Tokens stored in Firestore (encrypted)
5. Auto-refresh when tokens expire
```

**What to say:**
> "التوكنز تتخزن بشكل آمن في Firestore وتتجدد تلقائياً"
>
> "Tokens are securely stored in Firestore and auto-refresh before expiry"

---

### Step 2: Account Creation & Welcome Email

**What to do:**
1. Show Firestore: `salla_merchants` collection
2. Show a merchant document with stored data
3. Show the welcome email template

**What to say:**
> "فور التثبيت، نسوي حساب للتاجر ونرسله إيميل ترحيبي مع رابط لوحة التحكم"
>
> "Immediately after install, we create a merchant account and send a welcome email with dashboard link"

**Show on screen:**
```javascript
// What we store:
{
  merchantId: "1234567",
  accessToken: "eyJ...",
  refreshToken: "dGhp...",
  status: "active",
  storeName: "متجر الأزياء",
  ownerEmail: "owner@store.com",
  ownerPhone: "+966500000000",
  installedAt: "2025-01-27T..."
}
```

**Welcome email highlights:**
- Professional Arabic email
- Direct link to dashboard
- WhatsApp setup instructions
- Support contact

---

### Step 3: Dashboard Tour

**What to do:**
1. Open: `https://ribh.click/dashboard.html?merchant=DEMO`
2. Walk through each section

**URL to open:** `https://ribh.click`

**What to say at each section:**

#### 3.1 Overview Stats
> "هنا التاجر يشوف إحصائياته الرئيسية - السلات المتروكة، المسترجعة، والأرباح"
>
> "Here the merchant sees their key stats - abandoned carts, recovered ones, and revenue"

**Key metrics shown:**
- 🛒 السلات المتروكة (Abandoned Carts)
- ✅ السلات المسترجعة (Recovered Carts)  
- 💰 الإيرادات المسترجعة (Recovered Revenue)
- 📈 معدل الاسترجاع (Recovery Rate)

#### 3.2 Recent Activity
> "وهنا آخر النشاطات - كل سلة متروكة، كل رسالة أرسلناها، كل عملية شراء مكتملة"
>
> "And here's the recent activity - every abandoned cart, every message sent, every completed purchase"

#### 3.3 WhatsApp Connection
> "أهم شي - ربط الواتساب. التاجر يمسح QR code بجواله وخلاص، نقدر نرسل رسائل من رقمه"
>
> "Most important - WhatsApp connection. Merchant scans QR with their phone, and that's it - we can send messages from their number"

**What to show:**
- QR code generation
- "Connected" status
- Session persistence explanation

---

### Step 4: WhatsApp QR Connection (LIVE DEMO)

**What to do:**
1. Go to: `https://ribh.click/setup.html?merchant=demo`
2. Click "Connect WhatsApp"
3. Show QR code appearing
4. (Optional) Scan with test phone

**What to say:**
> "خلونا نشوف العملية بشكل عملي..."
>
> "Let me show you this in action..."

> "التاجر يدخل صفحة الإعداد، يضغط ربط واتساب، ويطلع له QR code"
>
> "Merchant goes to setup page, clicks connect WhatsApp, and gets a QR code"

> "يمسح الكود من واتساب على جواله - نفس طريقة واتساب ويب"
>
> "They scan the code from WhatsApp on their phone - same as WhatsApp Web"

**Technical details (if asked):**
```
WhatsApp Bridge Architecture:
- Uses Baileys (open source WhatsApp Web API)
- Sessions stored per merchant
- Anti-ban system with rate limiting
- Fallback to SMS if WhatsApp fails
- 100% FREE - no Meta Business API costs
```

---

### Step 5: Live Webhook Demo (Cart Recovery)

**What to do:**
1. Open terminal or Postman
2. Send test webhook to `/webhooks/salla`
3. Show message being generated
4. Show message in test WhatsApp (if connected)

**Test webhook command:**
```bash
curl -X POST https://ribh-app.onrender.com/webhooks/salla \
  -H "Content-Type: application/json" \
  -d '{
    "event": "abandoned_cart.created",
    "merchant": "demo-store",
    "data": {
      "cart_id": "cart-demo-123",
      "customer": {
        "name": "أحمد محمد",
        "mobile": "+966500000000"
      },
      "items": [
        {"name": "قميص أزرق", "price": 150, "quantity": 2}
      ],
      "total": 300,
      "currency": "SAR",
      "checkout_url": "https://store.salla.sa/checkout/demo"
    }
  }'
```

**What to say:**
> "الحين خلوني أوريكم الflow الكامل..."
>
> "Now let me show you the complete flow..."

> "لما عميل يترك سلته، سلة ترسل لنا webhook"
>
> "When a customer abandons their cart, Salla sends us a webhook"

> "نحن نستلم البيانات، نولّد رسالة ذكية بالذكاء الاصطناعي، ونرسلها واتساب"
>
> "We receive the data, generate a smart AI message, and send it via WhatsApp"

**Show the generated message:**
```
مرحباً أحمد! 👋

لاحظنا إنك تركت سلتك في المتجر 🛒

عندك:
• قميص أزرق (×2) - 150 ر.س

المجموع: 300 ر.س

🎁 عشانك، خصم 10% لو أكملت الطلب الحين!
استخدم كود: RIBH10

أكمل طلبك: https://store.salla.sa/checkout/demo

رد بـ "نعم" للمساعدة أو "لا" لإلغاء الاشتراك
```

---

### Step 6: AI-Powered Features

**What to show:**
1. Message personalization based on:
   - Customer name
   - Cart value
   - Product type
   - Time of day
   - Previous purchases

**What to say:**
> "الرسائل مش ثابتة - الذكاء الاصطناعي يخصص كل رسالة حسب العميل"
>
> "Messages aren't static - AI personalizes each message based on the customer"

**Key AI features:**
- **تخصيص الرسالة** - Customer name, product-specific language
- **توقيت ذكي** - Sends at optimal times (not 3am!)
- **تدرج الخصومات** - 0% → 5% → 10% over time
- **رسائل تقسيط** - Installment options for high-value carts
- **Arabic-first** - Native Arabic messaging, not translated

---

## 🔥 Key Features to Highlight

| Feature | Arabic | What it Does |
|---------|--------|--------------|
| **WhatsApp-First** | واتساب أولاً | 70%+ open rate vs 20% email |
| **AI Personalization** | تخصيص ذكي | Each message unique |
| **Free Messaging** | رسائل مجانية | QR-based, no API fees |
| **Saudi Phone Support** | دعم الأرقام السعودية | +966 → 05 normalization |
| **Multi-sequence** | رسائل متعددة | 1hr → 6hr → 24hr |
| **Discount Codes** | أكواد خصم | Auto-generated unique codes |
| **Fallback System** | نظام احتياطي | WA → SMS → Email |
| **Arabic-Native** | عربي أصلي | Not translated, written for Arabs |

---

## ❓ Likely Questions & Answers

### Q1: "كيف تضمنون عدم حظر رقم التاجر؟"
**How do you prevent the merchant's number from being banned?**

**Answer:**
> "عندنا نظام anti-ban متكامل:
> - Rate limiting: حد أقصى 50 رسالة/ساعة
> - Random delays: بين 3-15 ثانية بين الرسائل  
> - Human-like patterns: الرسائل تبدو طبيعية مش automated
> - Opt-out respect: لو العميل رد 'لا' ما نرسله مرة ثانية
> - Session management: كل تاجر session منفصل"

```javascript
// Anti-ban config in code:
const antiBanConfig = {
  maxMessagesPerHour: 50,
  minDelayMs: 3000,
  maxDelayMs: 15000,
  respectOptOut: true,
  humanTypingSimulation: true
};
```

---

### Q2: "هل تحتاجون وصول لبيانات العملاء الحساسة؟"
**Do you need access to sensitive customer data?**

**Answer:**
> "نحتاج فقط:
> - اسم العميل
> - رقم الجوال
> - بيانات السلة (المنتجات والأسعار)
> - رابط إكمال الطلب
> 
> ما نحتاج ولا نخزن:
> - بيانات الدفع
> - كلمات المرور
> - معلومات شخصية أخرى"

**Scopes we request:**
```
- orders.read (to track recovered carts)
- customers.read (name + phone for messaging)
- products.read (for smart recommendations)
- carts.read (abandoned cart data)
```

---

### Q3: "ما هي نسبة الاسترجاع المتوقعة؟"
**What's the expected recovery rate?**

**Answer:**
> "بناءً على البيانات العالمية:
> - WhatsApp: 15-25% recovery rate
> - Email alone: 5-10%
> 
> السبب؟ معدل فتح واتساب 70%+ مقارنة بـ 20% للإيميل.
> 
> مثال عملي:
> - 100 سلة متروكة × 300 ر.س متوسط = 30,000 ر.س lost
> - 20% recovery = 6,000 ر.س recovered
> - ROI للتاجر: ضخم"

---

### Q4: "كيف يتم التسعير؟"
**What's the pricing model?**

**Answer:**
> "نموذج التسعير:
> 
> **مجاني للبداية:**
> - أول 100 رسالة مجانية
> - جميع الميزات الأساسية
> 
> **باقات مدفوعة:**
> - Basic: 99 ر.س/شهر (500 رسالة)
> - Pro: 249 ر.س/شهر (2000 رسالة)
> - Enterprise: حسب الاستخدام
> 
> **لا نأخذ نسبة من المبيعات** - flat fee فقط"

---

### Q5: "ما هي البنية التحتية؟"
**What's your infrastructure?**

**Answer:**
> "Stack تقني موثوق:
> - **Backend:** Node.js + Express
> - **Database:** Firebase Firestore
> - **Hosting:** Render (auto-scaling)
> - **WhatsApp:** Baileys (open-source)
> - **AI:** Google Gemini (free tier) + GPT fallback
> - **Email:** Amazon SES ($0.10/1000)
> 
> **Uptime:** 99.9% (monitored via health checks)
> **Security:** OAuth 2.0, encrypted tokens, HTTPS only"

---

### Q6: "هل التطبيق متوافق مع نظام سلة؟"
**Is the app fully compatible with Salla?**

**Answer:**
> "نعم، 100% متوافق:
> - OAuth 2.0 standard implementation
> - All Salla webhooks supported
> - Saudi phone format (+966/05) handled
> - Arabic-first UI and messages
> - Tested with real Salla stores
> 
> الـ webhooks المدعومة:
> - app.store.authorize ✅
> - app.installed ✅  
> - app.uninstalled ✅
> - abandoned_cart.created ✅
> - order.created ✅
> - customer.created ✅"

---

### Q7: "ماذا لو العميل رد على الرسالة؟"
**What if the customer replies to the message?**

**Answer:**
> "عندنا نظام chatbot ذكي:
> - لو رد 'نعم' → نرسله رابط الشراء مباشرة
> - لو رد 'لا' → نوقف الرسائل فوراً (opt-out)
> - لو سأل سؤال → AI يحاول يرد، أو يحوّل للتاجر
> 
> كل الردود تنحفظ ويقدر التاجر يشوفها من الداشبورد"

---

## 🏁 Closing the Demo

**What to say:**

> "باختصار، رِبح يساعد التجار يسترجعون مبيعات ضائعة بدون أي جهد منهم.
> 
> التاجر يثبت التطبيق، يربط واتساب، وخلاص - الباقي تلقائي.
> 
> كل سلة متروكة = رسالة ذكية = فرصة بيع.
> 
> هل عندكم أي أسئلة إضافية؟"

**English:**
> "In summary, RIBH helps merchants recover lost sales with zero effort.
> 
> Merchant installs the app, connects WhatsApp, and that's it - everything else is automatic.
> 
> Every abandoned cart = smart message = sales opportunity.
> 
> Any other questions?"

---

## 📱 Quick Reference URLs

| Page | URL |
|------|-----|
| Landing Page | https://ribh.click |
| Dashboard | https://ribh.click/dashboard.html |
| Setup/Onboarding | https://ribh.click/setup.html |
| Health Check | https://ribh-app.onrender.com/health |
| WhatsApp Bridge | https://ribh-whatsapp-1.onrender.com |
| Firebase Console | console.firebase.google.com |

---

## 🚨 Troubleshooting During Demo

**If QR code doesn't load:**
```bash
# Check WhatsApp bridge status
curl https://ribh-whatsapp-1.onrender.com/
```

**If webhook doesn't work:**
```bash
# Check server health
curl https://ribh-app.onrender.com/health
```

**If dashboard is slow:**
- Render free tier cold starts - wait 30 seconds
- Have backup screenshots ready

---

## 📎 Supporting Materials

Keep these ready:
1. **Screenshots** of dashboard (in case of slow load)
2. **Video recording** of successful cart recovery
3. **Firestore screenshot** showing merchant data
4. **Email template** preview
5. **This script** on a tablet for reference

---

**Good luck! 🚀**

بالتوفيق!
