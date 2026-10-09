## MODIFIED Requirements

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
