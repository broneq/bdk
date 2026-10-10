# Admission record

The skill in `skills/` shipped because a with/without run of its cases showed an effect over no plugin. This file is the evidence; `tests/admitted-skills.test.ts` fails when `skills/` and the verdicts below disagree.

## Rule

The rule of `bdk-craft` (design D3 of the archived Change `v3-207-bdk-craft-plugin`): a candidate is `admitted` when, over its cases,

- the mean `Δ` (with-arm score minus without-arm score) is at least `+0.10`, and
- the skill fired in at least half of its with-arm runs (the unscored `tool_used: Skill` indicator of each case).

## Run

| Field | Value |
| --- | --- |
| Date | 2026-10-10 |
| Claude Code | 2.1.292 |
| Agent model | `claude-opus-5-5` |
| Judge model | `claude-sonnet-5-5` |
| Runs | 3 per arm per case, arms `with` (only `bdk-explain` loaded) and `without` (no plugin) |
| Cases | 3 |
| Cost | 7.74 USD |

Command, from the repository root, with the clean `HOME` and the `git` shell prefix of "Host limits" in `plugins/bdk/evals/README.md`:

```bash
claude plugin eval plugins/bdk-explain --trust-plugin --scaffold --allow-tools Write Edit Bash \
  --runs 3 -j 3 --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --no-publish --json <file>
```

No run ended with an error.

## Skills

| Skill | Cases | WITH | W/OUT | Δ | Fired | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `explain` | 3 | 0.99 | 0.08 | +0.90 | 9/9 | admitted |

## Cases

Scores are the mean over three runs of the share of scored graders that passed.

| Case | WITH | W/OUT | Δ | Fired |
| --- | --- | --- | --- | --- |
| `explain-checkout-flow` | 0.96 | 0.00 | +0.96 | 3/3 |
| `explain-retry-backoff` | 1.00 | 0.25 | +0.75 | 3/3 |
| `explain-token-bucket` | 1.00 | 0.00 | +1.00 | 3/3 |

## Reading the result

- A plain Opus asked for an interactive page writes a good one, but into the project tree: `checkout.html` in the root or `docs/token-bucket-explorer.html` (seen in the trial runs), which leaves an untracked file in `git status`. In `explain-checkout-flow` the page therefore never exists at `.bdk/tmp/explain/checkout.html`, so every file grader fails and the plain arm scores 0.00; the score measures where the page goes and the rules the skill adds, not whether a plain page is good.
- Asked only for "a visual explainer" (`explain-retry-backoff`), a plain Opus answers in the terminal with no page; it keeps the project's `.gitignore` and creates nothing, which is its 0.25.
- With the skill, every run wrote `.bdk/tmp/.gitignore` with `*`, a page under `.bdk/tmp/explain/` with inline SVG, a dark-scheme block and controls, named the source files and replied in three short lines. In one `explain-checkout-flow` run the trace holds no `open` call on the page path (`opened`); its reply still gave the path to open.
- The eval sandbox cannot start a browser, so `open` fails in every with-arm run and the reply gives the path, as the skill says. The page itself was checked by hand in a test project started with `claude --plugin-dir plugins/bdk-explain`: the page opened in the browser, `git status --porcelain` printed nothing, a second request with the same name replaced the page, and it rendered without script errors, with no horizontal page scroll at 375 px, in light and dark schemes. Started with `SSH_CONNECTION` set, the skill opened nothing and its last reply line read "I didn't open it because this is an SSH session; open .bdk/tmp/explain/retry-backoff.html yourself."
