## Context

Issue #322 asks for an after-the-fact analysis of a BDK run. Inputs, per the architecture design ("Run state, run artifacts and resume": "turns and time come from transcripts"):

- Claude Code's transcripts under `~/.claude/projects/<project>/`: `<session>.jsonl` for the main thread, `<session>/subagents/agent-<id>.jsonl` and `agent-<id>.meta.json` (`agentType`, `description`, `toolUseId` of the `Agent` call) per subagent, a `cost-state` line in the main transcript when the session ends.
- The run files under `.bdk/runs/<change>/` that every stage writes (`state.json`, verifier reports, part and conform reports, review rounds, `run.json`).

The draft line (`draft/v3-1`, #110) built diagnostics on a kernel journal written by every kernel command and hook, an opt-in hook on every tool call (+50 to 100 ms per call), `bdk diagnostics report|log|slice` and `/bdk:diagnose`. Its detectors D2, D3 and D6 read the kernel journal and ledger, which v3 does not have. Its defect #157: the transcript of the live session was reported `missing`, and with it the whole session lost its tokens and cost.

## Goals / Non-Goals

**Goals:**

- `/bdk:diagnose-run` writes a cited report of a Change's run: stage timeline, per-agent wall time, turns, tokens and cost share, retries and blockers, waste with suggestions.
- Every number comes from a deterministic parse; every claim cites a transcript or run file line that resolves.
- A missing transcript costs only its own agent's numbers (#157).
- Nothing runs during a BDK run to make diagnostics possible.

**Non-Goals:**

- A live log or a render of the whole session (the draft's verbose log).
- Settings for detector thresholds (D8).
- Diagnosing sessions that ran no BDK skill; the command works on them, but the report sections are built around BDK stages.

## Decisions

### D1 - A block skill `/bdk:diagnose-run` on a new agent `bdk:analyst`

The skill follows the pattern of the verifier blocks (`spec-conformance`, `verify-plan`): when it runs anywhere but on its agent, it starts `bdk:analyst` with the same arguments and relays the summary. Transcripts are megabytes; reading them in the user's main thread would fill it.

- Name: `/bdk:diagnose-run`, not the draft's `/bdk:diagnose`. v3 already has `/bdk:debug` and the block `diagnose-bug`; a bare "diagnose" would compete with them for "diagnose this error". The draft name is not in use anywhere on this line, so nothing migrates.
- Agent: a new `bdk:analyst` (default `sonnet`, read-only tools plus `Write` for its one report), a `models` role like every agent (spec `bdk-cli/config`). Rejected: `bdk:explorer` (haiku, its job is mapping code for a Change; weighing waste needs more judgement) and `bdk:verifier` (opus, its job is a PASS/FAIL check of an artifact; its report format does not fit).

### D2 - The CLI counts, the agent reads and judges

| Work | Where | Why |
|---|---|---|
| Find the transcripts and the sessions of a Change | `bdk diagnostics report` | path encoding, many files |
| Parse JSONL, dedupe requests, sum tokens per agent and model, wall times, stage intervals, cost share | `bdk diagnostics report` | arithmetic over thousands of lines |
| Detectors with citations | `bdk diagnostics report` | exact repeats and line numbers |
| Read run files (verifier verdicts, part attempts, review blockers) | agent | small markdown, meaning not numbers |
| Weigh findings, say where the fix belongs, write the report | agent | judgement |

The CLI was added only after the measurement below (CLAUDE.md, "Building skills (v3)"; `.claude/rules/bdk-cli.md`): the plain skill (no CLI; `Read`, `Grep`, `Glob`) ran on the recorded fixture first.

Recorded problem: see "Measurement" below.

Rejected: the agent counts with ad-hoc scripts (`jq`, `python`). It needs a shell that writes and runs code in the user's project, and each run writes a different, unchecked counter.

### D3 - Cost from the host, shared by weighted tokens; no price table

The host writes the session's cost in `cost-state` (`totalCostUSD`, `modelUsage.<model>.costUSD`) when the session ends. It writes no cost per agent. Measured on 241 per-model totals of local sessions: dividing the host's cost per model by a token sum from the transcripts gives rates that vary by an order of magnitude between sessions, because `cost-state` also counts calls that leave no transcript line (title generation, classifiers, resumed parts). A price table in BDK would be wrong in the same way and would go stale with every model.

So: the session cost is the host's. Each agent's share of a model's host cost is its share of that model's weighted tokens, weights `input 1`, `output 5`, `cache read 0.1`, `cache write 5 min 1.25`, `cache write 1 h 2`: the ratios of Anthropic's list prices, which hold across models and leave the dollar amount to the host. Without a `cost-state` line (a live or crashed session) the cost is reported unknown and the tokens still are. Rejected: a price table (stale, and still off by the uncounted calls), no per-agent cost (the issue asks for it).

### D4 - No always-on recording

The draft's journal recorded kernel command lines and refusals; v3 has no kernel, and every `bdk` call, its arguments and its exit code are already in the transcript as a Bash tool call and result. The verbose hook cost 50 to 100 ms per tool call on every run to buy a live log nobody needed after the fact. What the transcripts lack (a session's cost before it ends) is reported as unknown rather than recorded. No hook, journal or setting is added; this answers "whether any always-on recording is worth its cost": not now.

### D5 - Where transcripts and sessions are found

- Transcripts directory: `--transcripts <dir>`; else `$CLAUDE_CONFIG_DIR/projects/<key>` (default `~/.claude`), where `<key>` is the absolute project root with every character other than an ASCII letter or digit replaced by `-` (the host's naming, checked on this machine for paths with `/`, `.` and `_`).
- Sessions of a Change: every main transcript in that directory whose text names `.bdk/runs/<change>/` or `openspec/changes/<change>`. A `--session <id>` argument (repeatable) selects sessions directly. Without a journal there is no other link from a Change to a session, and every BDK stage names its run directory in its first steps.

### D6 - Detectors

Kept from the draft (re-implemented on transcripts only): D1 `repeat-bash` (same command again with no edit between), D5 `repeat-read` (same file, offset and limit read 3 times or more with no write to it between), D7 `repeat-skill` (one skill loaded twice by one agent), D8 `outlier` (an agent's wall time 3 times the median of its type or more, with at least 3 agents of the type). New: `refused` (a tool call the permission system or a hook refused), `retry-after-error` (a call repeated with the same input after it failed), `timeout` (a result saying the call timed out), `slow-call` (a tool call other than `Agent` that held its agent 2 minutes or more: B1's hung commands, and the 9-minute polling loop of the review lead in the fixture run, see "Measurement"), `missing-transcript` (an `Agent` call without a readable transcript). Dropped: D2 and D3 (kernel refusals, no kernel), D6 (redispatch and escalation: `state.json` attempts, read by the agent), D4 (whole-suite test runs: in v3 checks run through `bdk check run` with configured scopes; the agent judges a full run from the command it cites).

### D7 - The report lives with the run files

`.bdk/runs/<change>/diagnostics.md`, outside git like every run file; a later run of the skill replaces it. Not `diagnostics/report.md`: Claude Code refuses a subagent's `Write` to a file named `report*.md` ("Subagents should return findings as text, not write report files", spec `bdk-plugin`), which the first eval run of the plain skill hit. A run given only a session id that names no Change writes `.bdk/runs/diagnostics/<session-id>.md`. Citations are `<path>:<line>`: transcript paths relative to the transcripts directory, run files relative to the project root.

### D8 - Thresholds are constants

The detectors' thresholds (3 reads, factor 3, 3 agents of a type) are constants in the slice's domain, as the draft's defaults were. No measurement asked for a setting; a follow-up adds one when a team needs another value.

### D9 - Partial transcripts per agent (#157)

An agent whose transcript file is missing or empty is listed with what its parent's `Agent` call says (type, description, start) and marked missing; its tokens are unknown, and all other agents of the session are counted. The host cost still includes the missing agent, so its share lands on the agents counted; the report warns about that rather than guess the missing tokens. Lines that are not JSON or not of a known shape are counted per file and reported, never guessed at. A main transcript without `cost-state` makes the cost unknown, not the session missing.

## Measurement

Fixture: one `/bdk:debug` run of the tally crash (the `debug-fix` eval scaffold, both gates `auto`, `execution.lead: foreground`), recorded with Claude Code (version in `plugins/bdk/evals/README.md`) and copied into `plugins/bdk/evals/fixtures/diagnose-run/`; see the README entry for how it was recorded and trimmed.

Ground truth, counted independently of the CLI by a script over the trimmed transcripts: session `6628cb23`, 12:46:13 - 13:00:14 (14m00s), host cost $1.7767 (`cost-state`); stages `bdk:diagnose-bug`, `bdk:commit`, `bdk:execute`, `bdk:auto-review` (10m45s), `bdk:triage`; 9 subagents (2 `bdk:lead`, `bdk:implementer`, `bdk:conformer`, 2 `bdk:reviewer`, `bdk:e2e-tester`, `bdk:integration-reviewer` on opus, `bdk:judge`), 94 requests in all; the review lead `a4aa7d0eb43a6a939` held 9.3 minutes in one Bash polling loop (its transcript, lines 47 and 49), which is #326.

**Plain skill (no CLI), `diagnose-run-fixture`, 1 run, Claude Code 2.1.292 (the eval pin), sonnet analyst:** score 0.22, 132 s, $0.57. The analyst found the review lead's 9-minute wait and its cause, and the stage wall times, by grepping timestamps file by file (about 30 Grep calls). It gave no tokens or cost for any stage or agent ("didn't total tokens per agent or per stage"), no agent table, scanned only `Skill`, `Read` and `Bash` calls for waste, and missed the three repeated Bash commands. Its `Write` of `diagnostics/report.md` was refused by the host (see D7). A first run with both cases scored 0.22 on each for the same reasons.

Problem recorded: a model with read tools cannot total usage over some 90 requests in 10 files, or scan every tool call for the detector patterns, within one agent's turn; it reports what it can grep. That is the problem `bdk diagnostics report` solves (D2): it counts, the analyst reads the run files and judges the findings.

**Skill on `bdk diagnostics report`, both cases, 3 runs each, same pin and model:** every run scored 1.00 (9 of 9 graders on the fixture, 9 of 9 on the missing transcript); 46 to 65 s and $0.25 to $0.51 per run ($1.98 for the six). Every report has the full timeline and agent table with the command's numbers, the review lead's 9.3-minute poll as the largest waste with its fix in `/bdk:review-round` (#326), and, in the missing-transcript case, the judge listed as missing with the warning about its cost share. Two runs on the way there changed the skill: one analyst put the `bdk` call behind `cd ...;` and `ls`, which the grant refused, and wrote a finding whose lines it had not read (the skill now says to run `bdk` alone and to write no unread finding); in one run the main conversation dropped the transcripts directory the user had named from the arguments, and the command, denied the host's directory by the sandbox, failed as an internal error (the skill now carries a directory the user named into the agent's prompt, and the command fails with `env/transcripts-unreadable`, exit 3).

## Risks / Trade-offs

- [The transcript format is not documented and changes] -> the parser counts unknown lines and reports them; the fixture test pins the shapes it knows.
- [Cost share is an estimate] -> the report says so and gives the host's total next to it.
- [A Change name that is a common word matches unrelated sessions] -> the match is on the path forms `.bdk/runs/<change>/` and `openspec/changes/<change>`, not the bare name.
