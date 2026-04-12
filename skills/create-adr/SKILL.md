---
name: create-adr
description: >-
  Create Architecture Decision Records (ADRs) based on MADR template.
  Use when the user asks to "create an ADR", "document a decision",
  "write an ADR", or provides decision context that needs to be formalized.
model: opus
user-invocable: true
arguments:
  - name: decision
    description: "Free-form description of the decision: context, problem, options, constraints, preferences"
    required: true
---

# Create ADR

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Generate an Architecture Decision Record following MADR format.

## Input

$ARGUMENTS

## Process

### 1. Analyze Input

Extract from the free-form description:
- Problem statement and context
- Considered options
- Constraints and decision drivers
- Any stated preference or chosen option

### 2. Ask Targeted Questions

Use AskUserQuestion to fill gaps — only ask what's genuinely unclear.

**Always ask:**
- ADR status (proposed/accepted/rejected/deprecated)

**Never ask — user adds manually after generation:**
- Decision-makers, consulted, informed (use `{TBD}` placeholder in frontmatter)

### 3. Determine Next ADR Number

Scan `docs/adr/` for existing ADR files matching pattern `NNNN-*.md`. Use the next sequential number, zero-padded to 4 digits.

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

Only create diagrams when they genuinely add visual value:
- Architecture options with different component layouts
- Options with different data flows or system interactions

Skip diagrams for trivially simple options or abstract decisions.

If creating diagrams:
- Write `.dot` files to `docs/adr/diagrams/`
- Compile to SVG with `dot -Tsvg input.dot -o output.svg` if graphviz is available
- Reference in ADR as `![Description](images/name.svg)`

### 6. Final Verification

- Read the generated ADR file and verify formatting
- Show the user the generated ADR path and a summary

## Rules

- **Diagrams are optional** — only generate when they add genuine visual value
- **Don't over-ask** — extract maximum information from free-form input before asking
- **No commits** — generate files only, user decides when to commit
