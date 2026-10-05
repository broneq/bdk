# Tasks

## 1. Settings: three tool group states (D1)

- [x] 1.0 Set the #117 card on the board to In progress
- [x] 1.1 Failing tests (`kernel/src/shared/config/tests/`, `kernel/src/config/tests/`): `tools.lint: none` validates and resolves to `none`; `tools.lint: []` is `policy/config-invalid` naming `tools.lint` with a message naming `none`; no layer leaves `tools.test` and `tools.lint` absent from the resolved value; a local `none` replaces project entries; a project entry over a lower `none` gives a one-entry list; `config set tools.lint none` and `config set tools.lint.eslint '{...}'` over `none` write the file; `tools.test.unit.scoped` stays addressable; `toolGroup` answers `configured`, `none`, `unset`
- [x] 1.2 Schema `none | [entry, ...]` without default for `test` and `lint`, the key tree through the union, the `toolGroup` helper; consumers (`evidence coverage`, graph view, `review render`, `dispatch`, `ctx`) read entries through it; settings spec table and JSON Schema regenerated; tests of 1.1 green

## 2. Graph: declared-none nodes are skipped (D2)

- [x] 2.1 Failing tests (`kernel/src/graph/tests/`): with `tools.lint: none` the `lint` instances and `lint-full` are `skipped` with `why: tools.lint is none`, `review` does not require `lint-full`, `postTaskSteps` leaves `lint` out; the same for `test`; a configured or unset group is not skipped
- [x] 2.2 Grouped kinds with `skip`, the view's group states; tests of 2.1 green

## 3. Refusal `policy/tools-unset` (D3)

- [x] 3.1 Failing tests: `change new` with `tools.lint` unset exits 2 `policy/tools-unset` naming `tools.lint`, with the three `instead` lines, writing nothing; with `none` it opens; with invalid settings it opens as before; `part start` refuses when the group is removed after `change new`; the rule is in the catalogue with both commands
- [x] 3.2 Rule in `shared/refusal`, `unsetToolsForKind` and `unsetToolsOf` in `graph`, the checks in `change new` and `part start`; `schema/cli/` regenerated; tests of 3.1 green

## 4. Dispatch checks (D2)

- [x] 4.1 Failing tests (`kernel/src/dispatch/tests/`): with `tools.lint: none` neither the runner nor the gate runner package holds a `lint` or `lint-full` section; with `tools.lint` unset the `not-run` sentence stays
- [x] 4.2 `fullChecksText` takes the change-level checks the graph applies; tests of 4.1 green

## 5. Status, review report, close report and ctx (D4)

- [x] 5.1 Failing tests: `change status` has `tools` and the text lines for a declared-none group and the test warning; `review render` Gate lines (MD and HTML, warning class for tests); `change close` `toolsNotUsed` and the `### Checks` summary section; `ctx skill setup` renders `declared none (tools.lint: none)` and `unset: no command configured`
- [x] 5.2 Implement; output schemas regenerated; tests of 5.1 green

## 6. Fixtures, skill, eval cases, docs

- [x] 6.1 E2E and unit fixtures that open a Change or start a part set both groups; the whole kernel suite green
- [x] 6.2 `/bdk:setup`: the declared-none question and `bdk config set tools.<group> none`; the "Project commands" sentence; `pnpm skill-check` clean
- [x] 6.3 Stage cases `run-auto` and `run-manual` declare `tools.lint none`; `run-auto` asserts no `lint` manifest in the archive; `pnpm eval check` green
- [x] 6.4 User docs (`docs/guide/`): the settings form of the three states and the refusal; `pnpm docs:build` and the drift guards green

## 7. Acceptance

- [x] 7.1 End to end through `dist/bdk.mjs`: a project with `tools.lint` unset is refused at `change new` with the hint; with `tools.lint: none` a Change runs through `attempt close` with no `lint` manifest and `change status` names lint as not used
- [x] 7.2 `run-auto` stage probe with lint declared none archives the Change (`pnpm eval stages --probe`, case `run-auto`)
- [x] 7.3 `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`; `openspec validate v3-t49-tool-group-states --strict`
- [x] 7.4 Setup stage cases `no-linter` and `no-tests` declare the missing group none, and every setup case ends with a `change new` the kernel accepts; `pnpm eval stages --skill setup --probe` passes all five cases
