# Design

## Context

See proposal.md, Why. T11 left `shared/config` as a reader: `readLayers()` finds the three YAML files (global only at `~/.config/bdk/settings.yaml`), parses them with `yaml` and names the layers `defaults | personal | project | local`, while the contract (`schema/cli/output/config-*.json`) names them `default | global | project | local`. The four `config` records in `schema/cli/commands.json` are stubs owned by T12; their examples use `policy.*` keys, which belong to T21 to T24. `zod` 4.6.5 and `yaml` 2.9.1 are the only runtime dependencies (`kernel-architecture`, Runtime dependencies). `schema/cli/` holds hand-written JSON Schemas from T10; the kernel has zod counterparts only for `version`, `doctor`, the refusal and the list page, kept equal by the contract test that parses the JSON examples with zod. The plugin version on `staging/v3` is 2.6.0 until T50 releases 3.0.0.

User decisions taken while writing this Change (2026-09-25, Lavish reviews `.lavish/v3-t12-questions.html` and `.lavish/v3-t12-settings-schema.html`):

- Q1: `staging/v3` may break v2 behaviour. T12 deletes the v2 settings readers and switches every settings read in the plugin to the kernel (D-14).
- Q2: the task that lands a key's consumer registers the key.
- Q3: v2 rule overrides become prompt values.
- Q4: prompt files live in a per-layer directory that `prompts.dir` can move, and single keys can point at any file through `prompts.files`.
- Q5: kebab-case for every key segment, id and enum value.
- The full settings schema is designed first as its own spec, `kernel-settings`, like `kernel-state` in T14; the key tree K01 to K32 of the review is accepted, with `when` added to tool entries. The spec is task group 1 and gates all code.
- D1 to D8 of the first review accepted as proposed; they appear below as D-4, D-12, D-3, D-8, D-9, D-10, D-6 and D-5.

## Goals / Non-Goals

**Goals:**

- A slice gets typed, validated settings by declaring a module; it never parses YAML or merges layers itself.
- Every configuration error names the key, the layer and the file.
- The committed JSON Schema cannot drift from the zod registry, and the IDE sees the same schema the kernel enforces.

**Non-Goals:**

- Reading configuration from `.bdk/settings.json` in any form (T32 imports it once).
- Interpreting prompt values or `applies` (T13, T31); T12 resolves which files form a value and validates their frontmatter.
- Environment-variable overrides of keys (not in the design; not added).

## Decisions

### D-1 Config modules live in the consumer slice

A module is a plain object built by `defineConfigModule({ key, consumer, schema, description })` in `shared/config`: the root key (`tools`), the consumer slice, a zod schema whose `.default()`s are the default layer, and a description for the JSON Schema. Prompt keys are declared the same way with `definePromptKey({ key, consumer, defaultFile })`, where `key` may end in `/*`. A slice exports its modules from `<slice>/config.ts` through its `index.ts`; `registrations.ts` collects every slice's modules next to its handlers and builds one registry; `main.ts` passes the registry to the `config` and `service` slices as a dependency, so `config` stays a leaf of the dependency matrix. T12 creates `kernel/src/ctx/index.ts` and `kernel/src/ctx/config.ts` with the `languages`, `tools`, `features` modules and the `rules/*` prompt keys; `ctx` has no handler until T13. `prompts.dir` and `prompts.files` are declared in `shared/config` itself, because the loader consumes them.

Alternatives: one central schema file in `shared/config` listing every key (every task would edit a shared file, and nothing ties a key to the code that reads it, which is what S6 asks for); modules under `shared/config/modules/` named after their consumer (a naming convention instead of a location the import scan can check). Lost.

### D-2 "Key without a consumer" is a structural test

A new structural test in `kernel/tests/` (next to the import scan) loads the registry and checks, per module: the consumer is a slice of `kernel-architecture`, Vertical slices (or `shared/config`); the module object is exported from that slice's `config.ts`; and, when `registrations.ts` holds a handler for any record of that slice, some file under `<slice>/use-cases/` references the module's export name. The last check is textual, the same technique as the import scan. Between T12 and T13 the `ctx` modules pass on the first two checks only; T13 registers the first `ctx` handler and the third check becomes binding for them without any change to the test.

Alternatives: a runtime tracker that records which keys a command read (needs every command exercised in one run; E2E coverage is per exit code, not per key); only the declaration check (a module could name a consumer that never reads it forever). Lost.

### D-3 The key tree is a spec; the kernel knows planned and removed keys

`kernel-settings` holds every v3 key in tables (type, default, owner, consumer, v2 origin), one requirement per key group. The registry holds only the modules whose consumer has landed. Two constant lists in `shared/config` hold the rest: `plannedKeys` (key and owner task, for the keys of later tasks) and `removedKeys` (v2 key and the replacement or reason). Pass one of the validation (D-7) consults them before computing a "did you mean" hint, so `policy.budgets.task-redispatch` before T22 answers "lands with T22" and `features.serena` answers "removed with the bundled MCP servers (ADR-0001)". No new rule id: both are `policy/unknown-config-key`, because to the running kernel the key is unknown.

A contract test (`kernel/tests/contract/`) parses the key tables of `openspec/specs/kernel-settings/spec.md` and the registry and fails when they disagree: each registered leaf has a row with the same type, default, owner and consumer, each row not registered is in `plannedKeys` with the same owner, and each `removedKeys` entry has a row in "Removed v2 keys". Types are compared through a small renderer from zod to the table vocabulary (`boolean`, `integer >= 0`, `` `manual` or `auto` ``), which also forces the table wording to stay regular. When an owner task registers its module, it moves the keys out of `plannedKeys` and, if its design changes a row, amends the spec through a delta; the test keeps both in step.

Tool entries: `id` replaces `type` because arrays merge by `id` (A-warstwy) and `type` is not unique (two `vitest` entries with tiers `fast` and `e2e` are normal). `tier` becomes mandatory for test and lint: v2 inferred a missing tier from the tool name, and `check.py` already warned that the guess was wrong often enough to matter. `build` entries have no tier (v2 had none). The `{files}` rule for `scoped` and `related` is a zod `regex`, which the JSON Schema export carries as `pattern`. `when` is free text passed through to the model unchanged; the kernel never interprets it.

The consumer column names one slice, the one whose `config.ts` declares the module. Where the design names several readers (gates read by `graph` and `hooks`, `rules.max-per-package` by `rules`, `dispatch` and `ctx`), the declaring slice is the lowest one in the dependency matrix that all readers may import, and the others read the value through its `index.ts`.

Alternatives: the tree only in design.md as a table (the previous draft; nothing ties later tasks to it); a registry that registers every key now with a placeholder consumer (breaks S6, "no key without a consumer"); a separate rule id `policy/config-key-not-landed` (a new rule for a transient state that ends at T31). Lost.

### D-4 Global layer path

`$XDG_CONFIG_HOME/bdk/` when the variable is set and absolute (the XDG spec ignores relative values), `%APPDATA%\bdk\` on Windows, else `<home>/.config/bdk/`. `shared/registry`'s `Runtime` gains `env` and `platform` and `home`; `main.ts` binds `process.env`, `process.platform` and `os.homedir()`, tests inject them. macOS uses `~/.config/bdk/` like Linux, not `~/Library/Application Support/`, because the design names the XDG path and developers expect dotfiles there.

Alternatives: `~/.config/bdk/` on every platform including Windows (no Windows user expects a dotfile directory in the profile); `%LOCALAPPDATA%` (machine-local; roaming `APPDATA` is where per-user settings belong). Lost.

### D-5 Merge, origins and addressing

The merge walks the layers lowest first and records, per leaf, the layer that set it (`origins`). Mappings merge key by key; an array merges by `id` only when every item of both sides is a mapping with a string `id`, otherwise the higher array replaces the lower one. Array items merged by `id` are addressed by their `id` as a path segment everywhere a dotted key appears (`config show`, `config set`, `why`, `origins`, `overriddenKeys`): `tools.test.unit.scoped`. Ids are validated by the module schema to match `^[a-z0-9][a-z0-9-]*$`, so an id never contains a dot. `null` is kept as a value and fails validation unless the key is nullable; no key is nullable in T12.

Alternative: `null` deletes the lower value (Kustomize style). It gives a second way to express "off" next to `false` and makes "full override" (D4) ambiguous. Lost.

### D-6 Prompt values

Resolution for one prompt key, per layer from default to local: the layer's contribution is `prompts.files.<key>` from that layer's own file if present, else `<dir>/<key>.md` if the file exists, where `<dir>` is that layer's own `prompts.dir` or the layer default (D-4 directory plus `prompts/` for global, `.bdk/prompts/`, `.bdk/prompts.local/`). `prompts.dir` is excluded from the merge: it is read from each layer's file, never inherited, because a project directory inherited by the local layer would make both layers read the same files. A contribution with `mode: replace` discards everything below it; `extends` appends (a blank line between). The default is extends, as in v2. The default layer is the plugin file the prompt key declares (`${pluginRoot}/rules/<name>.md`), read from the plugin directory at run time, not bundled, so rule texts stay editable Markdown in the repository.

Directory contents are listed recursively once per resolution and validated against the declared prompt keys (unknown file = `policy/unknown-config-key`); a file's content is read only when a consumer asks for the value, so `config check` stays cheap. Frontmatter is parsed with `yaml`; the frontmatter of a file mapped by `prompts.files` may repeat the YAML entry's `mode` and `applies` but not contradict them. `applies` is a list of non-empty strings validated as globs (no empty segments, no absolute paths); matching is the consumer's.

`config show` addresses a prompt value as `prompts.<key>` (`prompts.rules/security`); `dir` and `files` are reserved and no prompt key may start with them. The value shown is `{ mode, files: [{ layer, path }] }`.

Alternatives: prompt values inlined into YAML as block scalars (loses Markdown editing and diffing; R-format chose files); one flat `prompts/` directory with dotted file names (`rules.security.md`), rejected because dots collide with dotted key paths once `prompts.files` exists (Q4).

### D-7 Validation in two passes

Pass one walks each layer against the registry's key tree (built from the zod shapes and the prompt key patterns) and reports unknown keys with the layer and file; the "did you mean" hint is the declared key with the smallest Damerau-Levenshtein distance, at most 2. Pass two merges and validates the merged tree with the strict zod schema; each zod issue path is mapped back to the layer that set the offending leaf through `origins`. Errors are collected, not thrown at the first one: `config check` (and `hooks session-start` in T13) needs the whole list; the command refusal carries the first and the count.

Alternative: validate each layer with a deep-partial copy of the schema (zod 4 has no `deepPartial`, and partial schemas accept a layer that is only invalid in combination, for example an id-merged item missing `command` in every layer). Lost.

### D-8 `config check` answers errors with a refusal

T10's example printed `valid: false` with exit 0, while the record declares `policy/unknown-config-key` and `policy/config-invalid` with exit 2, and every kernel error has one shape (`kernel-cli`, Exit codes and the error object). The command now exits 2 with the refusal on any error and 0 with warnings otherwise; `valid` is dropped from `config-check.json`, problems gain `path` and lose the error codes, and `key` becomes optional (a missing modeline concerns a file, not a key). The acceptance signal "the error names the key and the layer" is the refusal's `why`.

Alternative: keep the report shape with exit 0 and a `valid` flag (the only command whose errors would not be refusals, and a skill calling it from Bash would need to parse JSON to notice a failure). Lost.

### D-9 Snapshot and overridden keys

`.bdk/.machine/config/resolved.yaml` holds `resolved` (the merged tree with prompt values as file lists) and `overriddenKeys` (sorted dotted names of leaves and prompt keys set by the `global` or `local` layer, D4b). Both personal layers count: a global setting changes a run exactly like a local one and is equally invisible to reviewers. The snapshot is written by `config check` and `config set` only; `show` and `schema` stay read-only in the strict sense.

### D-10 One schema generator for settings and CLI outputs

`kernel/scripts/export-schemas.ts` builds every generated file from zod with `z.toJSONSchema()` (zod 4, no new dependency) and writes it formatted with Prettier's API (a development dependency already), so `pnpm format:check` and the generated files agree. `kernel/build.mjs` bundles the script with esbuild into a temporary file and runs it after building `dist/bdk.mjs`, so `pnpm build` regenerates both and CI's `git diff --exit-code dist/ schema/` guards both. Settings: `schema/settings.json` (draft 2020-12, `$id` the unversioned `v3` URL as the CLI schemas use, `additionalProperties: false` everywhere, descriptions and defaults from the modules). CLI outputs whose zod exists: `common/version.json`, `common/refusal.json`, `output/doctor.json` and the four `output/config-*.json`; each zod schema carries `title`, `description` and `examples` through `.meta()`, and cross-file references (`doctor` -> `common/version.json`) come from registering the shared schemas with an id and an external `uri` mapping. `common/list-page.json` stays hand-written: its zod is a generic factory over the rule enum, not one schema. Files not generated keep the contract test that parses their examples with zod; generated files drop out of that test because the diff check covers them. T14 reuses the generator for `schema/state/`.

Alternatives: keep all JSON hand-written and only compare with zod in the contract test (two sources for the settings schema, which R-format's condition makes user-facing); generate at CI only without committing (the modeline URL points at committed files, and reviewers need to see schema changes). Lost.

### D-11 `config set` edits the document, not the data

`yaml`'s `parseDocument` / `setIn` / `toString` keep comments, key order and the modeline of the file being edited; an id-addressed segment is resolved to the array index of that id before `setIn`. The value argument is parsed as YAML (`true`, `3`, `[a, b]`, `{id: x, command: y}`). The whole candidate configuration (all layers with the edited document) is validated before `Store.write` replaces the file atomically. `--global` and `--local` together answer `input/invalid-argument`.

### D-12 Modeline and versioned URL

URL: `https://raw.githubusercontent.com/broneq/bdk/v<plugin version>/schema/settings.json`, the release-please tag of the plugin version the kernel reads (`shared/config`, `readKernelVersion`). The modeline is the file's first line. On `staging/v3` the version is 2.6.0, whose tag has no `schema/settings.json`, so the URL resolves only from the 3.0.0 release; until then the offline copy is what an editor can use (`# yaml-language-server: $schema=.machine/schema/settings.json` is not written: a committed file must not point at a gitignored path). The manual IDE confirmation of the acceptance signal uses the offline copy path in a throwaway fixture.

Alternatives: the branch URL (`.../staging/v3/...` or `main`), which is not versioned and changes under a pinned plugin; a `$schema` key in the YAML (the settings schema would have to allow it, and v2's `$schema` is exactly what T32 drops). Lost.

### D-13 Layer names follow the contract

The T11 names `defaults` and `personal` become `default` and `global` in `shared/config`, as every output schema already spells them; T11's tests change with them.

### D-14 v2 readers switch to the kernel

The v2 settings readers go in T12, not T32 (Q1). The skill blocks, the hook entry and the bridge are transitional and T13 removes them; the point is that from T12 on nothing in the plugin reads `.bdk/settings.json`.

- **Skill `!` blocks.** The eight `get_settings.py` lines become `` !`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config show tools.test 2>&1 || echo "BDK STOP: bdk config show failed (exit $?). Install Node >= 22.13, then run bdk config check."` `` (and `tools.lint`). `config show` prints YAML in text mode, which the model reads directly, including `when`. The skill prose that explained `get_settings.py`'s `full / scoped / related / failed` block format now names the fields (`command` is the full form) and the fallback for an empty list (`[]`: detect from project files and tell the user to run `/bdk:setup`). `allowed-tools` swaps `Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)` for `Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *)` where no other script is called, and adds both next to the Python rule where one still is. Both rules are needed (HOST-FACTS `wrapper` and `wrapper-old-rule`, recorded on Claude Code 2.1.282): a rule without quotes does not match the quoted path, and without `Bash(echo *)` the `|| echo "... $?"` fallback is not pre-approved, so in `default` mode the whole skill invocation aborts. The same holds for the `ctx` wrapper of `kernel-cli`, whose Output modes requirement cited the older `allowed-compound` fact; this Change corrects it through a delta. These blocks call `config`, which `kernel-cli`'s content-wrapper rule does not allow (only `ctx` and `next`); the rule is enforced by T15's check, which does not exist yet, and T13 replaces the blocks with `ctx skill`. The deviation is stated in `plugin-tooling` so it cannot outlive T13 unnoticed.
- **SessionStart hook.** `hooks/check-bdk-config/check.py` is replaced by `test -d .bdk && node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" config check 2>&1 || true`. The refusal text lands in the session context and the session is never blocked, which keeps the contract of the removed requirement "Removed feature keys warn". `hooks session-start` (T13) absorbs it.
- **Injection scripts.** `scripts/kernel_settings.py` is the one bridge: `load_settings()` runs `node dist/bdk.mjs config show --json` from the project directory and returns the resolved tree, and `prompt_files(key)` runs `config show prompts.<key> --json` and returns the contributing file paths. `inject.py` evaluates its conditions on the resolved tree (its `--settings` flag goes); `inject-rules.py` and `inject-language-rules.py` concatenate the files of `rules/<name>` and `rules/languages/<lang>`, which already carry the `extends` / `replace` resolution. A missing Node or a kernel refusal prints one `[bdk-inject-error]` line and exits 0, the same visible-error convention as the removed `--chain` mode. The pytest tests of the three scripts write `.bdk/settings.yaml` fixtures and run the committed `dist/bdk.mjs`, so the pytest CI job installs Node.
- **`setup`.** Phase 4 writes `.bdk/settings.yaml` with the modeline (from `bdk config schema --url`), the v3 key names and `id` / `tier` per tool, then runs `bdk config check`. The interview itself stays until T41.
- **Documentation.** `README.md`, `STARTUP_INSTRUCTIONS.md` (the quality section), `.claude/rules/{quality-rules,language-rules,inject-fragments,skill-creation-rules,fragment-system}.md` describe `.bdk/settings.yaml` and prompt values instead of `settings.json`, `quality` and `language-rules`.

Alternatives: keep `get_settings.py` as a shim over the kernel with its old block format (keeps a file the plan says to delete, and the block format hides `when`); leave the injection scripts on `settings.json` until T13 (a project would need both files for a task's lifetime, and `setup` would have to write both). Lost.

## Risks / Trade-offs

- [The modeline URL returns 404 until 3.0.0 is tagged] → The offline copy exists from the first `config check`; `schema-outdated` and the doctor finding tell the user; the release pipeline of T50 publishes the file with the tag.
- [`z.toJSONSchema` cannot express every zod refinement] → T12's schemas use only constructs with a JSON Schema equivalent (`regex` as `pattern`, enums, strict objects, `uniqueItems` through a `.meta()` override for `languages`); the export fails on an unrepresentable schema instead of silently dropping it (zod's `unrepresentable: "throw"`).
- [The S6 read check is textual] → It can be fooled by a module name in a comment; the check runs against `use-cases/` only and is a guard against forgetting, not against intent (threat model: a careless model).
- [Transitional `!` blocks call `config`, outside the content-wrapper rule] → Stated in `plugin-tooling`; T13 replaces them; T15's check would flag any survivor.
- [Every settings read now spawns Node; a machine without Node >= 22.13 loses tool lists and rule overrides] → The wrapper's STOP line and the `[bdk-inject-error]` line say so in the loaded skill; `staging/v3` is not released, and 3.0 requires Node anyway.
- [A v2 project runs with defaults until T32's import] → `config check` warns `legacy-settings` at every session start and `doctor` names `bdk import`; `staging/v3` has no users besides the author.
- [The spec tables and the registry drift] → The contract test of D-3 fails the build on any difference.
- [The `ctx` modules exist without a reader until T13] → T13 is the next task and depends on T12; the gap is stated in the proposal and closes without a test change (D-2).
- [Recursive listing of prompts directories on every resolution] → Directories are small (tens of files); if `hooks session-start` timing (T13, p95 targets in the design's NFRs) shows cost, the listing can be cached in `.machine/` keyed by directory mtimes.
- [`yaml` document edits reformat a flow collection the user wrote] → Only the edited node is replaced; a test fixes the behaviour on a file with comments, a flow sequence and the modeline.
- [Generated JSON formatting diverges from Prettier across versions] → The generator formats with the pinned Prettier the repository already uses; a Prettier bump regenerates in the same PR.

## Migration Plan

Order inside the Change: the `kernel-settings` spec first (user acceptance gate), then the kernel (layers, registry, prompts, snapshot, schema export, `config` slice, `doctor`), then the v2 switch (D-14) once `dist/bdk.mjs` answers `config show`, then documentation. The layer rename (D-13) touches T11's `shared/config` tests; the four `config-*.json` files and `doctor.json`, `version.json`, `refusal.json` become generated in one commit whose diff shows the contract changes of D-8 and the unchanged rest; the Purpose paragraph of `kernel-cli/config` (its representative refusal) is updated to a T12 key by hand, since a delta cannot change a Purpose.

For users of `staging/v3`: `.bdk/settings.json` stops being read. Running `/bdk:setup` again writes `.bdk/settings.yaml`; T32's `bdk import` converts the old file with the mapping of `kernel-settings`. Rollback is a revert of the PR, which restores the v2 readers.
