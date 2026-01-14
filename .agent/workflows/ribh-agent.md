---
description: How to work on RIBH project as an agent
---

# RIBH Agent Onboarding

## Step 1: Read the Coordinator
Read the file `.agent/COORDINATOR.md` to understand:
- Project context
- File ownership
- Task queue

## Step 2: Pick a Task
Look at the task queue in COORDINATOR.md
Pick a task with status ⏳ (Available)

## Step 3: Read Your Task File
Go to `.agent/tasks/TASK_X_NAME.md`
Read the complete task including:
- Objective
- Files to edit
- Requirements
- Testing steps

## Step 4: Update Status
In COORDINATOR.md, change your task status from ⏳ to 🔄

## Step 5: Do The Work
- Follow the task file instructions
- Use the design guidelines
- Test your changes locally

## Step 6: Commit & Push
```bash
cd /Users/user/Downloads/app/ribh-app
git add .
git commit -m "Description of your changes"
git push origin main
```

## Step 7: Mark Complete
Update COORDINATOR.md: Change 🔄 to ✅

---

## Important Rules

1. **Never edit a file another agent owns**
2. **Always test before committing**
3. **Follow the Apple-style design guidelines**
4. **Use the existing API endpoints**
5. **Keep it simple**
