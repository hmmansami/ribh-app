# RIBH Execution Plan - January 17, 2026

## 🎯 Goal
Complete all remaining RIBH project tasks using multi-agent execution.

---

## 📊 Current Status

| Task | Description | Status |
|------|-------------|--------|
| Task 1 | Dashboard Redesign | 🔄 Needs Verification |
| Task 2 | Settings & Telegram Pages | ✅ Complete |
| Task 3 | Store Authentication | ✅ Complete |
| Task 4 | AI Message Preview API | ⏳ NOT STARTED |

---

## 🚀 Execution Phases

### Phase 1: AI Message Preview API (Task 4)
**Agent**: Agent A (Backend)
**Files**: `server.js`
**Priority**: HIGH

Add endpoint: `POST /api/ai/generate-message`
- Use existing `generateWithGemini()` function
- Generate personalized Arabic cart recovery messages
- Include dynamic discount offers

### Phase 2: Dashboard Verification
**Agent**: Agent B (Frontend)
**Files**: `public/index.html`
**Priority**: MEDIUM

- Verify real data loads from `/api/carts` and `/api/stats`
- Test Email/WhatsApp button functionality
- Ensure Apple-style theme is complete

### Phase 3: Git Commit & Deploy
**Agent**: Coordinator (this agent)
**Priority**: HIGH

- Commit all changes
- Push to origin main
- Verify live at https://ribh.click

---

## 📝 Agent Instructions

### For Agent A (Task 4):
```
CONTEXT: 
- Project: /Users/user/Downloads/app/ribh-app
- Task: Add AI Message Preview API endpoint

FILES TO READ:
1. .agent/tasks/TASK_4_AI_PREVIEW.md (full task details)
2. server.js (find generateWithGemini function around line 697)

YOUR JOB:
1. Add POST /api/ai/generate-message endpoint to server.js
2. The endpoint receives: customerName, cartValue, items, channel, style
3. Use generateWithGemini() to create personalized Arabic messages
4. Return: { success, message, offer }
5. Include 10% discount offer if cart > 500 SAR

WHEN DONE:
1. Update .agent/status/agent4.txt to "DONE"
2. DO NOT commit - coordinator will handle git

DO NOT EDIT: public/index.html
```

### For Agent B (Dashboard Check):
```
CONTEXT:
- Project: /Users/user/Downloads/app/ribh-app
- Task: Verify dashboard functionality

YOUR JOB:
1. Run `npm start` to start local server
2. Check dashboard loads at localhost:3000
3. Verify stats load from /api/stats
4. Verify carts load from /api/carts
5. Test Email button works
6. Test WhatsApp button works
7. Report any issues found

Report findings back - no file edits needed.
```

---

## ⏱️ Timeline

- Phase 1: 5 minutes (Agent A)
- Phase 2: 3 minutes (Agent B) 
- Phase 3: 2 minutes (Coordinator)

**Total: ~10 minutes**

---

## 🎉 Success Criteria

1. ✅ AI Message API endpoint returns valid Arabic messages
2. ✅ Dashboard loads real data
3. ✅ All changes committed and pushed
4. ✅ Live site works at https://ribh.click
