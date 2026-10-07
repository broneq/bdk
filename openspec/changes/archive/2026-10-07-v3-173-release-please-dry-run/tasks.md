# Tasks

## 1. Dry run

- [x] 1.1 Push the throwaway branch `tmp/v3-173-release-please-dry-run` from `staging/v3` with the setup commit, `feat(demo):` and `fix(other):` commits of design D2; verify no workflow run starts for it
- [x] 1.2 Run `npx release-please@17.6.0 release-pr --dry-run` against the branch; verify two release PRs, `demo` at `1.1.0` and `other` at `0.1.1`, each changing only its `plugin.json` `version` and `CHANGELOG.md`, no `version.txt`, and changelog links `demo--v1.0.0...demo--v1.1.0`, `other--v0.1.0...other--v0.1.1`
- [x] 1.3 Print the tag names with release-please `17.6.0`'s `TagName` for both components and the config's separator; verify `demo--v1.1.0` and `other--v0.1.1`
- [x] 1.4 Snapshot check: apply the dry run's `plugin.json` and `CHANGELOG.md` contents to a local copy of the fixture, tag it, run `scripts/publish-plugin.ts` against a local bare remote; verify the `release` snapshot holds the bumped `plugin.json` and no `version.txt`
- [x] 1.5 Record commands and output in `design.md` "Dry run results"; delete the throwaway branch

## 2. Guard against version.txt

- [x] 2.1 Write the failing test in `tests/release-components.test.ts`: a plugin directory holding `version.txt` fails and names the path; verify it fails with a scratch `plugins/x/version.txt` and passes without it
- [x] 2.2 Remove `version.txt` from the development-only list of `scripts/publish-plugin.ts` and from the fixture and assertions of `scripts/publish-plugin.test.ts`; verify `pnpm test` passes
- [x] 2.3 Write the failing test in `tests/release-components.test.ts`: a `plugin.json` not equal to `JSON.stringify(parsed, null, 2) + "\n"` fails and names the file (design D4); verify it fails with a scratch manifest holding `"keywords": ["a", "b"]` on one line and passes with the serialized form
- [x] 2.4 Add `plugins/*/.claude-plugin/plugin.json` to `.prettierignore`; verify `pnpm format:check` passes with a scratch manifest in the serialized form holding an array, and fails without the ignore line

## 3. Documents

- [x] 3.1 Mark the open question "Exact release-please config, confirmed by a dry run" in `docs/design/2026-10-07-v3-repo-structure-cicd.md` and the matching implementation requirement in ADR-0002 as done, naming this Change; drop `version.txt` from the design's snapshot list

## 4. Acceptance and gates

- [x] 4.1 Acceptance signal: the recorded dry run shows, for each component, the expected tag, the bumped `plugin.json` and no `version.txt` in the snapshot
- [x] 4.2 Run every check CI runs (`pnpm check`, marketplace and plugin validation, commitlint over the branch, docs build, `actionlint`), `openspec validate v3-173-release-please-dry-run --strict` and `openspec validate --specs --strict`
