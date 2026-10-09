## Context

#275 added `paths` to check items (spec `bdk-cli/check`, "Run the checks"). Setup detects items per package (`references/stacks.md`) but writes none. The skill is the only place that knows the package layout, so the change is skill text plus evals; the CLI already matches and validates `paths`.

## Decisions

### D1: Scope by package directory, plus file type for single-type tools

Test and build items get `<dir>/**`: a package's tests can depend on any file in it. A lint tool that reads one file type (ruff, mypy, eslint on `ts`/`tsx`) gets `<dir>/**/*.<ext>`, because handing it a `README.md` or a JSON file through `{files}` makes `scoped` runs red or noisy. When packages share the root there is no directory, so the file type alone decides (`**/*.py`).

Alternatives: directory only - simple, but a changed `api/README.md` reaches `ruff check`. File type only - cannot tell two packages of one language apart (two TypeScript apps). Both is the only rule that works in all three layouts.

### D2: No `paths` when the command covers the whole repository

`paths` exists to say which part of the repository an item owns. An item that runs everything owns everything; `paths` there only adds a way to skip it wrongly (a changed root config file would match no glob and skip the whole test run). So single-package repositories and one root command across a workspace (`pnpm -r test`) get none.

Alternative: always write `paths: ["**"]` - noise with no effect.

### D3: Rules in the skill reference, not a CLI helper

Per CLAUDE.md, a helper comes only after an eval shows a problem. The rule is a short table in `references/stacks.md`; `setup-multi-package` measures whether the skill follows it.

### D4: Extensions per tool

The tool's extensions come from its tool table row: pytest/ruff/mypy `py`; eslint/prettier/biome/vitest per package `ts,tsx,js,jsx` as the package uses; `go` tools `go`; `cargo` `rs`. Test items take the directory, so extensions matter for lint items only.

## Risks

- A glob too narrow skips a check that should run (a root config change). Mitigation: D2 and the docs sentence that a full run ignores `paths`.
