# Spec Delta

## MODIFIED Requirements

### Requirement: Plan part and plan index

A plan part's frontmatter SHALL carry the part fields of P6 and P7, and `plan/index.md` SHALL be generated from the parts only.

Plan part (`plan/parts/<nn>-<slug>.md`; the task grammar of the body follows the table):

| Field              | Type                                | Req. | Meaning                                                                                                                                                                                         |
| ------------------ | ----------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`           | integer                             | yes  |                                                                                                                                                                                                 |
| `id`               | two digits                          | yes  | Equals `<nn>` of the file name.                                                                                                                                                                 |
| `title`            | string                              | yes  |                                                                                                                                                                                                 |
| `goal`             | string                              | yes  |                                                                                                                                                                                                 |
| `success-measure`  | string                              | yes  | What a reviewer can observe.                                                                                                                                                                    |
| `do-not-touch`     | array of globs                      | yes  | Empty allowed.                                                                                                                                                                                  |
| `depends-on`       | array of part ids                   | yes  | Empty allowed.                                                                                                                                                                                  |
| `spec-impact`      | `none` or array of capability names | no   | D2; absent means `none` for `tiny` and `small`, and fails the plan part check for `large` (`kernel-loops`, Plan part checks).                                                                   |
| `isolation`        | `shared` or `worktree`              | no   | Where the part runs (T45): `shared`, the default when absent, in the Change's working tree; `worktree` in its own git worktree (Part worktree).                                                 |
| `isolation-reason` | string                              | no   | One line naming the state the part shares outside `Files:` (a lockfile, codegen output, migration numbering, a port, a database); required when `isolation` is `worktree`. An executable field. |

The body holds the part's tasks. A task starts at a level-2 heading `## <task-id> <title>`, where `<task-id>` is two digits, a dash and a positive integer (`02-3`) and ends at the next level-2 heading. Task ids are unique across the plan; `plan` writes them with the part's prefix and `part split` keeps a moved task's id. Under a task heading the kernel reads these bold field labels; other text is free:

| Label               | Req.           | Value                                                                                                                    |
| ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `**Files:**`        | yes            | A list; each item holds one backticked relative path, optionally prefixed by `Create:`, `Modify:`, `Test:` or `Delete:`. |
| `**Test cases:**`   | one of the two | A non-empty list of test cases.                                                                                          |
| `**Verification:**` | one of the two | `none`: the `Verification: none` task class (below).                                                                     |
| `**Depends on:**`   | no             | `none` or comma-separated task ids of the same part.                                                                     |
| `**Stop rule:**`    | no             | The condition under which the worker stops and returns `blocked` (P6).                                                   |

A task MAY declare `Verification: none` only when every file of its `**Files:**` is non-executable content (a path in `policy.evidence.non-executable` and not in `policy.evidence.build-config`, `kernel-settings`, Keys of evidence policy), pure wiring, or a refactor fully covered by existing tests. Such a task has no `**Test cases:**`, is not run test-first, and is verified by its success measure and the review at the end of the plan.

Executable fields are `goal`, `success-measure`, `isolation-reason`, each task title, each `Files:` item, each `Test cases:` item and `Stop rule:`. An executable field holds a placeholder when it contains `TODO`, `TBD` or `FIXME` as a word, `<fill in>` or `[...]`, is `...` or `…` alone, or is wrapped in square brackets as a whole (`[Action verb + what]`).

Plan index: `schema`, `generated: true`, `parts` (array of `{id, title, depends-on, wave}`), where `wave` is 1 for a part without dependencies and one more than the highest wave of its dependencies. The body is a rendered table. The index is a pure function of the parts: regenerating it from unchanged parts yields the same bytes; a dependency cycle or a missing part id fails generation.

#### Scenario: regenerated index

- **WHEN** `plan/index.md` is deleted and regenerated from unchanged parts
- **THEN** its bytes equal the deleted file

#### Scenario: dependency cycle

- **WHEN** part `01` depends on `02` and `02` on `01`
- **THEN** generation fails naming both parts

#### Scenario: task grammar

- **WHEN** a part body holds `## 02-1 Add login route` with a `**Files:**` list of two backticked paths and a `**Test cases:**` list, and `## 02-2 Wire config` with `**Files:**` and `**Verification:** none`
- **THEN** the part parses into two tasks with their files, the first with test cases and the second with verification `none`

#### Scenario: placeholder title

- **WHEN** a task heading reads `## 02-1 [Action verb + what]`
- **THEN** the task title holds a placeholder

#### Scenario: isolation absent

- **WHEN** a part's frontmatter has no `isolation` field
- **THEN** the part parses with `isolation: shared` and no `isolation-reason`

#### Scenario: worktree part

- **WHEN** a part's frontmatter sets `isolation: worktree` and `isolation-reason: "both parts regenerate pnpm-lock.yaml"`
- **THEN** the part parses with both fields, and `isolation: sandbox` fails validation naming `isolation`
