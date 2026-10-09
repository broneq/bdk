# Design

## Context

`diagnose-bug` writes a one-part fix Change whose only acceptance scenario is the reproduction (#262, spec `bdk-debug`, Requirement "Fix Change"). The rule's reason is the test-first contract of `/bdk:execute`: every acceptance test must be seen red, so a scenario that passes today blocks the implementer.

The failing run of #359 (kept workspace `/private/tmp/e-hHPRr0`, `sealed/home/cwd/`) shows a different reason for a second scenario. Its `design.md` reasons that the fix of the cause (`entries.push(amount)` in `add`) leaves every ledger the faulty `add` already wrote (`["5"]`) crashing on `total`, "including the reporter's". So it added a Goal "Ledgers written by the faulty `add` still total correctly", a second fix in `total` (`sum + Number(amount)`), a spec scenario "Ledger with amounts recorded as text", a second acceptance scenario and a second task. That scenario is red today, so the #262 rationale ("cannot be seen red") does not forbid it in the model's reading; the skill text forbids it only by "The only acceptance scenario is the reproduction scenario", without saying where the defect it found goes. The model resolved the conflict towards completeness.

## Goals / Non-Goals

**Goals:**

- A related defect found during diagnosis has a defined place that keeps it visible, and never enlarges the fix Change.
- Evidence: a case that provokes the related defect, and 9 of 9 runs of `diagnose-bug-reproduced` passing `one-acceptance-scenario`.

**Non-Goals:**

- Fixing the related defect in any form inside `/bdk:debug` (no second part, no follow-up Change written by the block).
- Filing an issue for it automatically (`diagnose-bug` writes only its Change and run files).

## Decisions

### D1. A related defect is named, never fixed in the fix Change

`diagnose-bug` names each related defect (another bug, or data the bug already wrote that the fix of the cause does not repair) on a `Related:` line of `debug/diagnosis.md`, under Risks of `design.md` as "related, not fixed", and in its reply. It never becomes an acceptance scenario, task, spec scenario or fix decision.

Why: one Change, one reproduced bug keeps the contract `/bdk:execute` builds against exact: the reproduction test red, the fix, green. A related defect has no reproduction of its own (the run of #359 invented the input `["5","2.5"]`), and repairing data already written is a product decision with several readings (coerce on read, migrate on load, a one-off repair command, nothing because the data never was valid), which the skill's own step 4 says belongs to the user. Naming it keeps the finding; the user opens a Change for it (`/bdk:debug` with its symptom, or `/bdk:propose`).

Alternatives:
- Allow a second acceptance scenario when it is red today. Lost: it changes the grader and the #262 rule into a judgement call ("is it red?") the block cannot check before the fix exists, grows the part beyond the reported bug, and lets the block decide the data-repair question for the user.
- Treat a related defect as `Status: too-large` (the fix needs a choice the user should make). Lost: it stops the fix of the reported bug, which is ready, because of a second one; the user waits for both.
- Only sharpen the sentence ("even when the diagnosis finds a related defect") without a place for it. Lost: a careful diagnosis then either drops what it found or keeps fighting the rule; giving it a place removes the conflict.

### D2. The `Related:` line in `diagnosis.md`, one per defect

`diagnosis.md` is the block's machine-read output (`/bdk:debug` reads its first lines and its fields). One line per defect, `Related: <what, where, why the fix leaves it>`, after `Root cause:` and before `Scenario:`, absent when there is none. A section would make the file two formats; a single line with several defects would be hard to carry over.

### D3. `/bdk:debug` passes the `Related:` lines on

The user of `/bdk:debug` never sees `diagnose-bug`'s reply as a final answer: the orchestrator goes on in the same turn. So the fix gate (manual) names each `Related:` line as not fixed, and `debug/result.md` copies each under `## Bug` as `- Related (not fixed): ...`. Without this the defect would sit only in a run file nobody opens.

Alternative: leave `/bdk:debug` unchanged. Lost: the finding is lost in the flow users actually run.

### D4. Eval evidence: a new case `diagnose-bug-related-defect`

`diagnose-bug-reproduced` provokes the related defect only by chance (1 of 9 runs). The new case runs the same fixture with a report that says the reporter's ledgers from the last weeks hold amounts such as `"5"` and `"2.5"`, which pushes every run to the decision. Graders: `one-acceptance-scenario` (same regex as the existing case), `no-text-ledger-scenario` (the spec delta holds no scenario with a ledger file of text amounts), `diagnosis-names-related` (a `Related:` line in `diagnosis.md` naming the ledger), `diagnosis-ready`, `no-code-edit`, `no-code-write`, `skill-fired`. The existing case stays as it is and is run 9 times for the acceptance signal.

Alternative: add a `Related:` grader to the existing case. Lost: a defect found by chance cannot be graded deterministically.

### D5. The format of a `Related:` line is given in prose, not as an example line

The first skill text showed a concrete `Related:` line in the `diagnosis.md` example (`src/parse.js:2 parseAmount("") returns 0 ...`, a true second defect of the eval fixture). In the first 9-run measurement 3 of 3 inspected runs copied it word for word next to their own finding. A copied line is a claim the run never checked; in a project other than the fixture it would be false. The example block therefore holds no `Related:` line, and the sentence under it gives the form `Related: <where (file:line, or the data)> <what goes wrong>; <why this fix leaves it>`; the `debug/result.md` example likewise.

Alternative: a placeholder line inside the example. Lost: the example block is otherwise all concrete values, and a placeholder there is as easy to copy as a value.

## Risks / Trade-offs

- [The model drops the related defect instead of naming it] -> the new case grades the `Related:` line.
- [The reporter's own ledgers still crash after the fix] -> the `Related:` line reaches the gate and `debug/result.md`; the user decides the repair in its own Change.
- [Paid eval runs on a busy host stall (#341)] -> run on an idle machine, `-j 3`, re-run a run that shows the stall signature.

## Measurement

Claude Code 2.1.292, `--ablation none`, `-j 3`, clean `HOME`, the `git` shell prefix, 2026-10-09, `--keep-temp`:

| Skill text | Case | Runs | Score | `one-acceptance-scenario` | Cost |
| --- | --- | --- | --- | --- | --- |
| before (`staging/v3`) | `diagnose-bug-related-defect` | 3 | 0.57 | 0 of 3 | $1.56 |
| D1-D3 with the example `Related:` line | `diagnose-bug-related-defect` | 9 | 1.00 | 9 of 9 | $4.47 |
| D1-D3 and D5 (final) | `diagnose-bug-related-defect` | 9 | 1.00 | 9 of 9 | $4.21 |
| D1-D3 and D5 (final) | `diagnose-bug-reproduced` | 9 | 1.00 | 9 of 9 | $4.20 |

- Before: every run added a second acceptance scenario and spec scenario for the stale ledgers ("Ledger written by earlier versions") and wrote no `Related:` line; the case reproduces the defect of #359 in 3 of 3 runs, against 1 of 9 in `diagnose-bug-reproduced`.
- With the example line, 3 of 3 inspected runs copied the example's `parseAmount("")` line beside their own: D5.
- Final: each of the 18 runs wrote exactly one `Related:` line, its own finding about ledgers already holding text amounts (also the 9 runs of `diagnose-bug-reproduced`, whose report does not mention them), and none copied wording from the skill. Acceptance signal of #359 holds: `diagnose-bug-reproduced` passes `one-acceptance-scenario` in 9 of 9 runs.
