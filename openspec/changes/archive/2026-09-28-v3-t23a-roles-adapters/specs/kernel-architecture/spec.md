## MODIFIED Requirements

### Requirement: Vertical slices

The kernel source SHALL be organised as one slice per command group plus `shared/`; the set of `slice` values in `schema/cli/commands.json` SHALL equal this module list.

| Slice      | Commands                                                                             | Owner tasks   | One sentence                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `change`   | `change new`, `status`, `list`, `resume`, `park`, `takeover`, `checkpoint`, `close`  | T20, T22, T30 | Lifecycle of the one Change per branch; `close` composes `spec`, `log route` and `rules export`.                                                                                 |
| `measure`  | `measure`                                                                            | T20           | Size heuristic for an intent or a diff; separate because `change new` and `/bdk:cr` both call it and its calibration changes independently.                                      |
| `graph`    | `next`, `explain`, `validate`, `done`                                                | T21           | The artifact graph from `pipeline.yaml`: node states, input hashes, kind validators, gate status.                                                                                |
| `part`     | `part list`, `start`, `done`, `split`                                                | T22           | Plan parts, their validators (S1, P6) and the diff check against `Files:` and `do-not-touch`.                                                                                    |
| `attempt`  | `attempt open`, `close`, `list`                                                      | T22           | Tickets, budgets, the escalation ladder and oscillation detection (P4, A-drabina).                                                                                               |
| `log`      | `log add`, `ingest`, `list`, `show`, `resolve`, `route`                              | T20, T22, T31 | The append-only ledger and its provenance rules (K2, P1); the leaf every writing slice depends on.                                                                               |
| `dispatch` | `dispatch build`, `show`                                                             | T23           | Dispatch packages (K3, K4).                                                                                                                                                      |     |
| `evidence` | `evidence record`, `check`                                                           | T23           | Evidence manifests, tree hashes, citations and freshness (T4, P5).                                                                                                               |
| `spec`     | `spec delta check`, `merge`, `diff`                                                  | T30           | Spec deltas and the deterministic merge (D2b, V1-7).                                                                                                                             |
| `config`   | `config show`, `check`, `schema`, `set`                                              | T12           | The commands over the layered configuration; the layering itself is `shared/config`.                                                                                             |
| `ctx`      | `ctx skill`, `startup`                                                               | T13           | Prompt context composition: the skill manifest, rules, fragments, tool entries, the agents table.                                                                                |
| `rules`    | `rules check`, `show`, `add`, `explain`, `prune`, `import`, `stats`, `export`        | T31           | Rule files, ids, `applies` selection and the learning funnel.                                                                                                                    |
| `query`    | `query`                                                                              | T20           | Read-only SQL over the index.                                                                                                                                                    |
| `commit`   | `commit`                                                                             | T22           | The task commit with BDK trailers.                                                                                                                                               |
| `hooks`    | `hooks session-start`, `session-end`, `prompt-expansion`, `pre-tool`, `skill-exists` | T13, T24      | Host payload parsing, guard decisions, the only writer of `source: user`.                                                                                                        |
| `service`  | `doctor`, `rebuild`, `import`, `version`                                             | T11, T22, T32 | Diagnosis, index rebuild, the v2 import and the version; reads every other slice; `rebuild` writes only through the `shared/store` rebuild core, which `change takeover` shares. |
| `export`   | `export agents`                                                                      | T23           | Host projections: the adapter files generated from the adapter definitions and the per-host tool map.                                                                            |     |

The one relationship the map shows is _who may import whom_. Arrows point from the importing slice to the imported one; every slice may import `shared/`, drawn as one edge from the slice boundary. `service` (imports every slice, read-only), `query` and `export` (import nothing but `shared/`) are left out of the drawing to stay within the node budget; the matrix below is complete.

```mermaid
flowchart TB
    subgraph Slices["Slices (one per command group)"]
        hooks["hooks"]
        change["change"]
        dispatch["dispatch"]
        commit["commit"]
        attempt["attempt"]
        part["part"]
        graphSlice["graph"]
        ctx["ctx"]
        rules["rules"]
        log["log"]
        evidence["evidence"]
        spec["spec"]
        measure["measure"]
        config["config"]
    end
    shared["shared/ (store, git, config, ids, clock, refusal, output, registry)"]

    hooks -->|"next, gate status"| graphSlice
    hooks -->|"status, checkpoint"| change
    hooks -->|"transition entries"| log
    hooks -->|"startup context"| ctx
    hooks -->|"config check"| config
    change -->|"profile"| measure
    change -->|"first artifact"| graphSlice
    change -->|"entries"| log
    change -->|"merge at close"| spec
    change -->|"export at close"| rules
    change -->|"status parts"| part
    graphSlice -->|"done entries"| log
    graphSlice -->|"instruction text"| ctx
    part -->|"part checks, done marker"| graphSlice
    part -->|"tiny guard"| measure
    part -->|"transition entries"| log
    attempt -->|"diff check"| part
    attempt -->|"finding entries"| log
    attempt -->|"freshness"| evidence
    commit -->|"diff check"| part
    commit -->|"finding entries"| log
    commit -->|"tiny guard"| measure
    dispatch -->|"rule selection"| rules
    dispatch -->|"role context"| ctx
    ctx -->|"rule selection"| rules
    rules -->|"learning entries"| log
    Slices -->|"store queries, git, config, output"| shared

    classDef primary fill:#3b6ea5,stroke:#7fa8d0,color:#ffffff
    classDef store fill:#5f4b8b,stroke:#9b8bc4,color:#ffffff
    class hooks,change,dispatch,commit,attempt,part,graphSlice,ctx,rules,log,evidence,spec,measure,config primary
    class shared store
    style Slices fill:transparent,stroke:#8b93a1,stroke-dasharray:4 3
```

#### Scenario: slice parity

- **WHEN** a record in `schema/cli/commands.json` names a slice that this list does not contain, or a listed slice has no record
- **THEN** the contract test fails

#### Scenario: T22 slices registered

- **WHEN** the kernel's registrations are listed after T22
- **THEN** the `attempt`, `part` and `commit` slices register handlers for every record whose slice they are, and none answers `kernel/not-implemented`

### Requirement: shared/ admission rule

Something SHALL enter `shared/` only as an OS boundary or when three or more slices use it, and the `node:` modules SHALL appear only in the files the inventory names.

Something enters `shared/` for one of two reasons and each entry states which: **(a)** it is an OS boundary (file system, child process, clock, terminal), or **(b)** three or more slices use it. Anything else lives in the slice that needs it, even if a second slice later copies three lines.

| Module              | Admitted by                                 | Holds                                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/store`      | (a) file system; (b) every slice            | The single access point of R-store: Change directory IO, frontmatter, the SQLite index (`node:sqlite`), lazy rebuild, typed read queries, and the state schemas of `kernel-state` (zod, validation on every read and write, fingerprints, migrations).                                                         |
| `shared/git`        | (a) child process                           | Wrapper over `git` (`node:child_process`): diff, trailers, pathspec commit, work tree state; the `runtime/git-missing` and `policy/git-in-progress` checks.                                                                                                                                                    |
| `shared/config`     | (a) file system, user home; (b) every slice | The four layers and the global layer path, deep merge, the zod module registry and its JSON Schema export, prompt values, the resolved snapshot, comment-preserving edits of a layer file.                                                                                                                     |
| `shared/ids`        | (b) `change`, `log`, `attempt`, `evidence`  | Merge-safe id generation (`kernel-state`, Identifiers) and parsing of qualified references.                                                                                                                                                                                                                    |
| `shared/vocabulary` | (b) `change`, `log`, `attempt`, `graph`     | The closed value lists of `kernel-state` (entry types, statuses, profiles, change kinds and sources, provenance values and the `source` pattern, ticket scopes) as plain constants. It imports nothing, so `domain/`, `render/` and `schema/` may read it and `shared/store` builds the state schemas from it. |
| `shared/clock`      | (a) system clock                            | The one source of `at`; injectable in tests.                                                                                                                                                                                                                                                                   |
| `shared/refusal`    | (b) every slice                             | The four-field error object, the rule id catalogue as a typed enum, the class-to-exit mapping (`kernel-cli`, Exit codes and the error object).                                                                                                                                                                 |
| `shared/output`     | (b) every slice                             | Text and JSON writers, list pages and the 100-item cap, the STOP block renderer (`kernel-cli`, Output modes).                                                                                                                                                                                                  |
| `shared/registry`   | (b) every slice                             | Command registration from `schema/cli/commands.json`, dispatch by argv, `--help`, mode handling (inject always exits 0, guard fail-closed), the active-Change resolution for `changeScoped` records, the `kernel/not-implemented` stub for unregistered handlers.                                              |

A content test allows `node:fs` only in `shared/store`, `shared/config` and `shared/git`, `node:child_process` only in `shared/git`, and `node:sqlite` only in `shared/store`. `shared/` never imports a slice; the composition root (`kernel/src/main.ts`) wires the slices into the registry.

#### Scenario: node module outside its boundary

- **WHEN** `node:fs` appears outside `shared/store`, `shared/config` and `shared/git`, `node:child_process` outside `shared/git`, or `node:sqlite` outside `shared/store`
- **THEN** the `node:` boundary test fails the build

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

Inside a slice the layers point one way: `commands/` imports `use-cases/`, `render/` and `schema/`; `use-cases/` imports `domain/`, `store/`, `schema/` and the `index.ts` of the slices in its matrix row; `store/` imports `domain/` and `shared/store`; `render/` and `schema/` import `domain/` and `shared/vocabulary` only; `domain/` imports nothing but `shared/vocabulary` and types from `shared/ids` and `shared/clock`. The import scan below enforces the direction.

`config.ts` imports only `shared/config` and zod; `use-cases/` reads settings only through the modules of its own `config.ts`, which the composition root registers (`kernel-settings`, Registry and consumers). Every slice has the same directories with the same responsibilities, so a reader who knows one slice knows all of them. A slice with one command (`commit`, `query`, `measure`) keeps the directories with one file in each; a slice without pure rules omits `domain/`. `graph/domain/kinds/` holds one class per artifact kind and `hooks/domain/` the payload parsers per host event.

#### Scenario: layer direction inside a slice

- **WHEN** `commands/` imports `store/`, `render/` imports `use-cases/`, `schema/` imports a shared module other than `shared/vocabulary`, or `domain/` imports anything but `shared/vocabulary` and types from `shared/ids` and `shared/clock`
- **THEN** the import scan fails the build

#### Scenario: shared/vocabulary imports something

- **WHEN** a file of `shared/vocabulary` imports a module or a package
- **THEN** the import scan fails the build

#### Scenario: config module outside its consumer

- **WHEN** a config module is declared anywhere but the `config.ts` of the slice it names as consumer, or in `shared/config` for the modules `shared/config` consumes
- **THEN** the S6 structural test fails the build
