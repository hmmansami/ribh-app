---
description: Resume work on Ribh abandoned cart recovery project
---

## Quick Resume Steps

// turbo-all

1. Read the project context:
```bash
cat PROJECT_CONTEXT.md
```

2. Check recent changes:
```bash
git log --oneline -5
```

3. Check current status:
```bash
git status
```

4. Start dev server if needed:
```bash
npm run dev
```

## Key Areas

- **Dashboard:** `/public/index.html`
- **Backend:** `/server.js`
- **Settings:** `/public/settings.html`
- **Data:** `/data/*.json`

## Common Tasks

### Add new feature
1. Edit server.js for backend
2. Edit public/*.html for frontend
3. Test locally
4. Commit and push to deploy

### Debug webhook
1. Check Render logs
2. Look at /data/carts.json
3. Test with Salla sandbox

### Check API keys
```bash
cat .env
```
