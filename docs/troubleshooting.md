# Troubleshooting

Symptom, cause, and fix for the messages BDK can actually show you, grouped by the hook or script that prints them. Message text is quoted verbatim from source.

## `.bdk/settings.json` missing - session start blocked

**Symptom:**

```
BDK project settings not found (.bdk/settings.json missing).

Run /bdk:setup to configure this project before proceeding.
Setup probes your project files and records test/lint/build commands.
Until setup is complete, skills that rely on project settings will not work correctly.
```

**Cause:** `hooks/check-bdk-config/check.py` (a `SessionStart` hook, see [Hooks reference](reference/hooks.md)) checked for `.bdk/settings.json` in the project root and it does not exist - or the file exists but could not even be parsed as JSON, which is treated identically (`BLOCK_REASON`).

**Fix:** Run `/bdk:setup`. See [Setup](getting-started/setup.md).

## `.bdk/settings.json` malformed or fails validation

**Symptom:**

```
.bdk/settings.json is malformed or failed validation.

Run /bdk:setup --force to regenerate it.

Errors:
  - <one line per validation error>
```

**Cause:** `hooks/check-bdk-config/check.py` parsed the file as JSON successfully but `validate_settings()` found problems - for example a `test-tools[i].command` that is empty, a `tier` outside `fast | e2e | lint | format | typecheck`, a `scoped`/`related` template missing the `{files}` placeholder, or a `features.<key>` value that is not a boolean. Each error line matches one of these patterns, e.g.:

```
'test-tools[0].command' must be a non-empty string
'lint-tools[1].tier' must be one of fast, e2e, lint, format, typecheck (got 'unit')
'test-tools[0].scoped' must contain the '{files}' placeholder - without it the command ignores the file list and runs everything
'features.serena' must be a boolean
```

**Fix:** Fix the offending key in `.bdk/settings.json` directly, or run `/bdk:setup --force` to regenerate the whole file. See [Settings reference](reference/settings.md) for the full schema.

## `uvx` not found

**Symptom:**

```
[BDK] WARNING: uvx not found. MCP tools (serena, code-review-graph) require uvx. Install: https://docs.astral.sh/uv/getting-started/installation/
```

**Cause:** The `SessionStart` inline-shell hook in `hooks/hooks.json` ran `command -v uvx`, and it was not on `PATH`. Both bundled MCP servers (`serena`, `code-review-graph`) are launched via `uvx` per `.mcp.json`, so neither can start.

**Fix:** Install `uv`/`uvx` per the printed URL (https://docs.astral.sh/uv/getting-started/installation/), then start a new session. See [Installation](getting-started/installation.md).

## Run held by another session

**Symptom:**

```
run '<run-id>' is held by session <owner>. If that session is gone, take it over with --force.
```

**Cause:** `scripts/bdk_run_state.py`'s `claim_session()` enforces a single writer per run: the manifest at `.bdk/runs/<run-id>.json` already records a different `session_id` than the one trying to `init` or `resume` it now. There is no time-based staleness check by design - per the script's own comment, "a stale-session heuristic would need a timeout longer than the slowest group (or it steals a live run) which in turn lengthens the lockout after a real crash."

**Fix:** Per `skills/subagent-execute-plan/SKILL.md` Step 0.6: report the message verbatim and stop. Only re-invoke with `--force` once the user confirms the other session is actually gone. Taking over prints:

```
took over run '<run-id>' from session <owner> (plan <plan-slug>, branch <branch>, last group <n> <sha>)
```

## Stale or missing plan verification stamp

**Symptom:** Printed on the executor's summary line rather than a stop:

```
Verification: stale
```

or

```
Verification: missing
```

**Cause:** `/bdk:subagent-execute-plan` Step 0.5 compares the `Plan sha256:` recorded in `.bdk/verify-plan/<plan-slug>-verification.md` against a fresh hash of the plan file (`bdk_run_state.py hash-plan <plan-path>`):

| Stamp | Meaning |
|---|---|
| present, hash matches | `stamped` - this exact plan was verified |
| present, hash differs | `stale` - the plan changed after verification |
| absent | `missing` - never verified |

**Fix:** Nothing is blocked - per the skill, `stale` and `missing` "warn and continue. Do not stop: skipping verification is the user's call to make". If the verdict matters, run `/bdk:verify-plan` again before continuing, or accept the risk and proceed. See [Full pipeline](workflows/full-pipeline.md).

## Plan file changed after the run started

**Symptom (in `init`'s `notes`):**

```
plan file changed since this run started - the plan is meant to be immutable. Groups already committed still stand; re-verify before continuing.
```

**Cause:** `scripts/bdk_run_state.py cmd_init` re-hashes the plan on every `init`/resume call and compares it to the hash stored in the run manifest. They differ because the plan file was edited mid-run.

**Fix:** Re-verify the plan (`/bdk:verify-plan`) before continuing execution; groups already committed are not undone.

## Code-review-graph registration failed

**Symptom:**

```
[BDK] code-review-graph register failed: <first line of stderr/stdout, or the exception>
```

**Cause:** `hooks/register-graph-repo/register.py` (`SessionStart`) tried to run `uvx code-review-graph register <path> --alias <dirname>` and the subprocess either failed (non-zero exit) or could not be started/timed out. This hook is skipped silently (no message at all) when `.bdk/settings.json` is missing, when `features.code-review-graph` is explicitly `false`, or when `uvx` is not on `PATH`.

**Fix:** Investigate the printed first line - commonly the `code-review-graph` CLI itself failing. Re-registration is idempotent and safe to retry on the next session start.

## Skill or command dependency missing

**Symptom (skill missing, printed to stderr, exit code 2):**

```
[BDK] Skill '<skill-name>' not installed. Install it for full functionality. Expected location: ~/.claude/skills/ or .claude/skills/
```

**Cause:** `hooks/is-skill-exist/check.py <skill-name>` is wired into a skill's own `UserPromptSubmit` frontmatter hook (for example `/bdk:commit` checks for `caveman-commit` before delegating to it - see `skills/commit/SKILL.md`, which simply invokes `/caveman:caveman-commit $ARGUMENTS`). No skill file under `~/.claude/skills/`, `.claude/skills/`, or any installed plugin's `skills/` directory declares that `name:` in its frontmatter.

**Fix:** Install the missing skill's plugin (for `/bdk:commit`, the `caveman` plugin providing `caveman-commit`). See [reference/skills.md](reference/skills.md).

**Symptom (command missing, printed to stderr, exit code 2):**

```
[BDK] Command '<command>' not found in PATH. This skill requires it to be installed.
```

optionally followed by `" Install: <install-hint>"` when the hook was called with an install-hint argument.

**Cause:** `hooks/is-command-exists/check.py <command> [install-hint]` is wired into a skill's frontmatter hook and `shutil.which(<command>)` returned nothing.

**Fix:** Install the named command using the install hint if one was printed.

## Rules drift detected at Stop

**Symptom:**

```
Documentation drift detected. The following rule files may need updating
based on the code changes you made this session:

  .claude/rules/<rule-file>.md
    triggered by: <changed-file>

For each rule file: based on what you changed this session, decide if the
documented patterns, class names, or examples are still accurate.
Use your session context - no codebase exploration needed.

Don't trust the existing wording just because it's already there - rule files
accumulate content from many different sessions and agents, and prior text earns
no credit for having survived this long. Verify any claim you touch against what
you actually changed, not against what the file already asserts.

Route anything you are tempted to write down:
  cross-cutting invariant that fails silently -> a rule file
  trap visible at the code site               -> a doc comment there
  a test or lint already enforces it          -> one line naming the enforcer
  anything else                               -> nothing

A line that a rename or a file move would force you to edit is a code mirror,
not a rule - it belongs at the code site or nowhere. Skip changelog-style
narration ("switched from X to Y"), dated notes, and ticket ids offered as the
only rationale.

"Nothing" is a frequent, correct outcome here - do not write a rule just to
have written something. For a full routing pass, run /bdk:add-rule.
```

**Cause:** `hooks/check-rules-drift/check.py` (a `Stop` hook) found that a file matching one of `.claude/rules/*.md`'s path-scoped frontmatter `paths:` patterns changed content since the last Stop hook run this session, and blocks so the affected rule file gets reviewed before the turn ends.

**Fix:** For each named rule file, decide - using session context, no extra exploration - whether it still describes the code accurately, and edit it if not. "Nothing to change" is a valid, common outcome. Run `/bdk:add-rule` for a fuller routing pass. See [Rules hygiene](workflows/rules-hygiene.md).
