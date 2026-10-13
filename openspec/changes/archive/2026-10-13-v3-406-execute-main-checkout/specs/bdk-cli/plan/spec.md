## MODIFIED Requirements

### Requirement: Plan check command

`bdk plan check <dir>` SHALL check the plan parts in `<dir>`, a Change's `plan/parts/` directory given relative to the working directory or absolute. It SHALL read only the files directly in `<dir>` and the configuration layers, SHALL write no file, and SHALL NOT call git, GitHub or the network. It SHALL exit 0 when the plan has no problem and 1 when it has at least one, with the same result on stdout in both cases.

The part limits SHALL come from the resolved configuration of the project around the working directory (spec `bdk-cli/config`): `plan.part.max-tasks`, `plan.part.max-files` and `plan.part.max-bytes`. A project that is not configured SHALL be reported as `env/not-configured` with a hint to run `/bdk:setup`, and a configuration with problems as `env/config-invalid` with a hint to run `bdk config check`; both exit 3. A `<dir>` that is not a directory SHALL be reported as `env/plan-missing` naming it, with exit 3.

#### Scenario: Plan without problems

- **WHEN** `bdk plan check openspec/changes/x/plan/parts` runs in a configured project whose parts are within the limits and acyclic
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
- `files`: a non-empty list of strings, each a relative path that has no `..` segment, does not end with `/` and holds no `*` or `?`.

A missing frontmatter, frontmatter that is not a YAML mapping, and every key that breaks these rules SHALL each be a `frontmatter` problem of that part, naming the key. The key `isolation` SHALL also be a `frontmatter` problem, whose message says that parts run one after another in the main checkout and to remove the key: a plan written for parallel worktrees would otherwise pass and mislead its reader. A part with a `frontmatter` problem SHALL still be listed and measured, and SHALL get no wave.

#### Scenario: Unquoted id

- **WHEN** `01.md` has the frontmatter line `id: 01`
- **THEN** the result holds a `frontmatter` problem of part `01` naming `id`, because YAML reads the value as the number 1

#### Scenario: Glob in files

- **WHEN** part `02` lists `src/**/*.ts` in `files`
- **THEN** the result holds a `frontmatter` problem of part `02` naming `files` and that path

#### Scenario: Isolation left from an earlier plan

- **WHEN** `01.md` has the frontmatter line `isolation: worktree`
- **THEN** the result holds a `frontmatter` problem of part `01` naming `isolation` and saying to remove it, and part `01` has no wave

#### Scenario: Stray file

- **WHEN** `<dir>` holds `01.md`, `02-login.md` and `notes.txt`
- **THEN** the result holds one part, `01`, and a `name` problem naming `02-login.md`, and `notes.txt` is ignored

### Requirement: Check output

The text output SHALL be, in this order:

1. A summary line `plan: <n> parts, <w> waves, ok` without problems, or `plan: <n> parts, <w> waves, <p> problems` with them (`part`, `wave`, `problem` in the singular for one).
2. `waves:` followed by one line `  <wave>: <ids separated by spaces>` per wave, or `waves: none` when no part has a wave.
3. `parts:` followed by one line per part: its id, `tasks <n>/<limit>`, `files <n>/<limit>`, `bytes <n>/<limit>`, `wave <wave>` (`-` without one) and `depends-on <ids separated by commas>` (`-` when empty).
4. Only with problems: `problems:` followed by one line per problem: its check, the part ids it names separated by commas (left out when it names none), a colon and its message.

Problems SHALL be ordered by check in the order `no-parts`, `name`, `frontmatter`, `no-tasks`, `max-tasks`, `max-files`, `max-bytes`, `unknown-dependency`, `cycle`, and within a check by their first part id, then their message.

`--json` SHALL print one object: `ok` (true when there is no problem), `limits` (`maxTasks`, `maxFiles`, `maxBytes`), `parts` (each `id`, `dependsOn`, `tasks`, `files`, `bytes`, `wave` or null, in id order), `waves` (each `wave` and its `parts`, in wave order) and `problems` (each `check`, `parts` and `message`, in the order above).

#### Scenario: Text a model reads

- **WHEN** a plan has part `01` without dependencies and part `02` with 6 tasks depending on `01`, under default limits
- **THEN** stdout starts with `plan: 2 parts, 2 waves, 1 problem`, lists `  1: 01` and `  2: 02` under `waves:`, and ends with a `problems:` line that starts with `  max-tasks 02:`

#### Scenario: JSON result

- **WHEN** `bdk plan check <dir> --json` runs on a plan with a cycle
- **THEN** stdout is one JSON object with `ok` false, the `limits`, the `parts`, the `waves` and a `problems` entry with `check` `cycle` and the part ids of the cycle in `parts`, and the exit code is 1

#### Scenario: Stable output

- **WHEN** `bdk plan check <dir>` runs twice on unchanged files
- **THEN** both runs print byte-identical stdout

## REMOVED Requirements

### Requirement: Overlap and shared parts within a wave

**Reason**: Parts run one at a time in the main checkout (spec `bdk-execute`), so two parts of one wave that list the same file never change it in parallel and never merge, and a `shared` part no longer exists.

**Migration**: None: the checks `overlap` and `shared-not-alone` are no longer reported. A part that still holds `isolation` gets a `frontmatter` problem ("Part files").
