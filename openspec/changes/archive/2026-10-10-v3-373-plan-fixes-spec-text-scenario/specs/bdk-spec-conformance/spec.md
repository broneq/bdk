## MODIFIED Requirements

### Requirement: Eval cases of spec conformance in the review round

The suite SHALL hold the block cases `spec-conformance-round`, `judge-spec-conformance` and `plan-fixes-spec-delta`, tagged `block`, built from the shared fixture `tally-ledger-path`: the `tally-change` fixture plus a commit whose proposal asks for a short error on a bad amount and a ledger file chosen by `TALLY_LEDGER` (absolute or relative), whose delta documents `TALLY_LEDGER` with a relative-path scenario only and lists no error, and whose code prints `tally: not an amount: <text>` and joins `TALLY_LEDGER` to the current directory. `spec-conformance-round` SHALL grade both findings in the round log and no `close/spec-conformance.md`; `judge-spec-conformance` SHALL grade the level `blocker` for both findings when they are given unleveled; `plan-fixes-spec-delta` SHALL grade, from both findings decided `fix`, fix parts whose `files` hold the spec delta and `bin/tally.js`, an `index.md` with nothing under `## Not planned`, and a task for the error-message finding that names a `#### Scenario:` with WHEN and THEN and `openspec validate add-total --strict`. The block cases `implement-part-spec-delta` and `conform-part-spec-delta` SHALL start from the shared fixture `tally-spec-fix-part` (`tally-ledger-path` plus round 1 with the error-message finding decided `fix` and fix part `01`, whose one task adds the error to the delta with a scenario, verified by `openspec validate add-total --strict` and the next round's spec check): `implement-part-spec-delta` SHALL grade `Status: done`, the error in the delta under a requirement with a `#### Scenario:`, the validation named under the report's `## Checks`, and `bin/tally.js` unchanged; `conform-part-spec-delta`, with the part built and a report with no test, SHALL grade `Verdict: PASS`; `conform-part-spec-invalid`, with the part built but the added requirement left without a scenario, SHALL grade `Verdict: FAIL`, a `Left` item naming task 1 and no edit of the delta. The orchestrator case `auto-review-first-round` SHALL grade that the round lead starts `bdk:verifier` for `spec-conformance` with `--round` and `run_in_background: false`, and that `round-1/spec-conformance.md` exists.

#### Scenario: Round defects found with the plugin

- **WHEN** `spec-conformance-round` runs with the plugin, with the Bash grants the eval README names for it
- **THEN** its graders on the error-message finding and the path finding pass

#### Scenario: Spec-only fix part built and conformed

- **WHEN** `implement-part-spec-delta` and `conform-part-spec-delta` run with the plugin, with the Bash grants the eval README names for the part cases
- **THEN** the implementer reports `Status: done` with the error in the delta, and the conformer's verdict is `PASS`

#### Scenario: Spec-delta fix planned

- **WHEN** `plan-fixes-spec-delta` runs with the plugin
- **THEN** a fix part under `round-1/fixes/parts/` lists `openspec/changes/add-total/specs/tally/spec.md` in `files` with a task that names a `#### Scenario:` for the error and `openspec validate add-total --strict`, and `round-1/fixes/index.md` holds `- None.` under `## Not planned`

#### Scenario: Invalid delta fails the conform

- **WHEN** `conform-part-spec-invalid` runs with the plugin, with the Bash grants the eval README names for it
- **THEN** `execute/conform-01.md` starts with `Verdict: FAIL` and names task 1 under `## Left`
