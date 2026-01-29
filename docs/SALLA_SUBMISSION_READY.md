# 📋 SALLA APP SUBMISSION - COPY-PASTE READY

> **Last Updated:** January 29, 2026  
> **Status:** Ready for Submission  
> **Classification:** Communication (مراسلات)  
> **Linking Method:** API-only (Not Make/Zapier)

---

## 🔑 APP CREDENTIALS

| Field | Value |
|-------|-------|
| **Client ID** | `476e7ed1-796c-4731-b145-73a13d0019de` |
| **Client Secret** | Check `.env` file or Salla Partners Portal |

---

## 📝 APP STORE LISTING

### Arabic App Name
```
ربح - استرداد السلات المتروكة
```

### Arabic Short Name (if required)
```
ربح
```

### Arabic Description (الوصف بالعربية)
```
استرد سلاتك المتروكة تلقائياً عبر واتساب! 🛒💬

ربح هو تطبيق ذكي يساعدك على استرداد العملاء الذين تركوا سلاتهم قبل إتمام الشراء. نستخدم الذكاء الاصطناعي لإرسال رسائل مخصصة في الوقت المناسب.

✅ كيف يعمل؟
1. عميل يضيف منتجات للسلة
2. يغادر بدون إتمام الشراء  
3. ربح يرسل رسالة ذكية عبر واتساب
4. العميل يرجع ويكمل طلبه!

💡 لماذا ربح؟
• واتساب = 98% نسبة فتح (مقارنة بـ 20% للإيميل)
• رسائل ذكية مخصصة لكل عميل
• عروض وخصومات تلقائية للسلات الكبيرة
• خيار التقسيط لتسهيل الشراء
• لوحة تحكم شاملة بالعربي

📊 النتائج المتوقعة:
• استرداد 15-30% من السلات المتروكة
• زيادة المبيعات بشكل ملحوظ
• عائد استثمار واضح من أول أسبوع

🔒 آمن ومتوافق:
• نستخدم بياناتك فقط لاسترداد السلات
• لا نشارك معلوماتك مع أي طرف ثالث
• متوافق مع سياسات سلة وواتساب

جرب ربح الآن واسترد مبيعاتك الضائعة! 💚
```

### English App Name
```
RIBH - Abandoned Cart Recovery
```

### English Description
```
Automatically recover abandoned carts via WhatsApp! 🛒💬

RIBH is a smart app that helps you recover customers who left their carts before completing their purchase. We use AI to send personalized messages at the right time.

✅ How it works:
1. Customer adds products to cart
2. They leave without completing purchase
3. RIBH sends a smart WhatsApp message
4. Customer returns and completes their order!

💡 Why RIBH?
• WhatsApp = 98% open rate (vs 20% for email)
• AI-powered personalized messages
• Automatic offers for high-value carts
• Installment payment options
• Full Arabic dashboard

📊 Expected Results:
• Recover 15-30% of abandoned carts
• Significant sales increase
• Clear ROI from the first week

🔒 Secure & Compliant:
• We only use your data for cart recovery
• No third-party data sharing
• Compliant with Salla and WhatsApp policies

Try RIBH now and recover your lost sales! 💚
```

---

## ⭐ FEATURES LIST (المميزات)

### Copy-paste for Salla portal:

```
✅ استرداد السلات تلقائياً عبر واتساب
✅ رسائل ذكية بالذكاء الاصطناعي
✅ عروض وخصومات تلقائية
✅ خيار التقسيط (ادفع 25% فقط)
✅ لوحة تحكم عربية شاملة
✅ تقارير وإحصائيات مفصلة
✅ دعم فني بالعربي
✅ تكامل سريع مع متجرك
```

### Feature bullets (English):
```
✅ Automatic WhatsApp cart recovery
✅ AI-powered personalized messages
✅ Smart discount offers
✅ Installment payment option (25% down)
✅ Full Arabic dashboard
✅ Detailed analytics & reports
✅ Arabic support team
✅ Quick store integration
```

---

## 🔐 OAUTH CONFIGURATION

### Callback URL (Redirect URI)
```
https://ribh.click/oauth/callback
```

### App URL (Entry Point)
```
https://ribh.click/app?merchant={{merchant.id}}
```

### Alternative Setup URL (if needed)
```
https://ribh.click/setup?merchant={{merchant.id}}
```

---

## 📜 REQUIRED SCOPES (الصلاحيات)

| Scope | Arabic Name | Justification (English) | تبرير الصلاحية (عربي) |
|-------|-------------|------------------------|----------------------|
| `carts.read` | قراءة السلات | Access abandoned cart data to trigger recovery messages | للوصول لبيانات السلات المتروكة وإرسال رسائل الاسترداد |
| `customers.read` | قراءة العملاء | Get customer name, phone, email for personalized messages | للحصول على اسم العميل وبياناته لتخصيص الرسائل |
| `orders.read` | قراءة الطلبات | Track if cart was recovered (order created) to stop messages | لمتابعة إتمام الطلب وإيقاف رسائل الاسترداد |
| `webhooks.read_write` | الأحداث | Receive real-time abandoned cart notifications | لاستقبال إشعارات السلات المتروكة فوراً |
| `offline_access` | الوصول المستمر | Maintain connection without requiring re-authorization | للحفاظ على الاتصال دون إعادة التفويض |

### Scope string for portal:
```
carts.read customers.read orders.read webhooks.read_write offline_access
```

---

## 💰 PRICING RECOMMENDATION

### Option A: Simple Monthly (Recommended for Launch)
```
SAR 99/month - الباقة الأساسية
```

### Option B: Tiered Pricing
| Tier | Price | Features |
|------|-------|----------|
| **أساسي** | SAR 99/شهر | حتى 100 سلة متروكة |
| **متقدم** | SAR 149/شهر | حتى 500 سلة متروكة |
| **احترافي** | SAR 299/شهر | سلات غير محدودة |

### Option C: Hybrid (Future)
```
SAR 99/month base + 5% of recovered cart value
```

### Free Trial
```
7 أيام تجربة مجانية
7-day free trial
```

### Pricing Justification:
```
السعر يغطي تكاليف:
• البنية التحتية السحابية
• خدمات الذكاء الاصطناعي
• دعم فني باللغة العربية
• تحديثات مستمرة

القيمة للتاجر:
• استرداد سلة واحدة = أكثر من رسوم الشهر
• متوسط استرداد 15-30% من السلات
• عائد استثمار خلال أول أسبوع
```

---

## 🔔 WEBHOOK EVENTS NEEDED

| Event | Purpose |
|-------|---------|
| `app.store.authorize` | Receive access tokens |
| `app.installed` | Track new installations |
| `app.uninstalled` | Clean up on uninstall |
| `abandoned.cart` | **Trigger cart recovery** |
| `order.created` | Stop recovery if order placed |
| `customer.created` | Welcome new customers |

### Webhook URL
```
https://ribh.click/webhooks/salla
```

---

## 🏷️ APP CLASSIFICATION

**Category:** Communication (مراسلات)  
**NOT:** E-commerce Integration / Inventory / Analytics

**Why Communication?**
- Primary function is messaging customers
- WhatsApp-based communication
- Similar to SMS/Email marketing apps

---

## 🔗 APP LINKING METHOD

**Method:** API Only (تكامل مباشر)  
**NOT:** Make/Zapier integration

**Why API-only?**
- Direct OAuth integration
- Real-time webhook processing
- No third-party dependencies
- Better performance and reliability

---

## 📸 SCREENSHOTS NEEDED

> ⚠️ **Hmman: Take these screenshots from the live app**

### Required Screenshots:
1. **لوحة التحكم الرئيسية** - Main dashboard showing stats
2. **إعداد واتساب** - WhatsApp QR code setup page
3. **قائمة السلات** - List of abandoned carts
4. **تفاصيل رسالة** - Message preview/template
5. **الإحصائيات** - Analytics/reports page

### Screenshot Guidelines:
- Arabic UI preferred
- Show real or realistic data
- Mobile and desktop views if possible
- Recommended size: 1280x800 or 2560x1600

---

## ⚠️ TECHNICAL NOTES

### URL Routing
Firebase Hosting rewrites these paths to Cloud Functions:
- `/oauth/**` → api function ✅
- `/app` → api function ✅
- `/webhooks/**` → api function ✅ (added)
- `/api/**` → api function ✅

### Callback URL Note
The OAuth callback in server.js uses the direct Firebase URL:
```
https://europe-west1-ribh-484706.cloudfunctions.net/api/oauth/callback
```

For Salla portal, you can use either:
- `https://ribh.click/oauth/callback` (via Firebase Hosting rewrite)
- `https://europe-west1-ribh-484706.cloudfunctions.net/api/oauth/callback` (direct)

**Recommendation:** Use `ribh.click` for cleaner branding.

### Webhook Endpoint
Both work (thanks to Firebase rewrites):
- `https://ribh.click/webhooks/salla`
- `https://ribh.click/api/webhooks/salla`

---

## 📋 SUBMISSION CHECKLIST

### Before Submitting:
- [ ] App classification set to **Communication**
- [ ] Linking method set to **API-only**
- [ ] All OAuth URLs verified working
- [ ] All required scopes listed
- [ ] Arabic name and description ready
- [ ] English name and description ready
- [ ] Features list complete
- [ ] Pricing tier selected
- [ ] Free trial period set (7 days)
- [ ] Webhook URL configured and tested

### Technical Verification:
- [ ] OAuth callback works: `https://ribh.click/oauth/callback`
- [ ] App URL works: `https://ribh.click/app?merchant=TEST`
- [ ] Webhook endpoint responds: `https://ribh.click/webhooks/salla`
- [ ] Token refresh mechanism tested
- [ ] Abandoned cart webhook processed correctly

### Assets Ready:
- [ ] App icon (512x512 PNG)
- [ ] Screenshots (min 3)
- [ ] Demo video (optional but recommended)

---

## 🚀 POST-SUBMISSION

### After Approval:
1. Monitor first installations closely
2. Check webhook delivery in Salla Partners Portal
3. Verify welcome messages are sent
4. Test full cart recovery flow with real merchant
5. Respond quickly to any support requests

### Support Contact for App Store:
```
Email: support@ribh.click
WhatsApp: +966 579 353 338
```

---

## 📞 SALLA SUPPORT CONTACTS

| Need | Contact |
|------|---------|
| Partners Portal | https://salla.partners |
| Developer Support | support@salla.dev |
| Developer Telegram | https://t.me/salladev |
| API Status | https://status.salla.sa |

---

## 🎯 QUICK REFERENCE

```
App Name (AR):  ربح - استرداد السلات المتروكة
App Name (EN):  RIBH - Abandoned Cart Recovery
Category:       Communication (مراسلات)
Linking:        API-only
Client ID:      476e7ed1-796c-4731-b145-73a13d0019de
Callback:       https://ribh.click/oauth/callback
App URL:        https://ribh.click/app?merchant={{merchant.id}}
Webhook:        https://ribh.click/webhooks/salla
Scopes:         carts.read customers.read orders.read webhooks.read_write offline_access
Price:          SAR 99/month (7-day trial)
```

---

*Ready for submission! 🚀*
