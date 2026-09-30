# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T40. Tracks #60.

The v3 skill layer rests on an unproven assumption: a model steered by kernel output (`bdk next` -> do -> report) does no worse than one steered by a long SKILL.md (design risk "Unconfirmed assumption: thin skills"). T41 rewrites every stage skill in one style or the other, so the answer is a gate for T41. T31 needs to know which rules are no-ops before it numbers them (T5). Both need one measurement harness with an A/A noise floor (assumption B4), which today does not exist: `tests/evals/` holds hand-graded iterations of v2 skills with no repeat, no noise floor and no fixture. Input carried over by citation: design "Testing Strategy - Skill behaviour", success criterion "Evals", assumption B4, risk "Unconfirmed assumption: thin skills", T5, P10; T02 decisions R-6, R-10 (closes OD-8), R-16 (Serena measured in T03, not here).

The user took five decisions on 2026-09-28 (Lavish review `.lavish/v3-t40-questions.html`): three arms instead of two (v2 baseline, v3-long, v3-thin), Opus 5.5 as the orchestrator with a hard budget stop of 100 USD, 5 runs per cell, local runs only with a model-free config check in CI, and `kamkie/technical-interview-frontend` at a pinned commit as the fixture repository.

## What Changes

- New `evals/` directory: a promptfoo harness with its own pinned tool package (`evals/package.json`: promptfoo and `@anthropic-ai/claude-agent-sdk`, provider `anthropic:claude-agent-sdk`), plus Node harness modules for fixture preparation, run isolation, metrics, the noise rule, the budget stop and report tables. One command per suite: `pnpm eval <suite>`; nothing is added to the kernel bundle.
- Fixture: `kamkie/technical-interview-frontend` fetched at run time at commit `946a2081f84381ffc3b4a494467479a5b6886ead` (Vite, React, TypeScript, 28 vitest files, Node 24), never vendored (the repository has no licence); its agent configuration and instructions (`.claude/`, `.agents/`, `CLAUDE.md`, `AGENTS.md`) are stripped; every run gets a fresh copy. Task texts, v2 and v3 plans, hidden acceptance tests and seeded-violation diffs are BDK's own files under `evals/`.
- Suite `execute-ab` (measurement A), three arms on the same task and fixture:
  - `v2`: `subagent-execute-plan` from tag `v2.7.0` on a v2 plan file (baseline);
  - `v3-long`: approach B, a long execute skill that writes the step order itself and calls the stage commands;
  - `v3-thin`: a <= 200-line execute skill that loops `bdk next` -> do -> report.
    `v3-long` vs `v3-thin` is the T41 gate; `v2` vs `v3-long` is the kernel effect; `v2` vs `v3-thin` the total effect. A/A on `v3-long` (5 + 5). Metrics: acceptance tests, step completeness, cost, turns, wall time for all arms; correctness of `bdk` calls, kernel refusals and envelope length for the v3 arms.
- Suite `rules-noop` (measurement B, the harness side of T31's measurements 1 and 2): a blind knowledge test per rule bullet on Haiku 4.5 and Sonnet 5 with one judge, and a task ablation (review of seeded-violation diffs with and without the rules file) with an A/A noise floor. Output: a per-bullet table handed to T31.
- Suite `with-without`: a reusable mode that runs any skill's task set with the skill and without it, used for `bdk-craft` admission (R-6).
- Budget: every suite prints running cost and stops at the configured budget (100 USD for all of T40); a probe mode runs one run per arm and prints the projected cost of the full series, which the user approves before it runs.
- Every result row carries the model ids, the fixture commit, the BDK commit, the skill variant hash and the `template-hash` of the dispatch packages (P10).
- CI: a job validates the promptfoo configs and runs the harness unit tests without any model call.
- Two reports: `docs/V3-EVAL-EXECUTE-AB.md` (noise floor, per-arm numbers, decision: thin skills or fallback B) and `docs/V3-EVAL-RULES-NOOP.md` (noise floor, per-bullet table, handed to T31).
- `tests/evals/` marked for removal in T32 (a notice in the directory and in T32's scope); `.claude/rules/skill-test-eval.md` points new evals to `evals/`.

## Capabilities

### New Capabilities

- `skill-evals`: the measurement harness - one-command suites, pinned and isolated fixture, three-arm execute A/B, rules no-op measurement, with / without mode, A/A noise rule, budget stop, run provenance, model-free CI check, the two reports and the retirement of `tests/evals/`.

### Modified Capabilities

None. The harness drives the shipped plugin and kernel as they are; kernel behaviour does not change.

## Impact

- New: `evals/` (harness modules and their unit tests, promptfoo configs, suite data, the two execute skill variants), `docs/V3-EVAL-EXECUTE-AB.md`, `docs/V3-EVAL-RULES-NOOP.md`.
- Changed: `package.json` (`eval` script; no new root dependency, the tools live in `evals/package.json`), vitest config (harness unit tests in the unit project), `.github/workflows/tests.yml` (config check job), `.gitignore` (`evals/.runs/`), `CLAUDE.md` and `README.md` (layout and commands), `.claude/rules/skill-test-eval.md`, `tests/evals/` notice, `docs/V3-IMPLEMENTATION-PLAN.md` (T32 scope line, T40 resolution).
- Cost: model calls on the user's API key or Claude Code login, capped at 100 USD for all of T40; runs are local only.
- Out of scope: writing the real stage skills (T41; the `v3-thin` variant is its draft only when it wins); rule IDs, `applies`, the learning funnel and the COVERED thresholds that decide removal (T31: T40 delivers the data and a provisional classification); removing `tests/evals/` and pytest (T32); `bdk-craft` admissions themselves (T42); Serena (T03, done).
