---
name: implement-part
description: 'Implements one plan part of an OpenSpec Change on the bdk:implementer agent - checks the task contracts first and stops on a plan defect, writes a test per acceptance scenario and sees it red, builds the tasks inside the part''s files, runs the part checks until green - and writes execute/part-NN.md. Use when asked to implement, build or code one plan part (part 01, 02) of a Change, or when the execute lead runs a part. Not for the whole plan: /bdk:execute builds every part.'
argument-hint: "[<change>] <part-id> [--run-dir <path>] [--parts <dir>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(mkdir -p *) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(openspec validate *) Read Grep Glob Edit Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Implement a part

Build one plan part whole: its acceptance tests first, then its tasks, then its checks green. The part is your contract; when it is wrong, stop and say so instead of working around it. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own, without pipes or `&&`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop: write nothing. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:implementer`

This block runs on the `bdk:implementer` agent, whose instructions start with "You are `bdk:implementer`". When you are not that agent (a user typed the command, or another skill invoked this one in the main thread), do not read or edit the code yourself: start the agent with the Agent tool in the foreground (`run_in_background: false`), `subagent_type: "bdk:implementer"`, prompt `Run the skill bdk:implement-part with the arguments: <the arguments above>`, `model` set to `models.implementer.model` and `effort` set to `models.implementer.effort`, each only when the configuration above sets it. Wait for it, reply with its status line and report path, and stop.

Done when you are `bdk:implementer`, or the agent has answered.

## 1. Find the part and the run directory

- Change: the first argument when two are given. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- Part: `<part-id>.md` in `--parts <dir>` when given (the execute lead passes the absolute directory of a review round's fix parts), else in `openspec/changes/<change>/plan/parts/`. Without a part id, or when the file is missing, list the parts there and stop. A fix part's tasks name the findings they fix; read each in the round's log `<parts dir>/../../findings.jsonl` (`bdk findings list <log>`) for its failure scenario.
- Run directory: `--run-dir <path>` when given (the execute lead passes an absolute path), else `.bdk/runs/<change>/`. Run `mkdir -p <run-dir>/execute`. Reports and check results go under the run directory; the code you read and edit is in the working directory, the main checkout.
- An earlier `<run-dir>/execute/part-<part-id>.md` means this is a retry: read it, then continue from the files as they are now. When `<run-dir>/execute/conform-<part-id>.md` says `Verdict: FAIL`, each `Left` item naming a task is work still to do (a test for it first, seen red), and a red conform check is a check to make green.

Done when you know the part file, the run directory and whether this is a retry.

## 2. Read the contract

1. The part whole: `files` in its frontmatter, the goal, the acceptance scenarios, the tasks with their `File`, `Interface` and `Verified by` lines.
2. Each acceptance scenario in `openspec/changes/<change>/specs/**/spec.md`: its requirement text, WHEN and THEN.
3. `openspec/changes/<change>/design.md`, for the decisions behind the tasks.
4. The rules: `bdk rules for --stage execute --files <file> --files <file> ...` with every path of `files`. Keep what it prints.
5. The project instructions: `CLAUDE.md` and `AGENTS.md` in the project root and in each directory on the way to a file of the part, and each `.claude/rules/*.md` whose `paths` match a file of the part.
6. The code each task builds on: every existing file or symbol an `Interface` line names, and a neighbouring test for the project's test conventions.

Done when you can say, for each task, what changes where and which scenario proves it.

## 3. Check the contract before you write

Before you edit any file, check each task:

- The `Interface` names what exists as it says (open the file, read the signature), or what the task creates.
- Everything the task needs to change is in the part's `files`.
- The task agrees with each scenario it is verified by, and with the requirement text: compute the THEN from what the task says and compare.
- Each acceptance scenario exists in the spec deltas.

A failed check is a **plan defect**: go to step 7 with `Status: blocker` and `Kind: plan-defect`, having edited nothing. Do not pick the side you think is right and do not work around it: a plan that disagrees with itself was missed by its verifier, and the caller decides. Example: a task says a duration is stored in minutes while its scenario expects `90` seconds to print `1:30`; that is a defect, not a choice.

A gap is not a defect: when the contract leaves something open that the specs, the design or the code settle (a private helper's name, the order of tests in a file), decide it and note it for `Decisions taken without the user`.

Done when every task passed the check, or you stopped on a defect.

## 4. Acceptance tests first

For each acceptance scenario, write a test that encodes its WHEN and its THEN, in the project's test conventions, inside the part's `files`. Name the scenario in the test's name or a nearby line, so a reader finds it.

Run them before any code of the tasks, as a check (see "How to run a check" below) with the id `<part-id>-red`, on the test items of the part point and on these tests only:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" check plan <run-dir> <part-id>-red --at part --kind test --tests <test file> --tests <test file>
```

`--at part` plans only the test items meant for a part (`when` holds `part`, or no `when`), so a whole suite kept for the wave or the review does not run here. See each acceptance test fail: the lines `bdk check record` prints under a red check are only its last 20, and when they do not show every acceptance test failing (`(last 20 lines; ...)` under them says they are cut), read the output file with Read and find each test's own failure there. Each test must fail because the behaviour is missing (a missing export, a wrong value), not because the test is broken (a syntax error, a wrong import path, a typo in the fixture). Fix a broken test and run the check again. A test whose failure you did not read is not seen red: run the red check again, never infer it. A plan with nothing to run (`nothing to run`) means no `tools.test` item runs at `part` on these tests (none is configured for that point, or the `paths` of each skip them): go to step 7 with `Kind: environment` and the line `no tools.test item runs at part on these files; add one with /bdk:setup`.

A scenario the part lists with the suffix ` (behaviour present)` is the exception: its author traced the code and found the behaviour already there, so the part only adds the missing test, and that test must **pass** in this run. Run the red check for it all the same, with the other acceptance tests: its passing run is the only evidence that the behaviour is present, and your report line claims it. Find the test's own pass in the output, as you would a failure. The part and the code must agree; when they do not, the plan is wrong, and a retry cannot change that: stop and go to step 7 with `Kind: plan-defect`, having written no code:

- The test of an unmarked scenario passes, and it encodes the WHEN and THEN (re-read it first: a test that asserts the wrong thing passes too, and is yours to fix). The behaviour is present while the part asks for it. Proposal: mark the scenario ` (behaviour present)`.
- The test of a marked scenario fails because the behaviour is missing (not because the test is broken). The part says the behaviour is there and no task builds it. Proposal: drop the marker and add a task that fixes the code.

Done when every acceptance scenario has a test you saw fail, red for the right reason, or, for a scenario marked ` (behaviour present)`, a test you saw pass.

## 5. Build the tasks

Implement the tasks in their order, each as its `Interface` line says, following the rules and project instructions from step 2. Touch only the part's `files`. Write no code the tasks do not ask for, and match the style, naming and comment density of the surrounding code.

A task that turns out to need a file outside `files`, or a change of an interface the part does not own, is a plan defect found late: stop and go to step 7, listing what you already changed.

Done when every task is built.

## 6. Run the part checks

First pick the tests of the part, the ones that show it works and broke nothing:

- the acceptance tests of step 4;
- the existing tests of the modules you changed: the test file next to a changed source file, or the tests that import it (Grep for its module name in the test files);
- the end-to-end specs of the flows the part touched, when the project has them (`e2e/`, `tests/e2e/`, `*.spec.ts` of Playwright): a spec that drives a page, command or endpoint whose code you changed.

Pick only files that exist. No E2E spec for a flow is fine: then no E2E item runs, which is the point (a change to `src/checkout.ts` runs `e2e/checkout.spec.ts`, not every spec, and a part with no E2E spec runs no E2E suite). Then run the check with the id `<part-id>` (see "How to run a check" below):

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" check plan <run-dir> <part-id> --at part --changed HEAD --tests <test file> --tests <test file>
```

Test items run the picked tests; lint and build items run on the files you changed (against `HEAD`, untracked files included): the parts before this one are committed, so the changes are this part's. On `fail`, read the output file of each red check, fix the cause in the part's files, and run the check again (plan, lines, record): three runs in all. A verdict still `fail` after the third run is a blocker of `Kind: other`, with the output path as evidence. A tool that cannot run at all (command not found) is `Kind: environment`.

Never run a test, linter or build command other than a line `bdk check plan` printed, and never one that installs, spends money or reaches the network.

When the part changed a file under `openspec/changes/<change>/specs/`, validate the Change too: OpenSpec refuses a delta it cannot parse (a requirement without a `#### Scenario:`, a section header it does not know), and `/bdk:close` cannot archive it:

```
openspec validate <change> --strict
```

Fix each error on a delta in the part's `files` (a requirement the task adds gets the scenario the task names) and run it again: three runs in all. An error still there after the third run is a blocker of `Kind: other`, with the error as evidence. An error on a file outside the part's `files` is not the part's: note it under `Decisions taken without the user` and go on. When `openspec` is not found, write `openspec validate: not run, no OpenSpec CLI` under `## Checks` and go on: the review round and close check the delta later. A part that changed no delta runs no validation.

Done when the recorded verdict is `pass` (or `none`: no item runs at `part` on these files, stated in the report) and, for a part that changed a delta, no validation error names a delta of the part, or you have a blocker.

## How to run a check

A check is three steps, each its own Bash call, one after another:

1. `bdk check plan <run-dir> <id> ...` with the flags the step gives. It runs nothing; it prints, per check, a header with its Bash timeout, the line to run indented under it, and at the end the `bdk check record` call to make.
2. Each printed line, as its own Bash call from the project root, character for character, with the `timeout` its header gives, one after another (never in parallel and never in the background). Do not add `cd`, a pipe, `tail`, `echo` or anything else to it: the line already writes the whole output to the file it names, and a longer call is refused by the permission check. The Bash tool reports the exit code (a result that shows no `Exit code` line is code 0); a non-zero code is a result, not an error, so go on to the next line.
3. `bdk check record <run-dir> <id> --exit <kind>-<tool>=<code> ...` with the code the tool reported for each line, or `--timed-out <kind>-<tool>` for a line the tool ended at its timeout. It writes `checks/<id>.json` and prints the verdict and the last lines of each red check. A line you did not run is `not-run`, and the verdict is `fail`.

A note under a header (a timeout above the Bash cap, a command whose redirect binds only to its last part) goes into the report under `Decisions taken without the user`. A line the host refuses to run is `Kind: environment`, with the refusal as evidence.

## 7. Write the report

Write `<run-dir>/execute/part-<part-id>.md`, replacing an earlier one:

```markdown
Status: done

## Acceptance tests
- notes / Export / Empty notebook -> test/export.test.js "empty notebook prints []"; red seen; green seen

## Changed files
- src/export.js
- test/export.test.js

## Checks
- checks/03-red.json: fail
- checks/03.json: pass
  - test/export.test.js: acceptance tests
  - test/notes.test.js: imports src/notes.js, changed
  - e2e/export.spec.ts: drives the export page

## Decisions taken without the user
- The private helper is named `serializeNote`; the task leaves the name open.
```

With `Status: blocker`, add before `## Decisions taken without the user`:

```markdown
## Blocker
- Kind: plan-defect
- Evidence: task 2 says durations are stored in minutes; notes / Timer / Show duration expects `90` seconds to print `1:30`.
- Proposal: change task 2 to store seconds.
```

- `Status: done` only when every acceptance scenario has its test line, the last part check passed (`bdk check record` printed `verdict: pass`) and, for a part that changed a spec delta, the last validation left no error on a delta of the part.
- `## Checks` names each check run as `checks/<id>.json: <verdict>`, the last part check's line followed by one indented line per test it picked (`  - <path>: <why, in a few words>`), and the last validation as `openspec validate <change> --strict: pass` or `: fail` (or the `not run` line).
- Each `## Acceptance tests` line ends exactly `; red seen; green seen`, or, for a scenario the part marks ` (behaviour present)`, exactly `; green at first run (behaviour present); green seen`, with nothing between or after; anything to say about a test goes under `## Decisions taken without the user`.
- `Kind` is `plan-defect` (the part is wrong), `environment` (a tool or configuration is missing, or the host refused a check line) or `other` (checks stay red).
- An empty section holds `- None.` A blocker found before any edit lists `- None.` under `Changed files`.

Done when the report exists and its first line is the status.

## 8. Reply

Reply with two lines: the status line and the report path.
