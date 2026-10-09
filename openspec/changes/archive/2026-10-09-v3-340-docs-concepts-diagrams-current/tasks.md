## 1. SDLC rule

- [x] 1.1 Name the diagrams in the SDLC "Docs" rule of `CLAUDE.md` and in the `tasks` rule of `openspec/config.yaml` (design D1). Verify: `openspec instructions tasks --change v3-340-docs-concepts-diagrams-current --json` prints the new rule.

## 2. Docs

- [x] 2.1 `docs/concepts/cli-config-hooks.md`: slice graph with `diagnostics`; `bdk rules for` for `/bdk:design`, `/bdk:plan`; keys per stage by design D2; Hooks sequence and prose by design D7.
- [x] 2.2 `docs/concepts/run-state.md`: run-status decision by design D3; Execute sequence by design D4.
- [x] 2.3 `docs/concepts/orchestrators.md`: `/bdk:setup` step 9 Playwright; waves diagram skips the wave check when a part is blocked; `/bdk:debug` stop for manual triage; new `/bdk:diagnose-run` section (design D5) and its skill in Sources.
- [x] 2.4 `docs/concepts/workflow.md`: `/bdk:run` stops for "no arguments, no `run.json`" and on a dirty tree before the switch.
- [x] 2.5 `docs/concepts/agents.md`: "Who starts whom" by design D6 and the step 0 prose.
- [x] 2.6 Run `pnpm docs:reference`. Verify: no diff under `docs/reference/`.

## 3. Acceptance

- [x] 3.1 Re-read every Concepts diagram against `plugins/bdk/skills/*/SKILL.md`, `plugins/bdk/agents/`, `plugins/bdk/src/`; no mismatch left.
- [x] 3.2 Build the site and view every changed page in light and dark at 1280 px and 390 px; screenshots of every changed diagram reviewed.
- [x] 3.3 Run every check of `.github/workflows/` (`pnpm check`, the `docs` job build and `docs:diagram-fit`, the plugin validation, commitlint), `openspec validate v3-340-docs-concepts-diagrams-current --strict` and `openspec validate --specs --strict`.
