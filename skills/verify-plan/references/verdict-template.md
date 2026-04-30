# Verdict Report Template

```markdown
# Plan Verification Report: <plan-name>

**Date**: YYYY-MM-DD
**Plan**: `<path-to-plan-file>`
**Verdict**: PASS / FAIL / PASS WITH WARNINGS
**Iterations**: N/3

## Summary
<2-3 sentence overall assessment — would this plan work if executed as-is?>

---

## 1. Plan Proof (Simulator A)

### Assumptions Verified
| # | Assumption | Actual Code | Match? |
|---|-----------|------------|--------|

### Step-by-Step Simulation
#### Task N: <name>
- **Verdict**: PASS / FAIL
- **Data Traces**:
  - `input → transform → output` [PASS/FAIL reason]
- **Edge Cases**:
  | Case | Handled? | Risk |
  |------|----------|------|
- **Issues**: ...

---

## 2. Regression Check (Simulator B)

### Affected Flows
| Flow/Template | Risk Level | Test Coverage | Verdict |
|--------------|-----------|---------------|---------|

### Backward Compatibility
| Changed Symbol | Backward Compatible? | Detail |
|---------------|---------------------|--------|

### Scope Creep Findings
1. ...

### Regressions Found
1. ...

---

## 3. Code Review

| Severity | Finding | Location |
|----------|---------|----------|
| CRITICAL | ... | file:line |
| HIGH | ... | file:line |

---

## 4. New Edge Cases (from both simulators)

| # | Edge Case | Source | Why It Matters | Recommended Test |
|---|-----------|--------|---------------|-----------------|

---

## 5. Recommendations

### Must Fix Before Implementation
1. <actionable fix for each FAIL>

### Should Consider
1. <warnings and improvements>

---

## Iteration History

| Check            | Iter 1 | Iter 2 | Iter 3 |
|------------------|--------|--------|--------|
| Plan Proof       | ...    | ...    | ...    |
| Regression Check | ...    | ...    | ...    |
| Code Review      | ...    | ...    | ...    |
| **Overall**      | ...    | ...    | ...    |
```
