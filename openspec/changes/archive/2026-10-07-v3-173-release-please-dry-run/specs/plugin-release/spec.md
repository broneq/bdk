## MODIFIED Requirements

### Requirement: One release pull request per changed plugin version
On a push to `main`, release-please SHALL open or update a release pull request for every plugin under `plugins/` with releasable Conventional Commits since its last tag. The release pull request SHALL set `version` in that plugin's `.claude-plugin/plugin.json` to the new version and update that plugin's `CHANGELOG.md`. Besides those two files it SHALL change only the plugin's entry in `.release-please-manifest.json`: it creates no `version.txt` or any other version file, and it touches no file of another plugin.

#### Scenario: Feature in one plugin
- **WHEN** a `feat:` commit touching only `plugins/<name>/` lands on `main`
- **THEN** a release pull request bumps the minor version in `plugins/<name>/.claude-plugin/plugin.json` and changes no file of another plugin

#### Scenario: Release pull request files
- **WHEN** release-please builds the release pull request of plugin `demo`
- **THEN** the pull request changes exactly `plugins/demo/.claude-plugin/plugin.json` (only its `version` value), `plugins/demo/CHANGELOG.md` and the `plugins/demo` entry of `.release-please-manifest.json`, and creates no `plugins/demo/version.txt`

#### Scenario: Changes in two plugins
- **WHEN** a `feat:` commit touches only `plugins/demo/` and a `fix:` commit touches only `plugins/other/`, at versions `1.0.0` and `0.1.0`
- **THEN** release-please builds two release pull requests, one setting `demo` to `1.1.0` and one setting `other` to `0.1.1`, each changing files of its own plugin only

### Requirement: A merged release pull request tags each released plugin
Merging a release pull request SHALL create, for each released plugin, a GitHub release and the tag `<name>--v<version>`, where `<name>` is the plugin directory name and `<version>` equals `version` in that plugin's `.claude-plugin/plugin.json` at the tag.

#### Scenario: Tag name
- **WHEN** a release pull request that releases plugin `demo` at version `1.2.0` merges into `main`
- **THEN** the tag `demo--v1.2.0` exists and `plugins/demo/.claude-plugin/plugin.json` at that tag holds `"version": "1.2.0"`

#### Scenario: Tag of each component
- **WHEN** release-please builds release pull requests for `demo` at `1.1.0` and `other` at `0.1.1`
- **THEN** their changelog entries compare `demo--v1.0.0...demo--v1.1.0` and `other--v0.1.0...other--v0.1.1`, and no tag uses another separator or omits the component

### Requirement: Publishing replaces only the released plugin on the release branch
For each plugin released in a run, one after another, the publish job SHALL build the plugin from its tag and replace `plugins/<name>/` on the `release` branch with the plugin's runtime files, in one fast-forward commit. Runtime files are the plugin directory after the build, without `src/`, `tests/`, `evals/`, `node_modules/` and `tsconfig*.json`. Every other path on `release` SHALL stay byte-identical.

#### Scenario: Other plugins unchanged
- **WHEN** plugin `demo` is published while `release` already holds `plugins/other/`
- **THEN** the new `release` commit changes only paths under `plugins/demo/` and its parent is the previous head of `release`

#### Scenario: Snapshot holds runtime files only
- **WHEN** plugin `demo` has `src/`, `tests/`, `evals/` and a build that writes `dist/`
- **THEN** `plugins/demo/` on `release` holds `dist/` and the plugin's manifest, skills, agents, hooks and `bin/`, and holds no `src/`, `tests/` or `evals/`

#### Scenario: Removed file disappears
- **WHEN** a file that the previous release of `demo` shipped is gone from `demo`'s new tag
- **THEN** that file is gone from `plugins/demo/` on `release`

#### Scenario: First release creates the branch
- **WHEN** a plugin is published and the `release` branch does not exist
- **THEN** the publish job creates `release` as a branch with no history from `main`, holding only `plugins/<name>/`

#### Scenario: Several plugins in one run
- **WHEN** one run releases plugins `demo` and `other`
- **THEN** the publish job publishes them one after another, each in its own commit on `release`, and a second run waits for the first instead of cancelling it

#### Scenario: No version file besides the manifest
- **WHEN** plugin `demo` is published after a release pull request built by release-please
- **THEN** `plugins/demo/` on `release` holds the version only in `.claude-plugin/plugin.json` and holds no `version.txt`
