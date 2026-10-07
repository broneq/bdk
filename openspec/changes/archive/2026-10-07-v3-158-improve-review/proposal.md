# Proposal

## Why

Scope: #158. Tracks #158.

A diagnosed `/bdk:cr` run on a 202-file range took about 19 minutes and 702k subagent tokens:

- **The integration reviewer was the critical path:** 708 s and 32% of the tokens. It re-read the files that the group reviewers were reading at the same time, because its package hands it the whole range and tells it to read `git diff <range>`. Yet every one of its findings was about seams and intent, not file internals.
- **Three of nine group reviewers got only PNG snapshots** and wrote nothing.
- **Six of eleven readers hit `guard/reader-write`**, because their contracts never show how to hand a report over without a temp file.

Review needs a clear split: group reviewers look bottom-up at their files, and the integration reviewer looks top-down at what the Change promised. And nobody checks the findings: `main` triages each entry from its text alone, without reading the code, so noise reaches the human as `should-fix`.

## What Changes

- **Binary files leave the review.** `bdk review plan` lists binary files of the range in their own `binary` field and keeps them out of every reviewer group and out of the `integration` group. The review report shows them as not reviewed as text.
- **The integration reviewer traces the Change's spec deltas.**
  - It maps each scenario of the spec deltas to the code that implements it and the test that proves it, and logs a finding for each gap.
  - It checks the seams between groups and the `Risks` items.
  - It ends its report with an `## Intent` table, which `bdk review render` shows next to the area summaries and checks against the scenarios of the spec deltas.
  - A Change without spec deltas, such as a `review` Change of a foreign PR, gets seams and risks only, plus an `observation` that no spec delta exists.
  - Duplication across parts and the full reading of each file leave the role.
- **BREAKING (orchestration):** `/bdk:cr` dispatches the integration reviewer after every group reviewer of the round has returned, not in the same dispatch round.
  - Its package names the group reports, the groups without a report, the spec deltas, `git diff --stat` and the binary files.
  - It no longer tells the agent to read `git diff <range>` whole.
- **Group reviewers report their outward seams.** A reviewer report ends with `## Seams`: the contracts its files change that code outside the group uses. This is the integration reviewer's starting point.
- **New adapter `integrator`** (read-only, deep tier, effort high) for the integration reviewer. It replaces the `reader` adapter that it shared with `verifier` and `design-verifier`, so its model can change on its own later.
- **A judge triages the round.** A new role `judge` on a new adapter `judge` (read-only, `sonnet`, effort high) runs once per round, after the integration reviewer and while the gate may still run.
  - It looks for nothing new. For each entry of the round it reads the body and the code at the refs, checks whether the stated failure scenario holds, and whether the entry is worth fixing for this Change.
  - It sets the level itself with `bdk log triage`, through a guard exception scoped to the entries its package lists (like the lead's). `main` triages only what the judge left.
  - A `not-a-problem` entry stays visible in the report's Settled section with the judge's reason.
- **Every finding states a failure scenario.** Reviewer and integration reviewer bodies gain a `Failure scenario:` paragraph: the concrete input, state or change that goes wrong. A finding without one is at most `nice-to-have`. The report renders it as a fourth field.
- **Fixes on the way:** `bdk log add` gains `--severity` (the contracts asked for a severity no command could write), and the `reviewer`, `integration-reviewer` and `judge` packages carry the P8 blocking categories and `not-a-fail` list (the contracts named a list the packages did not hold).
- The plugin ships eight adapters.
- **Readers hand over without a file.** The package template's return section shows `bdk log ingest` with the report in a stdin heredoc instead of `< <report-file>`, for every role. The `reviewer`, `integration-reviewer` and `judge` contracts repeat the heredoc form once, and the reviewers' contracts say to read diffs per file from `git diff` output. The guard does not change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli/review`: `bdk review plan` gains `binary` and keeps binary files out of the groups. `bdk review render` shows binary files and the `## Intent` table, and flags untraced scenarios.
- `kernel-cli/dispatch`: `bdk dispatch build` gives the `integration-reviewer` package its own `Review` text: group reports, unreviewed groups, spec deltas, the stat command and binary files, and no whole-range diff. The package is built on the `integrator` adapter. A `judge` package lists the entries to judge. The reviewing packages carry the P8 lists.
- `kernel-cli`: the Availability classes gain the judge exception for `log triage`, and the rule catalogue gains `guard/judge-scope`.
- `kernel-cli/log`: `bdk log add --severity`.
- `kernel-cli/rules`: `--role judge`; the judge reads no stage rules.
- `skill-evals`: `review-models` records raw false alarms, recall after triage, defects dismissed by triage, and the round metrics of this change.
- `role-contracts`: eleven roles with `judge`; the role-to-adapter map and the adapter table gain `integrator` and `judge`; the contract content of `reviewer` and `integration-reviewer` changes (Seams, Intent, Failure scenario, severity, stdin hand-over) and the `judge` contract is new.
- `review-skills`: `cr runs a review round` dispatches the integration reviewer after the group reviewers and the judge after it, and reports an all-binary range. `cr triages every entry of the round` leaves to `main` only what the judge did not triage. `cr inline` keeps the same order.
- `kernel-cli/export`: `bdk export agents` writes eight adapter files.
- `plugin-tooling`: the plugin ships eight adapters.
- `kernel-architecture`: the generated outputs and the distribution ref name eight adapters, and the dependency matrix lets `review` import `spec` for its delta parser.
- `kernel-cli/hooks`: the prefilter, `guard/reader-write` and `guard/dispatch-prompt` cover `integrator` and `judge`, and `bdk hooks pre-tool` runs `guard/judge-scope`.
- `kernel-state`: the Dispatch package gains the `entries` frontmatter of a judge package. Its limit is 163 840 bytes, which `bdk dispatch build` has enforced since #150, although the spec still said 12 288.
- `acceptance-catalogue`: `S-DISPATCH` names the 160 KiB limit.

Out of scope:

- The gate reusing a green CI run for the same head SHA: later, no task yet.
- Rule volume per agent: #152 and #153.
- Transcript reading, agent stops without a start, and agent attribution in the journal: #157.
- One way to create worktrees, and a session started in the wrong worktree: #165.
- Lowering the integration reviewer's model or effort: only after a measurement on the new adapter, in a later change.

## Impact

- **Kernel:**
  - `kernel/src/review/` (plan, groups, render, report and its Markdown and HTML renderers).
  - `kernel/src/dispatch/` (build, review text, template and its return section).
  - `kernel/src/spec/index.ts` (exports the delta parser).
  - `kernel/src/shared/store/` (the group packages of a ticket).
  - `kernel/src/measure/` (numstat binary flag, reused by review).
  - `kernel/src/shared/vocabulary/` (`ROLES`, `ROLE_STAGE`).
  - `kernel/src/export/` (adapters, schema enum) and the adapter enum of `kernel/src/dispatch/schema/outputs.ts`.
  - `kernel/src/hooks/domain/guards.ts` and `use-cases/agents.ts` (adapter lists, the judge exception and its agent facts).
  - `kernel/src/log/` (`--severity`).
  - `schema/cli/commands.json` (role lists, `--severity`).
  - `hooks/guard/pre-tool.sh` (prefilter).
  - Output schemas `review-plan.json` and `dispatch-build.json`.
- **Skills:** `skills/tools/cr/SKILL.md`, `skills/roles/reviewer/SKILL.md`, `skills/roles/integration-reviewer/SKILL.md`, the new `skills/roles/judge/SKILL.md`, `agents/` (generated `integrator.md` and `judge.md`), and `STARTUP_INSTRUCTIONS.md` (generated agents table).
- **Tests:**
  - Unit and e2e tests of review, dispatch and export.
  - Contract tests (`role-contracts`, `plugin-layout`, `host-probe`, `cli-contract`).
  - The `review-models` eval suite for the before and after measurement.
- **Docs:**
  - `docs/guide/reference/agents.md`, `docs/guide/reference/hooks.md`, `docs/guide/reference/skills.md` (cr round);
  - `docs/guide/workflows/code-review.md`;
  - `docs/guide/concepts/agents.md`, `docs/guide/concepts/context.md`, `docs/guide/concepts/quality-and-language-rules.md`;
  - `docs/guide/getting-started/migration-from-v2.md` (adapter count);
  - `rules/README.md`, `README.md` and `CONTRIBUTING.md`.
- **Evals:** the `executed-two-parts` seed (spec delta, binary file) and its patch parsers, and the `review-models` metrics and hooks.
- **Wall time:** the group time (about 2.5 minutes in the diagnosed run) moves onto the critical path before integration. The integration time is expected to fall much more. The judge runs while the gate still runs; in the diagnosed run the gate ends the round, so the judge adds no wall time as long as it ends before the gate.
