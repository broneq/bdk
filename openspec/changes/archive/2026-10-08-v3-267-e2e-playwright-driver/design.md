# Design

## Context

See proposal.md - Why. Current state:

- `e2e-check` (#194) picks the browser tool in `references/drivers.md` from `tools.e2e[].browser`: `chrome-devtools-axi` (default) or `chrome-devtools-mcp`, with axi as the MCP fallback. Its `allowed-tools` grants `Bash(env CHROME_DEVTOOLS_AXI_SESSION=bdk-e2e npx -y chrome-devtools-axi *)`. Five skills call the block (`review-round`, `close`, `debug`, `diagnose-bug`, `spec-conformance`); none names a browser tool, so the choice stays inside `drivers.md`.
- The enum is `plugins/bdk/src/config/domain/settings.ts:29`; its test (`src/config/tests/domain.test.ts:303-309`) uses `playwright` as the invalid example.
- `/bdk:setup` writes `browser: chrome-devtools-mcp` when `.mcp.json` declares that server (`skills/setup/references/e2e.md`, "`browser`"); the grader `setup-web-app/graders/no-browser-field.md` checks that the web case gets no `browser: chrome-devtools*`.
- Evals cannot bind a local port (`listen EPERM`, Claude Code 2.1.292, archived Change `2026-10-08-v3-194-e2e-check-block` D10 and "Measurements"), so the browser driver has no eval case; `fixtures/click-counter.sh` is checked by hand (`evals/README.md`, "Manual browser check of `e2e-check`"). The root `package.json` still pins `@anthropic-ai/claude-code` 2.1.292.
- The measurement's Playwright runs imported Playwright 1.58.2 by absolute path from a pre-installed `node_modules`, used one browser context per actor and `storageState` files across scripts, and recorded no video; each run wrote 15-19 scripts, each opening a new context.

## Goals / Non-Goals

**Goals:**

- Playwright is the default browser tool with no project setup beyond what `/bdk:setup` reports, and costs no more tokens than the measured 60k per DocFlow-sized run plus the replay.
- Every browser scenario leaves a screenshot at each THEN and one video, in `.bdk/runs/<change>/e2e/`.
- The three hard defects of decision 7 are found.

**Non-Goals:**

- No `bdk` CLI helper and no shipped Playwright script library: the agent writes its scripts (logic lives in skills; no measurement shows a problem a helper would solve).
- No setting for CAPTCHA, protection tokens, data cleanup, or preview vs local environments (user decision 6).
- No QA campaign over the whole product (separate later issue).

## Decisions

### D1. ADR-0004 supersedes D5; the tester still explores

ADR-0004 (`docs/adr/0004-e2e-browser-driver-playwright.md`, MADR shape of 0001-0003) records: Playwright driven by the agent is the default, `chrome-devtools-mcp` stays, `chrome-devtools-axi` goes, with the measured numbers as context. It answers #194's reason for rejecting Playwright ("a script tests what its author expected, not what a user meets"): the tester does not write a test suite up front; it writes one small script, reads what it prints (an `ariaSnapshot()` of the page, texts, statuses, a screenshot), and only then writes the next step. D5 in `docs/design/2026-10-07-v3-skills-decisions.md` gets a "Superseded by ADR-0004" line and its index row is marked; its text stays.

Alternatives: edit D5 in place - lost, the decisions doc records what was decided at the time, and an ADR is where a reversal with new evidence goes (ADR-0003 convention). Keep axi as a third option - lost, the user decided to remove it, and it fell back to JavaScript in 3/3 runs.

### D2. Where Playwright comes from

Per run, the tester makes one scratch directory (`mktemp -d .bdk/runs/<change>/e2e-scratch.XXXXXX`, see D6) and resolves Playwright once:

1. From the project root: `createRequire('<root>/package.json').resolve('@playwright/test')`, then `playwright` (under pnpm, `playwright` is not hoisted, so `@playwright/test` comes first; both export `chromium`). Scripts in the scratch directory import the absolute path this gives, since a bare `import 'playwright'` would resolve from the scratch directory.
2. Else `npm install --prefix <scratch> --no-save --silent playwright@1.63.0`, and scripts, which live in the scratch directory, load `./node_modules/playwright` through `createRequire`. The npm cache makes repeats fast.

Pinned version: 1.63.0 (released 2026-09-04). 1.64.0 (2026-10-07) is too new by the two-week rule; 1.58.2 was measured, so the acceptance runs (task group 6) re-check 1.63.0 on the fixtures. The version lives in `drivers.md` and in `setup/references/e2e.md` only; both name it, and a test (`plugins/bdk/tests/`) checks the two agree, so a bump is one deliberate change.

Alternatives: `npx -y playwright@<v>` (the issue's wording) - lost for the driver: `npx` runs the Playwright CLI, but a script cannot `import` a package `npx` put on `PATH`; `npx` stays only for `install chromium`. Always install the pinned version, ignoring the project's - lost: the project's version matches its installed browsers, and a second Playwright is a download for nothing. `npm i -g` - lost: changes the user's machine.

### D3. Which browser: installed Chromium, then system Chrome

The first script launches `chromium.launch()`. When it fails with Playwright's missing-executable error, the tester launches `chromium.launch({ channel: 'chrome' })` (the system Chrome, no ~500 MB download) and uses that for the run. When both fail: every scenario of the entry `blocked`, `Verdict: BLOCKED`, reason with `npx -y playwright@1.63.0 install chromium`. So `channel: 'chrome'` is the fallback, not the default: the installed Chromium matches the Playwright version exactly, and a project with its own Playwright usually has it.

Alternatives: `channel: 'chrome'` first - lost: Chrome's version is not the one Playwright was tested with, and headless behaviour differs across Chrome updates; it is the right answer only when no Chromium is there. Install Chromium on demand - lost: a 500 MB download inside a review round, and the user decided setup only suggests installs.

### D4. Explore, then one clean replay that records

Exploration scripts record nothing. When the tester knows the steps of a scenario, it writes one replay script that opens a fresh context with `recordVideo: { dir: <scratch>/video }`, a viewport (1280x800 unless the scenario names one), repeats the steps, takes `E2E/<scenario>-<n>.png` at each THEN, reads the page there, closes the context and saves the video with `page.video().saveAs('E2E/<scenario>.webm')` (one per actor's page when there are several contexts: `<scenario>-<actor>.webm`). The replay's observations decide `Result:`; a `fail` seen while exploring and seen again in the replay is reported, one seen only while exploring is noted under `## Observed` as not reproduced and the replay's result stands.

This answers the video problem found in the measurement (a context per script would give many fragments) and gives the "reproduce before reporting" rule of the colleague's run without a third pass. Its cost is measured in task group 6 against the 60k / 244 s baseline; the target is under +30% tokens.

Alternatives: record every exploration script - lost: 15-19 fragments per run, most of them dead ends. Keep one browser open across scripts (`launchServer` / CDP endpoint) and record the whole session - lost: a long-lived process the tester must stop, and the video shows the dead ends too. No video - lost, user decision 2.

### D5. Read the page after each action

The driver tells the tester to read the page (`ariaSnapshot()` and the texts the THEN names) right after each action in the same script, not in the next script, to use `locator.click()` without `force` (so a covered control fails with the element that intercepts the pointer), and to act at the speed the scenario implies (two clicks in a row for "twice quickly": `click()` twice without waiting, or `dblclick()`). Console errors (`page.on('console')` of type `error`, `page.on('pageerror')`) and responses `>= 400` are collected in every script and printed at its end.

This is the driver-side answer to the three hard defects. If a fixture run misses one, the miss is fixed in `drivers.md` (acceptance signal) and recorded under "Measurements".

Alternatives: `waitForTimeout` before reading - lost: it hides exactly the 2-second message. `force: true` clicks - lost: they click through the cover a user cannot.

### D6. Evidence layout: the Change's run directory, per review round

Evidence stays in the Change's run directory, where the review reports and the close records are, and is never committed (`.bdk/runs/` is ignored). The E2E directory follows the findings log the caller names (spec `bdk-e2e-check`, "Input and scenarios"):

```
.bdk/runs/<change>/
  e2e/                          e2e-check run alone (also its findings.jsonl)
  review/round-<N>/
    findings.jsonl  report.md  round.md
    e2e/                        the round's E2E evidence
      verdict.md  <scenario>.md  <scenario>-<n>.png  <scenario>.webm
```

Before, every review round wrote `.bdk/runs/<change>/e2e/`, so round 2 replaced the files that round 1's findings point at (`--evidence "<E2E/scenario.md>: ..."`). Deriving the directory from the log needs no new argument: `review-round` already passes `<round dir>/findings.jsonl`. `review-round` reads `<round dir>/e2e/verdict.md` for `round.md`; `close` and `spec-conformance` read the latest results, the `verdict.md` modified last among `.bdk/runs/<change>/e2e/` and `review/round-*/e2e/` (one Glob, which lists newest first). The fixture `tally-reviewed.sh` moves its E2E files into `review/round-1/e2e/`, and the grader `auto-review-first-round/graders/e2e-ran.md` points there.

Scripts, `storageState` files and the raw video directory stay in the scratch directory `.bdk/runs/<change>/e2e-scratch.XXXXXX`, removed at step 6 with `rm -rf`. It was `/tmp` in the first draft; task 3.5 showed that Claude Code asks for every `rm` and every write outside the working directory, whatever the allow rules say, while under the ignored `.bdk/runs/` the skill's `allowed-tools` cover them (Measurements).

Alternatives: `openspec/changes/<change>/e2e/`, committed and archived with the Change - lost: videos and screenshots in git, and the evidence would be split from the review reports, which stay in `.bdk/runs/`. An explicit `--out <dir>` argument - lost: one more argument every caller must pass right, while the log already says which round it is. Keep one `e2e/` per Change - lost: a later round destroys the evidence of an earlier round's findings. `E2E/<scenario>/` subdirectories - lost: only tidier, and every reader uses the flat names. Keep the scripts as evidence - lost, user decision 3.

### D7. `allowed-tools` of `e2e-check`

Remove the axi entry; add `Bash(node *)`, `Bash(npm install --prefix .bdk/runs/*)` and `Bash(rm -rf .bdk/runs/*)`. The agent `bdk:e2e-tester` denies only `Edit` and `NotebookEdit`, so no agent change is planned; task 3 checks in a `claude -p --permission-mode default` run that no driver call asks for permission, and adds what is missing.

### D8. Config enum and setup

The enum becomes `["playwright", "chrome-devtools-mcp"]`; the field doc comment says absent means `playwright`. It is a breaking removal (commit `!`, `BREAKING CHANGE:`), with no published config affected (#213).

`/bdk:setup` stops writing `browser`. Writing `chrome-devtools-mcp` from `.mcp.json` made sense when the default was axi; now it would switch a project with that server to the tool that cost 113k against 60k tokens in the measurement. The report names the opt-in instead (user confirmed).

Setup verifies Playwright for each `browser` item and installs it with the user's consent:

1. Detect: `@playwright/test` or `playwright` in the dependencies of the web app's package; a browser with one `node -e` command (granted as `Bash(node -e *)`) that lists the `chromium-*` and `chromium_headless_shell-*` builds in Playwright's cache (`PLAYWRIGHT_BROWSERS_PATH`, else `~/Library/Caches/ms-playwright` on macOS, `~/.cache/ms-playwright` on Linux, `%LOCALAPPDATA%\ms-playwright` on Windows) and the system Chrome at its usual paths. A Glob cannot reach the user's home directory reliably, and the headless build is the one Playwright launches by default (Measurements, task 1.1).
2. Ask, in the existing single `AskUserQuestion` round (step 3), only when something is missing and the package is a Node package: "Install Playwright for the E2E tester?", recommended first: install `@playwright/test@1.63.0` (and Chromium); second: do not install, the tester installs Playwright per run. The question counts toward the 4-question limit; when the round is full, the Playwright question goes first among the E2E ones, since it changes every browser run.
3. On yes: `<pm> add -D @playwright/test@1.63.0` (`pnpm add -D`, `npm install -D`, `yarn add -D`, `bun add -d`, in the web app's package of a workspace), then, when no browser was found, `<pm> exec playwright install chromium`; check with `node -e "require.resolve('@playwright/test', {paths: ['<package dir>']})"`. A failed install is reported with its output and the per-run fallback; setup does not stop on it. `allowed-tools` of setup gains exactly these commands.
4. On no, or when it cannot ask (an eval run, `claude -p`): install nothing, as with deleting v2 files; the report names the command it would have run.
5. Report one line: `E2E browser: project Playwright <version>` or `E2E browser: Playwright 1.63.0 installed per run (add @playwright/test to use your own)`, plus `npx -y playwright@1.63.0 install chromium` when no browser is at hand.

A non-Node web app (Django templates, Rails) gets no install question: adding a `package.json` to it is not setup's call; the tester's per-run install covers it.

Alternatives: report only, never install - lost, the user asked that setup make Playwright present (with consent). Install without asking - lost: it changes the project's dependencies and lockfile, which the user reviews. Install the browser with `npx -y playwright@1.63.0 install chromium` regardless of the project's version - lost: the project's own Playwright must install the Chromium build it expects.

### D9. Fixtures and eval cases

- `fixtures/click-counter.sh` stays the broken-scenario fixture (acceptance 1); its expected result gains `add-one.webm`.
- New `fixtures/web-hard-defects.sh`: a dependency-free Node server and one page with three scenarios of one Change - the narrow-viewport cover, the 2-second `Could not save` message, the double order - each broken as the spec delta's scenarios describe, plus one passing scenario so a blanket `fail` is caught. `evals/fixtures/` gets a `ground-truth` comment in the script naming each defect.
- Task 1 probes whether the eval sandbox of the pinned Claude Code (2.1.292, and the newest version at least two weeks old) can bind a local port and launch a headless Chromium. When both work, the fixtures become `e2e-check-web-broken` and `e2e-check-web-hard-defects` block cases with regex graders on the scenario files and `file_exists` on the video. When either fails, they stay manual checks in `evals/README.md`, run 3 times each with the results recorded under "Measurements"; the acceptance signal's "eval" then reads as these recorded runs, as #194 did. The `Port taken` and `No browser` paths stay unit-free: they are prose in the skill and checked in the manual runs.
- `setup-web-app` keeps its graders (`no-browser-field` now matches any `browser:` line) and gains one on the reply naming the project's Playwright. The new `setup-web-no-playwright` case scaffolds a Vite app without Playwright; an eval run cannot ask (`AskUserQuestion` is not available), so it grades the "Cannot ask" path: `package.json` unchanged, the reply names the install it would have made and the per-run Playwright, and the settings name no `chrome-devtools-axi`. The "Install accepted" path is tried by hand in a test project (task 4.3).

## Risks / Trade-offs

- [The replay doubles the browser time of each scenario] → measured in task group 6; if tokens grow over +30%, the replay script reuses the exploration's last script as its base, and the number is recorded either way.
- [`node *` is a broad grant inside the skill] → the tester's prompt limits writes to `E2E/`, the log and the scratch directory, and the agent cannot `Edit`; the alternative (a fixed script path) would need a shipped script the agent cannot shape to the page.
- [`npm install` needs the network on a first run] → the npm cache serves repeats; offline with an empty cache the install fails and the run is `BLOCKED` with that reason, like a missing browser.
- [System Chrome drifts from the pinned Playwright] → only a fallback; a launch or protocol error there is `BLOCKED` with the install command, not a product finding.
- [#245 changes `/bdk:setup` too] → rebase on it if it merges first; this Change touches the `browser` paragraph of `references/e2e.md`, step 3's question list, `allowed-tools`, step 9's report and the eval cases.
- [The install question can crowd out another E2E question in the 4-question round] → it is asked first only among E2E questions; a rare overflow takes the recommended answer for the rest and names it in the report, as today.

## Migration Plan

No released v3 config exists (#213). A local `.bdk/settings.yaml` with `browser: chrome-devtools-axi` fails `bdk config check` with the allowed values; deleting the line gives Playwright. Rollback is a revert of the one commit.

## Measurements

### Eval sandbox probe (task 1.1)

A throw-away case (deleted after the run) ran `node probe.mjs` with the grant `Bash(node *)`, Claude Code 2.1.292 (the pinned version; no newer release is two weeks old), clean `HOME`, one run, $0.20:

- Bind: `listen EPERM: operation not permitted 127.0.0.1:5181`, as measured in #194.
- Launch: `chromium.launch()` looked for the browser under the run's own `HOME` (`<run>/home/Library/Caches/ms-playwright/chromium_headless_shell-1243/...`) and found none; `channel: 'chrome'` failed with `Failed to create a ProcessSingleton for your profile directory`.

Both fail, so the browser fixtures stay manual checks in `evals/README.md` (design D9), and the acceptance runs of task 6.1 are recorded here. Found on the way: Playwright 1.63.0 launches headless through `chromium_headless_shell-1243`, and `recordVideo` needs `ffmpeg-1011`; `playwright install chromium` installs all three, so setup's browser check looks for `chromium_headless_shell-*` or `chromium-*`, and a run without ffmpeg (system Chrome only) has no video, which the scenario file says.

### Baseline: the axi driver before this Change (task 3.1)

One `claude -p` run per fixture (Claude Code 2.1.292, `--model sonnet`, `--permission-mode auto`, clean `HOME`, the skill as on `staging/v3`); the main thread started `bdk:e2e-tester`. Tester numbers from its last `task_progress` event:

| Fixture | Result | Tester tokens | Tool uses | Tester time | Run cost | Video |
|---|---|---|---|---|---|---|
| `click-counter.sh` | `Add one` fail, `Starts at zero` pass (right) | 41k | 23 (14 axi) | 105 s | $0.38 | none |
| `web-hard-defects.sh` | 3 defects fail, `No orders yet` pass (right) | 41k | 22 (15 axi) | 125 s | $0.40 | none |

What fails today against the new specs: no video under `## Evidence`, and the driver is `chrome-devtools-axi`. In `click-counter` the `bdk-e2e` session could not select a page in the sandbox and the tester switched to its own session name `bdk-e2e2`, outside the form `allowed-tools` grants. The hard defects did not trip axi on this small page: it read the page after each action through its snapshot, which is what decision D5 of this design asks of the Playwright driver.

### Playwright driver trials (task 3.4)

Same setup as the baseline, the skill after task 3.3. In these runs the main thread ran the skill itself instead of starting `bdk:e2e-tester`, so the numbers are the whole run (task 6.1 measures the agent):

| Run | Result | Tool calls | Time | Cost | Evidence |
|---|---|---|---|---|---|
| `click-counter`, no project Playwright (1.63.0 installed per run) | right | 7 | 31 s | $0.20 | png + webm per scenario |
| `web-hard-defects`, no project Playwright | right: 3 defects `fail` (two orders; `Could not save` with the 503; `<div id="help"> intercepts pointer events`), `No orders yet` `pass` | 8 | 60 s | $0.26 | png + webm per scenario |
| `click-counter`, `@playwright/test` 1.63.0 in the project | right; `require.resolve` found it, no per-run install | 7 | 34 s | $0.19 | png + webm |
| `click-counter`, Playwright's browser cache hidden | right; `channel: 'chrome'` after `Executable doesn't exist` | 8 | 45 s | $0.21 | png; `no video: ffmpeg missing; npx -y playwright@1.63.0 install chromium` |

In every run `git status` of the project stayed clean and the scratch directory was gone. Fixed on the way: in two runs the tester started the product with `(npm start > /tmp/... &)` instead of `run_in_background`; step 3 of `SKILL.md` now says never `&` or `nohup`. Not tried: no browser at all, since the system Chrome of this machine cannot be hidden without admin rights; the `BLOCKED` path is prose in `drivers.md`, the same as the other environment stops.

### Permissions in the default mode (task 3.5)

`claude -p --permission-mode default --allowedTools Skill` on `click-counter`, with the rules `/bdk:setup` writes passed through `--settings` (in `-p` the project's own `.claude/settings.json` is ignored until the workspace is trusted). Each denial is a prompt a user would see:

1. Scratch directory in `/tmp`: Claude Code asks for every `rm` and every write outside the working directory, allow rule or not (probe: `Bash(rm -rf /tmp/bdk-e2e.*)` allowed, `rm -rf /tmp/bdk-e2e.probe1` still denied). Fix: the scratch directory moved to `.bdk/runs/<change>/e2e-scratch.XXXXXX` (design D6).
2. Then 6 denials: compound commands (`ls ...; find ...; cat ...`, `curl ...; mkdir ...; mktemp ...`), `mkdir -p` with no rule, and `rm -rf` with an absolute path. Fix: `SKILL.md` now says to read with Read, Glob and Grep, to run one command per call with paths under `.bdk/runs/` relative to the project root, and `allowed-tools` gained `Bash(mkdir -p .bdk/runs/*)`.
3. Rerun: no denial; `Verdict: FAIL` with `Add one` failed, png and webm per scenario, scratch directory gone.

### Setup with and without the install (task 4.3)

`AskUserQuestion` is not available in `claude -p` and there is no terminal driver on this machine, so the answer was given up front in the prompt (`/bdk:setup - if you would ask me whether to install Playwright, my answer is: ...`), on the `setup-web-no-playwright` project (pnpm, no Playwright), sonnet, `--permission-mode auto`. This runs the same branch of the skill (step 9 and its `allowed-tools`), not the question dialog itself.

- Yes (53 s): `pnpm add -D @playwright/test@1.63.0`, `pnpm exec playwright install chromium`, then `require.resolve` from the project; report `E2E browser: the project's Playwright (@playwright/test 1.63.0)`; no permission denial. pnpm itself warned `ERR_PNPM_IGNORED_BUILDS` for esbuild and wrote `pnpm-workspace.yaml`, both reported to the user.
- No (35 s): `package.json` unchanged; report `E2E browser: Playwright 1.63.0 installed by the tester for each run; to use your own, pnpm add -D @playwright/test@1.63.0`. It skipped the browser check after the "no"; `references/e2e.md` now says to detect whatever the answer.
- A web app that already has Playwright is the `setup-web-app` eval case.

### Acceptance through `bdk:e2e-tester` (task 6.1)

Prompt `Have the bdk:e2e-tester agent check change <change> end to end.` (the round run adds `; the findings log is .bdk/runs/add-counter/review/round-1/findings.jsonl`), Claude Code 2.1.292, sonnet, `--permission-mode auto`, no project Playwright (1.63.0 installed per run), the skill after tasks 3.3-3.5. Tester numbers from its last `task_progress` event:

| Run | Result | Findings | Tester tokens | Tool uses | Tester time | Run cost |
|---|---|---|---|---|---|---|
| `web-hard-defects` 1 | 3 defects `fail`, `No orders yet` `pass` | 3 | 44k | 28 | 99 s | $0.41 |
| `web-hard-defects` 2 | same | 3 | 43k | 31 | 82 s | $0.40 |
| `web-hard-defects` 3 | same | 3 | 42k | 31 | 121 s | $0.36 |
| `click-counter` alone | `Add one` `fail`, `Starts at zero` `pass`; files in `.bdk/runs/add-counter/e2e/` | 1 | 37k | 25 | 46 s | $0.29 |
| `click-counter` with a round log | same; files in `review/round-1/e2e/`, nothing in `.bdk/runs/add-counter/e2e/` | 1 | 37k | 22 | 52 s | $0.30 |

Every scenario has its video; the scratch directory is gone and `git status` is clean after each run. Against the axi baseline on the same fixtures (41k tokens, 22-23 tool uses, 105-125 s), Playwright with the recording replay costs about the same tokens (+3% on `web-hard-defects`, -10% on `click-counter`) and less time on `click-counter`, and adds the video; against the 60k of the DocFlow comparison it is lower because these fixtures are smaller. The replay stays inside the +30% target of D4.

Fixed after these runs: in `web-hard-defects` run 2 the replay of "Save profile on a narrow screen" stopped at the failed click before its screenshot, leaving only the video. `drivers.md` now puts the steps in a `try` and the THEN's screenshot in its `finally`.

### Eval suite (tasks 3a.3 and 4.3)

Claude Code 2.1.292, clean `HOME`, the git shell prefix of `evals/README.md`, `-j 4`, the grants of `evals/README.md` (the `setup-*` grants now include `Bash(node -e *)`):

| Cases | Runs | WITH | W/OUT | Cost |
|---|---|---|---|---|
| `setup-web-app`, `setup-web-no-playwright`, `setup-http-api`, `setup-node-cli`, `setup-library` | 3 per arm | 1.00 each | 0.00 each, 0.09 for `setup-web-no-playwright` | $7.85 |
| `e2e-check-cli-broken`, `e2e-check-no-e2e` | 1, one arm | 1.00 each | - | $0.55 |
| `spec-conformance-conforming` (reads `review/round-1/e2e/`), `-contradicted`, `-undocumented` | 1, one arm | 1.00 each | - | $1.24 |
| `close-conformance-fail`, `close-reviewed-change` | 1, one arm | 1.00 each | - | $0.99 |
| `auto-review-first-round` (`e2e-ran` on `review/round-1/e2e/verdict.md`) | 1, one arm | 1.00 | - | $0.93 |

The cases outside `setup-*` were a regression check of the moved E2E paths, so one run each.

### Found on the way: a flaky timeout test

`pnpm check` failed once on `plugins/bdk/tests/check.test.ts` "kills a command at its timeout": the check's output held `/bin/sh: line 1: <pid> Killed: 9 sleep 30`. On macOS a `SIGKILL` to the process group is not atomic, so the shell sometimes outlived its child long enough to report it. Measured 4 failures in 15 runs of that test; `shared/shell` now kills the shell before the group, and the same 15 runs had none. Not part of #267's scope, fixed because a flaky gate blocks every PR.

### Gates (task 6.2)

`pnpm check` (67 files, 1290 tests), `claude plugin validate` of the marketplace and of every plugin (`--strict`), `pnpm --filter @bdk/docs docs:build`, commitlint on the commit message, `openspec validate v3-267-e2e-playwright-driver --strict` and `openspec validate --specs --strict` (40 items): all pass.
