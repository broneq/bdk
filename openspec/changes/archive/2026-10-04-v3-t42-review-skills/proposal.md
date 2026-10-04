## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T42. Tracks #62.

`v3-t42-review-kernel` (#112) gave the kernel review groups, `bdk review plan`, the full gate, coverage, triage and the merged review verdict. The skills still run the v2 diff review. `/bdk:cr` sizes the diff by lines, starts the v2 agents `code-reviewer`, `architecture-reviewer`, `duplicate-detector`, `dead-code-detector`, `static-analyse` and `test-runner`, keeps its range in `scripts/bdk_run_state.py` (T32 deletes it) and writes its report with `Write(.bdk/cr/**)`. Because of that Write, `/bdk:run` stops at the review stage. No skill ever marks the `review` node done. `/bdk:pr-review` runs `/bdk:cr --inline` in a general-purpose subagent. Twelve v2 agents and eight `bdk-*` meta-skills sit beside the six adapters that replaced them. This Change is Delivery item 2 of T42: the review skills on the v3 kernel. After it the pipeline is complete, because `/bdk:run` reaches `/bdk:close`.

## What Changes

- **New `/bdk:cr`** (R1, A1, B1, T, C1): a coordinator in the main thread. Each round runs on one `review-fix` ticket. It takes the range and groups from `bdk review plan` and builds one package per group: `reviewer` per part, `unplanned` and module group; `integration-reviewer` for `integration`; `runner` for the `gate` group. The swarm skill starts every agent in the background. The coordinator triages every entry of the round with `bdk log triage` and settles duplicates as `not-a-problem`. It stores the merged review under `<ticket>@merge`. Blocking entries trigger the automatic fix loop on the `review-fix` budget: an implementer fixes them at the start of the next round, the kernel commits the fix, and the round reviews the fix's delta while the full gate runs again (C1). Escalation and parking follow the kernel's `next.action`. When a round has no blocking entries, the coordinator closes the ticket `ok` and runs `bdk done review`. Flags:
  - `--full` and `--base <ref>` pass to `review plan`;
  - `--inline` runs every package in the main thread one after another, with no fix loop;
  - focus text becomes `--focus` of every group package.
  - **BREAKING**: there is no report file under `.bdk/cr/` any more, no line-count classes, no 13 sections and no `scripts/bdk_run_state.py`.
- **Fix rounds review the delta** (user decision 2026-10-03): the first round of a Change is full. A round after a fix reviews only the commits since the head of the last merged review, and the full gate reruns in every round. A manual `/bdk:cr` without flags reviews the delta too, and its report names the anchor kind.
- **`/bdk:cr` without a Change** (user decision 2026-10-03; R-12): opens a Change of the new kind `review` with `bdk change new --inferred --kind review [--base <ref>]`. Its graph holds only `intent`, `tests-full`, `lint-full`, `review`, `gate:review` and `close`. Its base is the merge base with the default branch, or with `--base`, stamped in `change.md`. A review of existing work runs on the same engine as a pipeline review; there is no second, stateless path.
- **Kernel additions the coordinator needs:**
  - `bdk commit <change-id>` commits a review fix while its `review-fix` ticket is open, with a `BDK-Ticket` trailer;
  - an `implementer` package on a `review-fix` ticket embeds every blocking entry of the Change in full and selects rules by their files;
  - `bdk rules show --role <role> --file <path>...` prints the rule selection of a file set without a ticket;
  - the `ctx` part `verifier-policy` renders `policy.verifier.blocking-categories` and `not-a-fail` for the self-check.
- **New `/bdk:pr-review`** (D1, refined by user decision 2026-10-03): stateless. One `bdk:reviewer` agent per PR runs the `pr-reviewer` role from a PR brief. The orchestrator builds the brief from the PR description, linked issues, branch name and commits. When the PR's head carries a BDK Change, active or archived, its intent, accepted decisions, design and plan join the brief as the read-only contract. The reviewer reads rules with `bdk rules show --role pr-reviewer --file ...` and cites their ids. No ticket and no ledger: the worktree is deleted after posting, and the GitHub review is the durable output. Confirmation, templates and `--verify` stay. `reviewer` and `pr-reviewer` stay two roles (D1).
- **`/bdk:run` starts `/bdk:cr`** at the review stage instead of stopping (B1), then goes on to `gate:review` and `/bdk:close`.
- **P8 author self-check** in `/bdk:design` and `/bdk:plan`: before `/bdk:verify-*`, the author checks the draft against the blocking categories and the not-a-fail list from its context.
- **Eval suite `review-models`** (M): part reviewer on sonnet (twice, A/A) and on opus. The fixture is a Change with seeded logic errors, test gaps and one integration error. Metrics: recall, false alarms after triage, cost and time. The probe runs first; the full series runs only after the user approves its projection. Stage cases for `cr` and a `/bdk:run --auto` case that reaches `gate:review` with `review` done.
- **Removal** (E): twelve v2 agents (`implementer`, `fixer`, `plan-verifier`, `design-verifier`, `code-reviewer`, `architecture-reviewer`, `test-runner`, `static-analyse`, `explorer`, `log-analyzer`, `dead-code-detector`, `duplicate-detector`; `web-researcher` stays) and eight meta-skills (`bdk-rules-architecture`, `bdk-rules-code-quality`, `bdk-rules-design-patterns`, `bdk-rules-languages`, `bdk-rules-security`, `bdk-lint-tools`, `bdk-test-tools`, `bdk-implementer-return-contract`). The STARTUP agents table is regenerated and stays byte-identical to `bdk ctx startup` (P11). The `skill-check` baseline is pruned. **BREAKING** for anyone who started these agents directly.
- `cr` and `pr-review` move to `skills/tools/`, which `plugin.json` lists (T02 table 13.2).

## To resolve in the spec (plan T42)

- **The shape of the package input for `cr`, and how it combines with `--full`, `--base` and `--inline`.** Resolved: the input is one package per review group, built by `dispatch build --group` from the groups of `review plan`. `--full` and `--base` choose the range of `review plan` and leave the packages unchanged. `--inline` keeps the same tickets and packages and only changes who works them. The details are in the `review-skills` spec.
- **Whether `pr-reviewer` and `reviewer` share one skill body with a mode flag.** Resolved by D1: two roles. `pr-reviewer` is now the stateless one.

## Capabilities

### New Capabilities

- `review-skills`: `/bdk:cr` and `/bdk:pr-review`: the round, triage, the fix loop, the flags, the review Change, the PR brief and posting.

### Modified Capabilities

- `stage-skills`: `run` starts `cr` at the review stage and no longer stops there; `design` and `plan` run the P8 self-check before verification.
- `role-contracts`: `pr-reviewer` is stateless (PR brief in, result block out, no package or ledger); the `implementer` contract covers a review fix.
- `kernel-cli`: `policy/empty-range` in the rule catalogue; `commit` emits `policy/no-open-ticket`.
- `kernel-cli/change`: `--kind review` and `--base` on `change new`.
- `kernel-cli/review`: the Change base of a `review` Change is its stamped `base`.
- `kernel-cli/commit`: `bdk commit <change-id>` for a review fix.
- `kernel-loops`: the diff check reports nothing undeclared for a review fix; a `BDK-Ticket` commit agrees with the records.
- `kernel-cli/dispatch`: blocking entries in an `implementer` package on a `review-fix` ticket.
- `kernel-cli/rules`: `bdk rules show --role <role> --file <path>...`.
- `kernel-cli/ctx`: the `verifier-policy` part; the manifest without the `bdk-*` meta-skills; `cr` and `pr-review` without `file` parts.
- `kernel-pipeline`: the graph variant of kind `review`.
- `kernel-state`: `kind: review` and `base` in `change.md`.
- `plugin-tooling`: the agents the plugin ships (six adapters and `web-researcher`), no `bdk-*` meta-skills, `skills/tools/` in `plugin.json`.
- `skill-evals`: the `review-models` suite and the `cr` and `run` stage cases.

## Impact

- Skills:
  - `skills/cr/` and `skills/pr-review/` are rewritten under `skills/tools/`;
  - `skills/stages/{run,design,plan}`, `skills/roles/{pr-reviewer,implementer}` change;
  - `skills/bdk-*` (8) and `skills/cr/references/{review-engine,report-format,reviewer-prompt-template}.md` are deleted;
  - `skills/debug` and `skills/test-driven-development` lose their v2 agent lines; both leave in `v3-t42-tools` and `v3-t42-craft`.
- Agents: twelve files in `agents/` are deleted. `STARTUP_INSTRUCTIONS.md` is regenerated.
- Kernel:
  - slices `change`, `commit`, `dispatch`, `rules`, `ctx`, `graph` and `config`;
  - `pipeline/pipeline.yaml`;
  - `schema/` and `dist/bdk.mjs` are regenerated by `pnpm build`.
- Evals: `evals/suites/review-models/`, new cases in `evals/suites/stages/`.
- Docs: `README.md` Skills and Agents tables, `docs/guide/` (agents, skills, review stage), `CONTRIBUTING.md`, `.claude/rules/portability-check.md`, `.claude/skills/docs-sync/references/docs-map.md`, `docs/INJECTION-FLOWS.md`, `skill-check.baseline.json`.
- Out of scope:
  - the HTML report, Lavish serving, decisions per finding, the tracker and the `pr-review` Lavish step (`v3-t42-review-report`);
  - the tools skills and the removal of `debug`, `explain-complex-code`, `add-rule` and `refine-rules` (`v3-t42-tools`);
  - `bdk-craft` and the removal of `test-driven-development` (`v3-t42-craft`);
  - `scripts/` and `bdk_run_state.py` (T32).
