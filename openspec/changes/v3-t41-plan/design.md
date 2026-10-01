## Context

See proposal.md (Why, and the decisions taken with the user on 2026-10-01). Requirements: `specs/stage-skills`, `specs/kernel-pipeline`, `specs/role-contracts`.

State the design builds on (probe in a scratch repository with the current bundle, 2026-10-01, unless noted):

- After `gate:design` (passed by a typed `/bdk:plan` through `hooks prompt-expansion`), `bdk next` returns `plan`, kind `plan-part`, with an instruction that lists the `code-quality`, `architecture` and `test-quality` rules and none of `BDK-PL`. It ends with "Run `bdk done plan` ... or `bdk done plan-part:<nn>`". After `bdk done plan`, `next` returns `plan-verify`.
- `plan-part` checks a part on `done`: size (8 KB), tasks (1 to 8), `do-not-touch` against `Files:`, placeholders, the task grammar of `kernel-state`, and `spec-impact` (every named capability has a delta under `spec-delta/` that passes `spec delta check`; a `large` Change must declare it). The `spec-delta` node itself is in the execute stage, so before this Change nothing wrote the delta that `done plan` requires.
- `plan-verify` requires only `plan`, hashes the plan parts and nothing else. `attempt open verifier plan-verify` and `dispatch build plan-verify verifier <ticket>` work; the package's "Read" names the plan parts only, so the verifier never sees the design. Its rules include `BDK-PL-1..3` (role selection of the verifier).
- `artifactPaths` (`kernel/src/graph/use-cases/paths.ts`) names in a package the files of the node and of every node it requires; a required node absent from the Change's graph variant is skipped.
- The `verifier` contract (`skills/roles/verifier/SKILL.md`) says "You verify the plan part the package names" and checks six points per task. The P8 list makes `files-bookkeeping` "not a FAIL"; `unresolved-decision` covers "an execution-critical unresolved decision or omitted requirement".
- `verify-design` (v3-t41-design D3) is the pattern for a verifier round in the main thread: `guard/subagent-kernel-command` denies `attempt open` and `dispatch build` to a forked skill.
- `execute-ab` (`evals/results/execute-ab/report.md`, 2026-09-29) executed a contract-style plan (`evals/suites/execute-ab/task/parts/01-audit-csv.md`: 2.4 KB, two tasks, behaviour stated in sentences, concrete test cases, no code) with the worker on the balanced tier: acceptance 1 and completeness 1 in five of five runs.
- The v2 `create-plan` (265 lines) holds what is worth keeping: grounding before writing, task sizing, waves from dependencies, sharp test cases. Its fenced implementation blocks, explorer phases and single plan file under `.bdk/plans/` do not carry over.

## Goals / Non-Goals

**Goals:**

- A user-only `plan` that takes a Change from `gate:design` (or from the intent of a `bug` or `tiny` Change) to a verified plan with as few user actions as possible.
- A `verify-plan` that gives the same verdict whether `plan` or the user starts it, over the whole plan and the design.
- A plan whose tasks a worker on the balanced tier can execute without guessing behaviour.

**Non-Goals:**

- No wave strategy, lead tree or dispatch of tasks (`v3-t41-execute`).
- No per-task model tier in the plan grammar (decision 3; candidate for T43).
- No change to the plan part grammar or its limits (`kernel-state`).
- No measured eval series; only `--probe`.

## Decisions

### D1 `plan` follows `next`; the conversation decides the split

The skill loops on `bdk next --json` as `design` does (v3-t41-design D4): read the instruction, write what it names, `bdk done plan`, then the verdict node. Before the first write it reads:

1. `bdk change status --json` and the design files that exist (`design.md`, `architecture.md`, `design/parts/`), or for a `bug` or `tiny` Change the intent in `change.md`;
2. the ledger: accepted decisions and live questions (`bdk log list --type decision|question --json`);
3. the code each task will touch, itself or with the host's read-only search agent (no `bdk:scout`: from the main thread it needs a ticket, as in D4 of the design Change).

Splitting: one part per cohesive unit a lead can finish and commit on its own, at most 8 tasks and 8 KB; tasks that share files stay in one part; parts with no dependency between them land in the same wave, which `bdk part list` derives from `depends-on`. For a `large` Change the design parts suggest the split, but the plan's parts follow dependencies, not the design's grouping. A part over the limits is split with `bdk part split`, not shortened by dropping test cases.

Before `bdk done plan`: spec deltas for every capability in `spec-impact`, checked with `bdk spec delta check`; the `BDK-PL` rules of the instruction ticked by id (D6 adds them); live questions settled (answer from the design or the code, else ask; record a `decision` and resolve the question).

- Alternative: keep the v2 phases (explorer subagents, approach selection, sizing table). Lost: approaches are decided in the design; the kernel checks sizing; the phases cost turns without changing the output.
- Alternative: one part per design part on `large`. Lost: design parts group by subsystem, parts must group by what can be built and committed together; a subsystem's work often spans waves.

### D2 Task shape: contract and test cases

The body of `SKILL.md` states the shape in a few lines; `references/task-shape.md` holds one worked part modelled on the `execute-ab` part (a task with a signature, behaviour sentences, `Files:`, concrete `Test cases:`, a `Stop rule:`), and the contrast with a task that names topics instead of cases. A fenced block is allowed only for an exact external format (wire format, file format, command line).

The rule "every stated behaviour has a case" is written into the skill and into the verifier contract (D7), not as a new `BDK-PL` rule: a pack rule needs a `rules-noop` measurement before admission (`.claude/rules/quality-rules.md`), and the skill and contract are checked by the eval cases of this Change.

- Alternative: implementation code per task as in v2 (decision 1). Lost: two to three tasks per part, code that goes stale when an earlier task turns out differently, tests written to match given code.
- Alternative: code where words do not fix one result. Lost: a judgment the planner gets wrong in both directions; concrete test cases already fix the result.

### D3 The self-correcting loop

After `bdk done plan`, when the graph holds `plan-verify` (`small` and `large`), `plan` runs `/bdk:verify-plan` and acts on the verdict (decision 6):

| Verdict content                                                                                                                                                              | Action                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Blocker whose fix changes no recorded decision (`false-code-claim`, a behaviour without a case, an uncovered design requirement the design states, an undeclared dependency) | correct the part, `bdk log resolve <id> resolved --reason`, no question                                              |
| Blocker whose fix needs a decision the design does not hold                                                                                                                  | one question for all such blockers, each with a proposed fix; record the answers as `decision` entries, then correct |
| Finding of `done-with-concerns`                                                                                                                                              | judge "fixed" or "goes to execution" with a reason; fix the first kind                                               |
| `next.action` `retry` or `narrow`                                                                                                                                            | `bdk done plan`, `/bdk:verify-plan` again                                                                            |
| `next.action` `escalate`                                                                                                                                                     | `/bdk:verify-plan`, which opens the round with `--escalate`                                                          |
| `next.action` `parked`                                                                                                                                                       | stop: the resume command and the remaining blockers                                                                  |

The loop ends on a passing verdict with no live blocker. The kernel's verifier budget (two attempts, then escalation) bounds it; the skill adds no counter of its own.

"Changes a recorded decision" is tested against the ledger and the design text: a fix that contradicts an accepted `decision` entry or a sentence of the design is asked, everything else is fixed.

- Alternative: ask about every blocker as `design` does for non-fact blockers. Lost (user choice): the user wants as few actions as possible, and a plan blocker is usually a fact about the plan, not a product choice.
- Alternative: no loop, report the verdict. Lost: the user would retype `/bdk:plan` for corrections the coordinator can make.

### D4 Report by default, `--review` on request

`plan` ends with the report of the `stage-skills` requirement "plan ends with a report", built from `bdk part list --json`, the ledger and `bdk change status --json`, and names `/bdk:execute`. Arguments: `--review` is read from `$ARGUMENTS`; any other text is a focus the user gives the plan ("keep the migration in its own part"). With `--review`, after the verdict passes, the skill shows the plan in one review (rich decision: Lavish when on), accept or change; a change is written, marked done, verified again, and shown again. There is no `gate:plan`; the user's typed `/bdk:execute` is the acceptance (decision 7).

- Alternative: always review (rejected by the user: one more action per plan).
- Alternative: review only on `done-with-concerns`. Lost: two endings to test, and a clean verdict says nothing about whether the split suits the user; `--review` covers that on request.

### D5 `verify-plan` mirrors `verify-design`

The body is `verify-design`'s with the node `plan-verify` and the role `verifier`: `attempt open verifier plan-verify` (on `policy/not-ready`, name `instead`; on an `--escalate` hint, reopen escalated), `dispatch build plan-verify verifier <ticket>`, `Agent` with `subagent_type: bdk:reader`, the package path as the prompt and the build output's `model` when present, foreground; check the stored report and its `report` entry, resume once on a miss; `attempt close ok|fail --envelope`; `done plan-verify` on a pass with no live blocker; report blockers by category and the `next.action`. One agent per round over every part (decision 4).

- Alternative: `context: fork` with `agent: bdk:reader`, as the T41 plan sketched. Lost: the same as D3 of v3-t41-design; the fork is a subagent and the guard denies it `attempt open`.
- Alternative: one verifier per part, in parallel. Lost (decision 4): no view across parts, several tickets on one node.

### D6 Kernel: rules, requirements and hash of the plan stage

- `pipeline.yaml`: `plan` gets `rules: [code-quality, architecture, test-quality, plan]`; `plan-verify` gets `requires: [plan, design, design-index, architecture]`.
- With the design nodes in `requires`, `artifactPaths` names the design files in the verifier's package with no code change, and the `fresh` check compares the report with the latest `done` of the design too. A design change after the gate is rare (a new design pass), and then the plan deserves a new verdict.
- `PlanVerifyKind.inputs` adds every file of `spec-delta/` to the plan parts, so an edited delta stales the verdict, as an edited part does (P2).
- `pipeline/plan-part.md`: the task shape in one line (contract, concrete test cases, no implementation code) and "write the spec deltas of `spec-impact` before `done`". `pipeline/plan-verify.md`: names `/bdk:verify-plan`, like `design-verify.md`.

- Alternative: a new field on a node listing context files for its package. Lost: a second way to name files for a package, while `requires` already expresses "the verdict is about these"; it would also leave the verdict fresh across a design change.
- Alternative: let the verifier read the design through `bdk change status` on its own. Lost: the role reads only what its package names, by contract.
- Alternative: hash the deltas in `plan-part` instead. Lost: `plan-part` is per part; a delta belongs to the plan as a whole, like the verdict.

### D7 The verifier contract verifies the whole plan

`skills/roles/verifier/SKILL.md`: "You verify the plan parts the package names, together, against the code and the design documents it names." Per task the six checks stay, with check 5 sharpened (each case names an input and an expected result; every stated behaviour has one). Across the plan: design coverage, `depends-on` between parts, one file in two parts of one wave, a signature changed in one part and used in another, a function body in a code block (finding). Categories follow P8: a behaviour without a case and an uncovered design requirement are `unresolved-decision` ("omitted requirement"); a file missing from `Files:` stays `files-bookkeeping`, not a FAIL.

- Alternative: a separate `plan-verifier` role. Lost: the role list is fixed at nine (`role-contracts`, Role skills); the `verifier` role exists for exactly this node.

### D8 Layout, manifest and removal

- `skills/stages/plan/` (`SKILL.md`, `references/task-shape.md`) with `disable-model-invocation: true`, `argument-hint: "[--review] [focus]"`; `skills/stages/verify-plan/SKILL.md`, model-invocable.
- Manifest: `plan: [rules("plan"), rules("engineering-judgment"), rules("test-quality"), languageRules, projectRules, decision]`. The architecture and code-quality rules reach the planner through the node's instruction already; the test-quality rules are repeated in the context because the test cases are the core of the plan. `verify-plan: []`; the `create-plan` entry is removed.
- `skills/create-plan/` and `skills/verify-plan/` are deleted in the commit that adds the new skills; their `skill-check` baseline entries are pruned. `skills/debug/SKILL.md` Phase 5b tells the user to open a bug Change with `/bdk:change` and type `/bdk:plan`, since `plan` is user-only. `agents/plan-verifier.md` and the `STARTUP_INSTRUCTIONS.md` agent table stay until T42.

### D9 Eval cases

`evals/suites/stages/cases/plan.yaml` and `verify-plan.yaml`; `STAGE_SKILLS` gains both; every case prepares `features.lavish false`.

- `plan/bug`: prepare opens a `bug` Change on the fixture with a reproduction (a wrong fallback in `formatTimestamp`); the command is `/bdk:plan`; expects `plan` done, `plan-verify` done, and no fenced function body in the parts. A `bug` Change has no design stage, so the case needs no prepared verdict.
- No `plan/no-change` case: without an active Change the prompt-expansion guard blocks the typed `/bdk:plan` before any model turn, so the run has no model to count; the kernel's hook tests cover that block.
- `verify-plan/clean`: prepare opens a `bug` Change, writes one part that agrees with the fixture and runs `bdk done plan`; expects `plan-verify` done.
- `verify-plan/false-claim`: the same with a task modifying a function the fixture lacks; expects a live `false-code-claim` blocker naming `plan-verify`.
- `verify-plan/not-ready`: the part written but not done; expects no ticket and a reply naming the refusal's `instead`.

A feature Change after `gate:design` is covered by the kernel tests of D6 and by the T41 acceptance E2E, not by a case: its prepare would need a full design verdict round.

### D10 Documentation

`docs/guide/reference/skills.md` (`/bdk:plan`, `/bdk:verify-plan`, `create-plan` gone), `reference/artifacts.md` (plan parts, spec deltas written by `plan`, `plan-verify`), `concepts/plan-pipeline.md` and the workflow and getting-started pages that name `/bdk:create-plan` or `/bdk:verify-plan`, README's skill table; rewritten pages join `V3_PAGES`.

## Risks / Trade-offs

- [A typed `/bdk:plan` on a `bug` Change meets a stage-command check written for feature Changes] → probe it first (task 1.1); a refusal there is a kernel fix in this Change.
- [The loop runs long on a plan with many blockers] → the kernel's verifier budget bounds it; `parked` ends the skill with the resume command.
- [Contract tasks leave room a worker fills wrongly on a hard task] → concrete test cases and `Stop rule:` bound it; escalation catches a failing task; a per-task tier waits for a T43 measurement.
- [Adding design nodes to `plan-verify`'s `requires` changes graph tests that list its requirements] → update them in the task that changes `pipeline.yaml`, tests first.
- [`debug` still names v2 flow elsewhere] → only the handoff changes here; `debug` is redesigned in T42.

## Migration Plan

No user state migrates; v3 is unreleased. A Change built during v3 work with `plan-verify` done gets a new hash (deltas included) and becomes `stale` until verified again. v2 plans under `.bdk/plans/` and stamps under `.bdk/verify-plan/` are not read; `/bdk:setup` already offers to delete v2 output.
