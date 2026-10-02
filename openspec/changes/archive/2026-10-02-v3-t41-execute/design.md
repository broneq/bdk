## Context

See proposal.md (Why, and the decisions taken with the user on 2026-10-01). Requirements: `specs/stage-skills`, `specs/kernel-cli/graph`, `specs/kernel-settings`, `specs/role-contracts`, `specs/skill-evals`.

State the design builds on:

- `bdk next` returns the first `ready` or `stale` node in pipeline order. In the execute stage that is one `execute-part:<nn>` instance at a time, whose instruction reads "Execute plan part {node} ... The part closes through `bdk part done`" (`pipeline/execute-part.md`). An `execute-part` instance requires the instances of the parts its part `depends-on`, so the ready instances at any moment are the parts that can run now. `bdk part list` derives each part's `wave` from `depends-on`.
- The orchestration layer (`v3-t41-orchestration`, archived 2026-10-01): a `part-lead` loop (`attempt open part-lead <part>`, budget `policy.budgets.part-lead`), `dispatch build <part> lead <ticket>` with a `Tasks` section that marks committed tasks, the `lead` role and adapter (`Agent(worker, runner, reviewer, scout)`), the lead's four kernel verbs inside its own part, `commit` serialised across leads, `bdk agents wait`, the agent registry, `hooks stop` / `subagent-stop` continuation checks, and escalation on `policy.escalation.model` guarded by `guard/escalation-model`. An `ok` close of a `part-lead` ticket answers `next.action: part-done`; `part start`, `part done` and `change *` stay with `main`. T41-D3 fixed the tree rule (a wave with at least two independent parts runs as a tree; `tiny` and `small` always flat) and left its home, `next`, to this Change.
- `hooks prompt-expansion` writes a plain `transition` to `execute` when the user types `/bdk:execute`, so `hooks stop` treats `main` as being in the execute stage and blocks an early end while `next` has ready work, no background task runs and no question is open.
- The swarm skill (`skills/swarm/SKILL.md`, model-invocable, not user-invocable) holds the principles of a wave: disjoint `Files:`, background dispatch, the package path as the prompt, steps under the ticket, escalation, single resume. Its context carries the `Concurrency` section from `execution.concurrency` (default 5).
- `attempt open` lists `steps` for the code-changing loops (`task-redispatch`, `verify-fix`, `review-fix`): `simplify` (`simplifier`), `tests-scoped` and `lint` (`runner`), in pipeline order. A step node is done from the evidence covering its part; a manifest goes stale when its target's tree hash changes.
- T40 (`docs/V3-EVAL-EXECUTE-AB.md`): the thin execute variant (`evals/suites/execute-ab/variants/execute-thin/SKILL.md`, 84 lines) was "no worse" than the long one; one run in five stopped after part 01. `evals/suites/execute-ab/seed.ts` seeds a `tiny` Change with the audit CSV task (parts 01 and 02, 02 depends on 01) through kernel commands.
- The `stages` eval suite types a slash command in a prepared copy of the fixture; `prepare` is a list of shell lines run with `$BDK`.

## Goals / Non-Goals

**Goals:**

- One `/bdk:execute` takes a Change from a verified plan to the review stage with no further user action, unless the kernel parks it or a question needs the user.
- The choice between flat and tree is the kernel's, visible in `next`, testable without a model.
- A lead runs against the real host at least once (the `tree` eval case) before the stage skills are complete.

**Non-Goals:**

- No change to the orchestration layer's commands, hooks or roles, beyond the swarm skill's wording.
- No Workflow strategy (decision 2).
- No review of the code inside `execute`: the review stage and `/bdk:cr` follow (T42).
- No measured eval series; only `--probe`.

## Decisions

### D1 `next` hands the wave and each part's mode

When the first actionable node is an `execute-part` instance, `bdk next` adds `wave`: one item per ready or stale `execute-part` instance, in part order, with `part`, `started` (a `part start` marker exists), `tickets` (the open `part-lead` and `task-redispatch` tickets of the part) and `mode`. `artifact` and `instruction` stay those of the first instance, so every other consumer of `next` (`hooks stop`, `hooks prompt-expansion`, the stage skills) reads the same fields as before.

`mode` per part:

- a part with an open `part-lead` ticket is `tree`; a started part with only task tickets open, or none, is `flat`, so a part never changes mode mid-way;
- a part not started is `tree` when the effective profile is `large`, `execution.tree.enabled` is true, and the ready parts that are not started number at least `execution.tree.min-parts`; otherwise `flat`.

The rule lives in the graph slice as a pure function of the graph, the effective profile and the two settings, next to the instance states it reads.

- Alternative: a `bdk wave` command. Lost: one more call per round, and a second source of "what runs next" beside `next`, which the stop hook and the skill already read.
- Alternative: mode per wave, not per part. Lost: when one of two tree parts finishes first, the remaining one would flip to `flat` while its lead still runs, and a new ready part of the next wave would join a mode decided for another set.
- Alternative: the skill decides from `bdk part list`. Lost: T41-D3 puts the rule in the kernel so it is reproducible and measurable.

### D2 `execution.tree` settings

A config module `execution.tree`, consumer `graph`, owner T41: `enabled` (boolean, default `true`) and `min-parts` (integer 2 to 15, default 2). The profile condition (`large` only) is not a setting: T41-D3 decided it, and a `small` Change with independent parts stays cheap. `enabled: false` gives a project the flat swarm everywhere, for example while it measures cost.

- Alternative: one enum key `execution.tree: auto|off`. Lost: no threshold to tune once T43 measures where a tree pays off.
- Alternative: no setting. Lost: the user asked for configurable limits (T44) in the same spirit, and a tree costs one extra agent context per part.

### D3 The `execute` loop

The skill loops on `bdk next --json`:

| `next` returns                                                            | The skill                                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| an `execute-part` instance with `wave`                                    | runs every part of `wave` not yet running, in its mode (D4, D5), then waits             |
| `spec-delta`                                                              | `bdk done spec-delta`; a refusal is reported (the deltas were checked at plan time)     |
| a post-task step node (`simplify`, `tests-scoped`, `lint`) of a done part | opens `bdk attempt open verify-fix <part>` and runs that ticket like a task ticket (D6) |
| a node of a later stage, `waiting: gate` or `waiting: nothing`            | finishes (D8)                                                                           |
| `waiting: user` (parked)                                                  | finishes, naming the park question and the resume command                               |
| an earlier stage (the plan not done)                                      | reports what `next` returns and the command it names, and dispatches nothing            |

A pending `review: true` entry or the review gate's status never ends the loop while an execute-stage node is ready: the T40 run that stopped after part 01 read the pending gate items as the end of its work. The skill states that one `/bdk:execute` runs every ready part, and the `execute-part` template names `bdk next` as the step after `bdk part done` (D7). `hooks stop` backs both up.

The skill holds no step script beyond this table: the order of work is the kernel's (`next`, `attempt close` `next.action`), per the prompt-writing convention.

### D4 Flat parts: `main` runs the tickets

For each flat part not started: `bdk part start <part>`. Then `main` is the orchestrator of the swarm skill for the tasks of all its flat parts together: a task is ready when the tasks its `Depends on:` names are committed; ready tasks with disjoint `Files:` start together, up to `execution.concurrency`, each as `attempt open task-redispatch <task>`, `dispatch build <task> implementer <ticket>`, `Agent` in the background with the package path. `main` ends its turn after a dispatch round and is woken by the host's task notification (T41-D9). When an implementer returns with its report stored, `main` dispatches the ticket's `steps` in order under the same ticket, then `attempt close <ticket> ok|fail`, and acts on `next.action`. When every task of a part is committed: `bdk part done <part>`, then `bdk next`.

The skill loads the swarm skill once (Skill tool, `bdk:swarm`) for those principles instead of restating them, as the T40 thin variant did.

### D5 Tree parts: one lead per part

For each tree part not started, up to `execution.concurrency` leads at once: `bdk part start <part>`, `bdk attempt open part-lead <part>`, `bdk dispatch build <part> lead <ticket>`, `Agent` with `subagent_type: bdk:lead`, `run_in_background: true` and the package path (on an escalation ticket also the `model` that `dispatch build` returned). `main` ends its turn. When a lead's notification arrives, `main` reads its envelope and the entries it names, closes the `part-lead` ticket (`ok` for `done` and `done-with-concerns` without a blocker, `fail` otherwise) and acts on `next.action`: `part-done` runs `bdk part done <part>` and then `bdk next`; `retry`, `narrow` and `escalate` open the next `part-lead` ticket, whose lead continues with the tasks not committed (the `Tasks` section marks the committed ones); `parked` stops.

A lead's `SendMessage` to `main` about a critical entry stops new dispatches: running leads finish, and `main` decides on the entry before the next start, asking the user only when the entry needs a decision the plan and design do not hold.

- Alternative: `main` waits with `bdk agents wait` in tree mode. Lost: T41-D9, a blocking call would hold the user's interactive session.
- Alternative: `main` also runs the tickets of one tree part itself. Lost: two orchestrators of one part.

### D6 Steps after the part

A step node that `next` returns for a part that is already done means the part's evidence is missing, stale (a later part changed one of its files) or failed. The skill opens `bdk attempt open verify-fix <part>`, dispatches the ticket's `steps` in order, and on a failing step first dispatches an implementer on the same ticket with the step's findings, then the steps again; `attempt close` decides. The `verify-fix` loop exists for this (`policy.budgets.verify-fix`); this Change adds no kernel rule for it. The kernel E2E suite gains a scenario that drives this path, so a gap shows before the skill relies on it.

### D7 The `execute-part` instruction

`pipeline/execute-part.md` becomes: "Execute plan part {node} of Change {change} as the `wave` of `bdk next` marks it, `flat` or `tree`: one commit per task with its trailer, tests first. Close it with `bdk part done`, then run `bdk next`: one `/bdk:execute` runs every ready part." The instruction skeleton (`kernel-pipeline`, Instruction) is unchanged.

### D8 The closing report

From kernel output only: `bdk part list --json` (parts with state and tasks), the tasks committed this run, open `blocker` and `finding` entries of the Change, the pending `review: true` entries from `bdk change status --json`, and the next command: `/bdk:cr` for the review stage, which the user types, or the resume command of a parked Change. The `review` node has no gate before it, so the report names the stage command `next`'s stage list gives.

### D9 Skill shape

`skills/stages/execute/SKILL.md`: the two context lines (`ctx skill execute`, with `Concurrency` and the `decision` fragment), `disable-model-invocation: true`, `disallowed-tools: Edit Write NotebookEdit`, `allowed-tools` with the kernel pair, `Agent`, `SendMessage`, `Skill`, `Read`, `AskUserQuestion`. Sections: Start, Waves (flat and tree), Envelopes and next actions (two tables, as in the T40 thin variant), After the parts, When the kernel refuses, Finish. Target under 150 lines; the 200-line limit is enforced by the content test.

### D10 Removal of the v2 executor (decision 1)

`skills/subagent-execute-plan/` goes. `references/return-contract.md` moves to `skills/bdk-implementer-return-contract/references/return-contract.md`, and the `ctx` manifest entry of that meta-skill points there, so the v2 agents `implementer` and `fixer` keep their contract until T42 removes them. The `subagent-execute-plan` entries leave `skill-check.baseline.json` (`--baseline-prune`). The generated `STARTUP_INSTRUCTIONS.md` agent table is regenerated from its source, never edited. Docs and README name `/bdk:execute`; the v2 agent pages say "BDK 2 agent; no BDK 3 skill starts it", as for `plan-verifier`.

### D11 No Workflow strategy (decision 2)

`features.workflow` stays unregistered, so a layer setting it gets `policy/unknown-config-key`. The T41 scope line "wave strategy (including `features.workflow` as an option)" and the design's open item "Workflow strategy details" are closed in `docs/V3-IMPLEMENTATION-PLAN.md` with this Change's reason.

### D12 Eval cases and seeds (decision 3)

A stage case gains an optional `seed: <name>`, a function in `evals/suites/stages/seeds.ts` that runs after `prepare` with the working copy and the plugin copy's kernel, the way `execute-ab/seed.ts` seeds through kernel commands. `pnpm eval check` refuses an unknown seed name.

- `flat`: seed `audit-csv`, which reuses `readTask` and `seedV3` of `execute-ab` (`tiny` Change, parts 01 and 02 with 02 depending on 01). Types `/bdk:execute`. Expects `execute-part:01` and `execute-part:02` done, four task commits (`part list` items done), `next` in the `review` stage, and a reply naming `/bdk:cr`.
- `tree`: seed `two-independent-parts`, a `large` feature Change on the fixture with two design parts, `architecture.md`, the design index, a `design-verify` verdict recorded through `attempt open verifier`, `dispatch build`, `log ingest` and `log add report`, the design gate passed through `bdk hooks prompt-expansion` with a recorded `/bdk:plan` payload (as a typed command does), and two plan parts with disjoint files and no `depends-on`: the whitespace fix in `src/ui/format.ts` and the problem-details fix in `src/api/http.ts`, each one task with concrete test cases, plus a verified plan. Expects both parts done, two `part-lead` attempt records closed `ok`, and the review stage next.
- `not-ready`: a `tiny` Change whose plan part is written but not done. Expects no task commit, no attempt record, and a reply naming `/bdk:plan` (the command `next`'s stage names).

The `stages` requirement asks for a refusal case per skill; `not-ready` is it, since the prompt-expansion guard does not block `/bdk:execute` before the plan is done.

- Alternative: shell `prepare` lines only. Lost: the tree seed is about twenty kernel calls with files between them; a TypeScript seed is testable without a model (`seeds.test.ts` asserts `next` returns `wave` with two `tree` parts after it).

### D13 One working tree, no file held twice (user decision 2026-10-02)

The first `tree` probe deadlocked two leads: `bdk commit` checked the whole dirty tree against the part's `do-not-touch` and refused each part over the other part's uncommitted files. Parts run in one working tree, so the kernel makes collisions impossible instead of leaving agents to negotiate:

- The diff check leaves a path that an uncommitted task of another started part declares to that task: not a `do-not-touch` breach, not undeclared, not committed with this task (`kernel-loops`, Diff check).
- `attempt open` of `task-redispatch` or `verify-fix` refuses `policy/files-busy` while another open ticket of those loops holds a file of the target's `Files:`, in any part. The guarantee holds whoever dispatches, `main` or a lead.
- `wave` leaves out a part not started whose `Files:` overlap a started part or a part listed before it, so no lead starts only to wait.
- The `execute` skill and the lead contract forbid git commands that discard or hide work (stash, reset, clean, restore), as the role contracts already did.

Overlapping `Files:` run in sequence, never in separate worktrees: a worktree only moves the conflict to the merge. Isolation for disjoint parts with hidden shared state (lockfile, codegen, whole-project build, shared test resources) is a judgment the planner makes per part; that is T45 (#107).

## Risks / Trade-offs

- [A lead or `main` misreads an envelope and closes `ok` with a blocker open] → `attempt close` runs the kernel's own checks (evidence, open tickets for `part-lead`); `part done` refuses with open tickets or missing trailers.
- [The tree case costs much more than flat] → probe only, one run per case; the projection is shown before any series, and the live budget is asked for before the probe.
- [The verify-fix path after a part has no kernel test today] → D6 adds an E2E scenario first; a gap found there is fixed in this Change before the skill relies on it.
- [Two parts of one wave, flat, touch one file] → the plan verifier blocks it (`role-contracts`, between parts), and the swarm's disjoint-`Files:` rule holds the second task back.
- [`main`'s context grows in flat mode on a big `small` Change] → the tree is the remedy on `large`; T43 measures where `min-parts` and the profile rule should sit.

## Migration Plan

No user data migrates. Projects with a v2 plan under `.bdk/plans/` lose `/bdk:subagent-execute-plan`; the v3 path is `/bdk:change` and `/bdk:plan`, and `/bdk:setup` already removes the v2 files after asking. Rollback is a revert of the Change's commits.
