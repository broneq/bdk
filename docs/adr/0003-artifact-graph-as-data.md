---
status: accepted
date: 2026-09-25
decision-makers: {TBD}
consulted: {TBD}
informed: {TBD}
---

# ADR-0003: The Change process is an artifact graph held as data, with artifact kinds coded in TypeScript

## Context and Problem Statement

In BDK v2 the process lives in skill prose: the executor skill is over 600 lines, budgets are sentences the model may ignore, and `run_state` records what happened only when a skill remembers to call it, so it cannot refuse anything. v3 moves the process into a kernel (ADR-0002), and the kernel has to know "what is next" for a Change. The three candidate architectures share one foundation (kernel bundle, Change directory, ledger and dispatch packages, spec handling, configuration layers) and differ only in where that knowledge lives: in a declarative graph, in a state machine coded in the kernel, or in the skills. Register entry: A-podejście (`docs/v3/2026-09-23-0703-bdk-v3-decisions.md`, step 2A.2, round 1).

## Decision Drivers

- **A project adds a gate without a BDK release** (D3). Project policy must be able to put a human gate after the plan, or a post-task step, without a kernel flag that BDK anticipated.
- **Announced modules without skill edits.** Design assistance, artifact search and pattern recognition are planned; each should cost a new kind and a graph node, not a round of edits in every stage skill.
- **Thin skills** (S1, a skill of at most 200 lines). This is realistic only when the post-task order and the wave strategy leave the execute skill.
- **The kernel refuses, the model does not decide** (S2, Q3 fail-closed). Budgets, gates and readiness are enforced in code, and a refusal names its reason.
- **Debuggability.** "Why is X blocked" must have a one-command answer.
- **The graph must not become a programming language.** A YAML file that grows conditions is harder to debug than code.

## Considered Options

1. **Approach A with B's spine: the artifact graph as data** - `pipeline.yaml` shipped by BDK and extended by project `policy` lists which artifact kinds exist, in which order, with which budgets; the kinds, their validators and their transitions are TypeScript; the kernel computes ready / blocked / done and hands skills the next artifact with an instruction.
2. **Approach B: an explicit state machine in code** - fixed Change states (`intent`, `designed`, `planned`, `verified`, `executing`, `reviewing`, `closing`, `parked`, `abandoned`) and typed transitions in TypeScript; each stage skill calls stage-specific commands (`bdk design done`, `bdk part start 03`); policy is flags.
3. **Approach C: the evolved monolith** - today's architecture ported to Node: skills orchestrate in prose, `run_state` gains a ledger, counters and configuration layers.

## Decision Outcome

**Chosen option: 1, the artifact graph as data with a typed spine**, because it is the only option in which a project adds a gate or a post-task step without a BDK release (D3), the announced modules become new kinds and graph nodes instead of skill edits, and S1 becomes reachable once the stage order and the post-task order leave the skills. B's strength, a state machine with precise refusals, is kept as the spine: every kind and transition is TypeScript, and YAML only arranges them.

### Consequences

- ✅ Skills never know the stage order: each runs the same loop "`next`, do, report" with a role, and `/bdk:change` resumes anywhere.
- ✅ A new module is a kind in TypeScript plus a node in YAML; a test with a fake kind proves that no skill changes (T21).
- ✅ `done` comes only from a kind's validator (schema, non-emptiness, sha256 of the inputs), never from a file existing, which closes the OpenSpec `existsSync` failure mode; a verdict for a different input hash is `stale` (P2).
- ✅ Profiles `tiny`, `small` and `large` and the Change kinds `feature` and `bug` are graph variants, not skill branches (S7).
- ❌ Debuggability is weaker than B's: "why is X blocked" needs `bdk explain <artifact>`, so `explain` is mandatory and tested from the first release.
- ❌ The kernel carries 15-25 % more code than B (graph engine plus a validator per kind), in exchange for smaller skills and less process prose.
- 🟡 If the promptfoo A/B of thin skills driven by CLI output against long skills fails, the fallback is B with the same kernel: the difference lives in the skills, not in the data.

### Implementation Requirements

- [ ] `pipeline.yaml` and `policy` validated with zod; no expressions beyond `if: features.X`, no loops, no references outside the Change directory; a content test rejects unknown keys such as `when:` (T21).
- [ ] Artifact kinds with validators in TypeScript; `done` only after the validator, with the input hash recorded (T21).
- [ ] `bdk next`, `bdk explain`, `bdk validate`, `bdk done`; `explain` tested from the first release (T21).
- [ ] The `gate` kind done only on a `transition` entry with `source: user` newer than the node's last transition into ready (T21, T24).
- [ ] promptfoo A/B of thin skills against long skills before all skills are rewritten.

## Pros and Cons of the Options

### Approach A with B's spine: the artifact graph as data

- ✅ Extensibility is the best of the three: a project gate is a node in YAML, a new module is a kind plus a node.
- ✅ Workflow as an execution strategy (Q4) is a node attribute, not a skill branch.
- ✅ The execute skill loses the wave strategy and the post-task order, so S1 holds.
- ❌ The largest build of the three (graph engine and per-kind validators); build time did not drive the choice.
- ❌ The YAML could grow conditions over time; mitigated by allowing only `if: features.X` and enforcing it with a content test.

### Approach B: an explicit state machine in code

- ✅ The best debuggability: a refusal says "part 03 cannot start because part 02 is not done".
- ✅ The smallest kernel of the kernel-based approaches.
- ❌ Project policy is limited to flags BDK anticipated; D3 (a project-defined gate) cannot be met.
- ❌ Every new module touches the kernel and at least one skill; three announced modules are three rounds of skill edits.
- ❌ The execute skill keeps the wave strategy and the post-task order, realistically 250-300 lines, above S1.
- ❌ 40-50 stage-specific subcommands, where v2's `bdk_run_state.py` already has 18 and grows per feature.

### Approach C: the evolved monolith

The baseline that accumulates without an architectural decision.

- ✅ No new architecture; the smallest step from v2.
- ❌ Fails S1 (the executor stays over 600 lines), S2 (budgets stay prose, and the kernel cannot refuse because it does not know the process) and S3 (the intent has no home).

## More Information

- Design `docs/v3/2026-09-23-0703-bdk-v3-change-centric-design.md`, sections "Considered Approaches" (A, B and C with their diagrams) and "Selected Approach: A with B's spine"; the artifact kinds and the example `pipeline.yaml` on design page 04 (`docs/v3/bdk-v3-design-04-doprecyzowanie.html`, section 4).
- Also rejected with the decision (Q4): Workflow as the orchestration core; it stays an execution strategy for waves under `features.workflow`.
- Implemented by T21 (graph engine, `next`, `explain`, gate) on top of T20 (Change directory, `store`); the gate hook arrives in T24.
