# Design

## Context

The `bdk` CLI frame and its slice architecture exist (v3-178, spec `bdk-cli`), and so do the slices `config` (v3-179), `findings` (v3-187), `run` (v3-188) and `git` (v3-186). This Change adds the `check` slice. Other tasks run in parallel and touch the same shared spots (`src/slices.ts`, `src/main.ts`, `src/shared/`), so the shared edits stay small and are announced.

Input: architecture "Execute" (the implementer and the conformer call `bdk check run` for part checks), "Review round" (the lead calls `bdk check run (full)` in parallel with the reviewers), "Run state, run artifacts and resume" (`<change>/checks/<id>.json`, written by `bdk check run`, read by the implementer and the review), "Findings and triage" (`bdk check run` appends red checks itself), "Configuration" (`tools.test`, `tools.lint`, `tools.build`: a command and a `scoped` variant taking `{files}`), "CLI". Draft 1 `kernel-cli/check` "bdk check run" is input to read: its command composition (`scoped` else `command`, `{files}` filled, `/bin/sh -c`, stdin closed, timeout with process-group kill, output files ending in an exit line, a tail of 20 lines) held up in run B1 and is taken over. What v3 drops from it: tickets, evidence manifests, the diff check, `--skip` with `when`, the commit command, and the active Change; all of it was bookkeeping around agents running checks (findings, "Distrust of the agent became bookkeeping").

## Goals / Non-Goals

**Goals:**

- One call runs every configured check of a scope and leaves a result file that a resumed or a different agent reads instead of rerunning (issue acceptance signal).
- No hang: stdin closed, a timeout per command, the process group killed.
- Parallel callers never share a file.
- Every rule runs in unit tests without a shell or a file system.

**Non-Goals:**

- No decision on what a red check means for the work: retry, escalate or fix is skill text (ADR-0003).
- No detection of check commands; `/bdk:setup` writes them (#181).
- No `tools.e2e`; the `e2e-check` block starts and drives the product itself.
- No duration or speed figures in the result (D3).

## Decisions

### D1. One command `bdk check run`, one slice `check`, run directory and id as arguments

`bdk check run <run-dir> <id> [--scope <path>]... [--kind <kind>]... [--round <n>]`. The architecture names the command `bdk check run [--scope]` and its file `<change>/checks/<id>.json`.

- **The run directory is an argument.** Every agent gets the absolute path of the Change's run directory (architecture "Execute"), and a part in a worktree must write where the lead reads. Deriving it from `run.json` would make the command depend on a run and on the `run` slice's file, and would break a call outside an autopilot run.
- **The id is a required argument.** Parallel parts of one wave run their checks at the same time against one run directory; a default id (`scoped`, `full`) would make them overwrite each other's file, the draft 1 defect "Parallel tasks share one tree and one check file". The caller knows a stable name: the part id, `round-N`.
- **The run directory must exist.** A typo would otherwise create a stray directory and the reader would never find the result; the caller's stage creates the run directory long before.

Layout per `bdk-cli` "Slice anatomy": `commands/run.ts`, `use-cases/run.ts` (with the injected `CheckDeps`), `domain/` (`plan.ts`: entries to command lines, `{files}` and shell quoting; `verdict.ts`: status, verdict, tail, finding fields), `store/results.ts` (result file and output paths), `render/run.ts`, `schema/run.ts`, `tests/`. Matrix row: `check` imports `config` (`loadConfig`, the resolved `tools.*`) and `findings` (`addFinding`): both are use cases those slices own, the case the matrix admits.

Alternatives: the run directory as `--run`, defaulting to `.bdk/runs/<current>` - lost: a hidden dependency on `run.json` and a wrong directory for a worktree caller. `--out <file>` naming the result file - lost: the architecture fixes `checks/<id>.json`, and the output files need a directory named after the id anyway.

### D2. `--scope` as a repeatable flag, a frame extension

The frame had no way to pass a list. Options:

- one string flag, paths separated by spaces or commas - lost: paths with spaces or commas break, and the caller would have to quote for our parser;
- read the list from stdin with `--scope -` - lost: spec `bdk-cli` allows it, but every skill call becomes a pipe, which draft 1 measured as the source of hangs ("Commands hang on stdin");
- a repeatable flag, one path per value - **chosen**: `parseArgs` supports it natively (`multiple: true`), values pass byte for byte, and other commands that take file lists (`bdk rules for --files`, #184) can use the same declaration.

The frame change: `Flag` gains `multiple?: boolean` for string flags, `Input.flags` values can be `readonly string[]`, and command help prints `--scope <value> (repeatable)`. `--kind` uses it too.

### D3. Result file schema (issue: "To resolve in the spec")

`checks/<id>.json`: `{version: 1, id, scope, verdict, checks: [{kind, tool, command, scoped, status, exit, timeout, output, tail}], findings}`, specified in `bdk-cli/check`, "Result file". The `--json` output is the same object, so a skill reads either one with one schema.

- **`version`** lets a later reader refuse or migrate an old file.
- **`command`** is the command line as run, so a reader can rerun it by hand and see what `{files}` became.
- **`tail`** (last 20 lines of a red check) puts the cause in the agent's context without a second read; the whole output stays in `output`.
- **`status`** `pass | fail | timeout`. Draft 1 counted exit 127 (command not found) as "not run"; here it is `fail`: a check that could not run did not pass, and calling it anything else lets a broken setup go green. The tail shows `command not found`.
- **Verdict `none`** when no entry was selected: an honest third value; a skill tells "no checks configured" from "checks passed".
- **No time stamp, no duration.** The frame wants the same input to give byte-identical output (`bdk-cli` "Output streams"); turns and time come from transcripts (architecture "Resume").
- **`output` paths are `<run-dir>` joined as given**, so a caller that passed an absolute run directory gets absolute paths it can hand to another agent.

Alternatives: JSON Lines, one line per check - lost: the result is replaced as a whole and read as a whole. Storing the whole output in the JSON - lost: test output can be megabytes; the file would be too big for an agent to read.

### D4. How commands run

Through a new OS boundary `shared/shell` (admitted `os-boundary`: child processes): `spawn("/bin/sh", ["-c", command], {cwd: root, stdio: ["ignore", fd, fd], detached: true})`, where `fd` is the output file opened for writing. Both streams go to one file descriptor, so their lines interleave in arrival order with no buffering in the CLI and no memory limit. `detached` puts the shell in its own process group; at the timeout the boundary sends `SIGKILL` to the group (`process.kill(-pid)`), so a test runner's workers die with it. The boundary returns how the command ended; the use case then reads the output for the tail and appends the `exit <code>` or `timeout <s>` line through `Files`, so the line format is a slice rule tested without a shell.

- **Sequential.** Commands of one call run one after another. Test and lint in parallel would be faster but can fight over caches and build outputs (`tsc` incremental files, Vitest's cache) and interleave CPU-heavy work, making timeouts flaky. A skill that wants parallelism calls the command twice with different ids and `--kind`.
- **Every command runs**, also after a red one: the agent fixes all red checks in one turn instead of one per call.
- **Project root** as working directory: `tools.*` commands are written for it (`/bdk:setup`), and the root is what the `config` slice resolved.
- **`/bin/sh` that cannot start** gives the check exit 127 with a line naming the shell in its output, the code a shell gives for a missing command. An error would end the call between commands and leave the previous `checks/<id>.json` in place with a stale verdict; a red check keeps the result complete.
- **Nothing outlives a check.** When the shell exits, the boundary kills its process group too, so a stray background process cannot write after the `exit` line. While a command runs, the boundary listens for `SIGINT`, `SIGTERM` and `SIGHUP`, kills the group and re-raises the signal; without that, a caller's Bash timeout ending `bdk` would leave the detached test runner running, the B1 hang.
- **`{files}` is replaced through a function**, so `$&` or `$'` in a path is not read as a replacement pattern.
- **A scoped entry with no `scoped` variant runs its full `command`.** Skipping it would turn a configured check into a silent green; the result marks `scoped: false` so the reader sees why it took long. `--kind` lets a caller leave out a slow kind such as `build`.

Alternatives: `execFile` with buffered output - lost: a memory limit and no streaming to the file. Killing only the shell - lost: Vitest and Jest workers survive a killed parent and keep the call alive, the B1 hang.

### D5. Timeout per command in configuration

The issue asks for a timeout per command. A new optional `timeout` field (integer seconds, at least 1) on each `tools.test`, `tools.lint` and `tools.build` item; `bdk check run` uses 600 when absent, and at most 86400 (a day): a longer Node timer overflows and fires at once. The config spec lets the task that builds a key's consumer change its row. 600 s: long enough for a full test suite of a mid-size project, short enough that a hang costs ten minutes, not the 93 of B1. Alternatives: a `--timeout` flag - lost: a full suite and a scoped lint need different limits in one call; a global `execution.check-timeout` - lost: same reason, one number for all entries.

### D6. Red checks as findings

With `--round <n>` the command appends, for each red check, `addFinding` of the `findings` slice to `<run-dir>/review/round-<n>/findings.jsonl` with `source: check-run`, `rule: check/<kind>/<tool>`, a summary with the exit code or the timeout, and the output path as `evidence`. The rule makes the dedupe key stable across reruns of one round, so a re-check after a fix does not add a second finding id. No `file`: a red test run names no single file reliably, and a guess would mislead the judge. `--round` is a number rather than a path because the round directory sits at a fixed place under the run directory.

Alternatives: the lead appends red checks itself from the result - lost: the architecture says the command does it, and it saves a turn per round. Appending green checks as resolutions - lost: the findings log has no such event; the judge levels findings.

### D7. Errors

`env/not-configured` and `env/config-invalid` (the code `bdk config set` already uses, and `bdk plan check` maps the same way) come from `loadConfig`; `env/run-dir-missing` from D1; `usage/invalid-argument` for a bad id, kind, round or empty scope path. All are checked before any command runs, so an error never leaves a half-written result.

## Risks / Trade-offs

- [A command that ignores `SIGKILL` of its group by starting a new session (`setsid`)] - it outlives the timeout. Mitigation: none in v3.0; check commands do not do this, and the call itself still returns at the timeout because the boundary waits for the shell, not its descendants.
- [Sequential checks are slower than parallel ones] - mitigated by scoped commands and `--kind`; measured by the speed issue (#208) before anything is parallelised.
- [`/bin/sh` only] - no Windows support; the plugin targets macOS and Linux like the rest of the CLI.

## Migration Plan

None: a new command, a new optional configuration field and a backward-compatible frame extension.

## Open Questions

None.
