# Spec Delta

## Purpose

Defines the `bdk` marketplace in `.claude-plugin/marketplace.json`: which plugins it lists, under which names, and where Claude Code installs each one from.

## ADDED Requirements

### Requirement: A plugin of this repository installs from the release branch
A marketplace entry for a plugin that lives in this repository under `plugins/<name>/` SHALL use a `git-subdir` source with `url` `broneq/bdk`, `path` `plugins/<name>` and `ref` `release`, and its entry name SHALL equal `<name>` and the `name` in the plugin's `.claude-plugin/plugin.json`. The entries `git-identity` and `bdk-skill-kit` SHALL follow this rule; their names stay as they were, so an installed user only refreshes the marketplace.

#### Scenario: Entries of the imported plugins
- **WHEN** a contributor reads the `git-identity` and `bdk-skill-kit` entries of `.claude-plugin/marketplace.json`
- **THEN** each has `"source": {"source": "git-subdir", "url": "broneq/bdk", "path": "plugins/<name>", "ref": "release"}` with `<name>` equal to the entry name

#### Scenario: Entry without a plugin directory
- **WHEN** a marketplace entry has a `git-subdir` source on `broneq/bdk` whose `path` has no `.claude-plugin/plugin.json` with the entry's name in this repository
- **THEN** the workspace tests fail and name that entry

#### Scenario: Strict validation
- **WHEN** the `plugins` CI job runs `claude plugin validate --strict` on the marketplace, `plugins/git-identity` and `plugins/bdk-skill-kit`
- **THEN** all three pass
