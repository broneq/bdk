# Design

## Context

See proposal.md, "Why". `bdk:designer` (`plugins/bdk/agents/designer.md`) and `bdk:planner` (`agents/planner.md`) have `model: inherit`; `models.<role>.model` overrides the frontmatter (archived Change `v3-274-models-per-agent`), so the frontmatter is only the default. The verifier that checks both artifacts runs on `opus` (`agents/verifier.md`).

The existing `design-draft-*` cases start from a proposal without `## Intent` and `## Acceptance`, the state before #422; a comparison on them measures the old flow (issue #423, Dependencies). `plan-draft-household-book` is the B1-sized plan case (8 spec deltas, 71 scenarios; archived Change `v3-242-measure-plan-draft`), the one where a plan has room to differ.

## Goals / Non-Goals

**Goals:**
- A recorded comparison of `sonnet` and `opus` on one design and one plan case, with a measure stated before the runs, and the two defaults set from it.

**Non-Goals:**
- A statistically settled answer: the Budget pays for one run per model and case (issue #423, Budget). The decision rule below says what one run can and cannot move.

## Decisions

### D1. Design case: `design-draft-acceptance`

The case starts from `ledger-explored.sh` plus what the new propose leaves (`fixtures/ledger-acceptance/criteria.sh`: issue 7 saved, AC-1 to AC-4, an empty scope log) under `policy.questions: decide-and-record`. It reaches the path under test: AC-4 (a semicolon option) and the missing entry point leave at least two decisions with real alternatives (a function or a command for the export; a parameter, a setting or a locale guess for the delimiter), and the code holds two helpers to reuse (`listEntries`, `formatCents`).

- Alternative: `design-draft-auto` as it is. Lost: its proposal has no AC, so it cannot show AC coverage, and it measures the flow before #422.
- Alternative: build on `ledger-acceptance.sh`. Lost: that fixture already holds a design (it starts from `ledger-designed.sh`), so the designer would revise instead of draft. Its AC part moves to `fixtures/ledger-acceptance/criteria.sh` so both use one text; a script directly under `fixtures/` must build a workspace alone (`tests/evals.test.ts`), so the shared part lives in the fixture's data directory, as `household-book/` does.

### D2. Plan case: `plan-draft-household-book`

The B1-sized case is the only plan case where the parts, waves and reuse can differ much; `plan-draft-csv-export` fits in one or two parts on any model. Its fixture has no `## Acceptance`, but `plan-draft` reads the ACs only through the spec deltas' scenarios, which the case grades (every scenario owned once).

- Alternative: a new plan case on the ledger with ACs. Lost: small; the planner's AC coverage is its scenario coverage, which `household-book` measures over 71 scenarios.

### D3. Both models through `--model`

Both agents inherit the session's model, so `--model sonnet` and `--model opus` set the agent's model and the main thread's. The main thread of a block case only starts the agent and relays its reply, so its share of the cost is small; it is reported with the run.

- Alternative: `models.designer.model: opus` in a variant scaffold. Lost: a second copy of each case for one setting; the agent's model is the same either way.

### D4. Measure, stated before the runs

Design (`design-draft-acceptance`):

1. **AC coverage**: each of AC-1 to AC-4 answered by a requirement with a scenario; no AC handed to the user or left out (the case's graders).
2. **Decisions with real alternatives**: the number of decisions whose lost alternatives a team could ship and lose for a reason taken from the code, the proposal or a rule; an alternative no one would ship (a straw man) does not count. Read by hand from `design.md`.
3. **Reuse**: the design builds on `listEntries` and `formatCents` and plans no second store query or amount formatter (graders and reading).
4. **Product check**: one `/bdk:verify-design add-csv-export` round on a copy of the kept workspace, on the `opus` verifier: its `Verdict:` and the number of `Must address` items.

Plan (`plan-draft-household-book`):

1. **Scenario coverage and check**: `bdk plan check` clean, every scenario owned once (the case's graders).
2. **Shape**: parts and waves.
3. **Reuse**: the tasks extend the fixture's existing modules and helpers rather than writing a second copy (reading the parts against the fixture's code).
4. **Product check**: one `/bdk:verify-plan add-household-book` round, as in the design: `Verdict:` and `Must address` count.

Both: cost and time of the draft run from the harness result.

**Decision rule.** `opus` becomes an agent's default only when its artifact is better on a product measure (fewer `Must address` items of the verifier, or a `PASS` where `sonnet` fails) or on a hand-read measure by a margin one run cannot explain away (a missed AC, a missed reuse, a straw-man-only decision on `sonnet`), and no measure is worse. A tie stays `inherit`: each `opus` subagent also pays its progress summaries on `opus` (WHY-sw-better.md, section 6), and a verified fix loop already catches what a weaker draft misses. The rule is applied per agent, which resolves "opus for one agent or both".

## Measurement

2026-10-15, Claude Code 2.1.292, clean `HOME` and the `git` entry of "Host limits" (`plugins/bdk/evals/README.md`), `--runs 1 --ablation none --keep-temp`, `--model sonnet` or `--model opus`. The cost per agent is split from the kept transcripts (each subagent's tokens at the list prices of its model; the `opus` share matches the harness's per-model cost to the cent); "main" is the remainder: the main thread and the progress summaries.

The prompt of `design-draft-acceptance` ("Write the specs and the design ...") was routed by the main thread to `/bdk:design`, so each run drafted, verified and, after a `FAIL`, fixed and verified again, as a user's run does. The draft's first verdict is therefore the product check of D4; no separate `verify-design` round was needed. `plan-draft-household-book` asks for a draft only, so each plan got one `/bdk:verify-plan` round afterwards (`claude -p --plugin-dir plugins/bdk --model sonnet` on a copy of the kept workspace, the verifier on `opus`).

### Design (`design-draft-acceptance`, two runs per model)

| Run | Score | First verdict | Designer runs | Decisions (real alternatives) | Scenarios | AC-3 under `;` in the first draft | Designer | Verifier | Main | Total | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `sonnet` 1 | 1.00 | `FAIL`: M1 AC-3 narrowed | 2 | 4 (4) | 9 | comma unquoted | $0.32 | $0.51 | $0.20 | $1.02 | 167 s |
| `sonnet` 2 | 1.00 | `FAIL`: M1 AC-3 narrowed | 2 | 4 (4) | 9 | comma unquoted | $0.30 | $0.55 | $0.20 | $1.05 | 167 s |
| `opus` 1 | 1.00 | `PASS` | 1 | 6 (6) | 14 | quoted | $0.52 | $0.27 | $0.30 | $1.10 | 187 s |
| `opus` 2 | 1.00 | `PASS` | 1 | 7 (7) | 12 | comma unquoted, passed by the verifier | $0.48 | $0.27 | $0.30 | $1.04 | 173 s |

Read by D4:

1. **AC coverage.** Every final delta answers AC-1 to AC-4 and no run appended a `needs-user` entry. The first draft kept AC-3 as written in 1 of 4 runs (`opus` 1). Both `sonnet` drafts and `opus` 2 quoted only the delimiter in use, so a comma label stays bare under `;`. The verifier failed it in both `sonnet` runs, and each `sonnet` designer fixed it in its second run. It passed `opus` 2, which listed AC-3 as answered without the `;` case (filed as #426). The grader `ac3-not-narrowed` was added after the runs: of the final deltas it fails `opus` 2 only.
2. **Decisions with real alternatives.** `sonnet` 4 and 4 (export module, delimiter set, quoting, amount format). One lost alternative is a straw man (a `Serializer` interface in `sonnet` 1, D1); each decision keeps at least one real one. `opus` 6 and 7. It adds rows in date order, header and line endings (CRLF, BOM) and, in `opus` 2, formula injection, each with real lost alternatives. Only `opus` argued the missing command from the code: a CLI starts with an empty in-memory store (`src/store.js:3`), so it would export the header only. `sonnet` put the command under Non-Goals because the package has no `bin`.
3. **Reuse.** All four designs build on `listEntries` and `formatCents` and plan no second store query or amount formatter.
4. **Product check.** `sonnet` `FAIL` then `PASS` in both runs (two designer and two verifier runs); `opus` `PASS` at once in both (one each).

Cost of the whole design loop: `sonnet` $1.02 and $1.05, `opus` $1.10 and $1.04. The `opus` main thread costs $0.10 more than a `sonnet` one, and with `models.designer` on `opus` the main thread stays on the session's model. So one `opus` designer round ($0.48-0.52) costs about what two `sonnet` designer rounds and the extra verifier round cost ($0.30 + $0.27).

### Plan (`plan-draft-household-book`, one run per model)

| Model | Score | Parts, waves | `verify-plan` | Planner | Main | Draft total | Draft time | Verify cost, time |
|---|---|---|---|---|---|---|---|---|
| `sonnet` | 1.00 | 9, 3 (01 / 02 / 03-09) | `FAIL`: M1 a present scenario left unmarked (Unknown version), M2 `Verified by:` endings | $0.78 | $0.14 | $0.93 | 235 s | $0.89, 127 s |
| `opus` | 1.00 | 9, 3 (01 / 02 / 03-09) | `FAIL`: M1 `Verified by:` endings | $1.49 | $0.24 | $1.73 | 403 s | $0.96, 168 s |

Read by D4:

1. **Scenario coverage and check.** Both clean under `bdk plan check`, all 71 scenarios owned once (the verifier recounted them per capability).
2. **Shape.** The same 9 parts and 3 waves.
3. **Reuse.** Both reuse `parseAmount` and `formatCents` (`src/money.js`) and `loadBook` and `saveBook` (`src/book.js`). Both rewrite every caller of the last two in part 02. Both carry the design decisions D1-D10 into tasks. The verifier checked every name against the code in both plans and found no mismatch.
4. **Product check.** Both `FAIL`, and both need a fix round. The shared defect is the ending of `Verified by:` on a task that tests present scenarios among others; it is a gap of the skill on a B1-sized Change, not of the model (filed as #427). `sonnet` also left one present scenario unmarked.

### Cost

$9.10 and 1,671 s of machine time in all: the six eval runs above ($6.87, 1,332 s), the two `verify-plan` rounds ($1.84, 295 s), and one `verify-design` round on the final `sonnet` 1 design ($0.39, 44 s, `PASS`). That round turned out redundant, as the eval run had already verified the design. The second run per model of `design-draft-acceptance` ($2.10) is beyond the issue's literal `--runs 1`. It was spent because the first pair moved a default, and the issue's Input names n=1 as the reason a measurement was needed. Total within the Budget of $20.

## Decision

### D5. `bdk:designer` runs on `opus`

By the rule of D4: the `opus` design is better on hand-read measures by a margin one run does not explain, in both runs (6-7 decisions with real alternatives against 4, with the command decision grounded in the code). It also kept AC-3 as written in 1 of 2 first drafts against 0 of 2, and needed one verifier round against two. No measure is worse: reuse and coverage are equal, and the design loop costs the same within $0.05. The frontmatter moves from `inherit` to `opus`. A project that wants the old behaviour sets `models.designer.model: sonnet` (the "Spend less" example of the configuration guide already does).

- Alternative: keep `inherit`. Lost: the `sonnet` designer narrowed an AC in both runs, the failure #422 was built to stop, and its fix round costs what `opus` costs.
- The progress-summary cost of an `opus` subagent (WHY-sw-better.md, section 6) is in the totals above, inside the designer's share.

### D6. `bdk:planner` stays on `inherit`

The plans are equal on coverage, shape and reuse. Both fail verification on the same skill gap (#427), so `opus` saves no fix round. `opus` left one fewer present scenario unmarked, a margin one run cannot carry. It costs 1.9 times as much ($1.49 against $0.78) and takes 1.7 times as long (403 s against 235 s). The rule keeps the cheaper default; a project sets `models.planner.model: opus` if it wants it. "Opus for one agent or both" resolves to the designer only.

## Risks / Trade-offs

- [One run per model and case] -> the rule only moves a default on a clear difference; a tie keeps the cheaper default, and the case stays for a later series.
- [The hand-read measures are read by the author of the Change] -> every count is written with the decision ids or file names it counts, so a reviewer can recount it.
