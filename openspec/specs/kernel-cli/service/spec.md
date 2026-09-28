# kernel-cli/service Specification

## Purpose

Service commands (`service`). Diagnosis, repair, migration and version: `doctor`, `rebuild`, `import`, `version`.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules. Two exceptions in this group: `version` is standalone and emits none of the common rules, and `doctor` is exempt from the Node gate, so it reports a Node below the minimum as its `node-version` finding instead of `runtime/node-version` (`kernel-cli`, Invocation).

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "state/trailer-mismatch",
  "why": "commit d8e4f21 carries BDK-Task: 02-3 but attempts/ has no closed ok ticket for 02-3",
  "instead": [
    "bdk rebuild",
    "bdk attempt list --for 02-3"
  ]
}
```

## Requirements

### Requirement: bdk doctor

Diagnose the runtime, the layout and the state; one known repair action per finding. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk doctor [--fix]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--fix`. Apply the repairs that need no system change (index rebuild, schema refresh, modeline); never installs software.
- **Behaviour:** Checks: Node version (HOST-FACTS `node-sqlite-min`; a line older than 22 is not supported and does not reach `doctor`, the wrapper's STOP line names the minimum instead), the v2 layout with the `bdk import` instruction, spec `bdk-merge-hash` mismatches, index freshness, schema modeline and offline copy. It does not check `uv`, `uvx` or any MCP server: the plugin ships none (ADR-0001). `/bdk:doctor` (T02 decision R-14) runs this and asks before every system change. Exits 0 with `ok: false` when a finding has level `warn` or `fail`, and 0 with `ok: true` and an empty `findings` list when nothing is wrong; exit 5 only when the kernel itself cannot run (`runtime/not-a-repo`). `doctor` is exempt from the Node gate of `kernel-cli`, Invocation: a Node below 22.13.0 is the `node-version` finding with level `fail`, whose `repair` is an install or switch line, never exit 5. `layout` is `v2` when any of `.bdk/settings.json`, `.bdk/runs/` or `.bdk/plans/` exists, which yields the `v2-layout` finding with level `warn`, a `summary` naming the paths found and `repair: bdk import`; `v3` when `.bdk/` holds none of them; `none` without `.bdk/`. The schema checks (T12) run when `.bdk/settings.yaml` exists: `schema-modeline` (level `warn`) when a present settings file of the project or local layer has no yaml-language-server modeline or one pointing at another version than the running kernel's, and `schema-offline` (level `warn`) when `.bdk/.machine/schema/settings.json` is absent or differs from the running kernel's schema; both repair with `bdk doctor --fix`, which adds or rewrites the modeline as the file's first line (keeping the rest of the file byte for byte) and rewrites the offline copy, then reports the findings that remain. The `merge-hash` check (T30) runs when `.bdk/specs/` exists: one finding with level `fail` per `.bdk/specs/**/spec.md` whose body does not hash to its `bdk-merge-hash`, or that carries none (`kernel-state`, Living spec file); the summary names the file and says it was edited outside `spec merge`, and the repair is the command that restores the file from the last close commit that touched it, `git restore --source=$(git log -1 --format=%H --grep='^chore(bdk): close' -- <file>) -- <file>` (a wanted edit goes into a spec delta of a Change instead). It never refuses: `change close` and `spec merge` refuse on the same mismatch (`policy/merge-hash-mismatch`). The index freshness check arrives with its owner task (T14 / T20).
- **Writes:** nothing in the Change directory (`writes[]` stays empty, as for every `read` command); with `--fix`, the first line of `.bdk/settings.yaml` and `.bdk/settings.local.yaml` and `.bdk/.machine/schema/settings.json`
- **Output:** `schema/cli/output/doctor.json`
- **Exit codes and rules:** `0, 3, 5`. No specific rule; the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk doctor --json
  ```

  ```json
  {
    "ok": false,
    "version": {
      "kernel": "3.0.0",
      "contract": 3,
      "node": "22.12.0"
    },
    "layout": "v2",
    "findings": [
      {
        "id": "node-version",
        "level": "fail",
        "summary": "Node 22.12.0 is below 22.13.0; node:sqlite needs a flag",
        "repair": "nvm install 24 && nvm use 24"
      },
      {
        "id": "v2-layout",
        "level": "warn",
        "summary": ".bdk/settings.json and .bdk/plans/ found",
        "repair": "bdk import"
      }
    ]
  }
  ```

- **Owner:** T11
- **Slice:** `service`

#### Scenario: example run

- **WHEN** `bdk doctor --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/doctor.json`

#### Scenario: no uv check

- **WHEN** `bdk doctor --json` runs on a machine without `uv` or `uvx` on `PATH`
- **THEN** no finding names `uv`, `uvx` or an MCP server

#### Scenario: v2 layout

- **WHEN** `bdk doctor --json` runs in a git work tree whose `.bdk/` holds `settings.json` and `plans/`
- **THEN** the exit code is 0, `ok` is `false`, `layout` is `v2`, and `findings` holds `v2-layout` with level `warn`, a summary naming `.bdk/settings.json` and `.bdk/plans/`, and `repair: bdk import`

#### Scenario: Node below the minimum

- **WHEN** `bdk doctor --json` runs on a Node below 22.13.0 that loads the bundle
- **THEN** the exit code is 0, `ok` is `false` and `findings` holds `node-version` with level `fail`, the running and the minimum version in the summary, and an install or switch line as the repair

#### Scenario: healthy project

- **WHEN** `bdk doctor --json` runs on Node 22.13.0 or later in a git work tree without a v2 layout, whose settings files, if any, carry the current modeline and whose offline schema copy is current
- **THEN** the exit code is 0, `ok` is `true` and `findings` is empty

#### Scenario: settings file without modeline

- **WHEN** `bdk doctor --json` runs in a project whose `.bdk/settings.yaml` has no yaml-language-server modeline
- **THEN** the exit code is 0, `ok` is `false` and `findings` holds `schema-modeline` with level `warn` and `repair: bdk doctor --fix`

#### Scenario: fix the schema findings

- **WHEN** `bdk doctor --fix --json` runs in a project whose `.bdk/settings.yaml` has no modeline and whose offline schema copy is absent
- **THEN** `.bdk/settings.yaml` starts with the modeline of the running kernel's version followed by its previous content unchanged, `.bdk/.machine/schema/settings.json` equals `bdk config schema --json`'s schema, and neither `schema-modeline` nor `schema-offline` is among the findings

#### Scenario: policy/merge-hash-mismatch

- **WHEN** a spec file's content hash differs from its `bdk-merge-hash` (V1-7)
- **THEN** `doctor` does not refuse: the exit code is 0 and the mismatch is the `merge-hash` finding

#### Scenario: manual edit of a merged spec

- **WHEN** `bdk spec merge` wrote `.bdk/specs/auth/login/spec.md` and a line of its body is then edited by hand, and `bdk doctor --json` runs
- **THEN** the exit code is 0, `ok` is `false`, and `findings` holds `merge-hash` with level `fail` naming `.bdk/specs/auth/login/spec.md`

### Requirement: bdk rebuild

Rebuild the index and the derived progress from committed files and git trailers. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk rebuild [--all]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--all`. Every Change, not only the active one.
- **Behaviour:** The mandatory repair path behind every exit 4 (Q3), and the step that makes a fresh clone or another machine resume (S5). For each Change in scope, in this order: migrates committed documents whose `schema` is older than the kernel's (`kernel-state`, Schema versions and migrations), leaving a document without a migration path or newer than the kernel unchanged and listing it in `warnings`; drops the Change's rows from the index and re-reads every committed file except those listed in `warnings`; regenerates `plan/index.md` and `design/index.md` from their parts; reads the trailer commits of the Change and checks them against the plan and the attempt records (`kernel-loops`, Progress from git). Progress comes from trailers, attempts and budgets from the committed `attempts/` records, entries from `log/`; budgets never reset silently. A genuine inconsistency is reported as `state/trailer-mismatch` naming both sides, never papered over; the index and the regenerated files are still written, so `rebuild` can be re-run after the user repairs the history. A ledger file that fails validation is `state/ledger-invalid` naming the file. `changes`, `entries`, `attempts` and `commits` count what was read; `migrated` lists rewritten files. Like every Change-scoped command it needs the active Change (`policy/no-active-change`); `--all` widens the rebuild to every Change directory of the project. A fresh clone has no branch marker yet, so `change resume <id>` binds the branch first and `rebuild` follows.
- **Writes:** `.bdk/.machine/`, `.bdk/changes/<id>/`, `.bdk/rules/`
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
    "warnings": []
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

### Requirement: bdk import

One-time v2 to v3 import: settings, rules, old designs as intents of new Changes. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk import [--dry-run]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `--dry-run`.
- **Behaviour:** Hard cut (Q1). Converts `settings.json` to the v3 schema naming dropped keys, runs `rules import`, turns `.bdk/design/*.md` into intents of new Changes with `source: inferred`, fixes `.gitignore` to the two v3 paths, and removes the v2 directories. `hooks session-start` and `doctor` point here; the command runs without an existing v3 layout.
- **Writes:** `.bdk/settings.yaml`, `.bdk/rules/`, `.bdk/changes/`, `.gitignore`
- **Output:** `schema/cli/output/import.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/config-invalid`, `policy/duplicate-rule-id`, `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk import --dry-run --json
  ```

  ```json
  {
    "settings": {
      "from": ".bdk/settings.json",
      "to": ".bdk/settings.yaml",
      "keys": 14,
      "dropped": [
        "features.caveman"
      ]
    },
    "rules": 6,
    "changes": [
      {
        "from": ".bdk/design/2026-08-01-auth.md",
        "change": "2026-09-25-auth-imported"
      }
    ],
    "removed": [
      ".bdk/runs",
      ".bdk/plans"
    ]
  }
  ```

- **Owner:** T32
- **Slice:** `service`

#### Scenario: example run

- **WHEN** `bdk import --dry-run --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/import.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/config-invalid

- **WHEN** a value fails its module schema
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid`

#### Scenario: policy/duplicate-rule-id

- **WHEN** two rules carry the same id, typically after a parallel close (V1-6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/duplicate-rule-id`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

### Requirement: bdk version

Kernel version, contract version, Node version. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk version`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** The one command that needs no project, no git and no Node minimum: it runs on any Node that can load the bundle, so `doctor` and the wrapper's STOP line can quote it. Text mode prints `bdk 3.0.0 (contract 3, node 24.21.0)`.
- **Writes:** nothing
- **Output:** `schema/cli/common/version.json`
- **Exit codes and rules:** `0, 3`. Rules: `input/unknown-flag`, `input/invalid-argument`; no common rules apply (standalone: no runtime or project check).
- **Example:**

  ```bash
  bdk version --json
  ```

  ```json
  {
    "kernel": "3.0.0",
    "contract": 3,
    "node": "24.21.0"
  }
  ```

- **Owner:** T11
- **Slice:** `service`

#### Scenario: example run

- **WHEN** `bdk version --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/common/version.json`

#### Scenario: input/unknown-flag

- **WHEN** a flag the command does not declare
- **THEN** the exit code is 3 and the error object carries `rule: input/unknown-flag`

#### Scenario: input/invalid-argument

- **WHEN** a value has the wrong form
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument`

#### Scenario: Node below the minimum

- **WHEN** `bdk version --json` runs on a Node below 22.13.0 that loads the bundle, outside any git work tree
- **THEN** the exit code is 0 and stdout validates against `schema/cli/common/version.json` with the running Node version in `node`
