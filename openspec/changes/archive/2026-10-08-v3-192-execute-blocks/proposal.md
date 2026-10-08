## Why

Tracks #192.

Execute is where a Change becomes code, and draft 1 made it slow and blind: one agent per task (96 agents for 27 tasks), a simplify step that checked no rules, and per-task checks that closed green while the product did not work ([findings](../../../docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md), "Speed" and "Correctness"). What worked and stays: the implementer stopped at a plan defect instead of working around it, and a conform step after each part. The v3 architecture puts one agent on a whole plan part (principle 3) and splits the work into two blocks, `implement-part` on `bdk:implementer` and `conform-part` on `bdk:conformer` (`docs/design/2026-10-07-v3-architecture.md`, "Catalog", "Flows / Execute"); their report formats are D7 of `docs/design/2026-10-07-v3-skills-decisions.md`, and the task contract they read is D1. The execute lead (#200) composes them; this Change builds the two blocks so each runs and is evaluated alone.

## What Changes

- New block skill `implement-part` in `plugins/bdk/skills/implement-part/`, run on a new agent `bdk:implementer` (sonnet): for one plan part of a Change, it reads the part, its acceptance scenarios, the design, the `execute` rules for the part's files and the project instructions; checks the part's task contracts against the specs and the code before it writes anything, and stops with a `plan-defect` blocker when a contract is wrong or needs a file outside the part; writes a test per acceptance scenario first and sees it red through `bdk check run`; implements the tasks in order inside the part's files; runs the part checks until green; and writes `.bdk/runs/<change>/execute/part-NN.md` in the D7 body (`Status: done|blocker`). It edits files only: no git history change, no install, no network.
- New block skill `conform-part` in `plugins/bdk/skills/conform-part/`, run on a new agent `bdk:conformer` (sonnet): reads the uncommitted diff of one implemented part and checks it against the `execute` rules for the changed files, the project instructions (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/`) and the part's tasks; fixes each violation it can fix without changing behaviour, inside the part's files; leaves the rest with evidence; runs the part checks; and writes `.bdk/runs/<change>/execute/conform-NN.md` in the D7 body (`Verdict: PASS|FAIL`, `Fixed`, `Left`, `Checks`).
- Both skills hand off to their agent when they run anywhere else, the pattern of `explore` and the verifier blocks, so a user's command and the execute lead get the same fresh, sonnet context.
- New shared eval fixture `ledger-planned.sh` (the `add-csv-export` Change with two verified plan parts) and four block cases: `implement-part-csv` (the part implemented test-first, checks green), `implement-part-plan-defect` (a task contradicting its acceptance scenario stops the part), `conform-part-violations` (rule, instruction and task-contract violations fixed, behaviour unchanged), `conform-part-behaviour-gap` (a missing behaviour is left and fails the part, not fixed).

## Capabilities

### New Capabilities
- `bdk-execute-blocks`: the `implement-part` and `conform-part` blocks and their agents `bdk:implementer` and `bdk:conformer` - input, the run directory, what each reads, the order of the work, the limits on what they change, the report files and the reply.

### Modified Capabilities
None. `bdk run status` (spec `bdk-cli/run`) reads part state from `state.json`, which the execute lead writes (#200); the blocks only write their reports.

## Impact

- `plugins/bdk/skills/implement-part/`, `plugins/bdk/skills/conform-part/`, `plugins/bdk/agents/implementer.md`, `plugins/bdk/agents/conformer.md` (new); `CLAUDE.md` "Current state" names them.
- `plugins/bdk/evals/`: the fixture, four cases, README grants and run command.
- No CLI change: `bdk check run`, `bdk rules for --stage execute` and `bdk config show` cover every step. No helper: none is asked for by an eval or a measurement.
- Out of scope: the execute lead and `/bdk:execute` (waves, worktrees, commits, merge-back, retries and model escalation, `state.json`, `execution.max-parallel`; #200); fixes of review findings through execute (#201); `plan-draft` and `verify-plan` (#191, merged).
