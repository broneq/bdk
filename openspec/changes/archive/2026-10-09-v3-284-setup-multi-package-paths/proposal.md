# Proposal

## Why

Tracks #284.

#275 gave each `tools.test`, `tools.lint` and `tools.build` item an optional `paths`, so `bdk check run --scope` hands an item only the files it owns and skips an item that owns none. `/bdk:setup` still detects items per package without writing `paths`: in a repository with a Python API and a React frontend every scoped variant gets every changed file, and the user must edit the settings by hand to get what #275 built.

## What Changes

- `/bdk:setup` writes `paths` on a check item whose command covers only a part of the repository, and leaves `paths` out when the item covers the whole repository (a single-package repository, or one root command that runs every package).
- Decision of "To resolve in the spec": scope by package directory and, where a tool reads one file type only, by file type as well. A test or build item of a package in its own directory gets `<dir>/**`. A lint item whose tool reads one file type gets `<dir>/**/<ext>` (`api/**/*.py`). When the packages share the repository root (two languages side by side, no package directory), an item gets the file type of its tool (`**/*.py`).
- `references/stacks.md` of the skill gets a section "Paths in a repository of several packages" with these rules and the globs per tool.
- A new eval case `setup-multi-package` on a fixture with `api/` (uv, pytest, ruff) and `web/` (pnpm, vitest, eslint); the existing single-package cases grade that no `paths` is written.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-setup`: new requirement "Paths for check items in a repository of several packages"; "Eval cases" gains `setup-multi-package` and the no-`paths` grading of the single-package cases.

## Impact

- Skill: `plugins/bdk/skills/setup/` (`SKILL.md` step 2 and 4, `references/stacks.md`). No CLI change: `paths` and its checks exist since #275.
- Evals: `plugins/bdk/evals/setup-multi-package/` (new), a `paths` grader on `setup-web-app`; `plugins/bdk/evals/README.md` lists the case.
- User docs: `docs/guide/configuration.md` (the monorepo example says `/bdk:setup` writes the `paths`); `docs/guide/first-run.md` if it describes what setup detects. The Reference is regenerated with `pnpm docs:reference` (skill description may change).
- Out of scope: detecting `paths` for `tools.e2e` items (they have no `paths`).
