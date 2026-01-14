# TASK 3: Store Authentication System

## 🎯 Objective
Create a simple authentication system so store owners see THEIR data, not test data.

## 📁 Files to Edit
- `/Users/user/Downloads/app/ribh-app/server.js` (auth section only)
- Create: `/Users/user/Downloads/app/ribh-app/public/login.html`

## ⚠️ Before Starting
1. Mark this task as 🔄 in `COORDINATOR.md`
2. Do NOT edit dashboard UI - another agent handles that
3. Only add auth endpoints and login page

---

## How Auth Should Work

### Flow:
```
1. Store installs app via Salla
2. Salla sends webhook → We save store + generate token
3. Store owner gets unique URL: ribh.click/?token=abc123
4. We verify token → Show their dashboard

OR

1. Store owner visits ribh.click/login
2. Enters their store ID or email
3. We send magic link via email
4. They click → Logged in
```

### Simplest Approach (Token-based):
When store installs, we:
1. Generate unique token
2. Save: `{ storeId: 'abc', token: 'xyz123', email: 'owner@store.com' }`
3. Show them: "Your dashboard URL: ribh.click/?token=xyz123"

---

## Implementation

### 1. Update stores.json structure:
```javascript
{
    "merchant": "store-id",
    "token": "unique-secret-token",
    "email": "owner@email.com",
    "installedAt": "2026-01-15",
    "active": true
}
```

### 2. Generate token on install:
```javascript
const crypto = require('crypto');

function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

// In OAuth callback or app.installed webhook:
const token = generateToken();
stores.push({
    merchant,
    token,
    email: storeEmail,
    installedAt: new Date().toISOString()
});
```

### 3. Verify token middleware:
```javascript
// Add to server.js
function verifyStoreToken(req, res, next) {
    const token = req.query.token || req.cookies?.storeToken;
    
    if (!token) {
        return res.redirect('/login.html');
    }
    
    const stores = readDB(STORES_FILE);
    const store = stores.find(s => s.token === token);
    
    if (!store) {
        return res.redirect('/login.html?error=invalid');
    }
    
    req.store = store;
    next();
}
```

### 4. Create login page:
Simple page that:
- Shows "Enter your store email"
- Lookup store, send magic link
- OR just show token input

### 5. Filter data by store:
```javascript
app.get('/api/carts', verifyStoreToken, (req, res) => {
    const carts = readDB(DB_FILE);
    const storeCarts = carts.filter(c => c.merchant === req.store.merchant);
    res.json(storeCarts);
});
```

---

## Endpoints to Add

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/login.html` | GET | Login page |
| `/api/auth/verify` | GET | Verify token |
| `/api/auth/send-link` | POST | Send magic login link |

---

## Testing

1. Create test store in stores.json with token
2. Visit: http://localhost:3000/?token=YOUR_TOKEN
3. Should show filtered data
4. Invalid token → Redirect to login

---

## When Done

1. Commit: `git add . && git commit -m "Add store authentication system"`
2. Push: `git push origin main`
3. Update COORDINATOR.md: Change 🔄 to ✅

---

## Status: ✅ Complete
