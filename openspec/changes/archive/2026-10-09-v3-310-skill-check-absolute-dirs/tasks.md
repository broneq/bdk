# Tasks

## 1. Reproduce

- [x] 1.1 Build the kit and run `dist/skill-check.mjs --config <scratch config outside the project>` with an absolute `dirs` entry; confirm the `ENOENT` stack trace

## 2. Tests first

- [x] 2.1 Add a `discover` test: a config in one temp directory, a skills tree in another, `dirs` holding its absolute path; it finds the skill (fails before the fix)
- [x] 2.2 Add a `main` test: `--config` outside the project with an absolute skills dir prints the findings of that skill and exits 1, nothing on stderr (fails before the fix)

## 3. Fix

- [x] 3.1 Export `targetDir(root, dir)` from `src/config.ts` and validate target directories with it
- [x] 3.2 Scan `targetDir(root, dir)` in `src/discover.ts`, for the base and the container set
- [x] 3.3 Re-run the reproduction from 1.1: findings printed, no stack trace

## 4. Docs

- [x] 4.1 `plugins/bdk-skill-kit/README.md`: say a `dirs` entry is relative to the config file or absolute
- [x] 4.2 Run `pnpm docs:reference` and confirm `docs/reference/` is unchanged or regenerated

## 5. Gates

- [x] 5.1 `pnpm check`, every other check in `.github/workflows/`, and `openspec validate --specs --strict`
