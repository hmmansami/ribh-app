# 🚀 RIBH Deployment Guide

**Zero Cost. One Click. Ship It.**

---

## 📊 Architecture Overview

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Render (Free)  │     │  Firebase (Free)     │     │  Firebase       │
│  WhatsApp       │◄────│  Cloud Functions     │◄────│  Hosting        │
│  Bridge         │     │  + Firestore         │     │  Dashboard      │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

---

## 1️⃣ WhatsApp Bridge → Render (FREE)

**Location:** `/home/ubuntu/clawd/ribh-whatsapp`

### Pre-flight Check ✅
- [x] `package.json` with start script
- [x] `render.yaml` with configuration  
- [x] API Key: `ribh-secret-2026`
- [x] GitHub repo: https://github.com/hmmansami/ribh-whatsapp

### Deploy Steps

#### Option A: Render Dashboard (Recommended)
1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub: `hmmansami/ribh-whatsapp`
4. Settings will auto-detect from `render.yaml`:
   - **Name:** ribh-whatsapp
   - **Runtime:** Node
   - **Plan:** Free
   - **Build:** `npm install`
   - **Start:** `npm start`
5. Environment variables (already in render.yaml):
   ```
   API_KEY=ribh-secret-2026
   NODE_ENV=production
   ```
6. Click **"Create Web Service"**

#### Option B: Blueprint Deploy (One-Click)
1. Push code to GitHub first:
   ```bash
   cd /home/ubuntu/clawd/ribh-whatsapp
   git add -A
   git commit -m "Deploy ready"
   git push origin main
   ```
2. Go to: https://dashboard.render.com/select-repo?type=blueprint
3. Select `ribh-whatsapp` repo
4. Render reads `render.yaml` automatically

### After Deploy
Your WhatsApp Bridge URL will be:
```
https://ribh-whatsapp.onrender.com
```

**Test it:**
```bash
curl https://ribh-whatsapp.onrender.com/health
```

---

## 2️⃣ Firebase Functions + Hosting

**Location:** `/home/ubuntu/clawd/ribh-app`

### Pre-flight Check ✅
- [x] `firebase.json` configured
- [x] `.firebaserc` → Project: `ribh-484706`
- [x] Functions Node 20
- [x] Firebase CLI: v15.4.0

### First Time Setup (One-Time)

```bash
# Login to Firebase (opens browser)
firebase login

# Verify project
cd /home/ubuntu/clawd/ribh-app
firebase projects:list
```

### Deploy Everything (Functions + Hosting)

```bash
cd /home/ubuntu/clawd/ribh-app

# Install function dependencies
cd functions && npm install && cd ..

# Deploy EVERYTHING
firebase deploy
```

Or deploy separately:
```bash
# Functions only
firebase deploy --only functions

# Hosting (dashboard) only  
firebase deploy --only hosting
```

### After Deploy
- **Dashboard:** https://ribh-484706.web.app
- **API:** https://us-central1-ribh-484706.cloudfunctions.net/api

**Test it:**
```bash
curl https://us-central1-ribh-484706.cloudfunctions.net/api/health
```

---

## 3️⃣ Environment Variables Summary

### Render (WhatsApp Bridge)
| Variable | Value | Required |
|----------|-------|----------|
| `API_KEY` | `ribh-secret-2026` | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `PORT` | auto (Render sets) | auto |

### Firebase Functions
Set via Firebase Console or CLI:
```bash
firebase functions:config:set api.key="ribh-secret-2026"
```

Or use `.env` file in `/functions/.env` (already configured):
| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | AI offer generation |
| `RESEND_API_KEY` | Email (optional) |
| `EMAIL_FROM` | Sender email |
| `ENABLE_*` | Feature toggles |

---

## 4️⃣ Post-Deploy: Connect the Dots

Update the WhatsApp bridge URL in Firebase Functions:

```bash
# In ribh-app/functions/.env or Firebase config
WHATSAPP_BRIDGE_URL=https://ribh-whatsapp.onrender.com
WHATSAPP_API_KEY=ribh-secret-2026
```

Then redeploy functions:
```bash
cd /home/ubuntu/clawd/ribh-app
firebase deploy --only functions
```

---

## 🔄 Quick Redeploy Commands

### WhatsApp Bridge (Render)
```bash
cd /home/ubuntu/clawd/ribh-whatsapp
git add -A && git commit -m "Update" && git push
# Render auto-deploys from GitHub
```

### Firebase (Functions + Dashboard)
```bash
cd /home/ubuntu/clawd/ribh-app
firebase deploy
```

---

## 🆓 Cost Breakdown

| Service | Tier | Limit | Cost |
|---------|------|-------|------|
| Render | Free | 750 hrs/month, sleeps after 15min idle | $0 |
| Firebase Hosting | Spark | 10GB storage, 360MB/day transfer | $0 |
| Firebase Functions | Spark | 2M invocations/month | $0 |
| Firestore | Spark | 1GB storage, 50K reads/day | $0 |

**Total: $0/month** 🎉

---

## ⚠️ Render Free Tier Notes

- Service sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds (cold start)
- WhatsApp sessions may disconnect during sleep
- Solution: The keep-alive scheduler in Firebase pings every 5 minutes

---

## 🆘 Troubleshooting

### "Firebase login required"
```bash
firebase login
```

### "Permission denied" on deploy
```bash
firebase login --reauth
```

### Render deploy fails
- Check build logs in Render dashboard
- Verify `package.json` has valid `start` script
- Check Node version compatibility

### WhatsApp disconnects
- Normal on free tier (service sleeps)
- User needs to re-scan QR code
- Consider paid tier for 24/7 uptime

---

## 🚀 One-Liner Full Deploy

```bash
# Push all repos and deploy Firebase
cd /home/ubuntu/clawd/ribh-whatsapp && git add -A && git commit -m "deploy" && git push; \
cd /home/ubuntu/clawd/ribh-app && git add -A && git commit -m "deploy" && git push && firebase deploy
```

---

**Created:** 2025-01-26
**Status:** Ready to ship! 🚢

---

## 📋 Current Status

| Component | Status | Next Step |
|-----------|--------|-----------|
| WhatsApp Bridge (GitHub) | ✅ Pushed | Connect Render |
| Firebase Functions (GitHub) | ✅ Pushed | Login + Deploy |
| Dashboard (GitHub) | ✅ Pushed | Login + Deploy |

### To Complete Deployment:

**1. Render (WhatsApp Bridge):**
- Go to https://dashboard.render.com
- Click "New +" → "Web Service"
- Connect to `hmmansami/ribh-whatsapp`
- Deploy! (auto-reads render.yaml)

**2. Firebase (needs human login):**
```bash
cd /home/ubuntu/clawd/ribh-app
firebase login
firebase deploy
```

Both repos are pushed and ready. Just needs the final button clicks! 🎯
