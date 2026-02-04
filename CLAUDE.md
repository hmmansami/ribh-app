# CLAUDE.md - Project Rules for Claude Code

## Approach & Planning
- Before writing any code, describe the approach and wait for approval. Ask clarifying questions if requirements are ambiguous.
- If a task requires changes to more than 3 files, stop and break it into smaller tasks first.

## Code Quality
- After writing code, list what could break and suggest tests to cover it.
- When there's a bug, start by writing a test that reproduces it, then fix it until the test passes.

## Deployment
- GitHub PAT is available for direct pushes to main (no PRs needed).
- Pushes to main auto-deploy to Firebase Hosting via GitHub Actions.
- Firebase service account currently lacks `serviceusage.serviceUsageConsumer` role — only hosting deploys work (no functions/firestore).
- Always verify deploy passes after pushing: `gh run list --repo hmmansami/ribh-app --limit 1`

## Project Context
- RIBH is an abandoned cart recovery platform for Salla/Shopify stores in Saudi Arabia.
- Tech stack: Node.js 20, Express, Firebase (Hosting + Functions + Firestore), WhatsApp via Baileys, AWS SES/SNS.
- All UI is Arabic RTL with Tajawal font and dark theme (#0a0a0a bg, #10B981 green accent).
- Firebase project ID: ribh-484706
- Live URL: https://ribh-484706.web.app

## Corrections Log
- (Add new rules here every time the user corrects a mistake)
