## MODIFIED Requirements

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

### Requirement: Drive scenarios as a user

The block SHALL walk each drivable scenario through the entry's driver, the way a user of that product would, and compare what the product shows with the scenario's THEN:

- `cli`: run the product's commands in a fresh scratch directory outside the project, so the run leaves the project tree unchanged;
- `http`: send requests to the running product and read status, headers and body;
- `browser`: drive a browser interactively - read the page, act, read the page again - through the tool the entry's `browser` field names: `playwright` (also when the field is absent), driven by small scripts the block writes, runs and reads one at a time, or `chrome-devtools-mcp`, the Chrome DevTools MCP server the project or the user configured. When that server is not available, the block SHALL say so in the scenario file and use `playwright`.

The block SHALL NOT write test files or change product files; it SHALL write only in its E2E directory, the findings log and a scratch directory under `.bdk/runs/<change>/` that it removes before it returns.

#### Scenario: Broken scenario reported

- **WHEN** the Change's spec says `tally total` prints `0` for an empty ledger, the CLI prints `NaN`, and `e2e-check` runs for that Change
- **THEN** the findings log holds a `finding` with source `e2e-check` whose summary names that scenario, the scenario file says `Result: fail` with the command and its output, and the verdict is `FAIL`

#### Scenario: Working scenario passes

- **WHEN** the CLI prints the total the scenario expects
- **THEN** that scenario's file says `Result: pass` with the command and its output, and no finding names it

#### Scenario: Browser-only defect

- **WHEN** a web entry serves a page whose button the scenario says increments a counter, the HTTP responses are all 200, and the click changes nothing on the page
- **THEN** the block finds it by driving the page in a browser and adds a finding for that scenario

#### Scenario: MCP server not available

- **WHEN** the entry has `browser: chrome-devtools-mcp` and the session has no Chrome DevTools MCP tool
- **THEN** each browser scenario file says the server was not available and Playwright was used, and the scenarios are driven with Playwright

#### Scenario: Nothing left in the project

- **WHEN** the block has driven a browser scenario with Playwright
- **THEN** `git status` of the project shows no file outside `.bdk/runs/`, and the scripts it wrote are gone

### Requirement: Evidence files

For each scenario the block SHALL write `<scenario>.md` in its E2E directory, `<scenario>` being the scenario name in kebab-case, whose first line is `Result: pass`, `Result: fail`, `Result: blocked` or `Result: not-driven`, followed by the requirement and scenario names, the entry used, the steps taken with what the product showed at each check, the expected outcome, and, for a browser scenario, an `## Evidence` section listing the screenshots and the video it saved next to the file: a screenshot at each THEN, `<scenario>-<n>.png`, and one video of the scenario, `<scenario>.webm` (`<scenario>-<actor>.webm` per actor when the scenario uses several browser contexts). When Playwright cannot record (its ffmpeg is not installed, as with the system Chrome alone), `## Evidence` SHALL say so and name `npx -y playwright@<version> install chromium`, and the scenario is judged from what the replay read and the screenshots. It SHALL write `verdict.md` there, whose first line is `Verdict: PASS` (every driven scenario passed), `Verdict: FAIL` (at least one failed or is blocked by the product), `Verdict: SKIPPED` (nothing to run) or `Verdict: BLOCKED` (only the environment stopped it), followed by one line per scenario with its result and file. A later run into the same E2E directory SHALL replace these files.

#### Scenario: Verdict index

- **WHEN** a Change has three scenarios, two driven and passed and one `not-driven`
- **THEN** `e2e/verdict.md` starts with `Verdict: PASS` and lists the three scenarios with their results and files

#### Scenario: Broken browser scenario with video

- **WHEN** the scenario `Add one` of a web entry without a `browser` field fails because the click changes nothing
- **THEN** `e2e/add-one.md` starts with `Result: fail`, its `## Evidence` lists `add-one-1.png` and `add-one.webm`, both files exist next to it and are not empty, and the log holds one `e2e-check` finding for `Add one`

## ADDED Requirements

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
