## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T42 (Delivery item 5, `v3-t42-craft`). Tracks #62.

Knowledge skills that call no kernel do not belong in `bdk`: they are portable to every Agent Skills host, they install alone, and each must earn its place by a measured difference (`docs/V3-SKILL-INVENTORY.md` R-1, R-6). `bdk` still ships three of them as v2 content (`debug`, `test-driven-development`, `mermaid-drawer`), and the six other craft skills of R-6 do not exist. This is the last of the five T42 Changes; #62 closes after it.

## What Changes

- **New plugin `bdk-craft`** at `plugins/bdk-craft/` in this repository, with its own `.claude-plugin/plugin.json`, listed in `.claude-plugin/marketplace.json` through a `git-subdir` source. No build step, no kernel call, only the six Agent Skills standard fields (R-1).
- **Nine craft skills**, written as processes or concrete choices, never summaries of what a capable model already knows (R-6): `tdd`, `debugging`, `mermaid-drawer` (rewritten from the v2 skills), and `oop-design`, `api-design`, `refactoring`, `data-modeling`, `testing-strategy`, `modularizing` (new). Each stays at or below 200 lines and passes `skill-check` with the portable profile.
- **Admission by measurement**: every craft skill gets a task file and a with / without probe (`skill-evals`, With / without mode). A skill whose `with` cell does not beat `without` measurably is not shipped; the measurement report under `docs/` lists every skill with its verdict. The with / without harness learns to build a copy of `bdk-craft` for a `bdk-craft:<name>` skill.
- **Craft in dispatch packages**: an `implementer` package gets a `Craft` section naming the craft skills for its work (`tdd` always, `debugging` too when the Change is of kind `bug`), when `bdk-craft` is installed; the section tells the agent to print each with the new `bdk ctx craft <name>`. Without `bdk-craft` the section is absent and nothing else changes (R-8).
- **BREAKING** for `bdk` users: `/bdk:debug`, `/bdk:test-driven-development` and `/bdk:mermaid-drawer` leave `bdk`. The replacements are `bdk-craft:debugging` with `/bdk:change --kind bug`, `bdk-craft:tdd`, and `bdk-craft:mermaid-drawer`. Their ctx manifest entries, baseline entries and references go with them.
- `skill-check.config.ts` gains a portable target over `plugins/bdk-craft/skills`. Release-please gains a `bdk-craft` package with its own version.
- README, STARTUP_INSTRUCTIONS.md, CLAUDE.md, CONTRIBUTING.md and the user guide name the new plugin and the replacements.

Out of scope: the final README tables and the 3.0 release of both plugins (T32 / T50); the multi-host portability run (T50); `bin/bdk` (T52).

## Capabilities

### New Capabilities

- `craft-skills`: the `bdk-craft` plugin, its layout and marketplace entry, the shape and admission rule of a craft skill, the nine skills, and the removal of the three v2 skills from `bdk`.

### Modified Capabilities

- `kernel-cli/dispatch`: `bdk dispatch build` adds the `Craft` section to an `implementer` package.
- `kernel-cli/ctx`: new command `bdk ctx craft <name>` that prints an installed `bdk-craft` skill.
- `kernel-architecture`: the `ctx` slice lists the `craft` command.
- `skill-evals`: the with / without mode measures a `bdk-craft:<name>` skill on a copy of `bdk-craft`.

## Impact

- New: `plugins/bdk-craft/` (manifest, nine skills, references), `kernel/tests/contract/craft-skills.test.ts`, task files under `evals/suites/with-without/examples/`, a measurement report under `docs/`.
- Kernel: `kernel/src/ctx/` (the `craft` command and the lookup of installed craft skills), `kernel/src/dispatch/` (the `Craft` section), `schema/cli/commands.json`.
- Removed from `bdk`: `skills/debug/`, `skills/test-driven-development/`, `skills/mermaid-drawer/`, their `SKILL_CONTEXT` entries and baseline entries.
- Tooling: `evals/suites/with-without/`, `skill-check.config.ts`, `.github/release-please-config.json`, `.github/.release-please-manifest.json`, `.claude-plugin/marketplace.json`.
- Eval spend: one probe per craft skill (estimated 30 to 60 USD in all, approved by the user on 2026-10-04); no full series.
