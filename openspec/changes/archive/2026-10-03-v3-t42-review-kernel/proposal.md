## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T42. Tracks #62.

T42 makes `/bdk:cr` and `/bdk:pr-review` work on the v3 input and output contract. The review design was settled with the user on 2026-10-02/03 (`.lavish/t42-review-process.html`, rounds 1-4): v3 review is not a port of the v2 diff review. Every task has already passed TDD, simplify, scoped tests and scoped lint, and the plan and design are verified, so review checks the Change against its contract (intent, decisions, task contracts, rules), plus what no single task sees: integration between parts, the full test suite and lint, diff coverage, files changed outside the plan, and the open entries of execute. The kernel cannot carry that today:

- A ticket has one active package per role, and a package for the Change target has no file set, so `dispatch build` selects every rule and cannot give N parallel reviewers different files (`policy/package-too-large` risk, `log add --ticket` cannot tell the reviewers apart).
- The `review` verdict takes the latest report naming `review`, so with parallel reviewers the last one to finish would decide.
- No node requires a full test run, coverage is not measured, and the v2 range and watermark live in `scripts/bdk_run_state.py`, which T32 deletes.
- A finding has a reviewer's `severity` but no project-level triage; the user asked for BLOCKER / SHOULD FIX / NICE TO HAVE judged in the project's context, and for risky areas described in configuration.

T42 is split (user decision 2026-10-02/03) into `v3-t42-review-kernel` (this Change), `v3-t42-review-skills`, `v3-t42-review-report`, `v3-t42-tools` and `v3-t42-craft`. This Change delivers the kernel the review skills and the human report stand on.

## What Changes

- **Review groups under one ticket** (decision A1): a ticket reference `<ticket>@<group>` and `bdk dispatch build <change-id> <role> <ticket> --group <group> [--file <path>...] [--part <nn>] [--range <range>] [--focus <text>]` on a `review-fix` ticket. Each group has its own package, report and rule selection by the group's files. `dispatch show`, `rules show`, `log add`, `log ingest` and `evidence record` accept the reference. The reserved group `merge` lets the orchestrator store the merged review report under the round's ticket without a package.
- **`bdk review plan [--full] [--base <ref>]`** (new `review` slice): the review range and the groups, computed deterministically. The anchor is the head of the latest merged review of the Change (delta), the Change's base (`--full`, or no earlier review) or `git merge-base HEAD <ref>` (`--base`, stacks). Groups are the plan parts intersected with the changed files, a part over `review.group.max-files` (default 30) split by module, the files no task declares as group `unplanned`, and `integration` over all files. A Change without plan parts groups by module. Replaces the range and watermark of `scripts/bdk_run_state.py`.
- **`review` verdict from the merged report**: the `review` node passes on the latest `merge` report of a `review-fix` ticket, with no live blocking entry, and only when `tests-full` and `lint-full` are done. The kernel stamps `head` (the reviewed commit) on a `merge` report, which is the next delta anchor.
- **Full gate** (decision R2): two new evidence kinds and graph nodes in the review stage, `tests-full` (every `tools.test` entry's full `command`) and `lint-full` (every `tools.lint` entry's full `command`), target the Change, required by `review`. The runner package of a group `gate` carries both in its `Checks` section.
- **Coverage with a threshold per test type**: a `coverage` object on a `tools.test` entry (`command`, `report`, `format`, `min`). New `bdk evidence coverage <test-id> <report> --ticket <ref>`: the kernel parses the report (lcov or Cobertura XML), computes the coverage of the lines the Change added in executable files, decides the verdict against `min` itself and records a `coverage` manifest. `tests-full` is done only when every entry with `coverage.min` has a passing fresh coverage manifest.
- **Triage** (decision T): new `bdk log triage <id> blocker|should-fix|nice-to-have|not-a-problem [--reason]` stamps `level` on a `finding`, `blocker` or `observation`, an in-place mutation by the orchestrator. `not-a-problem` also resolves the entry with the reason. The review verdict treats a live `blocker` not triaged `not-a-problem`, and any entry triaged `blocker`, as blocking.
- **Risky areas in configuration** (decision K): `review.risks`, a list of `{id, instruction}` merged by `id`, with a default set in the plugin (`auth`, `migration`, `secrets`, `public-api`, `dependencies`). The package of the integration reviewer embeds them in a `Risks` section.
- **New role `integration-reviewer`** on the `reader` adapter (decision R3): the role skill, its place in the role-to-adapter map and its rule-prefix set. It reviews the whole range against intent, design, plan and risks. The change map it will also produce for the human report is specified in `v3-t42-review-report`.
- **Plan update**: the T42 section of `docs/V3-IMPLEMENTATION-PLAN.md` gets the delivery list of the five Changes and the decisions above, like T41's.

## Capabilities

### New Capabilities

- `kernel-cli/review`: the `bdk review plan` command.

### Modified Capabilities

- `kernel-cli/dispatch`: `--group`, `--file`, `--part`, `--range` and `--focus` on `build`; `<ticket>@<group>` on `show`; group packages and reports; the `Risks` section; the `integration-reviewer` role; the runner `Checks` for `tests-full` and `lint-full`.
- `kernel-cli/log`: ticket references on `add` and `ingest`; the `merge` group; `head` on a merge report; the new `bdk log triage`.
- `kernel-cli/rules`: `rules show --ticket <ticket>@<group>`; the role set of `integration-reviewer`.
- `kernel-cli/evidence`: ticket references on `record`; the new `bdk evidence coverage`.
- `kernel-cli/attempt`: a `review-fix` round opens while only `tests-full` and `lint-full` keep `review` blocked, since the round's gate runner records them.
- `kernel-cli`: the ticket reference grammar and the new rules in the rule catalogue.
- `kernel-architecture`: the `review` slice in the slice table and the dependency matrix.
- `kernel-pipeline`: kinds `tests-full` and `lint-full`, their nodes, and the `review` verdict from the merge report.
- `kernel-state`: dispatch package `group` and `files`, ledger entry `level` and its mutation, report `head`, evidence kind `coverage`.
- `kernel-settings`: `tools.test[].coverage`, `review.risks`, `review.group.max-files`.
- `role-contracts`: ten role skills with `integration-reviewer` on `reader`.

## Impact

- Kernel slices `dispatch`, `log`, `rules`, `evidence`, `graph`, `config`, new `review`; `pipeline/pipeline.yaml` and two instruction templates; `schema/cli/` and `schema/state/` regenerated by `pnpm build`; `dist/bdk.mjs`.
- New role skill `skills/roles/integration-reviewer/SKILL.md`; `agents/` unchanged (the adapter exists).
- No user-visible skill changes: `/bdk:cr` and `/bdk:pr-review` move to this kernel in `v3-t42-review-skills`, and `/bdk:run` keeps stopping at the review stage until then.
- Out of scope: the `cr` and `pr-review` skills, the triage procedure, the removal of the v2 agents and `bdk-*` meta-skills, the P8 self-check in `plan` and `design`, the `review-models` measurement (all `v3-t42-review-skills`); the HTML report, Lavish serving, decisions per finding and the tracker (`v3-t42-review-report`); tools skills (`v3-t42-tools`); `bdk-craft` (`v3-t42-craft`).
