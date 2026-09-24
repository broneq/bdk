# Design

## Context

See proposal.md - Why. The facts the design already has come from reading the raw docs (design, "Existing Codebase Context", "Host facts verified"). The only earlier live test is the `!` block exit-code test on Claude Code 2.1.280 (decision register, V2 item on `!` semantics). This machine runs Claude Code 2.1.281 and has Node 20.20.2 and 24.21.0 under nvm, plus Node 26.9.0 from Homebrew. It has `herdr` but no `tmux`. The user has the published `bdk` plugin installed, so a probe must not reuse the plugin name `bdk`.

Some checks can only be triggered by a person: a typed slash command (`UserPromptExpansion` fires only on the typed path), a `!` bash-mode command, `/clear`, and killing the process. The rest can be triggered by the model in `claude -p`.

## Goals / Non-Goals

**Goals:**
- Every Scope item gets a YES / NO / NOT APPLICABLE backed by a recorded payload or command output. Nobody's reading of the docs counts as evidence.
- The probe can be rerun against a later Claude Code version with no edits, producing a new `tests/fixtures/host-payloads/<version>/` directory to diff against the old one.
- The probe changes nothing about how the host behaves: recorders only observe.

**Non-Goals:**
- No kernel code, no `bdk hooks *` implementation, no final matcher strings. Those belong to T24, which uses these results.
- No CI job that runs the probe. It needs a logged-in Claude Code and a person at the keyboard, so CI consumes only the recorded fixtures.
- No coverage of hook events the plan does not depend on (for example `Stop`, `SubagentStop`), except where one is needed to explain a result.

## Decisions

### 1. The probe is a separate plugin loaded with `--plugin-dir`

`tests/host-probe/` is a complete plugin named `bdk-probe`, with `.claude-plugin/plugin.json`, `hooks/hooks.json`, probe skills, one probe agent and a stub `dist/bdk.mjs`. It runs from a scratch project with `claude --plugin-dir <repo>/tests/host-probe`.

- *Alternative: temporary recorder entries in BDK's own `hooks/hooks.json`.* Rejected. It edits the shipped plugin, and the recorders would also fire in every real session until they were reverted.
- *Alternative: hooks in the scratch project's `.claude/settings.json`.* Rejected. Settings hooks do not run in the plugin context, so `command_source: plugin`, `${CLAUDE_PLUGIN_ROOT}` and plugin-agent behaviour could not be observed. Those are exactly what T1 to T3 depend on.
- The name `bdk-probe` avoids a clash with the installed `bdk`. The UserPromptExpansion recorder has an empty matcher, so it also records a typed real `/bdk:<skill>` command. That gives the `command_name` form for the actual `bdk` namespace next to the probe's own.

### 2. The recorder is a POSIX `sh` script that copies stdin to a file

Every probe hook entry runs `sh ${CLAUDE_PLUGIN_ROOT}/hooks/record.sh <event>`. The script writes stdin to `${BDK_PROBE_OUT:-$CLAUDE_PROJECT_DIR/.probe-out}/<epoch-s>-<pid>-<event>.json`, prints nothing and exits 0. The plan's "To resolve in the spec" item names this method.

- *Alternative: a Node recorder.* Rejected. Node versions are themselves under test, and a recorder that fails to start would look like "hook did not fire".
- *Alternative: `claude --debug` logs.* Rejected. The logs are not structured payloads and cannot serve as E2E fixtures.
- Exiting 0 with no output leaves the host path unchanged. Blocking and `deny` behaviour are already documented (design, "Host facts verified") and are not under test here.

### 3. Headless checks run in `claude -p`, interactive ones from a user checklist

The model can trigger these, so they run as `claude -p --plugin-dir ... --output-format json` driven by a script in `tests/host-probe/`:
- the `tool_input` shapes for `Bash`, `Edit`, `Write`, `MultiEdit` and `NotebookEdit`;
- `agent_id` in foreground versus background calls of the probe agent;
- the model calling the `Skill` tool on a `disable-model-invocation: true` skill;
- `allowed-tools` pre-approval of the compound `node ... || echo ...` form.

For that last check the run uses the `default` permission mode. In `-p` a tool call that is not pre-approved is denied rather than prompted, so the result's `permission_denials` field and the presence or absence of the tool output show the answer.

These need a person, so they go into `tests/host-probe/CHECKLIST.md` as exact inputs and the file each step should produce:
- a typed `/bdk-probe:plan <args>` and a typed real `/bdk:<skill>`;
- a `!` bash-mode command;
- the `disallowed-tools` skill, followed by a plain next message that asks for an Edit;
- `/clear`;
- ending the session in three ways: `/exit`, `kill -TERM` and `kill -9`.

- *Alternative: drive the interactive session through a terminal multiplexer (`herdr`).* Rejected for now. It automates about six keystroke sequences at the cost of a second tool to learn and maintain. Reconsider if the probe gets rerun often.

### 4. `node:sqlite` is checked on the real Node binaries, the docs supply the history

For each installed Node, the probe runs `node -e` that imports `node:sqlite` and opens an in-memory database, both with and without `--experimental-sqlite`. It captures the exit code and any `ExperimentalWarning`. The first version that works without the flag, and the current stability index, come from the Node changelog and API docs and are cited by URL. The user's default version is `nvm alias default`. Local binaries cannot answer the minimum version on their own, because only three versions are installed.

### 5. Fixtures live in `tests/fixtures/host-payloads/<version>/`, anonymised at copy time

The fixtures are test inputs for T24 and T50 E2E. `openspec/` holds planning and is archived with the Change, so it is the wrong home. This resolves the second "To resolve in the spec" item. Layout:
- one file per check: `<check-id>.json`, where `<check-id>` matches the `docs/HOST-FACTS.md` row;
- the recorded payload, plus a `_probe` key with the Claude Code version, the check ID and the number of recordings. The permission mode stays in each payload's own `permission_mode` (`SessionEnd` payloads carry none).

`tests/host-probe/collect.mjs` copies the recorded files from `.probe-out/` into the fixture directory. It parses each payload as JSON and anonymises the string values:
- the scratch project path, `$HOME`, and the dash-encoded form Claude Code uses for them inside `transcript_path` (`-Users-<name>-...`) become `<PROJECT>` and `<HOME>`; the probe's own directory (the expanded `${CLAUDE_PLUGIN_ROOT}`) becomes `<PLUGIN_ROOT>`; any remaining username becomes `<USER>`; Claude Code's per-user temp root (`/private/tmp/claude-<uid>`, which holds `scratchpad_dir`) becomes `<CLAUDE_TMP>`;
- the values of `session_id`, `prompt_id`, `agent_id` and `tool_use_id`, and any other UUID, become stable placeholders (`<SESSION-1>` and so on). "Stable" means the same value always maps to the same placeholder across every file of one collect run, so a payload still shows that two events came from the same session.

Keys, value types and nesting are kept, so parsers see the real shape. A fixture file is `{"_probe": {...}, "payloads": [...]}`, because some checks produce several payloads, such as the three `SessionEnd` exits.

- *Alternative: anonymise with `sed` in `sh`.* Rejected. `sed` cannot map an ID to the same placeholder across files, and a text replace can break JSON escaping. The reason the recorder avoids Node (decision 2) applies only to the hook path inside the host, not to a tool the developer runs afterwards.
- *Alternative: commit the raw payloads.* Rejected. They carry the home directory, the username and session IDs, and none of that belongs in a public repo.

### 6. `docs/HOST-FACTS.md` has one table and a rerun section

The table has these columns: check ID, fact, result (YES / NO / NOT APPLICABLE), host version, fixture, method (headless / checklist / docs), and consequence. The consequence column names the affected task and design line when a result contradicts the design. A result that removes the need for a planned mechanism is also recorded there. Below the table:
- the `bdk stage enter` fallback, written only if the `UserPromptExpansion` result is NO;
- "Rerunning the probe": the command, the checklist and how to diff two version directories.

## Risks / Trade-offs

- [The model skips a tool call in a headless run, so a missing file is ambiguous.] → Each headless prompt names the exact tool and arguments. The driver script checks that the expected recording exists and retries once. A second miss is reported as "not triggered", not as NO.
- [Checklist steps done by hand are easy to get subtly wrong (wrong window, wrong mode).] → Every step names the exact input and the file it should create. `collect.mjs` fails loudly when a checklist file is missing. The payload's `permission_mode` is kept in the fixture.
- [Results are true for 2.1.281 only.] → The version is part of the fixture path, and the rerun section makes a later comparison a diff. The kernel's rule of treating an unknown payload as "no transition" (Risk Register, "Host hook semantics move under us") still applies.
- [Behaviour may differ between auto mode and default mode (`SubagentHandback` exists only in auto mode).] → Checks that could depend on the mode record it, and the table notes which mode each result was observed in.
- [`kill -9` gives the process no chance to run hooks, so NO is the expected answer.] → Recorded anyway, because T22 / T24 checkpoint logic needs to know it cannot rely on `SessionEnd` for a hard kill.

## Open Questions

- Whether `MultiEdit` still exists as a tool in 2.1.281. If it is absent, its row is NOT APPLICABLE and T24's matcher drops it. This does not change the approach.
