# Design

## Context

`plugins/bdk` holds the CLI frame of #178 (`shared/cli`, an empty `GROUPS` list in `main.ts`, the slice matrix in `src/slices.ts`, the architecture lint) and no slice. #178 design D7 left zod as the recommended library for both output schemas and the settings schema, and D8 left the OS wiring of a slice to the first slice. Draft 1 (`draft/v3-1:openspec/specs/kernel-settings/spec.md`) had four layers with bundle defaults, a module registry with one module per consumer slice, owner-task tables, Markdown prompt values, a snapshot file and a JSON Schema modeline; findings section 5 of `docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md` names that kind of machinery, built ahead of any consumer, as a root cause of draft 1's cost.

Parallel tasks #186 (`git`), #187 (`findings`) and #188 (`run`) add slices at the same time and need file access too. Their agents agreed on one `shared/fs` API and the dependency versions before implementation (messages between the task agents, 2026-10-07).

Two probes ran on Claude Code 2.1.292 with a throw-away plugin in `claude -p` (D6).

## Goals / Non-Goals

**Goals:**

- Every skill and agent can get the resolved configuration, with origins, from one `bdk config show`, and an unconfigured project yields exactly the stop line.
- One schema for every key of the design section "Configuration and extension points", strict, with the full dotted key in every problem.
- The first slice is the pattern later slices copy: anatomy, OS wiring, zod output schemas, tests.

**Non-Goals:**

- No registry of config modules per consumer, no owner-task tables, no prompt values, no snapshot file, no JSON Schema file (draft 1). A key's consumer refines its row when it lands.
- No migration from `.bdk/settings.json` (v2); that is `/bdk:setup`'s job.
- No `!` block in a real skill; skills land in their own tasks.

## Decisions

### D1. Settings schema: one zod schema in the slice's `domain/`

`domain/settings.ts` holds one zod v4 schema of the resolved configuration, `z.strictObject` at every level, a `.default()` on each leaf and `.prefault({})` on each nested object (zod 4's `.default()` would return `{}` without filling the inner defaults). The defaults are `SettingsSchema.parse({})`. Types come from `z.infer`. The same library gives the `--json` output schemas (#178 D7), so the bundle carries one validation library.

Alternatives: JSON Schema with ajv - lost: a second definition of every type, and ajv's errors name JSON pointers, not dotted keys. A registry of modules declared by each consumer slice (draft 1) - lost: no consumer exists yet, so the registry would hold every key anyway, plus a contract test between spec tables and code; the keys table in the spec and one schema file say the same with less. Hand-written validation - lost: types and checks drift.

### D2. Layer files are YAML, parsed with `yaml`

The design section fixes `settings.yaml`. `yaml` (eemeli/yaml 2.9.1) parses with line numbers, rejects duplicate keys by default, and its `Document` API edits a value while keeping comments and key order, which `set` needs. Alternative: `js-yaml` - lost: no comment-preserving writes.

### D3. Validate after merging, attribute each problem to a layer

Per-layer validation cannot use the schema directly: a local layer may hold a partial item (`tools.test.unit` with only `scoped`) that is valid only on top of the project item. So validation merges first and validates the merged result, then names the layer each problem comes from:

1. Each layer file is parsed (syntax and top-level mapping problems name the file and line) and scanned for duplicate ids.
2. For every prefix of the present layers (`default+global`, `default+global+project`, ...), the merged value is checked with `safeParse`. In every prefix but the last, "required field missing" issues are dropped, since a later layer may supply the field. So a value that a higher layer overrides is still reported (spec "config check"), and a partial item is not.
3. Each issue path becomes a dotted key (array index to item `id`), and the problem is attributed to the highest layer of that prefix holding the key, a key under it or a leaf above it. Problems are deduplicated by layer, key and message.

`show`, `check`, `set` and the slice's public `loadConfig` all use this one function, so `show` calls a configuration invalid exactly when `check` exits 1.

Origins work the same way: the resolved value is flattened into leaves (ids as segments, other arrays as one leaf), and each leaf's origin is the highest layer whose own flattened keys hold it, `default` otherwise.

Alternatives: a deep-partial layer schema - lost: zod 4 has no `deepPartial`, and a second schema built by a walker is code to maintain for the same result. Validating only the final merge - lost: an invalid global value hidden by a project override would surface later, when the override goes.

### D4. `config show` exits 0 for every configuration state

The probe (D6) shows that a `!` command exiting non-zero makes the host drop the skill without showing the output: the skill never sees "BDK not configured". So `show` reports `not-configured` and `invalid` as results with exit 0 and the state in `status`; only frame errors (usage, environment, internal) exit otherwise. `check` keeps the frame's convention, exit 1 for "problems found", because it is called through the Bash tool, which shows output and exit code. This follows `bdk-cli` "Exit codes" (a non-zero code is information for the skill, never a stop): here a non-zero code would be a stop.

Alternative: exit 1 for not-configured and `!`\`bdk config show || true\`` in every skill - lost: `allowed-tools: Bash(bdk *)` would not match the compound command, and every skill would carry the workaround.

### D5. What counts as configured, and where the project root is

Configured means `.bdk/settings.yaml` exists and the root holds `openspec/`. The global layer alone does not configure a project, since `/bdk:setup` writes the project file. OpenSpec is detected by the directory, not by `openspec/config.yaml` or the BDK schema of #180, so `show` does not depend on how setup lays out OpenSpec; checking the BDK schema is #180's and setup's work. The root is the nearest ancestor holding `.bdk/` or `.git` (a file in a git worktree, a directory otherwise), else the working directory, found with `shared/fs` `list` and no git process.

Alternative: the git top level via `git rev-parse` - lost: a child process on every skill start, and a project that is not a git repository would have no root.

### D6. Probes: `!` in a preloaded skill, and `!` with a non-zero exit

Claude Code 2.1.292, `claude -p --plugin-dir <probe> --permission-mode default`, model haiku:

- **`!` under `skills:`**: plugin agent `reader` with `tools: Read` and `skills: [probe:cfg]`; the skill holds `` !`expr 6 \* 7000 + 31` `` and `allowed-tools: Bash(expr *)`. The agent, told not to call a tool, quoted `Config line: 42031`. The value is computed, so the host ran the block when it preloaded the skill. Result: agents get the configuration from the `!` block of their own preloaded skill; the spec requirement "Configuration reaches skills and agents" records it. The fallback the issue asked about (configuration in the agent's prompt) is not needed.
- **Exit codes**: the same block as `sh -c '...; expr 2 + 2 >&2; exit 1'` gave an empty result; with `exit 0` the model saw both stdout and stderr. Result: D4.

### D7. Key set and defaults

The keys of the design section, with these choices where the section names only a family:

- `tools.test|lint|build` items: `id`, `command`, optional `scoped` that must contain `{files}`. `tools.e2e` items: `id`, `start`, `ready`, `driver`, optional `env` (keys are environment variable names, the one place that is not kebab-case).
- `policy.questions` defaults to `stop`; the design section names `decide-and-record` as the autopilot default, which the autopilot skill applies for its run, not the configuration.
- `policy.budgets.part-attempts` and `policy.budgets.review-rounds` (3 each), `policy.escalation.model` (`opus`): the smallest keys that say "attempts per part and round" and "model escalation on a blocker". Their consumer (execute, review round) may reshape them through a delta.
- `hooks.subagent-git` defaults to `false`; "on by default in an autopilot run" is again the autopilot's choice.
- `steps.<orchestrator>` items: `id`, optional `enabled`, optional `use`. No item field has a default, so `show` prints only what a layer set.
- Arrays merged by `id` cannot drop a lower item; `steps` items switch off with `enabled: false`. Removal for tools waits for a need.

### D8. Slice layout and OS wiring

```
src/config/
  index.ts            configGroup(deps), loadConfig(deps), types
  commands/           show.ts check.ts set.ts      argv -> input, call, render
  use-cases/          show.ts check.ts set.ts load.ts
  domain/             settings.ts (schema), merge.ts (merge, flatten, origins),
                      keys.ts (key resolution against the schema), validate.ts,
                      layer-files.ts (the layer file record)
  store/              layers.ts (root, layer paths, read, parse, write with yaml Document)
  render/             show.ts check.ts set.ts
  schema/             show.ts check.ts set.ts      zod schemas of --json results
  tests/              unit tests; memory.ts is the in-memory Files they share
src/shared/fs/        os-boundary: readText, list, writeText, appendText (sync); landed with #187
```

`main.ts` builds `{ files, cwd: process.cwd(), home: homedir(), env: process.env }` and passes it to every group factory (`configGroup(deps)`, `findingsGroup(deps)`); each slice declares the structural type it needs (`ConfigDeps` in `use-cases/load.ts`, since `commands/` may not import `store/`), so later slices add fields to the one object without a shared type. `shared/fs` is admitted as an OS boundary; its API is the one agreed with #186, #187 and #188 (sync; `readText` returns `undefined` for a missing file, `list` returns entries sorted by name or `undefined` for a missing directory, `writeText` and `appendText` create parent directories). #187 merged first, so this Change keeps that module and its tests and drops its own identical copy.

"Did you mean" reuses the frame's `closest` (`shared/cli`), which this Change exports from the frame's `index.ts`; it runs in use cases, since `domain/` may not import `shared/`.

Alternatives: a frame-wide context object passed to every command (#178 D8 rejected it). A `shared/config` module that any slice reads (draft 1) - lost: `bdk-cli` "Import matrix" puts data several slices read in `shared/` only once three slices read it; until then a consumer slice reads `config/index.ts` `loadConfig` through a matrix edge.

### D9. Output format

Text, one leaf per line: `key: <JSON value>  # <origin>`, after a first line `BDK configuration: root <root>; layers <layer> <file>, ...`. JSON values make types unambiguous (`"5"` versus `5`) and the form is valid YAML with a comment, which a model reads without a legend. Leaves keep the schema's key order and the merged item order, so output is stable. Problems print as `<file>: <key>: <message>`, the file relative to the root when it is under it.

## Risks / Trade-offs

- [The probes ran in `claude -p` on one host version; interactive mode may show the failing `!` differently] -> D4 does not depend on it: exit 0 is right in both modes. The requirement names the version; a host change is caught by the end-to-end check of the skills that use the block.
- [`set` validates against the configuration as it is now; a later change in another layer can make the written value invalid] -> `check` and `show` report it then, naming the file.
- [Parallel slices land the same `shared/fs`, `package.json` entries and `main.ts` lines] -> one agreed API and pinned versions; a later PR keeps the merged module and every `GROUPS` entry.
- [`yaml` bundled into ESM fails at runtime with "Dynamic require of process is not supported"] -> a `createRequire` banner in `build.ts` (landed first with #186); the end-to-end test of the built CLI fails without it. Alternative: `js-yaml` (pure ESM) - lost, see D2.
- [The plugin's `bin/` is on `PATH` in `claude -p --plugin-dir` (acceptance run of this Change) but not in `claude plugin eval` runs (#189)] -> the spec leaves the invocation form of the `!` block to the skill tasks; #189 recommends `${CLAUDE_PLUGIN_ROOT}/bin/bdk` in skill text.
- [Key rows chosen here for `policy.*` before their consumer exists] -> the consumer amends them by delta; nothing reads them yet, so no behaviour depends on the guess.

## Open Questions

None that change what gets built. Decisions worth the reviewer's attention: D4 (`show` exits 0 for every configuration state) and D7 (`policy.*` key shapes).
