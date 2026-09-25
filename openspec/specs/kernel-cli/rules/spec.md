# kernel-cli/rules Specification

## Purpose

Rules and the learning funnel (`rules`). House and knowledge rules with `[PREFIX-n]` ids (T5) and the learning funnel of T31: `check`, `show`, `explain`, `prune`, `stats` read; `add`, `import`, `export` write.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/duplicate-rule-id",
  "why": "[API-3] is defined in .bdk/rules/api.md:9 and .bdk/rules/api-legacy.md:4",
  "instead": [
    "renumber the later rule to [API-7]; numbers are never reused",
    "bdk rules check"
  ]
}
```

## Requirements

### Requirement: bdk rules check

Check rule files: unique ids, `[PREFIX-n]` format, `source` / `verified` on knowledge rules, tombstones. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules check [<path>]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<path>` (optional). A rule file or directory; default .bdk/rules/ and the bundle's rules.
- **Behaviour:** Green on CI is the T31 acceptance signal. Detects the duplicate a parallel close can introduce (V1-6); the later Change renumbers, numbers are never reused.
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-check.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/rule-format`, `policy/duplicate-rule-id`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules check --json
  ```

  ```json
  {
    "valid": false,
    "rules": 41,
    "problems": [
      {
        "file": ".bdk/rules/api.md",
        "line": 9,
        "code": "duplicate-id",
        "message": "[API-3] also defined in .bdk/rules/api-legacy.md:4 (parallel close?)"
      }
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules check --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-check.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/rule-format

- **WHEN** a rule lacks its `[PREFIX-n]`, or a `knowledge` rule with a fact lacks `source` / `verified` (T5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format`

#### Scenario: policy/duplicate-rule-id

- **WHEN** two rules carry the same id, typically after a parallel close (V1-6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/duplicate-rule-id`

### Requirement: bdk rules show

Print one rule by id. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules show <id>`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<id>` (required). PREFIX-n, e.g. CQ-4.
- **Behaviour:** A removed rule prints its tombstone (`removed: <reason>`).
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-show.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules show CQ-4 --json
  ```

  ```json
  {
    "rule": {
      "id": "CQ-4",
      "file": "rules/code-quality.md",
      "kind": "house",
      "text": "Early return over nested conditionals.",
      "applies": [
        "**/*.ts"
      ]
    },
    "citedBy": 12
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules show CQ-4 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-show.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk rules add

Propose a rule from work in progress: writes a learning entry with applies globs; no rule file changes. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules add <text> [--applies <glob>] [--kind house|knowledge] [--accept <entry>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<text>` (required).
  - `--applies <glob>`. Repeatable; default derived from the current task's files.
  - `--kind house|knowledge`.
  - `--accept <entry>`. Accept a routed learning entry into .bdk/rules/ and assign its id (the manual accept of the funnel).
- **Behaviour:** Two forms. Without `--accept`: a `learning` entry with `fingerprint`, `applies` and `evidence` (T02 decision R-3, Q-4); it competes for adoption through `log route` at close. With `--accept <entry>`: the user's explicit adoption, which writes the rule under `.bdk/rules/` with the next number for its prefix and `kind`, `source` and `verified` when `knowledge`. No automation ever takes the second path.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/rules/`
- **Output:** `schema/cli/output/rules-add.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/rule-format`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules add "Scoped test runs must include the negative case" --applies "**/*.test.ts" --json
  ```

  ```json
  {
    "entry": "L-z1c4h"
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules add "Scoped test runs must include the negative case" --applies "**/*.test.ts" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-add.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/rule-format

- **WHEN** a rule lacks its `[PREFIX-n]`, or a `knowledge` rule with a fact lacks `source` / `verified` (T5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format`

### Requirement: bdk rules explain

Which rules apply to a file, and why. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules explain <file> [--role worker|reader|reviewer|verifier|runner]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<file>` (required).
  - `--role worker|reader|reviewer|verifier|runner`.
- **Behaviour:** The same selection `dispatch build` performs for a task's `Files:`, exposed for humans.
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-explain.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules explain src/auth/login.ts --role reviewer --json
  ```

  ```json
  {
    "file": "src/auth/login.ts",
    "rules": [
      {
        "id": "SEC-2",
        "matchedBy": "src/auth/**",
        "kind": "house"
      },
      {
        "id": "CQ-4",
        "matchedBy": "**/*.ts",
        "kind": "house"
      }
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules explain src/auth/login.ts --role reviewer --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-explain.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk rules prune

List rules whose globs match no file or that no Change cited in the last N closes. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules prune [--uncited <n>]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--uncited <n>`. Changes without a citation; default from policy.
- **Behaviour:** Reports only; removal is a manual edit that leaves a tombstone.
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-prune.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules prune --json
  ```

  ```json
  {
    "items": [
      {
        "id": "DP-3",
        "reason": "no-match",
        "detail": "applies: [\"legacy/**\"] matches 0 files"
      }
    ],
    "total": 1,
    "truncated": false
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules prune --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-prune.json`

### Requirement: bdk rules import

Import a project's `.claude/rules/*.md` into `.bdk/rules/` with ids and applies from paths. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules import [<dir>] [--dry-run] [--prefix <PREFIX>]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<dir>` (optional). Default .claude/rules/.
  - `--dry-run`.
  - `--prefix <PREFIX>`. Override the prefix derived from the file name.
- **Behaviour:** Id from the file name, `applies` from the `paths:` frontmatter (T02 decision R-3). Also run by `import` for the v2 cut.
- **Writes:** `.bdk/rules/`
- **Output:** `schema/cli/output/rules-import.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/rule-format`, `policy/duplicate-rule-id`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules import --json
  ```

  ```json
  {
    "imported": [
      {
        "from": ".claude/rules/fragment-system.md",
        "to": ".bdk/rules/fragment-system.md",
        "rules": 6,
        "prefix": "FRAG"
      }
    ],
    "skipped": [
      {
        "from": ".claude/rules/bdk-generated.md",
        "why": "generated by rules export"
      }
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules import --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-import.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/rule-format

- **WHEN** a rule lacks its `[PREFIX-n]`, or a `knowledge` rule with a fact lacks `source` / `verified` (T5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format`

#### Scenario: policy/duplicate-rule-id

- **WHEN** two rules carry the same id, typically after a parallel close (V1-6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/duplicate-rule-id`

### Requirement: bdk rules stats

Recurrence by fingerprint and citations by rule id, from the index. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules stats [--all]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--all`.
- **Behaviour:** The evidence view behind the learning funnel thresholds (T02 decision Q-4).
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-stats.json`
- **Exit codes and rules:** `0, 3, 4, 5`. Specific rules: `state/corrupted-index`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules stats --json
  ```

  ```json
  {
    "learning": [
      {
        "fingerprint": "tests|scoped|missing-negative-case",
        "changes": 3,
        "authors": 2,
        "cost": 2
      }
    ],
    "citations": [
      {
        "id": "CQ-4",
        "count": 12
      }
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules stats --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-stats.json`

#### Scenario: state/corrupted-index

- **WHEN** the SQLite index cannot be opened or disagrees with the files after a lazy rebuild
- **THEN** the exit code is 4 and the error object carries `rule: state/corrupted-index`

### Requirement: bdk rules export

Generate the host projection of the rules, `.claude/rules/bdk-generated.md`, with `paths:` from applies. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules export [--claude] [--check]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `--claude`. Target Claude Code (the only target in 3.0).
  - `--check`. Exit 2 when the committed projection is out of date; write nothing.
- **Behaviour:** The file is marked generated and never edited by hand; `change close` regenerates it. `--check` is the CI form.
- **Writes:** `.claude/rules/bdk-generated.md`
- **Output:** `schema/cli/output/rules-export.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/rule-format`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules export --claude --json
  ```

  ```json
  {
    "path": ".claude/rules/bdk-generated.md",
    "rules": 41,
    "changed": true
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules export --claude --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-export.json`

#### Scenario: policy/rule-format

- **WHEN** a rule lacks its `[PREFIX-n]`, or a `knowledge` rule with a fact lacks `source` / `verified` (T5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format`
