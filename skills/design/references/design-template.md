# Design Doc Template

Use when the user accepts the write step in Phase 4. Save to:

```
.bdk/design/YYYY-MM-DD-HHMM-<slug>-design.md
```

Include only the sections that fit the branch the skill took (Product, Architecture, or Combined). Mermaid diagrams and "What we did NOT decide" are mandatory in all branches. The **Database Schema Changes** section is mandatory whenever the design alters the schema — and it must record the user's explicit approval (Phase 2A.2.5 gate).

---

```markdown
# [Feature] — Design

**Date**: YYYY-MM-DD
**Status**: Draft | Approved | Implemented
**Branch**: Product | Architecture | Combined
**Authors**: Claude + User

> Design doc only. To translate into an implementation plan, run `/bdk:create-plan`. To formalize a single decision from this doc, run `/bdk:create-adr`.

---

## Problem

[2–4 sentences. What is the user/business trying to accomplish? Why now?]

**In scope:** [bulleted list]
**Out of scope:** [bulleted list — equally important]

---

## Existing Codebase Context

From Phase 0 explorer findings. Anchor every decision to what already exists.

- **Already present:** [modules, abstractions, patterns]
- **Closest existing abstraction:** [if extending something]
- **Integration points:** [where this plugs in]
- **Conventions to follow:** [naming, layering, error handling observed]

---

<!-- PRODUCT or COMBINED branch -->

## Users & Personas

| Persona | Trigger | Context | Success looks like |
|---|---|---|---|
| ... | ... | ... | ... |

## Success Criteria

Measurable outcomes (not feature lists).

- [ ] [Metric 1 — how, by when]
- [ ] [Metric 2]

## UX Touchpoints

- **Entry:** [where users come in]
- **Key flow:** [step → step → step]
- **Failure surface:** [what users see when it breaks]
- **Exit:** [what done means for the user]

## Testing Strategy

- **Acceptance:** [what proves it works for users]
- **Edge cases:** [unusual inputs / states the user cares about]

---

<!-- ARCHITECTURE or COMBINED branch -->

## Constraints & NFRs

| Dimension | Value | Source |
|---|---|---|
| Expected scale | e.g. ~10k req/s peak | User, Phase 2A.1 |
| Latency budget | e.g. p99 < 200ms | User |
| Consistency | Strong / eventual / mixed | User |
| Availability target | e.g. 99.9% | User |
| Security/compliance | e.g. PII; SOC2 | User |
| Team capacity | e.g. 2 engineers, 4 weeks | User |

## Considered Approaches

### Approach A — [name]

**Essence:** [one sentence]

**Components & responsibilities:**
- [Component] — [what it owns]
- [Component] — [what it owns]

**Data flow (happy path):**
1. ...
2. ...

**Tradeoffs:**
- Scalability: ...
- Latency: ...
- Consistency: ...
- Operational complexity: ...
- Time-to-build: ...

```mermaid
[diagram]
```

---

### Approach B — [name]

[same structure as A]

```mermaid
[diagram]
```

---

### Approach C — [name] (optional)

[same structure]

---

## Selected Approach: [name]

**Why:** [Paragraph explicitly tying the choice to constraints from the NFR table.]

**Final component map:**

```mermaid
[the diagram for the selected approach]
```

**Key boundaries:**

- [Boundary] — what crosses it, what doesn't
- [Boundary] — what crosses it, what doesn't

---

<!-- Mandatory when the design changes the DB schema. Records the Phase 2A.2.5 gate outcome. -->

## Database Schema Changes

**Schema approval:** ✅ Approved by user on YYYY-MM-DD — Proposal [X] | ⛔ Not yet approved (design must not be implemented)

### Current schema (affected tables)

```mermaid
erDiagram
[current shape — grounded in real migration/model files]
```

### Approved change

**Proposal [X] — [name].** Migration type: **additive / backward-compatible** | **breaking**.

```mermaid
erDiagram
[post-change shape]
```

- **Delta:** [tables/columns added, dropped, renamed, retyped; constraints/indexes touched]
- **Backfill:** [required? strategy / volume]
- **Downtime:** [none / window needed]
- **Rollback:** [how to reverse, or why it's one-way]

### Considered & dropped

| Proposal | Shape in one line | Why not chosen |
|---|---|---|
| [Y] | ... | ... |

---

## Risk Register (Devil's Advocate)

Each item: what it is, when it bites, mitigation.

| Risk | When it bites | Mitigation |
|---|---|---|
| [Bottleneck X] | Above ~Y throughput | [Cache / shard / async] |
| [SPOF Y] | When Z is down | [Replica / fallback / degrade] |
| [Hidden cost] | ... | ... |

---

## What We Did NOT Decide

Open questions left for later. Each should be answerable by the team or a follow-up brief — NOT silently assumed during implementation.

- [ ] [Open question 1]
- [ ] [Open question 2]

---

## Loop-back History (optional)

If Validation triggered any loop-backs, summarize what changed.

| Iteration | Gap surfaced | Looped to | Outcome |
|---|---|---|---|
| 1 | ... | Phase 0 / 1 / 2 | ... |

---

## Next Steps

- Implementation plan: `/bdk:create-plan`
- Formal decision record: `/bdk:create-adr`
- Deeper exploration of a specific component: re-run `/bdk:design` scoped to that component
```
