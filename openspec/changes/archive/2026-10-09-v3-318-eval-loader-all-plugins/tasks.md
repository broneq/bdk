## 1. Shared eval suite check

- [x] 1.1 Write `tests/eval-suites.test.ts`: discover every `plugins/*/evals/` holding a case, a grants map with a completeness test, a zero-cost load per suite, every case scaffold run as the harness runs it, and the planted broken-case proof; run it with the `skill-check-internal-error` `case.yaml` broken (unparsable YAML, missing scaffold) and see it fail naming the plugin and case
- [x] 1.2 Restore the case and see the test pass for all three suites; fix any case it shows broken
- [x] 1.3 Remove the loader check, the planted-case check and the case-scaffold check from `plugins/bdk/tests/evals.test.ts`, keeping its fixture, layout, launcher and `gh` stand-in checks

## 2. Contributor docs

- [x] 2.1 `CONTRIBUTING.md`: say that PR CI loads every plugin's eval cases and runs their scaffolds for free

## 3. Gates

- [x] 3.1 `pnpm docs:reference` leaves no diff, `pnpm check` passes, the other jobs of `.github/workflows/pr.yml` pass locally, and `openspec validate --specs --strict` passes
