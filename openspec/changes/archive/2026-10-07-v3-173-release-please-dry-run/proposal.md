# Proposal

## Why

Tracks #173.

ADR-0002 releases each plugin through release-please in manifest mode, with release type `simple` and an `extra-files` json updater on `.claude-plugin/plugin.json` (design `docs/design/2026-10-07-v3-repo-structure-cicd.md`, section "Releases (`release.yml`)"). #172 wrote that configuration but could not run it: no plugin exists yet, and releases run only from `main`. Two points of that design are still open (its "Open Questions"): whether the `extra-files` updater really bumps `$.version` in `plugin.json`, and whether `simple` writes a `version.txt` next to it. A wrong answer surfaces only at the first real release, as a release PR that does not bump the version users are pinned to, or as a second version file shipped to users.

## What Changes

- A dry run of release-please, at the version that `googleapis/release-please-action@v5` bundles, against a throwaway branch of `broneq/bdk` holding the release configuration of #172 and two fixture plugins, `demo` and `other`, with one releasable commit each. The output and the commands are recorded in this Change's `design.md`.
- The tag of each component is checked twice: in the changelog compare links of the dry run and with release-please's own tag-name code.
- Resolved from "To resolve in the spec": release type `simple` stays. It updates `version.txt` only when that file already exists and never creates it, so a plugin's release PR touches only its `plugin.json` and `CHANGELOG.md`.
- Because `simple` would bump a `version.txt` that exists, and `plugin.json` must be the only version of a plugin, the workspace test now fails when a plugin directory holds a `version.txt`.
- `version.txt` leaves the development-only list of `scripts/publish-plugin.ts` and its fixture: no plugin can hold one any more, so the exclusion has nothing left to exclude.
- Found by the dry run: the `extra-files` json updater rewrites the whole `plugin.json` with `JSON.stringify` at the file's indent, and prettier formats a short array differently, so the release PR of a manifest with an array (e.g. `keywords`) would fail `pnpm format:check` in the required `check` job. Plugin manifests leave prettier (like `.release-please-manifest.json` already does), and a workspace test requires each `plugin.json` to be in the layout release-please writes, so a release PR changes only the `version` line.
- The open question in the design document and the implementation requirement in ADR-0002 are marked done, pointing at this Change.

### Out of scope

- The first real release on `main` and its end-to-end check: #213.
- Moving plugins into `plugins/` and adding their release-please packages: #175 (`git-identity`, `bdk-skill-kit`), #178 (`bdk`).
- A `version` field in a plugin's `package.json`: `simple` does not touch it either; the design section "Layout" already says plugin packages carry no version, and the plugins that bring a `package.json` arrive with #175 and #178.
- Docs site deploy: #212.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-release`: a release pull request changes only the released plugin's `plugin.json` version and `CHANGELOG.md`; each plugin gets its own release pull request and tag; the snapshot's development-only list no longer names `version.txt`.
- `repo-sdlc`: a workspace check rejects a `version.txt` in a plugin directory and a `plugin.json` not in the layout release-please writes; prettier no longer checks plugin manifests.

## Impact

- Changed: `tests/release-components.test.ts`, `.prettierignore`, `scripts/publish-plugin.ts`, `scripts/publish-plugin.test.ts`, `docs/design/2026-10-07-v3-repo-structure-cicd.md` (open question), `docs/adr/0002-v3-repo-structure-and-release.md` (implementation requirement).
- Unchanged: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`.
- GitHub: one throwaway branch on `broneq/bdk`, deleted after the dry run. A dry run opens no pull request and creates no tag or release.
