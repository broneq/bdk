## ADDED Requirements

### Requirement: Cleared E2E failures in the pull request body

When the E2E verdict the pull request body names is `Verdict: FAIL`, the body SHALL also name every failed path the review cleared, as the `E2E:` line of `## Checked` of `close/spec-conformance.md` lists them (the path file and the finding id), so a reviewer sees why close passed with a failing verdict. With no cleared path the E2E part SHALL hold the verdict line alone.

#### Scenario: Close passes over a cleared E2E failure

- **WHEN** the latest E2E verdict of `add-total` is `review/round-1/e2e/verdict.md` with `Verdict: FAIL`, its only failed path has one `e2e-check` finding levelled `not-a-problem`, and spec conformance passes
- **THEN** close archives the Change, opens the pull request, and the body file holds `Verdict: FAIL` with the cleared path file and its finding id
