# Proposal

## Why

Tracks #181.

Every BDK skill except `/bdk:setup` starts with `bdk config show` and stops on "BDK not configured: run /bdk:setup" (design section "Configuration and extension points", spec `bdk-cli/config` "Configured project"). Nothing produces that configuration yet: the `bdk` plugin has the `config` commands (#179) and the BDK OpenSpec schema (#180), but no skill that turns a project into a configured BDK project. Until it exists, no other BDK skill can run in a user project, and the autopilot has no permission allow rules (design "Constraints & NFRs", "Permissions of the autopilot").

## What Changes

- New skill `plugins/bdk/skills/setup/` (`/bdk:setup`), the first skill of the `bdk` plugin, built with `/skill-creator` as a plain skill with eval cases (CLAUDE.md "Building skills (v3)"). It runs in the main thread (design "Catalog", orchestrators) and:
  - detects the stack from the project files: `languages`, `tools.test`, `tools.lint`, `tools.build` (each with a `scoped` form where the runner takes files) and `tools.e2e` for web, API and CLI products;
  - writes `.bdk/settings.yaml` and checks it with `bdk config check`;
  - adds permission allow rules to the project's `.claude/settings.json`: `Bash(bdk *)`, the `tools.*` commands, `git` and `gh` for the main thread (design "Permissions of the autopilot");
  - initialises OpenSpec with the pinned version (1.13.2) and installs the BDK schema from the plugin as the project's default schema (ADR-0003 D2-2, `bdk-openspec-schema` "Schema ships in the plugin and installs by copying");
  - keeps run artifacts and the local layer out of git (`.gitignore`), and treats v2 files (`.bdk/settings.json`) as detection hints.
- New command `bdk openspec install` (slice `src/openspec/`, spec `bdk-cli/openspec`): copies the BDK schema the plugin ships into the project. Recorded problem: in the acceptance runs Claude Code asked for manual approval of `cp -R` even under an allow rule ("`cp` with flags needs manual approval"), so the copy #180 D2 left to one shell line stopped every setup run.
- Eval cases `plugins/bdk/evals/setup-*` for a web app, an HTTP API, a CLI and a library without a runnable product.
- Resolves "How `tools.e2e` is detected for web, API and CLI projects" (issue, "To resolve in the spec") in spec `bdk-setup` and design D4.

## Capabilities

### New Capabilities

- `bdk-cli/openspec`: the `bdk openspec install` command.
- `bdk-setup`: the `/bdk:setup` skill: what it detects, what it writes (settings, permission rules, OpenSpec with the BDK schema, ignore rules), how `tools.e2e` is detected per product kind, re-runs, and its eval cases.

### Modified Capabilities

None. `bdk-cli/config` already defines the keys setup writes and the "configured" state it must reach; `bdk-openspec-schema` already defines installation by copying.

## Out of scope

- The `SessionStart` hook and the `subagent-git` guard (#182): setup writes `git` and `gh` allow rules; keeping workers away from git history is the guard's job.
- `bdk check run` (#183), which runs the `tools.*` commands setup writes.
- The rule pack and `bdk rules for` (#184), which read `languages`.
- The `e2e-check` block and its agent, which read `tools.e2e`.
- Any other `bdk` command: setup uses `bdk config show`, `bdk config check` and `bdk openspec install` (CLAUDE.md "Building skills (v3)").

## Impact

- New: `plugins/bdk/skills/setup/SKILL.md` with `references/`, `plugins/bdk/evals/setup-*/`, the slice `plugins/bdk/src/openspec/`.
- Shared: one row in `src/slices.ts`, one group in `src/main.ts`, the slice list in `CLAUDE.md`.
- Ships in the released `bdk` plugin (`skills/` is release content per `scripts/publish-plugin.ts`); `evals/` does not ship.
- No change to `package.json`, the lockfile or shared configuration.
