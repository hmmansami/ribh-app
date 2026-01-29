# ☀️ Morning Checklist - Salla Meeting Day

**Date:** 2026-01-28
**Meeting:** Salla Pre-Launch Review

---

## 🔥 Quick Status

| Item | Status |
|------|--------|
| OAuth Easy Mode | ✅ Confirmed |
| Client Secret | ✅ Fixed & deployed |
| Welcome Email | ✅ Added |
| E2E Tests | ✅ 4/4 passing |
| Demo Script | ✅ Ready (`DEMO_SCRIPT.md`) |

---

## ☑️ Before Meeting (15 mins)

### 1. Verify Services Running
```bash
# Check RIBH app
curl https://ribh-app.onrender.com/health

# Check WhatsApp bridge
curl https://ribh-whatsapp-1.onrender.com/
```

### 2. Have These Open
- [ ] Salla Partners Portal (logged in)
- [ ] RIBH Dashboard: https://ribh-app.onrender.com
- [ ] WhatsApp on your phone
- [ ] This demo script: `DEMO_SCRIPT.md`

### 3. Test Store Ready?
- [ ] Do you have a test Salla store?
- [ ] If not, create one at salla.sa (takes 2 min)

---

## 📱 During Meeting

1. **Show OAuth install flow** — click install → lands on dashboard
2. **Show Firestore** — tokens stored correctly
3. **Show welcome email** — (mention it sends automatically)
4. **Connect WhatsApp** — scan QR live
5. **Trigger test webhook** — show message flow

---

## 🆘 If Something Breaks

**App not responding?**
```
Render might be cold starting. Wait 30-60 seconds.
```

**OAuth failing?**
```
Check client secret matches:
ca8e6de4265c8faa553c8ac45af0acb6306de00a388bf4e06027e4229944f5fe
```

**WhatsApp QR not showing?**
```
Sessions expire. Reset it:
1. POST https://ribh-whatsapp-1.onrender.com/logout/demo
2. Then visit: https://ribh-whatsapp-1.onrender.com/qr/demo
3. Wait 5-10 seconds for QR to generate

Or use a fresh storeId (e.g., /qr/meeting-demo)
```

---

## 🎯 Goal

Get them to say: **"Approved for App Store"**

You got this! 💪🚀
