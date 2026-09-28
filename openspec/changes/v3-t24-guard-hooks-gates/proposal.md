# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T24. Tracks #56.

T1 (a gate passes only on a command the user typed) and T3 (subagents never rewrite the shared working tree or its history) are still prose: `hooks pre-tool`, `hooks prompt-expansion` and `hooks session-end` answer `kernel/not-implemented`, `hooks/hooks.json` registers only `SessionStart`, and nothing writes the `source: user` transition that the T21 gate rule waits for. Every stage skill of T41 and every swarm of T23 relies on these guards, and T23 added two more (a minimal `Agent` prompt, no file writes from read-only adapters), so this task comes before T41.

## What Changes

- **`hooks/hooks.json` v3**: `PreToolUse` with the matcher `^(Bash|Edit|Write|NotebookEdit|Agent)$` running `hooks/guard/pre-tool.sh`, a POSIX shell prefilter that starts Node only when the payload can be affected; `UserPromptExpansion` with the matcher `^bdk:(plan|execute|close|run)$` running `hooks/guard/prompt-expansion.sh`; `SessionEnd` running `hooks session-end` in the content wrapper. Both guard scripts check for Node and the bundle first (`guard/kernel-unavailable`), end their kernel line in `|| exit 2`, and the `hooks.json` lines add `|| exit 2` again, so a missing script also blocks.
- **`hooks pre-tool`**: one shell lexer (quotes, escapes, heredocs, comments, `;`, `&&`, `||`, `|`, subshells, `sh -c` / `bash -c` / `eval` recursion) turns a Bash command into simple commands, so words inside a quoted argument or a heredoc body never count. On top of it:
  - spec guard (V1-7): an edit tool whose `file_path` or `notebook_path` is under `.bdk/specs/`, or a Bash write (redirection, `tee`, `sed -i`, `cp`/`mv`/`rm`/`touch`/`mkdir`/`ln`/`truncate`/`dd of=`/`install`/`perl -i` and the like) whose target is under `.bdk/specs/`, from any thread: `guard/spec-dir-write`;
  - git guard for subagents (T3): the thirteen verbs of the plan with `git -C`, `-c` and `--git-dir` options skipped: `guard/subagent-git`;
  - kernel command guard: a subagent's `bdk.mjs <verb>` whose availability class is `orchestrator` or `hook`, by exact verb from the command index: `guard/subagent-kernel-command`; `bdk.mjs hooks ...` from any thread: `guard/hooks-from-bash`;
  - nested stage command (HOST-FACTS `upe-headless`): `claude ... /bdk:plan|execute|close|run` from any thread: new `guard/nested-stage-command`;
  - dispatch prompt (T23-D0, risk R9): an `Agent` call to a BDK adapter (`bdk:worker|reader|reviewer|runner|scout`) whose prompt is not one dispatch package path plus at most one sentence: new `guard/dispatch-prompt`;
  - read-only adapters (T23-D14, D20): a Bash file write from `bdk:reader`, `bdk:reviewer` or `bdk:scout`: new `guard/reader-write`.
  - A deny prints the host's `permissionDecision: deny` object on stdout, `<rule>: <reason>` on stderr, exits 2. A pass is silence. Main-thread git is never touched.
- **`hooks prompt-expansion`** (T1, P2, S5, S8, R-9): parses the payload, resolves the Change from the branch, reads the graph and writes at most one kind of entry: a `transition` with `source: user` (gate, kernel clock, `session`, `command`, `refs` = the gate and the artifacts it gates) when the gate the stage command opens is ready; nothing when it is done already; a plain stage transition when the profile has no such gate (`/bdk:execute`, carrying `skip-verify` from `command_args`); `source: policy` transitions for every ready `auto` gate on `/bdk:run`. It blocks with `policy/gate-not-ready` naming what is missing, with `policy/no-active-change` and the hint, and with `input/invalid-argument` for a payload whose shape it does not know (no transition, fail-closed). On pass, stdout is the gate status as plain text, which the host adds to the skill's context.
- **`hooks session-end`**: runs the `shared/store` checkpoint of the active Change and reports a skip (open tickets, rebase in progress, policy off, nothing changed, no active Change) as data, never as a STOP block; the host ignores this event's output and exit code.
- **`change takeover`** reports `previousSession`: the `session` of the latest transition written by `prompt-expansion` before the oldest open ticket was opened (T22 hand-off).
- **Guard-mode output** (registry): a block writes `<rule>: <why>` on stderr, so every reason starts with its rule id; a guard registration may also render the host's decision object on stdout.
- **Contract amendments** (spec deltas plus `schema/` in the same PR): `hooks prompt-expansion` is no longer resolved as Change-scoped by the registry (a non-stage or non-BDK command passes without a Change) and declares the Change rules itself; `hooks session-end` drops `policy/git-in-progress` and `policy/ticket-open` (reported as `skipped`); three new rules `guard/nested-stage-command`, `guard/dispatch-prompt`, `guard/reader-write`; the design's `MultiEdit` leaves the matcher (HOST-FACTS `input-multiedit`).
- **Latency**: `hooks/guard/pre-tool.perf.ts` and `prompt-expansion.perf.ts` in the `perf` project measure p95 of the prefilter (< 5 ms), `pre-tool` through the bundle (< 150 ms) and `prompt-expansion` (< 150 ms) on a 750-call fixture; local only.

Resolutions of the plan's "To resolve in the spec" (details and rejected alternatives in design.md):

- **Exact git guard regex**: no regex over the command text. The shell lexer yields simple commands; a git command is one whose command word is `git` after assignments and wrappers (`env`, `command`, `exec`, `time`, `nice`, `nohup`, `sudo`), and its verb is the first word after git's global options. `git commit -m "git reset"` is a `commit`; `echo "git reset"` is no git command at all.
- **`ask` in the main thread**: stays a ready extension, unused. The kernel answers only `deny` or silence, so the host's own permission rules stay in force (`kernel-cli/hooks`, Hook payloads).
- **Text of the block and deny messages**: `<rule>: <what was matched>; <instruction>`, with the instruction always "return blocked with the cause" for a subagent and the command to type for the user (table in design.md D-9).
- **`--skip-verify` in `command_args`**: `command_args` split on whitespace, an exact token `--skip-verify`; `command_input`, the name the hooks reference shows, is read when `command_args` is absent.

Inputs carried by citation: design "Hooks (V1-1, V1-2)", "Key boundaries" (human gate provenance, working tree guard, prefilter and failure mode of the guards, spec V1-7), NFR "Latency" and "Security", risks "Host hook semantics", "Guard latency and false positives", "Gate binds to time, not content"; decisions T1, T3, P2, P9, S5, S8, R-9, Q-6; HOST-FACTS `upe-fires`, `upe-name`, `upe-fields`, `upe-headless`, `bang-pretool`, `agent-fg`, `agent-bg`, `main-no-agent-id`, `agent-tool-name`, `input-bash`, `input-notebookedit`, `input-multiedit`, `end-*`, `skill-dmi`; T21 "Fixed by T21" (gate rule, `waiting: gate`); T22 "Fixed by T22" (`checkpointChange`, session ids, the deny list); T23-D0, D14, D20.

Out of scope:

- The stage skills and their frontmatter (`disable-model-invocation: true`, `disallowed-tools`): introduced in T41 and already required by `skill-content-checks` (T15), which this Change only cites.
- How `/bdk:run` passes an `auto` gate that becomes ready after the command was typed: `prompt-expansion` passes the gates ready at typing time; a kernel writer for later `auto` gates is T41's decision (open question in design.md).
- `hooks session-start` reading `source`, and recording `session-start.json` / `skill-exists.json` payloads: no behaviour depends on them yet.
- A Stop hook (T02 decision Q-6: `check-rules-drift` is not ported); deleting the v2 Python hook directories (T32).
- The user's own `!` bash-mode commands, which bypass `PreToolUse` (HOST-FACTS `bang-pretool`): a known gap, stated in the spec.

## Capabilities

### New Capabilities

None. Every behaviour lands in an existing capability.

### Modified Capabilities

- `kernel-cli`: guard-mode stderr carries the rule id; the rule catalogue gains `guard/nested-stage-command`, `guard/dispatch-prompt`, `guard/reader-write`, loses the `hooks session-end` emitters of `policy/git-in-progress` and `policy/ticket-open`, and gains `hooks prompt-expansion` as an emitter of `input/invalid-argument`; the availability classes name the new guards.
- `kernel-cli/hooks`: `session-end`, `prompt-expansion` and `pre-tool` with their T24 behaviour, the shell prefilter, the `hooks.json` entries, the lexer rules and one scenario per acceptance item.
- `kernel-cli/change`: `change takeover` fills `previousSession`.

## Impact

- New code: `kernel/src/hooks/` gains `domain/shell.ts` (lexer), `domain/guards.ts` (the pre-tool decisions), `domain/payload.ts` (payload parsing), `use-cases/pre-tool.ts`, `use-cases/prompt-expansion.ts`, `use-cases/session-end.ts`, their commands, renders, zod schemas and tests; `hooks/guard/pre-tool.sh`, `hooks/guard/prompt-expansion.sh`.
- Changed code: `shared/registry` (guard block output), `log` (`appendEntry` accepts the transition fields and `source` for kernel-only callers), `graph/index.ts` (exports what `prompt-expansion` reads), `change` (`takeover`), `main.ts` / `registrations.ts` (hooks deps gain the command index and the Change resolver), `kernel/scripts/export-schemas.ts`.
- Contract: `schema/cli/commands.json` (the three hooks records), `schema/cli/output/hooks-{pre-tool,prompt-expansion,session-end}.json` generated from zod, the rule list in `shared/refusal`.
- Docs: `docs/guide/` pages for the guards and gates; `docs/V3-IMPLEMENTATION-PLAN.md` points T24's open items to this Change and hands the late `auto` gate to T41.
- Bundle `dist/bdk.mjs` rebuilt. No new runtime dependency.
