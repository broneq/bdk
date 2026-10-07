# repo-sdlc Specification

## Purpose

Defines the development workflow of the BDK repository: how a task runs as an OpenSpec Change, and how CI keeps the living specs valid.

## Requirements

### Requirement: Main specs are validated on every pull request
CI SHALL run `openspec validate --specs --strict` with OpenSpec 1.13.2 on every pull request, and the run SHALL fail when any main spec under `openspec/specs/` fails strict validation.

#### Scenario: Valid main specs
- **WHEN** a pull request leaves every main spec under `openspec/specs/` valid in strict mode
- **THEN** the `openspec` CI job passes

#### Scenario: Invalid main spec
- **WHEN** a pull request adds a requirement without a scenario to a main spec
- **THEN** the `openspec` CI job fails and names the invalid spec

### Requirement: OpenSpec workflow commands are installed
The repository SHALL ship the OpenSpec 1.13.2 workflows `propose`, `explore`, `new`, `continue`, `apply`, `update`, `ff`, `sync`, `archive` and `verify` for Claude Code, as `/opsx:<workflow>` commands and `openspec-*` skills, so that a contributor who opens Claude Code in the repository can run a task as an OpenSpec Change without installing anything into the repository.

#### Scenario: Propose creates a Change
- **WHEN** a contributor runs `/opsx:propose` with a name of the form `v3-<N>-<slug>` in this repository
- **THEN** a Change with that name exists under `openspec/changes/` with its proposal, specs, design and tasks

#### Scenario: Fast-forward and verify are available
- **WHEN** a contributor lists the `/opsx:` commands in Claude Code in this repository
- **THEN** `/opsx:ff` and `/opsx:verify` are among them

### Requirement: Project context and artifact rules apply to every Change
`openspec/config.yaml` SHALL hold the v3 project context and per-artifact rules, so that `openspec instructions` returns them for every artifact of every Change.

#### Scenario: Rules reach the proposal
- **WHEN** a contributor runs `openspec instructions proposal --change <name> --json`
- **THEN** the output carries the project context and the proposal rules, including the `v3-<N>-<slug>` naming rule
