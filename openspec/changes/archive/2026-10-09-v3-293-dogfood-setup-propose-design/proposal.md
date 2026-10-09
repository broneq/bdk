# Proposal

## Why

Tracks #293.

Dogfooding `/bdk:setup`, `/bdk:propose` and `/bdk:design` on this repository for #285 showed eleven defects: setup changed a project's own OpenSpec workflow without asking and had no E2E entry for a Claude Code plugin; propose ignored the project's Change naming rule; the design stage waited on background agents, had no rule for a second round of questions, a narrowed scope or a decision against a project rule, blocked the turn on a Lavish poll, left a CLI's options unsettled that one `--help` call answers, and ended its gate without one clear question. Each one makes a BDK user improvise or leaves the project in a state they did not choose.

## What Changes

- `/bdk:setup` keeps a `schema:` line it did not write: a project whose `openspec/config.yaml` names another schema is asked whether to switch to `bdk`, the recommended answer keeps the project's schema, and BDK Changes are still opened with `--schema bdk` (item 1).
- `/bdk:setup` writes a `plugin` E2E item (driver `cli`) for a Claude Code plugin, and `e2e-check` drives such an item through a `claude -p ... --plugin-dir` session in a scratch directory (item 2).
- `/bdk:setup` reports a removed v2 ignore rule as its own line, naming the rule, its file and why (item 3).
- `/bdk:propose` names a Change by the project's naming rule (`rules.proposal` of `openspec/config.yaml`) when it has one (item 4).
- `/bdk:design` starts every block in the foreground and waits for it (item 5).
- `design-draft` asks in rounds: a follow-up round only for decisions the answers opened, at most three rounds in all (item 6); it owns `proposal.md` edits when an answer changes the scope (item 7); it confirms and records a user decision that contradicts the issue's acceptance signal or a project rule as a `Deviation:` line, and `/bdk:design` names each deviation at the gate and in its report (item 8).
- The designer opens the Lavish page and hands back; the thread that started it polls the page, and a user who stops the wait gets the page path and the open decisions, and the queued feedback is applied on resume (item 9).
- `explore` and `verify-design` settle a CLI's options with its read-only help command before calling them unsure (item 10).
- The design gate ends on exactly one question, also when `AskUserQuestion` is not available (item 11).
- New and extended eval cases show each changed behaviour.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-setup`: an existing OpenSpec schema is kept unless the user agrees; a Claude Code plugin gets an E2E item; a removed ignore rule is reported; new eval cases.
- `bdk-propose`: the Change name follows the project's naming rule; new eval case.
- `bdk-design`: blocks run in the foreground; the orchestrator polls a Lavish page the designer opened; deviations are named at the gate; the gate ends on one question.
- `design-blocks`: question rounds, scope changes in `proposal.md`, deviations, the hand-back Lavish mode, CLI help in explore and verify-design; new and extended eval cases.
- `bdk-e2e-check`: the `cli` driver drives a Claude Code plugin item through a `claude -p` session.

## Out of scope

- Writing the deviation back to the GitHub issue: no design-stage block writes to GitHub; the user updates the issue (design.md D7).
- A settings key for the number of question rounds: fixed at three until a run shows a need (design.md D5).
- The other changes to `skills/setup/` of #284; whichever lands second rebases.

## Impact

- `plugins/bdk/skills/setup/` (`SKILL.md`, `references/e2e.md`), `skills/propose/SKILL.md`, `skills/design/SKILL.md`, `skills/design-draft/SKILL.md`, `skills/explore/SKILL.md`, `skills/verify-design/SKILL.md`, `skills/e2e-check/references/drivers.md`, `agents/explorer.md`, `agents/designer.md`, `agents/verifier.md` (one line on help commands).
- `plugins/bdk/evals/`: new cases `setup-existing-openspec`, `setup-claude-plugin`, `propose-naming-rule`, `explore-cli-options`, `design-draft-follow-up-round`, `design-draft-scope-narrowed`; graders added to `design-fresh-auto-gate`, `design-manual-gate-no-ask`, `design-draft-lavish`; `evals/README.md`.
- User docs: `docs/guide/first-run.md` (schema kept, plugin E2E item, ignore rule), `docs/concepts/orchestrators.md` (design stage: rounds, Lavish hand-back, gate), `docs/concepts/e2e.md` (plugin item); Reference regenerated with `pnpm docs:reference`.
