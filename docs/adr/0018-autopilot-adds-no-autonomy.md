---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by: none
measured-by:
  - plugins/bdk/evals/run-two-prs
  - plugins/bdk/evals/run-resume
  - plugins/bdk/evals/run-waiting-blocker
  - plugins/bdk/evals/run-queue-from-issues
  - plugins/bdk/evals/run-needs-user
---

# ADR-0018: `/bdk:run` adds no autonomy - it never answers for the user, and a stage that does not reach its end stops the whole queue

## Context and Problem Statement

`/bdk:run` drives a queue of Changes through every stage to a pull request each ([ADR-0003](0003-v3-architecture-skills-first.md), [ADR-0007](0007-no-stacked-pull-requests.md)). Draft 1's autopilot took the recommended answer of every question to keep going. An autopilot could also skip a stuck Change and continue with the next independent one. How much may the autopilot decide on its own, and what does it do when a stage does not finish?

## Decision Drivers

- **The project's policy decides:** a team sets how autonomous each stage is (`policy.questions`, `policy.gates.*`); the autopilot must not override it.
- **Every decision recorded:** a decision taken without the user must be one a stage took and wrote down.
- **No spending on a shared cause:** a stage that stops often stops for a reason the next Change shares (environment, configuration, a red suite).
- **Unattended throughput.**

## Considered Options

1. **No own autonomy, stop the queue:** the autopilot only calls stages; a stage that does not reach its end stops the run.
2. **Answer for the user:** take the recommended answer of each question or gate, as in draft 1.
3. **Park and continue:** mark a stuck Change and go on with the next independent one.

## Decision Outcome

**Chosen option: 1.** Autonomy is set per stage by `policy.questions` and `policy.gates.*`, never by `/bdk:run`: it passes no option a stage would not get from a user, answers no question and passes no gate. When a stage ends without moving its Change on (a question or gate for the user, a blocked part, a spent budget, a failing spec conformance, a failed push), the run stops: it starts no other Change and names the Change, the stage and the stage's own reason, and `/bdk:run` continues once the cause is resolved.

Two cases do not stop the queue, because nothing in them has failed: a Change whose blocker in the queue has no merged pull request waits ([ADR-0007](0007-no-stacked-pull-requests.md)), and a Change whose scope log holds an open `By: needs-user` entry is marked `needs-user` in `run.json` and skipped until the entry is answered. Both are listed in the final report.

It is the only option that leaves every decision to the project's policy and the stages that record it.

### Consequences

- ✅ An unattended run decides exactly what the project allows its stages to decide, and records it.
- ✅ A stop never spends tokens on other Changes that may share its cause.
- ❌ An "autopilot" that stops on the first open question or blocked part; unattended runs need `decide-and-record` and `auto` gates to go far.
- 🟡 Parking a stuck Change is rejected for v3.0 until a measured unattended run shows that independent Changes would have finished.

## Pros and Cons of the Options

### 1 - No own autonomy, stop the queue

- Good: honours the project's policy; one source of every decision; no waste after a stop.
- Bad: lower unattended throughput.

### 2 - Answer for the user

- Good: the run rarely stops.
- Bad: decisions nobody allowed and nobody recorded; draft 1's behaviour.

### 3 - Park and continue

- Good: independent Changes still reach review.
- Bad: tokens spent on Changes that may fail for the same cause; a queue of half-finished Changes to untangle.

## More Information

Sources: archived Changes of #203 (D5, D6) and #422 (the `needs-user` mark). The run cases grade the stage order, resume, waiting and the `needs-user` skip; none grades the stop on a stage that did not reach its end. The flow is drawn in [Concepts: the workflow](../concepts/workflow.md#autopilot-bdk-run-over-a-queue).
