# Design

## Context

See proposal.md, Why. The relevant state, as found in the code:

- Every kernel call goes through one function, `run` in `kernel/src/shared/registry/run.ts`. It resolves the record, parses the arguments, dispatches, and turns a refusal into its mode's output. It has the record id, the parsed flags, the outcome (`rule` of a refusal) and the exit code. It does not know which agent called it: the kernel is started through `Bash`, and the host passes no agent identity into that process.
- `shared/store/telemetry.ts` appends JSON lines under `.bdk/.machine/telemetry/` with a 256 KiB limit, halving the file when it is reached. Only `log list` uses it.
- Hooks: `SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop` and `Stop` always start Node. `PreToolUse` and `PostToolUse` go through shell prefilters (`hooks/guard/*.sh`) that start Node only for the payloads a guard or the agent registry needs. The prefilters already write a heartbeat file per agent without Node.
- The agent registry (`.bdk/.machine/agents.sqlite`) maps each agent id to its type, parent, package and ticket.
- Host data (HOST-FACTS `subagent-stop`, `end-payload`, `agent-link`): every hook carries `session_id` and `transcript_path`. `SubagentStop` carries `agent_transcript_path`. A foreground `Agent` result carries `usage`, `totalTokens` and `resolvedModel`. No hook payload carries a USD cost. `SubagentStop` does not fire on `maxTurns` or `TaskStop`.
- Transcripts, checked on this machine with Claude Code 2.1.29x: `~/.claude/projects/<slug>/<session>.jsonl` for the main thread, `<session>/subagents/agent-<id>.jsonl` per subagent, `<session>/tool-results/` for large tool outputs. Each line has `type` (`user`, `assistant`, `attachment`, `system`, and bookkeeping types such as `cost-state`), `timestamp`, `agentId`, and for assistant lines `message.content` (`text`, `thinking`, `tool_use`), `message.usage`, `requestId` and `attributionSkill`. Several lines of one API response share a `requestId` and repeat its `usage`. The main transcript's `cost-state` line holds the session's `totalCostUSD` and `modelUsage.<model>.costUSD` (HOST-FACTS `transcript-layout`, Claude Code 2.1.289).
- The eval `stages` suite counts refusals with a regex over Bash tool results (`evals/suites/stages/refusals.ts`). The regex misses the `guard`, `state` and `kernel` classes.

## Goals / Non-Goals

**Goals:**

- One record per session, deterministic and cheap, from which the refusal table of #109 can be computed without reading a transcript.
- A verbose mode that shows the maintainer everything an agent saw and did, readable as plain text.
- An analyzer that cites its evidence and never reads a whole transcript into its context.

**Non-Goals:**

- Aggregating trends across many sessions. One report covers one session.
- USD cost per agent, task or stage. The host reports USD per session only (D7), so the report gives tokens per agent and USD per session.
- Live alerts during a run.

## Decisions

### D1. Four layers; analysis only by hand (revises issue scope point 3)

The user decided this on 2026-10-05, in a review of `.lavish/v3-t47-verbose-log.html`.

- **Layers:** journal (always on), verbose log (opt-in), deterministic report (always available), and the `/bdk:diagnose` skill.
- **No automatic analysis:** the skill runs only when the user invokes it. `diagnostics.analyze` and the `diagnostician` role are dropped.

Alternatives considered:

- _The issue's `diagnostics.analyze: off | on-anomaly | always`, with the default `on-anomaly`._ It lost because the user wants to start every analysis consciously while the pipeline is being validated. An automatic model call can come later as one stage-skill line that calls the same skill.
- _A role agent spawned by the stage skills._ It lost for two reasons. It needs a step in every stage skill. It also needs an eleventh role in `role-contracts`. A tools skill reaches the same agent through `context: fork`.

### D2. The journal lives in `shared/`, written by `registry.run` and by the hooks

`run` appends one `command` line after every dispatch, through a new `shared/store/journal.ts` built on `appendTelemetry`.

- **Line content:** `v`, `at`, `kind`, `change`, `command` (record id), `args` (the argv after the verb, each value cut to 200 characters), `exit`, `rule`, `ticket` (the `--ticket` flag or the ticket positional), and `ms`.
- **Hook lines:** `session` (id and main transcript path), `agent-start` (id, type, parent, ticket), `agent-stop` (id, transcript path, end signal), `question` (agent, question count), and `guard` (a block by `hooks pre-tool`, with `agent_id`, `rule` and the command words).
- **Agent identity:** the kernel does not attribute a `command` line to an agent itself. The report joins it to the registry: ticket to the agent holding that ticket. It also joins it to the transcripts: the `tool_use` whose Bash command and timestamp match the line. Lines of host hooks are attributed to `host`. Lines with no ticket and no transcript match are attributed to `unknown`.
- **Session of a command line:** the kernel line carries no session id, because nothing shows that the host passes one into a `Bash` process. The report assigns the line to the session whose transcripts hold the matching `tool_use`. Without a match, it uses the time window between that session's `session` line and the next one.
- **Size:** the journal limit is 1 MiB. One execute probe of T41 issued about 300 kernel calls, about 250 bytes each, so one stage fits several times. The halving drops whole oldest lines. The report states `truncated: true` when the session's first line is gone.
- **Concurrency:** parallel agents append at the same time. `store.append` uses `O_APPEND` with one write per line, which keeps lines whole for lines under 4 KiB. The halving rewrite runs under the existing `.bdk/.machine` lock (`shared/store/lock.ts`). A failed journal write never fails the command: the error is dropped.
- **Worktrees:** the journal of a part worktree goes to the home checkout's `.bdk/.machine`, the same root the agent registry uses.

Alternatives considered:

- _Each handler writes its own line._ It lost because about 70 handlers would each need the change, and a new command would silently miss it.
- _An agent id passed through an environment variable or `updatedInput` from `PreToolUse`._ It lost because rewriting the agent's command is invasive, and HOST-FACTS has no row showing the host keeps such a variable. The join gives the same answer for every ticketed command, which covers every role and lead call.
- _Only the hooks journal kernel calls (`PreToolUse` on Bash)._ It lost because the hook sees no exit code and no `rule`, and `PostToolUse` does not fire for every failed call (D4).

### D3. Transcripts are read, never copied

The journal stores transcript paths. The report, the render and the slice read the transcripts at the time of the call through one reader, `diagnostics/transcript.ts`.

- **Reader output:** the reader turns each line into a typed event (`text`, `tool-use`, `tool-result`, `skill`, `attachment`, `usage`). It skips any line it does not know and counts the skipped lines. Usage is summed once per `requestId`.
- **Format change:** the reader is pinned by a contract test on a recorded and redacted transcript under `tests/fixtures/host-transcripts/<version>/`. When a host update changes the format, the report shows `transcript: unreadable` with the count of unknown lines. The journal-based metrics still work.
- **Missing or deleted transcript:** the user can clear `~/.claude`. The transcript-based fields are then `null` with `transcript: missing`.

Alternatives considered:

- _The hooks copy every event into `.bdk/.machine` while the run is in progress._ It lost because the hooks see neither the model's text nor the content the `Skill` tool loads. It would also double the disk use, and it needs Node on every tool call even with verbose off.

### D4. Verbose: live lines from the hooks, a full render from the transcripts

- **Marker:** `diagnostics.verbose` is resolved by `hooks session-start`, which already starts Node. When the key is true, the hook writes `.bdk/.machine/verbose`; when it is false, the hook removes the file. The shell prefilter only tests for the file, so a session without verbose pays nothing more.
- **Live lines:** with the marker present, `post-tool.sh` passes every `PostToolUse` payload to `bdk hooks post-tool`. A new `PostToolUseFailure` entry in `hooks.json` does the same for a failed call; Claude Code documents this event, and a HOST-FACTS probe records its payload. Each passed payload appends one line to `.bdk/.machine/logs/<session>.live.log`: the time, the agent id and type, the tool, the input cut to one line, the exit code or error, and the first 3 lines of the output.
- **Render:** `hooks session-end` runs `bdk diagnostics log` for the session when the marker is present. The user can also run it at any time. The render orders the events of all transcripts of the session by time and indents them by agent depth. It shows the full text of skills and role contracts collapsed to their first 20 lines (`--full` prints them whole), all kernel stdout, other tool results cut to 20 lines, the model's text, and tokens per agent and per turn. Detector annotations go right after the event that triggered them. Thinking is left out.
- **Cost:** Node on every tool call costs about 50 to 100 ms per call, and only while verbose is on. `pnpm test:perf` gets a budget for `hooks post-tool` with the marker present.
- **Change:** the setting takes effect at the next session start. `bdk config set` says so in its text output.

Alternatives considered:

- _An environment variable `BDK_VERBOSE`._ It lost because the hooks and the kernel already resolve settings, and `--local` already gives a per-user switch. An environment variable would be a second switch with its own precedence rules.
- _Rendering at every `Stop`._ It lost because it repeats the work on each turn of a long session. The live log already covers following the run.

### D5. Detectors D1 to D8, deterministic, thresholds in settings

All detectors run in `diagnostics/detectors.ts` over the journal and the transcript events of one session. Each finding carries `detector`, `agent`, `ticket`, `at`, a `cite` (a journal line number, a ledger id, or a transcript `<agent>:<line>`) and a one-line `summary`. Findings never quote tool output.

| Id  | Finds                                                                                                                                                                                                        | Threshold key (default)          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| D1  | The same Bash command run again by one agent with no `Edit`, `Write` or `NotebookEdit` call of that agent in between; a command that calls the kernel is left to D2 and D3, as `agents wait` polls by design | none                             |
| D2  | A refused kernel command repeated with the same arguments by the same agent                                                                                                                                  | none                             |
| D3  | One refusal `rule` seen at least N times in the session                                                                                                                                                      | `diagnostics.repeat-refusal` (3) |
| D4  | A test command equal to a whole-suite `tools.test` entry run by an agent that holds a task package                                                                                                           | none                             |
| D5  | One file read at least N times by one agent with no write to it in between                                                                                                                                   | `diagnostics.repeat-read` (3)    |
| D6  | A second ticket on one target (redispatch, narrow or escalate) or a park, with the reason from the ledger                                                                                                    | none                             |
| D7  | The same skill or role contract loaded twice in one agent (`attributionSkill`, or a `Skill` tool use)                                                                                                        | none                             |
| D8  | A task whose tokens or wall time exceed k times the session median, with at least 3 tasks; a kernel command slower than its perf-test budget (`next` and the hooks 150 ms, `hooks session-start` 1 s)        | `diagnostics.outlier-factor` (3) |

Projects can tune the thresholds. A project with a slow test runner tunes D8, and a project with a large generated file tunes D5. Making the thresholds code constants would force a BDK release for each such tune.

### D6. Command group `bdk diagnostics`, a leaf slice

- **Commands:** `report` (read), `log` (agent class: it writes under `.bdk/.machine/logs/`, and the command index allows no write for a read command), `slice` (read), and `write` (agent class, so the forked analyzer may call it).
- **Slice position:** the slice imports only `shared/`. `hooks` imports it for the session-end render.
- **Session selection:** with no `--session`, the report and the render use the session of the latest `session` journal line of the active Change. With no active Change, they use the latest session in the journal.

Alternatives considered:

- _A `bdk change status --diagnostics` flag._ It lost because a session is not a Change. One Change spans several sessions, and `/bdk:diagnose` must also work on a session with no Change. The status output would also grow with a section unrelated to state.
- _A `run` group._ It lost because `/bdk:run` is a stage skill, and a `bdk run` group would read as its kernel side.

### D7. Hosts and tokens

Claude Code is the only host of 3.0. Tokens come from the transcripts (D3), summed per agent, per task (the agents holding the task's tickets) and per part. Each sum is split by model into `input`, `output`, `cacheRead` and `cacheWrite`. An agent that ended without `SubagentStop`, or whose transcript is missing, has `tokens: null` and is counted under `tokensUnknownAgents`. USD comes from the main transcript's last `cost-state` line: `cost` holds `totalUSD` and `byModel`, for the whole session, also when `--stage` narrows the other metrics. Without that line (an older host, or a session still running) `cost` is `null`. The format is not documented, so a `cost-state` line of an unknown shape also gives `null` and counts as an unknown line.

On a host with no transcript path in its hooks, the report has `transcript: unavailable`, and only the journal metrics are filled.

### D8. The analyzer skill

`skills/tools/diagnose/SKILL.md` has this frontmatter:

- `context: fork`
- `agent: bdk:reader`
- `disable-model-invocation: true` (by hand only, like `doctor`)
- `allowed-tools` limited to the kernel pair, `Read` and `Grep`

The `reader` adapter has no write tool. The analyzer writes only through `bdk diagnostics write` and `bdk log add learning`.

The analyzer follows these steps:

1. Read `bdk diagnostics report --json`.
2. For each finding and each refusal group, open `bdk diagnostics slice` around its citation (at most 200 lines).
3. Read the ledger entries the finding names.
4. Classify where the fix belongs: stage skill, role contract, package or template, kernel, plan, or project.
5. Write the analysis.

**Report body:** the sections are `## Summary`, `## What went well`, `## What went wrong`, `## Where the fix belongs`, and `## For a BDK issue`. Every claim cites a journal line, a ledger id or a transcript slice.

**Inside the BDK repository:** the analyzer detects the BDK repository by `.claude-plugin/plugin.json` with `"name": "bdk"`. There, `## Where the fix belongs` also holds concrete text changes: the file, the current sentence and the proposed sentence.

Alternatives considered:

- _Running in the main context._ It lost because transcripts are large, and the analysis would fill the session the user works in.

### D9. No project code in the issue section

`bdk diagnostics write` reads the Markdown on stdin and runs three deterministic checks on the `## For a BDK issue` section only:

1. There is no fenced code block.
2. Every code span is one of: a `bdk` command, a rule id, a ticket or entry id, a role or adapter name, a settings key, a skill name, or a path under `.bdk/` or the plugin.
3. No line of 20 or more characters equals a line of a file tracked by git, after trimming. The check runs `git grep -F -x` over the candidate lines.

A failed check refuses with `policy/project-code`. The `why` names the line and the check, so the analyzer can rewrite the line. The rest of the file is local and unchecked.

Alternatives considered:

- _Checking the whole file._ It lost because the user wants project detail in the local report.
- _Using a model to judge._ It lost because a model judge is not deterministic and cannot be tested in CI.

### D10. The eval harness uses the report

After each run, `evals/suites/stages/hooks.ts` runs `bdk diagnostics report --session <id> --json` in the fixture working directory.

- **Metrics:** `refusals` and `refusal:<rule>` come from that report.
- **Cross-check:** the transcript regex count is kept as `refusals-transcript`, and the probe report shows any difference.

This is how the acceptance signal "reproduces the refusal counts of #109's table" is checked on a new probe. The 2026-10-02 runs predate the journal and cannot be replayed.

## As run (probes of 2026-10-05)

`pnpm eval stages --skill execute --case flat,tree,worktree --probe` with `diagnostics.verbose: true` (series `probe-execute-2026-10-05-165912`, BDK `6af5df18`): all three runs met every expectation, 4.93 USD in all.

| Run      | `refusals` (journal) | `refusals-transcript` | Difference                                                                        |
| -------- | -------------------- | --------------------- | --------------------------------------------------------------------------------- |
| flat     | 0                    | 0                     | none                                                                              |
| tree     | 2                    | 2                     | none                                                                              |
| worktree | 6                    | 7                     | one `guard/agent-message` block, which the report counts under `guardBlocks` only |

In the `worktree` fixture the journal held 36.7 KiB, `.bdk/.machine/logs/` the live log (184.5 KiB) and the render (291.4 KiB), and `git status` was clean. The report's `cost` (1.77 USD) equalled the row's cost. `/bdk:diagnose 784cb229-...` (0.67 USD, 2.5 minutes) wrote the analysis through `bdk diagnostics write` on the first try. It named the top refusal, `policy/entries-missing` (2), with its cause and the citation `ad2e0042b1afb6a90:120`, and found three defects:

- Three refusals counted under `unknown`: agents call the kernel as `B=.../bdk.mjs; node $B ...`, and one Bash use that called the kernel twice was taken by its later line. Fixed in `39ce70b5`: `shellCommands` expands a variable the same Bash command assigned, and each kernel call of a use serves its own line. The rerun report attributes all six.
- All seven D1 findings were `agents wait` polls and one `attempt close` retry. The analysis blamed a cut command prefix; the commands were in fact identical. Fixed in `39ce70b5`: D1 leaves a Bash command that calls the kernel to D2 and D3.
- The `guard/agent-message` reason read as the opposite of its rule. Reworded in `39ce70b5`.

A fourth finding is outside this change: `bdk log ingest` takes the role from the ticket's last built package, so a lead that builds the runner package before the simplifier ingests stores the simplifier's report as the runner's.

`pnpm eval stages --skill execute --case not-ready --probe` without `diagnostics.verbose` (series `probe-execute-2026-10-05-173411`, 0.18 USD): no `.bdk/.machine/verbose`, no `logs/`, no `diagnostics/`, and the journal held its `session` line. The case first failed in `prepare` with `policy/tools-unset` (T49); `63ef6b42` sets its tools.

## Risks / Trade-offs

- [The transcript format is internal to the host and can change.] → A contract test on a recorded transcript per host version, unknown-line counts in the report, and journal metrics that do not depend on transcripts.
- [The transcripts may be gone (`~/.claude` cleared, another machine).] → `transcript: missing`. The journal alone still gives refusals, retries and times.
- [Verbose adds 50 to 100 ms to every tool call.] → It is opt-in and marked in the log header. A perf budget pins it.
- [Joining a kernel line to an agent can fail for ticketless calls made by parallel agents in the same second.] → Such a line is attributed to `unknown` and counted, never guessed.
- [The live log and the analysis may hold project code and secrets printed by tools.] → Both stay under `.bdk/.machine/`, which git ignores. Only the issue section is checked. The skill tells the user to read the issue section before pasting it.
- [Disk use of verbose logs.] → Each log is capped at 20 MiB (the oldest half is dropped, as for telemetry), and only the newest 20 log files are kept.

## Migration Plan

Nothing to migrate. The journal starts with the first command after the upgrade. A project that never sets `diagnostics.verbose` gets only the journal file.

**Rollback:** removing the release removes the writers. The files under `.bdk/.machine/` are inert.

## Open Questions

- The exact payload fields of `PostToolUseFailure` on the current Claude Code. The HOST-FACTS probe in tasks.md records them. Only the live line's error field depends on the answer.
