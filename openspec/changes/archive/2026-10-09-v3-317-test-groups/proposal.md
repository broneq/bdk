## Why

Tracks #317. The execute stage is slow and still leaves the product unproven: every part runs every `tools.test`, `tools.lint` and `tools.build` item twice (implementer, then conformer), a heavy item such as a full build runs in every part, nothing runs after a wave is merged, and the first whole-project run is review round 1, where the full E2E suite runs at the same time as the E2E tester. A project cannot say which of its tests are fast enough for every part and which belong to a wave or to review. The user approved the design on a Lavish review page (decisions D1 to D10 in `design.md`); the live E2E check derived from the proposal (D7) moved to #321.

## What Changes

- Each `tools.test`, `tools.lint` and `tools.build` item is one test group: it gains `when`, the check points it runs at (`part`, `wave`, `review`); an item without `when` runs at every point.
- **BREAKING** The item field `scoped` goes. One item holds one `command`; a command holding `{files}` runs on the changed files its `paths` match and is skipped when none matches, a command without `{files}` runs whole. A project that wants both writes two items. `bdk config check` names the removed field and how to rewrite it.
- `bdk check run` gains `--at <point>`, which selects the items whose `when` holds the point, and `--changed <ref>`, which takes the changed files from git (working tree and untracked files against `<ref>`) instead of a `--scope` list. The result file records both and moves to `version: 2`.
- `implement-part` runs its red acceptance tests and its part checks with `--at part --changed HEAD`; `conform-part` runs them only when it edited a file; `resolve-conflict` runs `--at part` on the merged files.
- `execute-waves` runs a wave check (`--at wave --changed <commit before the wave>`) after each wave is on the Change branch; a red wave check goes to `resolve-conflict`, which repairs the merged wave or reports a blocker. `state.json` records each wave's base commit and status, and `bdk run status` keeps the stage at execute while a wave is not done.
- A review round runs `bdk check run --at review --changed <base>` next to the group reviewers, and starts the E2E tester only after the check run, next to the integration reviewer, so the full suite and the tester never run at once.
- `/bdk:setup` writes `when` and `{files}` commands: lint and related tests at `part`, the fast suite and type check at `wave`, integration, build and the E2E suite at `review`, the changed E2E specs at `part`.
- Host contention (ports, instances, machine budgets of a heavy suite) stays the project's: the Guide says a check command waits for its own resources or isolates them, and a `BUSY` exit is a red check.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-cli/config`: the `tools.test`, `tools.lint`, `tools.build` item fields (`when` added, `scoped` removed) and the scenarios that used `scoped`.
- `bdk-cli/check`: "Run the checks" selects items by `--at`, takes files from `--changed` or `--scope`, and replaces the `scoped` variant by `{files}` in `command`; the result file and text output follow.
- `bdk-cli/run`: `state.json` may hold `waves`; the resume table keeps a Change at execute while a wave is not `done`.
- `bdk-execute-blocks`: part checks, conform checks and the conflict check run at the `part` point on the changed files; the conformer checks only after an edit; `resolve-conflict` also repairs a red wave check.
- `bdk-execute`: a wave check after every wave, its repair and its state.
- `bdk-auto-review`: one review round runs the checks at the `review` point, then the E2E tester next to the integration reviewer.
- `bdk-setup`: stack detection writes `when` and `{files}` commands instead of `scoped`.
- `docs-site`: the Concepts page of the orchestrators shows the wave check and the check points instead of saying that nothing checks a merged wave.

## Impact

- Code: `plugins/bdk/src/config/` (settings schema), `plugins/bdk/src/check/` (selection, changed files, result), `plugins/bdk/src/run/` (state schema, resume row 4).
- Skills: `implement-part`, `conform-part`, `resolve-conflict`, `execute-waves`, `review-round`, `setup` and its references; their eval cases and the fixtures that write `scoped`.
- Users: an existing `.bdk/settings.yaml` with `scoped` fails `bdk config check` until rewritten (`/bdk:setup` rewrites it); an item without `when` keeps running everywhere, plus the new wave check.
- Docs: Guide -> Configuration (`docs/guide/configuration.md`), Concepts -> Orchestrators "Where execute runs your checks" (`docs/concepts/orchestrators.md`), Concepts -> E2E (`docs/concepts/e2e.md`, when the tester starts in a round), `docs/guide/first-run.md` where it shows `scoped`, and the Reference regenerated.
- Out of scope: the live E2E check from the proposal (#321); worktree environment files such as `.env.local` (#311); narrowing the E2E check in later rounds (#264).
