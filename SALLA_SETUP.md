# RIBH - Salla App Configuration

## URLs to set in Salla Partners Portal

### 1. OAuth Callback URL (Redirect URI)
```
https://ribh.click/oauth/callback
```
This is where Salla sends the authorization code after merchant approval.

### 2. App URL (Main Entry Point)
```
https://ribh.click/app?merchant={{merchant.id}}
```
This is the URL Salla uses when merchant clicks "Open App" from their dashboard.
The `{{merchant.id}}` is a Salla template variable that gets replaced with the actual merchant ID.

### 3. Alternative: Direct Setup Page
If you want merchants to land directly on setup:
```
https://ribh.click/setup?merchant={{merchant.id}}
```

---

## Redirect Flow

### New Merchant Installation:
1. Merchant clicks "Install" in Salla App Store
2. Redirected to Salla OAuth consent page
3. Merchant approves permissions
4. Salla redirects to: `https://ribh.click/oauth/callback?code=xxx`
5. RIBH exchanges code for access token
6. **New merchant** → Redirects to: `https://ribh.click/setup?merchant={id}&token={ribhToken}`
7. Merchant connects WhatsApp via QR code
8. Continue to dashboard

### Returning Merchant:
1. Merchant clicks "Open" in Salla dashboard
2. Goes to: `https://ribh.click/app?merchant={id}`
3. RIBH finds existing tokens
4. Redirects directly to dashboard

---

## Setup Page Features

The `/setup` page (`/public/setup.html`):
- Shows merchant ID and store name
- QR code for WhatsApp connection
- Step indicators (Install ✓ → WhatsApp → Dashboard)
- Skip option to connect later
- Clean, Arabic RTL interface

---

## Testing

Test the full flow:
1. Go to: `https://ribh.click/setup?merchant=TEST123&store=متجر%20تجريبي`
2. Should see merchant info
3. QR code loads from WhatsApp service
4. Click "Continue" goes to dashboard

---

## Current Configuration

| Setting | Value |
|---------|-------|
| Domain | ribh.click |
| OAuth Callback | /oauth/callback |
| App Entry | /app |
| Setup Page | /setup |
| Dashboard | /index.html |
| WhatsApp Service | ribh-whatsapp-1.onrender.com |
