---
description: How to use multiple agents efficiently to save context limits and work faster
---

# Multi-Agent Workflow

## Why Multi-Agent?

Based on Google's 2025-2026 Agent updates (ADK, Agent2Agent Protocol), we can now orchestrate multiple AI agents to:
- **Avoid context limit cutoffs** (split work across agents)
- **Parallel execution** (multiple agents work simultaneously)
- **Specialized agents** (each agent focuses on what it's best at)

---

## The Agent Roles

### 1. **Coordinator Agent** (This conversation)
- Understands user intent
- Plans the work
- Delegates to specialized agents
- Reviews and combines results

### 2. **Builder Agent** (New chat for execution)
- Writes code
- Makes file changes
- Runs commands
- Pure execution, no planning

### 3. **Research Agent** (New chat for information)
- Web searches
- Documentation reading
- API exploration
- Returns findings to coordinator

---

## How to Use

### Step 1: Plan in Coordinator
```
USER: I want to build X
COORDINATOR: Here's the plan:
1. Research: Find best approach for X
2. Build: Create files A, B, C
3. Test: Verify it works
```

### Step 2: Spawn Research Agent (if needed)
Open new chat, paste:
```
CONTEXT: I'm working on [project]. I need you to research [topic].
Return: A summary of findings with actionable recommendations.
Don't ask questions, just research and return results.
```

### Step 3: Spawn Builder Agent
Open new chat, paste:
```
CONTEXT: 
- Project: /Users/user/Downloads/app/ribh-app
- Task: [specific task from plan]
- Files to modify: [list]

INSTRUCTIONS:
1. Read the files listed above
2. Make the changes described
3. Commit with message: "[task description]"
4. Push to origin main
5. Return: Summary of what you changed

First Principles apply (see /Users/user/Desktop/FIRST_PRINCIPLES.md)
```

### Step 4: Collect Results
Each agent returns its results. Coordinator combines and moves to next step.

---

## Benefits

| Single Agent | Multi-Agent |
|--------------|-------------|
| Context fills up | Fresh context per task |
| Gets slower over time | Always fast |
| One perspective | Multiple specialized views |
| Sequential work | Parallel work possible |

---

## Google's Agent Updates (January 2026)

1. **Agent Development Kit (ADK)** - Open-source framework for building agents
2. **Agent2Agent (A2A) Protocol** - Agents from different vendors can collaborate
3. **Gemini 3.0** - Native multimodality, 1M+ token context, "thinking budgets"
4. **Agentspace** - Enterprise agent orchestration

### What This Means for Us
- Agents can now TALK to each other (A2A Protocol)
- Context windows are HUGE (1M+ tokens)
- Thinking budgets let complex reasoning happen
- We can build custom agents for specific tasks

---

## Quick Commands

### Start a Builder Agent
```
/builder [task description]
→ Opens new chat focused on execution
```

### Start a Research Agent  
```
/research [topic]
→ Opens new chat focused on finding information
```

### Resume Work
```
/resume [project-name]
→ Loads context and continues where you left off
```

---

## First Principles Applied

- **Delete**: Don't use one agent for everything
- **Simplify**: Each agent has ONE job
- **Speed**: Parallel agents = faster results
- **Automate**: Agents handle repetitive work

---

*This workflow is designed to work with the realities of AI context limits while maximizing speed and quality.*
