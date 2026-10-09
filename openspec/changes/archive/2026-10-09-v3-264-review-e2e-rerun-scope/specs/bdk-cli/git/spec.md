## MODIFIED Requirements

### Requirement: Scope of a review round

`bdk git scope <base> [--rounds <dir>]` SHALL compute the range a review round covers and print it, writing nothing. The range SHALL be `<anchor>..HEAD`, committed history only. The anchor SHALL be:

- with `--rounds <dir>`, the `head` recorded by the last finished round under `<dir>` (Requirement: Round record), when that commit exists and is an ancestor of `HEAD` (`anchor.kind` `round`, `anchor.round` its number);
- otherwise the merge base of `HEAD` and `<base>` (`anchor.kind` `base`). When a finished round exists but its record is missing, invalid, names no commit, or names a commit that is not an ancestor of `HEAD` (as after a rebase), `anchor.fallback` SHALL say why the round was not used.

The result SHALL name `base` (the argument), `anchor` (`kind`, `sha`, and `round` or `fallback` when they apply), `head` (the full sha of `HEAD`), `range` (`<anchor sha>..<head>`), and these sorted, repository-relative path lists, each computed with renames split into a deletion and an addition:

- `files`: changed text files present at `HEAD`;
- `binary`: changed files that git counts as binary and that are present at `HEAD`; they belong to no group;
- `deleted`: files present at the anchor and absent at `HEAD`;
- `dirty`: tracked files whose working tree or index differs from `HEAD`, so the caller can commit them first; they do not change the range;
- `tests`: the paths of `files`, `binary` and `deleted` that are test files (Requirement: Test files of a range).

Paths SHALL be byte-exact (no quoting of unusual characters) and sorted by code unit. The same repository state and the same arguments SHALL give a byte-identical result.


The result SHALL also name `testsOnly`: `true` when every path of `files`, `binary` and `deleted` is in `tests`, also when all three are empty; `false` otherwise. `dirty` SHALL NOT count towards it. The text output SHALL list the test files.

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
- **THEN** the exit code is 0, `files`, `binary`, `deleted` and `tests` are empty, and `testsOnly` is `true`

#### Scenario: Fix range of test files only

- **WHEN** the range since round 1 changes `test/cli.test.js` and deletes `src/__tests__/old.js`, and `bdk git scope main --rounds <dir> --json` runs
- **THEN** `tests` is `["src/__tests__/old.js", "test/cli.test.js"]` and `testsOnly` is `true`

#### Scenario: Fix range with a product file

- **WHEN** the range changes `src/parse.js` and `src/parse.test.js`
- **THEN** `tests` is `["src/parse.test.js"]` and `testsOnly` is `false`

## ADDED Requirements

### Requirement: Test files of a range

A path SHALL be a test file when one of its directory segments is `test`, `tests`, `__tests__`, `__mocks__`, `__snapshots__` or `testdata`, or when its file name matches `*.test.*`, `*.spec.*`, `*_test.*`, `*_spec.*`, `test_*.py` or `conftest.py`, or `*Test.<ext>` or `*Tests.<ext>` with `<ext>` one of `java`, `kt`, `scala`, `groovy`, `cs`, `php` and `swift`. Matching SHALL be case-sensitive and SHALL read only the path, never the file. No other path SHALL be a test file: a directory named `spec`, `fixtures` or `e2e`, a documentation file or a configuration file is not one.

#### Scenario: Conventions of several languages

- **WHEN** the range changes `pkg/parse_test.go`, `tests/test_cli.py`, `src/App.spec.tsx`, `app/src/test/java/LedgerTest.java` and `src/latest.js`
- **THEN** `tests` holds the first four paths and not `src/latest.js`

#### Scenario: Look-alike names are not tests

- **WHEN** the range changes `src/commands/test.ts`, `spec/openapi.yaml`, `src/Latest.java` and `docs/testing.md`
- **THEN** `tests` is empty and `testsOnly` is `false`
