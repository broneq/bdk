# bdk-cli/openspec Specification

## Purpose

Defines the `bdk openspec` command group: `bdk openspec install`, which copies the BDK OpenSpec schema the `bdk` plugin ships into a project, so `/bdk:setup` installs it without a shell copy that the host stops for approval.

## Requirements

### Requirement: Install the BDK schema

`bdk openspec install` SHALL take no argument and SHALL copy every file under `openspec/schemas/bdk/` of the plugin directory (the parent of the directory holding the CLI bundle) to the same relative path under `openspec/schemas/bdk/` of the working directory, creating directories as needed. A file whose content already equals the shipped one SHALL NOT be written. It SHALL change no other file. It SHALL print one line counting the files added, updated and unchanged, then one line per file with its status, in path order; under `--json` the result SHALL hold `schema` (`bdk`), `target` (`openspec/schemas/bdk`) and `files`, each with its `path` relative to the schema directory and its `status` (`added`, `updated`, `unchanged`). It SHALL exit 0 after a copy.

#### Scenario: First install

- **WHEN** `bdk openspec install` runs in a project without `openspec/schemas/bdk/`
- **THEN** that directory holds every file of the plugin's schema with the same content, each reported `added`, and the exit code is 0

#### Scenario: Update

- **WHEN** the project's `openspec/schemas/bdk/schema.yaml` differs from the shipped one and the other files are equal
- **THEN** `schema.yaml` is overwritten and reported `updated`, every other file is reported `unchanged`, and `openspec/config.yaml` is untouched

#### Scenario: Same result twice

- **WHEN** `bdk openspec install` runs twice on the same project
- **THEN** the second run reports every file `unchanged` and writes nothing

#### Scenario: Schema missing from the plugin

- **WHEN** the plugin directory holds no `openspec/schemas/bdk/schema.yaml`
- **THEN** the CLI reports `env/schema-missing` naming the missing path with the hint to reinstall the plugin, writes nothing, and exits 3
