# AGENT C: Firebase Full Migration

## 🎯 Your Mission
Migrate RIBH from Render (JSON files) to Firebase (Firestore + Cloud Functions).

## 📁 Project Location
`/Users/user/Downloads/app/ribh-app`

## Current Stack
- Node.js + Express (server.js - 2600+ lines)
- JSON file database (data/*.json)
- Hosted on Render

## Target Stack
- Firebase Hosting (static files)
- Cloud Functions (Express app)
- Firestore (database)
- Keep existing Salla OAuth working

---

## STEP-BY-STEP IMPLEMENTATION

### Step 1: Initialize Firebase
```bash
cd /Users/user/Downloads/app/ribh-app
npm install -g firebase-tools
firebase login
firebase init
# Select: Firestore, Functions, Hosting
# Functions language: JavaScript
# Use existing project or create new
```

### Step 2: Install Firebase Admin SDK
```bash
npm install firebase-admin firebase-functions
```

### Step 3: Create Cloud Function Wrapper
Create `functions/index.js`:
```javascript
const functions = require('firebase-functions');
const express = require('express');
const app = express();

// Import existing server logic
// ... (copy relevant routes from server.js)

exports.api = functions.https.onRequest(app);
```

### Step 4: Update Database Functions
Replace ALL occurrences of:
- `readDB(DB_FILE)` → Firestore reads
- `writeDB(DB_FILE, data)` → Firestore writes

### Step 5: Move Static Files
```bash
# Copy public folder to hosting
cp -r public/* hosting/
```

### Step 6: Update firebase.json
```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "/webhooks/**", "function": "api" },
      { "source": "/oauth/**", "function": "api" }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs18"
  }
}
```

### Step 7: Create Migration Script
Create `migrate-to-firestore.js` to move existing data.

### Step 8: Deploy
```bash
firebase deploy
```

---

## IMPORTANT FILES TO MODIFY

1. `server.js` → Split into Firebase Functions
2. `package.json` → Add firebase dependencies
3. Create `firebase.json`
4. Create `functions/index.js`
5. Create `firestore.rules`

---

## Your Output

Update status file: `.agent/status/agent_c.txt`

Format:
```
STATUS: DONE

CHANGES:
- [list of files created/modified]

FIREBASE PROJECT:
- Project ID: [id]
- Hosting URL: [url]
- Functions deployed: [yes/no]

NEXT STEPS:
- [any remaining items]
```

---

## Rules
- Keep Salla OAuth working
- Keep all API endpoints working
- Test locally before deploying
- Commit changes with clear message
