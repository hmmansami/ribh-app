# RIBH - Next Session Execution Plan

## What Was Completed (This Session - 9 Commits)

### Frontend Pages Built
- `/app` - 4-state dashboard (loading → connect → analyzing → analyzed → active)
- `/whatsapp.html` - QR scan page, auto-redirects to /app after connect
- `/settings.html` - Timing, quiet hours, AI toggle, disconnect
- `/customers.html` - Customer list with segment tabs + status dots
- `/pricing.html` - 3 plans (99/249/499 SAR) + FAQ accordion

### Dashboard Features Added
- Campaign toggles (cart recovery, winback, upsell) in State 3 + 4
- WhatsApp message preview bubble with AI attribution
- Message editor modal (bottom sheet, editable template)
- Recovery funnel (carts → sent → opened → purchased)
- Usage meter with progress bar + trial countdown
- AI insights card (send time, rate tips)
- WhatsApp connection status card
- RIBH branding + settings gear
- Loading skeleton
- Footer navigation (customers, pricing, pause)
- All pages cross-linked

### Backend Fixes
- groq-sdk crash fixed (direct HTTP instead of require)
- Salla OAuth credential fallbacks
- /api/merchant/status endpoint
- /api/test/full-flow endpoint
- Analysis caching in Firestore
- Activity feed reads real Firestore data

---

## What Needs To Be Done Next

### PHASE 1: Make It Real (Deploy + Connect)
Priority: CRITICAL - Nothing works until this is done

1. **Merge branch to main and deploy**
   - `git checkout main && git merge claude/restore-execution-speed-8wfjM && git push`
   - Verify deploy: `gh run list --repo hmmansami/ribh-app --limit 1`
   - Test live at https://ribh-484706.web.app/app

2. **Create Salla App in Partners Portal** (MANUAL - only the owner can do this)
   - Go to https://salla.partners
   - Create app with OAuth callback: `https://europe-west1-ribh-484706.cloudfunctions.net/api/oauth/callback`
   - Get Client ID + Secret, set as Firebase env vars:
     ```
     firebase functions:config:set salla.client_id="..." salla.client_secret="..."
     ```
   - Submit for Salla marketplace review

3. **Deploy WhatsApp Bridge to Render/Railway**
   - The Baileys WhatsApp connection needs a persistent server (not Firebase Functions)
   - Deploy `functions/lib/whatsappBridge.js` as a standalone Node service
   - Set WHATSAPP_BRIDGE_URL in Firebase config
   - Tool: Use Render.com free tier or Railway

### PHASE 2: Payment Integration
Priority: HIGH - Can't charge without this

4. **Integrate payment gateway**
   - Options for Saudi: Moyasar, Tap Payments, or HyperPay
   - Moyasar recommended (Saudi-first, supports mada + Visa + Apple Pay)
   - Build: `/api/billing/subscribe` endpoint
   - Build: `/api/billing/webhook` for payment confirmation
   - Update `pricing.html` buttons to call Moyasar checkout
   - Store subscription status in Firestore `merchants/{id}/subscription`

5. **Enforce usage limits**
   - Middleware: check message count before sending
   - Block at limit, show upgrade prompt
   - Update `/api/merchant/status` to return plan + usage data

### PHASE 3: Cold Outreach Engine (The 100K Plan)
Priority: HIGH - This is how you get to 100K SAR

6. **Build personalized store analyzer for cold outreach**
   - Input: Salla store URL from the 50K list
   - Scrape: store name, product count, estimated traffic
   - Calculate: estimated abandoned carts, potential recovery SAR
   - Output: personalized WhatsApp message to store owner
   - Tool: Puppeteer or Cheerio for scraping, batch processing
   - Endpoint: `POST /api/outreach/analyze-store`

7. **Build one-click install landing page**
   - URL: `ribh-484706.web.app/install?store=STORE_NAME`
   - Shows: "يا [store_name]، متجرك يخسر [X] ر.س شهرياً"
   - One button: "ابدأ مجاناً" → Salla OAuth
   - Personalized per store from the cold outreach data

8. **Build outreach sending pipeline**
   - Load 50K store list (CSV/JSON)
   - Batch analyze stores
   - Generate personalized messages
   - Send via WhatsApp Business API (not Baileys - need official for bulk)
   - Track: sent, opened, installed, activated
   - Tool: WhatsApp Business API via 360dialog or Wati

### PHASE 4: Polish & Convert
Priority: MEDIUM - Makes merchants stay and pay

9. **Add real-time notifications**
   - Firebase Cloud Messaging for push notifications
   - "تم استرداد سلة بقيمة 340 ر.س" push to merchant's phone
   - Notification permission prompt in dashboard

10. **Add onboarding tour**
    - First-time merchant sees tooltips on each dashboard section
    - "هذي حملاتك" → "هذا مسار الاسترداد" → "هنا تقدر تعدل الرسالة"
    - Use simple CSS tooltips, no library needed

11. **Add Arabic chatbot support**
    - WhatsApp number for merchant support
    - Or Telegram bot
    - Show in settings and pricing page

12. **Campaign performance detail page**
    - Click any campaign → see per-message stats
    - Which customers opened, which purchased
    - Revenue attributed to each campaign
    - Endpoint exists: `GET /api/campaigns/:id/stats`

13. **A/B test messages**
    - Let merchants test 2 message variants
    - Show which performs better
    - Auto-switch to winner
    - Endpoints exist: `GET /api/ab-tests`, `GET /api/ab/results`

---

## Tools & Methods for Perfect Customer Experience

### What Makes It "One Click"
The entire value prop is: merchant connects store → sees money lost → clicks one button → money starts flowing back. Every screen should have ONE primary action.

### Design System (Already Established)
- Colors: #09090B bg, #18181B cards, #10B981 primary green
- Font: IBM Plex Sans Arabic
- Icons: Lucide
- Layout: Mobile-first 480px, RTL
- Pattern: .card with 14px radius, .btn-primary/.btn-secondary

### Key Metrics to Track (Already in Backend)
- Recovery rate % (purchased / abandoned carts)
- Messages sent vs limit
- Revenue recovered (SAR)
- Open rate, click rate
- Time to recovery (cart abandoned → purchased)

### Backend APIs That Exist But Have No Frontend Yet
These all have working endpoints - just need UI:
- `GET /api/ai/insights` - AI recommendations
- `GET /api/ai/pricing-strategy` - Pricing optimization
- `GET /api/analytics/send-times/:merchantId` - Best send times
- `GET /api/segments/:merchantId` - Customer segments
- `GET /api/customers/:id/predictions` - Predictive analytics
- `POST /api/campaigns/broadcast` - Send to all customers
- `GET /api/loyalty/balance/:merchantId/:customerId` - Loyalty points
- `GET /api/reviews/:merchantId/stats` - Review collection
- `POST /api/upsell/trigger` - Upsell campaigns
- `GET /api/cod/stats/:merchantId` - COD confirmations
- `GET /api/browse/stats/:storeId` - Browse abandonment

### Recommended Execution Order for Next Session
1. Merge to main + deploy (5 min)
2. Test live site end-to-end
3. Fix any issues found
4. Build cold outreach install page
5. Payment integration (Moyasar)
6. Usage enforcement middleware

### Files to Focus On
- `public/app.html` - Main dashboard (1332 lines, 4 states + modal)
- `functions/server.js` - All API routes (~5000 lines)
- `functions/lib/campaignEngine.js` - Campaign automation
- `functions/lib/whatsappBridge.js` - WhatsApp connection
- `functions/routes/salla.js` - Salla OAuth + webhooks
- `public/settings.html` - Settings page
- `public/customers.html` - Customer list
- `public/pricing.html` - Plan comparison

### Branch
All work is on: `claude/restore-execution-speed-8wfjM`
9 commits, ready to merge to main.
