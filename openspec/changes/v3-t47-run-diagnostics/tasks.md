# Tasks

## 1. Host facts and fixtures

- [x] 1.1 Probe `PostToolUseFailure` on the current Claude Code with the HOST-FACTS harness. Check whether a Bash call that exits non-zero, and a refused `bdk` call, fire it instead of `PostToolUse`, and record which fields it carries. Add the row `post-tool-failure` to `docs/HOST-FACTS.md` and the recorded payload under `tests/fixtures/host-payloads/<version>/`. Verify: the row and the fixture exist and the HOST-FACTS drift guard in `pnpm test:contract` passes.
- [x] 1.2 Record a transcript fixture with the probe harness: one session with a main thread, one foreground and one background subagent, a `Skill` load, a refused `bdk` call, a repeated Bash command and an `AskUserQuestion`. Redact it with `timeline.mjs` rules (no user instructions, no e-mail), and store it under `tests/fixtures/host-transcripts/<version>/` with the main `<session>.jsonl`, `subagents/agent-<id>.jsonl` and the hook payloads of the same session. Add the row `transcript-layout` to HOST-FACTS (paths, line `type`s, `requestId` repeats of `usage`, `attributionSkill`). Verify: the fixture parses as JSON lines and holds no line matching the redaction patterns.

## 2. Run journal in the kernel

- [x] 2.1 Write failing unit tests for `shared/store/journal.ts`. Cover these cases: append one line per kind; cut values over 200 characters and lines over 4 KiB; at 1 MiB drop the oldest half under the `.bdk/.machine` lock; write nothing without `.bdk/`; use the home checkout root from a part worktree; and a write error that is swallowed. Add the 20 000-line bound test and the eight-process parallel append test of `kernel-state`, Run journal. Verify: `pnpm test:unit` shows them failing.
- [x] 2.2 Implement `shared/store/journal.ts` on top of `appendTelemetry`, with a per-file limit argument and the lock, and export it from `shared/store/index.ts`. Verify: the tests of 2.1 pass.
- [x] 2.3 Write failing registry tests (`shared/registry/tests/`). A refusal, a success, a `KernelRefusal` and an unknown command each append one `command` line with `command`, `args`, `exit`, `rule`, `ticket`, `change` and `ms`. `--help` appends none. A hook-mode allow appends none and a guard block appends one with `kind: guard` and the agent. A journal that throws leaves stdout and exit code unchanged. Verify: the tests fail.
- [x] 2.4 Implement the journal append in `run` of `shared/registry/run.ts`. Give the guard handler a way to add the payload's agent id to its line. Verify: the tests of 2.3 pass, and `pnpm test:perf` stays within its budgets.
- [x] 2.5 Add the zod schema of the journal line and export it to `schema/state/journal-line.json` through `kernel/scripts/export-schemas.ts`. Add an E2E test that validates every line an execute run leaves against it. Verify: `pnpm build && pnpm test:e2e` passes.

## 3. Settings keys

- [x] 3.1 Write failing tests for the four `diagnostics.*` modules: defaults, ranges, `--local`, the unknown `diagnostics.analyze`, and the next-session note in the text output of `config set`. Extend the settings spec contract test to the new table. Verify: the tests fail.
- [x] 3.2 Register the modules (`diagnostics.verbose` with consumer `hooks`, the three thresholds with consumer `diagnostics`) and add the note to `config set`. Regenerate the settings schema. Update the settings reference page in `docs/guide/`. Verify: 3.1 passes, and `pnpm docs:build` and `pnpm test:contract` pass.

## 4. Transcript reader

- [x] 4.1 Write failing unit tests for `diagnostics/transcript.ts` against the fixture of 1.2. Cover these cases: typed events in file order (the host writes some lines a millisecond out of time order) for main and subagent files; `usage` summed once per `requestId`; skill loads from `attributionSkill` and `Skill` tool uses; tool results joined to their uses, including `tool-results/` files; thinking dropped; unknown line shapes counted; and `missing` for a deleted file. Verify: the tests fail.
- [x] 4.2 Implement the reader in the new slice `kernel/src/diagnostics/` (slice anatomy of `kernel-architecture`). Verify: 4.1 passes, and the architecture contract test accepts the new slice once it is in the index (6.1).

## 5. Report and detectors

- [x] 5.1 Write failing unit tests for attribution: the ticket join to a registry row, the transcript `tool_use` join within 5 seconds, and `unknown`. Add tests for each detector D1 to D8 with a hit and a near miss, using the thresholds from settings, and for `truncated`, `transcript` states, the `tokensUnknownAgents` count and `cost` from a `cost-state` line (present, absent, unknown shape). Verify: the tests fail.
- [x] 5.2 Implement attribution, metrics and detectors in `diagnostics/domain/`, with findings that never hold tool output. Verify: 5.1 passes.

## 6. `bdk diagnostics` commands

- [x] 6.1 Add the four records to `schema/cli/commands.json`, the output schemas `schema/cli/output/diagnostics-{report,log,slice,write}.json`, `policy/project-code` to `RULES` in `shared/refusal/index.ts`, and the registrations. Merge the delta specs of this Change into the contract test inputs as the apply workflow does. Verify: `pnpm build && pnpm test:contract` passes the mini-template, catalogue and slice-parity tests.
- [x] 6.2 Write failing E2E tests through `dist/bdk.mjs` for `diagnostics report`. Cover these cases: the counts from a seeded journal, `--stage`, `--session`, `input/not-found`, and the run over the transcript fixture. Then implement the handler and its text mode. Verify: `pnpm test:e2e` passes for the file.
- [x] 6.3 Write failing E2E tests for `diagnostics log`. Cover these cases: the render of the fixture (role contract shown, kernel calls with exit codes, model text, `!` findings, no thinking); `--full`; the header when transcripts are missing; and the 20-file and 20 MiB caps. Then implement the render. Verify: `pnpm test:e2e` passes for the file.
- [x] 6.4 Write failing E2E tests for `diagnostics slice`. Cover these cases: a journal cite, an agent cite, a ledger id, the 100 limit and the 200-line cap with `omitted`. Then implement it. Verify: `pnpm test:e2e` passes for the file.
- [x] 6.5 Write failing E2E tests for `diagnostics write`. Cover these cases: missing headings, a fenced block, a code-span allowlist miss, a line equal to a tracked file line, project code allowed outside the issue section, and a second write that replaces the file. Then implement the three checks; the tracked-line check runs one `git grep -F` over the candidate lines and compares both sides trimmed, so an indented source line also counts. Verify: `pnpm test:e2e` passes for the file.

## 7. Hooks

- [x] 7.1 Write failing unit tests for the hook journal lines and the verbose marker. Cover these cases: the `session` line from the session-start payload; `agent-start`; `agent-stop` from the recorded `lifecycle.json`, from a completed foreground `Agent` and from `TaskStop`; `question` with its count; the marker created and removed by `session-start` as the setting changes; a live line only with the marker; a `PostToolUseFailure` payload marked `failed`; and the session-end render with its path in the context. Verify: the tests fail.
- [x] 7.2 Implement the lines in `hooks/use-cases/` (`lifecycle.ts`, `continuation.ts`, `session-start`, `session-end`), parse `transcript_path`, `agent_transcript_path` and `AskUserQuestion` input in `hooks/domain/payload.ts`, and let `hooks` import `diagnostics` for the render. Verify: 7.1 passes.
- [x] 7.3 Write failing shell tests for `post-tool.sh` (`kernel/tests/contract/hooks-file.test.ts` style). Without the marker, a `Read` payload starts no Node and an `AskUserQuestion` payload does. With the marker, every payload reaches the kernel. Add a test that `hooks.json` holds the `PostToolUseFailure` entry (eight entries). Then update `hooks/guard/post-tool.sh` and `hooks/hooks.json`. Verify: `pnpm test:contract` passes.
- [x] 7.4 Add a `pnpm test:perf` budget for `hooks post-tool` with the marker present, and keep the budget without it unchanged. Verify: `pnpm test:perf` passes locally.

## 8. `/bdk:diagnose` skill

- [x] 8.1 Extend `kernel/tests/contract/tools-skills.test.ts` with the seven-skill list, the `diagnose` frontmatter (`context: fork`, `agent: bdk:reader`, `disable-model-invocation: true`), the steps named in the skill, and the rule against reading `~/.claude` directly. Verify: the test fails.
- [x] 8.2 Write `skills/tools/diagnose/SKILL.md` (at most 200 lines) with the two context lines, the kernel pair, `Read` and `Grep` in `allowed-tools`. Put the five-section template and the fix-location table in `references/`. Add the `ctx skill diagnose` manifest entry and the README skills table row. Review it with `/bdk-skill-kit:skill-authoring`. Verify: 8.1 passes and `pnpm skill-check` reports no finding.
- [x] 8.3 Add a diagnostics page to `docs/guide/`. It covers turning on verbose, where the files are, reading the live log and the render, running `/bdk:diagnose`, and what to attach to a BDK issue. Link it from the troubleshooting page. Verify: `pnpm docs:build` passes, and the docs drift guards in `pnpm test:contract` pass.

## 9. Eval harness

- [x] 9.1 Write failing tests in `evals/suites/stages/`. The row takes `refusals` and `refusal:<rule>` from a stubbed `bdk diagnostics report`, keeps `refusals-transcript`, falls back with `journal-missing: 1`, and `report.ts` lists runs whose totals differ. Verify: the tests fail.
- [x] 9.2 Implement the report call in `evals/suites/stages/hooks.ts` and the comparison in `report.ts`. Verify: 9.1 passes and `pnpm eval check` passes.

- [x] 9.3 Remove the cumulative budget ledger of the eval harness (`evals/.runs/budget.json`, `--budget`): each session keeps its `--run-cap`, a probe keeps its projection. Verify: `pnpm eval check` passes and no harness code reads the ledger.

## 10. Acceptance

- [x] 10.1 Run `pnpm eval stages --skill execute --probe` on the fixture with `diagnostics.verbose: true` in the fixture settings. Check that each row's journal-based refusal counts equal `refusals-transcript` for the rule classes the regex covers, without reading a transcript. Commit the probe rows.
- [x] 10.2 In the fixture of one probe run, check four things. The journal is under 1 MiB. `.bdk/.machine/logs/` holds the live log and the render. `/bdk:diagnose` wrote an analysis that names the report's top refusal with a cause and a citation. `## For a BDK issue` passed `bdk diagnostics write`. Record the result in the probe notes.
- [x] 10.3 Run a probe with `diagnostics.verbose` unset and confirm that no `.bdk/.machine/verbose`, no live log and no model start for diagnostics appear. The journal is still written.
- [x] 10.4 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check` and `pnpm docs:build`, then `openspec validate v3-t47-run-diagnostics --strict`. Verify: all pass.
- [ ] 10.5 After the user approves the proposal, update the body of #110 to the revised scope (design D1), keeping the original decisions as a dated note.
