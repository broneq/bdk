# Proposal

## Why

Tracks #175.

ADR-0002 puts every BDK plugin in one directory of this repository (`plugins/<name>/`), released per plugin from `main` onto the `release` branch. Two of the four plugins, `git-identity` and `bdk-skill-kit`, still live in their own repositories (`broneq/git-identity`, `broneq/bdk-skill-kit`) with their own toolchains, release configs and CI. Until they move in, they are released and checked by a different flow from the rest of BDK, and the marketplace of this repository points at repositories that v3 retires (design `2026-10-07-v3-repo-structure-cicd.md`, sections "Repository layout" and "Migration").

## What Changes

- Import the full `main` history of `broneq/git-identity` into `plugins/git-identity/` and of `broneq/bdk-skill-kit` into `plugins/bdk-skill-kit/`, with `git filter-repo --to-subdirectory-filter` and a merge with `--allow-unrelated-histories`.
- Rewrite the old tags of both repositories to the ADR-0002 tag form (`git-identity--v0.2.0`, `bdk-skill-kit--v0.1.0` ... `bdk-skill-kit--v0.3.0`) and push them, so release-please continues each plugin's version line instead of starting over (resolves "To resolve in the spec").
- Move both plugins onto the root toolchain: pnpm workspace, ESLint, Prettier, TypeScript, Vitest. `git-identity` leaves Biome and `node --test`; `bdk-skill-kit` leaves its own ESLint, Prettier, commitlint, husky, knip and Vitest configs. Both lose their own CI workflows, release-please configs and lockfiles.
- **BREAKING** (`bdk-skill-kit` consumers): `dist/` is no longer committed. The release job builds it onto the `release` branch; a project that pinned `github:broneq/bdk-skill-kit#v<x>` keeps working (the archived repository keeps its tags), and new pins point at a commit of `broneq/bdk`'s `release` branch.
- `bdk-skill-kit`'s CLI reads its version from `.claude-plugin/plugin.json`, the plugin's only version (ADR-0002); `package.json` of both plugins carries no version.
- Register both plugins as release-please components and seed `.release-please-manifest.json` with their last released versions.
- Move the `bdk-skill-kit` living spec (`skill-kit`) and its archived changes into this repository's `openspec/`.
- Switch both marketplace entries to `git-subdir` sources at `plugins/<name>`, `ref: release`; plugin names stay the same.
- Archive `broneq/git-identity` and `broneq/bdk-skill-kit` after a README commit that points to `broneq/bdk`.

## Capabilities

### New Capabilities

- `plugin-imports`: how a plugin that lived in its own repository joins this repository - its history, its version line and its tags, and the retirement of the old repository.
- `marketplace`: which plugins the `bdk` marketplace lists and where each one installs from.

### Modified Capabilities

- `skill-kit`: Distribution is replaced by "Distribution from the BDK repository" (no committed `dist/`, lives in `broneq/bdk` under `plugins/bdk-skill-kit/`, installed from the `release` branch); Release (monorepo release flow and checks, version from `plugin.json`), Kit skill (the self-check runs in the workspace test suite). The spec itself moves in from `broneq/bdk-skill-kit` unchanged before the delta applies.
- `repo-sdlc`: every plugin uses the root toolchain only, so the `check` job covers it.

## Impact

- New: `plugins/git-identity/`, `plugins/bdk-skill-kit/` with their history; `openspec/specs/skill-kit/`; `plugins/git-identity/.claude/CLAUDE.md` (moved from the plugin root, D10); archived skill-kit changes under `openspec/changes/archive/`.
- Changed: `.claude-plugin/marketplace.json`, `release-please-config.json`, `.release-please-manifest.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierignore`, `.gitignore`, `package.json` / `pnpm-lock.yaml` (root dev dependencies: `@vitest/coverage-v8`; skill-kit: `esbuild`, `yaml`).
- Out of scope: the `bdk` plugin and its marketplace entry (still pinned to `v2.7.0`), the release-please dry run (#173), running `skill-check` over every plugin in the `plugins` CI job (later, with the `bdk` plugin), the first real release (#213).
- External: tags pushed to `broneq/bdk`; two repositories archived.
