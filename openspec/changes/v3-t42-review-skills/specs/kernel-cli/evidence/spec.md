## MODIFIED Requirements

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
- **Behaviour:** The first of the three T4 primitives. `<kind>` is any kebab-case name: the built-in kinds and a project's own kind are recorded the same way (`input/invalid-argument` otherwise, and for `coverage`). The ticket must be open (`policy/no-open-ticket`); the manifest's `target` is the ticket's target and its `source` is `agent:<role>` of the ticket's active package (`kernel-state`, Attempt record, `package`), or `kernel` when the ticket has no package; for `<ticket>@<group>` the role is the group package's and the manifest also holds `group` (a group without a package is `policy/no-open-ticket`). Each `<file>` must exist (`input/not-found`). Storage (user choice, T23-D46): a file that is UTF-8 text without a NUL byte and at most `policy.evidence.max-committed-bytes` bytes is copied to `.bdk/changes/<id>/evidence/<target>-<evidenceId>-<file name>` and listed with `stored: committed`; any other file stays in `.bdk/.machine/evidence/` (copied there as `<target>-<evidenceId>-<file name>` when it lies elsewhere) and is listed with `stored: machine`, referenced from the committed manifest by its hash only. The kernel stamps `tree-hash` and `tree` with the tree hash of the ticket's target (`kernel-state`, Evidence manifest, Tree hash). Citation validator (T4, T23-D8): a citation is `<file>#<json-pointer>`, `<file>:<line>` or `<file>:<line>=<text>`; `<file>` names a recorded file by its path as given, by the same path relative to the project root or absolute, or by its file name, and may be left out when exactly one file is recorded (`#/summary/failed`, `:12`); a bare JSON pointer starting with `/` is the same as `#` plus the pointer, unless the citation starts with a recorded file's path followed by `#` or `:`, so an absolute path names its file. A JSON pointer resolves when the file parses as JSON and the pointer names a value; `<line>` resolves when the file has that 1-based line; `=<text>` resolves when that line contains the text. A citation into a file that is not text never resolves. Any citation that does not resolve, and a `pass` verdict without a citation, is `policy/missing-citation` naming the citation and the file, and nothing is written. A second call with the same kind, ticket, tree hash, file hashes, verdict and citations writes nothing and returns the earlier manifest with `deduplicated: true`. Available to subagents: runners record the evidence they produce.
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

#### Scenario: grouped evidence

- **WHEN** the runner of group `gate` runs `bdk evidence record tests-full .bdk/.machine/evidence/full.json --ticket A-r1v2w3x4@gate --verdict pass --cite /numFailedTests`
- **THEN** the manifest holds `kind: tests-full`, `target` the Change id, `group: gate`, `source: agent:runner` and the tree hash of the Change

#### Scenario: coverage through record

- **WHEN** `bdk evidence record coverage lcov.info --ticket A-r1v2w3x4@gate` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument` naming `bdk evidence coverage`
