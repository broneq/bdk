# MADR template

Write the record to `docs/adr/NNNN-<slug>.md`, where `NNNN` is one above the highest existing number, zero-padded to four digits, and `<slug>` is the title in kebab-case.

```markdown
---
status: <proposed | accepted | rejected | deprecated | superseded by ADR-NNNN>
date: <YYYY-MM-DD>
decision-makers: <names, or {TBD}>
consulted: <names, or {TBD}>
informed: <names, or {TBD}>
---

# ADR-NNNN: <Title>

## Context and Problem Statement

<Two or three sentences: the problem and why it needs a decision now.>

## Decision Drivers

- <driver>
- <driver>

## Considered Options

1. **<Option A>** - <one-line summary>
2. **<Option B>** - <one-line summary>

## Decision Outcome

**Chosen option: <Option>**, because <justification tied to the drivers>.

### Consequences

- ✅ <positive consequence>
- ❌ <negative consequence>
- 🟡 <neutral consequence>

### Implementation Requirements

- [ ] <what has to happen for the decision to hold>

## Pros and Cons of the Options

### <Option A>

<One or two sentences.>

- ✅ <pro>
- ❌ <con>

### <Option B>

<One or two sentences.>

- ✅ <pro>
- ❌ <con>

## More Information

<Links, follow-up decisions, the Change and entry the decision comes from.>
```

## Formatting

- Mark pros with ✅, cons with ❌, neutral points with 🟡; never "Good, because" or "Bad, because".
- Every considered option has its own pros and cons subsection, the chosen one included.
- Add a diagram only when the options differ in structure or data flow: a fenced `mermaid` block of at most 15 nodes with labelled edges and no colour.
- Leave decision-makers, consulted and informed as `{TBD}` when the input does not name them; the user fills them in.
