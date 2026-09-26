# Troubleshooting

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

Symptom, cause, and fix for the messages BDK can actually show you, grouped by the hook or script that prints them. Message text is quoted verbatim from source.

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

| Stamp                 | Meaning                                       |
| --------------------- | --------------------------------------------- |
| present, hash matches | `stamped` - this exact plan was verified      |
| present, hash differs | `stale` - the plan changed after verification |
| absent                | `missing` - never verified                    |

**Fix:** Nothing is blocked - per the skill, `stale` and `missing` "warn and continue. Do not stop: skipping verification is the user's call to make". If the verdict matters, run `/bdk:verify-plan` again before continuing, or accept the risk and proceed. See [Full pipeline](workflows/full-pipeline.md).

## Plan file changed after the run started

**Symptom (in `init`'s `notes`):**

```
plan file changed since this run started - the plan is meant to be immutable. Groups already committed still stand; re-verify before continuing.
```

**Cause:** `scripts/bdk_run_state.py cmd_init` re-hashes the plan on every `init`/resume call and compares it to the hash stored in the run manifest. They differ because the plan file was edited mid-run.

**Fix:** Re-verify the plan (`/bdk:verify-plan`) before continuing execution; groups already committed are not undone.

## Skill or command dependency missing

**Symptom (skill missing, session content, exit code 0):**

```
[BDK] skill <name> is not installed; the skill that needs it falls back to its own behaviour.
```

**Cause:** `bdk hooks skill-exists <name>` runs from a skill's own `UserPromptSubmit` frontmatter hook (for example `/bdk:commit` checks for `caveman-commit` before delegating to it - see `skills/commit/SKILL.md`, which simply invokes `/caveman:caveman-commit $ARGUMENTS`). No `SKILL.md` under `~/.claude/skills/`, `.claude/skills/`, a plugin marketplace or an installed plugin version declares that `name:` in its frontmatter. See [Hooks reference](reference/hooks.md).

**Fix:** Install the missing skill's plugin (for `/bdk:commit`, the `caveman` plugin providing `caveman-commit`). See [reference/skills.md](reference/skills.md).

**Symptom (command missing, printed to stderr, exit code 2):**

```
[BDK] Command '<command>' not found in PATH. This skill requires it to be installed.
```

optionally followed by `" Install: <install-hint>"` when the hook was called with an install-hint argument.

**Cause:** `hooks/is-command-exists/check.py <command> [install-hint]` is wired into a skill's frontmatter hook and `shutil.which(<command>)` returned nothing.

**Fix:** Install the named command using the install hint if one was printed.
