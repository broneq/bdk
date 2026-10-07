# Spec Delta

## Purpose

Defines how a change to one plugin under `plugins/<name>/` on `main` becomes a versioned release and reaches users as built runtime files on the `release` branch, without touching any other plugin.

## ADDED Requirements

### Requirement: Releases run only from main
The release workflow SHALL run only on pushes to `main`. A push to any other branch, `staging/v3` included, SHALL NOT open a release pull request, create a tag or write the `release` branch.

#### Scenario: Push to staging/v3
- **WHEN** a pull request merges into `staging/v3`
- **THEN** no release workflow run starts and no `<name>--v*` tag is created

### Requirement: One release pull request per changed plugin version
On a push to `main`, release-please SHALL open or update a release pull request for every plugin under `plugins/` with releasable Conventional Commits since its last tag. The release pull request SHALL set `version` in that plugin's `.claude-plugin/plugin.json` to the new version and update that plugin's `CHANGELOG.md`.

#### Scenario: Feature in one plugin
- **WHEN** a `feat:` commit touching only `plugins/<name>/` lands on `main`
- **THEN** a release pull request bumps the minor version in `plugins/<name>/.claude-plugin/plugin.json` and changes no file of another plugin

### Requirement: A merged release pull request tags each released plugin
Merging a release pull request SHALL create, for each released plugin, a GitHub release and the tag `<name>--v<version>`, where `<name>` is the plugin directory name and `<version>` equals `version` in that plugin's `.claude-plugin/plugin.json` at the tag.

#### Scenario: Tag name
- **WHEN** a release pull request that releases plugin `demo` at version `1.2.0` merges into `main`
- **THEN** the tag `demo--v1.2.0` exists and `plugins/demo/.claude-plugin/plugin.json` at that tag holds `"version": "1.2.0"`

### Requirement: Publishing replaces only the released plugin on the release branch
For each plugin released in a run, one after another, the publish job SHALL build the plugin from its tag and replace `plugins/<name>/` on the `release` branch with the plugin's runtime files, in one fast-forward commit. Runtime files are the plugin directory after the build, without `src/`, `tests/`, `evals/`, `node_modules/`, `version.txt` and `tsconfig*.json`. Every other path on `release` SHALL stay byte-identical.

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

### Requirement: Publishing validates the snapshot before pushing
Before it pushes, the publish job SHALL check that the plugin's `name` and `version` in `.claude-plugin/plugin.json` match the tag, run `claude plugin validate --strict` on the snapshot, and run every executable in the snapshot's `bin/` with `--version`, requiring its trimmed standard output to equal the released version. Any failure SHALL fail the job and leave the `release` branch unchanged for that plugin.

#### Scenario: Version mismatch
- **WHEN** the snapshot's `bin/<cli> --version` prints a version other than the tag's version
- **THEN** the publish job fails, names the plugin and the two versions, and pushes nothing for that plugin

#### Scenario: Invalid snapshot
- **WHEN** the snapshot fails `claude plugin validate --strict`
- **THEN** the publish job fails and the `release` branch is unchanged for that plugin

### Requirement: Only the release App writes the release branch
A ruleset SHALL restrict creating, updating, force-pushing and deleting `refs/heads/release`, with the release GitHub App as its only bypass actor. Release-please and the publish job SHALL authenticate as that App.

#### Scenario: Push by a person
- **WHEN** a repository administrator pushes a commit to `release`
- **THEN** GitHub rejects the push

#### Scenario: Push by the publish job
- **WHEN** the publish job pushes a validated snapshot with the App token
- **THEN** GitHub accepts the push
