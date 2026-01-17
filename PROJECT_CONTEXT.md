# 🚀 RIBH - Abandoned Cart Recovery for Salla

**Last Updated:** 2026-01-17
**Status:** Active Development

---

## Quick Summary
Ribh is an abandoned cart recovery app for Salla e-commerce stores in Saudi Arabia. It sends smart reminders via Email, WhatsApp, and Telegram to recover lost sales. Built with Node.js backend, deployed on Render.

## Tech Stack
- **Backend:** Node.js + Express (server.js)
- **Frontend:** HTML/CSS/JS (public folder)
- **Database:** JSON files (data folder)
- **Hosting:** Render (ribh.click)
- **Email:** Resend API
- **WhatsApp:** Twilio API
- **Telegram:** Telegram Bot API
- **E-commerce:** Salla Webhooks

## Current State

### ✅ Completed:
- Salla webhook integration (cart.abandoned, order.created)
- Dashboard with Apple-style theme
- Email sending via Resend
- Basic store settings page
- Telegram page setup

### 🔄 In Progress:
- WhatsApp integration (Twilio)
- Store authentication system
- AI-powered message generation

### ⏳ Next Up:
- Multi-store support
- Analytics dashboard
- Automated campaign scheduling

## Key Files
```
/server.js          - Main backend (webhooks, API endpoints)
/public/index.html  - Dashboard
/public/settings.html - Store settings
/public/telegram.html - Telegram setup
/data/              - JSON data storage
/.env               - API keys (Resend, Twilio, Telegram)
```

## Commands
```bash
# Start dev server
npm run dev

# Or directly
node server.js

# Deploy: Push to main, Render auto-deploys
git add . && git commit -m "update" && git push
```

## Live URLs
- Dashboard: https://ribh.click
- Webhook: https://ribh.click/webhooks/salla

## Test Store
- Store: Bemooo (Salla)
- Test flow: Create cart → Abandon → Check dashboard → Verify email sent

## Known Issues
- Twilio WhatsApp needs business verification
- Telegram widget needs domain whitelist

---

## 💡 For New Agents
Read this file first! Then check `server.js` for backend logic and `/public/` for frontend files. The app receives webhooks from Salla when carts are abandoned and sends recovery messages.
