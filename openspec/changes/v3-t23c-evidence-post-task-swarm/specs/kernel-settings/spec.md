# kernel-settings delta

## MODIFIED Requirements

### Requirement: Merge

The kernel SHALL merge the layers key by key: mappings deep-merge, arrays whose items are mappings with an `id` merge item by item on `id`, an array its module declares append-only merges by appending, every other array and every scalar is replaced whole by the higher layer.

An item of an `id` array that a higher layer adds is appended in that layer's order; an item it names by an existing `id` is deep-merged into the lower item. Two items with the same `id` in one layer answer `policy/config-invalid`. `null` is a value like any other: it fails a key that is not nullable and never deletes a lower layer's key. An append-only array (the glob lists of `policy.evidence`, user choice T23-D48) starts from its default; each layer appends the items the lower layers and the default do not hold, in its own order, so a project extends the list and never removes a default item. A higher layer may set any other declared key, including one that disables a policy (full override, D4).

#### Scenario: array merged by id

- **WHEN** the project layer declares `tools.test` items `unit` and `e2e`, and the local layer declares `tools.test` item `unit` with only `scoped`
- **THEN** the resolved `tools.test` holds `unit` with the project fields plus the local `scoped`, followed by `e2e` unchanged

#### Scenario: scalar array replaced

- **WHEN** the project layer sets `languages: [typescript, react]` and the local layer sets `languages: [typescript]`
- **THEN** the resolved `languages` is `[typescript]`

#### Scenario: append-only array

- **WHEN** the project layer sets `policy.evidence.non-executable: ["site/**", "**/*.md"]`
- **THEN** the resolved list holds every default glob followed by `site/**` once, and `**/*.md` stays in its default place

#### Scenario: duplicate id

- **WHEN** one layer lists two `tools.lint` items with the same `id`
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid` naming the `id` and the layer

### Requirement: Registry and consumers

Every key the kernel accepts SHALL be declared by exactly one registered config module, and every module SHALL name the slice that consumes it (S6: no unknown key, no key without a consumer).

A module declares its key, its zod schema with defaults, a description and its consumer slice, and lives in the consumer slice's `config.ts` (`kernel-architecture`, Slice anatomy); `shared/config` and `shared/store` declare the modules they consume themselves, in `shared/config/modules.ts` and `shared/<module>/config.ts`. The consumer column of the tables below names that slice; another slice that needs the value reads it through the consumer's `index.ts`, within the dependency matrix. A module is registered by the task that lands its consumer, so the registry holds a subset of the keys this spec declares. Validation is strict and reports every error with the full dotted key, the layer and the file:

- a key this spec declares whose owner task has not registered it answers `policy/unknown-config-key` with `why` naming the owner task (`lands with T30`);
- a removed v2 key (requirement "Removed v2 keys") answers `policy/unknown-config-key` with `why` naming its replacement or the reason it is gone;
- any other key answers `policy/unknown-config-key`, with a "did you mean" hint when a declared key is within edit distance 2;
- a value failing its module answers `policy/config-invalid`.

A module's key is a root key (`tools`) or a dotted subtree of a root (`policy.budgets`), so one root can hold the modules of several consumers; the registry composes the modules sharing a root into one strict object, and an unknown key under that root is still `policy/unknown-config-key`. Two modules declaring the same key, or one module's key being a prefix of another's (`policy` and `policy.gates`), fail the registry at startup. A structural test fails the build when a module names a slice that is not in `kernel-architecture`, Vertical slices, or when the consumer slice has a registered command handler and none of its use cases reads the module. A contract test fails the build when the key tables of this spec and the registry disagree: every registered key is in a table with the same type, default, owner and consumer, and every table key not registered is on the kernel's list of planned keys with the same owner.

#### Scenario: config layering with unknown key

- **WHEN** the global layer is valid and `.bdk/settings.yaml` sets `tools.tests` in a git repository fixture, and `bdk config check --json` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/unknown-config-key`, and `why` names `tools.tests`, the layer `project`, the file `.bdk/settings.yaml` and the hint `tools.test`

#### Scenario: key of a later task

- **WHEN** `.bdk/settings.yaml` sets `archive.keep-evidence` before T30 registers its module
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming the key, the layer and `lands with T30`

#### Scenario: key without a consumer

- **WHEN** a module names a consumer slice that has a registered handler but no use case of that slice reads the module
- **THEN** the S6 structural test fails the build

#### Scenario: spec and registry disagree

- **WHEN** a module changes a default without the matching row of this spec changing
- **THEN** the contract test fails naming the key

#### Scenario: one root, several consumers

- **WHEN** `graph` registers `policy.gates`, `attempt` registers `policy.budgets` and `shared/store` registers `policy.checkpoint`, and `.bdk/settings.yaml` sets `policy.budgets.verifier: 3` and `policy.gates.design: auto`
- **THEN** `bdk config check` exits 0, `bdk config show policy --json` shows both values with their origin, and `policy.budgets.verfier` answers `policy/unknown-config-key` with the hint `policy.budgets.verifier`

#### Scenario: planned key inside a registered subtree

- **WHEN** `policy.checkpoint` is registered and `.bdk/settings.yaml` sets `policy.checkpoint.squash-at-close: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` and `why` naming `lands with T30`

### Requirement: Keys of execution and archive

The settings SHALL declare the execution and archive keys below.

| Key                     | Type            | Default | Owner | Consumer | v2 origin |
| ----------------------- | --------------- | ------- | ----- | -------- | --------- |
| `execution.concurrency` | integer 1 to 15 | `5`     | T23   | `ctx`    | none      |
| `archive.keep-evidence` | boolean         | `false` | T30   | `change` | none      |

`execution.concurrency` caps how many dispatches of one wave the orchestrator runs at once through the host's own subagents; the kernel runs no dispatch process itself, so there is no runner or host key. `ctx` consumes it: the swarm skill's context (`bdk ctx skill swarm`) carries a `Concurrency` section stating the resolved value (T23-D52). `archive.keep-evidence: true` keeps the full `dispatch/` and `reports/` bodies in the archived Change; by default `change close` replaces them with their hash index (`kernel-state`, Pruned index; T23-D53). Its module lands with its consumer, `change close` (T30).

#### Scenario: concurrency default

- **WHEN** the `execution` module is registered, no layer sets `execution.concurrency` and `bdk config show execution.concurrency --json` runs
- **THEN** the exit code is 0 and the value is `5`

#### Scenario: detected key unset

- **WHEN** the `execution` module is registered and `bdk config show execution.runner` runs
- **THEN** the exit code is 2 with `rule: policy/unknown-config-key`, because the module declares no runner or host key

#### Scenario: removed runner key in a layer

- **WHEN** `.bdk/settings.yaml` sets `execution.runner: headless`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `execution.runner`

#### Scenario: concurrency in the swarm context

- **WHEN** `.bdk/settings.yaml` sets `execution.concurrency: 3` and `bdk ctx skill swarm` runs
- **THEN** its `Concurrency` section states 3

#### Scenario: concurrency out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.concurrency: 16`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `execution.concurrency`

## ADDED Requirements

### Requirement: Keys of evidence policy

The settings SHALL declare the evidence policy keys below, registered as one module `policy.evidence` with consumer `evidence` (T23-D16, D46, D48).

| Key                                   | Type                                        | Default                                                                                                                                                                                                                                                                                    | Owner | Consumer   | v2 origin |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | --------- |
| `policy.evidence.non-executable`      | append-only array of unique non-empty globs | `**/*.md`, `**/*.mdx`, `**/*.txt`, `**/*.rst`, `**/*.png`, `**/*.jpg`, `**/*.jpeg`, `**/*.gif`, `**/*.svg`, `**/*.webp`, `docs/**`, `LICENSE*`, `CHANGELOG*`, `.bdk/**`                                                                                                                    | T23   | `evidence` | none      |
| `policy.evidence.build-config`        | append-only array of unique non-empty globs | `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`, `poetry.lock`, `requirements*.txt`, `go.mod`, `go.sum`, `Cargo.toml`, `Cargo.lock`, `Gemfile`, `Gemfile.lock`, `pom.xml`, `build.gradle*`, `Makefile`, `CMakeLists.txt` | T23   | `evidence` | none      |
| `policy.evidence.max-committed-bytes` | integer >= 0                                | `65536`                                                                                                                                                                                                                                                                                    | T23   | `evidence` | none      |

Globs match paths relative to the project root; `*` stays within one path segment and `**` crosses segments. A path matching `build-config` counts as build config even when it also matches `non-executable` (`requirements.txt`). The two lists are the kernel's copy of the file-class partition of `.claude/rules/verification-scoping.md`: non-executable content never changes the tree hash, build-feeding config always does (`kernel-state`, Evidence manifest, Tree hash). `max-committed-bytes: 0` keeps every evidence file on the machine. A project whose Markdown is executable content (a documentation build) makes it count by listing it in `build-config`, since a default item cannot be removed.

#### Scenario: evidence defaults

- **WHEN** no layer sets `policy.evidence` and `bdk config show policy.evidence --json` runs
- **THEN** the exit code is 0, the two lists hold the defaults of the table and `max-committed-bytes` is 65536

#### Scenario: project appends a glob

- **WHEN** `.bdk/settings.yaml` sets `policy.evidence.build-config: ["mkdocs.yml", "docs/**"]`
- **THEN** the resolved `build-config` holds the defaults followed by both globs, and a change under `docs/` changes the tree hash
