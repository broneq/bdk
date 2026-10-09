# Proposal

## Why

Tracks #252.

Claude Code refuses a subagent's `Write` to a file whose base name matches `^(REPORT|SUMMARY|FINDINGS|ANALYSIS).*\.md$` (case-insensitive; read from the 2.1.294 code: "Subagents should return findings as text, not write report files"). #200 hit it with `execute/summary.md` (D9, now `execute/result.md`); #193 D6 met it for `review/round-N/report.md` and routed the write through `bdk findings report`, but kept the name. Every BDK agent that touches the round record still works next to a file named like the ones the host refuses: a judge, triage or lead that falls back to `Write` (a CLI failure, a retry, a fix of the report) is refused, and the name stays tied to a host heuristic that can widen. The round record is the only BDK run file that still matches the pattern.

## What Changes

- **BREAKING** The review round report `review/round-N/report.md` becomes `review/round-N/review.md`: `bdk findings report <log>` writes `review.md` next to the log; `bdk git scope` / `bdk git groups --rounds` count a round as finished when it holds `review.md`; `bdk run status` row 6 looks for `review.md`.
- The skills that read or wait for the file (`judge`, `triage`, `review-group`, `review-integration`, `review-round`, `auto-review`, `plan-fixes`, `pr-review`, `pr-review-round`) name `review.md`.
- The eval graders and fixtures that seed or grade the file, the architecture's run layout and resume table, and the CLI tests follow.
- Command names and JSON keys stay: `bdk findings report` and its `{"report": <path>}` output name the act, not the file.
- A plugin test fails when a skill, an agent or the CLI names a Markdown file the host would refuse.
- No other file a BDK skill writes from a subagent matches the pattern (inventory in design.md); nothing else is renamed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-plugin`: added requirement - no file the plugin writes is named like a report the host refuses, checked by a test.
- `bdk-cli/findings`: `bdk findings report` writes `review.md`.
- `bdk-cli/git`: a finished round holds `review.md`.
- `bdk-cli/run`: the run files and resume row 6 name `review.md`.
- `review-blocks`: the manual round, the judge's output and its scenario name `review.md`.
- `triage-block`: the round input and the refreshed record name `review.md`.
- `bdk-auto-review`: the round files and the stage derivation name `review.md`.
- `bdk-pr-review`: the round directory and the judge's output name `review.md`.

## Impact

- `plugins/bdk/src/findings`, `src/git`, `src/run` and their tests.
- `plugins/bdk/skills/*` listed above; `plugins/bdk/evals` graders and fixtures.
- `docs/design/2026-10-07-v3-architecture.md` (review flow, run artifacts, resume table); the user docs: Concepts pages `run-state`, `orchestrators`, `findings`, `agents`, and the generated Reference.
- A run directory written before this Change keeps `report.md`, which the new code does not see; v3 is unreleased, so no run directory needs migrating.
- Out of scope: other v3 work on the review round (#263, #264, #265), and the open PR work of #245 and #256.
