# Design

## Context

#172 wrote `release-please-config.json` (release type `simple`, `include-component-in-tag`, `tag-separator: "--"`, `separate-pull-requests`, `extra-files` json updater on `.claude-plugin/plugin.json` `$.version`, no packages yet) and `release.yml`, which runs `googleapis/release-please-action@v5` on pushes to `main` only (#172 design D5). `scripts/publish-plugin.ts` leaves `version.txt` out of the snapshot because the design said `simple` might write one.

Facts read before the dry run:

- `release-please-action@v5` (tag `v5`, commit `0dfd8538`) bundles release-please `17.6.0` in `dist/index.js`.
- The `simple` strategy of release-please `17.6.0` builds two updates per component: `CHANGELOG.md` with `createIfMissing: true`, and `version-file` (default `version.txt`) with `createIfMissing: false` and the `DefaultUpdater`, which replaces the whole file with the version.
- `extra-files` paths are relative to the package path, so `.claude-plugin/plugin.json` resolves to `plugins/<name>/.claude-plugin/plugin.json`.

## Goals / Non-Goals

**Goals:**
- See real release-please output for two components before the first real release: the files each release PR changes, the version it writes into `plugin.json`, and the tag names.
- Settle whether `simple` stays (issue #173, "To resolve in the spec").

**Non-Goals:**
- A repeatable dry-run harness or a release-please dev dependency. The dry run is a one-off confirmation; `tests/release-components.test.ts` already pins the configuration it confirms, and #213 checks the first real release end to end.
- Creating real tags or GitHub releases. A dry run creates neither; the tag name is confirmed from the changelog links and release-please's tag-name code.

## Decisions

### D1. Release type `simple` stays

`simple` writes `CHANGELOG.md` and bumps `version.txt` only when the file exists; with no `version.txt` in a plugin, the release PR changes only `CHANGELOG.md` and, through `extra-files`, `plugin.json`. That is exactly the release PR the spec `plugin-release` asks for.

Alternatives:
- `node` - lost: it requires a `package.json` and bumps its `version`; skill-only plugins have none, and plugin packages carry no version (design section "Layout", #172 design D5).
- `simple` with `version-file: .claude-plugin/plugin.json` - lost: the `DefaultUpdater` replaces the whole file with the version string and would destroy the manifest.
- `go`, which writes only `CHANGELOG.md` unless a version file is set - lost: it gives the same result as `simple` today but borrows a language strategy whose updates follow Go releases, so a release-please upgrade could add Go files to BDK release PRs. `simple` is the documented strategy for "a changelog and a version somewhere else".

### D2. Dry run on a throwaway branch of `broneq/bdk`

The release-please CLI (`release-please release-pr --dry-run`) reads the config, the manifest, the commits and the files through the GitHub API of the target branch, and prints the release PRs it would open without opening them. It runs at version `17.6.0`, the one the action bundles, from a scratch directory (`npx release-please@17.6.0`).

The throwaway branch `tmp/v3-173-release-please-dry-run` starts from `staging/v3` and adds:
1. A setup commit (`chore:`): fixture plugins `plugins/demo` (`plugin.json` at `1.0.0`) and `plugins/other` (`0.1.0`), their packages in `release-please-config.json`, the manifest `{"plugins/demo": "1.0.0", "plugins/other": "0.1.0"}`, and `bootstrap-sha` set to this commit's parent, so release-please reads only the branch's own commits instead of the whole v2 history. Release config otherwise byte-identical to `staging/v3`.
2. `feat(demo): ...` touching only `plugins/demo/`.
3. `fix(other): ...` touching only `plugins/other/`.

The branch is deleted after the run. Nothing in `release.yml` or `pr.yml` triggers on a push to it.

Alternatives: a separate throwaway repository - lost, it needs its own creation and deletion, and the real repository is what the action reads; release-please as a library with a mocked GitHub - lost, it skips the API reads (file lookup by path, commit filtering by path) that are part of what is under test.

### D3. A test, not the snapshot, keeps `version.txt` out

D1 holds only while no plugin holds a `version.txt`: `simple` would bump one that exists, giving the plugin a second version. `tests/release-components.test.ts` therefore fails when a plugin directory holds `version.txt` (spec `repo-sdlc`). With that, `version.txt` in the development-only list of `scripts/publish-plugin.ts` can never match, so it goes, together with the `version.txt` of the test fixture.

Alternative: keep the snapshot exclusion as well - lost: it is a second rule for a file that can no longer reach `main`, and it would hide a stale `version.txt` instead of stopping it at the PR.

### D4. Plugin manifests keep the release-please layout; prettier skips them

Found by the dry run: the json updater does not edit the `version` value in place. It parses `plugin.json` and writes it back with `JSON.stringify(data, null, indent)` (release-please `util/json-stringify.js`), keeping only the detected indent. Prettier prints a short array on one line (`["a", "b"]`) where `JSON.stringify` expands it, so the release PR of a manifest with an array fails `pnpm format:check`, and the release PR cannot merge. Measured: `JSON.stringify` output of a manifest with `"keywords": ["a", "b"]` fails `prettier --check` with this repository's config.

Decision: `.prettierignore` skips `plugins/*/.claude-plugin/plugin.json`, as it already skips `.release-please-manifest.json` for the same reason, and `tests/release-components.test.ts` requires each manifest to equal `JSON.stringify(parsed, null, 2) + "\n"`. Then the release PR changes only the `version` line, whatever the manifest holds. Every manifest that will move in already has this layout (`bdk` at `v2.7.0`, `git-identity`, `bdk-skill-kit`).

Alternatives:
- Leave prettier on manifests and keep them array-free - lost: a rule nobody checks until a release PR fails on `main`.
- Format the release PR with prettier in `release.yml` (a step that checks out the release-please branch, runs `prettier --write`, pushes) - lost: a second writer of the release PR branch and a workflow step for what an ignore line and a test settle.
- Only the layout test, no prettier ignore - lost: a manifest with an array cannot satisfy both prettier and the release-please layout.

## Dry run results

Run on 2026-10-07 against `tmp/v3-173-release-please-dry-run`, built as described in D2. The `demo` manifest holds `"keywords": ["fixture", "dry-run"]` to exercise D4; both manifests were written with `JSON.stringify(manifest, null, 2)`. No workflow run started for the branch (`gh run list --branch` empty), and the branch was deleted afterwards.

**1. Release PRs** (`npx release-please@17.6.0 release-pr --dry-run --repo-url broneq/bdk --target-branch tmp/v3-173-release-please-dry-run`):

```
Would open 2 pull requests
title: chore(tmp/v3-173-release-please-dry-run): release demo 1.1.0
branch: release-please--branches--tmp/v3-173-release-please-dry-run--components--demo
## [1.1.0](https://github.com/broneq/bdk/compare/demo--v1.0.0...demo--v1.1.0) (2026-10-07)
### Features
* **demo:** greet twice
updates: 4
  plugins/demo/CHANGELOG.md:  [class Changelog extends DefaultUpdater]
  plugins/demo/version.txt:  [class DefaultUpdater]
  plugins/demo/.claude-plugin/plugin.json:  [class GenericJson]
  .release-please-manifest.json:  [class ReleasePleaseManifest extends DefaultUpdater]
title: chore(tmp/v3-173-release-please-dry-run): release other 0.1.1
branch: release-please--branches--tmp/v3-173-release-please-dry-run--components--other
## [0.1.1](https://github.com/broneq/bdk/compare/other--v0.1.0...other--v0.1.1) (2026-10-07)
### Bug Fixes
* **other:** greet politely
updates: 4
  plugins/other/CHANGELOG.md:  [class Changelog extends DefaultUpdater]
  plugins/other/version.txt:  [class DefaultUpdater]
  plugins/other/.claude-plugin/plugin.json:  [class GenericJson]
  .release-please-manifest.json:  [class ReleasePleaseManifest extends DefaultUpdater]
```

The dry run lists the planned updaters, including `version.txt`, but not whether a file is written. So a read-only script with release-please `17.6.0` built the same release PRs (`Manifest.fromManifest(...).buildPullRequests()`), resolved them into the exact file contents release-please commits (`GitHub.buildChangeSet`, which applies `createIfMissing`), and printed each release's tag with `TagName` and the config's `tag-separator`:

```
=== release demo 1.1.0
files: plugins/demo/CHANGELOG.md, plugins/demo/.claude-plugin/plugin.json, .release-please-manifest.json
tag: demo--v1.1.0
=== release other 0.1.1
files: plugins/other/CHANGELOG.md, plugins/other/.claude-plugin/plugin.json, .release-please-manifest.json
tag: other--v0.1.1
```

`diff` of each manifest before and after its release PR:

```
plugins/demo/.claude-plugin/plugin.json      plugins/other/.claude-plugin/plugin.json
3c3                                          3c3
<   "version": "1.0.0",                      <   "version": "0.1.0",
---                                          ---
>   "version": "1.1.0",                      >   "version": "0.1.1",
```

**2. Publish snapshot.** A local clone of the branch got the dry run's file contents of both release PRs and this Change's `tests/release-components.test.ts`, `.prettierignore` and `scripts/publish-plugin.ts`, then the tags `demo--v1.1.0` and `other--v0.1.1` and a local bare remote. On that tree `vitest run tests/release-components.test.ts` passed (6 tests) and `prettier --check .` passed; `node scripts/publish-plugin.ts demo--v1.1.0 other--v0.1.1` published both (strict validation and manifest checks included). The `release` branch then held:

```
plugins/demo/.claude-plugin/plugin.json   ("version": "1.1.0")
plugins/demo/CHANGELOG.md
plugins/demo/skills/hello/SKILL.md
plugins/other/.claude-plugin/plugin.json  ("version": "0.1.1")
plugins/other/CHANGELOG.md
plugins/other/skills/hello/SKILL.md
```

with the commits `chore(release): demo v1.1.0` and `chore(release): other v0.1.1`, and no `version.txt`.

**3. Found along the way.** The first fixture manifests had no `author`, and `claude plugin validate --strict` in the publish step rejected them ("No author information provided"): the publish gate works, and every plugin needs `author`. The real manifests have it. The `JSON.stringify` rewrite of the manifest led to D4.

**Conclusion:** each component gets its own release PR and tag `<name>--v<version>`; the json updater bumps `$.version` in `plugins/<name>/.claude-plugin/plugin.json`; `simple` writes no `version.txt` when none exists; the snapshot holds no unexpected version file.

## Risks / Trade-offs

- [The action moves to a release-please version with a different `simple`] - the action is pinned to `@v5`, whose bundled version was read for this dry run; the guard test stops the one input (`version.txt`) that would change the outcome, and #213 checks the first real release PR.
- [A throwaway branch on the shared repository] - its name starts with `tmp/`, no workflow runs on it, and it is deleted right after the run.

## Open Questions

None.
