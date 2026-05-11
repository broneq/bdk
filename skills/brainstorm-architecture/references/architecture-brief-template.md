# Architecture Brief Template

Use this when the user asks to save the brainstorming session. Write to:

```
.bdk/brainstorm-architecture/YYYY-MM-DD-HHMM-<slug>-arch.md
```

---

```markdown
# [Feature] — Architecture Brief

**Date**: YYYY-MM-DD
**Status**: Draft (architecture only — no implementation plan yet)
**Authors**: Claude + User

> This brief describes the *shape* of the solution: components, boundaries, data flow, tradeoffs.
> It is intentionally not an implementation plan. For tasks and code-level steps, run `/bdk:create-plan`.
> For formalizing a single decision from this brief, run `/bdk:create-adr`.

---

## Problem

[2–4 sentences. What is the user/business trying to accomplish? Why now?]

**In scope:** [bulleted list]
**Out of scope:** [bulleted list — equally important]

---

## Constraints & NFRs

| Dimension | Value | Source |
|---|---|---|
| Expected scale | e.g. ~10k req/s peak, ~100 GB/year growth | User, Phase 1 |
| Latency budget | e.g. p99 < 200ms end-to-end | User, Phase 1 |
| Consistency | Strong / eventual / mixed | User, Phase 1 |
| Availability target | e.g. 99.9% | User, Phase 1 |
| Security/compliance | e.g. PII; SOC2; encryption at rest | User, Phase 1 |
| Team capacity | e.g. 2 engineers, 4-week deadline | User, Phase 1 |

---

## Existing Codebase Context

From explorer agent findings (Phase 0). Anchor every component decision to what already exists.

- **Already present:** [modules, abstractions, patterns the project uses]
- **Closest existing abstraction:** [if the feature extends something]
- **Integration points:** [where this feature plugs in]
- **Conventions to follow:** [naming, layering, error handling style observed]

---

## Considered Approaches

### Approach A — [name]

**Essence:** [one sentence]

**Components & responsibilities:**
- [Component] — [what it owns]
- [Component] — [what it owns]

**Data flow (happy path):**
1. …
2. …

**Tradeoffs:**
- Scalability: …
- Latency: …
- Consistency: …
- Operational complexity: …
- Time-to-build: …

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

**Why:** [Paragraph explicitly tying the choice to constraints from the table above.]

**Final component map:**

```mermaid
[the diagram for the selected approach, possibly refined during Phase 3]
```

**Key boundaries:**

- [Boundary] — what crosses it, what doesn't
- [Boundary] — what crosses it, what doesn't

---

## Risk Register (Devil's Advocate)

Issues the team should know about going in. Each item: what it is, when it bites, mitigation.

| Risk | When it bites | Mitigation |
|---|---|---|
| [Bottleneck X] | Above ~Y throughput | [Cache / shard / async] |
| [SPOF Y] | When Z is down | [Replica / fallback / degrade gracefully] |
| [Hidden cost] | … | … |

---

## What We Did NOT Decide

Open questions left for later. Each should be answerable by the team or by a follow-up brief, NOT silently assumed during implementation.

- [ ] [Open question 1]
- [ ] [Open question 2]

---

## Next Steps

- For an implementation plan: `/bdk:create-plan`
- For a formal decision record on a sub-decision: `/bdk:create-adr`
- For deeper exploration of a specific component: re-run `/bdk:brainstorm-architecture` scoped to that component
```
