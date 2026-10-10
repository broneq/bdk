## Why

Tracks #374. In the run measured by #368 (archived Change `v3-368-measure-spec-conformance-run`, design "Measurement"), round 1's fix pass added a requirement without a scenario to a delta. The round verifier of rounds 2 and 3 ran `openspec validate --strict`, saw the error and listed it under `Should consider` (`Verdict: PASS`); close's verifier listed the same error under `Must address` and the run stopped. `spec-conformance` has no problem class for a delta OpenSpec refuses, so the two modes judged it by chance, and a round passed what close refuses (against #265 design D1: close fails only on what changed after the last round).

## What Changes

- `spec-conformance` runs `openspec validate <change> --strict` as a fixed step of its check, in both modes (round and close), not when the verifier happens to.
- A new `Must address` problem: **Delta OpenSpec refuses** - each error the validation reports is one item, placed on the delta file and requirement the error names, with the command and its error line as evidence. A clean validation is a `Checked` line.
- In a round check, the item's finding sits on the delta at the requirement the error names: the fix goes to the delta.
- `judge` levels such a `spec-conformance` finding `blocker` while the delta still has the defect the error names (a requirement without a scenario), although the product works: `openspec archive` refuses the Change. Its skill text already does this (design D5); the spec states it and a case guards it.
- Block cases: `spec-conformance-delta-refused` (`--round` on a fixture whose delta adds a requirement without a scenario that the product meets, graded `Verdict: FAIL` and a `spec-conformance` finding on the delta) and `judge-delta-refused` (that finding, unleveled, graded `blocker`), on a new shared fixture `tally-delta-refused`.

Resolved from the issue's "To resolve in the spec": the validation is a step of `spec-conformance`, not a check item of the round (design D1); it is the first check of step 3 and appears in the report as a `Must address` item or a `Checked` line (design D2).

Out of scope: `plan-fixes` planning a requirement without a scenario (#373); the order of `review-round` (#370).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-spec-conformance`: "What the block checks" adds the validation and the refused-delta problem; "Run inside a review round" places its finding on the delta; "Eval cases of spec conformance in the review round" adds `spec-conformance-delta-refused` and `judge-delta-refused`.
- `review-blocks`: "Levels by the product's behaviour" levels a refused-delta `spec-conformance` finding `blocker`.

## Impact

- `plugins/bdk/skills/spec-conformance/SKILL.md` (step 3, step 4, step 5, `allowed-tools` gains `Bash(openspec validate *)`).
- Evals: `plugins/bdk/evals/fixtures/tally-delta-refused.sh`, cases `spec-conformance-delta-refused` and `judge-delta-refused`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/stages.md` (the `/bdk:spec-conformance` rows of Review and Close), `docs/concepts/findings.md` (the `spec-conformance --round` source row), `docs/concepts/openspec-changes.md` (the close paragraph). No diagram draws the problem list, so none is redrawn. Reference regenerated with `pnpm docs:reference`.
