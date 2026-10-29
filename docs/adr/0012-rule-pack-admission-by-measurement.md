---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/tests/rule-pack.test.ts
---

# ADR-0012: The BDK rule pack holds a rule only while a measurement shows that it changes the outcome

## Context and Problem Statement

The rules a designer, planner, implementer or reviewer reads go into its prompt. Every rule costs prompt space in every agent that reads it, and a model already follows many of them by itself. Draft 1 shipped 85 rules and kept every rule that was not a measured no-op; its measurement (`docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md`) showed a measurable effect for 16 of them, and none for the 9 security rules, which a reviewer finds without the rule. Teams also need to change what the pack says for their project. Which rules ship in the BDK pack, and how does a team change one?

## Decision Drivers

- **Prompt cost and noise:** a rule that changes nothing still costs tokens and attention in every role that reads it.
- **Evidence over intuition:** a pack rule is kept by a result, not by how reasonable it sounds.
- **Teams own their rules:** a project's own rules need no measurement.
- **Visible changes:** a team's change to a pack rule must show in its settings, and a pack update must not change it silently.

## Considered Options

1. **Admission by measurement:** a pack rule names its measurement; an unmeasured rule is out.
2. **The draft 1 admission:** keep every rule that is not a measured no-op.
3. **Keep the `unclear` rules** whose measured median leads, within noise.
4. **Override by id:** a project rule with a `BDK-` id replaces the pack rule.

## Decision Outcome

**Chosen option: 1, with a team changing a pack rule by switching it off and adding its own.**

- **A pack rule names its measurement** in its `measured` field: a report in this repository, the bullet it measured, and its class, `effective` (a review with the rule in its prompt finds the seeded violation measurably more often than without it) or `corrects the model` (a model answered the rule's question against it). A rule without one is not in the pack. The draft rules were cut from 85 to 16, all 9 security rules among the dropped. A dropped rule comes back only through a new measurement that shows its effect.
- **The test checks admission, not the CLI.** `plugins/bdk/tests/rule-pack.test.ts` opens the named report and requires its row. `bdk rules for` selects rules and never judges admission ([ADR-0003](0003-v3-architecture-skills-first.md)).
- **Project rules need no measurement.** A team declares them in the `rules` map of its settings ([ADR-0008](0008-configuration-layers-required.md)); its ids never start with `BDK-`.
- **A team changes a pack rule by disable-and-add.** A `BDK-` entry in `rules` holds only `enabled`, `paths` and `stages`: it switches the pack rule off or narrows where and when it applies, and never rewords it. To say something else, a team switches the pack rule off and adds its own rule.

It is the only option that keeps the pack small enough to be worth its prompt cost and makes every change of a team to a pack rule visible in its settings.

### Consequences

- ✅ Every pack rule traces to a measurement row; the pack is small and its gaps in numbering are the dropped rules.
- ✅ A team's change to a pack rule is a line in its settings, and a pack update never rewrites a project's own text.
- ❌ Re-admitting a dropped rule, security rules included, needs a paid measurement.
- ❌ The pack has no security rules; security review comes from the reviewer's own judgement and the project's rules.
- 🟡 How much a broken rule weighs is not this decision: a rule break is a finding whose level follows product behaviour ([ADR-0006](0006-finding-levels-follow-product-behaviour.md)).

## Pros and Cons of the Options

### 1 - Admission by measurement

- Good: prompt space spent only where it changes the outcome; one test holds the gate.
- Bad: breadth of guidance lost; paid measurements to grow the pack.

### 2 - Draft 1 admission

- Good: broad guidance.
- Bad: keeps 69 rules without a measured effect; the aggregate gain does not say which rules carry it.

### 3 - Keep leading `unclear` rules

- Good: a few more rules that may help.
- Bad: the report itself calls the lead within noise.

### 4 - Override by id

- Good: one entry rewords a rule.
- Bad: a silent override is harder to see than disable-and-add, and a pack update would then change nothing for that project without any sign.
