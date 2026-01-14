# TASK 1: Dashboard Redesign (Apple-style)

## 🎯 Objective
Redesign the main dashboard (`public/index.html`) to be simple, clean, Apple-style. Remove broken buttons. Make it work.

## 📁 File to Edit
`/Users/user/Downloads/app/ribh-app/public/index.html`

## ⚠️ Before Starting
1. Mark this task as 🔄 in `COORDINATOR.md`
2. Do NOT edit `server.js` - another agent handles that

---

## Current Problems

1. ❌ Too many stats cards (overwhelming)
2. ❌ Buttons don't work (test, refresh, etc.)
3. ❌ Dark theme (should be light/Apple-style)
4. ❌ Table shows fake data
5. ❌ Navigation links broken

---

## Required Changes

### 1. Theme Change (Dark → Light)
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

### 2. Simplify Layout
Remove:
- Chart (too complex for now)
- Activity feed
- Multiple nav sections
- Test button
- Refresh button (make auto)

Keep:
- Header with logo
- 3 stat cards (Revenue, Carts, Recovery Rate)
- Cart table with actions
- WhatsApp & Email buttons (these work!)

### 3. Simple Structure
```
┌─────────────────────────────────────────┐
│ 💰 رِبح           [اسم المتجر]         │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ 45,230  │  │   23    │  │  32%    │ │
│  │ ر.س     │  │ سلة     │  │ استرداد │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
│  السلات المتروكة                        │
│  ┌─────────────────────────────────────┐│
│  │ محمد - 1,250 ر.س    [📧] [💬]     ││
│  │ سارة - 2,100 ر.س    [✅ تم]       ││
│  │ عبدالله - 450 ر.س   [📧] [💬]     ││
│  └─────────────────────────────────────┘│
│                                         │
│  [إعدادات] [تيليجرام]                  │
└─────────────────────────────────────────┘
```

### 4. Working Buttons Only
- ✅ Email button → sendEmail() function exists
- ✅ WhatsApp button → sendWhatsApp() function exists
- ❌ Remove all other non-working buttons

### 5. Load Real Data
The API exists:
- GET `/api/carts` - Returns cart list
- GET `/api/stats` - Returns stats

Use these to populate the dashboard.

---

## Code Hints

### Fetch Carts:
```javascript
async function loadCarts() {
    const res = await fetch('/api/carts');
    const carts = await res.json();
    // Populate table
}
```

### Generate WhatsApp Link:
```javascript
function sendWhatsApp(phone, name, cartValue, checkoutUrl) {
    const message = `مرحباً ${name}! سلتك (${cartValue} ر.س) في انتظارك...`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`);
}
```

---

## Testing

1. Run locally: `cd ribh-app && npm start`
2. Open: http://localhost:3000
3. Check all buttons work
4. Check data loads

---

## When Done

1. Commit: `git add . && git commit -m "Apple-style dashboard redesign"`
2. Push: `git push origin main`
3. Update COORDINATOR.md: Change 🔄 to ✅
4. Test live: https://ribh.click

---

## Status: ⏳ Available

Pick this up by changing status to 🔄
