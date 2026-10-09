## Why

Tracks #340.

The Changes that added the wave check (#317), `/bdk:diagnose-run` and `bdk diagnostics` (#322) and the Playwright step of `/bdk:setup` updated the tables and prose of the Concepts pages but not their diagrams. On five pages a diagram now contradicts the code or the table next to it: the CLI slice graph lacks `diagnostics`, the run-status decision and the execute sequence lack the waves, the `/bdk:setup` flow lacks Playwright, the per-stage command and key diagrams miss commands and keys the tables list, `/bdk:diagnose-run` has no section, and a few exits are missing. The SDLC docs rule names "pages", so a Change that adds a step updates the table and leaves the diagram that draws the flow behind.

## What Changes

- `docs/concepts/cli-config-hooks.md`: the slice graph gains `diagnostics`; the commands-along-the-stages diagram gains `bdk rules for` for `/bdk:design`, `/bdk:plan`; the keys-per-stage diagram gains `models.lead` for `/bdk:execute`, `tools.test` for `/bdk:plan`, and for `/bdk:auto-review` the lead, round, rules and fix-pass keys its blocks read; the Hooks sequence and prose say the session start context is five lines whose first names the project root.
- `docs/concepts/run-state.md`: the run-status decision keeps execute open while a wave is not done or blocked; the Execute sequence draws the wave check (`bdk check run wave-N`, `checks/wave-N.json`), the repair by `/bdk:resolve-conflict --wave` (`execute/wave-N.md`) and its commit by the lead, and the waves in `state.json`.
- `docs/concepts/orchestrators.md`: `/bdk:setup` gains the Playwright step; the waves diagram skips the wave check when a part of the wave is blocked; `/bdk:debug` gains the stop for manual triage; a new `/bdk:diagnose-run` section with its diagram, and the skill in Sources.
- `docs/concepts/workflow.md`: the `/bdk:run` diagram gains the stop for "no arguments, no `run.json`" and the stop on a dirty tree before the switch.
- `docs/concepts/agents.md`: "Who starts whom" shows `bdk:analyst` started by step 0 of `/bdk:diagnose-run`, and the prose names the blocks that have no step 0 and run in the main thread.
- The SDLC docs rule (`CLAUDE.md`, the `tasks` rule of `openspec/config.yaml`) names the diagrams: a Change that adds, removes or reorders a step updates the diagram that draws that flow, not only its tables and prose.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs-site`: a new requirement "Concepts diagrams match the sources".
- `repo-sdlc`: "Behaviour-changing Changes update the docs" names the diagrams of the Guide and Concepts pages.

## Impact

- Docs pages updated: `docs/concepts/cli-config-hooks.md`, `docs/concepts/run-state.md`, `docs/concepts/orchestrators.md`, `docs/concepts/workflow.md`, `docs/concepts/agents.md`. The Reference is unchanged (`pnpm docs:reference` leaves no diff).
- Repository rules: `CLAUDE.md` (SDLC "Docs"), `openspec/config.yaml` (`tasks` rule).
- No skill, agent, hook, `bdk` command or settings key changes; no eval case is needed.
- Out of scope: the contrast of diagram error text (#333); the `docs/design/` records, which are dated and historical.
