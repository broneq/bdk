# Verdict Report Template

Use this layout when writing `.bdk/verify-plan/<plan-slug>-verification.md`. Section names map 1:1 to the YAML `checks:` keys returned by `bdk:plan-verifier`.

```markdown
# Plan Verification Report: <plan-slug>

**Date**: YYYY-MM-DD
**Plan**: `<path-to-plan-file>`
**Verdict**: PASS | PASS_WITH_WARNINGS | FAIL
**Iterations**: N/2
**Overall confidence**: 0.00–1.00

## Summary
<2-3 sentence assessment — would this plan work if executed as-is?>

## Per-Task Verdict
| Task | Title | Outcome | Confidence | Sig. drift | Data trace | Edge cases | Regression | Test cov. | Completeness |
|------|-------|---------|------------|------------|------------|------------|------------|-----------|--------------|
| 1.1  | …     | PASS    | 0.92       | PASS       | PASS       | PASS       | PASS       | PASS      | PASS         |

---

## 1. Signature Drift Findings
| Task | Symbol | Plan says | Actual | Match? |
|------|--------|-----------|--------|--------|

## 2. Data Trace Walkthroughs
### Task N: <title>
- Trace 1: `input → step → step → output` [PASS/FAIL reason]
- Trace 2: …

## 3. Edge Cases Surfaced
| # | Edge case | Source task | Handled? | Recommended test |
|---|-----------|-------------|----------|------------------|

## 4. Regression Flows
| Flow | Affected symbol | Backward compatible? | Detail |
|------|------------------|----------------------|--------|

## 5. Test Coverage Gaps
| Task | Bullet | Covered? | Missing test |
|------|--------|----------|--------------|

## 6. Plan Completeness Findings
- <bullet list of cross-task issues, missing files, undeclared dependencies, ambiguous instructions>

---

## Must Fix Before Implementation
1. <one bullet per `must_fix` entry, with file:line where the YAML envelope provided a `location`>

## Should Consider
1. <warnings, low-confidence flags, advisory items from `recommendations`>

---

## Iteration History
| Section          | Iter 1 | Iter 2 | Delta |
|------------------|--------|--------|-------|
| Signature drift  | …      | …      | …     |
| Data trace       | …      | …      | …     |
| Edge cases       | …      | …      | …     |
| Regression flows | …      | …      | …     |
| Test coverage    | …      | …      | …     |
| Plan completeness| …      | …      | …     |
| **Overall**      | …      | …      | …     |
```
