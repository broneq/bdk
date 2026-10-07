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

The block SHALL take the name of a Change and, optionally, the path of a findings log. Without a Change name it SHALL use the only Change under `openspec/changes/` other than `archive/`, and stop asking for the name when there are several. It SHALL read every `#### Scenario:` under the requirements of the Change's spec deltas (`openspec/changes/<change>/specs/**/spec.md`) and decide for each whether a user can observe it through a `tools.e2e` entry. A scenario that no entry reaches (an internal rule, a code structure, a file a test checks) SHALL be listed as `not-driven` with the reason, and SHALL NOT be a finding.

#### Scenario: Internal scenario

- **WHEN** a Change holds a scenario about the shape of a module's exports and a `tools.e2e` entry `cli`
- **THEN** the verdict lists that scenario as `not-driven` with a reason, and no finding names it

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

- `cli`: run the product's commands in a fresh scratch directory outside the project, so the run leaves the project tree unchanged;
- `http`: send requests to the running product and read status, headers and body;
- `browser`: drive a browser interactively - read the page, act, read the page again - through the tool the entry's `browser` field names: `chrome-devtools-axi` (also when the field is absent), run through Bash, or `chrome-devtools-mcp`, the Chrome DevTools MCP server the project or the user configured. When that server is not available, the block SHALL say so in the scenario file and use `chrome-devtools-axi`.

The block SHALL NOT write test files or change product files; it SHALL write only under `.bdk/runs/<change>/e2e/` and the findings log.

#### Scenario: Broken scenario reported

- **WHEN** the Change's spec says `tally total` prints `0` for an empty ledger, the CLI prints `NaN`, and `e2e-check` runs for that Change
- **THEN** the findings log holds a `finding` with source `e2e-check` whose summary names that scenario, the scenario file says `Result: fail` with the command and its output, and the verdict is `FAIL`

#### Scenario: Working scenario passes

- **WHEN** the CLI prints the total the scenario expects
- **THEN** that scenario's file says `Result: pass` with the command and its output, and no finding names it

#### Scenario: Browser-only defect

- **WHEN** a web entry serves a page whose button the scenario says increments a counter, the HTTP responses are all 200, and the click changes nothing on the page
- **THEN** the block finds it by driving the page in a browser and adds a finding for that scenario

### Requirement: Evidence files

For each scenario the block SHALL write `.bdk/runs/<change>/e2e/<scenario>.md`, `<scenario>` being the scenario name in kebab-case, whose first line is `Result: pass`, `Result: fail`, `Result: blocked` or `Result: not-driven`, followed by the requirement and scenario names, the entry used, the steps taken with what the product showed at each check, the expected outcome, and, for a browser, the paths of the screenshots it saved next to the file. It SHALL write `.bdk/runs/<change>/e2e/verdict.md`, whose first line is `Verdict: PASS` (every driven scenario passed), `Verdict: FAIL` (at least one failed or is blocked by the product), `Verdict: SKIPPED` (nothing to run) or `Verdict: BLOCKED` (only the environment stopped it), followed by one line per scenario with its result and file. A later run SHALL replace these files.

#### Scenario: Verdict index

- **WHEN** a Change has three scenarios, two driven and passed and one `not-driven`
- **THEN** `e2e/verdict.md` starts with `Verdict: PASS` and lists the three scenarios with their results and files

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
