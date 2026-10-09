## Why

Tracks #321.

The E2E check replays the spec scenarios of a Change one by one. The implementer already writes one test per acceptance scenario (`implement-part`, step 4), so the project's own tests prove those scenarios, and the tester repeats that work while it never asks the question only a user can answer: does the change work when I use it? Decision D7 of the Change `v3-317-test-groups-live-e2e` (`openspec/changes/archive/2026-10-09-v3-317-test-groups/design.md`), approved by the user, moves the E2E check to scenarios it derives live from the proposal: the user processes the proposal adds or changes, up to 5 paths per process (main path, variants, at least one path that tries to break it), no global cap, each path traced to a proposal line. This serves correctness, problem 2 of v3: the product is checked against what it is meant to do, not against a restatement of its tests.

## What Changes

- `e2e-check` reads `proposal.md` first and lists the user processes it adds or changes; `design.md` and the spec deltas are read only for expected values (exact text, exit codes, statuses). Each proposal line that changes nothing a user does is listed with its reason and is not driven.
- Per process it drives up to 5 paths: `main`, variants, and at least one `break` path that tries to break the process (wrong input, wrong order, a repeated or interrupted action). No cap over the whole Change. Each path names the proposal line it comes from.
- When the proposal states no outcome for a break path, the expected outcome is the one every user expects: a message that names the problem, a refusal the interface shows (non-zero exit, 4xx status, a visible error), no crash or stack trace, no data lost, and the product still usable afterwards.
- Evidence files are keyed by process and path: `E2E/<process>--<path>.md`, with screenshots `<process>--<path>-<n>.png` and the video `<process>--<path>.webm`. `verdict.md` lists one line per path, grouped by process, each with its proposal line.
- A finding points at the proposal line its path comes from: `--file openspec/changes/<change>/proposal.md --line <N>`.
- `Verdict: SKIPPED` when the proposal adds or changes no user process (reason `the proposal changes nothing a user does`), next to the existing `no tools.e2e entry`. The reason `the Change has no spec scenarios` goes.
- `spec-conformance` reads failed E2E paths instead of failed E2E scenarios; the review round and its spec name path files.
- Eval cases: `e2e-check-cli-broken` and `e2e-check-no-e2e` follow; new `e2e-check-proposal-paths` (a promise only the proposal makes, broken in the product) and `e2e-check-no-user-change` (a proposal without a user-visible change gives `SKIPPED`). The fixtures that model E2E evidence (`tally-reviewed.sh`, `spec-conformance-conforming`) use the new files.

Out of scope: narrowing the E2E check in later review rounds (#264). The implementer's tests per acceptance scenario stay as they are (`implement-part` already writes one test per scenario in the project's test conventions).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-e2e-check`: inputs, what is driven (processes and paths from the proposal instead of spec scenarios), evidence names, verdict lines, finding location, skip reasons, reply.
- `bdk-spec-conformance`: a failed E2E path, not a failed E2E scenario, is a `Must address` item; the E2E files read are path files.
- `bdk-auto-review`: the E2E evidence of a round is path files.

## Impact

- `plugins/bdk/skills/e2e-check/SKILL.md` and `references/drivers.md`; `plugins/bdk/agents/e2e-tester.md` (description).
- `plugins/bdk/skills/spec-conformance/SKILL.md`.
- `plugins/bdk/evals/`: `e2e-check-cli-broken`, `e2e-check-no-e2e`, new `e2e-check-proposal-paths` and `e2e-check-no-user-change`, `fixtures/tally-cli.sh`, `fixtures/tally-reviewed.sh`, `spec-conformance-conforming`, `README.md`.
- User docs: `docs/concepts/e2e.md` (main page), `docs/concepts/run-state.md`, `docs/concepts/stages.md`, `docs/concepts/findings.md`, `docs/concepts/agents.md`, `docs/concepts/openspec-changes.md`, `docs/guide/index.md`, `docs/guide/workflow.md`, `docs/guide/configuration.md`; the Reference regenerated with `pnpm docs:reference`.
- Specs `bdk-e2e-check`, `bdk-spec-conformance`, `bdk-auto-review`.
