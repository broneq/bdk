## Why

Tracks #194.

v2 and draft 1 checked code, not the product: in draft 1, 27 tasks closed green while the product did not work, and only one integration reviewer noticed ([findings](../../../docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md), "No product-level check during execute"). The v3 architecture puts "E2E run as a user would" on the list of checks before "done" (design `2026-10-07-v3-architecture.md`, "Constraints & NFRs", rows Correctness and E2E) and names the block `e2e-check`, run by the agent `bdk:e2e-tester` in every review round ("Catalog", "Review round"). D5 of `2026-10-07-v3-skills-decisions.md` decides how it drives a browser.

## What Changes

- New block skill `e2e-check` in `plugins/bdk/skills/e2e-check/`: reads the scenarios of a Change's spec deltas, starts the product from each `tools.e2e` entry, waits for `ready`, drives every scenario it can reach as a user would (`cli`: commands in a scratch directory; `http`: requests; `browser`: interactive snapshot-act-snapshot through `chrome-devtools-axi` or the Chrome DevTools MCP server, per D5), stops the product, and writes evidence to `.bdk/runs/<change>/e2e/<scenario>.md`, an index `e2e/verdict.md`, and one finding per broken scenario through `bdk findings add --source e2e-check`.
- Without a `tools.e2e` entry the block starts nothing, writes `Verdict: SKIPPED` with the reason, and reports it.
- New agent `bdk:e2e-tester` (`plugins/bdk/agents/e2e-tester.md`, sonnet) that preloads the skill and cannot edit files, so the tester never changes the product it checks.
- New optional settings field `tools.e2e[].browser`: `chrome-devtools-axi` (used when absent) or `chrome-devtools-mcp` (D5).
- `/bdk:setup` writes `browser: chrome-devtools-mcp` for a browser entry when the project configures a Chrome DevTools MCP server, and leaves the field out otherwise.
- Eval cases `e2e-check-*`: a CLI product with one broken scenario (the acceptance signal) and the same project without `tools.e2e`; a web product whose broken scenario only a browser shows is a fixture checked by hand, because an eval run cannot bind a local port.

## Capabilities

### New Capabilities
- `bdk-e2e-check`: the `e2e-check` block and the `bdk:e2e-tester` agent - input, starting and stopping the product, driving scenarios per driver, evidence files, findings, the skipped path.

### Modified Capabilities
- `bdk-cli/config`: the `tools.e2e` row of "Settings keys" gains the optional field `browser`.
- `bdk-setup`: the E2E entry requirement says when setup writes `browser`.

## Impact

- `plugins/bdk/skills/e2e-check/` (new), `plugins/bdk/agents/e2e-tester.md` (new, the plugin's first agent).
- `plugins/bdk/src/config/domain/settings.ts` and its tests: one optional enum field; no new command (no measured problem asks for one).
- `plugins/bdk/skills/setup/references/e2e.md`.
- `plugins/bdk/evals/`: new cases, a shared fixture, README grants for the cases.
- Out of scope: the review round that starts the tester in parallel with the reviewers (`review-round`, #201), the judge that levels its findings (#193), and the E2E reproduction of `/bdk:debug` (#204).
