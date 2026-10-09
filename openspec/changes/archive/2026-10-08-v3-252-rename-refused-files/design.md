# Design

## Context

See proposal.md - Why. The host rule, read from the Claude Code 2.1.294 code: in the `Write` tool's input check, `if (agentId && /^(REPORT|SUMMARY|FINDINGS|ANALYSIS).*\.md$/i.test(basename(path)))` the write is refused (`tengu_subagent_md_report_blocked`). It applies to `Write` from any subagent, on the base name only, case-insensitive, anchored at the start. A shell or Node write is not checked.

Inventory of the Markdown files BDK writes in a run (grep of `plugins/bdk/skills`, `agents`, `src` for `*.md` names): `design/explore.md`, `design/verify-N.md`, `plan/verify-N.md`, `plan/parts/NN.md`, `execute/part-NN.md`, `execute/conform-NN.md`, `execute/merge-NN.md`, `execute/result.md`, `review/round-N/round.md`, `review/round-N/report.md`, `review/round-N/posted.md`, `review/round-N/fixes/index.md`, `fixes/parts/NN.md`, `fixes/result.md`, `review/result.md`, `e2e/<scenario>.md`, `e2e/verdict.md`, `close/spec-conformance.md`, `close/pr.md`, `close/pr-body.md`, `debug/diagnosis.md`, `debug/reproduction.md`, `pr.md`, `result.md`, and the project files (`proposal.md`, `design.md`, `spec.md`, ADRs). Only `report.md` matches. `findings.jsonl` does not end in `.md`.

`report.md` is written today by `bdk findings report` (#193 D6), never by `Write`, so no run fails on it now. #193 D6 kept the name because `report.md` is the round record of specs `bdk-cli/git` and `bdk-cli/run`; #252 decides the other way, and this Change follows the issue.

## Goals / Non-Goals

**Goals:**
- No BDK file name the host refuses for a subagent, so a block that falls back to `Write` (a CLI failure, a fix of the record by hand in a later step) is never refused.
- A test that keeps the rule, since the next file name a skill picks is the next chance to repeat #200's `summary.md`.

**Non-Goals:**
- Migrating run directories written before this Change: v3 is unreleased (no `bdk--v*` tag yet, #213).
- Renaming the `bdk findings report` command or its JSON key `report`: neither is a file name.
- Other review round work (#263, #264, #265).

## Decisions

### D1. The round record becomes `review/round-N/review.md`

`review.md` says what the file is (the review of round N: findings by level, decisions) and sits beside `round.md` (the lead's account of how the round ran), `groups.json`, `findings.jsonl` and `posted.md`. No other run file is named `review.md` (grep), and it does not match the host pattern.

Alternatives: `levels.md` - lost, the file also holds triage decisions. `judged.md` - lost, triage rewrites it after the judge. `round-report.md` - lost, it passes today's anchored pattern only by its prefix and reads like `round.md`. `verdict.md` - lost, `e2e/verdict.md` already means a PASS/FAIL line. Keep `report.md` (#193 D6) - lost, the issue decides to rename, and a name one widening of the host heuristic away from refusal stays a risk for every block that touches it.

### D2. A test enforces the rule

`plugins/bdk/tests/refused-names.test.ts` reads every file under `skills/`, `agents/` and `src/` (outside `src/**/tests/`), collects the Markdown file names in it (tokens ending in `.md`), and fails on a base name matching the host pattern, naming file and name. The pattern is copied from the host with a comment naming its source; a host that widens it is caught by the next eval run, as #200 caught `summary.md`. The test fixes the regex against `summary.md`, `Report.md`, `FINDINGS-1.md`, `analysis.md` and passes `review.md`, `round.md`, `result.md`.

Alternatives: a rule in `.claude/rules/` - lost, the violation is silent until a subagent run, and a test catches it in `pnpm check` (CLAUDE.md capture routing: what a test enforces needs no rule). An ESLint rule - lost, most names live in skill Markdown, not TypeScript. A hook that rewrites the name at runtime - lost, a hook would hide a broken skill and the host already refuses.

### D3. Skill edits are a file-name substitution, not a rewrite

The skills change only the file name they read, wait for or report. CLAUDE.md asks for `/skill-creator` when a skill is built or rewritten; a name substitution changes no instruction, so the skills are edited in place and checked with `skill-check` (bdk-skill-kit). Their existing eval cases cover them: the graders and fixtures move to `review.md`, and the review round case `auto-review-first-round` runs once as the acceptance signal, with `judge-levels` as the cheaper block check of `bdk findings report` from a subagent.

Alternatives: rewrite each skill with `/skill-creator` - lost, nine skills re-authored for one word would drift text the merged evals measured.

### D4. Eval graders named `report-*` follow the record

Grader files `report-written.md`, `report-refreshed.md`, `round2-report.md` are renamed to `review-written.md`, `review-refreshed.md`, `round2-review.md`. They are read by `claude plugin eval`, not written by an agent, so the host rule does not touch them; the rename keeps the grader name equal to the file it grades.

## Risks / Trade-offs

- [A run directory from before this Change holds `report.md`, which `bdk git scope` and `bdk run status` no longer see] -> v3 is unreleased; the round reruns, as a crashed round does (row 6).
- [The host pattern widens to a name BDK uses] -> the eval runs fail at the `Write`, as #200 found; the test's pattern is updated in the same PR as the rename.
- [Other agents' open PRs (#245, #256) name `report.md`] -> announced in Herdr; the later rebase adopts `review.md`.

## Migration Plan

None: unreleased. Rollback is a revert of the commit.

## Eval runs

One run each, `--ablation none`, Claude Code 2.1.292 (pinned), on a Mac with the clean `HOME` and the git shell prefix of the eval README's "Host limits":

| Case | Score | Graders | Time | Cost |
|---|---|---|---|---|
| `judge-levels` (block, `bdk:judge` subagent) | 1.00 | 7/7; `review-written`: `review/round-1/review.md` exists | 31 s | $0.27 |
| `auto-review-first-round` (orchestrator; round in a `bdk:lead` subagent, judge under it) | 1.00 | 12/12; `review-written`, `round-written`, both seeded bugs under `## blocker` of `review.md` | 212 s | $1.16 |

The orchestrator case needs `SendMessage` granted (its `allowed_tools` lists it; without the grant the loader reports "not granted: SendMessage"); the eval README's command for the `auto-review-*` cases now grants it.
