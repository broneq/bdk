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
- **Behaviour:** Reads `spec-delta/<capability>.md` of the active Change (the delta grammar is `kernel-state`, Spec delta) and the current `.bdk/specs/<capability>/spec.md`, and reports every problem with its 1-based line in the delta. Problem codes: `scenario-prefix` (a heading or a bold or bullet line that names a scenario without being exactly `#### Scenario: <name>`), `when-missing` and `then-missing` (a scenario without a `- **WHEN**` or `- **THEN**` bullet), `normative-word` (a requirement statement, the text between the requirement heading and its first scenario, without the configured word `spec.normative-word` as a whole, case-sensitive word), `scenario-missing` (an added or modified requirement without a scenario, or a removal that leaves a requirement none), `scenario-lost` (a scenario of the current requirement absent from its MODIFIED block and not listed under the same requirement in REMOVED; an ERROR, D2b), `requirement-unknown` (MODIFIED or REMOVED names a requirement, or REMOVED a scenario, that the current spec does not hold), `requirement-exists` (ADDED names a requirement the current spec holds with another text), `requirement-duplicate` (a requirement named twice in ADDED and MODIFIED, or twice in one section), `section-unknown` (a level-2 heading other than `Purpose`, `ADDED Requirements`, `MODIFIED Requirements`, `REMOVED Requirements`), `purpose-missing` (a delta creating a capability without a `## Purpose` of at least 50 characters) and `delta-empty` (no requirement and no purpose). A requirement or scenario that the current spec shows as already merged by this Change (its `bdk-change` is the active Change's id) is not unknown and not lost, so the check still passes after `spec merge`. The part validator (T22) and the `spec-delta` kind's validator run the same check (`kernel-loops`, Plan part checks; `kernel-pipeline`, Artifact kinds). The command exits 0 with `valid: true` when no delta has a problem, and refuses with `policy/spec-invalid` otherwise, because the error object has exactly four fields: `why` lists every problem as `<path>:<line> <code>: <message>`, joined by `; `. A Change without deltas exits 0 with an empty `deltas` list.
- **Writes:** nothing
- **Output:** `schema/cli/output/spec-delta-check.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/spec-invalid`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk spec delta check auth/login --json
  ```

  ```json
  {
    "valid": true,
    "deltas": [
      {
        "capability": "auth/login",
        "path": ".bdk/changes/2026-09-25-passwordless-login/spec-delta/auth/login.md",
        "valid": true,
        "problems": []
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

#### Scenario: delta without WHEN rejected

- **WHEN** `spec-delta/auth/login.md` adds a requirement whose only scenario has a `- **THEN**` bullet and no `- **WHEN**` bullet, and `bdk spec delta check --json` runs
- **THEN** the exit code is 2 with `rule: policy/spec-invalid`, and `why` names `when-missing`, the scenario and its line

#### Scenario: scenario removed without REMOVED is an error

- **WHEN** `.bdk/specs/auth/login/spec.md` holds requirement `Magic link expires` with scenarios `expired link` and `reused link`, the delta's MODIFIED block of that requirement keeps only `expired link`, and no REMOVED entry lists `reused link`
- **THEN** the check exits 2 with `rule: policy/spec-invalid` naming `scenario-lost` and `reused link`

#### Scenario: scenario removed through REMOVED

- **WHEN** the same delta also lists `#### Scenario: reused link` under `### Requirement: Magic link expires` in `## REMOVED Requirements`
- **THEN** the check exits 0 with `valid: true`

#### Scenario: configured normative word

- **WHEN** `.bdk/settings.yaml` sets `spec.normative-word: MUST` and a delta's requirement statement says `SHALL` only
- **THEN** the check exits 2 naming `normative-word`

### Requirement: bdk spec merge

Deterministically merge the Change's deltas into `.bdk/specs/`; refuse on conflict. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk spec merge [--dry-run]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--dry-run`. Compute the merge and the conflicts; write nothing and never refuse on a conflict.
- **Behaviour:** Writes through `node:fs`, which no tool hook sees, so the kernel's exception to the spec guard is structural (V1-7). Without `--dry-run` the `gate:review` node must be done (`policy/gate-not-ready`): the living spec records reviewed behaviour only. The checks run in this order, the first failing one refusing: every target file that exists carries a `bdk-merge-hash` equal to the hash of its body (`policy/merge-hash-mismatch`, `why` naming the file; `kernel-state`, Living spec file); no conflict (`policy/spec-conflict`); every delta passes `spec delta check` (`policy/spec-invalid`). Merge algorithm, per capability in path order, deterministic for the same deltas and the same spec files: requirements are matched by name (whitespace-trimmed, case-sensitive); REMOVED entries apply first, removing the whole requirement, or only the scenarios listed under it; MODIFIED replaces the requirement's whole block in place; ADDED appends in delta order after the last requirement; a delta's `## Purpose` replaces the purpose; a capability without a spec file is created from the delta, which must then carry a purpose. The result is rendered canonically (`kernel-state`, Living spec file) and written with `bdk-merge-hash` and `bdk-change: <active Change id>`. Idempotent: an operation the file already shows as merged by this Change (an ADDED or MODIFIED block equal to the file's, a removed requirement or scenario absent from a file whose `bdk-change` is this Change) is a no-op, so running the merge twice yields the same bytes. **Conflict** (user decision, 2026-09-28): a requirement of capability `C` is in conflict when an archived Change `Y`, whose `close` transition is later than this Change's `change.md` `at`, names the same requirement in any section of its `spec-delta/C.md` with a block text different from this Change's, and this Change's ledger holds no `decision` entry whose `refs` include both `Y`'s id and `spec-delta/C.md`. The conflict lists `capability`, `requirement`, `ours` (this Change's block) and `theirs` (`Y`'s block, prefixed by `Y`'s id); the model is consulted only then (risk "Spec merge conflicts"): it rewrites this Change's delta on top of the current spec and records the `decision`, after which the merge proceeds. `change close` stays blocked until then. `--dry-run` prints the same output with the conflicts listed and exits 0.
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

#### Scenario: merge is idempotent

- **WHEN** `bdk spec merge` runs twice on the same Change with `gate:review` done
- **THEN** both runs exit 0 and `.bdk/specs/auth/login/spec.md` is byte for byte the same after the second run as after the first

#### Scenario: two Changes edit the same capability

- **WHEN** Change `A` and Change `B` are created, both deltas modify requirement `Magic link expires` of `auth/login` with different texts, `A` closes, and `B` runs `bdk spec merge --dry-run --json` after merging `A`'s branch
- **THEN** the exit code is 0 and `conflicts` holds one item for `auth/login` / `Magic link expires` whose `ours` is `B`'s block and `theirs` is `A`'s block; `bdk spec merge` exits 2 with `rule: policy/spec-conflict` naming both Changes and writes nothing

#### Scenario: conflict resolved by a decision

- **WHEN** `B` then rewrites its delta and records `bdk log add decision "<summary>" --ref <A's id> --ref spec-delta/auth/login.md`
- **THEN** `bdk spec merge` exits 0 and writes `B`'s block

#### Scenario: capability created with its purpose

- **WHEN** `.bdk/specs/auth/login/spec.md` is absent and the delta carries `## Purpose` and one ADDED requirement
- **THEN** the merge creates the file with that purpose, the requirement, `bdk-merge-hash` and `bdk-change`

### Requirement: bdk spec diff

What the merged spec would look like: requirement-level diff of the Change's deltas against `.bdk/specs/`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk spec diff [<capability>]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<capability>` (optional). Default: every delta of the active Change.
- **Behaviour:** Read-only preview used by `/bdk:close --dry-run` and by reviewers. One item per requirement a delta names, in delta order: `change` is `added`, `modified` (a MODIFIED block, or a REMOVED entry listing only scenarios) or `removed`; `scenarios.added` and `scenarios.removed` count the scenario names that the merge adds to or drops from the current requirement. It applies no check: an invalid delta is reported by `spec delta check`, not here. A `<capability>` that is not a delta of the Change is `input/not-found`.
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

#### Scenario: scenario removal counted

- **WHEN** a delta modifies `Magic link expires` keeping one of its two scenarios and lists the other under REMOVED
- **THEN** the item is `{name: "Magic link expires", change: "modified", scenarios: {added: 0, removed: 1}}`
