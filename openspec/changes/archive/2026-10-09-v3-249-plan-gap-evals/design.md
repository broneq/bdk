# Design

## Context

See proposal.md - Why. What exists:

- `/bdk:plan` (`plugins/bdk/skills/plan/SKILL.md`, #199): step 3 stops before any verification when the `plan-draft` reply names a gap of the design; step 2 row 4 (last `plan/verify-N.md` says `Verdict: PASS`) runs no block and reports, running `bdk plan check` once for the waves (step 6).
- `plan-draft` names a gap without deciding it and writes no part for it (#191 D8; kept by #253).
- The four `plan-*` orchestrator cases of #199 D8, on `fixtures/ledger-change.sh` and the part sets of the block cases (`verify-plan-sound`, `verify-plan-defects`, `plan-draft-fix-after-verify`).
- Hand runs of #199 ("Results"): t3, the passed plan (no block, one `bdk plan check`, reply with `/bdk:execute add-csv-export`, 15 s); t4, a spec requirement `--out <path>` the design does not cover (`plan-draft` wrote the parts it could and named the gap, no `.bdk/runs/`, reply with `/bdk:design add-csv-export`, 78 s).
- `skill-evals`, "Block and orchestrator cases": an orchestrator case holds `tool_order` and `file_exists` graders; `plugins/bdk/tests/evals.test.ts` fails a case without either.

## Goals / Non-Goals

**Goals:** both paths covered by cases that pass with `--ablation none`, with recorded results; a grader rule that admits a correct run that writes nothing without weakening the rule for every other orchestrator case.

**Non-Goals:** changing `/bdk:plan` or `plan-draft`; a case for every stop path of every orchestrator.

## Decisions

### D1. Gap case `plan-design-gap` on the ledger fixture

The scaffold runs `ledger-change.sh` and then appends one requirement to the spec delta `ledger-export`: `ledger export <file> --out <path>` writes the CSV text to `<path>` instead of stdout, with one scenario for a new file. Nothing says what happens when `<path>` already exists, and the design (D2: "writes to stdout") does not mention `--out`. Overwrite, refuse or ask are three products, and the code has no file writing to settle it, so the rule of `plan-draft` step 2 applies. The CSV requirement is untouched, so `plan-draft` can still write a part for `toCsv`. The edit is committed, so the run starts from a clean tree as the other cases do. It is t4 of #199 made repeatable.

Graders (issue Scope):

| Grader | Type | Checks |
|---|---|---|
| `draft-runs` | `tool_order` | Skill `plan` before Agent `bdk:planner` |
| `no-verifier` | `regex` trace | no Agent call with `subagent_type` `bdk:verifier` (matched on the call, as `plan-budget-spent` does, not on progress events) |
| `no-report` | `regex` trace | no `file_path` naming `plan/verify-` |
| `part-written` | `file_exists` | `openspec/changes/add-csv-export/plan/parts/01.md` |
| `skill-fired` | `tool_used` | Skill `plan` |
| `reply` | `llm` | names the existing-file choice as open and `/bdk:design add-csv-export`; fails on a reply that says the plan was verified or names `/bdk:execute` |

`part-written` grades that the stop comes after `plan-draft` drafted what it could (spec "Gaps of the design stop the plan": the stop is before the verifier, not before drafting). If a run shows `plan-draft` writing no part on this Change, that is the skill's choice "stop if nothing can be planned without it" and the grader is wrong for it; the measurement decides (D4).

Alternatives: the unknown-subcommand gap of the spec scenario - lost, #199 t1 showed that a gap no requirement touches is not a gap for `plan-draft` (it is left to the code), so the case would test the wrong thing. Reuse the household-book gap variant of #253 - lost, the B1-sized Change takes minutes and dollars per run for a path the 2-part ledger shows as well.

### D2. Passed-plan case `plan-passed`

The scaffold builds the state of `plan-verify-written` (the sound parts of `verify-plan-sound`, committed) and adds `.bdk/runs/add-csv-export/plan/verify-1.md` with `Verdict: PASS`, kept in the case directory as `plan-draft-fix-after-verify` keeps its failed report. The run files are git-ignored, so the tree stays clean. The report is written in the format `verify-plan` writes (`Verdict:`, `## Must address`, `## Should consider`, `## Checked`) and states what holds for these parts.

Graders:

| Grader | Type | Checks |
|---|---|---|
| `reads-report` | `tool_order` | Skill `plan` before Read of `plan/verify-1.md` (step 2: the last report decides the row) |
| `check-for-waves` | `regex` trace | `bdk plan check` runs (step 6, row 4: one check for the waves) |
| `no-block` | `regex` trace | no `plan-draft` Skill, no Agent call for `bdk:planner` or `bdk:verifier` |
| `nothing-written` | `regex` trace | no `Write` or `Edit` call |
| `skill-fired` | `tool_used` | Skill `plan` |
| `reply` | `llm` | says the plan passed, names `verify-1.md`, the waves and `/bdk:execute add-csv-export` |

The tag `writes-nothing` (D3) admits it without a `file_exists` grader. A `tool_order` on the Bash call cannot be loaded by the free check, which grants only `Write Edit` (`tests/eval-suites.test.ts`), so the order grader is on the Read of the report and the check is a trace regex, as in `plan-fresh`.

Alternative: keep row 4 a hand check (#199 D8) - lost: the hand check runs once, a case runs on every change of the skill, and the path is cheap (15 s, $0.24 by hand).

### D3. Rule: `writes-nothing` replaces `file_exists`, `tool_order` stays

The rule of #172 makes an orchestrator case grade the order of its blocks and the files it writes. A run whose correct outcome writes no file cannot have a `file_exists` grader that passes. The rule now reads: every orchestrator case holds a `tool_order` grader; it holds a `file_exists` grader, unless it carries the tag `writes-nothing`, and then it holds a `regex` grader on the trace (the evidence that nothing was written or no block ran) and no `file_exists` grader. `evals.test.ts` checks both branches.

The order part stays because every orchestrator run, even one that starts no block, runs its skill and then at least one command (here `bdk plan check`), so a `tool_order` grader can always be written and keeps the case honest about what the run does.

Alternatives: allow trace-only graders for every orchestrator case - lost, a new case could then drop `file_exists` by accident and grade nothing on the result. Require "a grader on the result" of any type for all cases - lost for the same reason: the intent that an orchestrator's outputs are checked as files would turn into a convention. A grader `file_exists` with a negative path - not offered by `claude plugin eval`. An explicit tag makes the exception visible in the case and checkable for free.

### D4. Measurement

Run both cases with the README's `plan-*` command, `--ablation none --runs 1`, clean `HOME`, from a plain terminal pane; then the gap case 3 times to see whether `plan-draft` names the `--out` gap each time (the judge decides the reply; the trace graders decide the stop). A case that fails on the skill's behaviour is a finding about the skill, not about the case: it is reported as an issue, unless it blocks this task.

### D5. plan-draft: a case a new requirement brings in is a gap

The first measurement (Results, run A) scored `plan-design-gap` 0.78: in 2 of 3 runs `plan-draft` planned `--out`, saw that nothing says what happens to an existing `<path>`, and still wrote "Gaps of the design: none that block planning ... No requirement of this Change touches those cases, so I planned nothing for them." `/bdk:plan` read no gap, ran `bdk plan check` and a verifier pass; the verifier raised the missing decision as `M1`, the fix pass of `plan-draft` then named it and the run stopped, one opus pass late. The third run named the gap and stopped at once.

The cause is the exclusion added after #199 t1: "behaviour no requirement of the Change touches (an input or a command it does not name) is not a gap". The planner read the existing file as "not named", although the requirement that adds `--out` brings that case in. Step 2 now draws the line by what is at stake: a case a requirement of the Change reaches is a gap even when no scenario names it, when its possible answers give the user results that differ in a way they would care about (overwrite or refuse an existing file: one loses data). Ordinary input handling that the Change's own error rules settle by analogy (a missing argument, a malformed value) is the planner's choice, listed as such; behaviour no requirement touches at all stays out, as before.

The first wording (run B) named "an empty or invalid value of a new input" as an example of a gap. It fixed the gap case (3/3) but over-reached: on the plain ledger Change the planner listed a missing `<file>` argument, entries without an `amount` and newlines in a description as gaps, and `/bdk:plan` stopped before the verifier in 5 of 8 `plan-*` cases. The example was the cause; run C, with the stake-based line, keeps the gap case at 3/3 and the other cases name `None.` Step 7 makes the reply list every gap under `Gaps of the design` (or `None.`), so a gap the planner planned around is not hidden behind "none that block planning"; `/bdk:plan` stops on any listed gap.

Alternatives: let `/bdk:plan` read gaps out of the prose of the reply - lost, the orchestrator cannot tell "none that block" from none, and the block owns the judgement. Soften the case (accept a stop after one verifier pass) - lost, the spec says the gap stops the plan before the verifier, and the spent opus pass is the cost the rule exists to avoid. Remove the exclusion - lost, #199 t1 showed that without it the planner stops on an unknown subcommand no requirement touches.

The fix changes a block outside the issue's Scope; it is made here because the gap case cannot pass without it (#249, "Acceptance signal").

## Risks / Trade-offs

- [`plan-draft` decides the existing-file choice (for example "overwrite", as many CLIs do)] -> the gap case fails on `reply`; the skill text says to name such a choice, so a failure is a real finding (D4), not a reason to soften the grader.
- [The judge's verdict varies on long replies] -> the `llm` graders ask for two or three named items only; the stop itself is graded by trace regexes.

## Results

Run A, 2026-10-09, before D5: `--ablation none --trust-plugin --allow-tools Write Edit "Bash(*/bin/bdk *)"`, clean `HOME`, from a plain terminal pane, Claude Code as pinned in the root `package.json`, models as the agents name them.

| Case | Runs | Score | Graders | Cost |
|---|---|---|---|---|
| `plan-passed` | 1 | 1.00 | 5/5 (`check-for-waves` then a `tool_order` on Bash, `no-block`, `nothing-written`, `reply`, `skill-fired`) | $0.12, 111 s |
| `plan-design-gap` | 3 | 0.78 (1.00, 0.67, 0.67) | `no-verifier` and `no-report` failed in 2 runs (D5) | $1.53 |

Run B, 2026-10-09, D5 with its first wording ("an empty or invalid value of a new input" as a gap): `plan-design-gap` 1.00 over 3 runs ($1.32); every `plan-*` orchestrator case once: `plan-design-gap`, `plan-budget-spent`, `plan-passed` 1.00; `plan-fresh` 0.33, `plan-verify-written` 0.29, `plan-resume-after-fail` 0.40, `plan-model-effort` 0.50, `plan-models-verifier` 0.00, each because the planner listed ordinary input handling as gaps and the run stopped before the verifier ($2.04). The wording was narrowed (D5).

Run C, 2026-10-09, D5 as merged:

| Case | Runs | Score | Cost |
|---|---|---|---|
| `plan-design-gap` | 3 + 1 | 1.00 every run | $1.03 + $0.50 |
| `plan-passed` | 1 | 1.00 | $0.12 |
| `plan-budget-spent`, `plan-models-verifier`, `plan-resume-after-fail`, `plan-verify-written` | 1 each | 1.00 | $1.64 |
| `plan-model-effort` | 1 | 0.83 | $0.33 |
| `plan-fresh` | 1 + 2 | 1.00, 0.83, 0.33 | $0.51 + $0.78 |

Every planner reply outside `plan-design-gap` lists `Gaps of the design: None.`; in `plan-design-gap` every reply names the existing `--out` file. The three runs below 1.00 fail on permissions, not on the plan: the main thread appended `; echo exit=$?` to `bdk plan check`, which the `Bash(*/bin/bdk *)` grant does not cover, and stopped (`plan-fresh` 0.33); the verifier's Bash and Grep calls were denied, so it failed a sound plan on its own unrun checks (`plan-fresh` 0.83, `plan-model-effort` 0.83: no `verify-1.md`). They are recorded as #342, as #292 was before them.

Run D, 2026-10-09, `plan-passed` with its final graders (`reads-report`, `check-for-waves` as a trace regex): 1.00 over 2 runs, $0.24, 19 s.
