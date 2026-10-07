# Spec Delta

## MODIFIED Requirements

### Requirement: bdk rules show

Print one rule by id, the rules selected for a ticket, or the rules selected for a role and a file set. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules show <id>|--ticket <ticket>|--role <role> --file <path>...`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped with `--ticket`; standalone otherwise
- **Arguments:**
  - `<id>`. A rule id, e.g. `BDK-CQ-4` or `API-2`. Exactly one of `<id>`, `--ticket` and `--role`.
  - `--ticket <ticket>`. Print the rules selected for the ticket's package (the working agent's, else the active one), or for `<ticket>@<group>` the group's package (`kernel-cli`, Ticket references).
  - `--role <role>`. One of the eleven roles; needs at least one `--file`.
  - `--file <path>`. Repeatable. A repository-relative path of the file set; it need not exist.
- **Behaviour:** With `<id>`, prints the rule's frontmatter and text; a tombstone prints its id and `removed: <reason>` and exits 0; a disabled rule prints with `disabled: true`. With `--ticket`, the ticket must be open and have a dispatch package, or the group must have one (`policy/no-open-ticket` otherwise), and the kernel prints the rules whose ids that package records in its `rules` field (`kernel-state`, Dispatch package), in that order, each with its id, `kind`, `severity`, `paths`, `stages` and the glob that matched. **Selection**, performed by `dispatch build`, `ctx skill` and the instruction of a pipeline node, and exposed by `rules explain`: the candidates are every non-tombstone rule of the bundle and of `.bdk/rules/` that is not in `rules.disabled`, where a bundle rule under `rules/languages/<name>/` is a candidate only when `<name>` is in `languages`; a candidate is selected for a stage when its `stages` holds that stage and a glob of its `paths` matches a file of the file set (repository-relative, `**` crosses directories). A role selects for its stage (Stage readers); a role without a stage selects nothing. The file set is the task's `Files:` for a task, the union of its tasks' `Files:` for a part, the group's file set for a grouped package (`kernel-cli/dispatch`, bdk dispatch build, Groups), and the work tree files for every other target (an artifact, the Change, a session skill, a pipeline node): every file git tracks or would add, so tracked files and untracked files that are not ignored, read once per command. There is no selection without a file set. Order: rules whose matched glob is `**` first, then by the specificity of the matched glob (more literal path segments first, then more literal characters), then by `since`, then by id. Every applying rule is selected: there is no cap, because a configured rule the agent never sees fails silently; `hooks session-start` warns when a role reads more than `rules.warn-above` rules instead (`kernel-cli/hooks`). The first `--ticket` call made while the ticket's active package is its `implementer` package stamps `rules-read` in its attempt record (`kernel-state`, Attempt record); later calls print the same rules and leave the stamp alone, and a call under another role's package stamps nothing, so a `simplifier` or `runner` reading its rules never hides an implementer that read none (risk R2). **Role and files (T42).** With `--role` and `--file`, the kernel prints the Selection for that role and file set in the same form as `--ticket`, with `role` and `files` in place of `ticket` and `target`; it needs no Change and writes nothing, so a reviewer without a package, the `pr-reviewer` of `/bdk:pr-review`, reads the rules a package of that file set would carry. `--role` without `--file`, `--file` without `--role`, and `--role` or `--file` together with `<id>` or `--ticket` are `input/invalid-argument`; an unknown role and a path outside the repository are `input/not-found`.
- **Writes:** `.bdk/changes/<id>/attempts/`
- **Output:** `schema/cli/output/rules-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules show --ticket A-7f3k9m2q --json
  ```

  ```json
  {
    "ticket": "A-7f3k9m2q",
    "role": "implementer",
    "target": "02-3",
    "rules": [
      {
        "id": "BDK-CQ-1",
        "kind": "house",
        "severity": "medium",
        "matchedBy": "**",
        "text": "Descriptive identifiers; no abbreviations unless idiomatic for the language."
      },
      {
        "id": "BDK-REACT-4",
        "kind": "house",
        "severity": "medium",
        "matchedBy": "**/*.tsx",
        "text": "Forms go through Actions ..."
      }
    ],
    "rulesRead": "2026-09-25T10:00:41.305Z"
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules show --ticket A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-show.json`

#### Scenario: input/not-found

- **WHEN** the ticket does not exist in the active Change, or `<id>` names no rule of the bundle or the project
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket is closed or has no dispatch package
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: id form before T31

- **WHEN** `bdk rules show BDK-CQ-4` runs, the form that answered `kernel/not-implemented` before T31
- **THEN** the exit code is 0 and the output holds the rule's text and frontmatter

#### Scenario: tombstone

- **WHEN** `.bdk/rules/API-2.md` carries `removed: superseded by API-5` and `bdk rules show API-2` runs
- **THEN** the exit code is 0 and the output holds `API-2` and `removed: superseded by API-5`

#### Scenario: selection by role

- **WHEN** `languages` is `[typescript, react]`, the project has `API-1` with `paths: [src/api/**]` and `stages: [execute, review]`, and packages are built for an `implementer` ticket of a task whose `Files:` is `web/Form.tsx` and for a `verifier` ticket of the plan
- **THEN** the implementer's rules hold every enabled rule whose `stages` holds `execute` and whose `paths` match `web/Form.tsx`, among them `TS` and `REACT` rules, and not `API-1`; the verifier's rules hold only rules whose `stages` holds `plan`, among them the `PL` rules and no `DP` rule

#### Scenario: project override applies

- **WHEN** `rules.disabled` holds `BDK-SEC-3`, the project holds `SECP-1` with `paths: ["**"]` and `stages: [review]`, and a `reviewer` package is built
- **THEN** its `rules` contains `SECP-1` and not `BDK-SEC-3`

#### Scenario: no cap

- **WHEN** 120 rules apply to a ticket
- **THEN** the package records all 120 ids and `rules show --ticket` prints all 120

#### Scenario: first read is stamped

- **WHEN** `rules show --ticket A-7f3k9m2q` runs twice
- **THEN** the attempt record of `A-7f3k9m2q` holds the `rules-read` time of the first call

#### Scenario: simplifier read does not stamp

- **WHEN** the implementer of ticket `A-7f3k9m2q` never ran `rules show`, and after `dispatch build 02-3 simplifier A-7f3k9m2q` the simplifier runs `bdk rules show --ticket A-7f3k9m2q`
- **THEN** the simplifier gets its package's rules, the attempt record has no `rules-read`, and `attempt close A-7f3k9m2q ok` still writes the rules finding

#### Scenario: group rules

- **WHEN** the `p01` package of ticket `A-r1v2w3x4` records `API-1` and the `p02` package records `UI-1`
- **THEN** `bdk rules show --ticket A-r1v2w3x4@p01` prints `API-1` and not `UI-1`

#### Scenario: integration reviewer prefixes

- **WHEN** an `integration-reviewer` package and a `reviewer` package are built for the same file set
- **THEN** both record the same rule ids in the same order: the role prefix sets are gone, and both roles read the `review` stage

#### Scenario: rules for a role and a file set

- **WHEN** the project holds `API-1` with `paths: [src/api/**]` and `UI-1` with `paths: [web/**]`, both with `stages: [review]`, no Change is active, and `bdk rules show --role pr-reviewer --file src/api/login.ts --json` runs
- **THEN** the exit code is 0, the output holds `role: pr-reviewer`, `files: [src/api/login.ts]` and `API-1` with its text and not `UI-1`, and its rule ids equal those of `rules explain src/api/login.ts --role pr-reviewer`

#### Scenario: role without files

- **WHEN** `bdk rules show --role reviewer` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: stages and paths select a project rule

- **WHEN** the project holds `E2E-1` with `paths: [tests/e2e/**]` and `stages: [plan, execute, review]`, and packages are built for an `implementer` ticket of a task whose `Files:` is `tests/e2e/login.spec.ts`, for an `implementer` ticket of a task whose `Files:` is `src/app.ts`, and for a `design-verifier` ticket of the design
- **THEN** only the first package records `E2E-1`

#### Scenario: work tree files narrow a target without files

- **WHEN** the project holds `PY-1` with `paths: ["**/*.py"]` and `stages: [plan]`, the work tree holds no `.py` file, and a `verifier` package is built for the plan
- **THEN** the package does not record `PY-1`; after an untracked, not ignored `tools/gen.py` is created, the next package for the plan records it

### Requirement: Stage readers

The kernel SHALL hold one table that names the readers of each rule stage, and every selection SHALL go through it, so the reader that writes in a stage and the reader that checks it read the same rules. The stages are the pipeline stages that read rules (`kernel-pipeline`, Pipeline file); `intent` and `close` read none.

| Stage     | Session skills (`ctx skill`) | Pipeline nodes             | Roles                                             |
| --------- | ---------------------------- | -------------------------- | ------------------------------------------------- |
| `design`  | `design`, `adr`              | nodes with `stage: design` | `design-verifier`                                 |
| `plan`    | `plan`                       | nodes with `stage: plan`   | `verifier`                                        |
| `execute` | none                         | none                       | `implementer`, `simplifier`                       |
| `review`  | none                         | none                       | `reviewer`, `integration-reviewer`, `pr-reviewer` |

A node of stage `execute` or `review` gets no rules in its instruction: the session only dispatches there, and the agents read their rules through their packages (`kernel-pipeline`, Instruction). `runner`, `scout`, `lead` and `judge` have no stage and read no rules; the judge reads only the rules an entry cites, by id. No table keyed by rule prefix or pack category decides who reads a rule: a rule's `stages` and `paths` are the whole answer (`kernel-state`, Rule file frontmatter).

#### Scenario: writer and checker read the same rules

- **WHEN** the project holds `PLN-1` with `paths: ["**"]` and `stages: [plan]`, and `bdk ctx skill plan` runs and a `verifier` package is built for the plan artifact
- **THEN** both hold `PLN-1`, and the rule ids of the skill's `rules` part equal the ids the package records, in the same order

#### Scenario: role without a stage

- **WHEN** `bdk rules show --role runner --file src/app.ts --json` runs
- **THEN** the exit code is 0 and `rules` is empty

#### Scenario: the judge reads no stage rules

- **WHEN** `bdk rules show --role judge --file src/app.ts --json` runs
- **THEN** the exit code is 0 and `rules` is empty
