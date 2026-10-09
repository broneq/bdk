# Proposal

## Why

Tracks #310.

`skill-check` crashes on a skills target whose `dirs` entry is an absolute path, although config validation accepts it. `src/config.ts` checks a target directory with `resolve(root, dir)`, but `src/discover.ts` builds the scan base with `join(root, dir)`, which appends the absolute path to the config directory. A config outside the project with `dirs: ["/abs/path/skills"]` then fails with `ENOENT ... scandir '<config dir>/abs/path/skills'` and a stack trace instead of checking the skills. Reproduced with the built `dist/skill-check.mjs` and a scratch config naming `plugins/bdk/skills` by its absolute path.

## What Changes

- One function in `src/config.ts`, `targetDir(root, dir)`, resolves a target directory against the config root (`resolve`). Config validation and discovery both call it, so the two can no longer disagree.
- `src/discover.ts` scans `targetDir(root, dir)` instead of `join(root, dir)`, for the scan base and for the set of container directories.
- A discovery test with an absolute `dirs` entry, and a CLI test that runs a config outside the project against an absolute skills directory.
- The `skill-kit` spec states how a target directory is resolved.
- The kit README says a directory is relative to the config file or absolute.

## Capabilities

### New Capabilities

### Modified Capabilities
- `skill-kit`: "Targets and configuration" states that a target directory is resolved against the config root, an absolute one used as written, the same way in validation and discovery.

## Impact

- Code: `plugins/bdk-skill-kit/src/config.ts`, `src/discover.ts`, their tests.
- Docs: `plugins/bdk-skill-kit/README.md` (config section). No docs/guide/ or docs/concepts/ page describes the `bdk-skill-kit` config, so none changes; `pnpm docs:reference` is run to confirm the Reference stays current.
- No change to the `bdk` plugin, its skills or the release flow.
