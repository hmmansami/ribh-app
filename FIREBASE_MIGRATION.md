# 🚚 Migrating RIBH to Firebase

Great choice! Detailed instructions to complete the migration.

## 1. Setup Firebase Account

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Create a project**
3. Name it `ribh-app` (or similar)
4. Enable Google Analytics (optional)

## 2. Install Firebase Tools (Terminal)

Open your terminal and run:

```bash
# Install the CLI tool
npm install -g firebase-tools

# Login to your account
firebase login
```

## 3. Initialize Project

Run this in the project root (`/Users/user/Downloads/app/ribh-app`):

```bash
firebase init
```

- When asked: **"Which Firebase features do you want to set up?"**
  - Select (Spacebar):
    - `Firestore: Configure security rules and indexes files`
    - `Functions: Configure a Cloud Functions directory`
    - `Hosting: Configure files for Firebase Hosting`
  - Press Enter.

- **Project Setup**: Select "Use an existing project" and pick the one you created.
- **Firestore**: Accept defaults (`firestore.rules`, `firestore.indexes.json`).
- **Functions**:
  - Language: `JavaScript`
  - ESLint: `No`
  - Overwrite package.json? **NO** (Keep the one I created)
  - Overwrite index.js? **NO** (Keep the one I created)
  - Install dependencies? `Yes`
- **Hosting**:
  - Public directory: `public`
  - Configure as single-page app? `Yes` (Important for routing)
  - Set up automatic builds and deploys with GitHub? `No` (Setup manually later)
  - Overwrite public/index.html? **NO**

## 4. Finalizing Code

The code is 90% ready. After you do step 3, run:

```bash
cp server.js functions/server.js
```

⚠️ **One Last Thing**: The current database uses JSON files. Firebase Cloud Functions **cannot save to JSON files permanently**.
The app will work, but **data will be reset on every restart**.

**Do you want me to update the code to use Firestore (Real Database)?**
This requires me to rewrite about 25 sections of the code to be "Async". Just say **"Migrate DB to Firestore"**.

## 5. Deploy

```bash
firebase deploy
```

Your app will be live on `https://YOUR-PROJECT-ID.web.app`!
