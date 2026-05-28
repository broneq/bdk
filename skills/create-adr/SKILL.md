---
name: create-adr
description: >-
  Create Architecture Decision Records (ADRs) based on MADR template.
  Use when the user asks to "create an ADR", "document a decision",
  "write an ADR", or provides decision context that needs to be formalized.
model: opus
user-invocable: true
disable-model-invocation: true
argument-hint: "[decision context, options, constraints, preferences]"
---

# Create ADR

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py architecture`

Generate ADR following MADR format.

## Input

$ARGUMENTS

## Process

### 1. Analyze Input

Extract from free-form description:
- Problem statement and context
- Considered options
- Constraints and decision drivers
- Stated preference or chosen option

### 2. Ask Targeted Questions

Use AskUserQuestion to fill gaps — only ask what's genuinely unclear.

**Always ask:**
- ADR status (proposed/accepted/rejected/deprecated)

**Never ask — user adds manually after generation:**
- Decision-makers, consulted, informed (use `{TBD}` placeholder in frontmatter)

### 3. Determine Next ADR Number

Scan `docs/adr/` for existing ADR files matching pattern `NNNN-*.md`. Use next sequential number, zero-padded to 4 digits.

### 4. Generate ADR Document

Write to `docs/adr/NNNN-{slugified-title}.md` following MADR format:

```markdown
---
status: {status}
date: {YYYY-MM-DD}
decision-makers: {TBD}
consulted: {TBD}
informed: {TBD}
---

# ADR-NNNN: {Title}

## Context and Problem Statement
{2-3 sentences describing the problem}

## Decision Drivers
- {driver 1}
- {driver 2}

## Considered Options
1. **{Option A}** — {one-line summary}
2. **{Option B}** — {one-line summary}

## Decision Outcome
**Chosen option: {Option}**, because {justification}.

### Consequences
- ✅ {positive consequence}
- ❌ {negative consequence}
- 🟡 {neutral consequence}

### Implementation Requirements
- [ ] {requirement 1}

## Pros and Cons of the Options

### {Option A}
{description}

- ✅ {pro}
- ❌ {con}

### {Option B}
...

## More Information
{additional context, links, follow-up decisions}
```

**Formatting rules:**
- Use `✅` for pros, `❌` for cons, `🟡` for neutral
- Never use "Good, because" / "Bad, because" — use symbols directly

### 5. Generate Diagrams (Optional)

Only create diagrams when they add genuine visual value:
- Architecture options with different component layouts
- Options with different data flows or system interactions

Skip for trivially simple or abstract decisions.

If creating diagrams:
- Embed Graphviz diagrams directly in ADR as fenced code blocks (` ```dot `), preceded by `###` header — compiler uses header as filename
- After writing ADR file, invoke `/bdk:graphviz-docs-compiler` passing `docs/adr/` as target directory with `--mode both` to extract `.dot` files and compile to SVG
- Compiler rewrites code blocks in-place with `![Description](images/name.svg)` references

### 6. Final Verification

- Read generated ADR file and verify formatting
- Show user generated ADR path and summary

## Rules

- **Diagrams optional** — only generate when they add genuine visual value
- **Don't over-ask** — extract maximum info from free-form input before asking
- **No commits** — generate files only, user decides when to commit