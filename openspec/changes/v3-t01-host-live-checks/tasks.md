# Tasks

## 1. Probe plugin

- [x] 1.1 Create `tests/host-probe/.claude-plugin/plugin.json` (name `bdk-probe`) and `tests/host-probe/hooks/hooks.json` registering `sh ${CLAUDE_PLUGIN_ROOT}/hooks/record.sh <event>` for `UserPromptExpansion` (empty matcher), `PreToolUse` (matcher `*`) and `SessionEnd`; verify with `claude plugin validate tests/host-probe`
- [x] 1.2 Write `tests/host-probe/hooks/record.sh` (stdin to `${BDK_PROBE_OUT:-$CLAUDE_PROJECT_DIR/.probe-out}/<epoch-s>-<pid>-<event>.json`, no output, exit 0); verify by piping a sample JSON into it and checking one file appears, stdout is empty and the exit code is 0
- [x] 1.3 Add the probe skills and stub: `plan` (`disable-model-invocation: true`), `allowed` (`allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs *)` plus a `!` block `node ${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs ping || echo "BDK STOP"`), `locked` (`disallowed-tools: Edit Write NotebookEdit`), `dist/bdk.mjs` printing `pong`, and a probe agent `probe-worker` with Bash; verify `claude plugin validate tests/host-probe` still passes and a `claude -p --plugin-dir tests/host-probe` session run from a scratch directory records a `PreToolUse` payload

## 2. Fixture collection and anonymisation

- [x] 2.1 Write the failing test `tests/unit/host_probe/test_collect.py`. It feeds a synthetic `.probe-out/` through `collect.mjs` and asserts: `$HOME`, the project path and their dash-encoded forms are replaced; `session_id`, `transcript_path`, `agent_id` and `tool_use_id` become stable placeholders; keys and value types are kept; a `_probe` key is added; a missing expected check file exits non-zero. Add a leak guard that fails if any file under `tests/fixtures/host-payloads/` contains `/Users/`, `/home/` or the current username (plain or dash-encoded). Verify with `pytest tests/unit/host_probe/`: the collect tests must fail because `collect.mjs` does not exist yet
- [x] 2.2 Implement `tests/host-probe/collect.mjs <claude-version> <check-id>=<recording-glob>...` writing `tests/fixtures/host-payloads/<version>/<check-id>.json`; verify `pytest tests/unit/host_probe/` passes

## 3. Headless checks

- [x] 3.1 Write `tests/host-probe/run-headless.sh`, one `claude -p --plugin-dir ... --output-format json --permission-mode default` run per check: `tool_input` for `Bash` / `Edit` / `Write` / `MultiEdit` / `NotebookEdit`; `probe-worker` in foreground and in background; the model calling `Skill` on `bdk-probe:plan`; and the compound `node ... || echo ...` Bash call plus the `allowed` skill's `!` block. It checks that each expected recording exists, retries once, and reports "not triggered" on a second miss. Verify by running it from a scratch project and checking that every headless check ID reports recorded or not triggered
- [x] 3.2 Run it on Claude Code 2.1.281 and collect with `collect.mjs`; verify `tests/fixtures/host-payloads/2.1.281/` holds one file per headless check and `pytest tests/unit/host_probe/` (leak guard) passes

## 4. Interactive checks

- [x] 4.1 Write `tests/host-probe/CHECKLIST.md`. Each step gives the exact input and the recording it should produce: typed `/bdk-probe:plan a b`; a typed real `/bdk:<skill>`; `!` bash-mode `echo probe`; `/bdk-probe:locked`, then a next message asking for an Edit; `/clear`; ending a session with `/exit`, `kill -TERM <pid>` and `kill -9 <pid>`. Verify every step names its input, its expected file and its check ID
- [x] 4.2 The user runs the checklist in a scratch project with `claude --plugin-dir <repo>/tests/host-probe`, then collect with `collect.mjs`; verify one fixture per checklist check ID exists (or the step is recorded as not triggered with the reason) and the leak guard passes

## 5. `node:sqlite`

- [x] 5.1 Write `tests/host-probe/node-sqlite.sh`. For every Node under `~/.nvm/versions/node/` and on `PATH`, it imports `node:sqlite` and opens an in-memory DB with and without `--experimental-sqlite`, recording exit code and `ExperimentalWarning`, plus `nvm alias default`. Add the first unflagged version and the current stability index from the Node changelog / API docs with URLs. Verify `tests/fixtures/host-payloads/2.1.281/node-sqlite.json` lists every installed binary with both runs

## 6. `docs/HOST-FACTS.md`

- [x] 6.1 Write the table: check ID / fact / result / host version / fixture / method / consequence. Cover every T01 Scope item and give each a single result: YES, NO or NOT APPLICABLE. Name the design line and the affected task (T10, T11, T22, T24, T41) wherever a result contradicts the design or removes a planned mechanism. Verify every Scope bullet in `docs/V3-IMPLEMENTATION-PLAN.md` T01 maps to at least one row and every fixture path in the table exists
- [x] 6.2 If the `UserPromptExpansion` plugin-skill result is NO, describe the `bdk stage enter` fallback (design, "Key boundaries", T1 paragraph) for T10 and T24; if YES, record the observed `command_name` form as the matcher input for T24. Verify the section matches the table row
- [x] 6.3 Add "Rerunning the probe" (headless command, checklist, `collect.mjs` with a new version, `diff -r` of two version directories); verify by following it as written into a throwaway output directory

## 7. Acceptance

- [x] 7.1 Check the T01 acceptance signal end to end: `docs/HOST-FACTS.md` exists with the required columns; every Scope item has YES / NO / NOT APPLICABLE; the fallback is described if `UserPromptExpansion` is NO; fixtures are anonymised. Also confirm `proposal.md` links the plan, which closes the second half of T00's acceptance signal
- [x] 7.2 Run `pytest tests/unit/host_probe/` and `openspec validate v3-t01-host-live-checks --strict`; both pass
