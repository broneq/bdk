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
  - `<kind>` (required). tests-scoped, lint, typecheck, ui-capture or a project-defined kind.
  - `<file>` (required). Repeatable; the evidence files (reports, snapshots, captures).
  - `--ticket <ticket>`. Required; ties the evidence to the task and role.
  - `--verdict pass|fail|not-run`.
  - `--cite <pointer>`. Repeatable; JSON pointer into a measured file or file:line in a snapshot, required for pass.
- **Behaviour:** The first of the three T4 primitives. Binary or large files stay in `.machine/evidence/` and are referenced by hash from the committed manifest. A `pass` verdict without a citation that resolves inside the files is refused (citation validator). Available to subagents: runners record the evidence they produce.
- **Writes:** `.bdk/changes/<id>/evidence/`, `.bdk/.machine/evidence/`
- **Output:** `schema/cli/output/evidence-record.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/missing-citation`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk evidence record tests-scoped .bdk/.machine/evidence/02-3-tests.json --ticket A-7f3k --verdict pass --cite '/summary/failed' --json
  ```

  ```json
  {
    "evidence": "E-b6n9t",
    "path": ".bdk/changes/2026-09-25-passwordless-login/evidence/02-3-1.md",
    "treeHash": "sha256:3333333333333333333333333333333333333333333333333333333333333333",
    "files": [
      {
        "path": ".bdk/.machine/evidence/02-3-tests.json",
        "hash": "sha256:4444444444444444444444444444444444444444444444444444444444444444",
        "stored": "machine"
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

- **WHEN** `bdk evidence record tests-scoped .bdk/.machine/evidence/02-3-tests.json --ticket A-7f3k --verdict pass --cite '/summary/failed' --json` runs as in the example
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

### Requirement: bdk evidence check

Is the evidence for a task still fresh against the working tree? The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk evidence check <task|evidence-id>`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<task|evidence-id>` (required).
- **Behaviour:** Exits 0 with `fresh: false` in `--json`; text mode exits 2 with `policy/stale-evidence` so a shell caller can branch on it. `attempt close` runs the same check (P5).
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
        "evidence": "E-b6n9t",
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
