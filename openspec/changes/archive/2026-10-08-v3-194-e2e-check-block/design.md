## Context

See proposal.md for why. What this Change builds on:

- `tools.e2e` items (`start`, `ready`, `driver`, `env`) in spec `bdk-cli/config` (#179), detected by `/bdk:setup` (#181, design D4 there).
- `bdk findings add|list` (#187, spec `bdk-cli/findings`): an append-only log, the CLI stamps the id, `source` names the writer (the spec's own example is `e2e-check`).
- The eval suite (#189, spec `skill-evals`): block cases run with and without the plugin; `bin/` is not on `PATH` in eval runs, so skills call `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`.
- Architecture: the block row "`e2e-check` | `bdk:e2e-tester` (sonnet) | Starts the product from `tools.e2e` and drives it as a user would, per spec scenario" ("Catalog"), the run file `<change>/e2e/<scenario>.md` ("Run state, run artifacts and resume"), E2E in every review round in parallel with the reviewers ("Review round"), "without an entry E2E is skipped and the report says so" ("Constraints & NFRs").
- D2 (the product's behaviour decides `blocker`) and D5 (interactive browser driving, `tools.e2e[].browser`) of the skills decisions.
- Inputs read, not copied: there is no E2E block in v2 (`main`) or draft 1 (`draft/v3-1`); v2 `debug` reproduces a bug "as an end user would", and draft 1's findings record why a product check is missing ("No product-level check during execute", "Evidence proves the agent's account, not the product").

Host facts used here (Claude Code 2.1.29x): plugin agents support `skills`, `tools`, `disallowedTools` and `model` and ignore `mcpServers` and `permissionMode` (plugins reference, "Agents"); an agent that omits `tools` inherits every tool of the session, MCP tools included; the host refused a subagent's Write to a file named like `report-1.md` ("Subagents should return findings as text"), while `e2e/<scenario>.md`-style names write fine (measured by the agent of #190).

## Goals / Non-Goals

**Goals:**

- A broken spec scenario in the running product becomes a finding (issue, "Acceptance signal").
- The block runs alone (main thread or `bdk:e2e-tester`), so a review round, `/bdk:debug` or a user can call it.
- Each step leaves a file the next reader needs: scenario evidence, a verdict, findings.

**Non-Goals:**

- Starting the tester in a review round, in parallel with the reviewers (`review-round`, #201) and levelling its findings (judge, #193).
- Running the project's own E2E test suite: that is a `tools.test` item run by `bdk check run`.
- Writing test scripts (Playwright specs and the like): D5 rejects scripted driving.
- A `bdk e2e` command: no eval or measurement shows a problem a command would solve (D8 below).

## Decisions

### D1. One skill, one agent that preloads it

`plugins/bdk/skills/e2e-check/SKILL.md` holds the process; `references/drivers.md` holds how to drive each driver and both browser tools, read only for the drivers a run needs. `plugins/bdk/agents/e2e-tester.md` (model `sonnet`, as the "Catalog" says) preloads it with `skills: [e2e-check]` and denies `Edit` and `NotebookEdit` with `disallowedTools`; it does not set `tools`, so it keeps the session's MCP tools, which `browser: chrome-devtools-mcp` needs. The skill is model-invocable so that a user's "check the change works as a user would" and an eval prompt fire it.

Alternatives: an allow list in `tools` - lost, an allow list drops MCP tools unless each is named, and the server's tool names depend on how the user named the server. A skill only, no agent - lost, the review round runs the tester in parallel with the reviewers, which needs an agent, and the architecture names `bdk:e2e-tester`. Denying `Write` too - lost, the tester writes its evidence files.

### D2. Input: a Change and an optional findings log

The caller names the Change and, in a review round, the round's log (`.bdk/runs/<change>/review/round-N/findings.jsonl`). Without a log the block uses `.bdk/runs/<change>/e2e/findings.jsonl`, so it runs alone and its findings still fold with `bdk findings list`. Without a Change it takes the only active Change, else asks for it (several active Changes are a real ambiguity). Scenarios come from the Change's spec deltas, not from the main specs: the Change is what this run must prove, and design "Correctness" asks for acceptance from the spec of the Change.

Alternatives: the round number as input - lost, the block would have to know the review layout; a path keeps it independent of #201. All main-spec scenarios - lost, a whole regression pass per round costs minutes and duplicates the project's own tests.

### D3. Drivable or not, decided by the tester

The tester reads each scenario and decides whether a user sees its outcome through an entry. Scenarios about structure, files a test reads, or internal rules are `not-driven` with a reason, never findings: D2 says the product's behaviour decides, and a scenario no user can observe has no product behaviour to check here (`review-integration` and `spec-conformance` cover it).

Alternatives: a tag in the spec format marking E2E scenarios - lost, a schema change for every Change and a field authors forget; the model reads WHEN/THEN well enough, and the verdict lists every `not-driven` reason for a reviewer to see.

### D4. Start, ready, stop

- `cli`: `start` (the build) runs to its end; then `ready` (the help call) must exit 0. Commands run in a `mktemp -d` scratch directory with the CLI called by its absolute path, so state the CLI writes (a data file, a config) lands outside the project and every scenario starts clean.
- `http` and `browser`: `start` runs with Bash `run_in_background`; `ready` is a URL polled with one `curl --retry 60 --retry-delay 2 --retry-connrefused --retry-all-errors` call (about 120 s), no sleep loop; a command `ready` is retried the same way. Before `start` the block calls the URL once: when it already answers, another process holds the port, and driving it would test the wrong code, so the entry is `blocked` with `Verdict: BLOCKED` and no finding (the product did nothing wrong).
- A failing `start` or a `ready` that never passes is one finding for the entry (D2 lists "a check is red" and broken behaviour as blockers; a product that does not start breaks every scenario), and the entry's scenarios are `blocked`.
- Stop: the background task is stopped with `TaskStop` (or `kill` of the process the start command printed when no task tool is there), the browser session is closed, and the block checks the URL no longer answers. A dangling dev server would hold the port for the next round.

Alternatives: start the product through a `bdk e2e start|stop` command - lost, no measured problem; Bash `run_in_background` and `TaskStop` do it in two calls. Running the CLI in the project directory - lost, a scenario that writes `ledger.json` would dirty the user's tree and leak state between scenarios.

### D5. Drivers, and the browser per D5 of the skills decisions

- `http`: `curl -sS -i` with the method, headers and body the scenario implies; the evidence keeps the status line and the relevant body excerpt.
- `browser` with `chrome-devtools-axi` (default): `npx -y chrome-devtools-axi <command>` through Bash, `open`, `snapshot`, `click @uid`, `fill @uid text`, `screenshot <path>`; it runs headless by default. Every call carries `CHROME_DEVTOOLS_AXI_SESSION=bdk-e2e` so the tester gets its own bridge and Chrome and never drives a browser session the user or another agent has open; the block ends with `stop` on that session only.
- `browser` with `chrome-devtools-mcp`: the MCP server's tools (`navigate_page`, `take_snapshot`, `click`, `fill`, `take_screenshot`). BDK ships no server (ADR-0001). When no such tool is in the session, the block notes it in each scenario file and uses `chrome-devtools-axi`.
- Each check is snapshot, act, snapshot: the tester asserts against what the page shows (text, enabled state, URL), not against the DOM it assumes. A screenshot at each THEN goes next to the scenario file (`e2e/<scenario>-<n>.png`).

Alternatives: Playwright scripts (D5 rejected: a script tests what its author expected, not what a user meets). A fixed port for the axi bridge - lost, a named session derives its own port.

### D6. Files: `e2e/<scenario>.md` and `e2e/verdict.md`

The scenario file name is the scenario name in kebab-case (the run-file table of the architecture). Its first line is `Result: <pass|fail|blocked|not-driven>`, so a reader takes the outcome from one line, the same habit as the `Verdict:` line of D6 in the skills decisions. The index is `e2e/verdict.md`, first line `Verdict: PASS|FAIL|SKIPPED|BLOCKED`: `bdk:lead` and resume read one file to know whether E2E ran and how it ended (architecture "Resume": a step is done when its file exists). It is named `verdict.md`, not `report.md` or `summary.md`, because the host refuses subagent writes to report-like names (Context). A later run replaces the files: the round's findings log keeps the history.

`SKIPPED` and `BLOCKED` are verdicts of their own and not `PASS`: a skipped E2E proves nothing about the product, and a reader must not read it as green (design "E2E": "the report says so").

Alternatives: the verdict only in the reply - lost, a reply is gone after a compaction and the lead must not hold it (architecture "Bottleneck: a review lead holds every finding"). One file per Change instead of per scenario - lost, the architecture fixes `e2e/<scenario>.md` and a scenario file is the evidence a fixer opens.

### D7. Findings

One `bdk findings add` per failed scenario, `--source e2e-check`, `--file` and `--line` at the scenario heading in the spec delta, `--evidence` naming the scenario file and "expected ..., observed ...". No `--rule`: the judge reads a rule as a rule violation, which D2 caps at `should-fix`, while a broken scenario is the product's behaviour, a `blocker`. The scenario location makes the id stable across rounds of the same scenario (the dedupe key is file, line and summary), and the judge and a fixer find the spec in one step. The block sets no level and no decision.

### D8. No CLI helper

Every step is a Bash call to a tool that exists (`curl`, the product's commands, `chrome-devtools-axi`), a Read of the spec deltas, a Write of a small file, or `bdk findings add`. CLAUDE.md admits a helper only for a problem an eval or a measurement shows. The acceptance runs and the evals (D10) are the measurement; the problems they showed and how the skill text answers them are recorded under "Measurements".

### D9. `tools.e2e[].browser` in the schema, and in setup

An optional zod enum `chrome-devtools-axi | chrome-devtools-mcp` on the `E2e` item. It has no schema default: a default would show up on `cli` and `http` items in `bdk config show`, where it means nothing; the tester reads an absent field as `chrome-devtools-axi`. A `browser` on a non-browser item is accepted and ignored: rejecting it would need a cross-field check over merged layers (a local layer may set `browser` on an item whose `driver` the project layer sets) for no harm prevented.

Setup writes the field only when the project's `.mcp.json` declares a server running `chrome-devtools-mcp`, and then as `chrome-devtools-mcp`. It refines D5 ("`/bdk:setup` writes `browser` when it detects one of the two"): detecting `chrome-devtools-axi` would write the default into the file, which setup's rule "write only detected keys, defaults stay out" (#181 D3) avoids, and `npx -y` makes axi available wherever npm is, so there is nothing to detect.

### D10. Eval cases, and the browser checked by hand

| Case | Project | Graders |
|---|---|---|
| `e2e-check-cli-broken` | shared fixture `tally-cli.sh`: a Node CLI with `tools.e2e` `cli` and a Change `add-total` whose spec has two drivable scenarios (one broken: on an empty ledger `tally total` exits 1 instead of printing `Total: 0.00`) and one internal scenario | `regex` on the findings log (an `e2e-check` finding naming the scenario, exactly one finding, `file` and `line` at the scenario heading), on `e2e/verdict.md` (`Verdict: FAIL`, the internal scenario `not-driven`) and on the two scenario files (`Result: fail`, `Result: pass`); `regex` on the trace that the CLI ran; `tool_used` Skill |
| `e2e-check-no-e2e` | the same fixture without `tools.e2e` | `regex` `Verdict: SKIPPED` naming `tools.e2e`; `regex` on the trace that the CLI never ran; `file_exists: false` on the findings log; `llm` on the reply; `tool_used` Skill |

Both are `block` cases run with and without the plugin; the prompts ask as a user would, without naming the skill. Graders use no Bash step (`tool_used`/`tool_order` on Bash cannot pass the free CI check, which grants only `Write Edit`); the trace `regex` covers the steps. A paid run grants `Write` and `Bash`: the product's commands differ per project, and the sandbox confines them to the run's workspace.

The browser and HTTP drivers have no eval case: an eval run cannot bind a local port (Measurements). The web project that was meant as the third case is the fixture `fixtures/click-counter.sh`, and `evals/README.md` gives the manual run for it.

Alternatives: grade with `tool_order` Skill before a Write of `verdict.md` - lost, the model writes the files through Write or a Bash heredoc, and the order says nothing about the outcome. Mock the browser - lost, the point of the block is the real product.

## Measurements

Acceptance runs (`claude -p --plugin-dir plugins/bdk --permission-mode auto`, Claude Code 2.1.293, separate test projects):

| Run | Result | Turns | Time | Cost |
|---|---|---|---|---|
| CLI project (`tally-cli.sh`), main thread | one finding at `spec.md:12`, `pass`, `not-driven`, `Verdict: FAIL`, `git status` clean | 6 | 24 s | $0.29 |
| Same, through `bdk:e2e-tester` with a round log | same files, finding in `review/round-1/findings.jsonl`, no write refused | 3 | 30 s | $0.31 |
| Web project (`click-counter.sh`), `chrome-devtools-axi` | dead "Add one" button found by snapshot, click, snapshot; screenshots saved; server stopped (port free after); `Verdict: FAIL` | 14 | 59 s | $0.40 |

`/bdk:setup` on the `setup-web-app` project plus a `.mcp.json` declaring `npx chrome-devtools-mcp@latest` wrote `browser: chrome-devtools-mcp` on the `web` item; the `setup-web-app` case gained a grader that the field stays out without that server.

Problems the runs showed, and the answer in skill text (no CLI helper needed, D8):

- The first agent run handed back the literal text `pending` through the host's `SubagentHandback` tool, although its files were complete. The agent body now says its last message is the step 7 reply starting with `Verdict:`; the rerun handed back the verdict.
- The web fixture's missing favicon gave a console error that the tester rightly reported as a second finding; the fixture now declares an empty icon, so it has one defect.
- The skill's example used the eval fixture's names (`tally.js total`), which leaked into the no-E2E trace and taught to the test; the examples now use another product.
- An eval run cannot bind a local port: `npm start` failed with `listen EPERM: operation not permitted 0.0.0.0:5180` (Claude Code 2.1.292 eval sandbox). The tester reported `Verdict: BLOCKED` with that reason, as the spec asks, and no false pass. Recorded under "Host limits" in `evals/README.md`.

Eval suite, `--runs 3`, both arms, Claude Code 2.1.292:

| Case | WITH | W/OUT | Δ |
|---|---|---|---|
| `e2e-check-cli-broken` | 1.00 | 0.00 | +1.00 |
| `e2e-check-no-e2e` | 1.00 | 0.50 | +0.50 |

Mean Δ +0.75, 77 s with `-j 4`, $2.10 for 12 runs. Without the plugin the model runs the CLI but leaves no evidence files or findings, and in the skipped case claims results instead of saying E2E was skipped.

## Risks / Trade-offs

- [The tester calls a scenario drivable that is not, or the reverse] -> every `not-driven` carries its reason in `verdict.md`; `review-integration` and `spec-conformance` still read every scenario.
- [False finding from a slow or flaky start] -> `ready` waits up to 120 s; a start failure is one entry finding with the output, not one per scenario; the judge levels it.
- [A dev server left running holds the port] -> the stop step checks the URL no longer answers; the next run's port check reports a foreign process instead of testing it.
- [`npx -y chrome-devtools-axi` needs the npm registry and a Chrome] -> `/bdk:setup` already adds the start rules; when the browser tool cannot start, the scenarios are `blocked` and `Verdict: BLOCKED` says why, so a missing browser never reads as a pass.
- [Driving costs time in every review round] -> only the Change's scenarios run, not the main specs; the tester runs in parallel with the reviewers (#201).
- [The CLI scratch directory hides a scenario that needs project files] -> the tester copies what the scenario's WHEN names into the scratch directory and says so in the steps.
