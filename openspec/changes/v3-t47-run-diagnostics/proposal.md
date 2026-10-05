# Proposal

## Why

Scope: #110. Tracks #110.

Production runs of BDK leave no record of how they went. A kernel refusal is printed to the agent and lost, a repeated test run or a re-read file is invisible, and the only way to find what went wrong is to read host transcripts by hand, as #109 did for the T41 `execute` probes. The maintainer wants to run every stage with a verbose record at first, to confirm the pipeline behaves, and then to have a skill that reads everything a session left and says what works badly and where the fix belongs.

The user revised the scope of #110 on 2026-10-05 (design D1). Diagnostics has four layers: an always-on journal, an opt-in verbose log, a deterministic report, and the `/bdk:diagnose` analyzer skill invoked by hand. It replaces the automatic `diagnostician` role and the `diagnostics.analyze` key of the issue.

## What Changes

- **Run journal, always on, no model.** Every kernel command appends one JSON line to `.bdk/.machine/telemetry/journal.jsonl`. The line holds the command id, its arguments truncated to 200 characters, the exit code, the refusal `rule`, the ticket, the active Change and the duration. The hooks append the session start with the main transcript path, agent start and stop with the agent's transcript path, and every question asked to the user. The journal is local, never committed, and bounded to 1 MiB with the existing halving of `shared/store/telemetry.ts`. It stores pointers to the host transcripts, never their content.
- **Verbose log, opt-in with `diagnostics.verbose`.** `bdk config set diagnostics.verbose true` (or with `--local`) takes effect at the next session start. Every tool call of every agent then appends a human-readable line to `.bdk/.machine/logs/<session>.live.log`, so the user can follow a run with `tail -f`. At session end, and on demand with `bdk diagnostics log`, the kernel renders the full session into `.bdk/.machine/logs/<change>-<session>.log`. The render covers the agent tree, the skill and role-contract text each agent loaded, kernel stdout, tool results truncated to a fixed number of lines, the model's text between steps, tokens per agent and per turn, and annotations from the detectors.
- **Deterministic report.** A new command group `bdk diagnostics` adds `report` (metrics and detector findings as JSON), `log` (the render), `slice` (one bounded excerpt of a transcript) and `write` (stores an analysis). The report counts refusals by rule and role, retries, escalations, parks, questions, and time and tokens per task and part. It runs eight detectors (D1 to D8, design D5), with the thresholds in settings.
- **`/bdk:diagnose` analyzer.** A new tools skill, invoked by hand only, forked onto the `reader` adapter. It reads the report, the journal, the ledger and only the transcript slices that a finding points to. It writes `.bdk/.machine/diagnostics/<change>-<session>.md` through `bdk diagnostics write`, covering what went well, what went wrong, the likely cause with a citation, and where the fix belongs. The report may hold project code. Its section `## For a BDK issue` is checked by the kernel for project code before the file is written (new rule `policy/project-code`). A project problem goes to the ledger as a `learning` entry. Run inside the BDK repository, the analyzer also proposes concrete text changes to skills and role contracts.
- **Eval harness.** The `stages` suite takes its refusal metrics from `bdk diagnostics report --json` in the fixture after each run, so probe rows and production reports count the same way. The transcript regex stays as a cross-check metric.

Out of scope:

- Any automatic model analysis at a stage end; `diagnostics.analyze` is not added (design D1).
- Fixing the refusals the report shows (T46, #109).
- An export or upload command; the file is the hand-off (issue scope point 3).
- Hosts other than Claude Code: on another host the transcript-based parts report `unavailable` (design D7).
- The `bin/bdk` wrapper (T52, #119). Whichever of T47 and T52 lands second adapts the hooks' kernel-call matching.

## Capabilities

### New Capabilities

- `kernel-cli/diagnostics`: the `bdk diagnostics report|log|slice|write` commands.

### Modified Capabilities

- `kernel-cli`: the run journal written by every command, and `policy/project-code` in the rule catalogue.
- `kernel-cli/hooks`: the hooks write journal lines, the verbose live log and the session-end render; the `PostToolUse` prefilter and a new `PostToolUseFailure` entry.
- `kernel-state`: the journal, the verbose logs and the analysis files under `.bdk/.machine/`, with their size limits.
- `kernel-settings`: the keys `diagnostics.verbose` and the detector thresholds.
- `kernel-architecture`: a new leaf slice `diagnostics`, imported by `hooks`.
- `tools-skills`: `/bdk:diagnose` joins the tools skills.
- `skill-evals`: the stage probes take refusal counts from the deterministic report.

## Impact

- **Kernel**: `kernel/src/shared/registry/run.ts` (journal line per command), `kernel/src/shared/store/telemetry.ts` (journal writer, per-file limit), a new slice `kernel/src/diagnostics/` (transcript reader, detectors, report, render, slice, write check), `kernel/src/hooks/use-cases/` (session-start, session-end, post-tool, subagent-start, subagent-stop, prompt questions), `kernel/src/registrations.ts`, `kernel/src/shared/refusal/index.ts`.
- **Schemas**: `schema/cli/commands.json`, `schema/cli/output/diagnostics-*.json`, a journal line schema, `schema/cli/common/refusal.json` (generated).
- **Hooks**: `hooks/hooks.json` (`PostToolUseFailure`), `hooks/guard/post-tool.sh` (verbose marker, `AskUserQuestion`).
- **Skills**: `skills/tools/diagnose/SKILL.md` with `references/`; the `ctx skill` manifest entry; the README skills table.
- **Tests**: kernel unit and E2E tests of the new slice, `kernel/tests/contract/` (journal line schema, report schema, settings keys, hooks file, tools skills), recorded transcript fixtures under `tests/fixtures/host-transcripts/`.
- **Evals**: `evals/suites/stages/hooks.ts`, `evals/suites/stages/refusals.ts`.
- **Docs**: a diagnostics page in `docs/guide/`, the settings reference, HOST-FACTS rows for the transcript layout and `PostToolUseFailure`.
- **Issue**: the body of #110 is updated to the revised scope after the user approves this proposal.
