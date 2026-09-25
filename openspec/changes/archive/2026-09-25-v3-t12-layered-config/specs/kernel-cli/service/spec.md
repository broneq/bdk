# Spec Delta

## MODIFIED Requirements

### Requirement: bdk doctor

Diagnose the runtime, the layout and the state; one known repair action per finding. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk doctor [--fix]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--fix`. Apply the repairs that need no system change (index rebuild, schema refresh, modeline); never installs software.
- **Behaviour:** Checks: Node version (HOST-FACTS `node-sqlite-min`; a line older than 22 is not supported and does not reach `doctor`, the wrapper's STOP line names the minimum instead), the v2 layout with the `bdk import` instruction, spec `bdk-merge-hash` mismatches, index freshness, schema modeline and offline copy. It does not check `uv`, `uvx` or any MCP server: the plugin ships none (ADR-0001). `/bdk:doctor` (T02 decision R-14) runs this and asks before every system change. Exits 0 with `ok: false` when a finding has level `warn` or `fail`, and 0 with `ok: true` and an empty `findings` list when nothing is wrong; exit 5 only when the kernel itself cannot run (`runtime/not-a-repo`). `doctor` is exempt from the Node gate of `kernel-cli`, Invocation: a Node below 22.13.0 is the `node-version` finding with level `fail`, whose `repair` is an install or switch line, never exit 5. `layout` is `v2` when any of `.bdk/settings.json`, `.bdk/runs/` or `.bdk/plans/` exists, which yields the `v2-layout` finding with level `warn`, a `summary` naming the paths found and `repair: bdk import`; `v3` when `.bdk/` holds none of them; `none` without `.bdk/`. The schema checks (T12) run when `.bdk/settings.yaml` exists: `schema-modeline` (level `warn`) when a present settings file of the project or local layer has no yaml-language-server modeline or one pointing at another version than the running kernel's, and `schema-offline` (level `warn`) when `.bdk/.machine/schema/settings.json` is absent or differs from the running kernel's schema; both repair with `bdk doctor --fix`, which adds or rewrites the modeline as the file's first line (keeping the rest of the file byte for byte) and rewrites the offline copy, then reports the findings that remain. The merge-hash and index freshness checks arrive with their owner tasks (T30, T14 / T20).
- **Writes:** nothing in the Change directory (`writes[]` stays empty, as for every `read` command); with `--fix`, the first line of `.bdk/settings.yaml` and `.bdk/settings.local.yaml` and `.bdk/.machine/schema/settings.json`
- **Output:** `schema/cli/output/doctor.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/merge-hash-mismatch`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
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

#### Scenario: policy/merge-hash-mismatch

- **WHEN** a spec file's content hash differs from its `bdk-merge-hash` (V1-7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/merge-hash-mismatch`

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
