# Proposal

## Why

Tracks #267.

`e2e-check` drives a browser through `chrome-devtools-axi` by default (D5 in `docs/design/2026-10-07-v3-skills-decisions.md`). The browser tool comparison behind #267 (DocFlow fixture, 5 seeded defects, 3 runs per tool, sonnet, same prompt; all tools 15/15) measured per run: Playwright driven by the agent 60k tokens, 18 tool calls, 244 s; Chrome DevTools MCP 113k, 143 calls, 237 s; `chrome-devtools-axi` 86k, 57 calls, 470 s, and in 3/3 runs it fell back to JavaScript (`STALE_REF`, an `upload` error), so it did not test as a user. The #208 measurement shows E2E is the longest worker of a review round (#263, #264), so a cheaper driver shortens the critical path (speed, problem 1 of v3). A video per scenario, as in a colleague's manual Playwright QA run, makes a `fail` easy to believe and a `pass` easy to check (correctness, problem 2).

## What Changes

- A new ADR-0004 supersedes D5: the tester still drives the browser interactively, now by writing small throw-away Playwright scripts and reading what each prints before writing the next; the tools are `playwright` (default) and `chrome-devtools-mcp`; `chrome-devtools-axi` goes. D5 is marked superseded.
- `e2e-check`: a Playwright driver in `references/drivers.md`. Scripts live in a `mktemp -d` directory and are not evidence. Playwright comes from the project when it resolves there, else from a per-run install of a pinned version into the temp directory. One browser context per actor is a suggestion. Console errors and HTTP responses >= 400 are collected. After exploring a scenario, one clean replay records a video and a screenshot at each THEN; the replay decides the result and is the second reproduction of a `fail`. The page is read right after each action, so short-lived messages, narrow-viewport covers and double submits are seen. `allowed-tools` swaps the axi entry for what the driver runs. When `chrome-devtools-mcp` is configured but not available, the fallback is Playwright.
- **BREAKING** `tools.e2e[].browser`: allowed values become `playwright` and `chrome-devtools-mcp`; an absent field means `playwright`; `chrome-devtools-axi` is rejected. v3 has no release yet (#213), so no published configuration breaks.
- `/bdk:setup`: checks whether the web app has Playwright and a browser for it; when either is missing, asks (in its one round of questions) to install `@playwright/test@1.63.0` as a dev dependency and Chromium, and installs them on yes. It reports how the tester will run Playwright (the project's own, or the pinned version installed per run when the user declined or could not be asked). It no longer writes `browser` from `.mcp.json`: `chrome-devtools-mcp` becomes an opt-in the user sets.
- Evals and fixtures: the eval `setup-web-app` follows, a new case `setup-web-no-playwright` grades the report for a web app without Playwright, and the browser fixtures (`click-counter.sh` and a new one with three hard defects) are checked with Playwright, as eval cases when a probe shows the eval sandbox can bind a port and launch a browser, else by hand as today.
- Evidence per review round: when a caller names a findings log, `e2e-check` writes next to it, so a review round's E2E evidence lands in `.bdk/runs/<change>/review/round-<N>/e2e/` beside that round's findings and report, and round 2 no longer overwrites what round 1's findings point at. Run alone, it still writes `.bdk/runs/<change>/e2e/`. `review-round`, `close` and `spec-conformance` read the round's or the latest E2E results.
- CAPTCHA and bot protection stay `blocked` by default; BDK adds no field for project-specific boundaries or environments (a project states them in its own `CLAUDE.md`).

Out of scope: a "QA campaign" skill over the whole product (a separate, later issue, layered on `e2e-check`); the rest of #245's setup changes (rebase on it if it merges first).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-e2e-check`: the `browser` driver becomes Playwright by default with the MCP fallback to Playwright; evidence gains a video per browser scenario; the driver reads the page after each action; Playwright resolution and the no-browser `BLOCKED` path; the E2E directory follows the caller's findings log.
- `bdk-cli/config`: the `tools.e2e[].browser` enum and its default.
- `bdk-auto-review`: a round's E2E evidence and verdict live in `<round dir>/e2e/`.
- `bdk-spec-conformance`: reads the latest E2E results, standalone or of a review round.
- `bdk-setup`: the `browser` field is no longer written from `.mcp.json`; a new question installs Playwright with the user's consent; the report says how Playwright will run; the eval case list gains `setup-web-no-playwright`.

## Impact

- `plugins/bdk/src/config/domain/settings.ts` and `src/config/tests/domain.test.ts` (enum).
- `plugins/bdk/skills/e2e-check/SKILL.md`, `references/drivers.md`; `plugins/bdk/agents/e2e-tester.md` only if the evals show it needs a change.
- `plugins/bdk/skills/review-round/SKILL.md`, `close/SKILL.md`, `spec-conformance/SKILL.md` (where they read E2E results); evals `auto-review-first-round` (grader path) and the fixture `tally-reviewed.sh` (its E2E results move into round 1).
- `plugins/bdk/skills/setup/SKILL.md` (step 3 question, `allowed-tools` for the install, step 9 report), `references/e2e.md`.
- `plugins/bdk/evals/`: `setup-web-app` graders, a new `setup-web-no-playwright` case, `fixtures/click-counter.sh`, a new hard-defects fixture, and either new `e2e-check-*` browser cases or the manual check in `evals/README.md`.
- `docs/adr/0004-...`, `docs/design/2026-10-07-v3-skills-decisions.md` (D5 superseded).
- Specs `bdk-e2e-check`, `bdk-cli/config`, `bdk-setup`, `bdk-auto-review`, `bdk-spec-conformance`.
- Runtime dependency in user projects: `@playwright/test` 1.63.0 as a dev dependency when the user accepts setup's install; otherwise `playwright` 1.63.0 from npm per run (npm cache makes repeats fast), and a Chromium the project's Playwright installed or the system Chrome.
