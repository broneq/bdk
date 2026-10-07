# Design

## Context

See proposal.md - Why. The `bdk` CLI has four slices (`config`, `findings`, `git`, `run`) on the frame of #178 (`shared/cli`); `hooks.subagent-git` exists in the settings schema (#179 D7, default `false`) and `loadConfig` gives other slices the resolved configuration or why there is none. The plugin has no `hooks/` directory yet. Draft 1 (`draft/v3-1:hooks/hooks.json`, `kernel/src/hooks/`) had nine hook events and fourteen guards; the architecture keeps two ("Hooks") and removes the rest.

Host facts used below were checked against the current hooks reference (https://code.claude.com/docs/en/hooks, sections "SessionStart", "PreToolUse", exit code table) and the plugins reference ("Standard layout": `hooks/hooks.json` is discovered without a manifest entry), and probed with `claude -p --plugin-dir` on Claude Code 2.1.293:

- A plugin `PreToolUse` hook returning `permissionDecision: "deny"` blocks the call in `bypassPermissions` mode, and Claude sees the reason.
- `agent_id` is present only inside a subagent; `agent_type` is present in a subagent and also on the main thread of a session started with `--agent`. A plugin agent's `agent_type` is plugin-scoped (`bdk:lead`).
- A hook's stdin is closed after the payload (the probe's `cat` returned).
- `SessionStart`: plain stdout or `additionalContext` goes to the model; `systemMessage` is shown to the user; exit 2 shows stderr to the user without blocking. `PreToolUse`: exit 2 blocks the call; other non-zero codes are reported and ignored. JSON output is read only on exit 0.

## Goals / Non-Goals

**Goals:**

- The two hooks of the architecture, each a thin `hooks.json` entry over one `bdk hooks` verb, built as one vertical slice.
- A guard whose recognition of "git history change" is a fixed, tested table, not a heuristic over raw text.

**Non-Goals:**

- Guarding the working tree (`git restore`, `git clean`, `git checkout -- <path>`, `git add`): the architecture names history only; workers edit files.
- Recognising git aliases, `xargs`, `find -exec` or scripts; see Risks.
- The autopilot turning the guard on and the `bdk:lead` agent itself (later tasks).

## Decisions

### D1. One `hooks` slice with two verbs, importing `config`

`src/hooks/` with `commands/`, `use-cases/`, `domain/` (payload fields, shell reading, git history table), `render/` (host JSON), `schema/` and `tests/`, one file per command per layer (`.claude/rules/bdk-cli.md`). Its matrix row imports `config`, because "is the project configured, and what is `hooks.subagent-git`" is a use case the config slice owns (`loadConfig`).

- *Alternative:* a separate executable per hook (`dist/hooks.mjs`). Lost: two bundles of the same config code, and CLAUDE.md fixes hooks as `node dist/<cli>.mjs`.
- *Alternative:* reading `.bdk/settings.yaml` directly in the hook. Lost: the three layers and validation would be duplicated and drift from `bdk config show`.

### D2. The payload comes through `-` and a new `shared/stdin` boundary

The frame reads stdin only for an explicit `-` (`bdk-cli`, "No waiting on input"), so both verbs take the required argument `-`, and `hooks.json` passes it. Reading stdin is an OS boundary: a new module `shared/stdin` (admitted `os-boundary`) exports `readStdin()`, which reads `process.stdin` to its end (not `readFileSync(0)`, which throws `EAGAIN` on a non-blocking pipe); `main.ts` injects it, and use cases are tested with a string.

- *Alternative:* `files.readText("/dev/stdin")`. Lost: not portable to Windows, and it hides stdin behind a path.
- *Alternative:* `readStdin` defined inline in `main.ts`. Lost: other slices that will take `-` would copy it; the boundary module is the place the architecture lint already allows.

### D3. Text output is the host hook protocol; every decision exits 0

Without `--json` the verbs print the host's hook JSON, because the host is their only text reader; `--json` prints the BDK result (decision, matched command, reason; or status, root, context, warning) for tests and debugging. A denial exits 0, not 1: the host reads JSON only on exit 0, and an exit code meaning "you may not" is what #178 D-"No `policy/` or `guard/` class" keeps out of the CLI; hook guards speak the host protocol. An allow prints `{}` so stdout is always one JSON object.

- *Alternative:* deny by exit 2 and a reason on stderr. Lost: collides with the CLI's usage-error code 2, so a stale bundle answering `usage/unknown-command` would block every Bash call.

### D4. A broken guard fails open; a broken session start is shown

`hooks.json` appends `|| exit 1` to the `pre-tool-use` command and `|| exit 2` to `session-start`. The guard is optional and off by default; a missing bundle, an old Node or a defect must not stop every `Bash` call of every agent, so any failure becomes the non-blocking exit 1, which the host still reports. For `session-start` exit 2 is the code whose stderr the user sees, which turns "BDK broken" into a visible line. Inside the CLI, an unconfigured or invalid project is not a failure: the guard allows (there is no setting to enforce) and `session-start` warns.

- *Alternative:* fail closed (draft 1 exited 2 when its guard script was missing). Lost: draft 1's guards were mandatory process control; this one is an opt-in seat belt.
- *Alternative:* map not-configured to `env/not-configured` as `bdk plan` and `bdk check` do. Lost: the issue asks for one warning at session start, and a hook error would show a red hook failure instead.

### D5. Recognising a git history change (the issue's "To resolve in the spec")

The command text is lexed into simple commands the way a shell would (spec "Git history changes"), ported from draft 1's `domain/shell.ts`, which survived its guard tests: separators, quotes, escapes, comments, heredoc bodies and redirections, assignments and wrappers (`env`, `command`, `exec`, `time`, `nice`, `nohup`, `sudo`), and `sh -c`/`eval` strings read again up to three levels. Changes from draft 1: the content of `$(...)` and backticks is read again too (draft 1 left it opaque, so `x=$(git stash create)` passed); redirect targets are dropped instead of kept, because only the write-scope guard used them. A review of the first implementation added: shell options with a value before `-c` (`bash -o pipefail -c ...` hid the script), heredoc bodies a shell reads on stdin, `function f { ... }` bodies, the wrappers `timeout` and `env -S`. Text piped into a shell (`echo ... | sh`) stays opaque: telling a script from data on a pipe needs the producer's output.

For each simple command whose command word's base name is `git`, git's global options are skipped (with the values of `-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`, `--super-prefix`) and the subcommand plus its words go through the table in the spec. The table lists what moves a ref or makes a commit: `commit`/`merge`/`rebase`/`cherry-pick`/`revert`/`reset`/`am`/`pull`/`push`/`update-ref`/`replace`/`filter-*` always; `stash` (it makes commits and moves `refs/stash`, shared by every worktree) except `list`/`show`; ref-creating or deleting forms of `branch`, `tag`, `checkout`/`switch`, `worktree add`, `notes`, `reflog`, `symbolic-ref`. Also `checkout`/`switch --track` (creates a local branch) and `fetch` into a local ref (`main:main`). A plain branch switch moves `HEAD` but writes no history, so it passes; `git switch <name>` that creates a branch from a remote one cannot be told apart without the repository and passes. `-h`/`--help` and `push --dry-run` change nothing and pass. `git branch -l -D x` passes: git itself rejects `-l` with a write option (exit 129, checked on git 2.54).

- *Alternative:* an allow-list of read-only subcommands, denying the rest. Lost: it also denies `git add`, `git mv`, `git apply`, `git restore`, which change files, not history, and the issue scopes the guard to history.
- *Alternative:* a regular expression over the raw command (`\bgit\s+(commit|...)`). Lost: matches inside quoted messages (`git commit -m "fix git reset"`, `grep "git push"`) and misses `git -C dir commit`.
- *Alternative:* draft 1's worker-specific `git add`/`git commit` exceptions and working-tree verbs. Lost: v3 workers never commit (the lead does), and the working tree is out of scope.

### D6. Who is a worker

A worker is any subagent (`agent_id` present) whose `agent_type` is not `bdk:lead` (architecture, Settings table: "every agent type except `bdk:lead`"). The main thread has no `agent_id`, also when started with `--agent`, so it is never guarded. The guard checks the payload first and reads the configuration last (spec condition order), so a main-thread or non-git call never touches the file system.

### D7. The session context

The context is the minimum the model cannot cheaply learn: BDK is configured here, where the root is, where the resolved configuration is (`bdk config show`), and that the guard is on when it is. The lists of skills and agents come from the host; rules come with #184. Under 6 lines keeps the per-session cost negligible. The warnings reuse the exact lines of `bdk config show` for the same states (`bdk-cli/config`, "config show"), so the user sees one wording.

### D8. Speed

Every `Bash` call now starts Node and the bundle: measured 50 ms per call for `bdk config show` (5 runs, M-series Mac). The matcher `Bash` keeps every other tool free, and the guard returns before reading configuration for main-thread calls and for commands without git. Accepted: one hook process per Bash call is the cost of an off-by-default guard being switchable in configuration rather than in `hooks.json`.

## Risks / Trade-offs

- [A determined or creative agent bypasses the guard: an alias, `xargs git commit`, a script file, `$GIT commit`] → The guard is a seat belt against a careless worker, as the spec states; the reason text tells the agent what to do instead, which is what a careless agent needs.
- [The lexer misreads an unusual command and denies a harmless one] → Denial only in a subagent with the guard on; the reason names the matched command, so the agent or the user sees the false match; table and lexer are unit-tested on the cases in the spec.
- [`agent_type` naming changes in a later Claude Code] → One constant `bdk:lead`, covered by the E2E probe in tasks.
- [50 ms on every Bash call] → See D8; revisit with a measurement if a run shows it.

## Migration Plan

New files only; installing the plugin version that contains `hooks/hooks.json` turns both hooks on. Rollback is removing `hooks/hooks.json`.
