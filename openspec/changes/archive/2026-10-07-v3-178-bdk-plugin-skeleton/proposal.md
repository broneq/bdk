# Proposal

## Why

Tracks #178.

ADR-0002 puts the `bdk` plugin in `plugins/bdk/` with a TypeScript CLI built to `dist/`, and ADR-0003 (principle 6 of the design section "Principles") makes that CLI a helper that computes or saves a model turn and never governs the work. Neither exists yet, so no command of the design section "CLI" (`bdk config` #179 first) has a place to land, and nothing yet stops the CLI from growing back into the draft 1 kernel (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, section 5 "Architecture: root causes").

## What Changes

- New plugin directory `plugins/bdk/`: `.claude-plugin/plugin.json` (the only version of the plugin, per ADR-0002), `bin/bdk` launcher, `package.json` (private, no version), `tsconfig.json`, CLI source under `src/` and an esbuild `build` that writes `dist/bdk.mjs` with the plugin version injected (design `2026-10-07-v3-repo-structure-cicd.md`, "CLI invocation").
- An empty CLI that later tasks add commands to: command routing, `bdk --help`, group and command help, `bdk --version`, the `--json` flag, the output conventions shared by every command and the exit codes. It ships no command group of its own.
- The CLI source architecture is taken over from `draft/v3-1`: vertical slices, one per command group, each owning its whole vertical (argv parsing, use case, text and JSON rendering, output schema, tests next to the code); `shared/` holding only OS boundaries or code that three or more slices use; an import matrix, the layer direction inside a slice and the OS boundary enforced by ESLint (`eslint-plugin-boundaries` and built-in rules, generated from the matrix), so a violation is reported at the import line in `pnpm lint`. Source: `draft/v3-1:openspec/specs/kernel-architecture/spec.md` ("Vertical slices", "Dependency matrix", "Slice anatomy", "shared/ admission rule") and design decision D-13 of the archived Change `v3-t10-kernel-cli-contract`. What is not taken over is named in design.md, with the finding it would repeat.
- The architecture is made durable for later tasks: a living spec, a path-scoped rule in `.claude/rules/` and one pointer line in `CLAUDE.md` (design.md decides the split and gives the exact text).
- Release wiring for the new plugin directory: `release-please-config.json` and `.release-please-manifest.json` gain `plugins/bdk` (CLAUDE.md "Target layout"; `tests/release-components.test.ts` requires it).
- The `bdk` marketplace entry switches from the `v2.7.0` tag to `git-subdir` `plugins/bdk` at `ref: release` (ADR-0002), and the "Current state" section of `CLAUDE.md` says so.

### Resolved from "To resolve in the spec"

- **Output format conventions shared by all commands:** resolved in design.md (D6, D7) and specified in `bdk-cli` ("Output streams", "JSON output", "Errors", "Exit codes", "No waiting on input"). In short: the result goes to stdout and nothing else does; `--json` prints exactly one JSON document matching the command's output schema; an error is one shape with a stable `code`; five exit codes, where 1 means "the command ran and the answer is no" and never "stop the skill"; no command reads stdin unless its argument is `-`, prompts, colours or waits.

### Out of scope

- Every command group of the design section "CLI": `bdk config` (#179, the first slice), `check`, `git`, `rules`, `findings`, `plan`, `run` and `hooks session-start`, each in its own task. No `hooks/hooks.json` is added here.
- Skills, agents, hooks, rules and the BDK OpenSpec schema of the `bdk` plugin (#180 and later block tasks).
- The release-please dry run and `version.txt` handling (#173); the first real release and its end-to-end check on `main` (#213).
- Merging `git-identity` and `bdk-skill-kit` and switching their marketplace entries (#175); this Change touches only the `bdk` entry.
- The docs site and its deployment (#212). The CLI is not documented on the site in this Change.

## Capabilities

### New Capabilities

- `bdk-plugin`: the `bdk` plugin package - manifest, `bin/bdk` launcher, the build that produces `dist/bdk.mjs`, and the marketplace entry that installs it.
- `bdk-cli`: the `bdk` command line frame shared by every command - invocation and routing, help, version, output streams, `--json`, the error shape, exit codes, no waiting on input - and the source architecture every command follows (vertical slices, slice anatomy, import matrix, `shared/` admission, `node:` boundary). Command groups add their own capabilities later as `bdk-cli/<group>` (e.g. `bdk-cli/config` in #179).

### Modified Capabilities

None. `repo-sdlc` already requires every plugin directory to be a release component and the `plugins` job to validate every plugin; `plugin-release` already requires `bin/<cli> --version` to print the released version. This Change meets those requirements for `plugins/bdk` without changing them.

## Impact

- New: `plugins/bdk/` (`.claude-plugin/plugin.json`, `bin/bdk`, `package.json`, `tsconfig.json`, build script, `src/`, `tests/`), `.claude/rules/bdk-cli.md`, `openspec/specs/bdk-plugin/`, `openspec/specs/bdk-cli/` (through archive).
- Changed: `.claude-plugin/marketplace.json` (`bdk` entry), `release-please-config.json`, `.release-please-manifest.json`, `CLAUDE.md` ("Current state" and one pointer line), `eslint.config.mjs` (spreads the architecture block), `package.json` (`eslint-plugin-boundaries` dev dependency), `pnpm-lock.yaml` (new workspace package, its `esbuild` dev dependency and `eslint-plugin-boundaries`; unavoidable, since a new workspace package is itself a lockfile entry).
- Users: none until `staging/v3` merges into `main` and the first `bdk--v*` release is published; from then on `/plugin install bdk@bdk` installs v3 from the `release` branch instead of v2 (#213 checks this end to end).
- Parallel work: #175 also edits `.claude-plugin/marketplace.json`, `release-please-config.json`, `.release-please-manifest.json` and `pnpm-lock.yaml`. The edits touch different entries; the second PR to merge resolves the conflict by keeping both entries and regenerating the lockfile with `pnpm install`.
