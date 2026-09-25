# kernel-cli/spec Specification

## Purpose

Specifications (`spec`). Deltas and the deterministic merge (D2b, V1-7): `delta check` validates a Change's deltas, `merge` writes `.bdk/specs/` through `node:fs`, `diff` previews the merge.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/merge-hash-mismatch",
  "why": ".bdk/specs/auth/login/spec.md was edited by hand: content hash differs from bdk-merge-hash",
  "instead": [
    "move the manual edit into a spec delta of the Change",
    "bdk spec diff auth/login"
  ]
}
```

## Requirements

### Requirement: bdk spec delta check

Validate a spec delta: Scenario prefix, WHEN / THEN, no silent scenario loss. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk spec delta check [<capability>]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<capability>` (optional). Default: every delta of the active Change.
- **Behaviour:** Same behaviour as the part validator calls (T22): a part declaring a delta must pass this; `spec-impact: none` is the default for `tiny` and `small`. The normative word is configurable (D2b).
- **Writes:** nothing
- **Output:** `schema/cli/output/spec-delta-check.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/spec-invalid`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk spec delta check auth/login --json
  ```

  ```json
  {
    "valid": false,
    "deltas": [
      {
        "capability": "auth/login",
        "path": ".bdk/changes/2026-09-25-passwordless-login/spec-delta/auth-login.md",
        "valid": false,
        "problems": [
          {
            "line": 14,
            "code": "then-missing",
            "message": "Scenario 'expired link' has WHEN without THEN"
          }
        ]
      }
    ]
  }
  ```

- **Owner:** T30
- **Slice:** `spec`

#### Scenario: example run

- **WHEN** `bdk spec delta check auth/login --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/spec-delta-check.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/spec-invalid

- **WHEN** a delta breaks the format
- **THEN** the exit code is 2 and the error object carries `rule: policy/spec-invalid`

### Requirement: bdk spec merge

Deterministically merge the Change's deltas into `.bdk/specs/`; refuse on conflict. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk spec merge [--dry-run]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--dry-run`.
- **Behaviour:** Writes through `node:fs`, which no tool hook sees, so the kernel's exception to the spec guard is structural (V1-7). Idempotent: running it twice yields the same file. Each written spec carries `bdk-merge-hash`; a mismatch before merging means a manual edit and is refused. On conflict the output names both texts and the model is consulted only then; `change close` stays blocked until resolved.
- **Writes:** `.bdk/specs/`
- **Output:** `schema/cli/output/spec-merge.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/spec-invalid`, `policy/spec-conflict`, `policy/merge-hash-mismatch`, `policy/gate-not-ready`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk spec merge --json
  ```

  ```json
  {
    "merged": [
      {
        "capability": "auth/login",
        "path": ".bdk/specs/auth/login/spec.md",
        "mergeHash": "sha256:6666666666666666666666666666666666666666666666666666666666666666",
        "added": 2,
        "modified": 1,
        "removed": 0
      }
    ],
    "conflicts": []
  }
  ```

- **Owner:** T30
- **Slice:** `spec`

#### Scenario: example run

- **WHEN** `bdk spec merge --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/spec-merge.json`

#### Scenario: policy/spec-invalid

- **WHEN** a delta breaks the format
- **THEN** the exit code is 2 and the error object carries `rule: policy/spec-invalid`

#### Scenario: policy/spec-conflict

- **WHEN** two deltas edit the same requirement differently
- **THEN** the exit code is 2 and the error object carries `rule: policy/spec-conflict`

#### Scenario: policy/merge-hash-mismatch

- **WHEN** a spec file's content hash differs from its `bdk-merge-hash` (V1-7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/merge-hash-mismatch`

#### Scenario: policy/gate-not-ready

- **WHEN** the gate node is not ready
- **THEN** the exit code is 2 and the error object carries `rule: policy/gate-not-ready`

### Requirement: bdk spec diff

What the merged spec would look like: requirement-level diff of the Change's deltas against `.bdk/specs/`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk spec diff [<capability>]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<capability>` (optional).
- **Behaviour:** Read-only preview used by `/bdk:close --dry-run` and by reviewers.
- **Writes:** nothing
- **Output:** `schema/cli/output/spec-diff.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk spec diff auth/login --json
  ```

  ```json
  {
    "capabilities": [
      {
        "capability": "auth/login",
        "requirements": [
          {
            "name": "Magic link expires",
            "change": "added",
            "scenarios": {
              "added": 2,
              "removed": 0
            }
          }
        ]
      }
    ]
  }
  ```

- **Owner:** T30
- **Slice:** `spec`

#### Scenario: example run

- **WHEN** `bdk spec diff auth/login --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/spec-diff.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`
