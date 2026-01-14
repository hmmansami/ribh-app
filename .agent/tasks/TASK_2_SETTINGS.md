# TASK 2: Settings & Telegram Pages Theme

## 🎯 Objective
Update `settings.html` and `telegram.html` to match the new Apple-style theme.

## 📁 Files to Edit
- `/Users/user/Downloads/app/ribh-app/public/settings.html`
- `/Users/user/Downloads/app/ribh-app/public/telegram.html`

## ⚠️ Before Starting
1. Mark this task as 🔄 in `COORDINATOR.md`
2. Do NOT edit `index.html` or `server.js`

---

## Design Requirements

### Color Palette (Same as Dashboard):
```css
:root {
    --bg: #FFFFFF;
    --bg-secondary: #F5F5F7;
    --text: #1D1D1F;
    --text-secondary: #86868B;
    --primary: #10B981;
    --border: #D2D2D7;
}
```

### Font:
```css
font-family: 'IBM Plex Sans Arabic', -apple-system, sans-serif;
```

---

## Settings Page Requirements

### Current Structure (Keep):
- Store settings form
- Channel toggles (Email, Telegram, SMS, WhatsApp)
- Save button

### Changes Needed:
1. Light background (white)
2. Clean form styling
3. Simple card layout
4. Working save button (already has API)
5. Back to dashboard link

### Simple Layout:
```
┌─────────────────────────────────────────┐
│ ← رجوع    إعدادات المتجر                │
├─────────────────────────────────────────┤
│                                         │
│  اسم المتجر: [_______________]          │
│  البريد الإلكتروني: [___________]       │
│                                         │
│  القنوات المفعلة:                       │
│  [✓] البريد الإلكتروني                  │
│  [✓] تيليجرام                           │
│  [ ] SMS                                │
│  [ ] واتساب                             │
│                                         │
│           [💾 حفظ الإعدادات]            │
└─────────────────────────────────────────┘
```

---

## Telegram Page Requirements

### Current Structure:
- Telegram subscription widget
- Success message

### Changes Needed:
1. Light theme
2. Clean styling
3. Make sure Telegram widget loads
4. Clear success/error states

### Simple Layout:
```
┌─────────────────────────────────────────┐
│     📱 اشترك في إشعارات تيليجرام        │
├─────────────────────────────────────────┤
│                                         │
│         [Telegram Login Widget]         │
│                                         │
│     ستصلك الإشعارات على تيليجرام       │
│                                         │
└─────────────────────────────────────────┘
```

---

## Testing

1. Run locally: `cd ribh-app && npm start`
2. Check: http://localhost:3000/settings.html
3. Check: http://localhost:3000/telegram.html
4. Verify forms work
5. Verify links work

---

## When Done

1. Commit: `git add . && git commit -m "Apple-style settings and telegram pages"`
2. Push: `git push origin main`
3. Update COORDINATOR.md: Change 🔄 to ✅

---

## Status: ✅ Complete
