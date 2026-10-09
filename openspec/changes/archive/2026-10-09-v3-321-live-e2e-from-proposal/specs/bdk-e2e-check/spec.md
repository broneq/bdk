## ADDED Requirements

### Requirement: Input and user processes

The block SHALL take the name of a Change and, optionally, the path of a findings log. Without a Change name it SHALL use the only Change under `openspec/changes/` other than `archive/`, and stop asking for the name when there are several. Its E2E directory, where it writes the path files, the screenshots, the videos and `verdict.md`, SHALL be `e2e/` next to the findings log the caller named (a review round's log `.bdk/runs/<change>/review/round-<N>/findings.jsonl` gives `.bdk/runs/<change>/review/round-<N>/e2e/`), and `.bdk/runs/<change>/e2e/` without a named log, the log then being `.bdk/runs/<change>/e2e/findings.jsonl`.

The block SHALL derive what it drives from the Change's `proposal.md`: it SHALL list the user processes the proposal adds or changes, a process being one goal a user sets out to reach and sees the result of, named in kebab-case after that goal. It SHALL read `design.md` and the spec deltas (`openspec/changes/<change>/specs/**/spec.md`) only to make the expected outcomes exact, and SHALL NOT drive the spec scenarios one by one: the project's own tests prove them. A proposal line that changes nothing a user does (a refactor, a module, a test, a dependency) SHALL be listed in `verdict.md` under `## Not a user process` with its line and reason, SHALL NOT be driven and SHALL NOT be a finding. A process whose interface no `tools.e2e` entry reaches SHALL be listed with one `main` path `not-driven` and the reason, and SHALL NOT be a finding.

#### Scenario: Internal proposal line

- **WHEN** the proposal of a Change says on line 8 that amount parsing moves into one module, and on line 7 that a new command `tally total` prints the sum
- **THEN** `verdict.md` lists line 8 under `## Not a user process` with a reason, drives a process from line 7, and no finding names line 8

#### Scenario: Promise only the proposal makes

- **WHEN** the proposal says `tally total --json` prints the total as JSON, no spec delta mentions `--json`, and the product ignores the flag
- **THEN** a path of the total process drives `tally total --json`, its file starts with `Result: fail`, and a finding points at that proposal line

#### Scenario: Evidence of a review round

- **WHEN** `e2e-check` runs for Change `c` with the findings log `.bdk/runs/c/review/round-2/findings.jsonl`, and round 1 left its evidence in `.bdk/runs/c/review/round-1/e2e/`
- **THEN** the path files, their screenshots and videos and `verdict.md` are in `.bdk/runs/c/review/round-2/e2e/`, and the files of `round-1/e2e/` are unchanged

#### Scenario: Run alone

- **WHEN** `e2e-check` runs for Change `c` with no findings log
- **THEN** its files are in `.bdk/runs/c/e2e/` and its findings in `.bdk/runs/c/e2e/findings.jsonl`

### Requirement: Drive paths as a user

For each user process the block SHALL drive at most 5 paths, with no cap over the whole Change: one `main` path, the process as the proposal describes it; variants, other states or inputs that the proposal, the design or a delta names or that a user plainly meets; and at least one `break` path that tries to break the process (wrong input, wrong order, a repeated, quick or interrupted action, a missing precondition). Each path SHALL name the proposal line it comes from. Its expected outcome SHALL come from the proposal, made exact by the design or a delta when they state it; a `break` path whose outcome none of them states SHALL pass only when the product refuses or handles it visibly (a message that names the problem; a non-zero exit, a status of 400 to 499, or an error shown on the page), shows no crash or stack trace, loses or corrupts no data, and still works for the next action.

The block SHALL walk each path through the entry's driver, the way a user of that product would, and compare what the product shows with the expected outcome:

- `cli`: run the product's commands in a fresh scratch directory outside the project, so the run leaves the project tree unchanged; for a Claude Code plugin entry (its `ready` runs `claude plugin validate`), a user's action is a Claude Code session in that directory, `claude -p "<what the user types>" --plugin-dir <absolute plugin directory>`, and what the product shows is the session's reply and the files it left there;
- `http`: send requests to the running product and read status, headers and body;
- `browser`: drive a browser interactively - read the page, act, read the page again - through the tool the entry's `browser` field names: `playwright` (also when the field is absent), driven by small scripts the block writes, runs and reads one at a time, or `chrome-devtools-mcp`, the Chrome DevTools MCP server the project or the user configured. When that server is not available, the block SHALL say so in the path file and use `playwright`.

The block SHALL NOT write test files or change product files; it SHALL write only in its E2E directory, the findings log and a scratch directory under `.bdk/runs/<change>/` that it removes before it returns.

#### Scenario: Broken path reported

- **WHEN** the proposal says `tally total` prints the sum of the ledger, the spec delta says it prints `Total: 0.00` for an empty ledger, the CLI exits 1 with `tally: no ledger here` in a directory where nothing was added, and `e2e-check` runs for that Change
- **THEN** a path of the total process with nothing added says `Result: fail` with the command and its output, the findings log holds a `finding` with source `e2e-check` naming that process and path, and the verdict is `FAIL`

#### Scenario: Paths of a process

- **WHEN** the proposal adds one process a user can drive through the `cli` entry
- **THEN** `verdict.md` lists for that process a `main` path, at least one `break` path and at most 5 paths in all, each with its proposal line

#### Scenario: Working path passes

- **WHEN** the CLI prints the total the proposal and the delta expect after two amounts were added
- **THEN** the `main` path file says `Result: pass` with the commands and their output, and no finding names it

#### Scenario: Break path without a stated outcome

- **WHEN** a `break` path runs `tally add abc`, nothing in the Change states what that does, and the CLI prints a stack trace
- **THEN** the path file says `Result: fail` with `Expected from: baseline` and the stack trace under `## Observed`, and a finding names that path

#### Scenario: Plugin path driven through a session

- **WHEN** an entry `plugin` has `ready: claude plugin validate plugins/demo` and the proposal says that `/demo:greet` replies with a greeting
- **THEN** the `main` path file names a `claude -p` command with `--plugin-dir` set to the absolute path of `plugins/demo`, run in a scratch directory, and the session's reply

#### Scenario: Browser-only defect

- **WHEN** a web entry serves a page whose button the proposal says increments a counter, the HTTP responses are all 200, and the click changes nothing on the page
- **THEN** the block finds it by driving the page in a browser and adds a finding for that path

#### Scenario: MCP server not available

- **WHEN** the entry has `browser: chrome-devtools-mcp` and the session has no Chrome DevTools MCP tool
- **THEN** each browser path file says the server was not available and Playwright was used, and the paths are driven with Playwright

#### Scenario: Nothing left in the project

- **WHEN** the block has driven a browser path with Playwright
- **THEN** `git status` of the project shows no file outside `.bdk/runs/`, and the scripts it wrote are gone

### Requirement: Path evidence files

For each path the block SHALL write `<process>--<path>.md` in its E2E directory, `<process>` being the process name and `<path>` `main` or what the path does, both in kebab-case. Its first line SHALL be `Result: pass`, `Result: fail`, `Result: blocked` or `Result: not-driven`, followed by the lines `Process:`, `Path:` with the path's kind (`main`, `variant` or `break`), `Proposal:` with the proposal file, line and text, and `Item:`, then the steps taken with what the product showed at each check, the expected outcome with where it came from (`Expected from:` a design or delta location, or `baseline`, when the proposal line alone does not state it), the observed outcome, and, for a browser path, an `## Evidence` section listing the screenshots and the video it saved next to the file: a screenshot at each expected outcome, `<process>--<path>-<n>.png`, and one video of the path, `<process>--<path>.webm` (`<process>--<path>-<actor>.webm` per actor when the path uses several browser contexts). When Playwright cannot record (its ffmpeg is not installed, as with the system Chrome alone), `## Evidence` SHALL say so and name `npx -y playwright@<version> install chromium`, and the path is judged from what the replay read and the screenshots.

It SHALL write `verdict.md` there, whose first line is `Verdict: PASS` (every driven path passed), `Verdict: FAIL` (at least one failed or is blocked by the product), `Verdict: SKIPPED` (nothing to run) or `Verdict: BLOCKED` (only the environment stopped it), followed by one `## <process>` section per process holding one line per path, `- <result>: <path> (<kind>, proposal.md:<line>) - <file>`, and a last section `## Not a user process` with one line per proposal line left out and its reason, or `- None.`. A later run into the same E2E directory SHALL replace these files.

#### Scenario: Verdict index

- **WHEN** a Change has one user process with three driven paths that pass, and one internal proposal line
- **THEN** `e2e/verdict.md` starts with `Verdict: PASS`, lists the three paths under the process heading with their results, kinds, proposal lines and files, and lists the internal line under `## Not a user process`

#### Scenario: Broken browser path with video

- **WHEN** the `main` path of the process `count-clicks` of a web entry without a `browser` field fails because the click changes nothing
- **THEN** `e2e/count-clicks--main.md` starts with `Result: fail`, its `## Evidence` lists `count-clicks--main-1.png` and `count-clicks--main.webm`, both files exist next to it and are not empty, and the log holds one `e2e-check` finding for that path

### Requirement: Findings at the proposal line

Each failed path SHALL be one finding, appended with `bdk findings add <log> --source e2e-check`, with a summary `<process> / <path>: <what the product did instead>`, `--file` and `--line` pointing at the proposal line the path comes from (`openspec/changes/<change>/proposal.md`), and `--evidence` naming the path file and the observed against the expected outcome. The log SHALL be the one the caller named, else `.bdk/runs/<change>/e2e/findings.jsonl`. A defect the tester sees while driving that breaks no path (a crash, an error page, an error in the browser console) MAY be a finding without `--file`. The block SHALL NOT set a level or a decision; that belongs to the judge and to triage.

#### Scenario: Finding points at the proposal

- **WHEN** a path traced to line 7 of `openspec/changes/c/proposal.md` fails
- **THEN** `bdk findings list <log>` shows one finding from `e2e-check` for that path with file `openspec/changes/c/proposal.md`, line 7, and no level

## MODIFIED Requirements

### Requirement: Start, ready and stop

For each `tools.e2e` entry the paths need, the block SHALL run `start` with the entry's `env`, then wait for `ready`: a URL until it answers with a status below 500, a command until it exits 0, for at most 120 seconds. For `driver: cli`, `start` SHALL run to its end before `ready`. For `browser` and `http`, `start` SHALL run in the background, and when the `ready` URL answers before `start` ran, the block SHALL NOT drive that foreign process: it SHALL report the entry blocked by the environment. A `start` that fails, or a `ready` that does not pass in time, SHALL be one finding for the entry with the output that shows why, and every path of that entry SHALL be `blocked`. Before it returns, the block SHALL stop every process it started and close the browser session it opened.

#### Scenario: Product does not start

- **WHEN** the `start` command of entry `web` exits 1 with a compile error
- **THEN** the log holds one `e2e-check` finding naming entry `web` and the error, each path of that entry is `blocked`, and no background process of the block runs after it returns

#### Scenario: Port taken

- **WHEN** the `ready` URL of entry `api` answers before the block ran `start`
- **THEN** the block drives no path of `api`, writes `Verdict: BLOCKED` naming the port, and adds no finding

### Requirement: Playwright driver

For a `browser` entry driven with Playwright, the block SHALL use the project's own Playwright (`@playwright/test` or `playwright`) when it resolves from the project root, and otherwise Playwright 1.63.0 installed for the run into the scratch directory. It SHALL launch the browser that Playwright installed, and the system Chrome when that one is missing. When neither starts, every path of the entry SHALL be `blocked`, the verdict SHALL be `Verdict: BLOCKED`, and the reason SHALL name the install command `npx -y playwright@1.63.0 install chromium`; no finding SHALL be added for it.

The block SHALL read the page right after each action and before each expected outcome is judged, so that what a user sees for a moment counts. It SHALL use the viewport and the timing the path calls for, collect the console errors and the HTTP responses with status 400 or above of each path, and report an error among them that no path covers as a defect outside the paths. When a path moves between accounts, it MAY give each actor its own browser context: a default to consider, not a rule. After exploring a path, it SHALL replay it once from a fresh context while recording the video and the screenshots; that replay SHALL decide the path's result, so a `fail` is reproduced twice before it is reported. A CAPTCHA or other bot protection SHALL make the path `blocked`, unless the project's own instructions say how to pass it.

#### Scenario: Control covered on a narrow viewport

- **WHEN** a path says that on a 375 px wide screen the user taps "Save" and sees `Saved`, and at that width a fixed footer covers the button so a tap hits the footer
- **THEN** the path is `fail` with the covering element named under `## Observed`, and a finding names it

#### Scenario: Message that disappears

- **WHEN** a path expects that after "Save" the page shows `Saved`, and the product shows `Could not save` for about 2 seconds, then hides it and leaves the page looking saved
- **THEN** the path is `fail` with `Could not save` under `## Observed`, and a finding names it

#### Scenario: Two quick clicks

- **WHEN** a `break` path clicks "Place order" twice in quick succession, the proposal says one click places one order, and the product creates two
- **THEN** the path is `fail` with the two orders under `## Observed`, and a finding names it

#### Scenario: No browser

- **WHEN** the project has no Playwright, Playwright 1.63.0 has no browser installed, and no system Chrome is found
- **THEN** the entry's paths are `blocked`, `e2e/verdict.md` starts with `Verdict: BLOCKED` and names `npx -y playwright@1.63.0 install chromium`, and no finding is added

#### Scenario: Project's own Playwright

- **WHEN** `@playwright/test` resolves from the project root
- **THEN** the block drives the paths with that package and installs no other Playwright

### Requirement: Skipped without an E2E entry

When the resolved configuration has no `tools.e2e` item, the block SHALL start nothing, read no proposal, add no finding, write `e2e/verdict.md` with `Verdict: SKIPPED` and the reason (`no tools.e2e entry`, with `/bdk:setup` to add one), and say in its reply that E2E was skipped and why. A Change whose proposal adds or changes no user process SHALL be skipped the same way, with the reason `the proposal changes nothing a user does` and the proposal lines under `## Not a user process`.

#### Scenario: No tools.e2e

- **WHEN** `e2e-check` runs for a Change in a project whose configuration has no `tools.e2e` item
- **THEN** `e2e/verdict.md` starts with `Verdict: SKIPPED` and names the missing entry, no finding is added, and the reply says E2E was skipped

#### Scenario: No user-visible change

- **WHEN** the proposal of a Change only moves code between modules and says nothing a user does changes
- **THEN** the block starts no product, `e2e/verdict.md` starts with `Verdict: SKIPPED` and says the proposal changes nothing a user does, and no finding is added

### Requirement: Reply to the caller

The block SHALL end with a short reply: the verdict line, the number of processes and the count of paths per result, the number of findings added with the log path, and the path of `e2e/verdict.md`. It SHALL NOT repeat the path files in the reply.

#### Scenario: Short reply

- **WHEN** `bdk:e2e-tester` finishes a Change with one failed path
- **THEN** its reply starts with `Verdict: FAIL`, gives the processes, the path counts and one finding, and names `e2e/verdict.md`

## REMOVED Requirements

### Requirement: Input and scenarios

**Reason**: The block derives user processes from the proposal instead of reading the spec scenarios (#317 D7); the project's own tests prove the scenarios.

**Migration**: Replaced by "Input and user processes".

### Requirement: Drive scenarios as a user

**Reason**: The block drives up to 5 paths per user process instead of each spec scenario.

**Migration**: Replaced by "Drive paths as a user".

### Requirement: Evidence files

**Reason**: Evidence is keyed by process and path instead of spec scenario.

**Migration**: Replaced by "Path evidence files": `<process>--<path>.md` instead of `<scenario>.md`.

### Requirement: Findings

**Reason**: A finding points at the proposal line its path comes from instead of a spec scenario heading.

**Migration**: Replaced by "Findings at the proposal line".
