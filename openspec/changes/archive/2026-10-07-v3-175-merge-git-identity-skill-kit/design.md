# Design

## Context

See proposal.md - Why. The layout, the release flow and the migration step are decided in ADR-0002 and in `docs/design/2026-10-07-v3-repo-structure-cicd.md` ("Repository layout", "CLI invocation", "Migration"); this design does not reopen them.

State of the two source repositories on 2026-10-07:

| | `broneq/git-identity` | `broneq/bdk-skill-kit` |
|---|---|---|
| `main` commits | 9 | 28 |
| Tags | `v0.2.0` | `v0.1.0` ... `v0.3.0` (7) |
| Code | one `.mjs` SessionStart hook with JSDoc types, `node --test`, Biome, `tsc --checkJs` | TypeScript in `src/`, esbuild bundles committed in `dist/`, Vitest with coverage, ESLint, Prettier, knip, husky, commitlint |
| Release | release-please `simple`, tags `v<x>` | release-please `node`, tags `v<x>`, bumps `package.json` and `plugin.json` |
| Spec | none (ADR in `docs/decisions/`) | OpenSpec `skill-kit` main spec plus 3 archived changes |

The root toolchain of this repository (#172): pnpm workspace `plugins/*`, ESLint (typed rules on `**/*.ts`), Prettier, `tsc` plus `pnpm -r run typecheck`, one Vitest suite, release-please with `simple`, component tags `<name>--v<version>` and `extra-files` on `.claude-plugin/plugin.json`.

## Goals / Non-Goals

**Goals:**
- Both plugins under `plugins/<name>/` with their history, on the root toolchain, released by the ADR-0002 flow from their current versions.
- No check the old repositories ran is lost without a recorded reason.

**Non-Goals:**
- Changing what either plugin does, or rewriting their skills (a skill rewrite goes through `/skill-creator` and an eval, in its own task).
- A `bin/` wrapper for `skill-check`: the `skill-kit` spec forbids `bin/` and the skill calls `node ${CLAUDE_PLUGIN_ROOT}/dist/skill-check.mjs`; moving the kit to `bin/` is a spec change of its own.
- Running `skill-check` over every plugin in the `plugins` CI job (design "PR CI"): it belongs with the `bdk` plugin's migration, when there are skills other than the kit's own.
- The release-please dry run (#173) and the first real release (#213).
- Trimming the kit's release snapshot: `fixtures/`, `build.ts`, `vitest.setup.ts` and `skill-check.config.ts` sit at the plugin root, outside the publish job's development-only paths, so they ship. They are inert there (checked: the snapshot passes `claude plugin validate --strict` and installs as a git dependency). Moving the fixtures under `tests/` changes the kit's test layout and belongs with a kit change.

## Decisions

### D1. Import with `git filter-repo`, one merge commit per repository

Each repository is cloned fresh, rewritten with `git filter-repo --to-subdirectory-filter plugins/<name>`, and merged into the Change branch with `git merge --allow-unrelated-histories`, as the design's "Migration" section says. Only `main` is imported; feature and release-please branches stay in the archived repositories. The merge commit messages are Conventional Commits (`chore: import ... history`), so the `commitlint` job accepts them.

The same filter-repo run rewrites `(#N)` and `pull request #N` references in commit messages to `broneq/<repo>#N`. Otherwise GitHub links every old `#12` to issue 12 of `broneq/bdk`, which is unrelated. The SHAs change anyway because of the path rewrite, so this costs nothing extra.

- *Alternative: `git subtree add`* - lost: it squashes or keeps root paths in history, so `git log -- plugins/<name>` does not show the original commits without `--follow`.
- *Alternative: copy the files and link the old repository* - lost: the acceptance signal asks for the history in this repository.

The imported commits keep their original messages, some of which (`Initial commit`, merge commits of old PRs) are not Conventional Commits. `commitlint` ignores merge commits by default; whatever else it rejects is fixed in filter-repo's message rewrite to a Conventional form rather than by weakening the commitlint config. This is checked locally before the push (tasks 2.3, 6.x).

The PR must be merged with a merge commit, not squashed or rebased, or the history is lost again. The PR body says so.

### D2. Old tags become `<name>--v<version>` (resolves "To resolve in the spec")

filter-repo's `--tag-rename v:<name>--v` turns `v0.3.0` into `bdk-skill-kit--v0.3.0` on the rewritten commit, and the tags are pushed to `broneq/bdk`.

Why it matters: release-please looks for a plugin's last release first among GitHub releases and then, for components still missing one, among tags named `<component>--v<manifest version>` (`Manifest.backfillReleasesFromTags`, release-please 17). With `.release-please-manifest.json` at `0.3.0` and the tag `bdk-skill-kit--v0.3.0` present, the next release PR bumps from `0.3.0` and its changelog lists only commits after the old release. Without the tag, release-please walks the whole imported history: the old `feat!:` commits would bump the kit again and repeat the old changelog.

- *Alternative: leave the tags behind* - lost for the reason above.
- *Alternative: `last-release-sha` / `bootstrap-sha` in the config* - lost: a SHA that must be removed again after the first release; tags carry the same information permanently and also mark old versions in history.
- *Alternative: create GitHub releases for the old tags too* - not needed: the tag fallback suffices, and the old releases with their notes stay in the archived repositories.

The tags are pushed after the PR branch, so their commits are on the remote. They point at commits on the PR branch, which reach `main` with the merge of `staging/v3`; release-please runs only from `main`.

### D3. Release-please components keep their pre-1.0 bump rules

Both plugins are registered as `plugins/<name>` with `component: <name>`, and the manifest is seeded with `0.2.0` and `0.3.0`. Each package also keeps the pre-major rule it had: `bump-minor-pre-major: true` for both, and `bump-patch-for-minor-pre-major: true` for `bdk-skill-kit`. Without them a `feat!:` in a `0.x` plugin would jump to `1.0.0`, a change of release policy this task does not own. The shared ADR-0002 options stay at the top level and still apply.

The old `extra-files` on `package.json` goes: `plugin.json` is the only version (ADR-0002), so both `package.json` files lose their `version`.

### D4. `git-identity` keeps its `.mjs` hook and JSDoc types

The design's layout says `git-identity/ # .mjs hooks, no build`, and its own rules (ADR `docs/decisions/0001`) forbid a hook import outside `node:` and TypeScript sources without a build. So the hook stays `hooks/session-start.mjs`; only the tooling around it moves:

- **Lint**: the root ESLint config applies its typed rule set to `plugins/*/hooks/**/*.mjs` as well as `**/*.ts`. The plugin's `tsconfig.json` (extending the root one, with `allowJs` and `checkJs`) makes the hook part of a TypeScript project, which the typed rules need.
- **Format**: Prettier (Biome had the same width of 100 and double quotes, so the diff is small).
- **Typecheck**: `tsc -p .` in the plugin's `typecheck` script, which the root `pnpm typecheck` runs with `pnpm -r --if-present run typecheck`.
- **Tests**: `hooks/session-start.test.mjs` (`node --test`, `node:assert`) becomes `tests/session-start.test.ts` (Vitest), one to one, so the root suite runs it.

- *Alternative: port the hook to TypeScript and build it to `dist/`* - lost: contradicts the decided layout and adds a build and a `dist/` dependency to a hook that has none, for no measured problem.
- *Alternative: lint the hook with untyped rules only* - lost: the hook already has full JSDoc types; the typed rules cost nothing extra once its tsconfig exists.

### D5. `bdk-skill-kit` builds instead of committing `dist/`

- `dist/` leaves git (it is in the root `.gitignore`), and the old "committed bundle is the build" CI step goes with it. The release job (`scripts/publish-plugin.ts`) already runs the plugin's `build` script and ships `dist/`.
- `build.mjs` becomes `build.ts`, run with `node build.ts` (type stripping, like `scripts/publish-plugin.ts`), so the root ESLint and `tsc` cover it. Its `tsc` call for declarations finds the workspace root `typescript` on the `PATH` that `pnpm run` sets up, from the test setup and from the publish job alike.
- The CLI reads its version from `../.claude-plugin/plugin.json` at run time (same relative path from `src/` and from `dist/`), instead of `../package.json`. `package.json` keeps `files` for git-dependency consumers and adds `.claude-plugin/plugin.json` to it.
  - *Alternative: esbuild `define` injects the version* (design "CLI invocation") - lost here: the tests run the CLI from source, where no build injects anything, so the source would need a second path. A runtime read keeps one path and still makes `plugin.json` the only version. The design's injection matters for the `bdk` CLI's `bin/` check; the kit has no `bin/`.
- Consumers: a release becomes installable as `github:broneq/bdk#<release-commit>&path:/plugins/bdk-skill-kit`. Existing pins on `github:broneq/bdk-skill-kit#v<x>` keep working, because archiving keeps the repository and its tags readable. The README says both.

### D6. One Vitest suite, with a hook for per-plugin setup and coverage

The root `vitest.config.ts` stays one suite. Two things the kit's own config had move into it:

- `globalSetup` lists every `plugins/*/vitest.setup.ts` found at config time. The kit's setup builds `dist/` once before the tests that run the bundle in child processes; another plugin can add the same file.
- Coverage (`@vitest/coverage-v8`, a root dev dependency) is on for `pnpm test`, measured over `plugins/*/src/**`, with the kit's thresholds (90/90/90/85) as a per-glob threshold on `plugins/bdk-skill-kit/src/**`.
- `testTimeout` 30 s for the whole suite, the kit's old value: its CLI tests spawn processes.

- *Alternative: Vitest `projects`, one config per plugin* - lost: a plugin without its own config would silently drop out of the suite, and the root include patterns already cover every plugin.

### D7. Checks dropped, with reasons

- **Node matrix 22.18 / 24 / 26** (kit CI): PR CI runs one Node version, `.nvmrc` (repo-sdlc; 5-minute budget). `engines` still says `>=22.18.0`.
- **knip** (kit CI): the root toolchain has no unused-code check; adding one for the whole workspace is its own task, not part of moving two plugins.
- **actionlint** (kit CI): the kit's workflows are gone; the root workflows are outside this task.
- **husky / lint-staged** (kit): the root toolchain has no git hooks; CI is the gate.

### D8. The kit's spec and its history move into `openspec/`

`openspec/specs/skill-kit/spec.md` and the three archived changes move from `plugins/bdk-skill-kit/openspec/` into the root `openspec/` (with `git mv`, so their history follows), and the kit's `openspec/config.yaml` and `.claude/` OpenSpec commands are dropped. The project context says every living spec is a main spec under `openspec/specs/`. The spec moves first, unchanged; this Change's `skill-kit` delta then changes Distribution, Release and Kit skill.

`git-identity` has no OpenSpec spec; its ADR stays at `plugins/git-identity/docs/decisions/0001-runtime-and-stack.md` (moving it to `docs/adr/` would clash with ADR-0001 of this repository).

### D9. Marketplace entries

`git-identity` and `bdk-skill-kit` switch to `{"source": "git-subdir", "url": "broneq/bdk", "path": "plugins/<name>", "ref": "release"}` (plugin-marketplaces docs, "Choose a plugin source"). The `release` branch does not exist until the first release from `main` (#213), but `staging/v3` is not what users install: they read the marketplace from `main`, which keeps the old entries until `staging/v3` merges. Each plugin's `repository` field moves to `https://github.com/broneq/bdk`.

A workspace test checks that each `git-subdir` entry on `broneq/bdk` points at a plugin directory whose manifest has the entry's name, since `claude plugin validate` does not open remote sources.

### D10. The plugin's `CLAUDE.md` moves to `plugins/git-identity/.claude/CLAUDE.md`

`claude plugin validate --strict` rejects `plugins/git-identity/CLAUDE.md` ("CLAUDE.md at the plugin root is not loaded as project context"), which fails the `plugins` job. The file is contributor guidance for working on the plugin, and it stays with the plugin as `plugins/git-identity/.claude/CLAUDE.md`: strict validation accepts that path, and Claude Code loads a nested `.claude/CLAUDE.md` when it works on files below it (checked with a codeword in a scratch repository, with a negative control). Its commands are rewritten for the monorepo; its "No TypeScript as source" rule is restated for the new toolchain (D4), and the stack table gets an amendment in the plugin's ADR 0001.

- *Alternative: a path-scoped rule in the root `.claude/rules/`* - lost: the guidance belongs to the plugin and should move with it; the maintainer prefers a `CLAUDE.md` in the plugin.
- *Alternative: keep `CLAUDE.md` at the plugin root* - lost: the `plugins` job and the publish job both validate in strict mode.

### D11. Order of the external steps

1. Import, adapt, run every gate locally.
2. Push the branch, push the rewritten tags (their commits are then on the remote).
3. README commit in each old repository, then `gh repo archive`.
4. Archive the Change, make the Change commit, open the PR.

The external steps come before the Change archive so that the archived tasks are all done. Archiving the old repositories before the PR merges is safe: archived repositories stay readable, so marketplace installs from `main` and existing git pins keep working, and freezing them guarantees nothing lands there that the import misses. Rollback is `gh repo unarchive` and deleting the tags.

## Risks / Trade-offs

- [The PR is squash-merged and the history is lost] → PR body states "merge commit only"; the repository merges PRs with merge commits (#209-#211).
- [An imported commit fails `commitlint`] → checked locally over the full PR range before the push; messages rewritten in filter-repo (D1).
- [The old repositories get a commit after the import] → archiving right after the PR is green; the import is rebuilt from the then-current `main` if anything lands before.
- [Coverage on every `pnpm test` slows the suite] → measured in the gates; the CI budget is 5 minutes.
- [A plugin `vitest.setup.ts` builds during `pnpm test`, before `pnpm build`] → esbuild takes about a second; the build is idempotent.
- [Kit tested on one Node version only] → accepted (D7); the bundle targets `node22.18`.

## Migration Plan

Users: nothing changes until `staging/v3` merges into `main` and the first release writes `plugins/<name>/` to `release`; then `/plugin marketplace update bdk` switches both plugins to the new source under the same names. Rollback before that point: revert the PR, delete the pushed `<name>--v*` tags and unarchive the two repositories.
