# kernel-cli/rules delta

## MODIFIED Requirements

### Requirement: bdk rules show

Print one rule by id, or the rules of a ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules show <id>|--ticket <ticket>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped with `--ticket`
- **Arguments:**
  - `<id>`. PREFIX-n, e.g. CQ-4. Exactly one of `<id>` and `--ticket`.
  - `--ticket <ticket>`. Print the rules for the ticket's role and target.
- **Behaviour:** With `<id>`, prints one rule; a removed rule prints its tombstone (`removed: <reason>`). With `--ticket`, the ticket must be open and have a dispatch package (`policy/no-open-ticket` otherwise); the kernel prints, in order, the rule categories the role of the ticket's active package (`kernel-state`, Attempt record, `package`) maps to and then the language rules of every name in `languages` that has a `rules/languages/<name>` prompt value. The role-to-category map is held in the kernel: `implementer`, `simplifier`, `reviewer` and `pr-reviewer` get `code-quality`, `architecture`, `design-patterns`, `security` and `test-quality` plus the language rules; `verifier` gets `architecture`, `test-quality` and `engineering-judgment`; `design-verifier` gets `architecture`, `engineering-judgment` and `security`; `runner` and `scout` get none. Each section is the resolved prompt value `rules/<category>` (`kernel-settings`, Prompt values), so a project's `extends` or `replace` applies, and names its plugin file and the layers that changed it. Selection ignores the target's files and `applies` until T31 selects by rule id. The first `--ticket` call made while the ticket's active package is its `implementer` package stamps `rules-read` in its attempt record (`kernel-state`, Attempt record); later calls print the same text and leave the stamp alone, and a call under another role's package stamps nothing, so a `simplifier` or `runner` reading its rules never hides an implementer that read none (risk R2). The `<id>` form lands with T31 and answers `kernel/not-implemented` until then.
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
    "sections": [
      {
        "key": "rules/code-quality",
        "file": "rules/code-quality.md",
        "layers": [
          "default"
        ],
        "text": "# Code Quality Rules\n..."
      },
      {
        "key": "rules/languages/typescript",
        "file": "rules/languages/typescript.md",
        "layers": [
          "default",
          "project"
        ],
        "text": "# TypeScript\n..."
      }
    ],
    "rulesRead": "2026-09-25T10:00:41Z"
  }
  ```

- **Owner:** T23
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules show --ticket A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-show.json`

#### Scenario: input/not-found

- **WHEN** the ticket does not exist in the active Change
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket is closed or has no dispatch package
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: selection by role

- **WHEN** `languages` is `[typescript, react]` and `rules show --ticket` runs for a `verifier` ticket and for an `implementer` ticket
- **THEN** the verifier gets `architecture`, `test-quality` and `engineering-judgment` without language rules, and the implementer gets its five categories followed by `typescript` and `react`

#### Scenario: project override applies

- **WHEN** `.bdk/prompts/rules/security.md` extends the default and an `implementer` ticket's rules are shown
- **THEN** the `rules/security` section holds the plugin text followed by the project text and lists the layers `default` and `project`

#### Scenario: first read is stamped

- **WHEN** `rules show --ticket A-7f3k9m2q` runs twice
- **THEN** the attempt record of `A-7f3k9m2q` holds the `rules-read` time of the first call

#### Scenario: id form before T31

- **WHEN** `bdk rules show CQ-4` runs
- **THEN** the exit code is 2 and the error object carries `rule: kernel/not-implemented`

#### Scenario: simplifier read does not stamp

- **WHEN** the implementer of ticket `A-7f3k9m2q` never ran `rules show`, and after `dispatch build 02-3 simplifier A-7f3k9m2q` the simplifier runs `bdk rules show --ticket A-7f3k9m2q`
- **THEN** the simplifier gets the implementer's categories, the attempt record has no `rules-read`, and `attempt close A-7f3k9m2q ok` still writes the rules finding
