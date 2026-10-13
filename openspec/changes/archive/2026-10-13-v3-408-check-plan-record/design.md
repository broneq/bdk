## Context

`bdk check run` (spec `bdk-cli/check`, built in v3-183-check-run, extended in v3-275 and v3-317) selects the `tools.test`, `tools.lint` and `tools.build` items of `.bdk/settings.yaml`, runs each through `/bin/sh -c` and records the result. The agents that call it are `bdk:implementer` (`/bdk:implement-part`, `/bdk:resolve-conflict`), `bdk:conformer` (`/bdk:conform-part`) and `bdk:lead` (`/bdk:execute-waves`, `/bdk:review-round`); the user's main session never runs a check.

What the wrapper does today, read from `plugins/bdk/src/check/` and `src/shared/shell/` (the issue asks for it in the spec):

- **Processes.** One `/bin/sh -c <command>` per selected item, in the project root, one after another; no concurrency, no limit beyond that. Every item runs even after a red one.
- **Output.** stdout and stderr go together, in arrival order, only to `<run-dir>/checks/<id>/<kind>-<tool>.txt`, which ends with `exit <code>` or `timeout <seconds>`. Nothing passes through: stdout of the CLI holds one line per check and the last 20 lines of each red one.
- **Exit code.** Not passed through: the CLI exits 1 when any check is red, 0 otherwise; the command's own code is only in `checks/<id>.json`.
- **Timeout and cleanup.** The item's `timeout` (600 s by default) kills the whole process group; processes left running after the command exits are killed too, and so is the group when the CLI gets `SIGINT`, `SIGTERM` or `SIGHUP`.
- **`<id>`.** Any kebab-case name the caller picks. `/bdk:implement-part` uses `<part-id>-red` and `<part-id>`; `02-red2` in the issue is a model's own suffix for a second red run, not a convention.

The agent's Bash call shows only `bdk check run ...`. Issue #408 found this on a Next.js + Convex project whose hook allows only the project's own Playwright wrapper (with a machine-wide spec budget): the transcript could not show whether the slow run was the project wrapper, the spec budget or BDK.

The user chose the direction on a Lavish review page on 2026-10-13: the working agent runs the command itself (option A), and the agent picks the test files, inside this Change. Four probes on Claude Code then fixed the form of the call (D3, D4).

## Goals / Non-Goals

**Goals:**

- The real command, as configured, is the agent's own Bash call; its exit code is the tool's result.
- `bdk` resolves (which items, which files, which line) and records (result, findings), and decides nothing about the order of the work.
- The call passes the permission rules `/bdk:setup` writes, in the default permission mode.
- A test item runs on the tests the agent picked for the part, not on whatever files changed.

**Non-Goals:**

- Building in the main checkout without part worktrees (#406).
- Host contention of heavy suites: still the project's (v3-317-test-groups).
- A runner agent, a background mode or any new wrapper.

## Decisions

### D1. The working agent runs the command itself

`bdk:implementer`, `bdk:conformer` and `bdk:lead` run each command as their own Bash call, one call per item, one after another.

- *Runner subagent (`bdk:check-runner`)* lost: the caller sees only an `Agent` call, so a hang looks as it does today; every check (red run, part check, up to three retries, conform, wave, review) pays an agent start; implementer and conformer would need the `Agent` tool.
- *Mixed (parts in the agent, wave and review in a runner)* lost: two paths to describe and keep, and the full-suite case of the issue stays behind a layer.

The context cost stays small because the call writes its output to a file (D3) and `record` prints only the tail of a red check, as `check run` did.

### D2. `check run` becomes `check plan` and `check record`

`bdk check plan <run-dir> <id> [--at <point>] [--changed <ref>] [--scope <path>]... [--tests <path>]... [--kind <kind>]...` does the selection of `check run` unchanged (points, kinds, files, `paths`, `{files}`, skips), runs nothing, writes `<run-dir>/checks/<id>/plan.json` and prints one line to run per item. `bdk check record <run-dir> <id> [--exit <kind>-<tool>=<code>]... [--timed-out <kind>-<tool>]... [--round <n>]` reads the plan and the output files and writes `checks/<id>.json` and the findings, as `check run` did. `check run` goes (**BREAKING**).

- *Keep `check run` next to them* lost: two ways to run a check, and skills would drift back to the hidden one.
- *A visible wrapper (`bdk check exec -- <command>`)* lost: the project's hook and the permission rule `Bash(<command> *)` match the command's own prefix, not `bdk`; it is still a second wrapper.
- *One verb, `record`, with the agent composing the command from `settings.yaml`* lost: the selection by point, kind and `paths`, the `{files}` replacement and the quoting are deterministic and tested; a model re-deriving them per call would get them wrong.

### D3. The line: the command, stdin closed, output to the file

For each item `plan` prints exactly:

```
<command> </dev/null > <output file> 2>&1
```

with `<command>` the item's command after the `{files}` replacement, and `<output file>` the path of `checks/<id>/<kind>-<tool>.txt`, relative to the project root when it is inside it. The agent runs it from the project root with the Bash `timeout` that `plan` prints (the item's `timeout` in milliseconds). The Bash tool reports the exit code; the agent passes it to `record` as `--exit <kind>-<tool>=<code>`, or `--timed-out <kind>-<tool>` when the tool reports the call timed out.

Probes on Claude Code (2026-10-13, `claude -p --model haiku`, permission rule `Bash(npm run test:e2e *)`):

| Line | Result |
| --- | --- |
| `cd <root> && <command> ... > <file> 2>&1; printf '\nexit %s\n' "$?" >> <file>; tail -n 40 <file>` | refused: "Quoted text in this command can't be checked" |
| `( a && b ) </dev/null > <file> 2>&1; ...` | refused: "A group in parentheses ... can't be checked" |
| `<command> ... > <file> 2>&1; echo exit $? >> <file>` | refused: "A variable in this command can't be checked" |
| `cd <dir> && <command> ... > <file> 2>&1` | refused: `cd` with a redirect needs approval |
| `<command> </dev/null > <file> 2>&1` | needs approval for the file write; **runs** with `Edit(<dir>/**)` allowed, exit code reported by the tool (0, and 3 for a failing case) |
| `<command> 2>&1 \| tail -n 40` | runs, but the exit code is `tail`'s |

So the line holds no `cd`, no variable, no quoted text and no group; `/bdk:setup` adds `Edit(.bdk/runs/**)` to the allow rules next to the `Bash(<command>)` rules it already writes. The tail the user saw on the review page (`tail -n 40` in the call) moves into `record`'s output, because a pipe to `tail` loses the exit code.

- *Bare command, no redirect* lost: no output file, so `record` has no tail for the agent, no evidence path for a finding, and every green run fills the agent's context with the whole output.
- *`tee` into the file* lost: a pipe reports `tee`'s exit code.

A command holding a shell list or pipe (`a && b`, `a | b`) keeps working, but the redirect binds only to its last part. `plan` names such an item in a `note` line saying that only the last part writes to the output file and that a project script keeps it whole; `/bdk:setup` already prefers the project's scripts (spec `bdk-setup`).

### D4. Items longer than 600 s: raise the Bash cap, no background mode

The Bash tool caps a foreground call at 600 s by default. A probe showed that `BASH_MAX_TIMEOUT_MS` in the `env` of a settings file raises that cap (the tool's description then reads "max 1800000 for a foreground command"), and a second probe showed that a subagent that starts a command with `run_in_background: true` ends its turn and returns without the result. So:

- `/bdk:setup` writes `env.BASH_MAX_TIMEOUT_MS` into `.claude/settings.json` when an item's `timeout` exceeds 600, set to the largest item `timeout` in milliseconds.
- `plan` reads `BASH_MAX_TIMEOUT_MS` from its own environment (the Bash tool passes the session's environment to the CLI; default 600000) and, for an item whose `timeout` exceeds it, prints a `note` line naming the key and the value to set; the printed Bash `timeout` is then the cap.

- *Start in the background and wait with a foreground `until` loop on an exit line* lost: the line needs `$?` and a loop, which the permission check refuses (D3), and the stop at the deadline needs a PID.

What the agent's call no longer gives, compared with the shell runner: killing processes a command leaves running after it exits, and killing the process group when the CLI is interrupted. The Bash tool kills the call at its timeout; a test runner that starts servers (Playwright `webServer`) stops them on its own exit. `src/shared/shell/` is removed with `check run`.

### D5. The agent picks the test files: `--tests`

`--tests <path>` (repeatable) gives the `tools.test` items the files the agent picked; when it is given, test items take only those files, routed to items by `paths` exactly as files are today, and lint and build items keep taking the files of `--changed` and `--scope`. Without `--tests`, test items take the run's files as before, so the wave and review checks, which run whole suites, do not change. A `{files}` test item with no picked file is skipped (`no-files`), so a part that picked no E2E spec runs no E2E suite.

`/bdk:implement-part`, `/bdk:conform-part` and `/bdk:resolve-conflict` say what to pick: the part's acceptance tests, the existing tests of the modules the part changed, and the E2E specs of the flows it touched; their report names the picked tests, one line each with why.

- *Keep `--changed` for tests* lost: what runs follows what changed; a change to `src/checkout.ts` skips `e2e/checkout.spec.ts` (the user's point on the review page).
- *A separate block skill `select-tests`* deferred: a skill starts plain and grows a block only when an eval shows the problem (CLAUDE.md, "Building skills (v3)"); the user chose the section in the part skills.
- *`bdk` computing related tests* lost: it does not know which flows a part touches.

### D6. Plan file, result and statuses

`plan.json` holds `version: 1`, the selection inputs (`at`, `changed`, `scope`, `tests`), `cwd` (the project root), one entry per item to run (`kind`, `tool`, `command`, `scoped`, `timeout`, `output`, `line`) and the skipped entries. `record` without a plan reports `env/plan-missing`.

`checks/<id>.json` moves to `version: 3`: each check gains `cwd` and its `status` is `pass`, `fail`, `timeout` or `not-run` (no `--exit` and no `--timed-out` for it). `not-run` is red, so `record` cannot write a green result for a check nobody ran. `record` appends the `exit <code>` or `timeout <seconds>` line to the output file, as the shell runner did, unless the file already ends with one (a second `record` of the same id), and a `not-run` check gets no output file line. The 20-line tail, the cut-tail line, the findings of `--round` and exit 1 on `fail` stay as they were.

- *Status `missing` for a file without an exit line* lost: the agent, not the file, knows the exit code now.

### D7. Docs

The Concepts page of the orchestrators redraws every execute and review diagram that shows `bdk check run` as `plan`, the agent's Bash call and `record`; the Guide's configuration page explains `--tests`, the permission rules and `BASH_MAX_TIMEOUT_MS`. Pages: proposal, Impact.

## Risks / Trade-offs

- [The agent passes a wrong exit code] -> The Bash tool states the code; `record` refuses a malformed `--exit` and marks an item without one `not-run`. The command and its code stay in the transcript for `/bdk:diagnose-run`.
- [The agent edits the printed line] -> The skills say to run it character for character; `plan.json` keeps the line, so a reviewer compares it with the call.
- [A project whose hook blocks direct runner calls] -> The configured command is the project's own script, which is what such a hook allows; the issue's project is the case.
- [A trusted-folder requirement] -> Project settings, including the new `Edit` rule and `env`, apply only in a folder the user trusted, as the existing rules already do (Guide, first run).
- [#406 edits the same skills] -> Whichever merges second rebases; this Change does not touch the worktree steps.

## Migration Plan

`bdk check run` disappears in the next `bdk--v3` release; no released `bdk` v3 exists yet (#213), so no user calls it. `/bdk:setup` on an existing project adds the `Edit` rule and the `env` key. Rollback: revert the commit.

## Measurement cost

Paid probes of this Change, all `claude -p --model haiku` on scratch projects: background Bash in a subagent, $0.0077, 12 s; background start plus foreground wait loop, cost not recorded, 39 s; compound line with `printf` and a group, $0.0038; five line variants, $0.0057; redirect with an `Edit` rule, $0.0037; `BASH_MAX_TIMEOUT_MS` from the environment, $0.0048; the same from a settings file, $0.0048. Known total $0.0305 and about 2 minutes of machine time before the Change was built; the two probes of task 5.1 added $0.0107 and 20 s, plus the one run whose cost was not recorded. Two further attempts failed before reaching the model (untrusted folder, broken prompt quoting).

## Measurement in a test project (task 5.1)

2026-10-13, Claude Code with `claude -p --model haiku` in a scratch copy of the eval fixture `tiny-ledger-bdk.sh` (`node --test {files}` with `timeout: 900` at `part`, `npm test` at `wave`), default permission mode, the setup rules passed as a settings file (`--settings .claude/settings.json`: `Bash(*/bin/bdk *)`, `Bash(npm test)`, `Bash(node --test *)`, `Edit(.bdk/runs/**)`, `env.BASH_MAX_TIMEOUT_MS: "900000"`); a settings file passed this way applies without the folder trust that project settings need.

- `bdk check plan ... --at part --tests src/ledger.test.js` printed the Bash timeout `900000` and no note: `env.BASH_MAX_TIMEOUT_MS` of the settings reached the `bdk` process the Bash tool started.
- The line `node --test src/ledger.test.js </dev/null > .bdk/runs/probe/checks/01/test-node-test-changed.txt 2>&1` ran with no approval and no denial (`permission_denials: []`); the output file ends with `exit 0` after `record`. $0.0066, 10 s.
- With the test made red, the wave line `npm test </dev/null > ... 2>&1` passed the exact rule `Bash(npm test)` (the redirect is not part of the match), the tool reported exit 1, and `record` printed `verdict: fail (1 of 1 red)`. $0.0041, 10 s.
- A green call shows no exit code in the tool result; the model read the missing `Exit code` line as 0. The skills say so.

## Eval runs (task 5.2, acceptance 7.1)

2026-10-13, Claude Code with the plugin, `--ablation none --runs 1 --model sonnet`, clean `HOME` and the `git` entry of "Host limits", grants of `plugins/bdk/evals/README.md` plus `"Bash(npm test)" "Bash(node --test *)"`:

| Case | Score | Cost | Time |
| --- | --- | --- | --- |
| `implement-part-csv` | 1.00 (`red-run-real-command` and `checks-recorded-v3` green: the acceptance signal) | $0.31 | 61 s |
| `conform-part-violations` | 1.00 | $0.24 | 40 s |
| `conform-part-clean` | 1.00 | $0.20 | 38 s |
| `resolve-conflict-two-functions`, `resolve-conflict-wave` | 1.00 each | $0.42 | 110 s |
| `cli-route` | 0.75: `no-writing-bdk` (now naming `check record`) green; `skill-fired` red, the model answered without loading `/bdk:cli`, which this Change does not touch | $0.10 | 37 s |
| `execute-wave-check` | 1.00 | $0.41 | 118 s |

Total $1.68 and about 7 minutes of machine time, within the $12 Budget of #408; no run failed or was repeated.

## Open Questions

None.
