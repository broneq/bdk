# Spec Delta

## Purpose

Defines how a plugin that lived in its own repository joins this repository under `plugins/<name>/`: it keeps its commit history and its version line, and its old repository is retired with a pointer here.

## ADDED Requirements

### Requirement: An imported plugin keeps its history
A plugin imported from its own repository SHALL arrive under `plugins/<name>/` with every commit of that repository's `main` branch, each with its original author, date and message, rewritten only so that its paths sit under `plugins/<name>/` and its pull request references name the old repository. The plugins `git-identity` (from `broneq/git-identity`) and `bdk-skill-kit` (from `broneq/bdk-skill-kit`) SHALL be imported this way.

#### Scenario: History of git-identity
- **WHEN** a contributor runs `git log -- plugins/git-identity` in this repository
- **THEN** the output lists the commits of `broneq/git-identity` `main`, from its first commit, with their original authors and dates

#### Scenario: History of bdk-skill-kit
- **WHEN** a contributor runs `git log -- plugins/bdk-skill-kit` in this repository
- **THEN** the output lists the commits of `broneq/bdk-skill-kit` `main`, from its first commit, with their original authors and dates

#### Scenario: Old pull request reference
- **WHEN** an imported commit message referred to `#12` of its old repository
- **THEN** the imported message reads `broneq/<old-repository>#12`, so it does not link to issue 12 of this repository

### Requirement: An imported plugin continues its version line
Every release tag of an imported plugin's repository SHALL exist in this repository as `<name>--v<version>`, pointing at the imported commit of the original tag. `.release-please-manifest.json` SHALL hold the plugin's last released version, equal to `version` in its `.claude-plugin/plugin.json`, so that its next release follows from that version and its changelog lists only commits after it.

#### Scenario: Last release of bdk-skill-kit
- **WHEN** a contributor lists the tags of this repository
- **THEN** `bdk-skill-kit--v0.1.0` to `bdk-skill-kit--v0.3.0` and `git-identity--v0.2.0` exist, and `bdk-skill-kit--v0.3.0` points at the imported merge commit of the release pull request `broneq/bdk-skill-kit#12`, as `v0.3.0` did

#### Scenario: Manifest matches the plugin
- **WHEN** the workspace tests read `.release-please-manifest.json` and each plugin's `.claude-plugin/plugin.json`
- **THEN** each manifest entry `plugins/<name>` equals that plugin's `version`

### Requirement: The old repository is archived
After a plugin is imported, its old repository SHALL be archived on GitHub, and its README SHALL first be replaced by a notice that the plugin now lives in `broneq/bdk` under `plugins/<name>/`.

#### Scenario: Archived repositories
- **WHEN** a contributor runs `gh repo view broneq/git-identity --json isArchived` and the same for `broneq/bdk-skill-kit`
- **THEN** both report `"isArchived": true`, and each repository's README links to `https://github.com/broneq/bdk/tree/main/plugins/<name>`
