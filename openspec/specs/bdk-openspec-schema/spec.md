# bdk-openspec-schema Specification

## Purpose

Defines the BDK OpenSpec project schema that the `bdk` plugin ships: where it lives and how a project installs it, the Change artifacts it defines in BDK stage order, the plan part format, and its compatibility with the pinned OpenSpec version.

## Requirements

### Requirement: Schema ships in the plugin and installs by copying

The `bdk` plugin SHALL ship an OpenSpec project schema named `bdk` in `plugins/bdk/openspec/schemas/bdk/`: a `schema.yaml` and a `templates/` directory with one template per artifact. The directory SHALL be complete as it is, so that copying it to `openspec/schemas/bdk/` of a project is the whole installation, and it SHALL ship in the released plugin.

#### Scenario: Installed by copying

- **WHEN** `plugins/bdk/openspec/schemas/bdk/` is copied to `openspec/schemas/bdk/` of a project initialised with OpenSpec
- **THEN** `openspec schema which bdk` reports the schema from the project, and `openspec schema validate bdk` reports it valid

#### Scenario: Part of the release

- **WHEN** the release snapshot of `plugins/bdk` is taken
- **THEN** it contains `openspec/schemas/bdk/schema.yaml` and every template the schema names

### Requirement: Artifacts follow the BDK stages

The schema SHALL define exactly four artifacts, in this order: `proposal` generating `proposal.md`, `specs` generating `specs/**/*.md`, `design` generating `design.md`, and `plan` generating `plan/parts/*.md`. `specs` SHALL require `proposal`, `design` SHALL require `specs`, and `plan` SHALL require `specs` and `design`. Every artifact SHALL have a description, a template and an instruction.

#### Scenario: New Change lists its artifacts

- **WHEN** `openspec new change <name> --schema bdk` runs in a project with the schema installed, followed by `openspec status --change <name>`
- **THEN** the Change is created with schema `bdk`, and the status lists `proposal`, `specs`, `design` and `plan` in that order, with `proposal` ready and the other three blocked by their requirements

#### Scenario: Instructions come from the schema

- **WHEN** `openspec instructions plan --change <name> --json` runs on such a Change
- **THEN** the result carries the plan instruction and the part template of the shipped schema

#### Scenario: Complete Change

- **WHEN** a Change has `proposal.md`, at least one spec delta under `specs/`, `design.md` and at least one part `plan/parts/01.md`
- **THEN** `openspec status` reports all four artifacts complete and `openspec validate <name> --strict` passes

### Requirement: Plan parts are files with frontmatter

The `plan` artifact SHALL generate one file per part, `plan/parts/NN.md`, where `NN` is a two-digit number starting at `01`. Each part SHALL begin with YAML frontmatter holding:

- `id`: the part's file stem `NN`, as a quoted string;
- `depends-on`: a list of the ids of other parts of the same Change that must be done before this one, empty when none;
- `isolation`: `worktree` when the part runs in its own git worktree, or `shared` when it runs in the Change checkout;
- `files`: a list of the repository-relative paths of the files the part creates, changes or deletes, each an exact file path, never a glob or a directory.

After the frontmatter, a part SHALL hold its goal, its acceptance scenarios taken from the Change's spec deltas, and its tasks as contracts. The part template and the plan instruction SHALL state this format.

#### Scenario: Template carries the frontmatter

- **WHEN** the part template of the shipped schema is read
- **THEN** it begins with YAML frontmatter that has the keys `id`, `depends-on`, `isolation` and `files`, with `id` a quoted two-digit string and `isolation` one of `worktree` and `shared`

#### Scenario: Plan artifact done with one part

- **WHEN** `plan/parts/01.md` exists in a Change whose other artifacts exist
- **THEN** `openspec status` reports `plan` complete

### Requirement: No apply tracking in the Change

The schema SHALL NOT define `apply.tracks`, and no artifact SHALL be a task checklist. Progress of the work is run state kept outside the Change.

#### Scenario: Archive needs no checklist

- **WHEN** a complete Change of the `bdk` schema is archived
- **THEN** `openspec archive` reports no task status to complete and archives the Change

### Requirement: Archive merges the spec deltas

`openspec archive` of a Change made with the `bdk` schema SHALL merge its spec deltas into `openspec/specs/` the same way as for the stock `spec-driven` schema, and move the whole Change, plan parts included, into the archive.

#### Scenario: Delta merged on archive

- **WHEN** a complete Change whose spec delta adds a requirement to a new capability is archived with `openspec archive <name> --yes`
- **THEN** `openspec/specs/<capability>/spec.md` holds that requirement with its scenarios, and the archived Change directory holds `proposal.md`, `specs/`, `design.md` and `plan/parts/`

### Requirement: Compatible with the pinned OpenSpec version

The schema SHALL work with the OpenSpec version this repository pins (1.13.2, `CLAUDE.md`), and an automated test in `pnpm test` SHALL run that version against the shipped schema: schema validation, a new Change, its status, strict validation of a complete Change, and archive. A change of the pinned version SHALL be made only with that test passing.

#### Scenario: Test runs the pinned CLI

- **WHEN** `pnpm test` runs on a clean checkout after `pnpm install --frozen-lockfile`
- **THEN** the schema test runs the OpenSpec CLI of the pinned version from the workspace dependencies, not from a global installation, and passes
