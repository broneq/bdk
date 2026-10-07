# Spec Delta

## Purpose

Defines `bdk plan check`, the read-only command that checks the plan parts of a Change against the part limits of the configuration, finds `depends-on` cycles, layers the parts into waves and reports overlapping files within a wave and a `shared` part that does not run alone, so `/bdk:plan` and `plan-draft` get these answers without counting by hand.

## ADDED Requirements

### Requirement: Plan check command

`bdk plan check <dir>` SHALL check the plan parts in `<dir>`, a Change's `plan/parts/` directory given relative to the working directory or absolute. It SHALL read only the files directly in `<dir>` and the configuration layers, SHALL write no file, and SHALL NOT call git, GitHub or the network. It SHALL exit 0 when the plan has no problem and 1 when it has at least one, with the same result on stdout in both cases.

The part limits SHALL come from the resolved configuration of the project around the working directory (spec `bdk-cli/config`): `plan.part.max-tasks`, `plan.part.max-files` and `plan.part.max-bytes`. A project that is not configured SHALL be reported as `env/not-configured` with a hint to run `/bdk:setup`, and a configuration with problems as `env/config-invalid` with a hint to run `bdk config check`; both exit 3. A `<dir>` that is not a directory SHALL be reported as `env/plan-missing` naming it, with exit 3.

#### Scenario: Plan without problems

- **WHEN** `bdk plan check openspec/changes/x/plan/parts` runs in a configured project whose parts are within the limits, acyclic and free of overlaps
- **THEN** stdout holds the summary, the waves in order and one line per part, no problem line, and the exit code is 0

#### Scenario: Plan with a problem

- **WHEN** one part of the plan breaks a check
- **THEN** stdout holds the same sections plus the problem, and the exit code is 1

#### Scenario: Nothing written

- **WHEN** `bdk plan check <dir>` runs on any plan
- **THEN** no file under the working directory is created, changed or removed

#### Scenario: Missing directory

- **WHEN** `bdk plan check plan/parts` runs where `plan/parts` does not exist
- **THEN** the CLI reports `env/plan-missing` naming `plan/parts`, and exits 3

#### Scenario: Not configured

- **WHEN** `bdk plan check <dir>` runs in a project without `.bdk/settings.yaml`
- **THEN** the CLI reports `env/not-configured` with a hint naming `/bdk:setup`, and exits 3

### Requirement: Part files

A part SHALL be a file in `<dir>` whose name is two decimal digits followed by `.md`; its id is the file stem. Parts SHALL be checked and listed in the order of their ids. Any other file whose name ends in `.md` SHALL be a `name` problem naming the file; subdirectories and files with another extension SHALL be ignored. A directory without a part SHALL be a `no-parts` problem.

A part SHALL begin with YAML frontmatter between a first line `---` and the next line `---`, a mapping with these keys, other keys ignored (spec `bdk-openspec-schema`, "Plan parts are files with frontmatter"):

- `id`: a string equal to the file stem;
- `depends-on`: a list of strings, the ids of other parts;
- `isolation`: `worktree` or `shared`;
- `files`: a non-empty list of strings, each a relative path that has no `..` segment, does not end with `/` and holds no `*` or `?`.

A missing frontmatter, frontmatter that is not a YAML mapping, and every key that breaks these rules SHALL each be a `frontmatter` problem of that part, naming the key. A part with a `frontmatter` problem SHALL still be listed and measured, and SHALL get no wave.

#### Scenario: Unquoted id

- **WHEN** `01.md` has the frontmatter line `id: 01`
- **THEN** the result holds a `frontmatter` problem of part `01` naming `id`, because YAML reads the value as the number 1

#### Scenario: Glob in files

- **WHEN** part `02` lists `src/**/*.ts` in `files`
- **THEN** the result holds a `frontmatter` problem of part `02` naming `files` and that path

#### Scenario: Stray file

- **WHEN** `<dir>` holds `01.md`, `02-login.md` and `notes.txt`
- **THEN** the result holds one part, `01`, and a `name` problem naming `02-login.md`, and `notes.txt` is ignored

### Requirement: Part limits

For every part the command SHALL measure:

- `tasks`: the numbered list items (a line that starts with digits followed by `.` or `)` and a space) in the section under the heading `## Tasks`, up to the next heading of level one or two, outside fenced code blocks;
- `files`: the number of distinct paths in its `files`;
- `bytes`: the size of the part file in bytes.

A part with more tasks than `plan.part.max-tasks` SHALL be a `max-tasks` problem, more files than `plan.part.max-files` a `max-files` problem, and more bytes than `plan.part.max-bytes` a `max-bytes` problem; a value equal to its limit SHALL pass. A part with no task SHALL be a `no-tasks` problem. Each problem SHALL name the part, the measured value and the setting with its limit.

#### Scenario: Oversized part

- **WHEN** part `03` is 9216 bytes and `plan.part.max-bytes` is 8192
- **THEN** the result holds a `max-bytes` problem of part `03` naming 9216 and `plan.part.max-bytes` 8192, and part `03` is listed with `bytes` 9216

#### Scenario: Limit from the configuration

- **WHEN** `.bdk/settings.yaml` sets `plan.part.max-tasks` to 7 and part `01` has 6 tasks
- **THEN** the result holds no `max-tasks` problem, and the limits shown are 7 tasks, 10 files and 8192 bytes

#### Scenario: Repeated file counted once

- **WHEN** part `01` lists `src/a.ts` twice and nothing else
- **THEN** part `01` is listed with `files` 1

### Requirement: Dependencies and waves

An id in a part's `depends-on` that names no part of `<dir>` SHALL be an `unknown-dependency` problem of that part naming the id. Parts that depend on each other in a cycle, directly or through other parts, a part depending on itself included, SHALL be one `cycle` problem naming every part of the cycle.

Waves SHALL be computed from `depends-on`: a part without dependencies is in wave 1, and any other part is in the wave after the latest wave of the parts it depends on. A part SHALL get no wave when it has a `frontmatter` problem, is part of a cycle, names an unknown id, or depends on a part that has no wave. Waves SHALL be listed in ascending order, each with its part ids in ascending order.

#### Scenario: Waves in order

- **WHEN** part `01` has no dependency, parts `02` and `03` depend on `01`, and part `04` depends on `02` and `03`
- **THEN** the waves are `1: 01`, `2: 02 03`, `3: 04`

#### Scenario: Cycle

- **WHEN** part `02` depends on `03`, part `03` depends on `02`, and part `04` depends on `03`
- **THEN** the result holds one `cycle` problem naming parts `02` and `03`, and parts `02`, `03` and `04` have no wave

#### Scenario: Unknown dependency

- **WHEN** part `02` depends on `09` and no `09.md` exists
- **THEN** the result holds an `unknown-dependency` problem of part `02` naming `09`, and part `02` has no wave

### Requirement: Overlap and shared parts within a wave

A path listed in `files` by two or more parts of the same wave SHALL be an `overlap` problem naming those parts, the wave and the path, one problem per path. A part with `isolation: shared` in a wave with any other part SHALL be a `shared-not-alone` problem naming the `shared` part, the wave and the other parts of that wave.

#### Scenario: Overlapping files

- **WHEN** parts `02` and `03` are both in wave 2 and both list `src/api/routes.ts`
- **THEN** the result holds an `overlap` problem naming parts `02` and `03`, wave 2 and `src/api/routes.ts`

#### Scenario: Same file in different waves

- **WHEN** part `01` in wave 1 and part `02` in wave 2 both list `src/a.ts`
- **THEN** the result holds no `overlap` problem

#### Scenario: Shared part with company

- **WHEN** part `03` has `isolation: shared` and parts `02` and `03` are both in wave 2
- **THEN** the result holds a `shared-not-alone` problem of part `03` naming wave 2 and part `02`

### Requirement: Check output

The text output SHALL be, in this order:

1. A summary line `plan: <n> parts, <w> waves, ok` without problems, or `plan: <n> parts, <w> waves, <p> problems` with them (`part`, `wave`, `problem` in the singular for one).
2. `waves:` followed by one line `  <wave>: <ids separated by spaces>` per wave, or `waves: none` when no part has a wave.
3. `parts:` followed by one line per part: its id, its isolation (`-` when not readable), `tasks <n>/<limit>`, `files <n>/<limit>`, `bytes <n>/<limit>`, `wave <wave>` (`-` without one) and `depends-on <ids separated by commas>` (`-` when empty).
4. Only with problems: `problems:` followed by one line per problem: its check, the part ids it names separated by commas (left out when it names none), a colon and its message.

Problems SHALL be ordered by check in the order `no-parts`, `name`, `frontmatter`, `no-tasks`, `max-tasks`, `max-files`, `max-bytes`, `unknown-dependency`, `cycle`, `overlap`, `shared-not-alone`, and within a check by their first part id, then their message.

`--json` SHALL print one object: `ok` (true when there is no problem), `limits` (`maxTasks`, `maxFiles`, `maxBytes`), `parts` (each `id`, `isolation` or null, `dependsOn`, `tasks`, `files`, `bytes`, `wave` or null, in id order), `waves` (each `wave` and its `parts`, in wave order) and `problems` (each `check`, `parts` and `message`, in the order above).

#### Scenario: Text a model reads

- **WHEN** a plan has part `01` without dependencies and part `02` with 6 tasks depending on `01`, under default limits
- **THEN** stdout starts with `plan: 2 parts, 2 waves, 1 problem`, lists `  1: 01` and `  2: 02` under `waves:`, and ends with a `problems:` line that starts with `  max-tasks 02:`

#### Scenario: JSON result

- **WHEN** `bdk plan check <dir> --json` runs on a plan with a cycle
- **THEN** stdout is one JSON object with `ok` false, the `limits`, the `parts`, the `waves` and a `problems` entry with `check` `cycle` and the part ids of the cycle in `parts`, and the exit code is 1

#### Scenario: Stable output

- **WHEN** `bdk plan check <dir>` runs twice on unchanged files
- **THEN** both runs print byte-identical stdout
