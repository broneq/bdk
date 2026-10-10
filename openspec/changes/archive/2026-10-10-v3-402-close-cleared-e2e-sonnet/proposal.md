# Proposal

## Why

Tracks #402.

#396 (archived Change `v3-396-close-not-a-problem-e2e`) made `/bdk:spec-conformance` at close clear a failed E2E path whose `e2e-check` findings the round's judge levelled `not-a-problem`. Its design D4 measured the gap on opus only: the old skill text already passed close there, because the opus verifier traced the observation itself and overrode its own rule. Where the old rule would stop close - a weaker verifier that follows its text literally, or a tester error the verifier cannot refute by a missing output string - was not measured.

## What Changes

- New shared fixture `plugins/bdk/evals/fixtures/tally-e2e-cleared-stale.sh`: `tally-e2e-cleared.sh` whose cleared path `empty-ledger` observed `Total: 7.50`, exit 0. The code prints exactly that for the ledger the `main` path leaves (`tally add 5`, `tally add 2.5`), so the observation is plausible output of the code under another state; only the path's input (no ledger) refutes it.
- New eval cases `spec-conformance-e2e-cleared-sonnet` (block) and `close-e2e-cleared-sonnet` (orchestrator): the #396 cases on that fixture with `models.verifier.model: sonnet` in the ignored `.bdk/settings.local.yaml`, plus a grader that the verifier runs on sonnet. The block case reuses the scaffold of `spec-conformance-e2e-cleared`, which now takes the base fixture as an optional argument.
- Scores before (the skills of `staging/v3` before #401) and after, 3 runs each, recorded in `plugins/bdk/evals/README.md` and in design "Measurement".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The output is eval cases and a measurement (`skip_specs: true`); no skill, agent, CLI or spec changes.

## Impact

- New: `plugins/bdk/evals/fixtures/tally-e2e-cleared-stale.sh`, `plugins/bdk/evals/spec-conformance-e2e-cleared-sonnet/`, `plugins/bdk/evals/close-e2e-cleared-sonnet/`.
- Changed: `plugins/bdk/evals/spec-conformance-e2e-cleared/scaffold.sh` (optional base fixture argument, default unchanged), `plugins/bdk/evals/README.md`.
- Nothing a BDK user sees changes (eval cases only), so there is no Docs task group and no user docs page is updated.
