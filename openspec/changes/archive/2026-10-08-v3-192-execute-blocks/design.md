## Context

See proposal.md for why. What this Change builds on:

- Architecture (`docs/design/2026-10-07-v3-architecture.md`): principle 3 (the agent works on a plan part, never on a task) and 4 (every step writes a file); the block rows `implement-part` / `bdk:implementer` (sonnet) "One part: acceptance tests first, code, part checks; stops on a plan defect" and `conform-part` / `bdk:conformer` (sonnet) "Checks the part's diff against rules, project instructions and tasks; fixes without changing behaviour" ("Catalog"); "Flows / Execute": the lead hands a part and its stage rules to the implementer, then the diff to the conformer, records the part done when conform passes, commits it, merges worktrees; every agent gets the absolute run directory; workers edit files and never touch git history.
- D7 of `docs/design/2026-10-07-v3-skills-decisions.md` fixes both report bodies; D1 the task contract (`File`, `Interface`, `Verified by`); D2 says a rule violation is never a blocker by itself.
- What the blocks call: `bdk check run <run-dir> <id> [--scope]... [--kind]` (spec `bdk-cli/check`, #183), `bdk rules for --stage execute --files` (spec `bdk-cli/rules`, #184), `bdk config show` (#179). The part file and its frontmatter come from `plan-draft` (#191, spec `bdk-plan-blocks`). The `PreToolUse` guard `hooks.subagent-git` (#182) refuses git history changes in worker agents.
- The eval suite (#189, spec `skill-evals`): block cases with and without the plugin; `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` in skill text because `bin/` is not on `PATH` in eval runs.
- Inputs read, not copied: v2 `agents/implementer.md` (one task, TDD skill, YAML envelope, `NEEDS_CONTEXT`); draft 1 `skills/roles/implementer` and `skills/roles/conformer` (dispatch package, tickets, ledger, `log ingest`, commits through `bdk check run`). Kept: test first, stop instead of working around, change only the part's files, no destructive git, no paid commands, conform fixes without changing behaviour and logs what it leaves. Dropped: tickets, packages, ledger entries, evidence ingestion, the implementer committing; the findings record that this bookkeeping dominated B1 (1,349 of 1,808 Bash calls) and that "a plan acceptance ran paid commands" because the contract did not forbid them.

## Goals / Non-Goals

**Goals:**

- One agent builds one whole part: tests from the acceptance scenarios first, then the tasks, then the part checks green.
- The implementer stops on a plan defect before it writes, and says why and what to change in the plan.
- The conformer catches what draft 1's simplify step missed (rules, project instructions, task drift) and fixes it without changing behaviour, so review rounds do not spend a round on it.
- Each block runs alone (a user command) and is evaluated alone; the execute lead (#200) calls the same thing.

**Non-Goals:**

- Waves, worktrees, commits, merge-back, retries, model escalation, `state.json`: the execute lead (#200).
- Fixing review findings or resolving merge conflicts: the lead calls the implementer for those (#200, #201); this Change does not add modes for them.
- Reviewing behaviour or the product as a whole: `review-group`, `review-integration`, `e2e-check`.

## Decisions

### D1. Two agents, each running its skill through the `Skill` tool

`bdk:implementer` and `bdk:conformer` (sonnet, `Read Edit Write Bash Grep Glob Skill`, no `Agent`) are started with a prompt `Run the skill bdk:<block> with the arguments: <change> <part-id> --run-dir <abs>`. The agent runs the skill with `Skill`; the skill's step 0 hands off to the agent when it runs anywhere else - the pattern of `explore` and the verifier blocks.

Why: the architecture names one agent per block on sonnet; a part's work needs a fresh context with only the part in it (draft 1's dispatch package lost the part preamble). The hand-off keeps a user's command and the lead's call identical, and keeps the main thread out of the code. Both agents lack `Agent`: helpers would be level 3 and nothing measured asks for them.

Alternatives: `skills:` preload (the `reviewer` and `e2e-tester` pattern) - lost: a preloaded skill gets no `$ARGUMENTS`, and the `Skill` call shows in a transcript, so evals and diagnostics see that the block ran; one more turn is the cost. One agent for both blocks - lost: the conformer must not be the conversation that wrote the code, or it confirms its own choices (the reason `verify-*` run on a separate agent). Running `implement-part` in the main thread for a user - lost: it would behave differently from the lead's call (model, context), and the eval would measure a path execute never uses.

### D2. Arguments and the run directory

`<change> <part-id> [--run-dir <path>]`, default `.bdk/runs/<change>/`. The blocks read and edit the working directory (a worktree for a `worktree` part) and write reports and checks under the run directory, which the lead passes as an absolute path into the main checkout (architecture, "Flows / Execute"). `bdk check run` takes the run directory as its first argument and runs the commands in the project root of the working directory, so checks run on the worktree's code and their results land in the main run directory, with the part id as the result id so parallel parts never share a file.

### D3. Check the contract before writing; stop on a plan defect

The implementer reads the part, its acceptance scenarios in the spec deltas, `design.md`, the `execute` rules for the part's files, and the project instructions, then checks each task's three lines before it edits: does the interface exist (or is it to be created) as written, does the change fit `files`, does the task agree with its `Verified by` scenarios. A wrong contract, a contradiction with a scenario, or a file outside `files` is a `plan-defect` blocker with evidence and a proposal; the block stops without editing. A gap the contract leaves open and the specs or code settle (a private helper's name, the test file's layout) is decided and recorded.

Why: the B1 implementer stopping at a plan defect is listed as what worked; working around a defect hides it from `verify-plan` and the review. Stopping before writing leaves a clean tree for the retry after the plan fix.

Alternatives: let the spec win over the task - lost: the plan and the spec disagreeing is the planner's or verifier's miss, and the lead decides by policy whether to re-plan; the implementer picking a side silently is the failure the stop prevents. Allow small edits outside `files` - lost: parallel worktree parts are merged by `files` (spec `bdk-cli/plan` checks overlaps per wave), so an unplanned file is a merge conflict the plan did not foresee.

### D4. Red through `bdk check run`, not a raw test command

The acceptance tests are run with `bdk check run <run-dir> <NN>-red --kind test --scope <test files>`, the green with `bdk check run <run-dir> <NN> --scope <part files>`. The skill never composes a test command.

Why: the configured `tools.test` (with its `scoped` variant) is the project's way to run a test, and `bdk check run` closes stdin and enforces timeouts (B1 lost 14 commands to hangs). It also leaves `checks/<NN>-red.json` as the trace of the red run, so the report's `red seen` has a file behind it. It needs only `Bash(bdk *)`, so an autopilot grants nothing new.

Alternatives: run `npm test` or `vitest` directly - lost: the command differs per project and the timeouts are lost. Red not recorded - lost: "acceptance tests first" is the block's main promise; a file makes it checkable.

### D5. Three check runs, then a blocker

On a red part check the implementer fixes and reruns, three runs in all; then `Status: blocker`, `Kind: other`, with the output path. Without any configured check the verdict `none` is reported; without `tools.test` no red can be seen, so the block stops with `Kind: environment` naming `/bdk:setup`.

Why: retries and model escalation belong to the lead (`policy.budgets`, `policy.escalation`, #200); a bounded local loop keeps a stuck agent from spending the part's time.

### D6. The conformer's diff is the uncommitted working tree

The lead commits a part after its conform report passes (architecture, "Flows / Execute"), so at conform time the part's work is uncommitted: the conformer reads `git status --porcelain` and `git diff HEAD` limited to the part's `files`, and reads untracked files whole. It edits the same files only. A missing or `blocker` implementer report gives `Verdict: FAIL` without checking, so a crash between the two reruns cleanly (architecture, "Autopilot continuation").

Alternatives: a commit range - lost: workers never commit, and the lead's commit comes after conform.

### D7. What the conformer fixes, leaves, and fails on

It checks the changed lines against three sources: the `execute` rules for the changed files, the project instructions, and the part's tasks (file, interface as written - a name, export or signature - and the `Verified by` test present). It fixes what keeps behaviour unchanged: naming, comments, imports, visibility a task declares, dead code, a duplicated helper. It leaves - with file, line, source and why - anything whose fix changes what a user or a caller sees, adds a feature or a test of new behaviour, or touches another file; it never fixes a bug.

`Verdict: FAIL` if and only if the conform checks fail, a `Left` item names a task (the part does not deliver its contract), or the implementer report is not done. A rule or instruction left does not fail the part: D2 makes a rule violation at most `should-fix`, and the review sees the `Left` list.

Why: draft 1's simplify step checked no rules, and rule violations visible in one task's diff cost a review round each. Fixing a bug in conform would change behaviour that no test or reviewer then traced; leaving it, with `FAIL` when a task is short, sends the part back to the implementer through the lead.

Alternatives: fail on every left item - lost: house rules would block parts, B1's rounds 3 and 4 on minor entries. Record left items as findings - lost: findings logs belong to review rounds; D7 fixes the report body.

### D8. No CLI helper

Every step is a Read, an Edit, a Write, `bdk config show`, `bdk rules for`, `bdk check run`, or read-only `git`. No eval or measurement asks for a command (CLAUDE.md, "Building skills (v3)"); the runs' observations are recorded under "Measurements".

### D9. Eval cases on one shared fixture

`plugins/bdk/evals/fixtures/ledger-planned.sh` builds on `ledger-change.sh` (tiny-ledger configured for BDK, the Change `add-csv-export`, `tools.test` `node --test {files}`) and commits the two verified plan parts of `verify-plan-sound`: part 01 `toCsv` in `src/csv.js`, part 02 the `ledger export` command.

| Case | Scaffold on top of the fixture | Graders |
|---|---|---|
| `implement-part-csv` | none | `file_exists` `execute/part-01.md`, `checks/01-red.json`, `src/csv.test.js`; `regex` `^Status: done`; `regex` four `red seen; green seen` lines; `regex` `checks/01.json` verdict `pass`; `tool_used` Agent `bdk:implementer`; `tool_used` Skill |
| `implement-part-plan-defect` | task 2 of part 01 says amounts are written as integer cents, unchanged, against "Amount in cents" | `file_exists` report; `regex` `^Status: blocker`; `regex` `Kind: plan-defect`; `regex` the Blocker names "Amount in cents"; `tool_used` Agent; `tool_used` Skill |
| `conform-part-violations` | part 01 implemented uncommitted with a narrating comment and section headers (`BDK-CQ-4`), `import assert from "assert/strict"` against a `CLAUDE.md` asking for `node:` imports, `formatCents` exported though task 2 declares it private; `execute/part-01.md` `Status: done` | `file_exists` `execute/conform-01.md`; `regex` `^Verdict: PASS`; `regex` `Fixed` names `BDK-CQ-4`, `CLAUDE.md` and `formatCents`; `regex` on `src/csv.js` (no narrating comment, no `export function formatCents`), on `src/csv.test.js` (`node:assert/strict`); `regex` `checks/conform-01.json` verdict `pass`; `tool_used` Agent `bdk:conformer`; `tool_used` Skill |
| `conform-part-behaviour-gap` | part 01 implemented uncommitted and clean, but quoting wraps a description in double quotes without doubling inner ones; tests cover only the comma | `file_exists` report; `regex` `^Verdict: FAIL`; `regex` `Left` names task 1 and the quote; `regex` on `src/csv.js` still without the doubling; `tool_used` Agent; `tool_used` Skill |

All four are `block` cases with and without the plugin; prompts ask as a user would, without naming the skill. Grants: `Write`, `Edit`, and `Bash` narrowed to `bdk` and `git`. Skill text uses examples from another product, so the eval's names are not taught (lesson of #194). `CLAUDE.md` is not loaded by an eval run ("Host limits"), which is the point: the block reads the instruction file itself.

Alternatives: a clean-part conform case for false fixes - folded into `conform-part-behaviour-gap`, whose code breaks no rule; its `Fixed` is read in the measurements. A retry case - left out: the lead owns retries (#200).

## Risks / Trade-offs

- [The implementer reports a plan defect for every small gap and stalls execute] -> the skill separates a wrong contract (stop) from a gap the specs or code settle (decide and record); the `implement-part-csv` case passes only when the sound part is built.
- [The conformer "fixes" behaviour] -> the skill names what it may change and that every test that passed still passes; the conform checks run after the fixes; the behaviour-gap case grades that the bug is left.
- [Scoped checks miss a break outside the part] -> the review round runs the full checks (`bdk check run <run-dir> full`, architecture "Review round"); part checks are the fast inner loop.
- [Red seen for the wrong reason (a syntax error in the test)] -> the skill asks to read the failing output and confirm the failure names the missing behaviour before coding.
- [Sonnet per part costs more than haiku] -> the architecture chose sonnet; `models.implementer` and `models.conformer` override it.

## Measurements

Acceptance runs (`claude -p --plugin-dir plugins/bdk --permission-mode auto`, Claude Code 2.1.294, projects scaffolded from the four cases in a scratch directory outside this repository, the case prompts unchanged):

| Project | Report | Turns | Time | Cost |
|---|---|---|---|---|
| implement-part-csv | `Status: done`, four scenarios `red seen; green seen`, `checks/01-red.json: fail (module src/csv.js missing)`, `checks/01.json: pass`; two decisions recorded (the quoting helper's name, one extra double-quote test the requirement text covers) | 4 | 40 s | $0.36 |
| implement-part-plan-defect | `Status: blocker`, `Kind: plan-defect`, evidence naming task 2, "Amount in cents" and the requirement text, and that design D1 names `formatCents`; proposal to restore task 2; `Changed files` `- None.`, no file in the tree changed | 5 | 34 s | $0.33 |
| conform-part-violations | `Verdict: PASS`, `Fixed`: `BDK-CQ-4` (three comments), `task 2` (`formatCents` private), `CLAUDE.md` (`node:assert/strict`); `Left` `- None.`; `checks/conform-01.json: pass` | 5 | 41 s | $0.34 |
| conform-part-behaviour-gap | `Verdict: FAIL`, `Fixed` `- None.`, `Left`: `src/csv.js:12 task 1`, quotes not doubled, "doubling changes the output, so it was not fixed"; checks pass; the code unchanged | 5 | 39 s | $0.35 |
| no `.bdk/settings.yaml` | reply `BDK not configured: run /bdk:setup`, no agent, no file | 3 | 5 s | $0.20 |

In every configured run the main thread started the named agent (transcripts show `"subagent_type":"bdk:implementer"` or `"bdk:conformer"` and one subagent file), the agent ran on sonnet (about a third of the cost), no transcript holds a `git commit`, `add`, `stash`, `reset`, `checkout` or `restore`, and `git log` and the index stayed as the scaffold left them. The clean code of the behaviour-gap case got no `Fixed` item: no false fix.

The runs showed no problem that skill text or a helper had to answer: no CLI helper (D8). `bdk check run` needs its run directory to exist, so both skills run `mkdir -p <run-dir>/execute` first; that is a step, not a helper.

Eval suite, `--runs 3`, both arms, `-j 4`, Claude Code 2.1.294 (clean `HOME`, `PATH` without other plugins, `CLAUDE_CODE_SHELL_PREFIX` per "Host limits", `--trust-plugin`):

| Case | WITH | W/OUT | Δ |
|---|---|---|---|
| `implement-part-csv` | 1.00 | 0.14 | +0.86 |
| `implement-part-plan-defect` | 1.00 | 0.00 | +1.00 |
| `conform-part-violations` | 1.00 | 0.38 | +0.63 |
| `conform-part-behaviour-gap` | 1.00 | 0.00 | +1.00 |

Mean Δ +0.87, the skill fired in 12 of 12 runs with the plugin, 195 s wall time, $5.87 for 24 runs. Without the plugin the model writes the code and its tests but no report and no recorded red run; it fixes the three conform violations as well (the 0.38), so the conform block's effect there is the report, the checks after the fixes and the separate agent; and in all three behaviour-gap runs it fixed the quoting bug silently, the change without a test or a review that D7 forbids.

## Open Questions

None. Report formats decided by D7.
