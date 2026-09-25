# kernel-cli/config Specification

## Purpose

Configuration (`config`). The four-layer YAML configuration (D4, A-warstwy): `show` resolves it, `check` validates it, `schema` prints the JSON Schema, `set` writes one key.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/unknown-config-key",
  "why": "policy.budgets.retries is not declared by any module schema",
  "instead": [
    "bdk config schema policy",
    "bdk config set policy.budgets.task-redispatch <n>"
  ]
}
```

## Requirements

### Requirement: bdk config show

The resolved configuration after the four layers, with the origin of every key. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config show [<key>] [--origins]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<key>` (optional). Dotted key; default the whole tree.
  - `--origins`. Annotate each leaf with the layer it came from.
- **Behaviour:** Layers: bundle defaults < `~/.config/bdk/settings.yaml` < `.bdk/settings.yaml` < `.bdk/settings.local.yaml`; deep merge, arrays merged by `id` (A-warstwy, D4). Markdown values from `prompts/` are shown as their file path, not inlined.
- **Writes:** nothing
- **Output:** `schema/cli/output/config-show.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/unknown-config-key`, `policy/config-invalid`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config show policy.budgets --origins --json
  ```

  ```json
  {
    "key": "policy.budgets",
    "value": {
      "task-redispatch": 3,
      "verify-fix": 2,
      "review-fix": 2,
      "verifier": 2,
      "not-run": 3
    },
    "origins": {
      "policy.budgets.task-redispatch": "project",
      "policy.budgets.verify-fix": "default"
    }
  }
  ```

- **Owner:** T12
- **Slice:** `config`

#### Scenario: example run

- **WHEN** `bdk config show policy.budgets --origins --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/config-show.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/unknown-config-key

- **WHEN** a key no module schema declares
- **THEN** the exit code is 2 and the error object carries `rule: policy/unknown-config-key`

#### Scenario: policy/config-invalid

- **WHEN** a value fails its module schema
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid`

### Requirement: bdk config check

Validate every layer against the module schema registry; name unknown keys. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config check`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Writes the resolved snapshot to `.machine/` as a side effect of validation (a cache, not state; the command stays `read`). Run by `hooks session-start`; there its problems are content, not an exit code.
- **Writes:** nothing
- **Output:** `schema/cli/output/config-check.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/unknown-config-key`, `policy/config-invalid`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config check --json
  ```

  ```json
  {
    "valid": false,
    "problems": [
      {
        "layer": "project",
        "key": "policy.budgets.retries",
        "code": "unknown-key",
        "message": "unknown key; did you mean policy.budgets.task-redispatch?"
      }
    ],
    "snapshot": ".bdk/.machine/config/resolved.yaml",
    "overriddenKeys": []
  }
  ```

- **Owner:** T12
- **Slice:** `config`

#### Scenario: example run

- **WHEN** `bdk config check --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/config-check.json`

#### Scenario: policy/unknown-config-key

- **WHEN** a key no module schema declares
- **THEN** the exit code is 2 and the error object carries `rule: policy/unknown-config-key`

#### Scenario: policy/config-invalid

- **WHEN** a value fails its module schema
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid`

### Requirement: bdk config schema

Print the JSON Schema of the settings (the file committed under `schema/`) or of one module. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config schema [<module>] [--url]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<module>` (optional).
  - `--url`. Print only the versioned raw URL used in the yaml-language-server modeline.
- **Behaviour:** Exported from the zod registry on CI (R-format). `setup` writes the modeline; `hooks session-start` refreshes the offline copy.
- **Writes:** nothing
- **Output:** `schema/cli/output/config-schema.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config schema --url --json
  ```

  ```json
  {
    "schema": {},
    "url": "https://raw.githubusercontent.com/broneq/bdk/v3.0.0/schema/settings.json",
    "offlineCopy": ".bdk/.machine/schema/settings.json"
  }
  ```

- **Owner:** T12
- **Slice:** `config`

#### Scenario: example run

- **WHEN** `bdk config schema --url --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/config-schema.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk config set

Set one key in the project, local or global layer after validating the result. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config set <key> <value> [--global] [--local]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<key>` (required).
  - `<value>` (required). YAML scalar or inline collection.
  - `--global`. Write ~/.config/bdk/settings.yaml.
  - `--local`. Write .bdk/settings.local.yaml (gitignored).
- **Behaviour:** Without a layer flag the project layer is written. The key must exist in a module schema and the merged result must validate before anything is written. A local override that disables escalation shows up in the Change's D4b list at the next `change new` or `hooks session-start`.
- **Writes:** `.bdk/settings.yaml`, `.bdk/settings.local.yaml`, `~/.config/bdk/settings.yaml`, `.bdk/.machine/config/`
- **Output:** `schema/cli/output/config-set.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/unknown-config-key`, `policy/config-invalid`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config set policy.escalation.enabled false --local --json
  ```

  ```json
  {
    "key": "policy.escalation.enabled",
    "value": false,
    "previous": true,
    "layer": "local",
    "path": ".bdk/settings.local.yaml"
  }
  ```

- **Owner:** T12
- **Slice:** `config`

#### Scenario: example run

- **WHEN** `bdk config set policy.escalation.enabled false --local --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/config-set.json`

#### Scenario: policy/unknown-config-key

- **WHEN** a key no module schema declares
- **THEN** the exit code is 2 and the error object carries `rule: policy/unknown-config-key`

#### Scenario: policy/config-invalid

- **WHEN** a value fails its module schema
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid`
