# Tasks

## 1. Start and the settings spec

- [x] 1.1 Confirm issue #50's card shows "In progress" on the project board (moved at change creation); verify with `gh project item-list 1 --owner broneq --format json`
- [x] 1.2 Review `specs/kernel-settings/spec.md` of this Change with the user as a Lavish artifact (key tree, tool entries with `when`, removed v2 keys, prompt keys, naming); apply the requested changes and run `openspec validate v3-t12-layered-config --strict`; verify it is valid
- [x] 1.3 GATE: the user accepts `kernel-settings` in writing; record the date and any amendment here. No task below starts before this box is checked. Accepted 2026-09-25 in `.lavish/v3-t12-spec-gate.html` ("akceptuję spec i D1-D4"), no amendment; the review page showed the differences from the accepted K01-K32 tree and the four author decisions (Python bridge, transitional `!` blocks, SessionStart hook form, one consumer per module), while its embedded full spec text failed to load
- [x] 1.4 Record the T12 resolution in `docs/V3-IMPLEMENTATION-PLAN.md` (the settings spec, deletion in T12 instead of T32) and rename `rules.propose_when` and `rules.max_per_package` to `rules.propose-when.*` and `rules.max-per-package` there and in `docs/V3-SKILL-INVENTORY.md`; verify `git grep -n "propose_when\|max_per_package" docs/V3-*.md` finds nothing

## 2. Layers and merge in shared/config

- [x] 2.1 Write failing unit tests for the layer rename and paths (design D-4, D-13): layer names `default | global | project | local`; global path from an absolute `XDG_CONFIG_HOME`, ignored when relative, `%APPDATA%\bdk\` with an injected `win32` platform, `<home>/.config/bdk/` otherwise; YAML syntax error names file and line; `.bdk/settings.json` never read; verify `pnpm test:unit` fails
- [x] 2.2 Extend `Runtime` with `env`, `platform`, `home` (bound in `kernel/src/main.ts`, injected in tests), rename the layers and implement the global path; update T11's `shared/config` tests to the new names; verify 2.1 passes
- [x] 2.3 Write failing unit tests for the merge (design D-5, `kernel-settings` Merge and Key naming and addressing): deep merge of mappings, arrays merged by `id` (append order, deep merge of a matching item), scalar arrays replaced, duplicate `id` in one layer refused, `null` kept as a value, `origins` per leaf with id segments; verify they fail
- [x] 2.4 Implement the merge with origins; verify 2.3 passes

## 3. Module registry, validation and S6

- [x] 3.1 Write failing unit tests for the registry (design D-1, D-3, D-7, `kernel-settings` Registry and consumers): `defineConfigModule` / `definePromptKey`, duplicate root key fails at build time, pass one reports an unknown key with full dotted path, layer, file and a "did you mean" hint within distance 2, a `plannedKeys` key answers "lands with <owner>", a `removedKeys` key answers its replacement, pass two maps a zod issue back to the layer through `origins`, all errors collected; verify they fail
- [x] 3.2 Implement the registry, `plannedKeys`, `removedKeys` and the two-pass validation in `shared/config`; verify 3.1 passes
- [x] 3.3 Write failing unit tests for the T12 modules (`kernel-settings` Tool entries, Keys of the project toolchain, Keys of prompt locations): `languages` unique non-empty strings; tool entries with kebab-case `id`, required `command`, `tier` required per array and forbidden for `build`, `{files}` required in `scoped` and `related`, optional `when`, no extra field; `features.lavish` default `true`; defaults of an empty configuration; verify they fail
- [x] 3.4 Add `kernel/src/ctx/config.ts` and `kernel/src/ctx/index.ts` with the `languages`, `tools`, `features` modules and the `rules/*` prompt keys, the `prompts` module in `shared/config`, and collect every slice's modules in `kernel/src/registrations.ts`; verify 3.3 passes and `pnpm knip` reports no unused export
- [x] 3.5 Write the S6 structural test (design D-2, `kernel-architecture` Tests per slice item 3): consumer is a known slice or `shared/config`, the module is exported from the consumer's `config.ts`, and a consumer with a registered handler reads it from `use-cases/`; seed a negative control for each of the three checks and verify each fails, then remove the seeds and verify the suite passes with the `ctx` modules (no `ctx` handler yet)
- [x] 3.6 Write the spec-table contract test (design D-3): parse the key tables of `openspec/changes/v3-t12-layered-config/specs/kernel-settings/spec.md` until the archive moves it to `openspec/specs/kernel-settings/spec.md` (the test reads the living path once it exists), compare type, default, owner and consumer of every registered key, the owner of every planned key and the removed keys; seed a changed default and a missing planned key and verify each fails, then verify it passes
- [x] 3.7 Extend the import scan so a slice's `config.ts` may import only `shared/config` and zod and `use-cases/` may import its own `config.ts`; verify with a seeded violation that the scan fails, then passes

## 4. Prompt values

- [x] 4.1 Write failing unit tests (design D-6, `kernel-settings` Prompt values): per-layer directories and `prompts.dir` read from the layer's own file and never inherited (relative to project root or the global directory), `prompts.files` string and object forms winning over the directory in the same layer, `extends` / `replace` chain from the plugin default, frontmatter `mode` / `applies` parsed, contradiction between YAML entry and frontmatter refused, `applies` glob validation, pattern keys `rules/languages/*`, unknown prompt file refused naming key and layer, reserved first segments `dir` and `files`, content read only on demand; verify they fail
- [x] 4.2 Implement prompt resolution in `shared/config`; verify 4.1 passes

## 5. Snapshot and schema export

- [x] 5.1 Write failing unit tests (design D-9, `kernel-settings` Resolved snapshot): snapshot path and content, prompt values as file lists, `overriddenKeys` holds leaves and prompt keys set by `global` or `local`, sorted, and never keys set only by `project`; nothing written without `.bdk/`; verify they fail
- [x] 5.2 Implement the snapshot writer; verify 5.1 passes
- [x] 5.3 Write a failing test that the settings JSON Schema generated from the registry rejects an unknown key at every level, carries descriptions and defaults, expresses the `{files}` rule as `pattern`, and that export throws on an unrepresentable schema (design D-10); verify it fails
- [x] 5.4 Add `.meta()` (title, description, examples) to the zod schemas of `version`, `doctor` and the refusal, write `kernel/scripts/export-schemas.ts` (settings plus the CLI files of design D-10, cross-file `$ref` for `common/version.json`, output formatted with Prettier's API) and run it from `kernel/build.mjs`; add the script to `knip.json`; verify 5.3 passes, `pnpm build` twice leaves `git diff --exit-code dist/ schema/` clean, and the regenerated `version.json`, `refusal.json` and `doctor.json` differ from the T10 files only in ordering or formatting that the review accepts
- [x] 5.5 Drop the generated files from the contract test that parses examples with zod and keep it for the hand-written ones (`kernel-architecture` Tests per slice); verify `pnpm test:contract` passes

## 6. The config slice

- [x] 6.1 Update the contract for the four commands (spec delta `kernel-cli/config`, design D-8): the zod output schemas in `kernel/src/config/schema/` generate `schema/cli/output/config-{show,check,schema,set}.json` (check without `valid`, problems with `path`, optional `key` and codes `missing-modeline`, `schema-outdated`, `legacy-settings`; schema output requiring only `url`); rewrite the examples to T12 keys; update the representative refusal in the Purpose of `openspec/specs/kernel-cli/config/spec.md` to a T12 key; verify `pnpm build` regenerates the files and `pnpm test:contract` passes
- [x] 6.2 Write failing unit tests for the use cases on the in-memory store, one per declared rule and exit: `show` (whole tree, one key, id-addressed key, prompt value, `--origins`, `layers`, YAML text output with `when`, `input/not-found` for an unset key without default, unknown key, invalid value); `check` (errors refuse with key, layer, file and count in `why` and the fix in `instead`, planned and removed keys named, warnings `missing-modeline`, `schema-outdated` and `legacy-settings`, snapshot and offline copy written only with `.bdk/`); `schema` (whole, one module, `--url`, unknown module); `set` (project default, `--local`, `--global`, both flags refused, id-addressed segment, YAML value parsing, `previous`, refused set changes no file, new file starts with the modeline, comments, flow sequence and key order survive); verify they fail
- [x] 6.3 Implement `kernel/src/config/` per the slice anatomy (`commands/`, `use-cases/`, `render/`, `schema/`, `tests/`, `index.ts`), with `set` editing through `yaml`'s document API (design D-11) and registering the four handlers; verify 6.2 passes, the four records answer `handler` in the registry contract test, and the import scan passes
- [x] 6.4 Write E2E cases through `dist/bdk.mjs` on the repository fixture, one per exit code and rule of the four records, plus the acceptance scenarios "config layering with unknown key" (valid global layer, `tools.tests` in `.bdk/settings.yaml`, exit 2, `why` names `tools.tests`, `project`, `.bdk/settings.yaml` and the hint `tools.test`), "key of a later task" and "local override visible in the snapshot"; verify `pnpm build && pnpm test:e2e` passes

## 7. doctor schema checks

- [x] 7.1 Write failing unit tests for `doctor` (spec delta `kernel-cli/service`): no schema finding without `.bdk/settings.yaml`; `schema-modeline` for a missing or other-version modeline in the project or local file; `schema-offline` for a missing or different offline copy; `--fix` writes the modeline as first line keeping the rest byte for byte, rewrites the offline copy and reports only remaining findings; verify they fail
- [x] 7.2 Implement the checks and the `--fix` repairs in the `service` slice with the registry passed as a dependency; update the `--fix` description of the `doctor` record in `schema/cli/commands.json` to the spec delta (its `writes[]` stays empty: the index lists Change directory paths only and `read` commands have none, `kernel-cli` Availability; the delta's Writes line says so); verify 7.1 passes, E2E "settings file without modeline" and "fix the schema findings" pass, and `pnpm test:contract` passes

## 8. v2 readers switch to the kernel

- [x] 8.1 Write failing pytest tests for `scripts/kernel_settings.py` (design D-14): `load_settings()` returns the resolved tree of a `.bdk/settings.yaml` fixture through the committed `dist/bdk.mjs`; `prompt_files("rules/security")` returns the contributing files after `replace`; a kernel refusal and a missing `node` each give one `[bdk-inject-error]` line; verify `pytest tests/unit/scripts/` fails
- [x] 8.2 Implement `scripts/kernel_settings.py`; verify 8.1 passes
- [x] 8.3 Rewrite `tests/unit/scripts/test_inject.py`, `test_inject_rules.py` and `test_inject_language_rules.py` to `.bdk/settings.yaml` and `.bdk/prompts/` fixtures (feature flag, `languages[...]`, `extends`, `replace`, language override, absent settings); verify they fail
- [x] 8.4 Switch `inject.py` (drop `--settings`), `inject-rules.py` and `inject-language-rules.py` to the bridge; verify 8.3 passes and `pytest tests/unit/` passes
- [x] 8.5 Replace the eight `get_settings.py` lines in `skills/{test-driven-development,bdk-test-tools,bdk-lint-tools,create-plan,debug}/SKILL.md` with the `config show tools.<kind>` wrapper of design D-14, update the prose that described the old block format and the unconfigured fallback, and set `allowed-tools`; verify `git grep -n get_settings skills agents` finds nothing and a skill loaded with `claude --plugin-dir` in a fixture project renders its `tools.test` YAML with a `when` text (record the rendered block here)
  - Done. `git grep -n get_settings skills agents` finds nothing. A probe plugin showed that the block expands only with `allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)` (an unquoted rule does not match the quoted path; without the echo rule the `$?` fallback is not pre-approved); design D-14 and the `plugin-tooling` delta say so. In a fixture project with one `tools.test` entry, `claude -p --plugin-dir ~/projects/bdk` loading `/bdk:test-driven-development` and `/bdk:debug` rendered:

    ```yaml
    - id: unit
      command: pnpm test
      scoped: pnpm vitest run {files}
      when: Any source change outside e2e/.
      tier: fast
    ```

    and `[]` for the unset `tools.lint` in `/bdk:debug`. A probe with an unknown key rendered the refusal followed by `BDK STOP: failed (exit 2).` The finding is recorded as HOST-FACTS rows `wrapper-old-rule` and `wrapper` (probe skills in `tests/host-probe/skills/`, fixtures under `tests/fixtures/host-payloads/2.1.282/`), and a `kernel-cli` delta corrects the Output modes requirement that cited `allowed-compound`.
- [x] 8.6 Replace the `check-bdk-config` entry in `hooks/hooks.json` with the `config check` command of `plugin-tooling`, Settings check at session start; verify by starting a session with `claude --plugin-dir` in a fixture that sets `features.serena` (refusal in context, no block) and in a directory without `.bdk/` (no output); record both here
  - Done. `claude -p --plugin-dir ~/projects/bdk` in a git fixture whose `.bdk/settings.yaml` sets `features.serena: true` had this SessionStart output in context, and the session ran normally:

    ```
    refused: policy/unknown-config-key
    why: features.serena in the project layer (.bdk/settings.yaml): removed v2 key: removed with the bundled MCP servers (ADR-0001)
    instead: bdk config schema features
    instead: fix .bdk/settings.yaml
    ```

    In a directory without `.bdk/` the session context had no output from the hook.
- [x] 8.7 Change `skills/setup/SKILL.md` Phase 4 to write `.bdk/settings.yaml` with the modeline, `tools.*` entries with `id` and `tier`, and to run `bdk config check`; verify by running `/bdk:setup` once in a throwaway project and `bdk config check` exits 0 there
  - Done. Phase 3 no longer asks about `features.caveman` (a removed key). A non-interactive `claude -p "/bdk:setup ..." --plugin-dir ~/projects/bdk` in a throwaway pnpm + vitest + eslint + typescript project wrote `.bdk/settings.yaml` with the modeline `# yaml-language-server: $schema=https://raw.githubusercontent.com/broneq/bdk/v2.6.0/schema/settings.json`, `tools.test` (`vitest`, `fast`), `tools.lint` (`eslint`, `lint`; `tsc`, `typecheck`) and `tools.build` (`tsc`), and `bdk config check` exited 0 there.
- [x] 8.8 Delete `scripts/get_settings.py`, `hooks/check-bdk-config/`, `tests/unit/scripts/test_get_settings.py` and `tests/unit/hooks/check-bdk-config/`; verify `pytest tests/unit/` passes and the "plugin tree" scenario of `plugin-tooling` holds
  - Done. `pytest tests/unit/`: 314 passed. `git grep` finds the deleted files only in planning history (`docs/V3-*`, ADR-0002) and in `docs/INJECTION-FLOWS.md`, which 8.9 rewrites.
- [x] 8.9 Update `README.md`, `STARTUP_INSTRUCTIONS.md`, `.claude/rules/{quality-rules,language-rules,inject-fragments,skill-creation-rules,fragment-system}.md` and `docs/INJECTION-FLOWS.md` to `.bdk/settings.yaml` and prompt values; verify `git grep -n "settings.json" README.md STARTUP_INSTRUCTIONS.md .claude/rules skills agents scripts hooks` finds only mentions of the v2 file converted by `bdk import`
  - Done. Also updated `.claude/rules/portability-check.md`, `skills/cr/references/review-engine.md`, `skills/create-plan/references/plan-template.md` and `skills/subagent-execute-plan/`. The grep finds `settings.json` only in the README sentence and the `setup` Phase 1 note about the v2 file (not read; `bdk import` converts it), and in the README name of the generated `schema/settings.json`. The README claims (`--origins`, `.bdk/prompts.local/`, `prompts.files` object form, the refusal of a missing mapped file) were checked against the built kernel.

## 9. Architecture spec and CI

- [x] 9.1 Update the Purpose paragraph of `openspec/specs/kernel-architecture/spec.md` ("the zod output schema that T12 exports") to the generated-or-hand-written rule of design D-10 (a delta cannot change a Purpose); verify `pnpm test:contract` passes
  - Done; `pnpm test:contract` 249 passed. The `kernel-architecture` delta also corrects the slice anatomy line ("T12 exports them") and adds a MODIFIED "Change recipes": a new command adds its output schema to `kernel/scripts/export-schemas.ts`.
- [x] 9.2 In `.github/workflows/tests.yml`, change the kernel job's diff step to `git diff --exit-code dist/ schema/` and add `actions/setup-node` with the `.nvmrc` version to the pytest job; verify with actionlint and on the PR's CI run
  - Done; actionlint 1.7.12 passes, and the CI run of PR #81 is green: `kernel` on Node 22.13, 24 and 26 (with `git diff --exit-code dist/ schema/`), `pytest` with Node, `lint-repo`, `audit`, `skill-check`.

## 10. Acceptance

- [x] 10.1 Run the full kernel chain on the local Node: `pnpm build`, `git diff --exit-code dist/ schema/`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm test:unit` (coverage thresholds hold), `pnpm test:e2e`, `pnpm test:contract`, and `pytest tests/unit/`; verify all pass
  - Done: two builds give identical `dist/` and `schema/`; lint, format, typecheck and knip clean; unit 309 passed (coverage 95.37 / 87.04 / 96.73 / 96.62), E2E 206 passed and 1 todo, contract 249 passed, pytest 314 passed. `.prettierignore` gained `.claude/worktrees/`, because `pnpm format:check` read a parallel Claude Code worktree there.
- [x] 10.2 Manual IDE check, once (`kernel-settings` Settings JSON Schema, design D-12): a throwaway fixture whose `.bdk/settings.yaml` carries a modeline pointing at the generated `schema/settings.json`, opened in an editor with yaml-language-server; verify key completion for `tools.test` items (including `when`) and a warning on `tools.tests`, and record the editor, version and result here
  - Accepted by the user as the check: no editor was opened; the evidence is yaml-language-server 1.24.0 over stdio, on a fixture whose modeline is `file:///Users/broneq/projects/bdk/schema/settings.json`, reported `Property tests is not allowed.` on `tools.tests` and completed a `tools.test` item with `scoped, related, failed, incremental, when`. The released modeline URL (`v2.6.0`) has no `schema/settings.json` until a release ships it.
- [x] 10.3 Run `openspec validate v3-t12-layered-config --strict`; verify it reports the change valid
  - Done: `Change 'v3-t12-layered-config' is valid`.
