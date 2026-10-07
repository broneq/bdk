# Proposal

## Why

Tracks #193.

A review round (design "Flows", "Review round") needs three blocks that do not exist yet: a reviewer per group of files, an integration reviewer that checks the whole Change against its intent and the seams between its parts, and a judge that sets the level of every finding and writes the round report. Draft 1 showed that this split is what finds product defects: the integration review after the group reviews caught the only product blocker that 27 green tasks missed ([findings](../../../docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md), "Correctness"). Until the blocks exist, neither `review-round` (#195) nor `/bdk:pr-review` has anything to compose.

## What Changes

- Three block skills in `plugins/bdk/skills/`, each built with `/skill-creator` as a plain skill with its own eval cases (CLAUDE.md "Building skills (v3)"; ADR-0003 principles "One block, one job" and "Plain skill first"):
  - `review-group` on agent `bdk:reviewer` (sonnet): reviews one group of files of a round (spec `bdk-cli/git`, "Review groups") against its plan part, the spec deltas and the `review` rules, and appends findings through `bdk findings add`.
  - `review-integration` on agent `bdk:integration-reviewer` (opus): reviews the whole Change top down after the group reviews - intent and spec scenarios to code and tests, the seams between parts - and appends findings.
  - `judge` on agent `bdk:judge` (sonnet): checks every unleveled finding at its place in the code, sets its level by the definitions of [D2](../../../docs/design/2026-10-07-v3-skills-decisions.md#d2-definitions-of-the-finding-levels) through `bdk findings level`, and writes the round report.
- Three agent files in `plugins/bdk/agents/` that preload their block with `skills:`, so a lead starts a block as one `Agent` call (design "Layers"); each block also runs alone as `/bdk:<block>`.
- New verb `bdk findings report <log>`: renders the folded log as `report.md` next to it. Recorded problem: Claude Code 2.1.293 refuses a subagent's `Write` of `report.md` ("Subagents should return findings as text, not write report files"), measured for this Change; the judge runs as a subagent, so without a command no round could ever be finished (spec `bdk-cli/git`, "Round record").
- Eval cases `review-group-*`, `review-integration-*`, `judge-*` on a shared fixture, a two-part Change with an in-part logic bug and a seam bug between the parts.

## Capabilities

### New Capabilities

- `review-blocks`: the blocks `review-group`, `review-integration` and `judge` and their agents - inputs (round directory, group), what each checks, what each writes to the findings log, the level definitions the judge applies, the round report, standalone use, and their eval cases.

### Modified Capabilities

- `bdk-cli/findings`: adds the requirement "Round report" (`bdk findings report`).

## Out of scope

- The `review-round` lead skill, `/bdk:auto-review` and `triage` (#195): they compose these blocks, run `bdk git groups --record` and `bdk check run`, and decide on findings. Decisions per level in auto mode are D3, applied by `triage`, not the judge.
- `e2e-check` (#194), which appends its own findings to the same log.
- `/bdk:pr-review` (its own issue), which reuses these blocks on a GitHub PR.
- Rules for the review stage: the pack exists (#184); this Change adds none.

## Impact

- New: `plugins/bdk/skills/{review-group,review-integration,judge}/`, `plugins/bdk/agents/{reviewer,integration-reviewer,judge}.md`, `plugins/bdk/evals/{review-group,review-integration,judge}-*/`, `plugins/bdk/evals/fixtures/monthly-report.sh`.
- `bdk` CLI: one verb in the `findings` slice (`commands/report.ts` and its layers); no new slice, no matrix edge, no change to `shared/`.
- Spec `bdk-cli/findings` (one requirement added) and the new spec `review-blocks`.
- Ships in the released `bdk` plugin (`skills/`, `agents/`); `evals/` does not ship.
