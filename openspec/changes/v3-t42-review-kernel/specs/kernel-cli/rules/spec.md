## MODIFIED Requirements

### Requirement: bdk rules show

Print one rule by id, or the rules selected for a ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules show <id>|--ticket <ticket>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped with `--ticket`
- **Arguments:**
  - `<id>`. A rule id, e.g. `BDK-CQ-4` or `API-2`. Exactly one of `<id>` and `--ticket`.
  - `--ticket <ticket>`. Print the rules selected for the ticket's active package, or for `<ticket>@<group>` the group's package (`kernel-cli`, Ticket references).
- **Behaviour:** With `<id>`, prints the rule's frontmatter and text; a tombstone prints its id and `removed: <reason>` and exits 0; a disabled rule prints with `disabled: true`. With `--ticket`, the ticket must be open and have a dispatch package, or the group must have one (`policy/no-open-ticket` otherwise), and the kernel prints the rules whose ids that package records in its `rules` field (`kernel-state`, Dispatch package), in that order, each with its id, `kind`, `severity`, `applies` and the glob that matched. **Selection**, performed by `dispatch build` and exposed by `rules explain`: the candidates are every non-tombstone rule of the bundle and of `.bdk/rules/` that is not in `rules.disabled`, where a bundle rule under `rules/languages/<name>/` is a candidate only when `<name>` is in `languages`; a candidate is read by the role when its `roles` names the role, or, without `roles`, when its prefix is in the role's set held in the kernel (`implementer`, `simplifier`, `reviewer`, `pr-reviewer`: `CQ`, `ARCH`, `DP`, `SEC`, `TQ` and the language prefixes; `verifier`: `ARCH`, `TQ`, `EJ`, `PL`; `integration-reviewer`: `ARCH`, `SEC`, `TQ`; `design-verifier`: `ARCH`, `EJ`, `SEC`; `runner`, `scout`, `lead`: none), a project rule without `roles` being read by every role except `runner`, `scout` and `lead`; the target's file set is the task's `Files:` for a task, the union of its tasks' `Files:` for a part, and none for an artifact or the Change; a grouped package uses its group's file set instead (`kernel-cli/dispatch`, bdk dispatch build, Groups); a rule without `applies` always applies, a rule with `applies` applies when any file of the set matches any of its globs (repository-relative, `**` crosses directories), and every rule applies when there is no file set. Order: rules without `applies` first, then by the specificity of the matched glob (more literal path segments first, then more literal characters), then by `since`, then by id. Every applying rule is selected: there is no cap, because a configured rule the agent never sees fails silently; `hooks session-start` warns when a role reads more than `rules.warn-above` rules instead (`kernel-cli/hooks`). The first `--ticket` call made while the ticket's active package is its `implementer` package stamps `rules-read` in its attempt record (`kernel-state`, Attempt record); later calls print the same rules and leave the stamp alone, and a call under another role's package stamps nothing, so a `simplifier` or `runner` reading its rules never hides an implementer that read none (risk R2).
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
        "matchedBy": null,
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

- **WHEN** `languages` is `[typescript, react]`, the project has `API-1` with `applies: [src/api/**]`, and packages are built for an `implementer` ticket of a task whose `Files:` is `web/Form.tsx` and for a `verifier` ticket of the same part
- **THEN** the implementer's rules hold the `CQ`, `ARCH`, `DP`, `SEC`, `TQ`, `TS` and `REACT` rules that apply to `web/Form.tsx` and not `API-1`, and the verifier's rules hold only `ARCH`, `TQ`, `EJ` and `PL` rules

#### Scenario: project override applies

- **WHEN** `rules.disabled` holds `BDK-SEC-3`, the project holds `SECP-1` without `applies`, and a `reviewer` package is built
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

- **WHEN** an `integration-reviewer` package is built without `--file`
- **THEN** its rules hold every enabled `ARCH`, `SEC` and `TQ` rule and no `CQ` or `DP` rule
