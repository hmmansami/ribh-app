# RIBH MVP EXECUTION - GET MONEY FLOWING

> **Goal**: Store connects → Cart abandoned → Customer gets message → Customer buys → Money in our account
> **Deadline**: TODAY

---

## 🎯 THE ONLY THINGS THAT MATTER

### Money Equation
```
REVENUE = (Stores) × (Abandoned Carts) × (Recovery %) × (AOV) × (5% fee)
```

To make money:
1. Get stores to install
2. Abandoned carts trigger webhook
3. Messages get sent
4. Customers buy
5. We take 5%

---

## ✅ WHAT'S ALREADY BUILT & WORKING

| Component | Status | Code Location |
|-----------|--------|---------------|
| Salla OAuth | ✅ Working | `server.js:527-624` |
| Webhook endpoint | ✅ Live | `server.js:821-823` |
| Cart abandoned handler | ✅ Built | `server.js:986-1016` |
| Email sending (Resend) | ✅ Built | `server.js:1600-1629` |
| AI message generation | ✅ Built | `server.js:432-522` |
| Dashboard | ✅ Built | `public/index.html` |

---

## ❌ WHAT WE DON'T KNOW (AND MUST TEST TODAY)

### Test 1: Does a REAL Salla webhook fire?
- [ ] Install app on a real Salla store
- [ ] Abandon a cart
- [ ] Check Firebase logs for webhook

### Test 2: Does email actually arrive?
- [ ] Manually trigger email to real email
- [ ] Check inbox (and spam folder)
- [ ] Click the checkout link

### Test 3: Does checkout URL work?
- [ ] Customer clicks link
- [ ] They land on actual checkout page
- [ ] They can complete purchase

---

## 🚀 EXECUTION STEPS (IN ORDER)

### Step 1: Verify Salla Integration (30 min)
```bash
# Check if any stores are installed
curl https://ribh.click/api/admin/stores
```

If no stores:
1. Go to Salla Partner dashboard
2. Install app on test store
3. Verify webhook received

### Step 2: Test Full Cart Recovery Flow (30 min)
1. Add product to cart on test store
2. Abandon the cart
3. Wait for webhook to fire
4. Check if email was sent
5. Click link in email
6. Complete purchase

### Step 3: Verify Revenue Tracking (15 min)
1. Check if order.created webhook fired
2. Check if cart was marked "recovered"
3. Calculate revenue recovered

---

## 🔥 DELETE LIST (Apply The Algorithm)

### HTML Pages to DELETE/IGNORE (wasted hours):
- `landing-v2.html` - Not needed for MVP
- `activate.html` - Not needed for MVP
- `analytics.html` - Can wait
- `faq.html` - Can wait
- `messages.html` - Can wait after MVP
- `preview.html` - Can wait
- `referrals.html` - We need USERS first
- `telegram.html` - Email works, this can wait
- `welcome.html` - Nice to have

### Keep ONLY:
- `login.html` - Entry point
- `index.html` - Dashboard (simplified)
- `settings.html` - Store settings

### Lib modules to IGNORE for now:
- `abTesting.js` - Automate LAST
- `analytics.js` - Nice to have
- `discountCodes.js` - Hardcode 10% for now
- `lifecycleEngine.js` - Premature
- `offerGenerator.js` - AI handles it
- `referralSystem.js` - Need users first
- `sequenceEngine.js` - Email #1 is enough for MVP

### Keep ACTIVE:
- `aiMessenger.js` - Generate messages
- `emailSender.js` - Send emails

---

## 📊 SUCCESS METRICS (30 Day Goal)

| Metric | Target |
|--------|--------|
| Stores installed | 10 |
| Carts recovered | 100 |
| Revenue recovered | 50,000 SAR |
| RIBH revenue (5%) | 2,500 SAR |

---

## 🧠 FIRST PRINCIPLES TOOLS WE BUILD

### Tool 1: Attraction Offers (More Buyers)
- Welcome emails to new visitors
- Lead magnets (discount for email)
- **Salla hook**: customer.created

### Tool 2: Upsell Offers (Higher Prices)
- Post-purchase upsells
- Bundle suggestions
- **Salla hook**: order.created

### Tool 3: Cart Recovery (More Conversions)
- Abandoned cart emails ← **THIS IS MVP**
- SMS/WhatsApp backup
- **Salla hook**: cart.abandoned

### Tool 4: Continuity Offers (More Times)
- Subscription offers
- Reorder reminders
- **Salla hook**: order.completed + time

### Tool 5: Reactivation (Win Back)
- "We miss you" campaigns
- Comeback discounts
- **Salla hook**: customer inactivity (cron)

---

## 🎯 TODAY'S FOCUS

**ONE THING**: Test the full flow with a real Salla store

If cart abandoned → email sent → customer buys = WE WIN

Everything else is optimization that comes AFTER we prove the core works.

---

*Last updated: 2024-01-20*
*Status: EXECUTE NOW*
