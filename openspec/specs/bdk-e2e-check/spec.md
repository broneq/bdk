# bdk-e2e-check Specification

## Purpose
Defines the `e2e-check` block of the `bdk` plugin and its agent `bdk:e2e-tester`: how BDK starts the product from `tools.e2e` and walks the scenarios of a Change as a user would, and what it leaves behind - evidence per scenario, a verdict, and one finding per broken scenario.

## Requirements

### Requirement: Block and agent

`e2e-check` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/e2e-check/`) that runs alone, in the main thread or in an agent, and `bdk:e2e-tester` SHALL be an agent of the plugin (`plugins/bdk/agents/e2e-tester.md`) that preloads it. The agent SHALL NOT have the `Edit` or `NotebookEdit` tools: the tester checks the product and never changes it. The block SHALL get the configuration from its own `bdk config show` block; in a project that is not configured, or whose configuration is invalid, it SHALL stop with the line that command prints and run nothing.

#### Scenario: Not configured

- **WHEN** `e2e-check` runs in a project without `.bdk/settings.yaml`
- **THEN** it starts no product, writes no file, and its reply says `BDK not configured: run /bdk:setup`

#### Scenario: Tester cannot edit

- **WHEN** the agent file `plugins/bdk/agents/e2e-tester.md` is read
- **THEN** its frontmatter preloads the skill `e2e-check` and denies `Edit` and `NotebookEdit`

### Requirement: Input and scenarios

The block SHALL take the name of a Change and, optionally, the path of a findings log. Without a Change name it SHALL use the only Change under `openspec/changes/` other than `archive/`, and stop asking for the name when there are several. Its E2E directory, where it writes the scenario files, the screenshots, the videos and `verdict.md`, SHALL be `e2e/` next to the findings log the caller named (a review round's log `.bdk/runs/<change>/review/round-<N>/findings.jsonl` gives `.bdk/runs/<change>/review/round-<N>/e2e/`), and `.bdk/runs/<change>/e2e/` without a named log, the log then being `.bdk/runs/<change>/e2e/findings.jsonl`. It SHALL read every `#### Scenario:` under the requirements of the Change's spec deltas (`openspec/changes/<change>/specs/**/spec.md`) and decide for each whether a user can observe it through a `tools.e2e` entry. A scenario that no entry reaches (an internal rule, a code structure, a file a test checks) SHALL be listed as `not-driven` with the reason, and SHALL NOT be a finding.

#### Scenario: Internal scenario

- **WHEN** a Change holds a scenario about the shape of a module's exports and a `tools.e2e` entry `cli`
- **THEN** the verdict lists that scenario as `not-driven` with a reason, and no finding names it

#### Scenario: Evidence of a review round

- **WHEN** `e2e-check` runs for Change `c` with the findings log `.bdk/runs/c/review/round-2/findings.jsonl`, and round 1 left its evidence in `.bdk/runs/c/review/round-1/e2e/`
- **THEN** the scenario files, their screenshots and videos and `verdict.md` are in `.bdk/runs/c/review/round-2/e2e/`, and the files of `round-1/e2e/` are unchanged

#### Scenario: Run alone

- **WHEN** `e2e-check` runs for Change `c` with no findings log
- **THEN** its files are in `.bdk/runs/c/e2e/` and its findings in `.bdk/runs/c/e2e/findings.jsonl`

### Requirement: Start, ready and stop

For each `tools.e2e` entry the scenarios need, the block SHALL run `start` with the entry's `env`, then wait for `ready`: a URL until it answers with a status below 500, a command until it exits 0, for at most 120 seconds. For `driver: cli`, `start` SHALL run to its end before `ready`. For `browser` and `http`, `start` SHALL run in the background, and when the `ready` URL answers before `start` ran, the block SHALL NOT drive that foreign process: it SHALL report the entry blocked by the environment. A `start` that fails, or a `ready` that does not pass in time, SHALL be one finding for the entry with the output that shows why, and every scenario of that entry SHALL be `blocked`. Before it returns, the block SHALL stop every process it started and close the browser session it opened.

#### Scenario: Product does not start

- **WHEN** the `start` command of entry `web` exits 1 with a compile error
- **THEN** the log holds one `e2e-check` finding naming entry `web` and the error, each scenario of that entry is `blocked`, and no background process of the block runs after it returns

#### Scenario: Port taken

- **WHEN** the `ready` URL of entry `api` answers before the block ran `start`
- **THEN** the block drives no scenario of `api`, writes `Verdict: BLOCKED` naming the port, and adds no finding

### Requirement: Drive scenarios as a user

The block SHALL walk each drivable scenario through the entry's driver, the way a user of that product would, and compare what the product shows with the scenario's THEN:

- `cli`: run the product's commands in a fresh scratch directory outside the project, so the run leaves the project tree unchanged; for a Claude Code plugin entry (its `ready` runs `claude plugin validate`), a user's action is a Claude Code session in that directory, `claude -p "<what the user types>" --plugin-dir <absolute plugin directory>`, and what the product shows is the session's reply and the files it left there;
- `http`: send requests to the running product and read status, headers and body;
- `browser`: drive a browser interactively - read the page, act, read the page again - through the tool the entry's `browser` field names: `playwright` (also when the field is absent), driven by small scripts the block writes, runs and reads one at a time, or `chrome-devtools-mcp`, the Chrome DevTools MCP server the project or the user configured. When that server is not available, the block SHALL say so in the scenario file and use `playwright`.

The block SHALL NOT write test files or change product files; it SHALL write only in its E2E directory, the findings log and a scratch directory under `.bdk/runs/<change>/` that it removes before it returns.

#### Scenario: Broken scenario reported

- **WHEN** the Change's spec says `tally total` prints `0` for an empty ledger, the CLI prints `NaN`, and `e2e-check` runs for that Change
- **THEN** the findings log holds a `finding` with source `e2e-check` whose summary names that scenario, the scenario file says `Result: fail` with the command and its output, and the verdict is `FAIL`

#### Scenario: Working scenario passes

- **WHEN** the CLI prints the total the scenario expects
- **THEN** that scenario's file says `Result: pass` with the command and its output, and no finding names it

#### Scenario: Plugin scenario driven through a session

- **WHEN** an entry `plugin` has `ready: claude plugin validate plugins/demo` and a scenario says that `/demo:greet` replies with a greeting
- **THEN** the scenario file names a `claude -p` command with `--plugin-dir` set to the absolute path of `plugins/demo`, run in a scratch directory, and the session's reply

#### Scenario: Browser-only defect

- **WHEN** a web entry serves a page whose button the scenario says increments a counter, the HTTP responses are all 200, and the click changes nothing on the page
- **THEN** the block finds it by driving the page in a browser and adds a finding for that scenario

#### Scenario: MCP server not available

- **WHEN** the entry has `browser: chrome-devtools-mcp` and the session has no Chrome DevTools MCP tool
- **THEN** each browser scenario file says the server was not available and Playwright was used, and the scenarios are driven with Playwright

#### Scenario: Nothing left in the project

- **WHEN** the block has driven a browser scenario with Playwright
- **THEN** `git status` of the project shows no file outside `.bdk/runs/`, and the scripts it wrote are gone

### Requirement: Playwright driver

For a `browser` entry driven with Playwright, the block SHALL use the project's own Playwright (`@playwright/test` or `playwright`) when it resolves from the project root, and otherwise Playwright 1.63.0 installed for the run into the scratch directory. It SHALL launch the browser that Playwright installed, and the system Chrome when that one is missing. When neither starts, every scenario of the entry SHALL be `blocked`, the verdict SHALL be `Verdict: BLOCKED`, and the reason SHALL name the install command `npx -y playwright@1.63.0 install chromium`; no finding SHALL be added for it.

The block SHALL read the page right after each action and before each THEN is judged, so that what a user sees for a moment counts. It SHALL use the viewport and the timing the scenario names, collect the console errors and the HTTP responses with status 400 or above of each scenario, and report an error among them that no scenario covers as a defect outside the scenarios. When a scenario moves between accounts, it MAY give each actor its own browser context: a default to consider, not a rule. After exploring a scenario, it SHALL replay it once from a fresh context while recording the video and the screenshots; that replay SHALL decide the scenario's result, so a `fail` is reproduced twice before it is reported. A CAPTCHA or other bot protection SHALL make the scenario `blocked`, unless the project's own instructions say how to pass it.

#### Scenario: Control covered on a narrow viewport

- **WHEN** a scenario says that on a 375 px wide screen the user taps "Save" and sees `Saved`, and at that width a fixed footer covers the button so a tap hits the footer
- **THEN** the scenario is `fail` with the covering element named under `## Observed`, and a finding names it

#### Scenario: Message that disappears

- **WHEN** a scenario says that after "Save" the page shows `Saved`, and the product shows `Could not save` for about 2 seconds, then hides it and leaves the page looking saved
- **THEN** the scenario is `fail` with `Could not save` under `## Observed`, and a finding names it

#### Scenario: Two quick clicks

- **WHEN** a scenario says that clicking "Place order" twice in quick succession creates one order, and the product creates two
- **THEN** the scenario is `fail` with the two orders under `## Observed`, and a finding names it

#### Scenario: No browser

- **WHEN** the project has no Playwright, Playwright 1.63.0 has no browser installed, and no system Chrome is found
- **THEN** the entry's scenarios are `blocked`, `e2e/verdict.md` starts with `Verdict: BLOCKED` and names `npx -y playwright@1.63.0 install chromium`, and no finding is added

#### Scenario: Project's own Playwright

- **WHEN** `@playwright/test` resolves from the project root
- **THEN** the block drives the scenarios with that package and installs no other Playwright

### Requirement: Evidence files

For each scenario the block SHALL write `<scenario>.md` in its E2E directory, `<scenario>` being the scenario name in kebab-case, whose first line is `Result: pass`, `Result: fail`, `Result: blocked` or `Result: not-driven`, followed by the requirement and scenario names, the entry used, the steps taken with what the product showed at each check, the expected outcome, and, for a browser scenario, an `## Evidence` section listing the screenshots and the video it saved next to the file: a screenshot at each THEN, `<scenario>-<n>.png`, and one video of the scenario, `<scenario>.webm` (`<scenario>-<actor>.webm` per actor when the scenario uses several browser contexts). When Playwright cannot record (its ffmpeg is not installed, as with the system Chrome alone), `## Evidence` SHALL say so and name `npx -y playwright@<version> install chromium`, and the scenario is judged from what the replay read and the screenshots. It SHALL write `verdict.md` there, whose first line is `Verdict: PASS` (every driven scenario passed), `Verdict: FAIL` (at least one failed or is blocked by the product), `Verdict: SKIPPED` (nothing to run) or `Verdict: BLOCKED` (only the environment stopped it), followed by one line per scenario with its result and file. A later run into the same E2E directory SHALL replace these files.

#### Scenario: Verdict index

- **WHEN** a Change has three scenarios, two driven and passed and one `not-driven`
- **THEN** `e2e/verdict.md` starts with `Verdict: PASS` and lists the three scenarios with their results and files

#### Scenario: Broken browser scenario with video

- **WHEN** the scenario `Add one` of a web entry without a `browser` field fails because the click changes nothing
- **THEN** `e2e/add-one.md` starts with `Result: fail`, its `## Evidence` lists `add-one-1.png` and `add-one.webm`, both files exist next to it and are not empty, and the log holds one `e2e-check` finding for `Add one`

### Requirement: Findings

Each failed scenario SHALL be one finding, appended with `bdk findings add <log> --source e2e-check`, with a summary naming the scenario and what broke, `--file` and `--line` pointing at the scenario's heading in the spec delta, and `--evidence` naming the scenario file and the observed against the expected outcome. The log SHALL be the one the caller named, else `.bdk/runs/<change>/e2e/findings.jsonl`. A defect the tester sees while driving that breaks no scenario (a crash, an error page, an error in the browser console) MAY be a finding without `--file`. The block SHALL NOT set a level or a decision; that belongs to the judge and to triage.

#### Scenario: Finding points at the spec

- **WHEN** the scenario `Empty ledger` at line 12 of `openspec/changes/c/specs/tally/spec.md` fails
- **THEN** `bdk findings list <log>` shows one finding from `e2e-check` with file `openspec/changes/c/specs/tally/spec.md`, line 12, and no level

### Requirement: Skipped without an E2E entry

When the resolved configuration has no `tools.e2e` item, the block SHALL start nothing, add no finding, write `e2e/verdict.md` with `Verdict: SKIPPED` and the reason (`no tools.e2e entry`, with `/bdk:setup` to add one), and say in its reply that E2E was skipped and why. A Change without scenarios SHALL be skipped the same way, with that reason.

#### Scenario: No tools.e2e

- **WHEN** `e2e-check` runs for a Change in a project whose configuration has no `tools.e2e` item
- **THEN** `e2e/verdict.md` starts with `Verdict: SKIPPED` and names the missing entry, no finding is added, and the reply says E2E was skipped

### Requirement: Reply to the caller

The block SHALL end with a short reply: the verdict line, the count of scenarios per result, the number of findings added with the log path, and the path of `e2e/verdict.md`. It SHALL NOT repeat the scenario files in the reply.

#### Scenario: Short reply

- **WHEN** `bdk:e2e-tester` finishes a Change with one failed scenario
- **THEN** its reply starts with `Verdict: FAIL`, gives the counts and one finding, and names `e2e/verdict.md`
