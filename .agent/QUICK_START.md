# 🚀 Quick Start: Claude Limit-Saving Protocol

## Before EVERY Session

1. **Start fresh chat** (don't reuse old ones)
2. **First message:**
   ```
   Read .agent/PERSONALITY.md
   Task: [ONE specific task]
   ```

## During Session

| DO ✅ | DON'T ❌ |
|------|---------|
| "Read server.js lines 100-150" | "Read server.js" |
| "Add X to file Y" | "Make it better" |
| "Write findings to .agent/status/x.txt" | Long explanations in chat |
| Start new chat after 3-4 exchanges | Keep using same chat |
| Reference PERSONALITY.md | Re-explain everything |

## Example Prompts (Token-Efficient)

**Bad (burns tokens):**
```
Hey, so remember the project we were working on? I want to make 
the dashboard look better. Can you take a look at the files and 
see what needs to be improved? Maybe add some animations or 
something? Also check if there are any bugs.
```

**Good (fast & efficient):**
```
Read .agent/PERSONALITY.md
Task: Add hover animation to cards in public/index.html lines 200-250
```

## Checkpoint Rule

After 3-4 exchanges, ask yourself:
- "Am I still on the same task?"
- If NO → Start new chat
- If context feels lost → Save to status file, new chat

## Status Files (Your Memory)

Save progress to files so new chats can pick up:
```
.agent/status/current_task.txt   - What you're working on
.agent/status/decisions.txt      - Key decisions made
.agent/status/blockers.txt       - Current issues
```

## Emergency: Limits Hit

1. Wait for 5-hour reset OR
2. Use Gemini Pro for execution (with detailed prompts) OR
3. Break task into smaller pieces for later

---

*Pin this somewhere visible!*
