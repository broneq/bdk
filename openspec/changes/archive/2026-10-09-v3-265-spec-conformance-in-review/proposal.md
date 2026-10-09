# Proposal

## Why

Tracks #265.

The #208 measurement (archived Change `v3-208-measure-speed-b1`, design D6 and "Measurement", run 1) ran a B1-sized Change through 22 min of execute and two review rounds, E2E `PASS` on 71 paths, and then stopped at `/bdk:close`: `spec-conformance` failed with error messages the code prints that no spec delta lists, and `ledger import /tmp/statement.csv` reading `<cwd>/tmp/statement.csv`. Every earlier check had passed them. The run needed a user fix and two more close sessions, and the user's first spec fix was itself rejected (M4). The check that finds these problems runs only after the last point where the review loop could still fix them.

## What Changes

- `review-round` starts `spec-conformance` on `bdk:verifier` in every round, next to the group reviewers and the check run (step 3), with the new argument `--round <round dir>`.
- `spec-conformance --round <round dir>` writes its report to `<round dir>/spec-conformance.md` instead of `close/spec-conformance.md`, reads no E2E results (the round's E2E tester reports its own failures into the log), and appends each `Must address` item to the round's findings log with `bdk findings add --source spec-conformance`, placed where the fix goes: the code line when the code breaks the proposal, the spec delta when the delta misses or misstates what the proposal asks for.
- `spec-conformance` checks each SHALL sentence of a requirement for every input class it names (an absolute and a relative path, an empty value), not only for the scenario's own example. This holds at close too.
- `bdk:verifier` may append to a findings log when its skill says so; it still writes one report file and fixes nothing.
- `judge` levels a `spec-conformance` finding whose problem holds `blocker`: `/bdk:close` refuses to archive while it is open, so a deferral would stop the run at close.
- `plan-fixes` plans a fix that only adds or corrects spec-delta text describing what the proposal and design already settle (a task on the delta file, verified by the next round's spec conformance); only a fix that needs a new product decision stays `## Not planned`.
- `round.md` gets a `## Spec conformance` line.
- `/bdk:close` keeps `spec-conformance` as the final gate, unchanged.
- Eval cases on a new small fixture (`tally-ledger-path.sh`: an error message no delta lists and a ledger path joined to the current directory): `spec-conformance-round`, `judge-spec-conformance`, `plan-fixes-spec-delta`; `auto-review-first-round` grades that the verifier runs in the round, in the foreground.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-spec-conformance`: round mode (`--round`), its report and findings; requirement text checked for every input class it names; eval cases.
- `bdk-auto-review`: the round starts spec conformance on the same diff base as close; `round.md` line; spec-delta fixes are plannable; eval graders.
- `review-blocks`: the judge levels a holding `spec-conformance` finding `blocker`; eval case.
- `bdk-verifier`: the verifier may append findings to a log its skill names.

## Impact

- `plugins/bdk/skills/spec-conformance/`, `review-round/`, `judge/`, `plan-fixes/`; `plugins/bdk/agents/verifier.md`.
- `plugins/bdk/evals/`: fixtures `tally-ledger-path.sh` and `tally-spec-fix-part.sh`, the five new cases, graders in `auto-review-first-round`, README.
- User docs: `docs/concepts/stages.md` (review and close tables), `docs/concepts/orchestrators.md` (the `/bdk:review-round` diagram), `docs/concepts/agents.md` (workers of the round and the verifier row), `docs/concepts/findings.md` (sources), `docs/concepts/run-state.md` (round files, writers diagram), `docs/concepts/openspec-changes.md`, `docs/concepts/cli-config-hooks.md`, `docs/guide/workflow.md`, `docs/guide/footprint.md`; Reference regenerated with `pnpm docs:reference`.
- No CLI change: `bdk findings add --source` takes any text.
- Out of scope: the B1-sized end-to-end measurement that shows a run reaching its PR without a stop at close (a follow-up issue, it needs the uncorrected run-1 fixture of #208); E2E paths with absolute paths (the E2E tester); #258.
