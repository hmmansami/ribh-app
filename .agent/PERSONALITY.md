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

## ⚡ TOKEN SAVING RULES (CRITICAL - FOLLOW ALWAYS)

### 1. Be Surgical
- ONE task per prompt
- Specific file + line ranges (never read full files)
- Example: "In server.js lines 100-150, fix the cart endpoint"

### 2. Output to Files, Not Chat
- Write long responses to `.agent/status/` files
- Keep chat clean and minimal
- Example: "Write findings to .agent/status/research.txt"

### 3. File Ranges ALWAYS
- ❌ BAD: "Read server.js"
- ✅ GOOD: "Read server.js lines 50-100"
- server.js sections: auth(1-200), webhooks(200-500), api(500-1000)

### 4. No Repeated Context
- This file IS the context
- Don't re-explain project history
- Just say "per PERSONALITY.md" if referencing known info

### 5. Checkpoint Often
- After 3-4 exchanges, ask: "Should we start fresh chat?"
- Use status files to carry context between chats

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
9. ✅ Premium dashboard (dark mode, glassmorphism)

### Pending:
- Salla App Store submission
- Shopify version
- Landing page for ribh.click

## Key Files (with line ranges)
- `server.js` - Main backend (2600 lines)
  - Lines 1-200: Auth & middleware
  - Lines 200-500: Webhook handlers
  - Lines 500-1000: API endpoints
  - Lines 1000-1500: Email/notification logic
  - Lines 1500+: Utility functions
- `public/index.html` - Dashboard
- `lib/lifecycleEngine.js` - AI offer generation
- `lib/sequenceEngine.js` - Multi-step emails
- `lib/referralSystem.js` - Referral tracking

## 🎯 ACTIVE TASK QUEUE

### NOW:
1. **Submit Ribh to Salla App Store** - pricing step (FREE)

### NEXT:
2. **Build Shopify version** (~2-3 hours)
3. **Create landing page** for ribh.click
4. **Managed cart recovery service** - $100-200/store offering

## How to Use This File
```
Read .agent/PERSONALITY.md
Task: [your specific task here]
```

---
*Last updated: 2026-01-17*
