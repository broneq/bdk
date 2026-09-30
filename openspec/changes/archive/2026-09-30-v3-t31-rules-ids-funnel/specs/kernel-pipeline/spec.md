## MODIFIED Requirements

### Requirement: Pipeline file

The plugin SHALL ship `pipeline/pipeline.yaml`, and the kernel SHALL load it on every graph read through a strict schema that accepts exactly the keys below.

| Key                | Type                          | Req.     | Meaning                                                                                                                           |
| ------------------ | ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `schema`           | integer                       | yes      | Version of this file's format; `1`.                                                                                               |
| `stages`           | array of `{id, command}`      | yes      | Stage ids in order (`intent`, `design`, `plan`, `execute`, `review`, `close`) and the stage command a user types (`/bdk:plan`).   |
| `nodes`            | array of node objects         | yes      | In pipeline order, which is also the order `next` walks.                                                                          |
| `nodes[].id`       | kebab-case, or `gate:<stage>` | yes      | Unique. A node whose kind expands into instances names the collection (`plan`); its instances are `<kind>:<nn>` (`plan-part:01`). |
| `nodes[].kind`     | a registered kind             | yes      | See Artifact kinds.                                                                                                               |
| `nodes[].stage`    | a stage id                    | yes      |                                                                                                                                   |
| `nodes[].requires` | array of node ids             | no       | Default empty. Every id names a node of the file; the graph is acyclic.                                                           |
| `nodes[].profiles` | array of `tiny, small, large` | no       | Default all. The node exists only for these effective profiles.                                                                   |
| `nodes[].kinds`    | array of `feature, bug`       | no       | Default all. The node exists only for these Change kinds.                                                                         |
| `nodes[].if`       | `features.<name>`             | no       | The node exists only while that boolean feature switch resolves to `true`; the name must be a declared `features` key.            |
| `nodes[].budget`   | a loop name                   | no       | One of `task-redispatch`, `verify-fix`, `review-fix`, `verifier`, `not-run`; the value lives in `policy.budgets` (read by T22).   |
| `nodes[].rules`    | array of rule categories      | no       | Rule sets the instruction carries, each a category directory of the BDK pack (`rule-pack`, Pack layout), e.g. `code-quality`.     |
| `nodes[].policy`   | a key of `policy.gates`       | for gate | The setting that says whether this gate is `manual` or `auto`.                                                                    |
| `nodes[].opens`    | a stage id                    | for gate | The stage whose command passes the gate; the gate's `command` is that stage's `command`.                                          |

The file SHALL hold no expression other than `if: features.<name>`, no loop construct and no path: which files a node reads or writes is decided by its kind, so the file cannot reference anything outside the Change directory. Anything that needs logic becomes a kind with tests. A shipped file that fails the schema is a kernel defect, not a refusal: the graph command crashes with exit 1 and a stack trace naming the key (`kernel-cli`, Exit codes and the error object), which the content test keeps from ever shipping. A content test runs the same schema on the shipped file and on negative fixtures. The build SHALL generate `schema/pipeline.json` (JSON Schema draft 2020-12) from that schema, like `schema/settings.json`, so the committed JSON Schema never drifts from the one the kernel enforces; the shipped file's first line is the modeline `# yaml-language-server: $schema=../schema/pipeline.json`, a relative path so editors validate against the schema of the same checkout.

#### Scenario: when is rejected

- **WHEN** the content test loads a pipeline fixture whose node carries `when: files.touched("src/billing/**")`
- **THEN** validation fails naming `nodes[<n>].when` as an unknown key

#### Scenario: expression in if

- **WHEN** a node carries `if: features.lavish && profile == large`
- **THEN** validation fails naming `if`, because only `features.<name>` is accepted

#### Scenario: unknown feature

- **WHEN** a node carries `if: features.unknown-switch`
- **THEN** validation fails naming the feature, because it is not a declared `features` key

#### Scenario: dangling or cyclic requires

- **WHEN** a node requires an id that no node has, or two nodes require each other
- **THEN** validation fails naming the node ids

#### Scenario: generated JSON Schema

- **WHEN** `pnpm build` runs and the shipped `pipeline/pipeline.yaml` and the fixture with `when:` are validated against `schema/pipeline.json`
- **THEN** `git diff --exit-code schema/` is clean, the shipped file validates and the fixture fails on `when`

#### Scenario: shipped file is valid

- **WHEN** the content test loads the shipped `pipeline/pipeline.yaml`
- **THEN** it validates, every `kind` is registered, every gate has `policy` and `opens`, and every gate's `policy` is a declared `policy.gates` key

#### Scenario: rule category of the pack

- **WHEN** a node carries `rules: [code-quality, plan]`
- **THEN** validation passes, and a node carrying `rules: [languages/react]` or `rules: [style]` fails naming `nodes[<n>].rules`, because only the pack's category directories are rule categories
