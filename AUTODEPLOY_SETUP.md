# 🚀 Firebase Auto-Deploy Setup Guide

## One-Time Setup (5 minutes)

The auto-deploy requires a **Service Account**. Here's how to set it up:

### Step 1: Create Service Account in Google Cloud

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=rich-f2a72

2. Click **"+ CREATE SERVICE ACCOUNT"**

3. Fill in:
   - Name: `github-actions-deployer`
   - ID: `github-actions-deployer`
   - Click **"CREATE AND CONTINUE"**

4. Add these roles (click "Add Another Role" for each):
   - `Firebase Hosting Admin`
   - `Cloud Functions Admin`
   - `Service Account User`
   - `Cloud Build Editor`
   - `Artifact Registry Administrator`

5. Click **"DONE"**

### Step 2: Create and Download JSON Key

1. Click on the service account you just created
2. Go to the **"KEYS"** tab
3. Click **"ADD KEY"** → **"Create new key"**
4. Select **"JSON"** and click **"CREATE"**
5. A JSON file will download - **KEEP THIS SAFE**

### Step 3: Add Secret to GitHub

1. Go to: https://github.com/hmmansami/ribh-app/settings/secrets/actions

2. Click **"New repository secret"**

3. Fill in:
   - Name: `FIREBASE_SERVICE_ACCOUNT_RICH_F2A72`
   - Value: **Paste the ENTIRE content of the JSON file you downloaded**

4. Click **"Add secret"**

### Step 4: Trigger the Deploy

```bash
cd /Users/user/Downloads/app/ribh-app
git add .
git commit -m "Update Firebase deployment workflow"
git push origin main
```

## ✅ After Setup

Every time you push to `main`, GitHub Actions will automatically:
1. Build your project
2. Deploy to Firebase Hosting
3. Deploy Cloud Functions

## 🔍 Check Deploy Status

Go to: https://github.com/hmmansami/ribh-app/actions

You'll see the deployment running!

---

## Quick Links

- [Google Cloud Console - Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts?project=rich-f2a72)
- [GitHub - Repository Secrets](https://github.com/hmmansami/ribh-app/settings/secrets/actions)
- [GitHub Actions - Workflow Runs](https://github.com/hmmansami/ribh-app/actions)
- [Firebase Console](https://console.firebase.google.com/project/rich-f2a72)
