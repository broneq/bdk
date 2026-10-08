# Spec Delta

## MODIFIED Requirements

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

- **WHEN** `<dir>/round-1/` holds `review.md` and a `groups.json` whose `head` is `H1`, one fix commit follows `H1`, and `bdk git scope main --rounds <dir> --json` runs
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

A round SHALL count as finished when its directory `<dir>/round-<N>/` (`N` a positive decimal integer without leading zeros) holds a file `review.md`. The last finished round SHALL be the finished round with the highest `N`; a round directory without `review.md`, as after a crash, SHALL be ignored, so a rerun of that round is anchored where its first run was. The commit a round reviewed SHALL be the `head` field of `<dir>/round-<N>/groups.json`, the file `bdk git groups --record <dir>/round-<N>` writes. `--rounds <dir>` naming a directory that does not exist SHALL mean that no round has finished.

#### Scenario: Crashed round is ignored

- **WHEN** `round-1/` holds `review.md` and `groups.json` with `head` `H1`, and `round-2/` holds `groups.json` but no `review.md`
- **THEN** `bdk git scope main --rounds <dir> --json` gives `anchor.round` 1 and `anchor.sha` `H1`

#### Scenario: Missing record falls back

- **WHEN** the last finished round holds `review.md` but no readable `groups.json` whose `head` is a full lowercase hexadecimal object name (40 digits, or 64 in a SHA-256 repository)
- **THEN** `anchor.kind` is `base` and `anchor.fallback` names the round and the missing or invalid record

#### Scenario: Same state, same groups

- **WHEN** `bdk git groups main --rounds <dir> --plan <parts> --json` runs twice on an unchanged repository and unchanged directories
- **THEN** both runs print byte-identical output

### Requirement: Recording a round

With `--record <round-dir>`, `bdk git groups` SHALL write its result, the same document `--json` prints, to `<round-dir>/groups.json`, creating `<round-dir>` when it is missing and replacing an earlier file, and only after the result is computed; a failing run SHALL write nothing. The printed output SHALL be the same as without `--record`.

#### Scenario: Record feeds the next round

- **WHEN** `bdk git groups main --rounds <dir> --record <dir>/round-1` runs at `H1`, `review.md` is then written into `<dir>/round-1/`, a fix is committed, and `bdk git scope main --rounds <dir> --json` runs
- **THEN** `anchor` is `{"kind": "round", "sha": H1, "round": 1}`
