---
status: accepted
date: 2026-10-08
decision-makers: broneq
---

# ADR-0004: e2e-check drives the browser with Playwright scripts the tester writes as it goes

Supersedes decision D5 of the [Skills and agents decisions](../design/2026-10-07-v3-skills-decisions.md#d5-how-e2e-check-drives-a-browser).

## Context and Problem Statement

`e2e-check` acts as a manual tester: it starts the product from `tools.e2e` and walks every spec scenario of a Change as a user would. D5 (#194) chose how it drives a browser: interactively, snapshot, act, snapshot, through `chrome-devtools-axi` by default or the Chrome DevTools MCP server, and rejected Playwright with the reason "a script tests what its author expected, not what a user meets".

Two measurements put that choice in question. The #208 speed measurement found the E2E tester the longest worker of a review round (#263, #264), so its driver sits on the critical path. A comparison of the browser tools (#267; DocFlow fixture, 5 seeded defects, one of them outside the spec, 3 runs per tool, sonnet, the same prompt, a fresh agent per run) gave per run:

| | Playwright driven by the agent | Chrome DevTools MCP | chrome-devtools-axi |
|---|---|---|---|
| Defects found | 15/15 | 15/15 | 15/15 |
| Tokens | 60k (57-65k) | 113k (107-120k) | 86k (80-97k) |
| Tool calls | 18 | 143 | 57 |
| Time | 244 s | 237 s | 470 s |
| Worked as a user | 3/3 | 3/3 | 0/3: fell back to JavaScript after `STALE_REF` and an `upload` error |

Which tool should the tester use by default, and does D5's objection to Playwright still hold?

## Decision Drivers

- **Testing as a user.** The tester must click what a user clicks and see what a user sees; acting through JavaScript defeats the purpose.
- **Speed and cost.** The driver is on the critical path of every review round (problem 1 of v3).
- **Evidence a person believes.** A `fail` should be easy to check; a colleague's manual Playwright QA run with video set the bar.
- **No setup a project must do.** `e2e-check` must work in a project that has never heard of the tool, in `claude -p` and in a subagent.

## Considered Options

1. **Playwright driven by the agent**, default; `chrome-devtools-mcp` kept as an opt-in; `chrome-devtools-axi` removed.
2. **Keep D5**: `chrome-devtools-axi` default, `chrome-devtools-mcp` opt-in.
3. **Chrome DevTools MCP as the default.**
4. **A Playwright test suite** the tester writes from the spec before it opens the page.

## Decision Outcome

**Chosen option: 1, Playwright driven by the agent**, because it found every defect at about half the tokens of the MCP server and a third of the tool calls of axi, worked as a user in every run, and records video.

It answers D5's objection: the tester does not write a test suite up front. It writes one small script, runs it, reads what it prints (an `ariaSnapshot()` of the page, texts, statuses, every distinct state the page passes through after an action), and only then writes the next step. When it knows a scenario, it replays it once from a fresh context with video on, and that replay decides the result, so every `fail` is seen twice. Scripts are throw-away: they live in a scratch directory under `.bdk/runs/<change>/` and are deleted at the end, never kept as evidence.

### Consequences

- ✅ Fewer tokens and tool calls per browser scenario, on the critical path of a review round.
- ✅ A screenshot at each THEN and a video per scenario under `## Evidence`; findings point at them.
- ✅ The tester acts through roles and names, without `force` or `page.evaluate`, so a covered control fails with the element in the way, and a two-second message is seen.
- ✅ Works with no project setup: the project's own Playwright when it resolves, else Playwright 1.63.0 installed into the scratch directory per run (npm cache), the installed Chromium, else the system Chrome. `/bdk:setup` offers to add `@playwright/test` and Chromium to the project, with the user's consent.
- ❌ `tools.e2e[].browser: chrome-devtools-axi` is no longer accepted (a breaking change of the settings schema; no release carried it, #213).
- ❌ A first run without the npm cache needs the network; with no Chromium and no Chrome the run is `BLOCKED` with the install command.
- 🟡 The Chrome DevTools MCP server stays for teams that already run it; it records no video.
- 🟡 An eval run cannot bind a port or launch a browser, so the browser driver is checked by hand on two fixtures (`evals/README.md`).

### Implementation Requirements

- [x] #267: the Playwright driver in `e2e-check`, the `browser` enum `playwright | chrome-devtools-mcp`, `/bdk:setup` detecting and offering Playwright, the browser fixtures, and D5 marked superseded.

## Pros and Cons of the Options

### 1 - Playwright driven by the agent

- Good: 60k tokens and 18 tool calls per run, all defects found, as a user in 3/3 runs.
- Good: video and screenshots from the same library; several browser contexts for several actors.
- Bad: needs Node and a Playwright package; the pinned version must be kept current.

### 2 - Keep D5 (`chrome-devtools-axi`)

- Good: no install beyond `npx`; works through Bash.
- Bad: fell back to JavaScript in 3/3 runs of the comparison, so it did not test as a user; 470 s per run; no video.

### 3 - Chrome DevTools MCP as the default

- Good: as accurate as Playwright and as fast in wall time.
- Bad: 113k tokens and 143 tool calls per run; needs an MCP server the project or user configures, which BDK does not ship (ADR-0001), and which an eval run does not load.

### 4 - A Playwright test suite written up front

- Good: repeatable.
- Bad: it tests what its author expected before seeing the page, D5's objection, and duplicates the project's own E2E suite, which `bdk check run` already runs.
