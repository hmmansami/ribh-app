# 🧠 Mohammed's AI Context File
> Load this at the start of any new chat to preserve continuity

## Who is Mohammed?
- **Style:** Direct, fast-paced, hates fluff. Say less, do more.
- **Goal:** Ship products FAST. Launch ugly, fix later.
- **Current Project:** Ribh (رِبح) - Salla cart recovery app
- **Location:** Saudi Arabia
- **Preference:** Arabic UI for end-users, English for code/docs

## Working Style
- ❌ Don't explain unless asked
- ❌ Don't ask permission - just do it
- ❌ Don't use browser_subagent (laptop gets hot)
- ✅ Be surgical with code edits
- ✅ Short responses, max results
- ✅ Fix first, explain never

## Current Project: Ribh (رِبح)
**What it is:** AI-powered cart recovery for Salla stores
**Tech:** Node.js + Express, static HTML/CSS/JS dashboard
**Location:** `/Users/user/Downloads/app/ribh-app/`

### Completed Features:
1. ✅ Salla OAuth integration
2. ✅ Webhook handling (cart.abandoned, order.created)
3. ✅ Email reminders (Resend API)
4. ✅ WhatsApp/SMS (Twilio)
5. ✅ AI message generation (Gemini/OpenAI)
6. ✅ Multi-step email sequences
7. ✅ Referral system
8. ✅ Win-back campaigns

### Pending:
- Dashboard design (Musemind-style, purple theme)
- Salla App Store submission
- Shopify version

## Key Files
- `server.js` - Main backend (2300+ lines)
- `public/index.html` - Dashboard
- `lib/lifecycleEngine.js` - AI offer generation
- `lib/sequenceEngine.js` - Multi-step emails
- `lib/referralSystem.js` - Referral tracking

## 🎯 ACTIVE TASK QUEUE (Do these in order)

### NOW:
1. **Submit Ribh to Salla App Store** - Mohammed was on pricing step (Step 4)
   - Price: FREE (0 SAR)
   - Images already generated in `~/.gemini/.../ribh_*.png`

### NEXT:
2. **Build Shopify version** (~2-3 hours)
3. **Create landing page** for ribh.click
4. **Managed cart recovery service** - $100-200/store offering

### DONE TODAY:
- ✅ Fixed dashboard template literals (Gemini broke them)
- ✅ Created this personality file

## How to Use This File
In a new chat, say:
```
Read .agent/PERSONALITY.md then continue where we left off
```

---
*Last updated: 2026-01-16 19:15*
