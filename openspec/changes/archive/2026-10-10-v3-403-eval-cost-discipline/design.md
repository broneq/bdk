# Design

## Context

See proposal.md, "Why". The suite and its run command come from `v3-189-eval-setup` (spec `skill-evals`); the rule that a block stays only when it changes the outcome comes from ADR-0003 and the architecture design "Evals and the development rule". The eval README already offers a cheap probe (`--runs 1 --ablation none`) and names `--max-cost-usd` among "useful" flags, but says nothing about when to use them, and no rule asks a measuring Change to record its total cost. Costs below are the API-equivalent USD that `claude plugin eval` and the `total_cost_usd` / `cost-state` of a run report.

## Goals / Non-Goals

**Goals:**

- The author of a paid measurement reads, before running it, how to keep it small and when a full B1 run is worth it.
- Every measuring Change states what it spent, so the cost of a phase can be read back.

**Non-Goals:**

- Enforcing a budget in code (`run.ts` refusing a run without `--max-cost-usd`): see D3.
- Changing any skill, case or recorded result.

## Decisions

### D1. The rules are a requirement of spec `skill-evals`, told in the eval README

The rules go into the README part "Before a paid run", which every paid run of the `bdk` suite starts from, and the spec makes the part a requirement with a free check that its key flags stay named.

- _README text only:_ nothing keeps it from being edited away, and the issue asks the spec to decide. Lost.
- _A new `.claude/rules/` file scoped to `plugins/*/evals/**`:_ loads when a case file is edited, not when a run is planned in an issue or a design; the README is where the run command is copied from. Lost.

### D2. Both arms for the admission question, one arm to confirm a fix

A block case still holds graders valid in both arms, so it can answer the ADR-0003 question at any time; the README runs both arms for that question only and `--ablation none` for confirming a fix or a regression. Most recorded runs already did this (`implement-part-present-behaviour`, `execute-*`, `debug-*`), so the requirement catches up with practice and halves the cost of a confirmation run.

- _Always both arms (the spec today):_ the without-arm answers a question nobody asked when confirming a fix, and doubles the cost. Lost.
- _Drop the without-arm from block cases:_ loses the evidence ADR-0003 keeps a block on. Lost.

### D3. A budget in the issue and a total in the design, no code gate

An issue that pays for runs carries a `Budget` section (`CLAUDE.md` SDLC "Create", and the issue sections listed in `openspec/config.yaml` `context`), and a measuring design records its total (a design rule in `openspec/config.yaml`). The README asks for `--max-cost-usd` on every command.

- _`run.ts` refuses a run without `--max-cost-usd`:_ blocks the `bdk-craft` and `bdk-explain` runs that call `claude plugin eval` directly, and a missing ceiling was not the failure the review found; unrecorded totals and unneeded runs were. Lost.
- _A cost ledger file in the repository:_ a second record of what each design already holds. Lost.

### D4. Full B1 runs discover, snapshots and block cases confirm

The README says a full unattended `/bdk:run` on a B1-sized fixture is for discovery (it found #265, #382, #391, #373 and #374, which no block case had shown), and a fix is confirmed on a snapshot of a built workspace (#370: about $3 against $8-15) or by the block case that guards it. Before any run, check that the fixture reaches the path under test (#264's B1 run never reached the test-only path) and that merged work does not already answer the question (#263 confirmed an order #317 had already fixed).

### D5. A flaky case is accepted by its cause

At a 1-in-8 failure rate, 10 passing runs in a row happen with no fix about 26% of the time (0.875^10). The README part "Flaky cases" asks to keep a failing run (`--keep-temp`), read the cause in its trace, remove it, and only then count passing runs.

## Risks / Trade-offs

- [The rules are text an author can ignore] → The `Budget` section is part of the issue body every issue is created with, and the design rule is read at each `/opsx:propose`; the free check keeps the README part from silently going.
- [A sonnet agent hides an opus-only behaviour] → The README pins sonnet only when the case does not measure the main thread's model, and recorded runs name their model.
