## Why

Tracks #367.

In 2 of 2 runs of the eval case `auto-review-test-only-fix` (2026-10-09, Claude Code 2.1.295), round 2 reviewed only a test fix and logged 0 findings. Its integration reviewer suspected the seeded `monthly-report` cents bug (`src/parse.js:13`, `src/report.js:14`), which lies outside the fix scope, but did not log it. The main session then read the code itself and wrote `review/result.md` as `Status: blocked`, although the stage rules give `Status: done` for a round without a `fix` decision. So a real defect got no level and no decision, and the stage result disagreed with its own round files.

## What Changes

- Decision: a defect the integration reviewer notices in a fix round outside the files of the round's scope is logged as a finding, not dropped. Its evidence says it lies outside the fix scope; the judge levels it and triage decides it like any other finding. The reviewer still does not search for such defects; it logs what it sees while following the changed scenarios and contracts.
- The integration reviewer reads the logs of the earlier rounds of the Change and never logs a problem one of their findings already names, whatever its decision, so a decided finding is not raised again.
- The integration reviewer's return names only the findings it logged; a problem it did not log is not mentioned.
- `/bdk:auto-review` takes the stage result only from the round files: it reads no project source file outside the skills it invokes, and neither a worker's reply nor code read in the main session changes the status or appears as a defect in the result or the reply.
- New block case `review-integration-outside-fix-scope`; the orchestrator case `auto-review-test-only-fix` gets a grader that `review/result.md` agrees with its round lines.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-blocks`: "Fix parts and fix rounds" logs a defect seen outside the fix scope, skips one an earlier round already holds, and limits the return to logged findings; "Eval cases of the review blocks" holds the new case.
- `bdk-auto-review`: "Stage result" is derived from the round files only; "Eval cases of the review stage" names `auto-review-test-only-fix` and its agreement grader.

## Impact

- `plugins/bdk/skills/review-integration/SKILL.md`, `plugins/bdk/skills/auto-review/SKILL.md`, and `plugins/bdk/agents/lead.md` (run each Bash command on its own: a chained command blocked a fix pass of the acceptance case).
- `plugins/bdk/evals/review-integration-outside-fix-scope/` (new), `plugins/bdk/evals/auto-review-test-only-fix/graders/`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/findings.md` (a defect found outside a fix round's scope) and `docs/concepts/orchestrators.md` (the integration reviewer in a later round; the stage result comes from the round files); `docs/reference/` regenerated with `pnpm docs:reference`. No diagram changes: no step, exit, file or agent of a flow is added or removed.
- Out of scope: `review-group`, which reviews only its group's files and leaves problems outside them to `review-integration`; the judge's levels.
