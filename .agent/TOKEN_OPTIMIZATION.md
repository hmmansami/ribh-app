# 🧠 Token Optimization Guide

## The Problem
Claude Opus limits get hit fast because:
1. **Terminal execution** - Each command output adds thousands of tokens
2. **Long conversations** - Your 26MB conversations = 100k+ tokens per request
3. **Full file reads** - server.js is 2600+ lines = massive context
4. **Iterative debugging** - Each cycle adds to context

## The Solution: Tiered Agents

```
┌──────────────────────────────────────────────────────────────┐
│                     TASK ROUTER                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  "Is this an architecture/design question?"                   │
│  YES → Claude Opus (SHORT exchange)                           │
│  NO  → Gemini Pro                                             │
│                                                               │
│  "Is this a simple fix (color/text/typo)?"                    │
│  YES → Gemini Fast                                            │
│  NO  → Gemini Pro                                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Quick Reference

| Task Type | Use This | Time Limit |
|-----------|----------|------------|
| Architecture decisions | Claude Opus | 2-5 min |
| Complex bug analysis | Claude Opus | 2-5 min |
| All execution/coding | Gemini Pro | No limit |
| Terminal commands | Gemini Pro | No limit |
| File reads/writes | Gemini Pro | No limit |
| Color changes | Gemini Fast | 1 min |
| Text updates | Gemini Fast | 1 min |

## Claude Opus Rules (STRICT)

1. ❌ NEVER run terminal commands
2. ❌ NEVER read full files  
3. ❌ NEVER debug iteratively (1-2 exchanges MAX)
4. ✅ Ask specific questions
5. ✅ Get decision, then new chat
6. ✅ Keep prompts under 500 words

## Token-Saving Tips

### 1. Fresh Chat Per Task
Bad: One huge 26MB conversation
Good: 5 small 500KB conversations

### 2. Use Status Files
Bad: "Remember what we discussed..."
Good: Read .agent/status/agent_a.txt

### 3. Line Ranges, Not Full Files
Bad: "Read server.js"
Good: "Read server.js lines 100-150"

### 4. Pipe Long Output
Bad: `npm test` (dumps everything)
Good: `npm test 2>&1 | tail -50`

## Emergency: Limits Hit

1. Switch to Gemini Pro for EVERYTHING
2. Add more detail to your prompts
3. Break complex tasks into smaller ones
4. Use the structured templates in smart-agent.md

## Your Pattern That Burns Claude

Based on your conversation history:
1. Start project ✅
2. Give Claude full access ⚠️
3. Claude runs terminals 🔴
4. Context explodes 🔴
5. Limits hit 💀

NEW Pattern:
1. Start project ✅
2. Claude answers DESIGN questions only ✅
3. Gemini Pro runs everything ✅
4. Fresh chats per major task ✅
5. No limits issues ✅

---

*Use /smart-agent workflow for routing*
