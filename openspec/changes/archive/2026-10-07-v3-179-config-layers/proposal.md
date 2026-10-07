# Proposal

## Why

Tracks #179.

The design section "Configuration and extension points" of `docs/design/2026-10-07-v3-architecture.md` (ADR-0003) makes every BDK skill start with a `!` block running `bdk config show`, so the resolved configuration is in the context before the model's first turn, and a project without a configuration stops cleanly with "BDK not configured: run /bdk:setup". No `config` command exists yet: `plugins/bdk` holds only the CLI frame (#178), so no skill can be written against the configuration, and the three keys tables every later task reads (`tools.*`, `policy.*`, `plan.part.*`, ...) have no schema.

## What Changes

- New command group `bdk config`, the first product slice of the CLI (`src/config/`), following the slice architecture of `bdk-cli`:
  - `bdk config show [<key>]` prints the resolved configuration, each leaf with its origin layer (`default`, `global`, `project`, `local`); without a project configuration or without OpenSpec it prints the one line `BDK not configured: run /bdk:setup`, and with an invalid configuration one line naming the problem, both with exit 0 so the `!` block injects them (design D3).
  - `bdk config check` validates every layer file and lists each problem with its file and full dotted key; exit 1 when it found any.
  - `bdk config set <key> <value> [--layer global|project|local]` writes one key into one layer file after validating the result, keeping the file's comments.
- Three layer files over built-in defaults: global `~/.config/bdk/settings.yaml` (`$XDG_CONFIG_HOME/bdk/settings.yaml` when set), project `.bdk/settings.yaml`, local `.bdk/settings.local.yaml`. Mappings deep-merge, arrays of items with an `id` merge item by item on `id`, every other array and scalar is replaced by the higher layer.
- The settings schema of the keys in the design section's table: `tools.test|lint|build|e2e`, `languages`, `rules.disabled`, `models.<role>`, `policy.gates.*`, `policy.questions`, `policy.budgets.*`, `policy.escalation.*`, `plan.part.*`, `steps.<orchestrator>`, `execution.lead`, `hooks.subagent-git`, with types and defaults. Unknown keys are rejected by full dotted name.
- The OS wiring pattern for slices that later tasks copy: the `shared/fs` OS boundary (API agreed with the parallel tasks #186, #187, #188; it landed first with #187 and this Change uses that module), and `main.ts` passing one object of OS dependencies into each slice's group factory.
- Runtime dependencies `zod` (settings schema and `--json` output schemas, as #178 design D7 recommended) and `yaml` (layer files, with comment-preserving writes for `set`).
- The probe "does `!` resolve in a skill preloaded into an agent with `skills:`" is run and recorded in the spec: it does, so agents get the configuration from their own preloaded block skill.

### Resolved from "To resolve in the spec"

- **Schema format and validation library:** a zod v4 schema in the config slice's `domain/`, strict at every level; YAML for the layer files, parsed with `yaml`. Design D1, D2.
- **How agents get configuration if `!` does not resolve under `skills:`:** the probe shows it does resolve (Claude Code 2.1.292), so a block skill preloaded into an agent starts with the same `!` block as any other skill; no prompt hand-off is needed. Recorded as a requirement of `bdk-cli/config` with the evidence in design D6.

### Out of scope

- `/bdk:setup` and the `!` block in real skills: the skills land with their own tasks (setup, #180 and the block tasks); this Change provides the command they call.
- Consumers of the keys: `bdk check run` reads `tools.*`, `bdk rules for` reads `languages` and `rules.disabled`, `bdk plan check` reads `plan.part.*`, the `hooks` slice reads `hooks.subagent-git`. Each task may refine its keys' shape through a delta of `bdk-cli/config`.
- The BDK OpenSpec schema itself (#180); `config show` only checks that the project uses OpenSpec.
- `bdk git` (#186), `bdk findings` (#187), `bdk run status` (#188): they reuse `shared/fs` and the wiring pattern.

## Capabilities

### New Capabilities

- `bdk-cli/config`: the `bdk config` command group - the layer files and their merge, the settings keys with types and defaults, `show` with origins and the not-configured line, `check`, `set`, and how skills and agents get the resolved configuration.

### Modified Capabilities

None. `bdk-cli` already says how a slice wires OS access (OS boundary, `shared/` admission); the new `shared/fs` module and the first matrix row follow it without changing a requirement.

## Impact

- New: `plugins/bdk/src/config/` (slice), `openspec/specs/bdk-cli/config/` (through archive).
- Changed: `plugins/bdk/src/main.ts` (OS dependencies object, `config` group), `plugins/bdk/src/slices.ts` (row `config`), `plugins/bdk/src/shared/cli/index.ts` (exports `closest`), `CLAUDE.md` ("Current state" lists the `config` slice), `plugins/bdk/package.json` (`zod` 4.6.5, `yaml` 2.9.1), `pnpm-lock.yaml`, `plugins/bdk/tests/cli.test.ts` (end-to-end cases of `bdk config`).
- The `createRequire` banner in `plugins/bdk/build.ts` that `yaml`'s CommonJS build needs inside the ESM bundle landed first with #186; this Change relies on it.
- Parallel work: #186, #187 and #188 add slices and use the same `shared/fs` API and dependency versions, agreed before implementation; a later PR keeps the merged module. All edit `slices.ts`, `main.ts`, `package.json` and the lockfile in different entries.
