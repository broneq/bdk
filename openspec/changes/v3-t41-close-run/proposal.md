## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T41 (Delivery item 6). Tracks #61.

A Change that passed the review gate stops at `/bdk:close`, and that command resolves to nothing in v3: `bdk change close` merges the specs, archives the Change and returns the PR summary, but no stage skill runs it. The autonomous entry `/bdk:run` (R-9) does not exist either, and it cannot be written as the design assumed: `change`, `plan`, `execute` and `close` set `disable-model-invocation: true`, the host refuses the model's `Skill` call to such a skill before any hook runs (HOST-FACTS `skill-dmi`), and a nested `claude "/bdk:plan"` is denied by `guard/nested-stage-command` (T1). A model therefore has no path into a stage. The user wants a YOLO mode: type `/bdk:run --auto "add a notification list to the user panel"` and let the model drive the Change to the end (user decision 2026-10-02).

## What Changes

- **New stage skill `close`**, user-started in practice, `disallowed-tools: Edit Write NotebookEdit` (P9):
  - Runs `bdk change close --dry-run` and shows what will be merged and archived, then `bdk change close`.
  - Checks the rules projection with `bdk rules export --claude --check` and regenerates it on drift.
  - Ends with the PR summary from the kernel's output (intent, decisions, assumptions, risks, open findings, merged capabilities, gates passed by policy). No rule proposal: lessons stay `learning` entries for the audit skill (T31).
- **New stage skill `run`**, `disable-model-invocation: true`, so only the user starts the YOLO mode:
  - `/bdk:run [--auto] [<intent>]` loops on `bdk next` and invokes the stage skill that `next` names through the host's `Skill` tool: `change`, `design` (with `verify-design`), `plan` (with `verify-plan`), `execute`, `cr` for review, `close`.
  - Each stage runs with its own frontmatter and its own body; `run` holds no copy of a stage procedure.
  - While the run lasts, a question a stage skill would ask the user becomes an `assumption` entry with `review: true` (R-9); only a parked Change, a manual gate or a refusal the skill cannot resolve stops the run.
  - Prints one line per stage while it runs and the full closing render when it stops (resolves T41 "To resolve in the spec": `run` re-renders only at the stop).
- **BREAKING for the T1 guarantee's mechanism, not its effect** (user decision 2026-10-02): `change`, `plan`, `execute` and `close` drop `disable-model-invocation: true`. The gates stay where they always were enforced, in the kernel graph: `gate:design` and `gate:review` are done only through a `transition` entry. The other two duties of the field move into the kernel:
  - **Model-started stage skills**: a new `hooks pre-tool` guard on the `Skill` tool denies a model's call to `bdk:change`, `bdk:plan`, `bdk:execute` or `bdk:close` unless the session has an active run, and always from a subagent.
  - **Gates inside a run**: the same guard passes the gate that opens the stage when it is ready and resolves to `auto` (by `policy.gates.<gate>` or by the run's `--auto`), writing the `source: policy` transition; a manual gate denies and ends the run with the command the user types. This answers the open question of `v3-t24-guard-hooks-gates`: an `auto` gate that becomes ready during the run passes when the run reaches it.
- **`hooks prompt-expansion` for `/bdk:run`**: writes the session's run marker (with `--auto` and the typed prompt), passes without an active Change when the arguments hold an intent, and with `--auto` passes every ready gate by policy. A typed `/bdk:plan`, `/bdk:execute` or `/bdk:close` ends the session's run; `hooks session-end` removes the marker.
- **Live host checks** in `docs/HOST-FACTS.md` before the guard is built: the `PreToolUse` payload of a model's `Skill` call to a plugin skill, whether `disallowed-tools` applies to a skill invoked through `Skill`, and that `UserPromptExpansion` does not fire for it.
- **`ctx skill` manifest**: `close` and `run` get context lines with no parts, which keep the `BDK STOP` line when the kernel is unavailable.
- **Content checks**: the "User-only gates" rule keeps `disable-model-invocation: true` on `setup` and `run` only, and `disallowed-tools` stays required on `execute` and `close`.
- **Evals**: case files `close.yaml` and `run.yaml` in the `stages` suite, with a seed of a reviewed Change. The full `run` from intent to `closed` needs `/bdk:cr` to record the `review` node, which T42 delivers; this Change measures `run` from intent to the review stage and from a reviewed Change to `closed` (user decision 2026-10-02).
- **User documentation**: `reference/skills.md` (`/bdk:close`, `/bdk:run`), the workflow pages, README's skill table and pipeline section, and the guide page on gates and policy.

## Capabilities

### New Capabilities

None. `stage-skills` exists and gains the two skills.

### Modified Capabilities

- `stage-skills`: the stage skill shape (which skills keep `disable-model-invocation`), requirements for `close` and `run`.
- `kernel-cli/hooks`: `bdk hooks prompt-expansion` for `/bdk:run` (marker, intent without a Change, `--auto`), `bdk hooks pre-tool` with the stage-skill guard, `bdk hooks session-end` removing the marker, the prefilter and the guard catalogue.
- `kernel-state`: the run marker under `.bdk/.machine/` and `hooks pre-tool` as a writer of `source: policy` transitions in the write map.
- `skill-content-checks`: the "User-only gates" rule.
- `skill-evals`: the `close` and `run` cases and the reviewed-Change seed.

`kernel-cli/change` needs no delta: `bdk change close` already merges, archives, commits and returns the summary. `kernel-settings` needs no delta: `policy.gates.<gate>` exists and `--auto` is an argument of the typed command, not a key.

## Out of scope

- `cr` on the v3 package input and recording the `review` node: T42. Until then `run` stops at the review stage and names `/bdk:cr`.
- A cost ceiling for a run and the analysis of production runs: T47 (#110).
- Worktree isolation of parts: T45 (#107).

## Impact

- **Skills**: new `skills/stages/close/`, `skills/stages/run/`; frontmatter of `skills/stages/{change,plan,execute,close}`; `skill-check.config.ts`.
- **Kernel**: `kernel/src/hooks/` (pre-tool use case and guard, prompt-expansion, session-end, payload parsing of `Skill`), `kernel/src/shared/refusal/` (new guard rules), `kernel/src/ctx/use-cases/manifest.ts`; `hooks/guard/pre-tool.sh` prefilter; `schema/cli/commands.json` and the generated `schema/cli/output/hooks-*.json`; `dist/bdk.mjs` rebuilt.
- **Host facts**: `tests/host-probe/` checks and `tests/fixtures/host-payloads/` recordings.
- **Evals**: `evals/suites/stages/cases/{close,run}.yaml`, a seed in `evals/suites/stages/seeds.ts`; paid probe runs need cost approval.
- **Docs**: `docs/guide/`, `README.md`, `docs/V3-IMPLEMENTATION-PLAN.md` (T41 Delivery item 6, acceptance split with T42).
