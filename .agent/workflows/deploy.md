---
description: Deploy to Firebase - commits all changes and pushes to trigger auto-deploy
---

# Deploy to Firebase

This workflow commits all pending changes and pushes to GitHub, which triggers the Firebase auto-deploy via GitHub Actions.

## Steps

// turbo-all

1. Stage all changes:
```bash
cd /Users/user/Downloads/app/ribh-app && git add -A
```

2. Commit with descriptive message:
```bash
cd /Users/user/Downloads/app/ribh-app && git commit -m "🚀 Auto-deploy: $(date '+%Y-%m-%d %H:%M')"
```

3. Push to main branch:
```bash
cd /Users/user/Downloads/app/ribh-app && git push origin main
```

4. Verify deployment started:
   - Check GitHub Actions: https://github.com/hmmansami/ribh-app/actions
   - The workflow "Deploy to Firebase" should be running
   - Live site: https://ribh.click

## Notes
- GitHub Actions automatically deploys to Firebase on every push to main
- Deployment takes ~2-3 minutes to complete
- If deployment fails, check the Actions logs for errors
