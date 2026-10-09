# Proposal

## Why

Tracks #249.

`/bdk:plan` (#199) has eval cases for a fresh plan, a resume after a failed report, a spent budget and a hand-written plan (archived Change `v3-199-bdk-plan`, design D8). Two paths of its spec were checked only by hand (same design, "Results"): the stop on a gap of the design (spec `bdk-plan`, "Gaps of the design stop the plan") and the run on a plan that already passed (scenario "Plan already passed" of "Resume from the run files"). Without a case, a change to `plan` or `plan-draft` can break either path unnoticed: a gap that reaches the verifier spends an opus pass and hands `/bdk:run` a plan that misses behaviour; a passed plan that is drafted or verified again wastes a stage. The second path writes no file, which the `skill-evals` rule for orchestrator cases does not allow, so the rule must make room for it or the path stays a hand check.

#253 (closed) measured the gap rule of `plan-draft` and kept it, so the gap case grades the rule as it stands.

## What Changes

- New orchestrator case `plugins/bdk/evals/plan-design-gap/`: the `ledger-change` fixture with one requirement added to the spec delta that the design does not settle (`ledger export <file> --out <path>`, no rule for an existing `<path>`). Graded on `plan-draft` running, no `bdk:verifier` agent and no plan report, the parts `plan-draft` can write, and a reply that names the gap and `/bdk:design add-csv-export`.
- New orchestrator case `plugins/bdk/evals/plan-passed/`: the hand-written plan of `plan-verify-written` with a passing `plan/verify-1.md`. Graded on one `bdk plan check` for the waves, no `plan-draft` and no verifier, no file written, and a reply that names the passed plan and `/bdk:execute add-csv-export`.
- `skill-evals`: an orchestrator case whose correct run writes no file carries the tag `writes-nothing` and grades that with a `regex` grader on the trace instead of a `file_exists` grader; every orchestrator case keeps its `tool_order` grader. `plugins/bdk/tests/evals.test.ts` enforces it.
- `plan-draft` step 2 and its reply (step 7): a case that a requirement of the Change brings in, such as an existing file for a new `--out` option, is a gap even when no scenario names it, and the reply lists every gap under `Gaps of the design`. The first runs of `plan-design-gap` showed the defect (design D5).
- `plugins/bdk/evals/README.md`: the `writes-nothing` rule, both cases and their recorded results.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: the grader rule of orchestrator cases admits a case that writes no file; a requirement for the two `/bdk:plan` cases.
- `bdk-plan-blocks`: "plan-draft writes the parts" says what counts as a gap for a case a new requirement brings in, and where the reply lists gaps.

## Out of scope

- The behaviour of `/bdk:plan`: no change.
- Whether `plan-draft` keeps its gap rule (#253, measured and kept); this Change only sharpens which cases the rule covers, after a case showed it misread (design D5).
- Permission denials in `plan-*` eval runs (a compound `bdk plan check ...; echo` call, the verifier's Bash and Grep denied): #342.
- Cases for other orchestrators that stop before any block (`/bdk:design` on a passed design): they can use the new tag in their own tasks.

## Impact

- New: `plugins/bdk/evals/plan-design-gap/`, `plugins/bdk/evals/plan-passed/`.
- Changed: `plugins/bdk/tests/evals.test.ts`, `plugins/bdk/evals/README.md`, `plugins/bdk/skills/plan-draft/SKILL.md`.
- User docs: the eval cases and their rules are contributor tooling, not released (spec `skill-evals`, "Suite layout"). The `plan-draft` change sharpens a rule users already see described (a gap of the design stops the plan); the Docs task group checks the Guide and Concepts pages that describe it and regenerates the Reference.
- No change to `package.json`, the lockfile or the CLI.
