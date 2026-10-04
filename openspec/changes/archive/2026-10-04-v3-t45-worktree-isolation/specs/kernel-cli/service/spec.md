## MODIFIED Requirements

### Requirement: bdk rebuild

Rebuild the index and the derived progress from committed files and git trailers. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rebuild [--all]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--all`. Every Change, not only the active one.
- **Behaviour:** The mandatory repair path behind every exit 4 (Q3), and the step that makes a fresh clone or another machine resume (S5). For each Change in scope, in this order: migrates committed documents whose `schema` is older than the kernel's (`kernel-state`, Schema versions and migrations), leaving a document without a migration path or newer than the kernel unchanged and listing it in `warnings`; drops the Change's rows from the index and re-reads every committed file except those listed in `warnings`; regenerates `plan/index.md` and `design/index.md` from their parts; reads the trailer commits of the Change and checks them against the plan and the attempt records (`kernel-loops`, Progress from git). Progress comes from trailers, attempts and budgets from the committed `attempts/` records, entries from `log/`; budgets never reset silently. A genuine inconsistency is reported as `state/trailer-mismatch` naming both sides, never papered over; the index and the regenerated files are still written, so `rebuild` can be re-run after the user repairs the history. A ledger file that fails validation is `state/ledger-invalid` naming the file. `changes`, `entries`, `attempts` and `commits` count what was read; `migrated` lists rewritten files. Like every Change-scoped command it needs the active Change (`policy/no-active-change`); `--all` widens the rebuild to every Change directory of the project. A fresh clone has no branch marker yet, so `change resume <id>` binds the branch first and `rebuild` follows.
  Worktree recovery (T45; `kernel-state`, Part worktree): `rebuild` then reads `git worktree list --porcelain` of the home checkout and the branches `bdk-part/<change id>/*` of each Change in scope, and settles each kernel worktree, one whose git directory holds the home marker: a worktree whose part is done, not started, or held by no part is removed with its branch once the branch is merged into home `HEAD` or holds no commit beyond the commit it started from; an unmerged branch of such a part is kept and reported in `warnings`, never deleted; a worktree of a live part is kept; a live part whose worktree directory is gone (a killed session, another machine) gets it back with `git worktree prune` and `git worktree add` on its existing branch, followed by the `.worktreeinclude` copy and the setup command as at `part start`, which is reported in `warnings` (a failed setup is reported there too, and the worktree stays for the user); a started worktree part with neither worktree nor branch is reported in `warnings` naming `bdk part start` after its start marker is closed by the user. Worktrees git lists without the home marker are the user's and never touched. `worktrees` lists each kernel worktree with `part`, `path` and `action` (`kept`, `removed`, `recreated`).
- **Writes:** `.bdk/.machine/`, `.bdk/changes/<id>/`, `.bdk/rules/`, `git:worktree`
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
    "warnings": [],
    "worktrees": []
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

#### Scenario: leftover worktree of a killed session

- **WHEN** a session died after `bdk part done 02` merged part 02 and before it removed the worktree, and `bdk rebuild --json` runs
- **THEN** the exit code is 0, `worktrees` lists part `02` with `action: removed`, and neither the worktree nor the branch `bdk-part/<change id>/02` exists

#### Scenario: live worktree kept

- **WHEN** worktree part `03` is live with one committed task and `bdk rebuild --json` runs
- **THEN** `worktrees` lists part `03` with `action: kept`, and the worktree and its commit are unchanged

#### Scenario: worktree recreated from its branch

- **WHEN** worktree part `03` is live, its directory was deleted by hand and its branch holds the commit of `03-1`
- **THEN** `bdk rebuild --json` lists part `03` with `action: recreated`, the worktree exists again on the branch, and `part list` shows part `03` with `done: 1`

#### Scenario: user's worktree untouched

- **WHEN** the user created a worktree with `git worktree add ../spike` and `bdk rebuild` runs
- **THEN** `../spike` and its branch are unchanged and `worktrees` does not list it
