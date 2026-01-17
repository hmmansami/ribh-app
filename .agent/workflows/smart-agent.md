---
description: Smart agent routing to save Claude limits while maintaining quality
---

# Smart Agent Workflow

## Purpose
Route tasks to the right model to maximize quality while minimizing Claude Opus usage.

---

## Quick Decision Tree

```
Is it a design/architecture question?
  YES → Claude Opus (SHORT exchange, no terminal)
  NO  ↓

Is it code execution, file edits, or terminal work?
  YES → Gemini Pro (fresh chat per task)
  NO  ↓

Is it a simple change (color, text, typo)?
  YES → Gemini Fast (structured prompt)
  NO  → Gemini Pro
```

---

## Model-Specific Prompts

### Claude Opus (Use Sparingly - MAX 5 min per session)

DO:
- Ask for architecture decisions
- Ask for complex bug analysis
- Ask for design pattern recommendations
- Keep prompts under 500 words
- Get ONE answer, then new chat

DON'T:
- Run terminal commands
- Read full files
- Debug iteratively
- Ask for explanations (just decisions)

Template:
```
Quick architecture question for [project]:

Current setup: [1-2 sentences]
Problem: [1 sentence]
Options I see: [A/B/C]

Which is best and why? Short answer.
```

---

### Gemini Pro (Your Main Executor)

DO:
- Execute all coding tasks
- Run terminal commands
- Read/write files
- Debug and iterate
- Multiple exchanges OK

Template:
```
CONTEXT: [project path]
Read: .agent/PROJECT_CONTEXT.md first

TASK: [specific task]
FILES: [list]

STEPS:
1. [step]
2. [step]
...

COMMIT: "[message]"
PUSH: yes

STATUS: Update .agent/status/[agent].txt
```

---

### Gemini Fast (Quick Fixes Only)

DO:
- Simple CSS changes
- Color updates
- Text changes
- Typo fixes

DON'T:
- Complex logic
- Multi-file changes
- Terminal work

Template:
```
FILE: /path/to/file.html
LINE: 45-50 (approximately)
FIND: "background: red"
REPLACE: "background: blue"
COMMIT: "fix: update button color"
```

---

## Token-Saving Tips

1. **Fresh Chat Per Task**
   - Each major task = new conversation
   - Prevents context buildup
   - Keeps responses fast

2. **Use Status Files**
   - Write findings to .agent/status/
   - Next agent reads status, not conversation
   - Breaks dependency on long context

3. **Don't Read Full Files**
   - Use `view_file` with line ranges
   - Use `view_file_outline` first
   - Only read what you need

4. **Terminal Output = Token Killer**
   - Large terminal output fills context fast
   - Pipe long output to files
   - Use `| head -50` for long lists

5. **Project Context File**
   - Keep PROJECT_CONTEXT.md updated
   - Agents read this instead of rediscovering
   - Saves exploration tokens

---

## Example Workflow

**User Request:** "Add dark mode toggle to dashboard"

**Step 1: Quick Design (Claude Opus - 2 min)**
```
User: Dashboard needs dark mode toggle. Current: single light theme.
Best approach: A) CSS variables B) Separate stylesheet C) JS class toggle?
Claude: [1 paragraph answer]
```

**Step 2: Execute (Gemini Pro - 10 min)**
```
CONTEXT: /Users/user/Downloads/app/ribh-app
Read: .agent/PROJECT_CONTEXT.md

TASK: Add dark mode toggle to dashboard
APPROACH: [from Claude's answer]
FILES: public/index.html

STEPS:
1. Add CSS variables for light/dark themes
2. Add toggle switch in header
3. Add JS to toggle theme class
4. Save preference to localStorage

COMMIT: "feat: add dark mode toggle"
PUSH: yes
```

**Step 3: Quick Fix (Gemini Fast - if needed)**
```
FILE: public/index.html
LINE: 120-125
FIND: "toggle-btn"
REPLACE: "theme-toggle-btn"
```

---

## Recovery When Limits Hit

If Claude Opus hits limits:

1. **Immediate:** Use Gemini Pro for all tasks
2. **Quality:** Add more detail to prompts for Gemini
3. **Complex:** Break into smaller, clearer tasks
4. **Iterate:** More feedback loops are OK with Gemini's limits

---

## Monitor Your Usage

Signs you're using Claude too much:
- Long conversations (>10 exchanges)
- Reading full files repeatedly  
- Running multiple terminal commands
- Debugging in Claude (should be in Gemini Pro)

---

*Last Updated: 2026-01-17*
