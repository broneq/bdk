---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - tests/admitted-skills.test.ts
---

# ADR-0025: A skill of a plain-skill plugin ships only with recorded with/without eval evidence

## Context and Problem Statement

`bdk-craft` and `bdk-explain` are plain-skill plugins: skills only, no hooks, agents, CLI or `!` block, each installable without `bdk`. A craft skill (TDD, debugging, refactoring, diagrams) is easy to write and reads well, but a current model often does just as well without it, and every shipped skill costs context in every session that loads the plugin. Which skills of such a plugin ship?

## Decision Drivers

- **Effect over no plugin:** a skill earns its context cost only when it changes the outcome.
- **Evidence over judgement:** a well-written skill and a useful skill are not the same thing.
- **Cost:** every with/without run is paid, locally only (ADR-0002).
- **Noise:** a run-to-run flip moves a case score by about 0.04, so a threshold has to sit above that.

## Considered Options

1. **Admission by a recorded with/without eval** against a fixed threshold.
2. **Admission on review:** a skill ships when a reviewer judges it good.
3. **Admission by a with-arm score alone**, without a run with no plugin.

## Decision Outcome

**Chosen option: 1.** A skill under `plugins/<plain-skill plugin>/skills/` ships only when its eval cases under `evals/`, run with `claude plugin eval` with the plugin and with no plugin, show an effect:

- at least two cases per skill, each run at least three times per arm;
- the mean of the skill's per-case `Δ` (with-arm score minus without-arm score) is at least `+0.10`;
- the skill fired in at least half of its with-arm runs (the unscored `tool_used: Skill` indicator).

Graders grade the behaviour the task needs, never the skill's own wording, and the agent and judge models are pinned and recorded. `evals/RESULTS.md` of the plugin records every candidate: its cases with `WITH`, `W/OUT` and `Δ`, the fired count, the models, the Claude Code version, the date and a verdict, `admitted` or `rejected`. A rejected skill is deleted together with its cases; its numbers stay in `RESULTS.md`. `tests/admitted-skills.test.ts` fails when a skill directory has no `admitted` row, an `admitted` row has no skill directory, or a shipped skill has fewer than two cases.

Option 2 ships context that changes nothing; option 3 cannot tell a skill's effect from what the model does anyway.

The same question for a block of `bdk` (does it change the outcome) is ADR-0003; this ADR fixes the threshold and the record for the plain-skill plugins.

### Consequences

- ✅ Every shipped craft skill has a measured effect, and the record says what it was measured with.
- ✅ Skills that read well and do nothing are gone (`api-design`, `oop-design`, `modularizing` were rejected).
- ❌ A new or rewritten skill costs a paid series of runs before it ships.
- 🟡 Every verdict is against `+0.10` over 3 runs per arm; changing the threshold or the run count reopens all of them.
- 🟡 A newer model can erase a skill's effect; the record names the model it was measured on, and a re-run can reject it later.

## Pros and Cons of the Options

### 1 - Recorded with/without eval

- Good: measures the effect itself; the record is checkable by a free test.
- Bad: paid runs per skill; three runs per arm is small and leaves a margin over the noise only, not a tight estimate.

### 2 - Admission on review

- Good: free and fast.
- Bad: judges the text, not the effect; no way to tell a skill the model does not need.

### 3 - With-arm score alone

- Good: half the runs.
- Bad: a high score with the skill says nothing when the plain model scores the same.
