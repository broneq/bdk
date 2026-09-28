## MODIFIED Requirements

### Requirement: bdk rebuild

Rebuild the index and the derived progress from committed files and git trailers. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rebuild [--all]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--all`. Every Change, not only the active one.
- **Behaviour:** The mandatory repair path behind every exit 4 (Q3), and the step that makes a fresh clone or another machine resume (S5). For each Change in scope, in this order: migrates committed documents whose `schema` is older than the kernel's (`kernel-state`, Schema versions and migrations), leaving a document without a migration path or newer than the kernel unchanged and listing it in `warnings`; drops the Change's rows from the index and re-reads every committed file except those listed in `warnings`; regenerates `plan/index.md` and `design/index.md` from their parts; reads the trailer commits of the Change and checks them against the plan and the attempt records (`kernel-loops`, Progress from git). Progress comes from trailers, attempts and budgets from the committed `attempts/` records, entries from `log/`; budgets never reset silently. A genuine inconsistency is reported as `state/trailer-mismatch` naming both sides, never papered over; the index and the regenerated files are still written, so `rebuild` can be re-run after the user repairs the history. A ledger file that fails validation is `state/ledger-invalid` naming the file. `changes`, `entries`, `attempts` and `commits` count what was read; `migrated` lists rewritten files. Like every Change-scoped command it needs the active Change (`policy/no-active-change`); `--all` widens the rebuild to every Change directory of the project. A fresh clone has no branch marker yet, so `change resume <id>` binds the branch first and `rebuild` follows.
- **Writes:** `.bdk/.machine/`, `.bdk/changes/<id>/`, `.bdk/rules/`
- **Output:** `schema/cli/output/rebuild.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk rebuild --json
  ```

  ```json
  {
    "changes": 1,
    "entries": 38,
    "attempts": 6,
    "commits": 9,
    "migrated": [],
    "durationMs": 412,
    "warnings": []
  }
  ```

- **Owner:** T22
- **Slice:** `service`

#### Scenario: example run

- **WHEN** `bdk rebuild --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/rebuild.json`

#### Scenario: fresh clone resumes

- **WHEN** a repository is cloned, so `.bdk/.machine/` holds no marker, and `bdk change resume <id>` then `bdk rebuild --json` run
- **THEN** both exit 0, and `part list` and `attempt list` answer as in the original repository

#### Scenario: state/trailer-mismatch

- **WHEN** progress derived from git trailers disagrees with the committed attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: repair after a corrupted index

- **WHEN** `.bdk/.machine/index.sqlite` is deleted and a stale `plan/index.md` was committed, and `bdk rebuild --json` runs
- **THEN** the exit code is 0, `plan/index.md` equals the index regenerated from the parts, and `attempt list`, `part list` and `log list` answer as before the deletion

#### Scenario: older document migrated

- **WHEN** a committed document carries a `schema` one below the kernel's and a migration is registered
- **THEN** `bdk rebuild` rewrites it at the current version, lists it in `migrated`, and the next Change-scoped command exits 0
