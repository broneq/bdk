# bdk-cli/git Specification

## Purpose

The `bdk git` command group: the range a review round covers (`scope`) and the reviewer groups of that range (`groups`), with the round record that lets a later round cover only the fixes since the last finished round. It computes what the review-round lead would otherwise derive from git by hand, deterministically, and never decides what the review does with it (spec `bdk-cli`).

## Requirements

### Requirement: Scope of a review round

`bdk git scope <base> [--rounds <dir>]` SHALL compute the range a review round covers and print it, writing nothing. The range SHALL be `<anchor>..HEAD`, committed history only. The anchor SHALL be:

- with `--rounds <dir>`, the `head` recorded by the last finished round under `<dir>` (Requirement: Round record), when that commit exists and is an ancestor of `HEAD` (`anchor.kind` `round`, `anchor.round` its number);
- otherwise the merge base of `HEAD` and `<base>` (`anchor.kind` `base`). When a finished round exists but its record is missing, invalid, names no commit, or names a commit that is not an ancestor of `HEAD` (as after a rebase), `anchor.fallback` SHALL say why the round was not used.

The result SHALL name `base` (the argument), `anchor` (`kind`, `sha`, and `round` or `fallback` when they apply), `head` (the full sha of `HEAD`), `range` (`<anchor sha>..<head>`), and these sorted, repository-relative path lists, each computed with renames split into a deletion and an addition:

- `files`: changed text files present at `HEAD`;
- `binary`: changed files that git counts as binary and that are present at `HEAD`; they belong to no group;
- `deleted`: files present at the anchor and absent at `HEAD`;
- `dirty`: tracked files whose working tree or index differs from `HEAD`, so the caller can commit them first; they do not change the range.

Paths SHALL be byte-exact (no quoting of unusual characters) and sorted by code unit. The same repository state and the same arguments SHALL give a byte-identical result.

#### Scenario: First round reviews from the merge base

- **WHEN** a branch holds three commits over `main` and `bdk git scope main --json` runs without `--rounds`
- **THEN** the exit code is 0, `anchor` is `{"kind": "base", "sha": <merge base of HEAD and main>}`, and `files` holds the text files the three commits changed

#### Scenario: Later round reviews only the fixes

- **WHEN** `<dir>/round-1/` holds `report.md` and a `groups.json` whose `head` is `H1`, one fix commit follows `H1`, and `bdk git scope main --rounds <dir> --json` runs
- **THEN** `anchor` is `{"kind": "round", "sha": H1, "round": 1}` and `files` holds only the files of the fix commit

#### Scenario: Rewritten history falls back to the merge base

- **WHEN** the last finished round recorded a `head` that is not an ancestor of `HEAD`
- **THEN** `anchor.kind` is `base`, `anchor.sha` is the merge base of `HEAD` and `<base>`, and `anchor.fallback` names the round and says its head is not an ancestor of `HEAD`

#### Scenario: Binary, deleted and uncommitted files are named apart

- **WHEN** the range adds `img/logo.png`, deletes `src/old.ts`, changes `src/a.ts`, and `src/b.ts` has an unstaged change
- **THEN** `binary` is `["img/logo.png"]`, `deleted` is `["src/old.ts"]`, `files` is `["src/a.ts"]` and `dirty` is `["src/b.ts"]`

#### Scenario: Nothing to review

- **WHEN** the anchor equals `HEAD`
- **THEN** the exit code is 0 and `files`, `binary` and `deleted` are empty

### Requirement: Round record

A round SHALL count as finished when its directory `<dir>/round-<N>/` (`N` a positive decimal integer without leading zeros) holds a file `report.md`. The last finished round SHALL be the finished round with the highest `N`; a round directory without `report.md`, as after a crash, SHALL be ignored, so a rerun of that round is anchored where its first run was. The commit a round reviewed SHALL be the `head` field of `<dir>/round-<N>/groups.json`, the file `bdk git groups --record <dir>/round-<N>` writes. `--rounds <dir>` naming a directory that does not exist SHALL mean that no round has finished.

#### Scenario: Crashed round is ignored

- **WHEN** `round-1/` holds `report.md` and `groups.json` with `head` `H1`, and `round-2/` holds `groups.json` but no `report.md`
- **THEN** `bdk git scope main --rounds <dir> --json` gives `anchor.round` 1 and `anchor.sha` `H1`

#### Scenario: Missing record falls back

- **WHEN** the last finished round holds `report.md` but no readable `groups.json` whose `head` is a full lowercase hexadecimal object name (40 digits, or 64 in a SHA-256 repository)
- **THEN** `anchor.kind` is `base` and `anchor.fallback` names the round and the missing or invalid record

#### Scenario: Same state, same groups

- **WHEN** `bdk git groups main --rounds <dir> --plan <parts> --json` runs twice on an unchanged repository and unchanged directories
- **THEN** both runs print byte-identical output

### Requirement: Review groups

`bdk git groups <base> [--rounds <dir>] [--plan <dir>] [--max-files <n>] [--record <round-dir>]` SHALL print the result of `bdk git scope` for the same `<base>` and `--rounds`, plus `groups`: the changed text files (`files`) split into reviewer groups, each with an `id`, a `kind` and its sorted `files`, in this order:

1. With `--plan <dir>`: one group per plan part with at least one changed text file, in the order of the part file names (`kind` `part`, `id` `p<NN>`, `part` `<NN>`). A part is a file `<dir>/<NN>.md` whose name is two or more decimal digits; its YAML frontmatter `files` lists repository-relative paths, matched exactly. A file listed by several parts SHALL go to the first of them. The changed text files no part lists SHALL form one group `unplanned` (`kind` `unplanned`).
2. Without `--plan`: the changed text files packed by module (`kind` `module`, `id` `m<k>`, `k` from 1).
3. Last, one group `integration` (`kind` `integration`) holding every changed text file.

A range with no changed text file SHALL have no groups.

Packing SHALL use the target `--max-files` (default 30, a positive integer) and the tolerance `floor(target * 4 / 3)`. A file's module is the first two segments of its directory (`src/auth` for `src/auth/login.ts`, `src` for `src/main.ts`, `.` for a file at the repository root). Modules, in sorted order, fill a group until the next module would pass the target; a module of at most the tolerance is never cut. A module above the tolerance is cut by its next directory level, the sub-directories packed the same way and cut again by their own next level while above the tolerance; the files directly in a directory above the tolerance are cut into even runs of at most the target, in sorted order. A part or `unplanned` group of more than the tolerance SHALL be packed the same way and its groups get the suffix `-<k>` from 1 (`p02-1`, `p02-2`, `unplanned-1`); a part of at most the tolerance stays whole.

#### Scenario: Groups follow the plan parts

- **WHEN** part `01.md` lists `src/auth/login.ts`, part `02.md` lists `src/mail/send.ts`, and the range changes both and `src/util/date.ts`
- **THEN** the groups are `p01`, `p02`, `unplanned` with `src/util/date.ts`, and `integration` with all three files, in that order

#### Scenario: A file listed by two parts goes to the first

- **WHEN** parts `01.md` and `02.md` both list `src/a.ts` and the range changes it
- **THEN** `p01` holds `src/a.ts`, and `02` has no group unless it lists another changed file

#### Scenario: Large part is split by module

- **WHEN** `--max-files 30` is given and part `02` lists 25 changed files under `src/api/` and 20 under `src/db/`
- **THEN** the part's groups are `p02-1` with the 25 files of `src/api` and `p02-2` with the 20 files of `src/db`

#### Scenario: Small modules are packed

- **WHEN** no plan is given, the target is 30, and the range changes one file in each of 44 modules
- **THEN** the groups are `m1` with 30 files, `m2` with 14 files, and `integration` with 44

#### Scenario: A module up to the tolerance stays whole

- **WHEN** the target is 30 and one module has 35 changed files
- **THEN** the 35 files are one group

#### Scenario: A large module is cut by sub-directory

- **WHEN** the target is 30 and one module has 30 files under `api/`, 30 under `db/` and 24 under `ui/`
- **THEN** the module groups are one per sub-directory, in that order

#### Scenario: A flat directory is cut into even runs

- **WHEN** the target is 30 and one module holds 50 files directly in its directory
- **THEN** its groups hold 25 and 25 files, in sorted order

### Requirement: Recording a round

With `--record <round-dir>`, `bdk git groups` SHALL write its result, the same document `--json` prints, to `<round-dir>/groups.json`, creating `<round-dir>` when it is missing and replacing an earlier file, and only after the result is computed; a failing run SHALL write nothing. The printed output SHALL be the same as without `--record`.

#### Scenario: Record feeds the next round

- **WHEN** `bdk git groups main --rounds <dir> --record <dir>/round-1` runs at `H1`, `report.md` is then written into `<dir>/round-1/`, a fix is committed, and `bdk git scope main --rounds <dir> --json` runs
- **THEN** `anchor` is `{"kind": "round", "sha": H1, "round": 1}`

### Requirement: Errors of the git commands

Besides the frame's codes, the `git` commands SHALL report:

| Code                     | When                                                                              | Exit |
| ------------------------ | --------------------------------------------------------------------------------- | ---- |
| `usage/invalid-argument` | `<base>` names no commit, `HEAD` and `<base>` have no merge base, `--max-files` is not a positive integer | 2    |
| `env/git-missing`        | no `git` executable on `PATH`                                                     | 3    |
| `env/not-a-repo`         | the working directory is not inside a git work tree                               | 3    |
| `env/no-head`            | `HEAD` names no commit, as in a repository without commits                        | 3    |
| `env/plan-missing`       | `--plan <dir>` names no directory                                                 | 3    |
| `env/plan-invalid`       | a part file has no frontmatter, frontmatter that is not YAML, or `files` that is not a list of strings; the message names the file | 3    |

The record of a finished round SHALL never be an error: a missing or invalid record falls back to the merge base (Requirement: Round record).

#### Scenario: Unknown base

- **WHEN** `bdk git scope no-such-branch --json` runs
- **THEN** the exit code is 2 and the error object carries `code` `usage/invalid-argument` naming `no-such-branch`

#### Scenario: Not a repository

- **WHEN** `bdk git groups main` runs in a directory outside any git work tree
- **THEN** the exit code is 3 and stderr holds `bdk: ` and a message for `env/not-a-repo`

#### Scenario: Invalid plan part

- **WHEN** `--plan <dir>` holds `03.md` whose frontmatter `files` is a string
- **THEN** the exit code is 3, the error code is `env/plan-invalid`, and the message names `03.md`
