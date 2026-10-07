# MADR record

The default shape of a record when the project has no records of its own. Path: `docs/adr/NNNN-<slug>.md`, where `NNNN` is four digits and `<slug>` is the title in kebab-case.

```markdown
---
status: <proposed | accepted | rejected | deprecated | superseded by ADR-NNNN>
date: <YYYY-MM-DD>
decision-makers: <names, or {TBD}>
consulted: <names, or {TBD}>
informed: <names, or {TBD}>
---

# ADR-NNNN: <Title: the decision, not the problem>

## Context and Problem Statement

<Two or three sentences: the problem, and why it needs a decision now.>

## Decision Drivers

- <driver: a force or constraint the options are judged against>

## Considered Options

1. **<Chosen option>** - <one line>
2. **<Other option>** - <one line>

## Decision Outcome

**Chosen option: <Option>**, because <reason, tied to the drivers>.

### Consequences

- ✅ <what gets better>
- ❌ <what gets worse or costs more>
- 🟡 <what changes without being better or worse>

### Implementation Requirements

- [ ] <what has to happen for the decision to hold>

## Pros and Cons of the Options

### <Chosen option>

<One or two sentences.>

- ✅ <pro>
- ❌ <con>

### <Other option>

<One or two sentences.>

- ✅ <pro>
- ❌ <con>

## More Information

<Links: the source of the decision (a Change's design.md), related records, "Supersedes ADR-NNNN", when to revisit.>
```

## Rules

- Mark pros with ✅, cons with ❌, neutral points with 🟡. Never write "Good, because" or "Bad, because".
- Every considered option has its own pros and cons subsection, the chosen one included, with at least one ✅ and one ❌.
- People fields the input does not name stay `{TBD}` for the user to fill in.
- Leave out "Implementation Requirements" only when the decision needs no follow-up work.
