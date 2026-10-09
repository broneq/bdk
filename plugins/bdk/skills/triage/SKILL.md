---
name: triage
description: 'Decides what happens to each finding of a judged BDK review round - fix, accept or defer - by the fixed policy when policy.gates.review is auto, otherwise by the user through a Lavish page or AskUserQuestion, and records every decision with bdk findings decide. Use when a judged round needs its decisions, when asked to triage or decide the findings of a review, or when /bdk:auto-review reaches triage.'
argument-hint: "[<round-dir> | <change>] [--last-round]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(npx -y lavish-axi *) Bash(gh issue create *) Read Grep Glob Write AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Triage a review round

Decide every undecided finding of one judged round and record each decision. You add no finding, set no level (the judge did), change no project file, commit nothing and start no agent. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`. Run each command on its own, without `;`, `&&`, pipes or `echo`, the Lavish commands too: the result shows the exit code, and a compound command falls outside this skill's grants, so it is denied or asks the user for permission.

If the block above says "BDK not configured: run /bdk:setup", stop and reply with that line. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 1. Find the round

With a round directory in the arguments or the request (`.bdk/runs/<change>/review/round-<N>/`), use it. With a Change name, use the highest `.bdk/runs/<change>/review/round-<N>/` that holds `review.md`. Otherwise use the highest `.bdk/runs/manual/review/round-<N>/` that holds `review.md`. The log is `<round-dir>/findings.jsonl`.

Run `bdk findings list <log>`. When its counts show an unleveled finding, decide nothing: reply with the unleveled ids and that the round needs the judge (`/bdk:judge <round-dir>`) first, and stop.

Then run `bdk findings list <log> --decision undecided`. These are the findings to decide; a recorded decision stays, unless the user asks to change it: then that finding is decided again. With none, go to step 4.

Done when you have the undecided findings, each with its level, place, summary, evidence and level reason.

## 2. Pick the mode

Note `policy.gates.review` from the configuration above. `auto` is auto mode (step 3a); `manual` or absent is manual mode (step 3b).

The policy, which is also the recommendation in manual mode:

| Level | Decision |
|---|---|
| `blocker` | `fix` |
| `should-fix` | `fix`; with `--last-round`, `defer` without an issue |
| `nice-to-have` | `defer`, without an issue |
| `not-a-problem` | `accept` |

`--last-round` means this is the last round `policy.budgets.review-rounds` allows (`/bdk:auto-review` passes it): no later round would review a fix, so a `should-fix` finding is fixed only within the budget. A `blocker` stays `fix` whatever the budget.

## 3a. Auto mode

Show no page, ask nothing, create no issue. For each undecided finding, record the policy decision:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings decide <log> <id> <decision> --reason "policy.gates.review auto: <level>"
```

With `--last-round`, a `should-fix` finding gets the reason `policy.gates.review auto: should-fix; policy.budgets.review-rounds spent`.

Done when every finding of step 1 has a decision. Go to step 4.

## 3b. Manual mode

Ask about every undecided finding in one ask, blockers first, each with its id, place, summary, evidence and the judge's reason, the policy decision preselected as the recommendation. The choices are `fix`, `accept`, `defer`, and `defer with an issue` (an issue reference, or "create one"). Use the first surface that works:

1. **Lavish.** Run `npx -y lavish-axi playbook input` once for the page shape. Write the page at `<page>` = the first `.lavish/triage-<change>-round-<N>-<k>.html` (k = 1, 2, ...) that does not exist yet: Lavish never reopens a page whose session the user ended. The page holds one card per finding, grouped by level, with the choices as radio inputs (the recommendation checked), an issue field and a note. Open it with `npx -y lavish-axi <page>`, then wait with `npx -y lavish-axi poll <page>` (Bash `timeout` 600000; run it again if it times out). Read the whole reply.
2. **`AskUserQuestion`** when the open command exits non-zero: first print the findings as a table with the recommendation per finding. Then ask one question per `blocker` and `should-fix` finding, at most four per call, and one question per remaining level: take the recommendation for all of them, or choose one by one.
3. **In your reply** when `AskUserQuestion` is not available either: list the findings as numbered questions, the recommendation marked "(recommended)", say that the decisions are recorded once answered, and end your turn. Record nothing.

A finding the user did not answer stays undecided; never record a decision the user did not make. "Take your recommendations" decides every finding it covers with the policy decision.

For each `defer with an issue`: use the reference the user gave; when the user asked to create one, run `gh issue create --title "<summary>" --body "<place, evidence, level reason, and the Change>"` and use the URL it prints.

Record each answer:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings decide <log> <id> <decision> [--issue <ref>] --reason "user: <the user's note, or 'chose <decision>'>"
```

Done when every answered finding has a decision.

## 4. Refresh the report

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings report <log>`. It rewrites `review.md` with the decisions and prints the counts.

Done when the counts line shows no undecided finding, or only the ones the user left open.

## 5. Reply

Reply with the report path, the counts line, and one line per finding decided `fix`: id and summary. Name any finding the user left undecided.
