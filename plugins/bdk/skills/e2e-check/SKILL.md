---
name: e2e-check
description: 'Runs the product as a user would against the spec scenarios of an OpenSpec Change - starts it from tools.e2e, drives each scenario through its CLI, HTTP API or a browser, writes evidence per scenario and a verdict, and records each broken scenario as a finding. Use when asked to check a change end to end, to test it manually or as a user, before a PR, or when a review round needs its E2E check.'
argument-hint: "<change> [<findings log>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(curl *) Bash(mktemp *) Bash(env CHROME_DEVTOOLS_AXI_SESSION=bdk-e2e npx -y chrome-devtools-axi *) Read Write Glob Grep
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# E2E check

Act as a manual tester. Start the product, use it the way its user would, and compare what it shows with each spec scenario of the Change. Never change product files and never write tests: you check the product, you do not fix it. Write only under `.bdk/runs/<change>/e2e/` and to the findings log. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`.

## 1. Inputs

- The block above says `BDK not configured` or `BDK configuration invalid`: reply with that line and stop. Run nothing, write nothing.
- Change: the first argument. Without one, take the only directory under `openspec/changes/` other than `archive/`; with several, ask which Change and stop.
- Findings log: the second argument (a review round passes `.bdk/runs/<change>/review/round-N/findings.jsonl`), else `.bdk/runs/<change>/e2e/findings.jsonl`.
- `E2E` below means `.bdk/runs/<change>/e2e/`.

Done when you know the Change, the log and the `tools.e2e` items of the configuration.

## 2. Scenarios

Read every `openspec/changes/<change>/specs/**/spec.md`. For each `#### Scenario:` note its name, its requirement, the spec file and the line of its heading, and its WHEN and THEN. Then decide whether a user observes the THEN through one `tools.e2e` item: a command and its output (`cli`), a request and its response (`http`), a page (`browser`). A scenario about code structure, a module's exports, a file a test reads or an internal rule is `not-driven`; note why in a few words.

Skip the rest and go to step 6 with `Verdict: SKIPPED` when the configuration has no `tools.e2e` item (reason: `no tools.e2e entry; add one with /bdk:setup`) or the Change has no scenario (reason: `the Change has no spec scenarios`).

Done when every scenario has an item or a `not-driven` reason.

## 3. Start each item the scenarios need

Read [drivers](references/drivers.md) for each driver you use. Per item, run `start` with its `env` (`env NAME=value <start>`), then wait for `ready`:

- `cli`: run `start` to its end, then `ready` once; it must exit 0.
- `http`, `browser`: first call the `ready` URL once (`curl -sS -o /dev/null -w '%{http_code}\n' --max-time 3 <url>`). Any status other than `000` means another process holds the port: do not start, do not drive it; mark the item's scenarios `blocked` and the run `BLOCKED` with the port in the reason. Otherwise run `start` with the Bash tool's `run_in_background`, note its task id, and wait with one call: `curl -sS -o /dev/null -w '%{http_code}\n' --retry 60 --retry-delay 2 --retry-connrefused <url>`. Ready is a status below 500. A command `ready` is run again until it exits 0, at most 10 times.

When `start` fails or `ready` does not pass in about 120 seconds, the product does not start: add one finding for the item (step 5) with the output that shows why, mark its scenarios `blocked`, and go on with the other items.

Done when each needed item runs or is blocked with its reason.

## 4. Drive each scenario

For each drivable scenario, set up its WHEN as a user would, act, and observe; then compare with its THEN, every part of it (text, exit code, status, what the page shows). Follow [drivers](references/drivers.md) for the item's driver. Judge only what the product shows, never what the code says it should do. A wrong text, a wrong exit code, an error page or a dead control is a fail. When something breaks that no scenario covers (a crash, a stack trace, an error in the browser console), note it for step 5.

Write `E2E/<scenario>.md`, `<scenario>` being the scenario name in kebab-case (`Empty list` gives `empty-list.md`):

```markdown
Result: fail
Requirement: List
Scenario: Empty list
Spec: openspec/changes/add-list/specs/todo/spec.md:12
Item: cli (cli)

## Steps
1. `node /abs/project/bin/todo.js list` in a fresh directory -> exit 1, stderr `todo: no list file`

## Expected
`No todos`, exit 0

## Observed
exit 1, `todo: no list file`
```

The first line is `Result: pass`, `Result: fail`, `Result: blocked` or `Result: not-driven`. Write the file for `blocked` and `not-driven` scenarios too, with the reason under `## Observed`. A browser scenario lists its screenshots under `## Evidence`.

Done when every scenario has its file.

## 5. Findings

For each failed scenario, one call:

```bash
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings add <log> --source e2e-check --summary "<Scenario>: <what the product did instead>" --file <spec file> --line <scenario heading line> --evidence "<E2E/scenario.md>: expected <THEN>, observed <what happened>"
```

For an item that does not start: `--summary "<item> does not start: <reason>"` with `--evidence` holding the decisive output line, no `--file`. For a defect outside every scenario: the same form, no `--file`. Never pass `--rule`, and never set a level or a decision: the judge and triage do that.

Done when every failed scenario and every start failure has exactly one finding.

## 6. Stop and record the verdict

Stop every process you started: `TaskStop` with each task id. For a URL item, call the `ready` URL once more: `000` means it stopped; anything else, stop it again. Close the browser as [drivers](references/drivers.md) says.

Write `E2E/verdict.md`:

```markdown
Verdict: FAIL

- fail: Empty list - empty-list.md
- pass: List of added todos - list-of-added-todos.md
- not-driven: Store module - store-module.md (module structure; no user sees it)
```

The first line is `Verdict: SKIPPED` with the reason when step 2 skipped; `Verdict: BLOCKED` when only the environment stopped the run (a taken port, no browser); `Verdict: FAIL` when a scenario failed or an item did not start; otherwise `Verdict: PASS`. A rerun replaces the files.

Done when no process of yours runs and `E2E/verdict.md` exists.

## 7. Reply

Reply in at most five lines: the verdict line (with the reason for `SKIPPED` or `BLOCKED`), the count of scenarios per result, the number of findings and the log path, and the path of `E2E/verdict.md`. Do not repeat the scenario files.
