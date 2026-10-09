# Tasks

## 1. Settings: `rules` as a record of rule entries (`bdk-cli/config`)

- [x] 1.1 Write failing tests in `plugins/bdk/src/config/tests/` for the "Settings keys" scenarios of the delta: "Rule id keeps its case" (`bdk config set rules.API-1.enabled false --layer local`, `show rules.API-1` with origins), "Text and file both set", "Pack rule given a text", "Knowledge rule without source", "Removed rules.disabled", plus a project rule whose `text` comes from the project layer and `enabled: false` from the local layer validating cleanly (the full-merge-only check of design D2); verify they fail with `pnpm --filter @bdk/bdk test`.
- [x] 1.2 Replace `rules` in `plugins/bdk/src/config/domain/settings.ts` with `z.record(RuleId, RuleEntry)` (design D1, D2): all fields optional, descriptions stating the defaults, `entry: "id"` and an example with an inline rule, a `file` rule and a `BDK-` adjustment; export `RULE_STAGES` and `RULE_KINDS` through `config/index.ts` (D3); make the 1.1 tests pass.
- [x] 1.3 Report the "neither `text` nor `file`" and "`knowledge` without `source`/`verified`" checks only on the full merge in `domain/validate.ts` (D2); verify with the 1.1 test of a rule split across layers and an existing `validate` test run.
- [x] 1.4 Write a failing test that `loadConfig` in the `ok` state returns `files` and `origins` (D4), then add them in `use-cases/load.ts` using `withOrigins`; verify the test passes and the `config show` tests stay green.

## 2. `bdk rules for` reads rules from the configuration (`rule-pack`, `bdk-cli/rules`)

- [x] 2.1 Write failing tests in `plugins/bdk/src/rules/tests/` for every scenario of the `rule-pack` and `bdk-cli/rules` deltas: inline and `file` project rules (frontmatter skipped), defaults of a minimal rule, a `global` rule with its `file` resolved against the global layer directory, `.bdk/rules/` not read and no warning, `enabled: false` in a local layer, `BDK-REACT-10` narrowed, unknown `BDK-` id warning, no warning for `languages: [python]`, origin and `file` of a rule set in two layers, ordering `bdk`, `global`, `project`, `local`, `env/invalid-rule` for a missing `file` naming `rules.<id>.file`, `env/config-invalid` for an invalid entry and for a duplicate YAML key; verify they fail.
- [x] 2.2 Add the test that `RULE_STAGES`/`RULE_KINDS` from `config/index.ts` equal `STAGES`/`KINDS` of `rules/domain/rule.ts` (D3); verify it passes.
- [x] 2.3 Implement design D5: a pure `domain/` function that builds a project `Rule` from a resolved entry (defaults, origin, `language: null`, text from `text` or a stripped file body) and applies `BDK-` entries to pack rules with the "names no rule" warning; drop `disabled` and the language warning from `domain/select.ts`; set `ORIGIN_ORDER`; widen the `origin` enum in `schema/for.ts`; read only the pack in `store/rules.ts`; read `file`s through `shared/fs` in `use-cases/for.ts` for enabled rules only. Verify the 2.1 tests pass.
- [x] 2.4 Update the `why` of the `rules` edge in `plugins/bdk/src/slices.ts` (it reads `languages` and `rules` entries with their origins); verify `pnpm lint` passes with no `boundaries/*` error.

## 3. Pack rules keep `plan` only where a plan decides

- [x] 3.1 Write a failing test for the scenario "Plan rules of the pack" (`bdk rules for --stage plan` with `languages: [typescript, react]` selects exactly `BDK-ARCH-3`, `BDK-ARCH-4`, `BDK-CQ-1`); verify it fails.
- [x] 3.2 Remove `plan` from `stages` of `BDK-CQ-4`, `BDK-TS-7`, `BDK-JS-8` and the seven `BDK-REACT-*` files under `plugins/bdk/rules/` (design D7); verify 3.1 and `plugins/bdk/tests/rule-pack.test.ts` pass.

## 4. Design blocks read design rules (`design-blocks`)

- [x] 4.1 Write the eval cases `design-draft-rules` and `verify-design-rules` under `plugins/bdk/evals/` (design D8), with scaffolds that declare `IO-1` (stage `design`) in `.bdk/settings.yaml` on `ledger-explored.sh` and on `ledger-designed.sh`, whose design breaks it; verify they load at zero cost with the free eval check in `pnpm test` and their scaffolds exit 0.
- [x] 4.2 With `/skill-creator`, add to `plugins/bdk/skills/design-draft/SKILL.md` the step that runs `bdk rules for --stage design`, follows each rule and names its id in the decision (D6); verify `design-draft-rules` with and without the plugin and the existing `design-draft-*` cases stay at or above their recorded scores.
- [x] 4.3 With `/skill-creator`, add to `plugins/bdk/skills/verify-design/SKILL.md` the rule check that makes a broken design rule a `Must address` item naming the id (D6); verify `verify-design-rules` with and without the plugin and the existing `verify-design-*` cases.
- [x] 4.4 Try `/bdk:design` with a `stages: [design]` rule in a separate test project started with `claude --plugin-dir`; verify the design cites the rule and the verifier fails a version that breaks it.

## 5. Plan blocks read plan rules (`bdk-plan-blocks`)

- [x] 5.1 Write the eval cases `plan-draft-rules` and `verify-plan-rules` (design D8) with `API-DOC-1` (stage `plan`, paths `src/**`) declared in the scaffold's `.bdk/settings.yaml`, on `ledger-change.sh` and on `ledger-planned.sh`, whose part `01` breaks it; verify they load at zero cost in `pnpm test` and their scaffolds exit 0.
- [x] 5.2 With `/skill-creator`, add to `plugins/bdk/skills/plan-draft/SKILL.md` the step that runs `bdk rules for --stage plan` without files and names a rule's id in the part or task that follows it (D6); verify `plan-draft-rules` with and without the plugin and the existing `plan-draft-*` cases.
- [x] 5.3 With `/skill-creator`, add to `plugins/bdk/skills/verify-plan/SKILL.md` the per-part `bdk rules for --stage plan --files <part files>` check and the `Must address` item naming the rule and the part (D6); verify `verify-plan-rules` with and without the plugin and the existing `verify-plan-*` cases.
- [x] 5.4 Try `/bdk:plan` with a `stages: [plan]` rule in a separate test project started with `claude --plugin-dir`; verify the plan follows it and `verify-plan` fails a part that breaks it.
- [x] 5.5 Record the with and without results of the four new cases in this design (D8) and add their run lines to `plugins/bdk/evals/README.md`; verify the README commands run as written.

## 6. Docs

- [x] 6.1 Rewrite `docs/concepts/rules.md`: rules declared under `rules` in the settings (inline and `file`, defaults, layers, `enabled: false`, adjusting a `BDK-` rule), the design and plan roles in the diagram and table, the removal of the "no design or plan step" note; verify the Mermaid block parses in `pnpm check`.
- [x] 6.2 Update `docs/guide/configuration.md` (the `rules` example, the merge note about `rules.disabled`, the Python note pointing at `.bdk/rules/languages/python/`), `docs/guide/footprint.md` (drop the `.bdk/rules/` row), `docs/concepts/cli-config-hooks.md` (`bdk rules for` callers, the keys each stage reads) and `docs/concepts/stages.md` (design and plan blocks read rules); verify `pnpm check` reports no name that no longer exists.
- [x] 6.3 Update `plugins/bdk/rules/README.md` (project rules in the settings) and the rules page intro in `scripts/docs-reference/render.ts` (D9); make `scripts/docs-reference/names.ts` accept `rules.<id>.<field>` keys if it rejects them, with a test; run `pnpm docs:reference` and verify `pnpm check` reports no stale Reference page.

## 7. Verification

- [x] 7.1 Check the Acceptance signal of #272 end to end in a separate test project with the built plugin (`pnpm build`, `claude --plugin-dir`): an inline and a `file` project rule selected with origin `project`; `bdk config show rules` with layers; `bdk config check` rejecting `text` plus `file` and a `BDK-` entry with a text; `BDK-CQ-4: {enabled: false}` in the local layer with a project entry still in force; the design and plan eval cases from groups 4 and 5.
- [x] 7.2 Run every check CI runs (`.github/workflows/pr.yml`: `pnpm check` and the other jobs), `openspec validate v3-272-rules-config --strict` and `openspec validate --specs --strict`; verify all pass.
