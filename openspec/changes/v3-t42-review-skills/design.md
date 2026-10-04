## Context

See proposal.md, Why. The kernel side of review is merged (#112, `v3-t42-review-kernel`): ticket references `<ticket>@<group>`, `bdk review plan`, the `tests-full` and `lint-full` nodes with coverage, `bdk log triage`, the `merge` report as the `review` verdict, `review.risks` and the `integration-reviewer` role. `kernel/src/review/tests/round.e2e.ts` runs one round with kernel commands only, and it is the call sequence the new `cr` follows. The decisions of the four Lavish rounds (`.lavish/t42-review-process.html`: A1, B1, R1-R3, C1, T, K, M, D1, E) are fixed. Three more were taken on 2026-10-03, before this design: the review Change kind, the read-only `pr-review` contract, and delta fix rounds.

Writing the specs exposed four gaps in the merged kernel, which this Change closes:

- No command commits a review fix. `bdk commit` takes a task and refuses while the task's ticket is open. A commit with only `BDK-Change` breaks `Progress from git`.
- An `implementer` package for the Change target embeds only the entries whose refs name the Change. A reviewer's `finding` that the coordinator triages `blocker` names files, so the fix implementer would not see it.
- `change new --inferred` produces a Change whose `review` node waits on plan and execute. Its base is the commit of `change.md`, so a review of earlier work has an empty range.
- `bdk rules show` needs a ticket, and a PR reviewer has none.

## Goals / Non-Goals

**Goals:**

- One review engine for a pipeline Change, a review of existing work and a manual re-review, driven only by kernel output.
- `/bdk:run` goes from intent to `/bdk:close` without the user typing `/bdk:cr`.
- Delete every v2 agent and meta-skill whose job an adapter, a role or a kernel command now does.

**Non-Goals:**

- The human report, Lavish serving and decisions per finding (`v3-t42-review-report`).
- Changing `review plan` grouping or the verdict checks. They are merged and measured by M.
- Parallel PR reviews in `pr-review` (see D7).

## Decisions

### D1. `cr` is a coordinator over one ticket per round

One round is one `review-fix` ticket:

1. `attempt open`;
2. a fix of the blocking entries left by the previous round, if any;
3. `review plan`;
4. the group packages and the gate runner, started together through the swarm skill;
5. triage;
6. the `merge` report;
7. `attempt close`.

The order follows `round.e2e.ts`. The fix comes first in the next round because `attempt close fail` is what spends the budget and asks the ladder for `retry`, `narrow`, `escalate` or `parked`. The fix therefore always runs on a ticket the ladder admitted.

- Alternative: fix inside the failing round, then review again under the same ticket. Lost because the budget would never count the failed review, and the ladder's escalation and oscillation checks (`kernel-loops`) would never see a round with blockers.
- Alternative: a separate `task-redispatch`-like loop for the fix. Lost because there is no task target. A second loop for one Change splits one budget into two.

### D2. Triage stays in the main thread and writes only levels (T)

`cr` reads the round's entries with `log list --since-ticket-start <ticket>` and triages each one with `log triage`. Its context holds the P8 lists (the `verifier-policy` part), and the integration package holds `review.risks`. Duplicates across groups become `not-a-problem` with a reason naming the kept entry. This uses the existing command, and the dropped entry stays visible with its reason. `cr` never rewrites an entry.

- Alternative: `log resolve --superseded --by`. Lost because `superseded` needs a newer entry that names the old one, and `cr` would have to write a new entry. That puts the coordinator's prose in the ledger as a finding.
- Alternative: a triage agent on `reader`. Lost by user decision T: it costs one dispatch per round, and the main thread already holds the merged view.

### D3. Kernel gaps closed in this Change, not deferred

The four gaps in Context block the acceptance signal ("`cr` on a fixture writes findings to the ledger"; `/bdk:run` reaches close), so they ship here with their specs.

- **Review fix commit (`bdk commit <change-id>`).**
  - Trailers are `BDK-Change` and `BDK-Ticket`. `Progress from git` accepts that pair, and it commits no task.
  - The commit is allowed while the ticket is open, because the round reviews the committed fix (`review plan` reads committed history only).
  - The diff check for the Change target forbids the `do-not-touch` globs and reports nothing undeclared. A review fix declares no `Files:`, so every path it touches would be undeclared noise.
  - Alternative: `cr` runs `git commit`. Lost because the main thread would build trailers and pick paths by hand, which the commit command exists to prevent (T3, P6).
  - Alternative: the implementer commits. Lost because `hooks pre-tool` denies git and `bdk commit` to subagents (`guard/subagent-git`, `guard/subagent-kernel-command`).
- **Blocking entries in the fix package.**
  - The predicate "live `blocker` naming `review`, or live entry triaged `blocker`" moves out of `graph/domain/kinds/verdicts.ts` into a pure helper in `shared/vocabulary/`, the one shared module `domain/` may import. Both the `review` verdict and `dispatch build` call it, so the two can never disagree.
  - Rules are selected by the entries' file refs.
  - Alternative: the implementer reads `log list`. Lost because it breaks "files carry the substance" (T23-D0): the package would not hold what binds the agent.
- **Review Change kind.**
  - `kind: review` reuses the node field `kinds:`. The design, plan and execute nodes, the post-task steps and `spec-delta` list `kinds: [feature, bug]`.
  - `base` is stamped once in `change.md`, which stays immutable. `changeBase` returns it before falling back to the `change.md` commit, so `review plan` and `evidence coverage` agree on the range without either knowing about kinds.
  - A base equal to `HEAD` is refused with the new rule `policy/empty-range`, so no empty Change is left behind.
  - With no steps in the graph, a fix round of a review Change has no `steps`, and the full gate is its only check. That is acceptable, because the gate reruns every round.
  - Alternative: a stateless `cr` without a Change. Lost by user decision on 2026-10-03: it would need a second engine.
  - Alternative: `--profile tiny` with skipped nodes. Lost because plan and execute would still be required.
- **`rules show --role <role> --file <path>...`.**
  - It is standalone, reuses the Selection, and returns what a package of that file set would record.
  - Alternative: N calls of `rules explain` plus `rules show <id>` per rule. Lost because of the call count on a 40-file PR, and `rules explain` carries no rule text.

### D4. `cr` writes no file, so `run` starts it (B1)

`cr`'s frontmatter is `disallowed-tools: Edit Write NotebookEdit`. Its report is the `merge` report in the ledger and its final reply. `/bdk:run` starts it through `Skill` like any stage skill. The `Write` refusal that `execute` leaves on the turn (HOST-FACTS `skill-tool-disallowed`) no longer matters. `cr` stays model-invocable and unguarded by `guard/stage-skill`, as today.

- Alternative: `Write(.bdk/cr/**)` for a copy of the report. Lost by user decision B1.

### D5. Range: delta by default, full on the first round (user decision 2026-10-03)

`cr` passes `--full` and `--base` through to `review plan` and adds nothing of its own. The first round of a Change has no `merge` report, so it is full. A fix round reviews the fix's delta, while the gate runner reruns `tests-full`, `lint-full` and coverage on the whole Change.

- Alternative: a final `--full` round after a passing delta round. Lost because it doubles the reviewer cost of every fix, and the full gate already catches regressions outside the delta.

### D6. `--inline` keeps the packages and drops the fix loop

`--inline` builds the same packages under the same ticket, so the ledger, the reports and the verdict are identical. The coordinator works each package in turn, with the role section the package embeds as its instructions. No fix happens, because `cr` cannot edit and `--inline` starts no worker. With blocking entries, the ticket closes `fail` and the reply names `/bdk:cr`.

- Alternative: `--inline` drops packages and reviews from the diff. Lost because the rule selection and the ledger would then differ from a normal round.

### D7. `pr-review` is stateless and starts the role as a fork (D1, refined 2026-10-03)

A PR's Change is normally archived before the PR opens, because `/bdk:close` comes first. The worktree is detached, and it is deleted after posting. A ticket there would need kernel support for archived Changes and detached heads, only to store data that is thrown away. So the brief carries the contract read-only:

- `change.md`;
- the accepted decisions of `log/`;
- `design.md`, `architecture.md` and `plan/`.

`guard/dispatch-prompt` denies a `bdk:reviewer` `Agent` call without a package. `pr-review` has no `Write`, so it cannot write a brief file. It therefore starts `bdk:pr-reviewer` through the `Skill` tool with the brief as the argument. The role's frontmatter (`context: fork`, `agent: bdk:reviewer`) makes that the same adapter. Forks run one at a time (HOST-FACTS `fork-concurrency`), so several PRs review in sequence.

The role returns a result block of findings, each marked blocking or not. `pr-review` computes the verdict with its own policy table, which keeps every role free of approval wording (P3). Comment templates load through the `ctx` `file` part.

- Alternative: a kernel command that writes a brief file under a pseudo-Change. Lost because it invents state for a stateless flow.
- Alternative: a guard exemption for a brief prompt. Lost because it weakens T23-D0 for every adapter.
- Alternative: one role body with a mode flag. Lost by D1.

### D8. P8 self-check through a `ctx` part

A new manifest part kind `verifier-policy` renders the resolved `policy.verifier` lists. `design`, `plan` and `cr` list it. The skills add one step before `/bdk:verify-*`: correct what fails a blocking category, and ignore the not-a-fail list. It writes nothing, so the verifier stays independent. The lists are resolved by `log`, which owns `policy.verifier`, so the dependency matrix gains the edge `ctx -> log`; `log` imports only `shared`, so the edge closes no cycle.

- Alternative: copy the six categories into the skill text. Lost because a project that adds a category in settings would not see it.

### D9. Removal follows the references, not a list

Every reference is found with the `git grep` of the `plugin-tooling` scenario:

- `.claude/rules/portability-check.md`, the docs-sync map, `CONTRIBUTING.md`, `docs/INJECTION-FLOWS.md`, `docs/guide/` (agents, shared foundation, skills), `README.md`;
- the `ctx` manifest and its snapshot;
- `skill-check.baseline.json` (pruned with `--baseline-prune`);
- one line each in `skills/debug` and `skills/test-driven-development`.

`STARTUP_INSTRUCTIONS.md` is regenerated from `bdk ctx startup`. Its contract test fails until it is. `docs/V3-*.md` and `docs/v3/` are historical records and stay as written. Recorded host payloads under `tests/fixtures/` and the frozen v2 arm of `execute-ab` stay too: they are measurements, not references.

### D10. `review-models` reuses the stages harness

The suite needs:

- a seed from `evals/suites/stages/seeds.ts` (an executed Change), plus a patch that commits the seeded defects;
- an answer key YAML;
- a plugin-copy variant per cell that rewrites only the `model` line of `agents/reviewer.md`, the same mechanism `execute-ab` uses for its arms;
- a judge that matches entries to defects, as `rules-noop` M2 does.

Metrics read the ledger through kernel commands. `pnpm eval check` validates the key against the seed. The probe runs in this Change. The series runs only on the user's approval, and its result decides whether `reviewer` moves to `opus`, through a one-line change in the adapter table of `export agents`.

## Risks / Trade-offs

- [The fix implementer touches a file another reviewer flagged as fine] The next round's delta includes every file of the fix, and the integration reviewer sees the whole delta.
- [A review Change on a long-lived branch gives one huge range] `review plan` splits groups at `review.group.max-files`, and the user can narrow with `--base`.
- [Sequential PR reviews are slower for many PRs] This is accepted for correctness. Revisit when the host runs forks concurrently (HOST-FACTS `fork-concurrency` is re-measured per host version).
- [The coordinator triages leniently to finish faster] Every level is in the ledger with its reason, and `v3-t42-review-report` shows them to the user per finding. M measures false alarms after triage.
- [Removing agents breaks a user's own prompts that name `bdk:explorer` or `bdk:test-runner`] This is a **BREAKING** change listed in the proposal, and README's Removed table names the replacement (`bdk:scout`, the `runner` role).
- [`bdk commit <change-id>` commits a user's unrelated edit] Fully staged paths stay the user's (Diff check), and the commit runs only while a `review-fix` ticket is open, right after a worker's fix.

## Migration Plan

There is no data migration. Existing Changes keep `kind: feature|bug`, and `base` is optional. A v2 `.bdk/cr/` directory is left untouched. The order of work is kernel gaps, then skills, then removal, so `pnpm test:contract` stays green at every commit.

## Open Questions

- Whether `review.group.max-files` (default 30) moves after the `review-models` series. This changes a default, not a spec.
