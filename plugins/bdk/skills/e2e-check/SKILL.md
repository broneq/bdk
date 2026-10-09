---
name: e2e-check
description: 'Uses the product as a user would to confirm that an OpenSpec Change works - lists the user processes its proposal adds or changes, starts the product from tools.e2e, drives up to 5 paths per process (main, variants, at least one that tries to break it) through its CLI, HTTP API or a browser, writes evidence per path and a verdict, and records each broken path as a finding at its proposal line. Use when asked to check a change end to end, to test it manually or as a user, before a PR, or when a review round needs its E2E check.'
argument-hint: "<change> [<findings log>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(curl *) Bash(mktemp *) Bash(mkdir -p .bdk/runs/*) Bash(node *) Bash(npm install --prefix .bdk/runs/*) Bash(rm -rf .bdk/runs/*) Read Write Glob Grep
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# E2E check

Act as a manual tester. Start the product, use it the way its user would, and confirm that the Change works the way its proposal says. Never change product files and never write tests: you check the product, you do not fix it. Write only under `E2E` (step 1), to the findings log, and to the scratch directory a browser driver makes under `.bdk/runs/<change>/`. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`. Read and search files with Read, Glob and Grep, not with Bash. Run each command on its own, without `;`, `&&` or pipes, and give paths under `.bdk/runs/` relative to the project root: a compound command or another form of path asks the user for permission.

## 1. Inputs

- The block above says `BDK not configured` or `BDK configuration invalid`: reply with that line and stop. Run nothing, write nothing.
- Change: the first argument. Without one, take the only directory under `openspec/changes/` other than `archive/`; with several, ask which Change and stop.
- Findings log and `E2E`, the directory of your evidence: with a second argument, that is the log, and `E2E` is `e2e/` next to it (a review round passes `.bdk/runs/<change>/review/round-N/findings.jsonl`, so `E2E` is `.bdk/runs/<change>/review/round-N/e2e/`). Without one, `E2E` is `.bdk/runs/<change>/e2e/` and the log is `E2E/findings.jsonl`.

Done when you know the Change, the log, `E2E` and the `tools.e2e` items of the configuration.

## 2. Processes and paths

Read `openspec/changes/<change>/proposal.md`: Why tells you whom the Change serves and what they want; sort each line of What Changes, with its line number:

- A line that adds or changes something a user does - a command, an option, an output, a request, a page, a control - gives a **process**: one goal a user sets out to reach and sees the result of, named after that goal in kebab-case (`export-notes`, `share-a-list`). Two ways to reach one goal are two paths of one process, not two processes. One line may give several processes.
- A line that changes nothing a user does (a refactor, a module, a test, a dependency) is **not a user process**: note it with a few words of reason. You never drive it. A line that only promises behaviour stays as it was ("output and exit codes stay the same") is not a process either: the project's tests guard what already worked, and you check what the Change adds or changes.

Then read `design.md` and the spec deltas (`openspec/changes/<change>/specs/**/spec.md`) only for exact expected values - the text, the exit code, the status, what the page shows. Do not drive the spec scenarios one by one: the project's own tests prove them. You check what they cannot: that the change works when a user uses it.

Per process, plan at most 5 paths; the Change as a whole has no cap:

- `main`: the process as the proposal describes it.
- variants: another state or input that the proposal, the design or a delta names, or that a user plainly meets (nothing there yet, many items, a second run). Name each after what it does (`empty-notebook`).
- at least one `break` path that tries to break the process: wrong or missing input, wrong order, a repeated, quick or interrupted action, a missing precondition (`bad-date`, `double-submit`).

Each path names the proposal line it comes from and its expected outcome, made exact by the design or a delta when they state it (note that location as `Expected from`). A `break` path whose outcome nothing states is held to the baseline every user expects (`Expected from: baseline`): the product refuses or handles it visibly (a message that names the problem; a non-zero exit, a 400-499 status, or an error on the page), shows no crash or stack trace, loses or corrupts no data, and still works for the next action.

Then decide per process which `tools.e2e` item reaches it: a command and its output (`cli`), a request and its response (`http`), a page (`browser`). A process that no item reaches gets one `main` path `not-driven` with the reason.

Skip the rest and go to step 6 with `Verdict: SKIPPED` when the configuration has no `tools.e2e` item (reason: `no tools.e2e entry; add one with /bdk:setup`; check this before you read the proposal), or when the proposal gives no process (reason: `the proposal changes nothing a user does`; list its lines under `## Not a user process`).

Done when every line of What Changes is a process or not a user process, and every process has its paths, each with an item or a `not-driven` reason.

## 3. Start each item the paths need

Read [drivers](references/drivers.md) for each driver you use. Per item, run `start` with its `env` (`env NAME=value <start>`), then wait for `ready`:

- `cli`: run `start` to its end, then `ready` once; it must exit 0.
- `http`, `browser`: first call the `ready` URL once (`curl -sS -o /dev/null -w '%{http_code}\n' --max-time 3 <url>`). Any status other than `000` means another process holds the port: do not start, do not drive it; mark the item's paths `blocked` and the run `BLOCKED` with the port in the reason. Otherwise run `start` with the Bash tool's `run_in_background`, never with `&` or `nohup`, and note its task id, which is how step 6 stops it; and wait with one call: `curl -sS -o /dev/null -w '%{http_code}\n' --retry 60 --retry-delay 2 --retry-connrefused <url>`. Ready is a status below 500. A command `ready` is run again until it exits 0, at most 10 times.

When `start` fails or `ready` does not pass in about 120 seconds, the product does not start: add one finding for the item (step 5) with the output that shows why, mark its paths `blocked`, and go on with the other items.

Done when each needed item runs or is blocked with its reason.

## 4. Drive each path

For each path, set up its starting state as a user would, act, and observe; then compare with its expected outcome, every part of it (text, exit code, status, what the page shows). Follow [drivers](references/drivers.md) for the item's driver. Judge only what the product shows, never what the code says it should do; whether the code of a line was written is a question for code review, not for you. A wrong text, a wrong exit code, an error page, a stack trace or a dead control is a fail. When something breaks that no path covers (a crash, an error in the browser console), note it for step 5.

Write `E2E/<process>--<path>.md` (`list-todos--empty-list.md`); the double hyphen splits the process from the path:

```markdown
Result: fail
Process: list-todos
Path: empty-list (variant)
Proposal: openspec/changes/add-list/proposal.md:7 - New command `todo list` prints the open todos.
Item: cli (cli)

## Steps
1. `node /abs/project/bin/todo.js list` in a fresh directory -> exit 1, stderr `todo: no list file`

## Expected
`No todos`, exit 0
Expected from: openspec/changes/add-list/specs/todo/spec.md:12

## Observed
exit 1, `todo: no list file`
```

The first line is `Result: pass`, `Result: fail`, `Result: blocked` or `Result: not-driven`. `Path:` carries the kind: `main`, `variant` or `break`. Leave `Expected from:` out when the proposal line alone states the outcome; write `Expected from: baseline` for a break path held to the baseline of step 2. Write the file for `blocked` and `not-driven` paths too, with the reason under `## Observed`. A browser path ends with `## Evidence`, listing its screenshots and its video by file name, all saved in `E2E` next to the file (`count-clicks--main-1.png`, `count-clicks--main.webm`).

Done when every path has its file.

## 5. Findings

For each failed path, one call:

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings add <log> --source e2e-check --summary "<process> / <path>: <what the product did instead>" --file openspec/changes/<change>/proposal.md --line <proposal line> --evidence "<E2E/process--path.md>: expected <outcome>, observed <what happened>"
```

The finding points at the proposal line, the promise the product broke; when a delta or the design gave the exact value, name it in `--evidence`. For an item that does not start: `--summary "<item> does not start: <reason>"` with `--evidence` holding the decisive output line, no `--file`. For a defect outside every path: the same form, no `--file`. Never pass `--rule`, and never set a level or a decision: the judge and triage do that.

Done when every failed path and every start failure has exactly one finding.

## 6. Stop and record the verdict

Stop every process you started: `TaskStop` with each task id. For a URL item, call the `ready` URL once more: `000` means it stopped; anything else, stop it again. Close the browser and delete the scratch directory as [drivers](references/drivers.md) says.

Write `E2E/verdict.md`, one section per process, one line per path with its result, name, kind, proposal line and file:

```markdown
Verdict: FAIL

## list-todos
- pass: main (main, proposal.md:7) - list-todos--main.md
- fail: empty-list (variant, proposal.md:7) - list-todos--empty-list.md
- pass: unknown-flag (break, proposal.md:7) - list-todos--unknown-flag.md

## Not a user process
- proposal.md:8 - storage moves into one module; no user sees it
```

The first line is `Verdict: SKIPPED` with the reason when step 2 skipped; `Verdict: BLOCKED` when only the environment stopped the run (a taken port, no browser); `Verdict: FAIL` when a path failed or an item did not start; otherwise `Verdict: PASS`. `## Not a user process` holds `- None.` when every line gave a process; a run skipped for a missing `tools.e2e` item has no sections. A rerun replaces the files.

Done when no process of yours runs, no scratch directory of yours is left, and `E2E/verdict.md` exists.

## 7. Reply

Reply in at most five lines: the verdict line (with the reason for `SKIPPED` or `BLOCKED`), the number of processes and the count of paths per result, the number of findings and the log path, and the path of `E2E/verdict.md`. Do not repeat the path files.
