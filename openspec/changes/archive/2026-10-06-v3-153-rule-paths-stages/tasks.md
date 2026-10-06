# Tasks

## 1. Reproduce and record the baseline

- [x] 1.1 Build the bundle. In a fresh temporary git repository with `languages: [typescript]`, `rules.warn-above: 60`, only `.py` files in the work tree, and 30 project rules without `applies` (`origin: user`), run `bdk rules show --role design-verifier --file x.py --json`, `bdk ctx skill plan` and `bdk hooks session-start`. Verify the #153 symptoms: the design verifier reads all 30 project rules, the plan context holds the `BDK-TS` rules in a repository without TypeScript, and the session start warns. Keep the commands for the final check in 10.1.
- [x] 1.2 Record, before any code change, the rule ids each reader selects today in a fixture repository holding `.ts`, `.tsx`, `.js` and `pnpm-lock.yaml` files with `languages: [javascript, typescript, react]`: every role through `bdk rules show --role <role> --file <each file>`, the `ctx skill` entries `design`, `adr` and `plan`, and the instruction of the `plan` node. Save each reader's ids (a role: the union over the fixture files) as `kernel/tests/fixtures/rule-readers-baseline.json`. Verify it lists every reader of the Stage readers table.

## 2. Rule fields, stage vocabulary and the shipped pack (`kernel-state`, `rule-pack`)

- [x] 2.1 Write failing tests first: `shared/store/state/tests/rule.test.ts` requires `paths` and `stages`, refuses `applies`, `roles`, an empty list, `"*"` and an unknown stage (scenarios `rule without stages`, `old field names are refused`, `a rule for every file and every stage`); `kernel/tests/contract/rule-pack.test.ts` checks that each pack rule carries the `stages` and `paths` of its directory, and the lockfile globs for `BDK-CQ-9` (scenarios `pack rules state their stages and paths`, `lockfile rule admitted without measurement`, `plan rules exist`). Verify they fail.
- [x] 2.2 Replace `applies` and `roles` with `paths` and `stages` in `shared/store/state/rule.ts`, and add `RULE_STAGES` and `ROLE_STAGE` to `shared/vocabulary/index.ts` (design D-1, D-2). Verify the `rule.test.ts` cases pass.
- [x] 2.3 Rewrite every file under `rules/` with the `stages` and `paths` of its directory (design D-6), using a throwaway script that is not committed; `BDK-CQ-9` keeps its lockfile globs as `paths`. Update the rule fixtures `kernel/tests/fixtures/state/.bdk/rules/NODE-1.md` and `TQ-7.md` and every test helper that writes a rule file. Verify `bdk rules check` exits 0 in the repository and `rule-pack.test.ts` passes.
- [x] 2.4 Update `rules/README.md`: each rule states `paths` and `stages`, the stage table, and that a directory fixes a rule's stages. Verify the `rule-pack` content test that reads the README passes.

## 3. Selection and the rules commands (`kernel-cli/rules`)

- [x] 3.1 Write failing tests first in `rules/tests/selection.test.ts` and `show.test.ts`: a rule is selected only when `stages` holds the reader's stage and a `paths` glob matches the file set; a role without a stage selects nothing; a target without files selects over the work tree files; a rule whose matched glob is `**` sorts first; `integration-reviewer` and `reviewer` select the same ids. Cover the scenarios `stages and paths select a project rule`, `work tree files narrow a target without files`, `role without a stage`, `integration reviewer prefixes`. Verify they fail.
- [x] 3.2 Rewrite `selectRules` around `{ stage, files }` (design D-3) and remove `ROLE_PREFIXES`, the project-rule fallback and the "no file set" branch. Read the work tree files once per command with `workTreeFiles` where a target has no files: `rules show --ticket` for an artifact package, and `load.ts` through `hooks session-start` (`rules show --role` and `rules explain` always have `--file`). `rules prune` leaves out a language pack `languages` does not list, as selection does. Verify the 3.1 tests pass.
- [x] 3.3 Write failing tests in `commands.test.ts` and `rules.e2e.ts` for the command surface: `rules accept` requires `--path` and `--stage` (`input/missing-argument`, `input/invalid-argument` for `--stage close` and `"*"`), writes both fields, and no longer takes `--applies` or `--role`; `rules check` names a missing or old field; `rules explain` drops a rule of another stage and reports `matchedBy: "**"`; `rules prune` reports `paths` in `no-match`. Then implement them, and change `rules-show.json` and `rules-explain.json` to carry `paths` and `stages`. Verify the tests pass, and `pnpm build` regenerates the schemas.
- [x] 3.4 Verify `pnpm test:unit` and `pnpm test:e2e` pass for `kernel/src/rules/`, including `acceptance.e2e.ts` with `rules accept --path --stage`.

## 4. Dispatch packages (`kernel-cli/dispatch`)

- [x] 4.1 Write failing tests first in `dispatch/tests/build.test.ts` and `groups.test.ts`: the scenarios `selected rule ids are stamped`, `reviewer package holds only applicable ids of its role`, `group rules follow the group's files` with `paths` and `stages`, a group without files selecting over the work tree, and `artifact target selects over the work tree`. Verify they fail.
- [x] 4.2 Pass `ROLE_STAGE[role]` and the file set of design D-3 from `dispatch build`, reading the work tree files only when the target has none. Verify the 4.1 tests pass, the merge-ticket test still records `BDK-CQ-9`, the `template hash is stable` test passes, and `pnpm test:e2e` passes for `kernel/src/dispatch/`.

## 5. Session skill context (`kernel-cli/ctx`)

- [x] 5.1 Write failing tests first in `ctx/tests/skill.test.ts`, `ctx.e2e.ts` and `kernel/tests/contract/ctx-skill-output.test.ts`: one `### Rules` section per skill, rules in selection order with ` (paths: <globs>)` after a scoped one, the scenarios `language rules`, `rules carry their ids`, `project extends a rule set`, `a rule of another stage stays out`, `language pack without matching files`, and a `rules` part with `source: stage:<stage>` in `--json`. Verify they fail.
- [x] 5.2 Replace the part kinds `rules(<category>)`, `language-rules` and `project-rules` with one `rules` part that names its stage (`design` and `adr`: `design`; `plan`: `plan`), give `ctx` a `Git` dependency for the work tree files, and update `ctx.json`. Verify the 5.1 tests pass and `pnpm test:e2e` passes for `kernel/src/ctx/`.

## 6. Pipeline instruction (`kernel-pipeline`)

- [x] 6.1 Write failing tests first in `graph/tests/pipeline.test.ts`, `graph.test.ts` and `kernel/tests/contract/pipeline.test.ts`: a node with `rules:` fails naming `nodes[<n>].rules`; a `design` or `plan` node instruction holds a "Rules" section with its stage's selection; an `execute` node has none; the `plan` node lists `BDK-PL-1` to `BDK-PL-4`. Verify they fail.
- [x] 6.2 Drop `nodes[].rules` from the pipeline schema, `pipeline/pipeline.yaml` and `pipeline.ts`; render the "Rules" section from the node's stage for `design` and `plan` (design D-5); remove `RULE_CATEGORIES` and `categoryText`. Verify the 6.1 tests pass, `pnpm build` regenerates the pipeline JSON Schema, and `pnpm knip` reports nothing unused.
- [x] 6.3 Run `pnpm test:perf` for `next.perf.ts`. Verify the budget holds with the added `git ls-files` call; when the existing fixture is too small to show the cost, add a large-tree case (design, Risks).

## 7. Session start warning (`kernel-cli/hooks`)

- [x] 7.1 Write a failing test in `hooks/tests/session-start.test.ts` for the scenario `rules of other languages do not count`, and keep `many rules warned` passing. Verify it fails, then count per role over the work tree files in `load.ts` and update the warning text (`narrow their paths or stages`). Verify the test passes.
- [x] 7.2 Run `pnpm test:perf` for `session-start.perf.ts`. Verify the budget holds.

## 8. Readers of the shipped pack (`rule-pack`, `kernel-architecture`)

- [x] 8.1 Add a contract test over the fixture repository of 1.2: every reader selects exactly its 1.2 ids (a role: the union over the fixture files, since `paths` now narrow the language packs per file) plus the symmetric additions of proposal.md (`/bdk:plan`: `ARCH`, `CQ`; `verifier`: `CQ`, language rules; `/bdk:design`: `SEC`; `/bdk:adr`: `EJ`, `SEC`; `integration-reviewer`: `CQ`, `DP`, language rules; the `plan` node: `EJ`, language rules), and no reader loses a rule, in `kernel/tests/contract/rule-readers.test.ts`. Verify it passes.
- [x] 8.2 Add the scenario `one selection for every reader` to `kernel/tests/structure.test.ts`: no source file under `kernel/src/` maps a role, a skill or a node to rule prefixes or pack categories. Verify it passes.

## 9. Skills and documentation (`tools-skills`, `kernel-settings`)

- [x] 9.1 Update `kernel/tests/contract/tools-skills.test.ts` first (scenarios `audit adopts through the kernel` with `--path` and `--stage`, `proposal states paths and stages`). Verify it fails, then edit `skills/tools/rules/SKILL.md`: proposals carry `paths` and `stages`, explicit and narrowest (design D-8). Verify the test passes and `pnpm skill-check` passes.
- [x] 9.2 Update the user guide: `concepts/quality-and-language-rules.md` (the two fields, the stage table, `languages` as the switch of a pack, no selection without a file set), `workflows/rules-hygiene.md` (`rules accept --path --stage`), and a migration note for a project whose `.bdk/rules/` uses `applies` or `roles`. Update `.claude/skills/docs-sync/references/docs-map.md` when a page moves. Verify with `/docs-sync` against the diff, and verify `pnpm docs:build` passes.
- [x] 9.3 Verify the `kernel-settings` scenario `language pack needs both the switch and a matching file` with an E2E case in `rules.e2e.ts`, and that `pnpm test:contract` (`settings-spec`) passes.

## 10. Acceptance

- [x] 10.1 Rerun the commands of 1.1 in the same temporary repository after rewriting its rules with `paths` and `stages`. Verify the design verifier reads only rules of stage `design`, the plan context holds no `BDK-TS` rule without a `.ts` file, and the warning is gone; then add `E2E-1` (`paths: [tests/e2e/**]`, `stages: [plan, execute, review]`) and verify `bdk rules show --role implementer --file tests/e2e/login.spec.ts` lists it while `--file src/app.ts` and `--role design-verifier` do not.
- [x] 10.2 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check` and `pnpm docs:build`. Verify each passes.
- [x] 10.3 Run `openspec validate v3-153-rule-paths-stages --strict`. Verify it reports the change as valid.
