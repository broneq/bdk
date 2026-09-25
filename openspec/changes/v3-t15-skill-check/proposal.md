# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T15. Tracks #67.

BDK has no content tests on its skills (A3; `docs/V3-SKILL-INVENTORY.md` section 9). Every convention a skill must follow is checked today by two model-judged dev-time lints (`.claude/skills/skill-lint`, `.claude/skills/agent-lint`), which nothing runs in CI. v3 adds rules whose violation fails silently at user runtime: the one `!` wrapper form (`kernel-cli`, Invocation), `allowed-tools` for that wrapper (HOST-FACTS `allowed-control`), `disable-model-invocation` on the gate skills (T1), and the portable field set for `bdk-craft` (R-1). T02 decided (R-15) that these checks become a separate, reusable TypeScript tool with BDK's own rules as a plugin to it, and (R-13) that "a skill fronting a CLI" is an authoring rule, not a one-off. T41 and T42 rewrite the skills against these rules, so the checker must exist first.

## What Changes

- **New repository `broneq/bdk-skill-kit`**, a Claude Code plugin in the BDK marketplace (same pattern as `broneq/git-identity`), which contains:
  - `skill-check`: a deterministic validator for Agent Skills directories and agent files. It is a TypeScript CLI and library, bundled into committed `dist/*.mjs` files (the `dist/bdk.mjs` pattern). It has generic rules (frontmatter, name, description, body, line limit, absolute paths, model names, references, unused files, unique names, the CLI-fronting rule) and a `--portable` profile that admits only the six Agent Skills standard fields. It also has a plugin API for project rules, a config file, a baseline of known violations that can only shrink, human, JSON and GitHub-annotation output, and fixed exit codes.
  - Skill `skill-check`: a thin CLI-fronting skill (R-13): model-invocable, at most 30 lines. It says when to run the checker, gives the one invocation form and points at `--help` as the only usage text.
  - Skill `skill-authoring`: the rules for writing a skill. It covers size, process versus knowledge, progressive disclosure, references, directory layout, descriptions, CLI-fronting skills and the admission rule of R-6. It is distilled from `.claude/rules/skill-creation-rules.md`, `skill-structure.md`, `portability-check.md`, the Agent Skills specification and T02. Every statement a rule can check names that rule's ID, and a test in the kit keeps the two in sync.
  - Its own tests, CI and release-please. The first release is `v0.1.0`.
  - Its own OpenSpec root with the living spec `skill-kit` (the contract of the CLI, config, plugin API, rule catalogue, profiles, baseline, output and the two skills). It is not a capability of BDK (design D-2).
- **In BDK:**
  - A BDK rule plugin (`tools/skill-check/`) with the rules listed in the plan's scope. The wrapper regex is read from the `kernel-cli` spec by a contract test, so the two cannot drift.
  - A config `skill-check.config.ts` that declares the `bdk` targets (skills, agents) and a portable target group reserved for `bdk-craft`.
  - A baseline for the 24 v2 skills and v2 agents, which break the new rules until T41 and T42 replace them.
  - Seeded-violation fixtures, one per rule, run by a contract test.
  - The CI stub step replaced by the real check.
  - A pre-commit hook when a skill or agent file is staged.
  - The kit pinned as a devDependency by release tag.
  - A `bdk-skill-kit` entry in `.claude-plugin/marketplace.json`.
  - `.claude/skills/skill-lint` and `agent-lint` reduced to the checks T02 kept as dev-time judgment.

Resolutions of the plan's "To resolve in the spec" (details and alternatives in design.md):

- **Package name and repository:** repository and plugin `broneq/bdk-skill-kit` (user decision). The CLI and the rule-ID namespace are `skill-check`. It is distributed through the BDK marketplace (github source), and BDK's CI consumes it as a git-tag devDependency. There is no npm publication: the unscoped name `skill-check` is taken, and nothing needs npm yet.
- **Which `skill-lint` checks are deterministic enough to port:** exactly the rows T02 section 9 classes "CI" (skill-lint 1-3, 6, 8-17, 19, 20, 22 fixed list; agent-lint 1-3, 6-14). Plus the new ones that section names: the S1 line limit and the P11 ban on model names in prose. Checks classed "dropped" (skill-lint 7 per OD-10, 18, 21; agent-lint 16) are not ported. Checks classed "dev-time" stay in the reduced lint skills. Mapping in design.md.
- **Agent adapters:** validated by the same tool, as a second target kind (`agents`), with generic agent rules plus `bdk/adapter-shape`. That adapters are byte-identical to `bdk export agents` output stays a kernel content test (T42, `kernel-cli/export`).

Inputs carried by citation: T02 decisions R-1, R-6, R-13, R-15, OD-10; T02 section 9 (lint classification); design S1, P9, P11, T1, Q1, A3; `kernel-cli` Invocation (content-wrapper regex, `--help` rule); `kernel-architecture` CI pipeline; HOST-FACTS `allowed-compound`, `allowed-control`; BMAD `tools/validate_skills.py` (rule catalogue and output modes); Agent Skills specification (agentskills.io/specification); plugins reference (`bin/` blocks installation on claude.ai and Cowork, so the kit uses `node ${CLAUDE_PLUGIN_ROOT}/dist/...` instead).

Out of scope:

- Rewriting or fixing the v2 skills and agents (T41, T42); the baseline carries them until then.
- The `bdk-craft` plugin, its directory, the `skills` array in `plugin.json`, and the `bdk-cli` skill (T42). T15 ships the portable target group and the CLI-fronting rule they will use, proven on fixtures.
- Generating adapters and the STARTUP agents table (T23, T42, P11).
- Free-prose invariant detection for `disallowed-tools` (T02: dev-time), and project-specific reference heuristics (skill-lint 4, 5).
- Publishing the kit to npm.

## Capabilities

### New Capabilities

- `skill-content-checks`: how BDK applies `bdk-skill-kit`. Covers the BDK rule plugin, BDK's targets and limits, the v2 baseline, seeded-violation fixtures, the CI step and the pre-commit hook.

### Modified Capabilities

- `kernel-architecture`: requirement "CI pipeline". The skill content step is no longer a stub; it runs `skill-check` with the BDK rule plugin and fails the build on a finding.

## Impact

- New public GitHub repository `broneq/bdk-skill-kit`. Creating it and cutting `v0.1.0` are outward actions confirmed with the user during apply.
- BDK: `package.json` (devDependency, `skill-check` script, lint-staged entry), `pnpm-lock.yaml`, `tsconfig.json` and `knip.json` (include `tools/`), `vitest.config.ts` (fixture test in the `contract` project), `.github/workflows/tests.yml` (step `skill-check`), `.claude-plugin/marketplace.json`, `.claude/skills/skill-lint`, `.claude/skills/agent-lint`.
- The skill content step and the plugin config need Node >= 22.18, because type stripping is how a `.ts` config and plugin load. CI's `skill-check` job uses `.nvmrc` (24). The kernel's user-runtime floor of 22.13 is unaffected.
