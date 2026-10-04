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
| `**Verification:**` | one of the two | `none` (`.claude/rules/verification-scoping.md`, `Verification: none` task class).                                       |
| `**Depends on:**`   | no             | `none` or comma-separated task ids of the same part.                                                                     |
| `**Stop rule:**`    | no             | The condition under which the worker stops and returns `blocked` (P6).                                                   |

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

### Requirement: Dispatch package

A dispatch package SHALL be written only by `dispatch build`, with the frontmatter fields below (K3, K4, P10) and the body sections that `kernel-cli/dispatch`, `bdk dispatch build`, lists in order; the whole file is at most 12 288 bytes.

| Field            | Type                        | Req. | Stamped | Meaning                                                                                                                                                      |
| ---------------- | --------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`         | integer                     | yes  | kernel  |                                                                                                                                                              |
| `ticket`         | `A-` id                     | yes  | kernel  |                                                                                                                                                              |
| `target`         | string                      | yes  | kernel  |                                                                                                                                                              |
| `role`           | string                      | yes  | kernel  | Role skill name (`implementer`, `verifier`, ...).                                                                                                            |
| `adapter`        | string                      | yes  | kernel  | The role's adapter (`role-contracts`, Role-to-adapter map).                                                                                                  |
| `attempt`        | integer >= 1                | yes  | kernel  |                                                                                                                                                              |
| `of`             | integer >= 1                | yes  | kernel  |                                                                                                                                                              |
| `scope`          | `full \| high+ \| blockers` | yes  | kernel  |                                                                                                                                                              |
| `model`          | string                      | no   | kernel  | The escalation ticket's `model`, on every package of the ticket but a `runner` or `scout` one; the agent must run on it (T41-D14, `guard/escalation-model`). |
| `at`             | timestamp                   | yes  | kernel  |                                                                                                                                                              |
| `kernel-version` | string                      | yes  | kernel  | P10.                                                                                                                                                         |
| `template-hash`  | hash                        | yes  | kernel  | P10.                                                                                                                                                         |
| `report`         | path                        | yes  | kernel  | Where the role's report is written (`reports/...`).                                                                                                          |
| `rules`          | array of rule ids           | yes  | kernel  | The rules selected for the ticket, in order (T31); may be empty.                                                                                             |
| `group`          | kebab-case string           | no   | kernel  | Review group of a `dispatch build --group` package (T42-A1).                                                                                                 |
| `files`          | array of paths              | no   | kernel  | The group's file set; present exactly when `group` is.                                                                                                       |
| `workdir`        | absolute path               | no   | kernel  | The work root of the target when it is a live worktree part, or a task of one (Part worktree, T45); absent otherwise, which means the home checkout.         |

#### Scenario: package without template hash

- **WHEN** a dispatch package lacks `template-hash`
- **THEN** validation fails naming `template-hash`

#### Scenario: package with an unknown adapter

- **WHEN** a dispatch package carries `adapter: planner`
- **THEN** validation fails naming `adapter`

#### Scenario: escalation package names its model

- **WHEN** `dispatch build` builds the `implementer` and the `runner` package of an escalation ticket opened with `policy.escalation.model: opus`
- **THEN** the implementer package holds `model: opus` and the runner package holds no `model`

#### Scenario: package records its rules

- **WHEN** a package is built for a `runner` ticket
- **THEN** its frontmatter holds `rules: []`, and a package without `rules` fails validation naming `rules`

#### Scenario: group without files

- **WHEN** a dispatch package carries `group: p01` and no `files`
- **THEN** validation fails naming `files`

#### Scenario: relative workdir

- **WHEN** a dispatch package carries `workdir: .bdk/.machine/worktrees/x/02`
- **THEN** validation fails naming `workdir`, because it must be absolute

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open`, stamped with `package` by every `dispatch build` without `--group` and with `rules-read` by the first `rules show --ticket` call under the implementer package, and completed by `attempt close`, with these fields.

| Field           | Type                                                                   | Req. | Stamped | Meaning                                                                                                                              |
| --------------- | ---------------------------------------------------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`        | integer                                                                | yes  | kernel  |                                                                                                                                      |
| `ticket`        | `A-` id                                                                | yes  | kernel  |                                                                                                                                      |
| `loop`          | `task-redispatch \| verify-fix \| review-fix \| verifier \| part-lead` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).                                                      |
| `target`        | string                                                                 | yes  |         | Task, part, artifact or Change id.                                                                                                   |
| `attempt`       | integer >= 1                                                           | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                                                        |
| `of`            | integer >= 1                                                           | yes  | kernel  | Budget from policy.                                                                                                                  |
| `scope`         | `full \| high+ \| blockers`                                            | yes  |         |                                                                                                                                      |
| `narrowed-from` | `full \| high+ \| blockers`                                            | no   |         |                                                                                                                                      |
| `escalation`    | boolean                                                                | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`.                                        |
| `model`         | string                                                                 | no   | kernel  | On the escalation ticket: `policy.escalation.model` when it opened. `dispatch build` copies it into the ticket's packages (T41-D14). |
| `opened-at`     | timestamp                                                              | yes  | kernel  |                                                                                                                                      |
| `author`        | string                                                                 | yes  | kernel  |                                                                                                                                      |
| `closed-at`     | timestamp                                                              | no   | kernel  | Present exactly when `outcome` is.                                                                                                   |
| `outcome`       | `ok \| fail \| not-run`                                                | no   |         |                                                                                                                                      |
| `findings`      | array of `{fingerprint, type, file, symbol?}`                          | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).                                                 |
| `dropped`       | array of `L-` ids                                                      | no   |         | Findings that fell out of scope N+1.                                                                                                 |
| `rules-read`    | timestamp                                                              | no   | kernel  | First `rules show --ticket` call under the ticket's implementer package (risk R2); read by `attempt close`.                          |
| `package`       | relative path                                                          | no   | kernel  | The ticket's active package: the latest `dispatch build` of the ticket (T23-D42).                                                    |
| `merge`         | boolean                                                                | no   | kernel  | A `verify-fix` merge ticket of a worktree part (T45; `kernel-cli/attempt`, bdk attempt open).                                        |
| `conflicts`     | array of paths                                                         | no   | kernel  | The unmerged paths when the merge ticket opened; present exactly when `merge` is.                                                    |

The body is the close reason (`--reason` of `attempt close`, `taken over` from `change takeover`). `not-run` counters and budgets are derived from the records of a loop, target and round (`kernel-loops`, Loops, targets and rounds), never stored.

#### Scenario: closed without timestamp

- **WHEN** an attempt record has `outcome` but no `closed-at`
- **THEN** validation fails naming `closed-at`

#### Scenario: escalation loop name is gone

- **WHEN** an attempt record carries `loop: task-escalation`
- **THEN** reading the Change reports `state/ledger-invalid` naming `loop`

#### Scenario: rules-read survives a rebuild

- **WHEN** a ticket's record carries `rules-read` and `bdk rebuild` recreates the index
- **THEN** `attempt close` still finds the ticket's rules read

#### Scenario: active package follows the last build

- **WHEN** `dispatch build 02-3 implementer A-7f3k9m2q` and then `dispatch build 02-3 runner A-7f3k9m2q` run
- **THEN** the record's `package` is `dispatch/02-3-runner-A-7f3k9m2q.md`

#### Scenario: part-lead ticket

- **WHEN** an attempt record carries `loop: part-lead` and `target: 02`
- **THEN** it validates, and `bdk attempt list --for 02 --json` lists it

#### Scenario: group builds leave the active package

- **WHEN** `dispatch build <change> implementer A-r1v2w3x4` and then `dispatch build <change> reviewer A-r1v2w3x4 --group p01 --range H0..H1` run
- **THEN** the record's `package` names the implementer package

## ADDED Requirements

### Requirement: Part worktree

A plan part with `isolation: worktree` SHALL run, while it is live, in a git worktree the kernel owns, and every other part and all Change state SHALL stay in the home checkout (T45; user decisions 2026-10-04).

- **Home checkout.** The working tree whose branch is bound to the Change (Branch binding). It holds the only `.bdk/.machine/` and the only Change directory the kernel reads or writes; there is one ledger, and nothing of the ledger is ever merged.
- **Location.** `<dir>/<change id>/<part id>`, where `<dir>` is `execution.worktree.dir` resolved against the home checkout's project root (`kernel-settings`, Keys of execution and archive). A `dir` inside the repository must be ignored by git; `part start` refuses with `policy/config-invalid` naming the key otherwise, so a worktree never shows as untracked files.
- **Branch.** `bdk-part/<change id>/<part id>`, created by `git worktree add -b` from the home checkout's `HEAD`, never from the default branch.
- **Home marker.** The file `bdk-home` in the worktree's git directory (`git rev-parse --git-dir` inside the worktree) holds the home checkout's absolute project root and the Change id, one per line. It is how a kernel command run inside the worktree finds its home (`kernel-cli`, Invocation), and how `rebuild` tells a kernel worktree from one the user made.
- **Live.** A part is live while it has a `part start` marker later than its latest done marker and its worktree exists.
- **Work root.** The work root of a task or part target is its part's worktree while the part is live with `isolation: worktree`, and the home checkout otherwise. The diff check, `commit`, `attempt close`, the tree hash of `evidence record` and `evidence check`, and the `execute-part` checks read the files and run git in the work root. The Change target and every other target use the home checkout.
- **What a part branch holds.** Only the part's task commits. A commit in a worktree never stages `.bdk/`, because the Change directory lives in the home checkout. Kernel entries of those commits are written there and are committed by the next home commit or checkpoint.

#### Scenario: worktree from the Change branch

- **WHEN** the home checkout is on the Change branch with two commits the default branch lacks, and `bdk part start 02` runs for a `worktree` part
- **THEN** `git -C <dir>/<change id>/02 log -1 --format=%H` equals the home `HEAD`, the worktree's branch is `bdk-part/<change id>/02`, and its git directory holds `bdk-home` naming the home project root and the Change id

#### Scenario: no Change state in the worktree

- **WHEN** `bdk log add finding "x" --ref src/a.ts` runs with the working directory inside the worktree of part 02
- **THEN** the entry file is written under the home checkout's `.bdk/changes/<id>/log/`, and `git -C <worktree> status --porcelain` lists nothing under `.bdk/`

#### Scenario: dir not ignored

- **WHEN** `.bdk/settings.yaml` sets `execution.worktree.dir: worktrees` and no ignore rule covers `worktrees/`, and `bdk part start 02` runs for a `worktree` part
- **THEN** the exit code is 2 with `rule: policy/config-invalid` naming `execution.worktree.dir`, and no worktree exists
