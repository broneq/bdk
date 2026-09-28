# Design

## Context

See proposal.md - Why. The state this Change builds on:

- T10 fixed the contract of the five hooks (`kernel-cli/hooks`), the guard mode and its `|| exit 2` wrapper regex (`kernel-cli`, Output modes), the availability classes the `pre-tool` guard enforces by exact verb, and the four `guard/*` rules. `hooks pre-tool`, `prompt-expansion` and `session-end` are stubs answering `kernel/not-implemented`.
- T01 recorded the host facts: `command_name` is namespaced (`bdk:plan`), `command_args` is the raw string, `UserPromptExpansion` also fires for `claude -p "/bdk:plan"`, `agent_id` and `agent_type` exist only in subagent payloads, the subagent tool is `Agent`, `NotebookEdit` carries `notebook_path`, there is no `MultiEdit`, `SessionEnd` never fires on SIGKILL, and a DMI skill is refused before `PreToolUse`.
- T21 fixed the gate rule: a gate is done when a `transition` naming it with `source: user` (or `policy` under `auto`) is not older than the gate's ready time; `next` returns `waiting: gate`. A kernel `transition` without `input-hash` changes no node state.
- T22 shipped `checkpointChange` in `shared/store` (skips reported, never refused, for implicit callers) and the `change takeover` output field `previousSession`, left absent until session ids reach the kernel.
- T23 added two guard inputs: T23-D0 (the dispatch prompt is a package path plus at most one sentence, risk R9) and T23-D14 / D20 (the read-only adapters carry Bash for kernel commands and test runs only).

Hooks reference (checked 2026-09-28, https://code.claude.com/docs/en/hooks): a matcher with characters other than letters, digits, `_`, `-`, `|`, `,` and spaces is an unanchored JavaScript regular expression, so the BDK matchers carry `^` and `$`; exit 2 blocks `PreToolUse` and `UserPromptExpansion`, and the message is `permissionDecisionReason` when stdout holds a deny object, stderr otherwise; plain stdout on exit 0 of `UserPromptExpansion` is added as context; `SessionEnd` cannot block. Plugins reference: `CLAUDE_PLUGIN_ROOT` is substituted in hook commands and exported to the hook process.

Constraints: `hooks` may import `change`, `graph`, `log`, `ctx`, `config` (`kernel-architecture`, Dependency matrix) and reaches the checkpoint through `shared/store`; guard mode exits only 0 or 2; the NFR "Latency" budgets (prefilter < 5 ms, kernel guard p95 < 150 ms).

## Goals / Non-Goals

**Goals:**

- A gate passes only through a typed stage command, and only when it is ready at typing time (T1, S8).
- A subagent cannot rewrite the shared working tree or its history through git or through the kernel (T3).
- A broken kernel blocks only guarded calls, never ordinary main-thread work.
- Every decision is a pure function of the payload (and, for `prompt-expansion`, the Change), unit-testable without a host.

**Non-Goals:**

- An adversarial model: a deliberate bypass (writing through `python -c`, an interpreter script, a symlink) is out of the threat model (design NFR "Security"); the guards are best effort for a careless model.
- Auditing transcripts or the user's `!` commands (HOST-FACTS `bang-pretool`).

## Decisions

### D-1 Prefilter in a POSIX shell script, over-approximating on the raw payload

`hooks/guard/pre-tool.sh` reads stdin into a variable and asks the kernel only when one of these substrings is present anywhere in the payload:

| Condition                                            | Covers                                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| `.bdk/specs`                                         | spec guard, any tool, any thread                |
| `bdk.mjs` and `hooks`                                | `bdk.mjs hooks` from any thread                 |
| `/bdk:`                                              | a nested `claude ... /bdk:<stage>`              |
| `"agent_id"` and (`git` or `bdk.mjs`)                | subagent git and kernel commands                |
| `bdk:reader`, `bdk:reviewer` or `bdk:scout`          | reader writes, and dispatches to those adapters |
| `"subagent_type"` and (`bdk:worker` or `bdk:runner`) | dispatches to the writing adapters              |

It never parses JSON (no `jq` dependency; a JSON escape such as `\"` only makes a substring test match more often). Whatever passes the prefilter, the kernel decides exactly from the parsed payload, so an over-match costs one Node start and never a wrong decision. A main-thread `git status` matches none of the rows and returns without Node, which is what keeps a broken kernel from blocking ordinary work.

Before the kernel line the script checks `command -v node` and the bundle file, and on failure prints `guard/kernel-unavailable: Node or dist/bdk.mjs is missing; install Node >= 22.13 and run /bdk:setup` to stderr and exits 2. The kernel line matches the `guard-wrapper` regex: `printf '%s' "$payload" | node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks pre-tool || exit 2`. `hooks.json` runs `sh "${CLAUDE_PLUGIN_ROOT}/hooks/guard/pre-tool.sh" || exit 2`, so a missing script (sh exits 127) also blocks. `prompt-expansion.sh` has the same availability check and no prefilter, because its matcher already selects the four stage commands.

Alternatives: the design's prefilter inline in `hooks.json` (one very long line nobody can test; the same logic in a script is testable with `sh` in a unit test); `jq` for exact fields (a new user dependency, and 10-20 ms per call); per-tool matchers with separate prefilters (four entries with duplicated availability checks). A regex over the command text only, as the design sketched for the spec guard, was rejected in D-2.

### D-2 A shell lexer, not a regex, decides what a command does

`hooks/domain/shell.ts` turns a Bash command into simple commands (`{ words, redirects }`): single and double quotes, backslash escapes, `#` comments at a word start, heredocs (`<<EOF`, `<<-EOF`, `<<'EOF'`, the body skipped up to the delimiter line), separators `;`, `&&`, `||`, `|`, `&`, newlines, and `(`, `)`, `{`, `}` as grouping. `$(...)` and backticks stay inside the word they appear in. A simple command whose command word is `sh`, `bash`, `zsh` or `dash` with `-c <string>`, or `eval`, is lexed again from its string (depth 3).

This answers the plan's open question (false positives such as `git reset` inside a commit message): only command words count. `git commit -m "undo git reset"` is a `commit`; `echo git reset` has the command word `echo`; a heredoc body passed to `bdk log ingest` is never read as commands or redirections.

The command word is the first word after variable assignments (`A=b`) and the wrappers `env` (with its options and assignments), `command`, `exec`, `time`, `nice`, `nohup`, `sudo`, compared by basename, so `/usr/bin/git` is `git`.

Alternatives: a regex per rule (the source of every false positive the plan names, and unable to skip heredocs); a full POSIX parser dependency (a runtime dependency for a best-effort guard, against V1-8).

### D-3 Git guard for subagents

A subagent payload (`agent_id` present, HOST-FACTS `main-no-agent-id`) is denied when a simple command is `git` and its verb, the first word after the global options `-C <path>`, `-c <k=v>`, `--git-dir[=]`, `--work-tree[=]`, `--no-pager`, `-P`, `--no-optional-locks`, `--literal-pathspecs`, is one of: `stash` (every subcommand, the stash stack is shared by every worktree), `reset`, `clean`, `restore`, `commit`, `add`, `merge`, `rebase`, `cherry-pick`, `push`; `checkout` with `--` or a `.` argument, or with `-f` / `--force`; `switch` with `--discard-changes`, `-f` or `--force`. `checkout <branch>` without those stays allowed as the plan lists it. The reason names the verb as matched (`git stash`, `git checkout -- <path>`).

`-f` on `checkout` and `switch` joins the list because it discards local changes exactly as `--discard-changes` does; `git stash list` is denied with the rest because distinguishing read subcommands buys nothing for a subagent and the stash stack is a known cross-worktree hazard.

### D-4 Kernel command guard by exact verb

A simple command invokes the kernel when a word's basename is `bdk.mjs` and it is the command word or follows `node` and node's own options. The words after it are resolved against the bundled command index with the registry's own `resolve`, so a verb is matched exactly as the kernel would dispatch it. A `hook` verb is denied in every thread (`guard/hooks-from-bash`); an `orchestrator` verb is denied to a subagent (`guard/subagent-kernel-command`); `agent` and `read` verbs, an unknown verb and `--help` pass. `hooks` deps gain the command index.

### D-5 Nested stage commands are denied (HOST-FACTS `upe-headless`)

A simple command whose command word is `claude` and which carries a word starting with `/bdk:plan`, `/bdk:execute`, `/bdk:close` or `/bdk:run` is denied from any thread with the new rule `guard/nested-stage-command`: the nested session's `UserPromptExpansion` would count as typed by the user and pass a gate. The user typing the same command in a terminal is untouched.

Alternatives: leaving it open (a model can pass its own gate with one Bash call, which defeats T1 more easily than any other path); denying every `claude` invocation (breaks legitimate headless use such as evals).

### D-6 Spec guard: edit tools by path, Bash by write target

An edit tool (`Edit`, `Write`, `NotebookEdit`) is denied when `tool_input.file_path` or `tool_input.notebook_path`, made relative to the project root, lies under `.bdk/specs/`. A Bash command is denied when one of its writes (D-7) targets a path containing `.bdk/specs/` or equal to `.bdk/specs`. Reading a spec with `cat` or `grep` passes, which the design's "text references `.bdk/specs`" would have blocked, including the model reading the living spec it is asked to follow. Both apply to every thread; `bdk spec merge` writes through `node:fs` and is not seen by any hook (V1-7).

### D-7 One write detector for the spec guard and the read-only adapters

The writes of a simple command are: its output redirections (`>`, `>>`, `>|`, `&>`, `&>>`, `n>`) except to `/dev/null`, `/dev/stdout`, `/dev/stderr` and fd duplications (`2>&1`, `>&2`); and the targets of a writing command: `tee` (its file arguments), `sed` / `perl` with `-i` or `--in-place` (the file arguments), `cp` and `install` (the last argument), `mv`, `rm`, `rmdir`, `touch`, `mkdir`, `ln`, `truncate`, `chmod`, `chown` (every non-option argument), `dd` (`of=`), and `git apply` (unknown target). A `bdk:reader`, `bdk:reviewer` or `bdk:scout` payload (`agent_type`) with any write is denied with the new rule `guard/reader-write`, naming the command. The same payload's kernel commands and test runs pass, and a test runner's own file output is not a shell write.

Best effort by design: `python -c`, `node -e` and a script file can still write. The adapter's `tools:` list stays the primary control (T2); this guard closes the path T23-D14 opened.

### D-8 Dispatch prompt guard (T23-D0)

An `Agent` call whose `tool_input.subagent_type` is one of the five adapters (`bdk:worker`, `bdk:reader`, `bdk:reviewer`, `bdk:runner`, `bdk:scout`) is denied with the new rule `guard/dispatch-prompt` unless the prompt holds exactly one path matching `(^|/)\.bdk/changes/[^/\s]+/dispatch/[^/\s]+\.md` and, with that path removed, at most one sentence: no blank line, at most one sentence end (`.`, `!` or `?` followed by whitespace or the end), at most 200 characters. Any other `subagent_type` (the v2 agents until T42, other plugins) passes untouched. The reason tells the orchestrator to put the context into the package and send its path.

### D-9 Deny and block messages

Every reason is `<rule>: <what was matched>; <instruction>`, the form `kernel-cli/hooks` requires:

| Rule                            | Reason after the rule id                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `guard/subagent-git`            | `subagents may not run <verb>; return blocked with the cause instead of changing the shared working tree or history (BDK T3)`     |
| `guard/subagent-kernel-command` | `subagents may not run bdk <verb>, an <class> command; return blocked with the cause, the orchestrator runs it (BDK T3)`          |
| `guard/hooks-from-bash`         | `bdk hooks <verb> runs only from the host's hooks; stop and let the user type the stage command (BDK T1)`                         |
| `guard/nested-stage-command`    | `a nested claude session would type <command> as the user; stop and ask the user to type it (BDK T1)`                             |
| `guard/spec-dir-write`          | `<path> is under .bdk/specs/, which only bdk spec merge writes at close; put the change into the Change's spec-delta/ (BDK V1-7)` |
| `guard/reader-write`            | `the <adapter> adapter may not write files (<command>); report through bdk log add or bdk log ingest instead (BDK T23-D20)`       |
| `guard/dispatch-prompt`         | `a BDK dispatch prompt is the package path plus at most one sentence; put the context into the package (BDK T23-D0)`              |
| `policy/gate-not-ready`         | `<gate> is not ready for <command>: <requirement> is <state>[, ...]; finish it, then type <command> again`                        |
| `policy/no-active-change`       | the resolver's text, with `run /bdk:change new "<intent>" or bdk change resume <id>`                                              |
| `input/invalid-argument`        | `the <event> payload has no <field>; no transition was written`                                                                   |

### D-10 Guard-mode output in the registry

A guard block writes `<rule>: <why>` on stderr (before T24 only `why`), so the host shows the rule id to the user and the model. A `Registration` may carry `blockOutput(refusal)`, whose string goes to stdout on a block without `--json`; `pre-tool` uses it for the `hookSpecificOutput` deny object. Under `--json` a block prints the error object as every command does, and a pass prints the decision record, which is what the tests drive.

Alternatives: the handler returning an answer plus an exit code (breaks the one refusal path every mode shares); hard-coding the pre-tool id in the registry.

### D-11 Prompt-expansion resolves its own Change

The index marks `hooks prompt-expansion` Change-scoped, which makes the registry refuse before the handler runs when the branch has no Change. The contract also says a non-BDK command or a non-stage BDK skill passes with empty stdout and no Change. The record therefore becomes `changeScoped: false` and declares `policy/no-active-change` and the three `state/*` rules itself; the handler parses the payload first and resolves the Change only for a stage command, through the same resolver `main.ts` binds.

### D-12 Outcomes of a stage command

The command's stage is the pipeline stage whose `command` equals `/<command_name>` (`/bdk:plan` -> `plan`); its gate is the gate node whose `opens` is that stage. With the graph read once:

1. No stage (`run` excepted): pass, empty stdout.
2. `run`: for every gate that is ready, not done, and whose `policy.gates.<gate>` is `auto`, one `transition` with `source: policy`, `gate`, `to` = the stage it opens; stdout lists them and the manual gates the user still has to type. Nothing else is written.
3. A gate exists and is not skipped:
   - done: pass without writing (S5), stdout notes who passed it and when;
   - ready: one `transition` with `source: user`, `gate`, `to` = the stage, `session` = `session_id`, `command` = `prompt`, `refs` = the gate and its requirements that are not skipped, summary `<command> typed: <gate> passed`; stdout is the gate status;
   - otherwise: block with `policy/gate-not-ready`, naming each requirement that is not done with its state.
4. No gate for the stage, or the gate is skipped in this profile: a plain `transition` (`source: kernel`, `to` = the stage, `session`, `command`, `skip-verify: true` when requested), unless the latest transition to that stage already has the same `skip-verify` value, in which case nothing is written. No `input-hash`, so no node changes state (`kernel-pipeline`, Node states).

`--skip-verify` is read as an exact whitespace-separated token of `command_args` (or `command_input`), and only stored for `execute`; a gated command ignores it.

The user-typed marker (acceptance "a payload without the user marker creates no entry") is the payload shape of HOST-FACTS `upe-fields`: `hook_event_name: UserPromptExpansion`, `expansion_type: slash_command`, a non-empty `session_id` and a `command_name` in the `bdk:` namespace. A payload that names a BDK stage command but lacks one of these is blocked with `input/invalid-argument` and writes nothing: an unknown shape is "no transition" (fail-closed).

Alternatives for the plain transition: writing one on every retype (noise in the ledger and a stage that flips back on a harmless retype); not writing one at all (the stage and `skip-verify` would have no record, which P2 requires).

### D-13 `appendEntry` gains the transition fields, and `source` for its one caller

`EntryDraft` gains `gate`, `session`, `command`, `skipVerify` and a kernel-only `source` (`user` | `policy`). Only `hooks` passes `source`; `log add` builds its drafts from argv and cannot reach the field (it already refuses `transition` and `source` as input). The state schema already holds the fields (T14).

### D-14 Session end: report, never refuse

`hooks session-end` resolves the active Change itself and calls `checkpointChange`. It stays a non-standalone record: outside a git work tree the registry answers `runtime/not-a-repo` as a STOP block with exit 0, which the host ignores for this event, so the Invocation rule keeps its three standalone commands. Every other non-commit outcome is `done: false` with `skipped` naming the reason: `no active Change`, `policy.checkpoint.enabled is false`, `nothing changed`, `rebase in progress` (and merge, cherry-pick), `open tickets`, `git hook failed: <line>`. The T10 record declared `policy/git-in-progress` and `policy/ticket-open` as STOP-block rules; they leave the record, because the host ignores this event's output and exit code (hooks reference, `SessionEnd`), and T22 already decided that implicit checkpoint callers report skips. Content is empty, or one line `[BDK] checkpoint <sha7> of <change>` after a commit.

### D-15 `previousSession` from the ledger

`change takeover` sets `previousSession` to the `session` of the latest `transition` entry that carries one and is not later than the oldest open ticket's `opened` time. The stage command that started the work is the last thing the kernel learnt about the session that opened the tickets. Liveness stays a user confirmation: the host exposes no API to ask whether a session is alive, so the output names the session and the command still requires `--close-tickets`.

Alternative: a `.machine/` session marker written by every hook (a second source of truth that a fresh clone would lack).

## Risks / Trade-offs

- [Prefilter over-match on paths] A project path containing `git` makes every subagent Bash call start Node (~60-100 ms each). Accepted: correctness is unchanged and the budget of the kernel guard still holds; the perf fixture includes such a path.
- [Lexer gaps] Shell constructs the lexer leaves opaque (`$(...)`, process substitution, aliases, functions) can hide a git verb or a write. Accepted under the careless-model threat model; each gap is one lexer case away if a real transcript shows it.
- [`/bdk:run` and late `auto` gates] Only gates ready at typing time pass by policy; a design finished later in the same run waits for a writer T41 decides on. Stated as an open question.
- [Host drift] A host upgrade that renames `command_args` or drops `expansion_type` blocks every stage command with `input/invalid-argument` rather than passing gates silently. Accepted: fail-closed is the design; HOST-FACTS' rerun procedure catches it.

## Open Questions

- For T41: how does `/bdk:run` pass an `auto` gate that becomes ready after it was typed? Recommendation: `bdk next --advance` (orchestrator class) writing the `source: policy` transition when the waiting gate resolves to `auto`, so `prompt-expansion` stays the only writer of `source: user`.
