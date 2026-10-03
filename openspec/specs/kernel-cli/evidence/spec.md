# kernel-cli/evidence Specification

## Purpose

Evidence (`evidence`). Two of the three T4 primitives as commands: `record` registers a manifest with hashes and citations, `check` answers whether it is still fresh. The third primitive, the citation validator, runs inside `record` and `attempt close`.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/missing-citation",
  "why": "verdict pass for 02-3 cites /summary/failed, which does not resolve in .bdk/.machine/evidence/02-3-tests.json",
  "instead": [
    "bdk evidence record tests-scoped <file> --ticket A-7f3k --verdict pass --cite <pointer that resolves>",
    "record the verdict as fail or not-run"
  ]
}
```

## Requirements

### Requirement: bdk evidence record

Register verification evidence: a manifest with the tree hash and the hashes of the files. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk evidence record <kind> <file> [--ticket <ticket>] [--verdict pass|fail|not-run] [--cite <pointer>]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<kind>` (required). tests-scoped, lint, tests-full, lint-full, typecheck, ui-capture or a project-defined kind; `coverage` is recorded only by `bdk evidence coverage`.
  - `<file>` (required). Repeatable; the evidence files (reports, snapshots, captures).
  - `--ticket <ticket>`. Required; a ticket reference (`kernel-cli`, Ticket references); ties the evidence to the target, the role and the group.
  - `--verdict pass|fail|not-run`.
  - `--cite <pointer>`. Repeatable; JSON pointer into a measured file or file:line in a snapshot, required for pass.
- **Behaviour:** The first of the three T4 primitives. `<kind>` is any kebab-case name: the built-in kinds and a project's own kind are recorded the same way (`input/invalid-argument` otherwise, and for `coverage`). The ticket must be open (`policy/no-open-ticket`); the manifest's `target` is the ticket's target and its `source` is `agent:<role>` of the ticket's active package (`kernel-state`, Attempt record, `package`), or `kernel` when the ticket has no package; for `<ticket>@<group>` the role is the group package's and the manifest also holds `group` (a group without a package is `policy/no-open-ticket`). Each `<file>` must exist (`input/not-found`). Storage (user choice, T23-D46): a file that is UTF-8 text without a NUL byte and at most `policy.evidence.max-committed-bytes` bytes is copied to `.bdk/changes/<id>/evidence/<target>-<evidenceId>-<file name>` and listed with `stored: committed`; any other file stays in `.bdk/.machine/evidence/` (copied there as `<target>-<evidenceId>-<file name>` when it lies elsewhere) and is listed with `stored: machine`, referenced from the committed manifest by its hash only. The kernel stamps `tree-hash` and `tree` with the tree hash of the ticket's target (`kernel-state`, Evidence manifest, Tree hash). Citation validator (T4, T23-D8): a citation is `<file>#<json-pointer>`, `<file>:<line>` or `<file>:<line>=<text>`; `<file>` names a recorded file by its path as given or its file name, and may be left out when exactly one file is recorded (`#/summary/failed`, `:12`); a bare JSON pointer starting with `/` is the same as `#` plus the pointer, unless the citation starts with a recorded file's path followed by `#` or `:`, so an absolute path names its file. A JSON pointer resolves when the file parses as JSON and the pointer names a value; `<line>` resolves when the file has that 1-based line; `=<text>` resolves when that line contains the text. A citation into a file that is not text never resolves. Any citation that does not resolve, and a `pass` verdict without a citation, is `policy/missing-citation` naming the citation and the file, and nothing is written. A second call with the same kind, ticket, tree hash, file hashes, verdict and citations writes nothing and returns the earlier manifest with `deduplicated: true`. Available to subagents: runners record the evidence they produce. A `--cite` value that does not resolve, and whose text (the whole value, or the part after `=` of a `<file>:<line>=<text>` or `<file>:<from>-<to>=<text>` value) is on a line of exactly one recorded text file, is refused with `policy/missing-citation` as any citation that does not resolve, and `instead` then holds the exact `--cite <file>:<line>=<text>` form of that file's first such line; the kernel never accepts the bare text as a citation (T23-D47) and writes nothing.
- **Writes:** `.bdk/changes/<id>/evidence/`, `.bdk/.machine/evidence/`
- **Output:** `schema/cli/output/evidence-record.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/missing-citation`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk evidence record tests-scoped .bdk/.machine/evidence/02-3-tests.json --ticket A-7f3k9m2q --verdict pass --cite '/summary/failed' --json
  ```

  ```json
  {
    "evidence": "E-b6n9t2kq",
    "path": ".bdk/changes/2026-09-25-passwordless-login/evidence/02-3-E-b6n9t2kq.md",
    "treeHash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
    "files": [
      {
        "path": ".bdk/changes/2026-09-25-passwordless-login/evidence/02-3-E-b6n9t2kq-02-3-tests.json",
        "hash": "sha256:4444444444444444444444444444444444444444444444444444444444444444",
        "stored": "committed"
      }
    ],
    "verdict": "pass",
    "citations": [
      "/summary/failed"
    ],
    "deduplicated": false
  }
  ```

- **Owner:** T23
- **Slice:** `evidence`

#### Scenario: example run

- **WHEN** `bdk evidence record tests-scoped .bdk/.machine/evidence/02-3-tests.json --ticket A-7f3k9m2q --verdict pass --cite '/summary/failed' --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/evidence-record.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** no open ticket for the task, or the ticket named does not match
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/missing-citation

- **WHEN** a PASS verdict cites no value that resolves inside the recorded evidence (T4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/missing-citation`

#### Scenario: pass without citations

- **WHEN** `bdk evidence record tests-scoped out.json --ticket A-7f3k9m2q --verdict pass` runs with no `--cite`
- **THEN** the exit code is 2 with `rule: policy/missing-citation`, and no manifest is written

#### Scenario: each citation form resolves

- **WHEN** the recorded files are `summary.json` holding `{"summary": {"failed": 0}}` and `run.txt` whose line 3 reads `12 passed, 0 failed`, and the citations are `summary.json#/summary/failed`, `run.txt:3` and `run.txt:3=0 failed`
- **THEN** the exit code is 0 and the manifest lists the three citations

#### Scenario: citation that does not resolve

- **WHEN** the citation is `run.txt:3=2 failed` and line 3 reads `12 passed, 0 failed`
- **THEN** the exit code is 2 with `rule: policy/missing-citation` naming the citation and `run.txt`

#### Scenario: small text is committed, the rest stays on the machine

- **WHEN** one run records an 18 KB text report and a 2 MB coverage file with the default `policy.evidence.max-committed-bytes`
- **THEN** the report is copied under `.bdk/changes/<id>/evidence/` with `stored: committed`, the coverage file is listed with `stored: machine` under `.bdk/.machine/evidence/`, and `git status` shows only the Change files

#### Scenario: binary file is not citable

- **WHEN** a PNG capture is recorded with the citation `capture.png:1`
- **THEN** the exit code is 2 with `rule: policy/missing-citation`

#### Scenario: project kind

- **WHEN** a project records `bdk evidence record contract-snapshot snap.json --ticket A-7f3k9m2q --verdict not-run`
- **THEN** the exit code is 0 and the manifest's `kind` is `contract-snapshot`

#### Scenario: same evidence twice

- **WHEN** the same `evidence record` call runs twice on an unchanged tree
- **THEN** the second exits 0 with `deduplicated: true` and the id of the first, and no second manifest exists

#### Scenario: console line cited as bare text

- **WHEN** `bdk evidence record tests-scoped out.txt --ticket <t> --verdict pass --cite "Tests  12 passed (12)"` runs and line 7 of `out.txt` is `Tests  12 passed (12)`
- **THEN** it refuses with `policy/missing-citation`, `instead` holds `--cite out.txt:7=Tests  12 passed (12)`, and no manifest and no file is written

#### Scenario: wrong line or a line range

- **WHEN** `--cite out.txt:1=Tests  12 passed (12)` or `--cite out.txt:1-2=Tests  12 passed (12)` runs and the text is on line 7 of `out.txt` only
- **THEN** it refuses with `policy/missing-citation` and `instead` holds `--cite out.txt:7=Tests  12 passed (12)`

#### Scenario: bare text on no line or on lines of several files

- **WHEN** the cited text is on no line of any recorded file, or on a line of two recorded files
- **THEN** it refuses with `policy/missing-citation` and `instead` holds no `--cite <file>:<line>=<text>` form

#### Scenario: grouped evidence

- **WHEN** the runner of group `gate` runs `bdk evidence record tests-full .bdk/.machine/evidence/full.json --ticket A-r1v2w3x4@gate --verdict pass --cite /numFailedTests`
- **THEN** the manifest holds `kind: tests-full`, `target` the Change id, `group: gate`, `source: agent:runner` and the tree hash of the Change

#### Scenario: coverage through record

- **WHEN** `bdk evidence record coverage lcov.info --ticket A-r1v2w3x4@gate` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument` naming `bdk evidence coverage`

### Requirement: bdk evidence check

Is the evidence for a target still fresh against the working tree? The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk evidence check <target|evidence-id>`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<target|evidence-id>` (required). A task, part or Change id, or an `E-` id.
- **Behaviour:** For a target, checks the latest manifest of each kind whose `target` is that target; for an `E-` id, that manifest. A manifest is fresh when its `tree-hash` equals the current tree hash of its target (`kernel-state`, Evidence manifest, Tree hash); `changedSince` lists the paths whose hash differs from the manifest's `tree`, added or removed ones included. `fresh` at the top is true when at least one manifest is checked and every checked manifest is fresh; `treeHash` is the current tree hash of the target. A change to a non-executable file never changes the tree hash, so it never makes evidence stale (T23-D16). Exits 0 with `fresh: false` in `--json`; text mode exits 2 with `policy/stale-evidence` so a shell caller can branch on it. `attempt close` runs the same check (P5). A target the Change does not hold, or an unknown `E-` id, is `input/not-found`.
- **Writes:** nothing
- **Output:** `schema/cli/output/evidence-check.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/stale-evidence`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk evidence check 02-3 --json
  ```

  ```json
  {
    "fresh": false,
    "treeHash": "sha256:5555555555555555555555555555555555555555555555555555555555555555",
    "evidence": [
      {
        "evidence": "E-b6n9t2kq",
        "kind": "tests-scoped",
        "treeHash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
        "fresh": false,
        "verdict": "pass",
        "changedSince": [
          "src/auth/login.ts"
        ]
      }
    ]
  }
  ```

- **Owner:** T23
- **Slice:** `evidence`

#### Scenario: example run

- **WHEN** `bdk evidence check 02-3 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/evidence-check.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/stale-evidence

- **WHEN** the evidence manifest is older than the last code change (P5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/stale-evidence`

#### Scenario: manifest older than the tree hash

- **WHEN** a `tests-scoped` manifest was recorded for `02-3` and a file in the `Files:` of task `02-1` of the same part changes afterwards
- **THEN** `bdk evidence check 02-3 --json` exits 0 with `fresh: false` and `changedSince` naming that file

#### Scenario: non-executable change keeps evidence fresh

- **WHEN** a manifest was recorded for `02-3` and only `docs/login.md`, a `Files:` path of the part, changes afterwards
- **THEN** `bdk evidence check 02-3 --json` answers `fresh: true`

#### Scenario: build config change makes evidence stale

- **WHEN** a manifest was recorded for `02-3` and `package.json`, in no task's `Files:`, changes afterwards
- **THEN** `bdk evidence check 02-3 --json` answers `fresh: false` with `changedSince` naming `package.json`

#### Scenario: target without evidence

- **WHEN** no manifest names `02-3`
- **THEN** `bdk evidence check 02-3 --json` exits 0 with `fresh: false` and an empty `evidence` list

### Requirement: bdk evidence coverage

Measure the coverage of the lines the Change added from a test tool's coverage report, and record it as evidence with a verdict the kernel decides. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk evidence coverage <test-id> <report> --ticket <ticket>`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<test-id>` (required). The `id` of a `tools.test` entry with `coverage` (`kernel-settings`, Tool entries).
  - `<report>` (required). The coverage report the entry's `coverage.command` wrote, in the entry's `coverage.format`.
  - `--ticket <ticket>`. Required; a ticket reference (`kernel-cli`, Ticket references) of an open ticket whose target is the Change.
- **Behaviour:** The verdict is computed, never declared, so a runner cannot pass a threshold it missed. A `<test-id>` that names no `tools.test` entry is `input/not-found`; an entry without `coverage` is `input/invalid-argument`; a ticket whose target is not the Change is `policy/no-open-ticket`. The kernel parses `<report>` as `lcov` (`SF`, `DA` records) or `cobertura` (XML `class` elements with `filename` and `line` elements with `hits`); a file that does not parse as that format is `input/invalid-argument` naming the format and the first bad line. **Added lines** are the lines the Change adds against the Change base (`kernel-cli/review`, bdk review plan) in the working tree, from `git diff --unified=0`, in files outside `.bdk/` that do not match `policy.evidence.non-executable`, the report itself excepted; an untracked file counts whole. A report path matches a changed file when it equals the repository-relative path, or, made relative to the project root when absolute, when the repository-relative path ends with it on a path-segment boundary. Only added lines the report instruments count: `covered` is the number with a hit count above 0, `total` the number instrumented, and `percent` is `covered / total * 100` rounded down to one decimal, or `null` when `total` is 0. A changed executable file the report does not list goes to `unmeasured` and does not count. The verdict is `fail` when `coverage.min` is set, `total` is above 0 and `percent` is below `min`, and `pass` otherwise. The kernel writes a summary file `{test, format, min, percent, covered, total, files: [{path, covered, total, uncovered}], unmeasured}`, where `uncovered` lists the added instrumented line numbers without a hit, and records a manifest of kind `coverage` with the field `tool: <test-id>`, the summary and the report as its files, the citation `#/percent` into the summary and the computed verdict, through the same storage, tree hash and deduplication as `bdk evidence record`. The `tests-full` node reads the manifest (`kernel-pipeline`, Artifact kinds).
- **Writes:** `.bdk/changes/<id>/evidence/`, `.bdk/.machine/evidence/`
- **Output:** `schema/cli/output/evidence-coverage.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk evidence coverage unit coverage/lcov.info --ticket A-r1v2w3x4@gate --json
  ```

  ```json
  {
    "evidence": "E-c8v6b4n2",
    "tool": "unit",
    "min": 90,
    "percent": 93.7,
    "covered": 118,
    "total": 126,
    "unmeasured": [],
    "verdict": "pass"
  }
  ```

- **Owner:** T42
- **Slice:** `evidence`

#### Scenario: example run

- **WHEN** `bdk evidence coverage unit coverage/lcov.info --ticket A-r1v2w3x4@gate --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/evidence-coverage.json`

#### Scenario: input/not-found

- **WHEN** `<test-id>` names no `tools.test` entry, or `<report>` does not exist
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket is closed, or its target is a task
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: below the threshold fails

- **WHEN** `unit` has `coverage.min: 90`, the Change adds 20 instrumented lines in `src/auth/login.ts` and the lcov report shows hits on 17 of them
- **THEN** the manifest holds `verdict: fail`, the summary holds `percent: 85` and lists the three uncovered line numbers under `src/auth/login.ts`

#### Scenario: only added lines count

- **WHEN** `src/auth/login.ts` has 200 instrumented lines with 50 % covered overall and the Change adds 10 lines, all hit
- **THEN** `percent` is 100 and the verdict is `pass`

#### Scenario: threshold per test type

- **WHEN** `unit` has `coverage.min: 90` with `format: lcov` and `e2e` has `coverage` with `format: cobertura` and no `min`
- **THEN** a `unit` report at 80 % records `fail`, and an `e2e` report at 40 % records `pass` with its percent reported

#### Scenario: suffix path match

- **WHEN** the lcov report written from `kernel/` names `SF:src/log/add.ts` and the Change added lines in `kernel/src/log/add.ts`
- **THEN** the report's lines count for `kernel/src/log/add.ts`

#### Scenario: unmeasured file

- **WHEN** the Change adds lines to `src/mail/send.ts` and the report does not list it
- **THEN** `unmeasured` holds `src/mail/send.ts` and its lines are not in `total`

#### Scenario: no instrumented line

- **WHEN** the Change adds lines only in files the report does not instrument
- **THEN** `percent` is `null` and the verdict is `pass`

#### Scenario: entry without coverage

- **WHEN** `bdk evidence coverage lint-only report.info --ticket A-r1v2w3x4@gate` names a `tools.test` entry without `coverage`
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: unparseable report

- **WHEN** `<report>` is a Cobertura file and the entry's `format` is `lcov`
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-argument` naming `lcov`, and nothing is recorded
