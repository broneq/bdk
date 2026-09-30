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

Check the rule files of the bundle and the project: unique ids, `[PREFIX-n]` format, the frontmatter schema, `source` / `verified` on knowledge rules, tombstones and `rules.disabled`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules check [<path>]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<path>` (optional). A rule file or a directory; default `.bdk/rules/` together with the bundle's pack under `rules/`.
- **Behaviour:** Every rule file is validated against the rule frontmatter (`kernel-state`, Rule file frontmatter): the `id` equals the file name without `.md`; a bundle rule's id starts with `BDK-` and a project rule's id never does; a `kind: knowledge` rule carries `source` and `verified`; a tombstone (`removed` set) keeps its id and its body. Across the bundle and `.bdk/rules/` together no id appears twice, which catches the duplicate two parallel Changes can create (V1-6); the later file renumbers, since numbers are never reused. Every id in `rules.disabled` must name an existing rule (`unknown-disabled-id`). With problems it exits 2 with the refusal of the first problem's rule (`policy/duplicate-rule-id` before `policy/rule-format`): `why` names the first file, its line and the count of further problems, and `instead` names the file to fix, as `config check` does. Without problems it exits 0 with `valid: true` and the counts. Green on CI is the T31 acceptance signal.
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-check.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/rule-format`, `policy/duplicate-rule-id`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules check --json
  ```

  ```json
  {
    "valid": true,
    "rules": 87,
    "bundle": 81,
    "project": 6,
    "tombstones": 1
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules check --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-check.json`

#### Scenario: input/not-found

- **WHEN** `<path>` names a file or directory that does not exist
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/rule-format

- **WHEN** a rule's `id` differs from its file name, or a `kind: knowledge` rule lacks `source` or `verified` (T5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format` naming the file

#### Scenario: policy/duplicate-rule-id

- **WHEN** `.bdk/rules/API-3.md` exists on two merged branches with different bodies and a third file also declares `id: API-3`
- **THEN** the exit code is 2 and the error object carries `rule: policy/duplicate-rule-id` naming both files

#### Scenario: project rule with the bundle prefix

- **WHEN** `.bdk/rules/BDK-CQ-9.md` exists
- **THEN** the exit code is 2 with `rule: policy/rule-format`, because `BDK-` ids belong to the bundle

#### Scenario: unknown disabled id

- **WHEN** `rules.disabled` holds `BDK-CQ-99` and no such rule exists
- **THEN** the exit code is 2 with `rule: policy/rule-format` and the problem code `unknown-disabled-id`

#### Scenario: shipped pack is valid

- **WHEN** CI runs `bdk rules check` in the BDK repository
- **THEN** the exit code is 0

### Requirement: bdk rules show

Print one rule by id, or the rules selected for a ticket. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules show <id>|--ticket <ticket>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped with `--ticket`
- **Arguments:**
  - `<id>`. A rule id, e.g. `BDK-CQ-4` or `API-2`. Exactly one of `<id>` and `--ticket`.
  - `--ticket <ticket>`. Print the rules selected for the ticket's active package.
- **Behaviour:** With `<id>`, prints the rule's frontmatter and text; a tombstone prints its id and `removed: <reason>` and exits 0; a disabled rule prints with `disabled: true`. With `--ticket`, the ticket must be open and have a dispatch package (`policy/no-open-ticket` otherwise), and the kernel prints the rules whose ids the active package records in its `rules` field (`kernel-state`, Dispatch package), in that order, each with its id, `kind`, `severity`, `applies` and the glob that matched. **Selection**, performed by `dispatch build` and exposed by `rules explain`: the candidates are every non-tombstone rule of the bundle and of `.bdk/rules/` that is not in `rules.disabled`, where a bundle rule under `rules/languages/<name>/` is a candidate only when `<name>` is in `languages`; a candidate is read by the role when its `roles` names the role, or, without `roles`, when its prefix is in the role's set held in the kernel (`implementer`, `simplifier`, `reviewer`, `pr-reviewer`: `CQ`, `ARCH`, `DP`, `SEC`, `TQ` and the language prefixes; `verifier`: `ARCH`, `TQ`, `EJ`, `PL`; `design-verifier`: `ARCH`, `EJ`, `SEC`; `runner`, `scout`: none), a project rule without `roles` being read by every role except `runner` and `scout`; the target's file set is the task's `Files:` for a task, the union of its tasks' `Files:` for a part, and none for an artifact or the Change; a rule without `applies` always applies, a rule with `applies` applies when any file of the set matches any of its globs (repository-relative, `**` crosses directories), and every rule applies when there is no file set. Order: rules without `applies` first, then by the specificity of the matched glob (more literal path segments first, then more literal characters), then by `since`, then by id. Every applying rule is selected: there is no cap, because a configured rule the agent never sees fails silently; `hooks session-start` warns when a role reads more than `rules.warn-above` rules instead (`kernel-cli/hooks`). The first `--ticket` call made while the ticket's active package is its `implementer` package stamps `rules-read` in its attempt record (`kernel-state`, Attempt record); later calls print the same rules and leave the stamp alone, and a call under another role's package stamps nothing, so a `simplifier` or `runner` reading its rules never hides an implementer that read none (risk R2).
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

### Requirement: bdk rules explain

Which rules apply to a file for a role, and why. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules explain <file> [--role implementer|simplifier|reviewer|pr-reviewer|verifier|design-verifier]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<file>` (required). A path inside the repository; it need not exist, so a planned file can be explained.
  - `--role <role>`. Default `implementer`.
- **Behaviour:** The selection of `rules show --ticket` for a file set of one file and the given role, exposed for humans; each rule carries the glob that matched (`null` for a global rule). Disabled rules are listed separately with `disabled: true`, so a user sees why a rule is missing.
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-explain.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules explain src/api/login.ts --role reviewer --json
  ```

  ```json
  {
    "file": "src/api/login.ts",
    "role": "reviewer",
    "rules": [
      {
        "id": "BDK-CQ-1",
        "matchedBy": null,
        "kind": "house"
      },
      {
        "id": "API-1",
        "matchedBy": "src/api/**",
        "kind": "house"
      }
    ],
    "disabled": [
      "BDK-SEC-3"
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules explain src/api/login.ts --role reviewer --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-explain.json`

#### Scenario: input/not-found

- **WHEN** `<file>` resolves outside the repository
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: same selection as dispatch

- **WHEN** a task's `Files:` is exactly `src/api/login.ts` and its `reviewer` package is built
- **THEN** the package's `rules` equals the ids `rules explain src/api/login.ts --role reviewer` lists, in the same order

### Requirement: bdk rules prune

List rules whose globs match no file or that no Change cited in the last N Changes. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules prune [--uncited <n>]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--uncited <n>`. The number of most recent Changes (by creation time, archived ones included) to look back; default `rules.prune.uncited-changes`.
- **Behaviour:** Reports only; removal is a manual edit that sets `removed` and leaves a tombstone. Two reasons: `no-match`, a rule with `applies` none of whose globs matches a file git tracks or would add (untracked files that are not ignored); `uncited`, a rule no entry of the last `<n>` Changes names in its `refs` (`rules stats` counts the same refs), reported only once the project has at least `<n>` Changes. Tombstones and disabled rules are skipped. Bundle rules are reported like project rules; the user disables them with `rules.disabled`.
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-prune.json`
- **Exit codes and rules:** `0, 3, 4, 5`. Specific rules: `state/corrupted-index`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules prune --json
  ```

  ```json
  {
    "items": [
      {
        "id": "API-3",
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

#### Scenario: glob matching nothing

- **WHEN** `.bdk/rules/API-3.md` has `applies: [legacy/**]` and no tracked file lives under `legacy/`
- **THEN** `rules prune` lists `API-3` with reason `no-match`

#### Scenario: state/corrupted-index

- **WHEN** the SQLite index cannot be opened or disagrees with the files after a lazy rebuild
- **THEN** the exit code is 4 and the error object carries `rule: state/corrupted-index`

### Requirement: bdk rules import

Import a project's `.claude/rules/*.md` into `.bdk/rules/`, one rule per top-level bullet, with `applies` from `paths:`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules import [<dir>] [--dry-run] [--prefix <PREFIX>]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<dir>` (optional). Default `.claude/rules/`.
  - `--dry-run`. Report what would be written; write nothing.
  - `--prefix <PREFIX>`. Override the prefix derived from the file name; only with a single file in `<dir>` or a file path.
- **Behaviour:** For each `*.md` file, subdirectories included: the prefix is the file name without `.md`, uppercased, with every run of characters outside `[A-Z0-9]` turned into `-` and trimmed (`api-style.md` becomes `API-STYLE`), unless `--prefix`; each top-level bullet of the body becomes one rule with the next free number of its prefix, and a file without top-level bullets becomes one rule holding its body; `applies` is the file's `paths:` frontmatter, and a file without `paths:` gives global rules (no `applies`); every imported rule has `kind: house`, `severity: medium`, `origin: import` and `since` set to today. Skipped with a reason: the generated projection (`bdk-generated*.md`), a file whose frontmatter already carries an `id`, an empty file, a file whose name yields no valid project prefix (rerun it with `--prefix`), and a file whose `paths:` fails the rule schema. The import never judges content; the user edits or tombstones what is not a rule (`rule-pack`, What a rule is). The output lists every imported file with its rule ids, every skipped file with the reason, `dryRun`, and the projection files rewritten. After a write it regenerates the projection as `rules export --claude` does; the imported source files stay, and the user removes them since the projection now carries their rules. Also run by `import` for the v2 cut.
- **Writes:** `.bdk/rules/`, `.claude/rules/bdk-generated.md`, `.claude/rules/bdk-generated-scoped.md`
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
        "from": ".claude/rules/api-style.md",
        "rules": [
          "API-STYLE-1",
          "API-STYLE-2"
        ],
        "applies": [
          "src/api/**"
        ]
      }
    ],
    "skipped": [
      {
        "from": ".claude/rules/bdk-generated.md",
        "why": "generated by rules export"
      }
    ],
    "dryRun": false,
    "projection": [
      ".claude/rules/bdk-generated-scoped.md"
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules import --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-import.json`

#### Scenario: input/not-found

- **WHEN** `<dir>` does not exist
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/rule-format

- **WHEN** `--prefix` is given a value that is not `[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*`, or is `BDK` or starts with `BDK-`
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format`

#### Scenario: policy/duplicate-rule-id

- **WHEN** `.bdk/rules/` already holds rules whose ids collide with the numbers the import would assign because `rules check` fails before the import
- **THEN** the exit code is 2, the error object carries `rule: policy/duplicate-rule-id`, and nothing is written

#### Scenario: file without paths

- **WHEN** `.claude/rules/naming.md` has no frontmatter and two top-level bullets
- **THEN** the import writes `NAMING-1` and `NAMING-2` without `applies`

### Requirement: bdk rules stats

The audit view: recurring items across Changes, the raw findings and learnings to group by meaning, and citations by rule id, from the index. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules stats [--min-changes <n>] [--entries] [--all]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--min-changes <n>`. Default `rules.audit.min-changes`.
  - `--entries`. Add the raw item list.
  - `--all`. Lift the 100-item limit of `entries`.
- **Behaviour:** Reads every Change the index holds, archived ones included. `recurring`: each fingerprint of a `learning` entry or an attempt finding (`kernel-state`, Fingerprints) seen in at least `<n>` distinct Changes, with the count of Changes, of occurrences, the Change ids and one summary; occurrences inside one Change count as one Change. `entries` (with `--entries`): every `learning`, `finding` and `blocker` entry and every attempt finding, newest first, as a page (`items`, `total`, `truncated`), each with its qualified id, type, summary, refs, `applies` and `evidence` when present, and whether a rule's `origin` or `evidence` already names it (`adopted`); the list is the input of the audit skill, which groups items by meaning, because a fingerprint only groups near-identical wording. `citations`: for each rule id, the number of entries naming it in `refs` and the number of distinct Changes, rules never cited included with zero. Nothing is proposed or written: adoption is `rules accept`.
- **Writes:** nothing
- **Output:** `schema/cli/output/rules-stats.json`
- **Exit codes and rules:** `0, 3, 4, 5`. Specific rules: `state/corrupted-index`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules stats --json
  ```

  ```json
  {
    "minChanges": 3,
    "recurring": [
      {
        "fingerprint": "sha256:9f2c...",
        "summary": "scoped test run missed the negative case",
        "changes": 3,
        "occurrences": 5,
        "changeIds": [
          "2026-09-25-passwordless-login",
          "2026-09-27-export-csv",
          "2026-09-29-audit-log"
        ]
      }
    ],
    "citations": [
      {
        "id": "BDK-CQ-4",
        "entries": 12,
        "changes": 4
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

#### Scenario: below the threshold

- **WHEN** one learning's fingerprint appears three times inside one Change and once in another, and `rules.audit.min-changes` is 3
- **THEN** `recurring` does not list it

#### Scenario: at the threshold

- **WHEN** the same learning's fingerprint appears in three distinct Changes, one of them archived
- **THEN** `recurring` lists it with `changes: 3`, and no file under `.bdk/rules/` changes

#### Scenario: entries for grouping by meaning

- **WHEN** `bdk rules stats --entries --json` runs in a project whose archive holds findings worded differently
- **THEN** `entries` lists each of them with its qualified id and summary, newest first, at most 100 without `--all`

### Requirement: bdk rules export

Generate the host projection of the project's rules, `.claude/rules/bdk-generated.md` and `.claude/rules/bdk-generated-scoped.md`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules export [--claude] [--check]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `--claude`. Target Claude Code (the only target in 3.0).
  - `--check`. Exit 2 when the committed projection is out of date; write nothing.
- **Behaviour:** Projects the enabled, non-tombstone rules of `.bdk/rules/` only; the bundle's `BDK-*` pack reaches agents through their packages and is never projected into the main session. `bdk-generated.md` holds the global rules and has no `paths:`; `bdk-generated-scoped.md` holds the rules with `applies` and carries `paths:` equal to the sorted union of their `applies`; each rule appears as `- [<id>] <text>`, a scoped one followed by ` (applies: <globs>)` so the model sees its own scope inside the union, ordered by id, and a file with no rules is not written (an existing one is deleted). Both files start with a generated-file marker naming `bdk rules export` and are never edited by hand. `rules accept` and `rules import` regenerate them; a hand edit of `.bdk/rules/` is caught by `--check`, the CI form.
- **Writes:** `.claude/rules/bdk-generated.md`, `.claude/rules/bdk-generated-scoped.md`
- **Output:** `schema/cli/output/rules-export.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/rule-format`, `policy/generated-drift`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules export --claude --json
  ```

  ```json
  {
    "files": [
      {
        "path": ".claude/rules/bdk-generated.md",
        "rules": 4,
        "changed": false
      },
      {
        "path": ".claude/rules/bdk-generated-scoped.md",
        "rules": 2,
        "paths": [
          "src/api/**",
          "web/**/*.tsx"
        ],
        "changed": true
      }
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules export --claude --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-export.json`

#### Scenario: policy/rule-format

- **WHEN** a project rule fails the checks of `rules check`
- **THEN** the exit code is 2, the error object carries `rule: policy/rule-format`, and nothing is written

#### Scenario: policy/generated-drift

- **WHEN** `.bdk/rules/API-1.md` was edited by hand after the last export and `bdk rules export --claude --check` runs
- **THEN** the exit code is 2 with `rule: policy/generated-drift` and no file changes

#### Scenario: paths equal the union of applies

- **WHEN** the project has `API-1` with `applies: [src/api/**]`, `UI-2` with `applies: [web/**/*.tsx, src/api/**]` and `NAMING-1` without `applies`
- **THEN** `bdk-generated-scoped.md` carries `paths: [src/api/**, web/**/*.tsx]` and holds `API-1` and `UI-2`, and `bdk-generated.md` holds `NAMING-1` without `paths:`

### Requirement: bdk rules accept

Adopt a rule: the user's explicit decision, the only path by which a rule file is created outside an import. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rules accept <text> --prefix <PREFIX> [--kind house|knowledge] [--severity critical|high|medium|low] [--applies <glob>] [--role <role>] [--from <ref>] [--source <text>] [--verified <date>]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<text>` (required). The rule text, one choice stated as an instruction; `-` reads it from stdin.
  - `--prefix <PREFIX>` (required). An existing or new project prefix; never `BDK`.
  - `--kind house|knowledge`. Default `house`.
  - `--severity critical|high|medium|low`. Default `medium`.
  - `--applies <glob>`. Repeatable; absent means global.
  - `--role <role>`. Repeatable; absent means the default of project rules.
  - `--from <ref>`. Repeatable; a qualified entry id (`<changeId>/L-...`) or attempt finding the rule comes from.
  - `--source <text>`, `--verified <date>`. Required with `--kind knowledge` and refused without it (`policy/rule-format`).
- **Behaviour:** Writes `.bdk/rules/<PREFIX>-<n>.md` where `<n>` is one above the highest number of the prefix, tombstones included, so a number is never reused; `origin` is the first `--from` ref, or `user` without one, and `evidence` holds every `--from` ref; `since` is today. Every `--from` ref must resolve in the index (`input/not-found`). Runs no model and proposes nothing: the audit skill (T42) calls it only after the user accepted the proposal, and the orchestrator-only guard keeps subagents from calling it (T3). Then regenerates the projection as `rules export --claude` does. Works without an active Change, because the audit runs in its own session. No other command or hook writes a rule file (`kernel-state`, Write map).
- **Writes:** `.bdk/rules/`, `.claude/rules/bdk-generated.md`, `.claude/rules/bdk-generated-scoped.md`
- **Output:** `schema/cli/output/rules-accept.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/rule-format`, `policy/duplicate-rule-id`, `state/corrupted-index`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rules accept "Write paths go through command handlers; queries never mutate (CQRS)." --prefix ARCHP --applies "src/**" --from 2026-09-25-passwordless-login/L-m2x9v7qa --json
  ```

  ```json
  {
    "id": "ARCHP-1",
    "path": ".bdk/rules/ARCHP-1.md",
    "origin": "2026-09-25-passwordless-login/L-m2x9v7qa",
    "projection": [
      ".claude/rules/bdk-generated-scoped.md"
    ]
  }
  ```

- **Owner:** T31
- **Slice:** `rules`

#### Scenario: example run

- **WHEN** `bdk rules accept ... --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rules-accept.json`

#### Scenario: input/not-found

- **WHEN** `--from` names an entry the index does not hold
- **THEN** the exit code is 3, the error object carries `rule: input/not-found`, and nothing is written

#### Scenario: policy/rule-format

- **WHEN** `--kind knowledge` is given without `--verified`, or `--prefix BDK`
- **THEN** the exit code is 2 and the error object carries `rule: policy/rule-format`

#### Scenario: policy/duplicate-rule-id

- **WHEN** `rules check` already fails with a duplicate id for the prefix
- **THEN** the exit code is 2, the error object carries `rule: policy/duplicate-rule-id`, and nothing is written

#### Scenario: state/corrupted-index

- **WHEN** the SQLite index cannot be opened while `--from` refs are resolved
- **THEN** the exit code is 4 and the error object carries `rule: state/corrupted-index`

#### Scenario: numbers are never reused

- **WHEN** the project holds `API-1`, the tombstone `API-2` and `API-3`, and `rules accept ... --prefix API` runs
- **THEN** it writes `API-4`

#### Scenario: subagent cannot adopt

- **WHEN** a subagent runs `bdk rules accept ...` through Bash
- **THEN** the `pre-tool` hook denies the call and no rule file is written
