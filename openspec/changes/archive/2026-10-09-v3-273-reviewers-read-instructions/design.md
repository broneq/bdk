# Design

## Context

The review blocks were built in #193 (`openspec/changes/archive/2026-10-08-v3-193-review-blocks/`). `review-group` step 2 reads the plan part, its scenarios and `bdk rules for --stage review`; `judge` step 2 reads the proposal, the scenarios and the rule a finding cites. The execute blocks of #192 already read the project instructions: `conform-part` step 3.3 reads "`CLAUDE.md` and `AGENTS.md` in the project root and in each directory on the way to a changed path, and each `.claude/rules/*.md` whose `paths` match one", and cites a broken one by its file (`CLAUDE.md`) in its report.

`bdk findings add --rule` takes any string; the dedupe key of a finding is `file`, `line` and `rule:<value>` when a rule is given, else the normalised summary (`plugins/bdk/src/findings/domain/id.ts`). The report and `bdk findings list` print the value in brackets.

Claude Code loads the root `CLAUDE.md` into every session and loads nested `CLAUDE.md` and path-scoped `.claude/rules/` files only when the session reads a matching file. A reviewer may therefore have some instruction text in its context already, but nothing in the block tells it to check the changed lines against it, and under `--workdir` (`/bdk:pr-review`) the loaded files are those of the working directory, not of the reviewed checkout.

## Goals / Non-Goals

**Goals:**

- A changed line that breaks a project instruction becomes a finding that names the instruction file, in the same round and with the same level rules as a broken BDK rule.
- The judge checks the cited instruction before it levels, as it does a cited rule.

**Non-Goals:**

- A new CLI flag, field or schema value.
- Instructions in the integration review, the E2E check or the design and plan stages (#272 for rules there).
- Model or effort per role (#274, #278).

## Decisions

### D1. Which blocks read the instructions: `review-group` and `judge`

`review-group` reads the instructions that bind its files; `judge` reads the instruction file a finding cites. This is the minimum the issue names and it covers every changed file: each one is in a part group or in `unplanned`, both reviewed by `review-group`.

Alternative: every review block reads them, `review-integration` included. Lost: the integration reviewer runs on opus and reads the whole Change; an instruction binds the lines of a file, which the group reviewer already reads whole, so the opus reviewer would repeat the group reviewers' work (its skill already says "do not review files line by line again").

### D2. The instruction set is the one `conform-part` reads

`CLAUDE.md` and `AGENTS.md` in the project root and in each directory on the way to the file, and each `.claude/rules/*.md` whose `paths` match the file or that has no `paths` (Claude Code loads such a rule file for every file). Same set, same words as the execute blocks, so the writer, the conformer and the reviewer hold the code to the same instructions. Under `--workdir` they are read from the work directory: the reviewed commit's instructions, not the caller's.

Alternative: only the root `CLAUDE.md`. Lost: a nested `AGENTS.md` or a path-scoped rule is exactly the instruction a session does not load by itself.

### D3. A finding cites an instruction with `--rule <instruction file path>`

The value is the path of the instruction file relative to the project root (`CLAUDE.md`, `src/AGENTS.md`, `.claude/rules/testing.md`), and the evidence quotes the instruction. A BDK rule id never holds `/` or ends in `.md`, so the judge tells the two apart by the value.

- Same form as `conform-part`'s report (`CLAUDE.md`), so a reader sees one citation style from execute to review.
- No CLI change: `--rule` is already free text, the report and `list` print it, and the dedupe key `rule:<path>` at a file and line keeps two reviewers' reports of the same violation as one finding.

Alternatives:
- A new `--instruction` flag and event field. Lost: a schema change with no measured problem (CLAUDE.md: "add a CLI helper only when an eval or a measurement shows a concrete problem"); every reader of the log (report, triage, plan-fixes, pr-review) would learn a second field for the same role.
- A heading anchor (`CLAUDE.md#testing`) or a quoted instruction in `--rule`. Lost: free text in the dedupe key splits one violation into two findings when two reviewers word it differently.

Trade-off: one changed line that breaks two instructions of the same file dedupes into one finding. The skill says to name both instructions in its evidence.

### D4. The judge checks the citation, then levels as for a rule

For a `rule` that is an instruction path, the judge reads that file and checks that the quoted instruction is there and binds the finding's file (the file is under the instruction file's directory, or a `.claude/rules` file's `paths` match it). Missing or not binding: `not-a-problem`, because the failure scenario does not hold. Holds: `should-fix` at most, as the level table already says for "a rule or a project instruction"; an instruction is a choice of the project, and the product still works.

Alternative: trust the reviewer's citation. Lost: a reviewer that half-remembers a convention would get a `should-fix` that triage turns into a fix part.

### D5. Eval cases on a derived fixture

`fixtures/monthly-report-instructions.sh` runs `monthly-report.sh`, commits a `CLAUDE.md` on `main`, rebases the branch onto it and rewrites the shas in `round-1/groups.json`. The instruction: "Group the tests of each exported function in a `describe` block named after the function". `src/parse.test.js` (group `p01`) breaks it, it is orthogonal to the seeded logic bug, and no linter or BDK pack rule checks it.

- `review-group-instruction`: the round of `monthly-report`, group `p01`; graded by a regex on a `review-group` finding with `file` `src/parse.test.js` and `rule` `CLAUDE.md`, an LLM grader that the finding names the missing `describe` grouping, no edit, skill fired.
- `judge-instruction`: two findings, the real violation citing `CLAUDE.md` (`should-fix`) and one citing `CLAUDE.md` for "every exported function is async", which the file does not say (`not-a-problem`).

Alternative: add the `CLAUDE.md` to `monthly-report.sh`. Lost: eleven cases share that fixture, and a new instruction there would change what `review-group-logic-bug`, `triage-*` and `pr-review-*` see.

Results (Claude Code 2.1.292, default models, clean `HOME` and the `git` prefix of the eval README's "Host limits", grants `Bash(*/bin/bdk *)` `Bash(git *)`):

| Case | Before the skill change (with plugin, 1 run) | After: with | without | Δ (3 runs per arm) |
|---|---|---|---|---|
| `review-group-instruction` | 0.50, no finding cites `CLAUDE.md` | 1.00 | 0.33 | +0.67 |
| `judge-instruction` | 1.00 | 1.00 | 0.25 | +0.75 |
| `review-group-logic-bug` (regression) | 0.93 (3 runs, old skill) | 0.87 (3 runs), 1.00 (3 runs) | - | - |
| `judge-levels` (regression) | - | 1.00 (3 runs) | - | - |

The judge already read `CLAUDE.md` before the change when a finding cited it by name; its skill change makes the check explicit and covers path-scoped `.claude/rules` and `--workdir`, where the judge read no instruction file before.

`review-group-logic-bug` failed its `read-part` grader (`Read` of `src/parse.js`) in one of three runs with the old skill and two of three with the new one, while `bug-found` and `finding-logged` passed: the reviewer read the new file whole through `git diff`, which the skill allows. The grader measured a tool choice, not the outcome, so this Change removes it; `bug-found` and `finding-logged` grade that the file was reviewed.

A run by hand in a separate project (`claude -p --plugin-dir`, the `monthly-report` fixture plus a `.claude/rules/jsdoc.md` with `paths: ["src/**/*.js"]`): `/bdk:review-group` reported the missing `@example` with `rule` `.claude/rules/jsdoc.md`, and `/bdk:judge` levelled it `should-fix`, citing the rule file's `paths`.

## Risks / Trade-offs

- [The reviewer reads more files per group] A few small files per directory level; the instructions are read once per group, not per file.
- [The root `CLAUDE.md` is already in context] Reading it again costs one Read; it makes the check explicit and keeps `--workdir` correct.
