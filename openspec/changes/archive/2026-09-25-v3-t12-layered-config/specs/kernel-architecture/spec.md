# Spec Delta

## MODIFIED Requirements

### Requirement: Slice anatomy

Every slice SHALL have the same directory layout, one directory per layer and one file per command inside each layer, with the layers pointing one way.

One directory per layer, one file per command inside each layer, so `close` sits at the same relative path in every layer of every slice: `commands/close.ts`, `use-cases/close.ts`, `render/close.ts`, `schema/close.ts`, `tests/close.test.ts`.

```
kernel/src/attempt/
  index.ts              public surface: the three command registrations, the slice's config modules and the use cases other slices may call; the only file another slice may import
  config.ts             config modules this slice consumes (root key, zod schema with defaults, consumer = this slice); optional
  commands/             argv -> typed input, one file per command; --help text from the index record
    parse.ts            the slice's positional grammar (`kernel-cli`, Invocation) and flag parsing, shared by the three commands
    open.ts
    close.ts
    list.ts
  use-cases/            one file per command; domain logic, no argv, no stdout
    open.ts             budgets, ladder, oscillation, ticket file
    close.ts            outcome, diff check (part), evidence freshness (evidence), entries check, findings (log), next action
    list.ts             read model over store queries
  domain/               slice-owned types and pure rules, no IO
    ticket.ts           ticket record, outcome, fingerprint
    budget.ts           not-run and retry budgets
    ladder.ts           escalation ladder and the oscillation detector (A-drabina)
  store/                this slice's persistence on .bdk/changes/<id>/attempts/ and its index tables, built on shared/store primitives
    attempts.ts         writes: ticket record, outcome, fingerprints, next action
    queries.ts          typed reads this slice owns (open tickets of a task, budgets)
  render/               text rendering, one file per command; JSON is the schema's object
    open.ts
    close.ts
    list.ts
  schema/               zod schemas of the outputs, one file per command; `pnpm build` generates schema/cli/output/attempt-*.json from them
    open.ts
    close.ts
    list.ts
  tests/
    open.test.ts        unit tests of the use case on an in-memory store
    close.test.ts
    list.test.ts
    attempt.e2e.ts      E2E through bdk.mjs on a repository fixture, one case per exit code the index declares
```

Inside a slice the layers point one way: `commands/` imports `use-cases/`, `render/` and `schema/`; `use-cases/` imports `domain/`, `store/`, `schema/` and the `index.ts` of the slices in its matrix row; `store/` imports `domain/` and `shared/store`; `render/` and `schema/` import `domain/` only; `domain/` imports nothing but types from `shared/ids` and `shared/clock`. The import scan below enforces the direction.

`config.ts` imports only `shared/config` and zod; `use-cases/` reads settings only through the modules of its own `config.ts`, which the composition root registers (`kernel-settings`, Registry and consumers). Every slice has the same directories with the same responsibilities, so a reader who knows one slice knows all of them. A slice with one command (`commit`, `query`, `measure`) keeps the directories with one file in each; a slice without pure rules omits `domain/`. `graph/domain/kinds/` holds one class per artifact kind, `hooks/domain/` the payload parsers per host event, `dispatch/use-cases/run.ts` is the headless runner.

#### Scenario: layer direction inside a slice

- **WHEN** `commands/` imports `store/`, `render/` imports `use-cases/`, or `domain/` imports anything but types from `shared/ids` and `shared/clock`
- **THEN** the import scan fails the build

#### Scenario: config module outside its consumer

- **WHEN** a config module is declared anywhere but the `config.ts` of the slice it names as consumer, or in `shared/config` for the modules `shared/config` consumes
- **THEN** the S6 structural test fails the build

### Requirement: shared/ admission rule

Something SHALL enter `shared/` only as an OS boundary or when three or more slices use it, and the `node:` modules SHALL appear only in the files the inventory names.

Something enters `shared/` for one of two reasons and each entry states which: **(a)** it is an OS boundary (file system, child process, clock, terminal), or **(b)** three or more slices use it. Anything else lives in the slice that needs it, even if a second slice later copies three lines.

| Module            | Admitted by                                 | Holds                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/store`    | (a) file system; (b) every slice            | The single access point of R-store: Change directory IO, frontmatter, the SQLite index (`node:sqlite`), lazy rebuild, typed read queries whose shapes are T14's.                                                                                                  |
| `shared/git`      | (a) child process                           | Wrapper over `git` (`node:child_process`): diff, trailers, pathspec commit, work tree state; the `runtime/git-missing` and `policy/git-in-progress` checks.                                                                                                       |
| `shared/config`   | (a) file system, user home; (b) every slice | The four layers and the global layer path, deep merge, the zod module registry and its JSON Schema export, prompt values, the resolved snapshot, comment-preserving edits of a layer file.                                                                        |
| `shared/ids`      | (b) `change`, `log`, `attempt`, `evidence`  | Merge-safe id generation and parsing of qualified references (T14 format).                                                                                                                                                                                        |
| `shared/clock`    | (a) system clock                            | The one source of `at`; injectable in tests.                                                                                                                                                                                                                      |
| `shared/refusal`  | (b) every slice                             | The four-field error object, the rule id catalogue as a typed enum, the class-to-exit mapping (`kernel-cli`, Exit codes and the error object).                                                                                                                    |
| `shared/output`   | (b) every slice                             | Text and JSON writers, list pages and the 100-item cap, the STOP block renderer (`kernel-cli`, Output modes).                                                                                                                                                     |
| `shared/registry` | (b) every slice                             | Command registration from `schema/cli/commands.json`, dispatch by argv, `--help`, mode handling (inject always exits 0, guard fail-closed), the active-Change resolution for `changeScoped` records, the `kernel/not-implemented` stub for unregistered handlers. |

A content test allows `node:fs` only in `shared/store`, `shared/config` and `shared/git`, `node:child_process` only in `shared/git` and the `dispatch` runner (`dispatch/use-cases/run.ts`, which spawns host CLIs and is the documented exception), and `node:sqlite` only in `shared/store`. `shared/` never imports a slice; the composition root (`kernel/src/main.ts`) wires the slices into the registry.

#### Scenario: node module outside its boundary

- **WHEN** `node:fs` appears outside `shared/store`, `shared/config` and `shared/git`, `node:child_process` outside `shared/git` and `dispatch/use-cases/run.ts`, or `node:sqlite` outside `shared/store`
- **THEN** the `node:` boundary test fails the build

### Requirement: Change recipes

A new command, a new artifact kind and a new host hook SHALL each touch the files the recipes name and nothing outside them.

**A new command** touches one slice and the contract: add the record to `schema/cli/commands.json` and its requirement to the group's spec under `kernel-cli/<group>/` (the contract test enforces the pair), add `<slice>/commands/<command>.ts`, `<slice>/use-cases/<command>.ts`, `<slice>/schema/<command>.ts`, `<slice>/render/<command>.ts`, `<slice>/tests/<command>.test.ts` with one unit test per rule the record declares, and one E2E case per exit code, plus one line in `kernel/scripts/export-schemas.ts` naming the output schema file, so `pnpm build` generates it (design decision D-10 of `v3-t12-layered-config`). Nothing else outside the slice changes; the registry reads the index.

**A new artifact kind** touches `graph` and configuration only: a node in `pipeline.yaml` with its `requires` and `if:` conditions, a kind class in `graph/domain/kinds/` with `validate()` and `instruction()`, the kind's template under `prompts/`. `next`, `explain`, `validate` and `done` need no change, and no other slice learns about the kind (the promise of approach A, kept at slice level).

**A new host hook** touches `hooks` only: a payload parser in `hooks/domain/`, a use case with the decision, and a fixture under `tests/fixtures/host-payloads/<version>/` recorded with the T01 probe.

#### Scenario: new command

- **WHEN** a Change adds a command
- **THEN** it adds the index record, the group spec requirement, one file per layer in the slice, one unit test per declared rule, one E2E case per exit code and its line in the schema generator, and no other file outside the slice and the contract changes

### Requirement: Tests per slice

Each slice SHALL carry unit tests of its use cases on an in-memory store and E2E tests enumerated from the index; CI SHALL run the suite on the Node matrix.

Each slice carries unit tests of its use cases on an in-memory `shared/store` (no file system, no git) and E2E tests through `dist/bdk.mjs` on a repository fixture. E2E cases are enumerated from the index: for every record with a handler, one case per value in `exits` and one per rule in `refusals`, asserting the exit code and, on `--json`, the schema; for every stubbed record, one case asserting the `kernel/not-implemented` answer of its mode (exit 2 with the error object in command mode, exit 0 with a STOP block in inject mode, exit 2 with the reason on stderr in guard mode) and one asserting its `--help`. A stub gains the full enumeration when its owner task registers the handler. Unit tests are TypeScript run by Vitest from source, with coverage thresholds that fail the build below 90% of lines, functions and statements and 85% of branches of `kernel/src/` (tests and `main.ts` excluded); E2E tests run the committed bundle, never the source. CI runs the whole suite on a Node matrix of three lines: the minimum the contract names (22.13, HOST-FACTS `node-sqlite-min`), the active LTS and the current release (24 and 26 at the time of writing), because `node:sqlite` and the test runner differ between lines and a kernel that only ever ran on one of them would learn about the others from users. The runtime floor (`runtime/node-version` on a Node below the minimum) is covered by unit tests of the registry with an injected Node version, because no supported line is below the minimum. Three suites run over the whole tree besides the slices' own tests. The **contract tests** (formerly `tests/contract/`, T10) keep `openspec/specs/kernel-cli/` and `schema/cli/` consistent, assert that every record has a handler or the stub and that `--help` equals the record, and validate every `examples` entry of `schema/cli/output/` and `schema/cli/common/` against its schema. A JSON Schema file under `schema/` is either generated from a zod schema by `pnpm build` (the settings, and every CLI output whose slice has its zod schema) or hand-written until its owner slice adds the zod schema; a generated file is kept equal to its zod source by `git diff --exit-code schema/` on CI, a hand-written one by the contract test that parses its examples with the zod schema when one exists. Three structural tests:

1. **Import scan.** Parses every `import` in `kernel/src/`: a slice may import `shared/*` and the `index.ts` of the slices in its matrix row, nothing else (no deep imports, no reverse edges, no slice import from `shared/`); inside a slice, only the layer direction of the anatomy above (`commands/` never reaches `store/`, `render/` never reaches `use-cases/`, `domain/` reaches nothing). The matrix is read from this spec's table, so the document and the code cannot drift apart silently.
2. **`node:` boundary.** `node:fs`, `node:child_process` and `node:sqlite` appear only in the files the inventory above names.
3. **Config consumers (S6).** Every config module in the registry names a consumer slice from the module list, is declared in that slice's `config.ts` (or in `shared/config` for its own modules), and, when the consumer slice has a registered command handler, is read by a file of that slice.

#### Scenario: runtime floor in unit tests

- **WHEN** the registry unit tests run a record other than `version` and `doctor` with an injected Node version of 22.12.0
- **THEN** the answer is exit 5 with `rule: runtime/node-version` and an install line in `instead`, and `doctor` with the same version answers exit 0 with the `node-version` finding

#### Scenario: E2E enumeration

- **WHEN** a record in the index gains an exit code or a rule
- **THEN** the E2E harness has one new case for it, asserting the exit code and, under `--json`, the schema

#### Scenario: Node matrix

- **WHEN** the CI workflow runs the kernel suite
- **THEN** it runs on the contract's minimum (22.13), the active LTS and the current release, with the same steps on every line

#### Scenario: stubbed record in the E2E harness

- **WHEN** the E2E harness runs a record whose owner task has not landed
- **THEN** it asserts the `kernel/not-implemented` answer of the record's mode with an `instead` naming the owner task, and the `--help` text of the record

#### Scenario: schema example drifts

- **WHEN** an `examples` entry in `schema/cli/output/` or `schema/cli/common/` does not validate against its own schema
- **THEN** the contract tests fail

#### Scenario: generated schema drifts

- **WHEN** a commit changes a zod schema that `pnpm build` exports without the regenerated file under `schema/`
- **THEN** CI rebuilds and `git diff --exit-code schema/` fails the build

### Requirement: CI pipeline

CI SHALL run, on every push to `main` and every pull request, the kernel steps in this order and fail on the first failing one: frozen install, build, `git diff --exit-code dist/ schema/`, lint, format check over the repository, typecheck, unused code and dependency check, unit tests with coverage thresholds, E2E tests, contract and structural tests.

The kernel job runs every step on each line of the Node matrix of `Tests per slice`. A skill content step runs `skill-check` with the BDK rule plugin over the `skills/` directories of the plugins (T15); until T15 lands it is a stub that passes and says so in its output. On pull requests CI also checks that every commit message follows Conventional Commits, which release-please parses, and lints the workflow files. The same format, lint and commit message checks run as local git hooks on staged files, but CI never relies on them. The CI jobs of the existing Python suite and the release workflow are unaffected.

#### Scenario: coverage below the threshold

- **WHEN** a change lowers unit test coverage of `kernel/src/` below a threshold
- **THEN** the unit step fails the build

#### Scenario: non-conventional commit

- **WHEN** a pull request contains a commit whose message is not a Conventional Commit
- **THEN** the commit message check fails the build

#### Scenario: acceptance run

- **WHEN** a pull request into `staging/v3` or `main` changes the kernel
- **THEN** CI runs build, `git diff --exit-code dist/ schema/`, lint, format check, typecheck, unused code check, unit with coverage, E2E and contract steps on Node 22.13, 24 and 26, the audit, the commit message check, the workflow lint and the skill content step, and the workflow run fails when any of them fails
