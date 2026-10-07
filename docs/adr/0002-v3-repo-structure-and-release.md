---
status: accepted
date: 2026-10-07
decision-makers: broneq
---

# ADR-0002: v3 repository structure and release flow - one directory per plugin, builds on a `release` branch

## Context and Problem Statement

BDK v3 ships several Claude Code plugins (`bdk`, `bdk-craft`, `git-identity`, `bdk-skill-kit`) and built Node CLIs from one repository. An installed plugin is copied into the user's cache on its own, so its built CLI has to travel with it, and the installed files must match a released version. How is the repository laid out, and how does a built CLI reach an installed plugin?

The full design, with diagrams, CI jobs and the risk register, is in [`docs/design/2026-10-07-v3-repo-structure-cicd.md`](../design/2026-10-07-v3-repo-structure-cicd.md).

## Decision Drivers

- Every plugin installs and works alone, without the core.
- Node >= 22.18 only, no Python; runtime npm dependencies allowed.
- Separate version and tag per plugin, released through release-please release PRs.
- 5-10 parallel agent sessions open PRs: no generated files in PRs.
- PR CI on Linux, at most 5 minutes; paid evals only locally.
- Do not over-engineer.

## Considered Options

1. **A - one directory per plugin, builds on a `release` branch.**
2. **A2 - `main` receives only releases**, with `dist/` committed by the release job; work lands on `staging`.
3. **B - CLIs as npm packages**, thin plugins pinning them in `package-lock.json`, installed by Claude Code at plugin install.
4. **C - zip archives in GitHub Releases**, referenced by `archive` sources with `sha256` in `marketplace.json`.

## Decision Outcome

**Chosen option: A.** Each plugin owns `plugins/<name>/` (manifest, skills, agents, hooks, `bin/`, CLI source, tests, evals). `main` holds sources only. When release-please releases plugin `P`, a publish job builds `P` from its tag `P--vX` with esbuild into one file, validates the snapshot with `claude plugin validate --strict`, and replaces only `plugins/P/` on the `release` branch. Marketplace entries install `plugins/<name>` at `ref: release`.

It is the only option that keeps one change of CLI and skill in one PR and one release, needs nothing but git at install time, gives a fresh install a released version, and keeps generated files out of PRs.

### Consequences

- ✅ Directory = plugin name = release-please component = tag prefix (`bdk--v3.0.0`, the `claude plugin tag` convention).
- ✅ `plugin.json` `version` is the single source of a plugin's version; the build injects it into the CLI.
- ✅ Users get runtime files only: no `src/`, `tests/`, `evals/`.
- ❌ A second branch exists that only CI writes, through a GitHub App allowed by a ruleset.
- ❌ Dev mode needs `pnpm build` before `claude --plugin-dir plugins/<name>`.
- 🟡 Tags point at `main` commits without `dist/`. If plugins ever depend on each other with version ranges, tags must move to `release` commits.
- 🟡 `pnpm-lock.yaml` is a generated file in PRs; dependency changes go in their own PR.

### Implementation Requirements

- [ ] Repository skeleton: root pnpm workspace and toolchain, `pr.yml`, `release.yml`, release-please manifest config, `release` branch bootstrap, GitHub App and ruleset.
- [ ] Release-please dry run confirming the `extra-files` updater on `.claude-plugin/plugin.json` and the handling of `version.txt`.
- [ ] Migrate v2 into `plugins/bdk/`: remove or port the Python hooks and the pytest job, quote `${CLAUDE_PLUGIN_ROOT}` in hooks.
- [ ] Merge `git-identity` and `bdk-skill-kit` into `plugins/` with history, switch the marketplace entries, archive both repositories.

## Pros and Cons of the Options

### A - one directory per plugin, `release` branch

- ✅ One PR and one release per change; install needs only git; released content only.
- ❌ Second branch; the publish job is the single writer of what every user installs (mitigated by validation before push).

### A2 - `main` receives only releases

- ✅ No third branch.
- ❌ `dist/` is tracked, so a local build changes tracked files and CI must reject PRs that touch it; users get sources, tests and evals.

### B - CLIs as npm packages

- ✅ No generated files in git, no second branch.
- ❌ Two releases per change; install depends on the npm registry (60 s limit, the plugin loads without its CLI on failure); a fresh install gets `HEAD` of `main`; two package managers.

### C - zip archives in GitHub Releases

- ✅ Immutable artifacts, same benefits as A.
- ❌ Every release commits a new URL and hash to `marketplace.json`; reproducible zips to maintain. Kept as the fallback for A.
