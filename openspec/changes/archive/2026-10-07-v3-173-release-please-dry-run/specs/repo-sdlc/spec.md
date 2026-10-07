## ADDED Requirements

### Requirement: A plugin's only version file is its manifest
The workspace tests SHALL fail when a directory under `plugins/` holds a `version.txt`. Release type `simple` bumps a `version.txt` that exists, which would give the plugin a second version next to `version` in `.claude-plugin/plugin.json`.

#### Scenario: Plugin with a version.txt
- **WHEN** a pull request adds `plugins/<name>/version.txt`
- **THEN** the `check` job fails at the test step and names `plugins/<name>/version.txt`

#### Scenario: Plugin without a version.txt
- **WHEN** no directory under `plugins/` holds a `version.txt`
- **THEN** the test passes

### Requirement: Plugin manifests keep the layout release-please writes
The workspace tests SHALL fail unless every `plugins/<name>/.claude-plugin/plugin.json` is byte-identical to its parsed content serialized as JSON with two-space indent and one trailing newline, the layout the release-please json updater writes. The formatter check SHALL skip plugin manifests, so a release pull request that bumps `version` changes only that line and passes the `check` job.

#### Scenario: Manifest in another layout
- **WHEN** a pull request adds a `plugin.json` whose layout differs from the serialized form, e.g. `"keywords": ["a", "b"]` on one line
- **THEN** the `check` job fails at the test step and names that `plugin.json`

#### Scenario: Release pull request of a manifest with an array
- **WHEN** release-please bumps `version` in a `plugin.json` in the serialized form that holds an array
- **THEN** the release pull request's diff is the `version` line only and `pnpm format:check` passes
