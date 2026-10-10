# Tasks

## 1. Eval cases

- [x] 1.1 Write the shared fixture `plugins/bdk/evals/fixtures/tally-e2e-cleared-stale.sh` (design D1) and check it builds in a temp directory and `bdk findings list` reads its log
- [x] 1.2 Let `spec-conformance-e2e-cleared/scaffold.sh` take the base fixture as an optional argument (design D3)
- [x] 1.3 Write `spec-conformance-e2e-cleared-sonnet/` and `close-e2e-cleared-sonnet/` with `models.verifier.model: sonnet` in `.bdk/settings.local.yaml` and a `verifier-sonnet` grader (design D2)

## 2. Measurement

- [x] 2.1 Run both cases after (the skills of this branch), `--ablation none`, 3 runs each
- [x] 2.2 Run both cases before (the `spec-conformance` and `close` skills of `d1a718f8`, `staging/v3` before #401), 3 runs each
- [x] 2.3 Record the scores and what the verifier did in design "Measurement" and `plugins/bdk/evals/README.md`

## 3. Gates

- [x] 3.1 Every check CI runs (`.github/workflows/`), incl. `pnpm check` and `pnpm docs:reference` with no diff
- [x] 3.2 `openspec validate v3-402-close-cleared-e2e-sonnet --strict` and `openspec validate --specs --strict`
