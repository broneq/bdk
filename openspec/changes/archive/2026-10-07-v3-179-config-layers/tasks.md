# Tasks

The CLI helper `bdk config` answers a recorded problem: the design section "Configuration and extension points" requires every skill's `!` block to inject the resolved configuration, and the probes of design D6 showed the block needs a command that exits 0 in every configuration state.

## 1. Dependencies and the `shared/fs` boundary

- [x] 1.1 Add `zod` 4.6.5 and `yaml` 2.9.1 as exact `dependencies` of `plugins/bdk/package.json`; `pnpm install` updates the lockfile.
- [x] 1.2 Write failing tests `src/shared/fs/tests/fs.test.ts` against a temporary directory: `readText` of a missing file and of a path under a file is `undefined`; `list` sorts entries, marks directories, and is `undefined` for a missing directory; `writeText` and `appendText` create parent directories and `appendText` appends.
- [x] 1.3 Implement `src/shared/fs/index.ts` (design D8) and admit it in `src/slices.ts` as `os-boundary`; tests of 1.2 and `pnpm lint` pass. (#187 merged the same API first; the rebase kept its module and tests.)

## 2. Domain: schema, merge, keys, validation

- [x] 2.1 Write failing tests in `src/config/tests/` for: defaults of every key of the spec table; merge by `id`, scalar array replace, deep mapping merge; flatten and origins; issue path to dotted key with ids; key resolution with suggestions candidates; validation over layer prefixes (overridden invalid value reported, partial item not reported until the last prefix, duplicate id, unknown key, missing required field).
- [x] 2.2 Implement `domain/settings.ts`, `domain/merge.ts`, `domain/keys.ts`, `domain/validate.ts`; tests of 2.1 pass.

## 3. Store and use cases

- [x] 3.1 Write failing tests for `store/layers.ts` and the use cases with an in-memory `Files`: project root from a subdirectory, `.git` file, fallback to cwd; global path with and without absolute `XDG_CONFIG_HOME`; YAML syntax error with line; non-mapping top level; empty file; `show` states ok / not-configured (missing settings, missing openspec) / invalid; `show <key>` filter and `usage/unknown-key` with hint; `check` problems and exit; `set` into each layer, creating files and id items, keeping comments, refusing unknown key, invalid value (file unchanged) and an unparsable layer.
- [x] 3.2 Implement `store/layers.ts`, `use-cases/load.ts`, `show.ts`, `check.ts`, `set.ts`, exporting `closest` from `shared/cli/index.ts`; tests of 3.1 pass.

## 4. Commands, rendering, output schemas, wiring

- [x] 4.1 Write failing tests: each command's text output and `--json` output parsed with its `schema/` zod schema; help of `bdk config`, `bdk config set --help`; `--layer` with a bad value is a usage error.
- [x] 4.2 Implement `schema/`, `render/`, `commands/`, `index.ts` (`configGroup`, `loadConfig`), add the `config` row to `src/slices.ts`, and wire `main.ts` (deps object, `GROUPS`); tests of 4.1 and `pnpm lint` pass.
- [x] 4.3 Add end-to-end cases to `plugins/bdk/tests/cli.test.ts` running the built `bin/bdk` in a temporary project with isolated `HOME` and `XDG_CONFIG_HOME`: show with origins, not-configured line with exit 0, check rejecting an invalid value with its key and exit 1, set then show.

## 5. Acceptance and gates

- [x] 5.1 Acceptance end to end in a separate test project: `pnpm build`, a copy of the built plugin plus a throw-away probe skill starting with `` !`bdk config show` `` and an agent preloading it; `claude -p --plugin-dir <copy>` shows the configuration with origins in a configured project and the not-configured line in an empty one, in the main thread and in the agent; `bdk config check` rejects an invalid value naming the key.
- [x] 5.2 Run every CI check: `pnpm check`, `pnpm exec claude plugin validate .claude-plugin/marketplace.json --strict` and each plugin directory, `openspec validate v3-179-config-layers --strict`, `openspec validate --specs --strict`; all pass.
