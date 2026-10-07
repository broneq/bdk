# Admission record

Every skill in `skills/` shipped because a with/without run of its cases showed an effect over no plugin. This file is the evidence; `tests/craft-skills.test.ts` fails when `skills/` and the verdicts below disagree.

## Rule

A candidate is `admitted` when, over its cases:

- the mean `Δ` (with-arm score minus without-arm score) is at least `+0.10`, and
- the skill fired in at least half of its with-arm runs (the unscored `tool_used: Skill` indicator of each case).

A `rejected` candidate is deleted from `skills/` together with its cases; its numbers stay here.

## Run

| Field | Value |
| --- | --- |
| Date | 2026-10-07 |
| Claude Code | 2.1.293 |
| Agent model | `claude-opus-5-5` |
| Judge model | `claude-sonnet-5-5` |
| Runs | 3 per arm per case, arms `with` (only `bdk-craft` loaded) and `without` (no plugin) |
| Cases | 24 (3 per candidate) |
| Cost | 33.33 USD (21.88 for the full suite, 11.45 for the re-run below) |

Command, from the repository root:

```bash
claude plugin eval plugins/bdk-craft --trust-plugin --scaffold --allow-tools Write Edit Bash \
  --runs 3 --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --no-publish --json <file>
```

Notes:

- The full suite hit the account's weekly usage limit part way through: every run of the `tdd-*` and `testing-strategy-*` cases and of `refactoring-user-label` ended with "You've hit your weekly limit". After the reset those seven cases were run again in full with the same command and `--case <glob>`; the numbers below are from that re-run. No other case had a failed run.
- On a machine whose `~/.docker` holds symbolic links (Docker Desktop), `claude plugin eval` refuses runs that grant `Bash`. The run above started `claude plugin eval` with `HOME` set to a clean directory whose `Library/Keychains` links to the user's keychain; each case run gets its own temporary home either way.

## Skills

| Skill | Cases | WITH | W/OUT | Δ | Fired | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `tdd` | 3 | 0.92 | 0.67 | +0.25 | 9/9 | admitted |
| `debugging` | 3 | 0.83 | 0.72 | +0.11 | 9/9 | admitted |
| `refactoring` | 3 | 0.97 | 0.42 | +0.56 | 9/9 | admitted |
| `testing-strategy` | 3 | 0.94 | 0.50 | +0.44 | 9/9 | admitted |
| `mermaid-drawer` | 3 | 1.00 | 0.59 | +0.41 | 9/9 | admitted |
| `api-design` | 3 | 1.00 | 0.93 | +0.07 | 9/9 | rejected |
| `oop-design` | 3 | 1.00 | 0.93 | +0.07 | 9/9 | rejected |
| `modularizing` | 3 | 0.80 | 0.84 | -0.05 | 9/9 | rejected |

## Cases

Scores are the mean over three runs of the share of scored graders that passed.

| Case | WITH | W/OUT | Δ | Fired |
| --- | --- | --- | --- | --- |
| `tdd-business-days` | 0.83 | 1.00 | -0.17 | 3/3 |
| `tdd-password-rules` | 0.92 | 0.50 | +0.42 | 3/3 |
| `tdd-slugify` | 1.00 | 0.50 | +0.50 | 3/3 |
| `debugging-invoice-cents` | 0.75 | 0.67 | +0.08 | 3/3 |
| `debugging-pagination` | 0.92 | 0.75 | +0.17 | 3/3 |
| `debugging-zero-quantity` | 0.83 | 0.75 | +0.08 | 3/3 |
| `refactoring-csv-export` | 1.00 | 0.67 | +0.33 | 3/3 |
| `refactoring-shipping-cost` | 0.92 | 0.33 | +0.58 | 3/3 |
| `refactoring-user-label` | 1.00 | 0.25 | +0.75 | 3/3 |
| `testing-strategy-catalog-search` | 1.00 | 0.50 | +0.50 | 3/3 |
| `testing-strategy-checkout` | 0.83 | 0.50 | +0.33 | 3/3 |
| `testing-strategy-login-mfa` | 1.00 | 0.50 | +0.50 | 3/3 |
| `mermaid-drawer-payment-flow` | 1.00 | 1.00 | +0.00 | 3/3 |
| `mermaid-drawer-platform-map` | 1.00 | 0.33 | +0.67 | 3/3 |
| `mermaid-drawer-trust-boundaries` | 1.00 | 0.44 | +0.56 | 3/3 |
| `api-design-comments` | 1.00 | 1.00 | +0.00 | 3/3 |
| `api-design-orders` | 1.00 | 1.00 | +0.00 | 3/3 |
| `api-design-transfers` | 1.00 | 0.80 | +0.20 | 3/3 |
| `oop-design-discounts` | 1.00 | 1.00 | +0.00 | 3/3 |
| `oop-design-document-workflow` | 1.00 | 0.92 | +0.08 | 3/3 |
| `oop-design-notifications` | 1.00 | 0.87 | +0.13 | 3/3 |
| `modularizing-big-module` | 0.89 | 0.78 | +0.11 | 3/3 |
| `modularizing-cycle` | 1.00 | 1.00 | +0.00 | 3/3 |
| `modularizing-layered-app` | 0.50 | 0.75 | -0.25 | 3/3 |

## Reading the result

- The three admitted process skills (`tdd`, `debugging`, `refactoring`) change the order of work, which a plain agent skips: tests before code, a failing reproduction before the fix, a safety net before the first edit. `debugging` passes by a small margin; a plain Opus already finds and fixes these bugs, and the skill adds the reproduction step and the regression test.
- `testing-strategy` and `mermaid-drawer` change concrete choices a plain agent rarely makes: Test Data Builders and Page Objects, diagrams split under the node budget with colours legible in dark mode.
- `api-design`, `oop-design` and `modularizing` fired on every case but added little: a plain Opus already answers with problem+json, cursors, `If-Match`, value objects and feature modules.
- Two cases score lower with the skill. In `tdd-business-days` a plain Opus already works test-first on this prompt (all graders pass in all three runs); two with-arm runs saw fewer than four failing test runs (`red-runs-observed`). In `modularizing-layered-app` neither arm proposes an incremental migration, and the with-arm never names a public entry file per module.
- `debugging-invoice-cents` fails `reproduced-before-fix` in every run of both arms: the agent writes the test and the fix before it runs the test. The skill's step 2 asks for that run; on this case it does not yet change the order.
