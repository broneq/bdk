# Proposal

## Why

Tracks #195. After the judge levels the findings of a review round, someone has to decide what happens to each one: fix it, accept it, or defer it. Without that decision the review loop cannot tell which findings the fix pass covers (resume table rows 7 and 8 of spec `bdk-cli/run`), and an autopilot run has no recorded reason for what it fixed and what it left. The architecture ("Findings and triage", block table row `triage`) assigns this job to one main-thread block.

## What Changes

- New block skill `triage` in `plugins/bdk/skills/triage/` (`/bdk:triage`), run in the main thread: it reads the folded findings of one judged round with `bdk findings list`, decides every undecided finding, records each decision with `bdk findings decide`, and refreshes the round report with `bdk findings report`.
- Auto mode (`policy.gates.review: auto`): the fixed policy of D3 (`docs/design/2026-10-07-v3-skills-decisions.md`) decides by level, with a recorded reason on every decision; no page and no question.
- Manual mode: the model writes one Lavish page of the findings following the `lavish-axi` playbooks, the policy answer preselected as the recommendation; when the page cannot open, `AskUserQuestion`; when that is not available either, the questions in the reply (D4: Lavish is optional).
- A `defer` with a GitHub issue happens only when the user chooses it in manual triage; BDK creates an issue only on that choice (D3).
- `bdk findings decide ... defer` no longer requires `--issue`: D3 defers `nice-to-have` findings without an issue, which the current CLI rejects. `--issue` with `fix` or `accept` stays an error.
- Eval cases on a judged round of the shared `monthly-report` fixture: auto mode by policy (the acceptance signal), manual mode through a Lavish page, and the fallback without Lavish.

## Capabilities

### New Capabilities

- `triage-block`: the `triage` block skill - which round it triages, the auto-mode policy, the manual decision surfaces, how decisions are recorded, and its eval cases.

### Modified Capabilities

- `bdk-cli/findings`: a `defer` decision takes an optional issue instead of a required one.

## Impact

- `plugins/bdk/skills/triage/` (new), `plugins/bdk/evals/triage-*` and a shared fixture of a judged round (new), `plugins/bdk/evals/README.md`.
- `plugins/bdk/src/findings/` (`domain/events.ts`, the `decide` command text and tests): shared CLI slice, announced to the other agents.
- Out of scope: the `/bdk:auto-review` orchestrator that runs rounds, triage and the fix pass, and the `policy.budgets.review-rounds` limit on `should-fix` fixes (#201); `/bdk:setup` reporting which decision surface a project gets (D4) belongs to the setup skill.
