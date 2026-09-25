# Design

## Context

See proposal.md - Why and What Changes for motivation, the observed counts and the scope.

Facts that shape the approach (observed on `staging/v3` at 7d147cd, 2026-09-24):

- Skill size is not only `SKILL.md`. Several skills carry a `references/` directory that is loaded on demand (e.g. `subagent-execute-plan`: `SKILL.md` 661 lines plus a 49.4 KB `references/`; `design`: 374 lines plus 18.5 KB). S1 caps `SKILL.md` at 200 lines, so a skill can pass S1 by moving process text into `references/` without moving it into the kernel.
- `!` blocks: every meta-skill has exactly one; among user skills, `create-plan` has 12, `debug` 5, `design` 4, `cr` and `test-driven-development` 3 each, and six more have one.
- Frontmatter `hooks:` exist in `commit`, `create-plan`, `explain-complex-code`, `update-docs` (listed in the design's "Existing Codebase Context", bullet "Hooks today").
- The design's "Existing Codebase Context", bullet "TSH revision grounding", already records agent tool sets, the missing destructive-git ban in `implementer` / `fixer`, and the STARTUP agents-table drift. T02 re-verifies these rather than copying them.
- The plan's "To resolve in the spec" for T02 asks only for the output format and the criteria. Decisions on the fate of each item are the user's, taken on T02's output (plan, T02).

## Goals / Non-Goals

**Goals:**
- A review a T41 / T42 implementer can act on without re-reading today's skills: every row has evidence with a file:line citation and a single target task.
- Criteria defined once, applied identically to every item, so two reviewers would reach the same disposition from the same evidence.

**Non-Goals:**
- Final decisions on dispositions (the user decides; T02 recommends).
- Drafting the new skill bodies, role meta-skill bodies or the envelope format (T23, T41, T42).

## Decisions

### D-1 Output: one Markdown document with fixed sections

`docs/V3-SKILL-INVENTORY.md` with these sections, in order:

1. **Baseline** - commit hash the counts were taken at, and the counting method (commands), so a later reader can recount.
2. **Criteria** - the disposition vocabulary (D-2) and the process vs knowledge test (D-3), copied from this design so the document stands alone.
3. **User skills** - table: skill / `SKILL.md` lines / `references/` size / `!` blocks / frontmatter hooks / `allowed-tools` / process share / disposition / target name / rationale / target task.
4. **Merge and rename candidates** - one subsection each for `create-plan` + `verify-plan` -> `plan`, `add-rule` + `refine-rules` -> `rules`, `design` + `create-adr`, and the renames `test-driven-development` -> `tdd`, `update-docs` -> `docs`: for / against / recommendation.
5. **Meta-skills and role classes** - table: meta-skill / lines / consumers (agents whose `skills:` preload it) / disposition; then the agent -> `bdk-role-<class>` mapping with, per agent, what content it loses and what it gains.
6. **Agents** - table: agent / model / `tools:` (verbatim) / preloaded skills / P3 conflicts / T3 conflicts / input-output contract changes / disposition / target task.
7. **`cr` and `pr-review` package input** - how each should accept the dispatch package (T23) without redesign.
8. **T40 A/B subject** - the recommended skill (and an optional second) with the reason.
9. **Dev-time lint -> A3** - per check in `skill-lint` and `agent-lint`: becomes a CI content test / stays dev-time / dropped.
10. **Side findings** - defects seen during the review that belong to other tasks, each tagged with its task ID.
11. **Open decisions** - `OD-n`: question / options / recommendation / affected task, plus the user's decision per item once the review comes back.
12. **Follow-up review rounds** - topics the user's review reopens beyond single rows (`R-n`, `Q-n`): proposal and decision per topic.
13. **Inventory after the review** - the resulting skill and agent list and its impact on the plan, per task. This is the section T41 / T42 read first; sections 3-6 are the evidence behind it.

Alternatives considered: one file per item (loses the side-by-side comparison T41 / T42 need and multiplies files the T32 cleanup must track); a Lavish or HTML review board (the repo rule makes `.md` authoritative, and the board would duplicate the table). A board may still be used to collect the user's decisions on the open decisions, as a presentation of the `.md`, not a second source.

Sections 12 and 13 were added after the first review round reopened the frame of the inventory (package split, roles as skills, rules mechanism). Their decisions change other tasks, so they are carried into `docs/V3-IMPLEMENTATION-PLAN.md` in the same Change rather than left for T41 / T42 to rediscover.

### D-2 Disposition vocabulary

| Disposition | Meaning | Typical target |
|---|---|---|
| stays | Purpose and structure survive; may be renamed, trimmed under S1, and moved onto `ctx` `!` blocks | T42 |
| merges | Absorbed into another item; the row names the absorbing item | T41 or T42, per the absorbing item |
| redesign | Rewritten as a thin kernel-driven loop (`next` -> do -> report); most of its text is process | T41 |
| removed | No v3 counterpart; the row names what replaces it (kernel command, CI test, nothing) | T32 (deletion) |

A rename alone is "stays" with the new name in the target-name column, not a separate disposition. Alternative considered: adding "rename" and "split" as dispositions; rejected because rename carries no design work and no item today is a split candidate (the review may add one via an open decision if it finds one).

### D-3 Process vs knowledge test

Applied per section (heading) of `SKILL.md` and each `references/` file, counted in lines:

- **Process** (moves to the artifact graph / kernel, T21-T23): orders stages, decides what runs next, tracks or persists state, counts iterations or attempts, gates on approval, writes files at fixed paths, retries or escalates, formats envelopes.
- **Knowledge** (stays in the skill or a rule): how to do the domain work well - heuristics, checklists, quality criteria, templates of the produced artifact, domain vocabulary.
- **Wiring** (moves to `ctx` / frontmatter): `!` blocks, settings lookups, tool-tier injection, `allowed-tools`.

The table's "process share" column is process lines / total lines. A skill with a process share above half is a redesign candidate; this is a guide for the rationale, not an automatic verdict. Alternative considered: classifying whole skills without line counts; rejected because the S1 argument for T41 needs the number.

### D-4 Evidence standard

Every rationale cites the file and line it rests on. Claims from the design's "Existing Codebase Context" are re-checked by direct reads; where the design and the code disagree, the code wins and the disagreement goes under Side findings. Counts come from commands recorded in the Baseline section, not from the plan or the design (the plan's "19 user skills" is already contradicted by the observed 16).

### D-5 Agent conflict detection (P3, T3)

- P3: search each agent body for statements about approval or moving on (approve, LGTM, pass, ready to merge, proceed) and judge each hit by reading it; a hit is a conflict only when the agent is told to authorise, not when it reports a verdict category.
- T3: record whether the agent has Bash and whether its body forbids or permits the git commands T3 lists. Absence of a ban is recorded as-is; T3's guarantee is the `PreToolUse` hook (T24), so the finding feeds T24 and T42, not a prose fix.

Tools lists are copied verbatim from frontmatter; T2 keeps them unchanged, so any recommendation to change `tools:` is an open decision, never a disposition.

### D-6 T40 A/B subject criterion

Pick the stage skill with the highest process share whose v3 counterpart is a T41 stage skill, so the A/B measures exactly the thin-loop assumption. The design recommends `execute` or `design`; `subagent-execute-plan` (661 lines, largest `references/`) is the expected answer, and the review confirms or overturns it with the D-3 numbers.

## Risks / Trade-offs

- [Anchoring on the design's PoC inventory] -> Fill the evidence columns before writing the disposition for each row; state explicitly in the rationale where the result departs from the design's proposal.
- [Counts drift while T01 and other branches land] -> Pin the baseline commit; T41 / T42 recount against it.
- [`references/` hides process from the S1 count] -> The table reports `references/` size next to `SKILL.md` lines, and D-3 classifies `references/` content too.
- [Review is large (42 items) and could be shallow on the tail] -> Every row needs a citation (D-4); the task list checks row completeness before the open-decisions section is written.
