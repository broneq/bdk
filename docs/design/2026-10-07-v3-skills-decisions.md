# BDK v3 skill contracts - Decisions for the Skills and agents phase

**Date**: 2026-10-07
**Status**: Approved
**Authors**: Claude + User

> Design doc only. It closes the open "To resolve in the spec" questions of the phase "Skills and agents" (#190-#206), so that each task can run without a question back to the user. It builds on the [v3 architecture](./2026-10-07-v3-architecture.md) and changes it where noted. A task's spec may refine a decision here, but it may not reverse one without a new decision recorded in this file.

---

## Summary

| ID | Question | Decision | Issues |
|---|---|---|---|
| D1 | Task contract format inside a plan part | Numbered task with `File`, `Interface` and `Verified by` lines | #191, #192, #200 |
| D2 | Definitions of the finding levels | The product's behaviour decides `blocker`; a rule violation is at most `should-fix` | #193, #195, #201 |
| D3 | What auto mode decides per level | Fix `blocker` and `should-fix`; defer `nice-to-have` without an issue; accept `not-a-problem` | #195, #201 |
| D4 | Is Lavish a dependency of BDK? | Optional: used when available, `AskUserQuestion` otherwise | #190, #195, #181 |
| D5 | How `e2e-check` drives a browser | Interactively, through `chrome-devtools-axi` or the Chrome DevTools MCP server, chosen by configuration | #194 |
| D6 | Verifier report body | `Verdict:` line, then `Must address`, `Should consider`, `Checked`, with stable item IDs | #190, #191, #196 |
| D7 | Implementer and conformer report format | `Status:` or `Verdict:` first line, then fixed sections | #192, #200 |
| D8 | Wave size limit | `execution.max-parallel`, default measured in #200 (5 until then); the lead runs larger waves in batches | #200 |
| D9 | Stacked PR upkeep | No stacking: every Change branches from the base branch; a Change that needs an unmerged one waits | #202, #203 |

---

## D1 - Task contract format inside a plan part

**Already fixed:** the part frontmatter (`id`, `depends-on`, `isolation`, `files`) in spec `bdk-cli/plan`, and the `## Tasks` section of the `part.md` template: numbered contracts, no code.

**Decision:** each task is one numbered item whose first line says what changes, followed by three labelled lines.

```markdown
## Tasks

1. Add CSV export of users
   - File: src/users/export.ts
   - Interface: exportUsers(query): Readable
   - Verified by: users / Requirement: Export / Scenario: Export CSV; src/users/export.test.ts
```

- `File` names one or more paths from the part's `files`.
- `Interface` names the function, command, endpoint or type that changes, as a signature, not code. A task with no interface change writes `Interface: none`.
- `Verified by` names the spec scenario, the test, or both.
- `verify-plan` checks every task for the three lines; `bdk plan check` does not parse tasks (no CLI change).

**Rejected:** free prose (the verifier cannot tell a missing interface from an implicit one); YAML tasks in the frontmatter (a CLI change, and harder for the model to write well).

## D2 - Definitions of the finding levels

**Already fixed:** the levels in spec `bdk-cli/findings`, and that only an open `blocker` keeps the review loop going (spec `bdk-cli/run`, row 7).

**Decision:**

| Level | Definition |
|---|---|
| `blocker` | The product breaks a spec scenario or the intent of the Change; a check is red; a security hole; data loss; a regression of existing behaviour |
| `should-fix` | The product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost that the finding names |
| `nice-to-have` | An improvement whose absence costs nothing concrete |
| `not-a-problem` | A false positive, out of the Change's scope, or already handled |

A rule violation is never a `blocker` by itself. 14 of the 17 rules in the pack are `kind: house` (a choice among valid alternatives); letting them block would repeat B1's review rounds 3 and 4, spent on minor entries. Quality from rules lands through D3.

## D3 - What auto mode decides per level

**Already fixed:** the decisions `fix`, `accept`, `defer` (with an issue); every auto decision is recorded.

**Decision:** the policy in auto mode is fixed, not configurable in v3.0.

| Level | Decision |
|---|---|
| `blocker` | `fix` |
| `should-fix` | `fix`, in the same fix pass and within `policy.budgets.review-rounds` |
| `nice-to-have` | `defer`, listed in the PR body; no GitHub issue is created |
| `not-a-problem` | `accept` |

- A `should-fix` finding is fixed but does not by itself start another review round; only the fix scope is reviewed in the next round, as for blockers.
- BDK creates no GitHub issue without the user. A `defer` with an issue happens only when the user chooses it in manual triage.

## D4 - Lavish

**Decision:** Lavish is optional.

- `triage` and `design-draft` use `npx -y lavish-axi` when the session can open a browser review, and `AskUserQuestion` otherwise. Auto mode shows no page.
- `/bdk:setup` reports which path the project gets; BDK does not install Lavish.
- Each of the two skills has eval cases for both paths.

## D5 - How `e2e-check` drives a browser

**Context:** a project's own E2E test suite is one command and runs through `bdk check run`. `e2e-check` is different: the agent acts as a manual tester. It starts the product from `tools.e2e`, waits for `ready`, and walks every spec scenario of the Change as a user would, to find what the tests do not cover.

**Decision:** for `driver: browser`, the tester drives the browser interactively (snapshot, act, snapshot), not through a written test script.

- The tool is chosen by configuration: a new optional field `browser` on a `tools.e2e` item, `chrome-devtools-axi` (default) or `chrome-devtools-mcp`.
- `chrome-devtools-axi` runs through Bash with `npx -y chrome-devtools-axi`, so it needs no MCP server and works in `claude -p` and in evals.
- `chrome-devtools-mcp` uses the Chrome DevTools MCP server that the project or the user configured; BDK does not ship an MCP server ([ADR-0001](../adr/0001-remove-bundled-mcp-servers.md)). When the server is not available, the tester reports it and falls back to `chrome-devtools-axi`.
- Evidence in `e2e/<scenario>.md`: the steps taken, what the page showed at each check, and screenshot paths.
- `/bdk:setup` writes `browser` when it detects one of the two; #194 adds the field to spec `bdk-cli/config`.

## D6 - Verifier report body

**Already fixed:** the first verdict line `Verdict: PASS` or `Verdict: FAIL` decides (spec `bdk-cli/run`).

**Decision:** used by `verify-design`, `verify-plan` and `spec-conformance`.

```markdown
Verdict: FAIL

## Must address
- M1 design.md "Export": streams nothing on an empty query.
  Evidence: src/users/repo.ts:42

## Should consider
- S1 ...

## Checked
- Every spec scenario has an answer in the design; NFRs covered.
```

- `Verdict: FAIL` if and only if `Must address` has at least one item.
- Item IDs (`M1`, `S1`) are stable across iterations of the same verifier: a later report names the IDs it closed and keeps the open ones.
- Every `Must address` item has evidence: a file and line, a spec scenario or a command output.

## D7 - Implementer and conformer reports

**Already fixed:** the files `execute/part-NN.md` and `execute/conform-NN.md`; a part is done when its conform report passes.

**Decision:**

```markdown
Status: done            <!-- or: blocker -->

## Acceptance tests
- <scenario> -> <test>; red seen; green seen

## Changed files
## Checks
- checks/<id>.json: pass

## Blocker
<!-- only with Status: blocker -->
- Kind: plan-defect | environment | other
- Evidence: ...
- Proposal: ...

## Decisions taken without the user
```

```markdown
Verdict: PASS           <!-- or: FAIL -->

## Fixed
## Left
## Checks
```

The first line follows the same convention as D6, so one parser and one resume rule cover every report.

## D8 - Wave size limit

**Decision:** a new configuration key `execution.max-parallel`, an integer of at least 1.

- The execute lead starts at most that many part agents at once; a larger wave runs in batches in part order.
- #200 measures how many subagents the host runs at once and sets the default it measured; until then the default is 5.
- #200 adds the key to spec `bdk-cli/config`.

## D9 - No stacked PRs

**Decision:** Changes are not stacked. This replaces "each Change gets its own PR, stacked on the branch of the previous one" in the architecture.

- Every Change gets its own branch from the base branch the run started on, and its own PR into that branch.
- `/bdk:run` orders the queue by "blocked by". A Change whose blocker in the queue is not merged into the base branch yet is skipped; the run continues with the next independent Change and lists the waiting ones in its final report.
- A run started again after a merge picks up the waiting Changes.
- Nothing in BDK rebases or force-pushes a branch with an open PR.

---

## Effect on the tasks

| Issue | What changes |
|---|---|
| #190 | D4 (Lavish optional, both paths in evals), D6 (report body) |
| #191 | D1 (task format), D6 |
| #192 | D7 (report formats) |
| #193 | D2 (level definitions in the judge) |
| #194 | D5 (interactive driving, `tools.e2e[].browser`, config spec change) |
| #195 | D3 (auto policy), D4 |
| #196 | D6 |
| #200 | D8 (`execution.max-parallel`, config spec change) |
| #202 | D9 (PR into the base branch, no stacking) |
| #203 | D9 (queue order and waiting Changes; acceptance signal) |
