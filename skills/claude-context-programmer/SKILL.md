---
name: claude-context-programmer
description: "Use when writing or modifying code in this repo from a prompt; always preload STATUS Last Session plus the relevant CLAUDE.md files, follow their rules (ADR-first), and append any new context back into those CLAUDE.md files so future agents can reuse it."
---

# CLAUDE-Context Programmer

Workflow for coding tasks that must honor repository CLAUDE.md rules and keep those files up to date for other agents.

## When to load this skill
- Any request to develop, extend, or refactor code in this project based on a prompt or spec.
- Use for planning or investigation that will change code, docs, or decisions.

## Startup checklist (do before coding)
1) Read `STATUS.md` → **Last Session** for current state.
2) Read root `CLAUDE.md` for global rules (ADR-first, STATUS updates, local CLAUDE usage).
3) Identify all directories that will be touched; open each directory’s `CLAUDE.md` (e.g., `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`, `packages/shared/CLAUDE.md`, or feature subfolders). If a target directory lacks one, create it with a short overview and an `Updates` section.
4) If the task is a feature or structural change, draft an ADR **before** coding and get approval per root `CLAUDE.md` guidance.

## Working rules
- Follow the conventions in every consulted `CLAUDE.md` (commands, patterns, constraints) when implementing.
- Keep track of discoveries, decisions, and quirks while you work (file paths, gotchas, partial TODOs).
- Prefer pnpm workspace commands already documented in CLAUDE files; avoid inventing new scripts unless necessary.

## Append context back to CLAUDE.md
- After completing meaningful work in a directory, append a dated note to that directory’s `CLAUDE.md` under an `## Updates YYYY-MM-DD` heading (create if missing).
- Keep bullets concise (what changed, where, any follow-up or traps). Never delete existing content.

## Session closure
1) Update `STATUS.md`: overwrite **Last Session**, append to **Timeline**, and record ADRs in **Decisions Log** as required.
2) Ensure every touched directory’s `CLAUDE.md` includes your newest context notes.
3) Summarize outstanding risks or TODOs so the next agent can resume quickly.

## Minimal CLAUDE note template
```
## Updates 2026-03-19
- Change/observation with file path
- Next step or open question
```


---
name: claude-context-programmer
description: "Advanced coding agent workflow: preload STATUS + all relevant CLAUDE.md files, enforce ADR-first development, iteratively plan → act → verify → reflect, and continuously write context back for future agents."
---

# CLAUDE-Context Programmer (Enhanced)

A production-grade coding workflow that mimics Claude’s full programming loop:
**Context → Plan → Act → Verify → Reflect → Persist**

This skill ensures:
- Consistent architecture decisions (ADR-first)
- Stateful development across sessions
- Self-correcting execution loops
- Knowledge persistence for future agents

---

# 🧠 Core Execution Loop (VERY IMPORTANT)

For ANY task, ALWAYS follow this loop:

1. **Context Loading**
2. **Planning**
3. **Execution**
4. **Verification**
5. **Reflection**
6. **Persistence**

Repeat until task is complete.

---

# 📥 1. Context Loading (MANDATORY)

Before doing anything:

- Read `STATUS.md` → **Last Session**
- Read root `CLAUDE.md`
- Read ALL relevant local `CLAUDE.md` files in:
  - target apps (`apps/web`, `apps/api`, etc.)
  - shared packages
  - feature directories

### If missing:
- Create `CLAUDE.md` with:
  - purpose
  - constraints
  - patterns
  - `## Updates` section

### Build mental model:
- current system state
- architecture decisions
- constraints
- known issues

---

# 🧩 2. Planning Phase

### Always plan BEFORE coding:

- Break task into steps
- Identify impacted files
- Identify risks
- Identify dependencies


### ADR Requirement (STRICT)
If task involves:
- new feature
- architecture change
- data model change
- API contract change

👉 MUST create ADR before coding

### ADR Interactive Answers Section (NEW)

When creating an ADR, ALWAYS include an **"## Questions & Answers"** section at the end.

Purpose:
- Allow user/human to respond to open decisions
- Enable iterative clarification before implementation
- Reduce wrong assumptions by the agent

### Rules:
- If any uncertainty exists → ASK questions in ADR
- Do NOT assume missing requirements
- Keep questions clear and decision-oriented

### Format:

## Questions & Answers

### Questions for User
- Q1: <specific architectural or product question>
- Q2: <edge case or constraint clarification>

### Answers (to be filled by user)
- A1:
- A2:

### Agent Behavior:
- After generating ADR → STOP and wait for answers if questions exist
- Do NOT proceed to coding until answers are provided
- Once answered → update ADR with final decisions and continue workflow

### If no questions:
- Still include section with:
  - "No open questions at this time"

This ensures:
- Human-in-the-loop decision making
- Safer architecture choices
- Claude-like interactive planning loop

---

# ⚙️ 3. Execution Phase

While coding:

- Follow ALL CLAUDE.md rules (global + local)
- Reuse existing patterns (DO NOT reinvent)
- Prefer existing scripts (pnpm workspace)

### Code Quality Rules:
- Keep changes minimal and scoped
- Avoid breaking existing flows
- Maintain consistency with repo style

### While working, TRACK:
- decisions made
- edge cases
- bugs found
- missing abstractions

---

# 🧪 4. Verification Phase (CRITICAL)

After writing code:

- Check:
  - logic correctness
  - integration impact
  - edge cases
  - consistency with patterns

- If possible:
  - run builds
  - run tests
  - validate flows mentally

---

# 🔁 5. Reflection Phase (SELF-IMPROVEMENT)

Before finishing:

Ask:
- Did I follow CLAUDE rules?
- Is this consistent with architecture?
- Did I introduce tech debt?
- Can this be simplified?

If issues found → FIX before proceeding

---

# 💾 6. Persistence Phase (KNOWLEDGE SHARING)

## Update CLAUDE.md (MANDATORY)

For EACH touched directory:

Append:

```
## Updates YYYY-MM-DD
- What changed (file + reason)
- Key decision made
- Gotcha / trap
- Next step
```

DO NOT delete existing content.

---

# 📊 STATUS.md Updates (MANDATORY)

At session end:

### Update:
- **Last Session** → overwrite
- **Timeline** → append entry
- **Decisions Log** → include ADR references

---

# 🧭 Advanced Capabilities (Claude Loop Enhancements)

## 1. Iterative Execution
- Never assume first solution is correct
- Improve in loops

## 2. Multi-file Awareness
- Always think across:
  - frontend
  - backend
  - shared layers

## 3. Dependency Awareness
- Check ripple effects of changes

## 4. Error Anticipation
- Predict failures before they happen

## 5. Context Expansion
- If unsure → explore codebase more before acting

## 6. Constraint Enforcement
- CLAUDE.md rules override assumptions

---

# 🚨 Strict Rules

- NEVER code without context loading
- NEVER skip ADR when required
- NEVER ignore local CLAUDE.md
- NEVER finish without updating STATUS.md
- NEVER lose learned context (must persist)

---

# 🧩 Minimal CLAUDE Note Template

```
## Updates 2026-03-19
- Updated menu API validation (apps/api/menu.ts)
- Decided to use Zod for schema validation
- Found edge case: empty menu items crash UI
- TODO: add integration test
```

---

# 🎯 Goal

Transform the agent from:
❌ Stateless code generator  
✅ Into a **stateful engineering system**

This skill ensures:
- continuity
- correctness
- collaboration across sessions