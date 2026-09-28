# kernel-cli/evidence delta

## MODIFIED Requirements

### Requirement: bdk evidence record

Register verification evidence: a manifest with the tree hash and the hashes of the files. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk evidence record <kind> <file> [--ticket <ticket>] [--verdict pass|fail|not-run] [--cite <pointer>]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<kind>` (required). tests-scoped, lint, typecheck, ui-capture or a project-defined kind.
  - `<file>` (required). Repeatable; the evidence files (reports, snapshots, captures).
  - `--ticket <ticket>`. Required; ties the evidence to the task and role.
  - `--verdict pass|fail|not-run`.
  - `--cite <pointer>`. Repeatable; JSON pointer into a measured file or file:line in a snapshot, required for pass.
- **Behaviour:** The first of the three T4 primitives. `<kind>` is any kebab-case name: the built-in kinds and a project's own kind are recorded the same way (`input/invalid-argument` otherwise). The ticket must be open (`policy/no-open-ticket`); the manifest's `target` is the ticket's target and its `source` is `agent:<role>` of the ticket's active package (`kernel-state`, Attempt record, `package`), or `kernel` when the ticket has no package. Each `<file>` must exist (`input/not-found`). Storage (user choice, T23-D46): a file that is UTF-8 text without a NUL byte and at most `policy.evidence.max-committed-bytes` bytes is copied to `.bdk/changes/<id>/evidence/<target>-<evidenceId>-<file name>` and listed with `stored: committed`; any other file stays in `.bdk/.machine/evidence/` (copied there as `<target>-<evidenceId>-<file name>` when it lies elsewhere) and is listed with `stored: machine`, referenced from the committed manifest by its hash only. The kernel stamps `tree-hash` and `tree` with the tree hash of the ticket's target (`kernel-state`, Evidence manifest, Tree hash). Citation validator (T4, T23-D8): a citation is `<file>#<json-pointer>`, `<file>:<line>` or `<file>:<line>=<text>`; `<file>` names a recorded file by its path as given or its file name, and may be left out when exactly one file is recorded (`#/summary/failed`, `:12`); a bare JSON pointer starting with `/` is the same as `#` plus the pointer. A JSON pointer resolves when the file parses as JSON and the pointer names a value; `<line>` resolves when the file has that 1-based line; `=<text>` resolves when that line contains the text. A citation into a file that is not text never resolves. Any citation that does not resolve, and a `pass` verdict without a citation, is `policy/missing-citation` naming the citation and the file, and nothing is written. A second call with the same kind, ticket, tree hash, file hashes, verdict and citations writes nothing and returns the earlier manifest with `deduplicated: true`. Available to subagents: runners record the evidence they produce.
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
