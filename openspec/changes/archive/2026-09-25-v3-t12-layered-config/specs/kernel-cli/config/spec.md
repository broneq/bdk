# Spec Delta

## MODIFIED Requirements

### Requirement: bdk config show

The resolved configuration after the four layers, with the origin of every key. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config show [<key>] [--origins]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<key>` (optional). Dotted key; default the whole tree. An element of an array merged by `id` is addressed by its `id` as a path segment (`tools.test.unit.scoped`).
  - `--origins`. Annotate each leaf with the layer it came from.
- **Behaviour:** Resolves the layers and the merge of `kernel-settings`, validates the result against the module registry, then prints the value at `<key>`. A prompt value (`kernel-settings`, Prompt values) is shown as the list of files that contribute to it and its effective mode, never inlined. Text mode prints the value as YAML, so a skill's `!` block can read a tool list as is. `layers` lists every file layer, lowest first, with its path and whether the file is present. A key the registry declares that no layer sets and that has no default answers `input/not-found`.
- **Writes:** nothing
- **Output:** `schema/cli/output/config-show.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/unknown-config-key`, `policy/config-invalid`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config show tools.test --origins --json
  ```

  ```json
  {
    "key": "tools.test",
    "value": [
      {
        "id": "unit",
        "tier": "fast",
        "command": "pnpm test:unit",
        "scoped": "pnpm vitest run {files}"
      }
    ],
    "origins": {
      "tools.test.unit.tier": "project",
      "tools.test.unit.command": "project",
      "tools.test.unit.scoped": "local"
    },
    "layers": [
      {
        "layer": "global",
        "path": "/home/dev/.config/bdk/settings.yaml",
        "present": false
      },
      { "layer": "project", "path": ".bdk/settings.yaml", "present": true },
      { "layer": "local", "path": ".bdk/settings.local.yaml", "present": true }
    ]
  }
  ```

- **Owner:** T12
- **Slice:** `config`

#### Scenario: example run

- **WHEN** `bdk config show tools.test --origins --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/config-show.json`

#### Scenario: input/not-found

- **WHEN** the key is declared by a module but no layer sets it and it has no default
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/unknown-config-key

- **WHEN** the requested key, or a key in any layer, is not declared by any module
- **THEN** the exit code is 2 and the error object carries `rule: policy/unknown-config-key`

#### Scenario: policy/config-invalid

- **WHEN** a value in any layer fails its module schema
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid`

### Requirement: bdk config check

Validate every layer against the module schema registry; name unknown keys. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config check`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Validates every layer and the merged result (`kernel-settings`). An error (an unknown key, a value failing its module, an unknown prompt file, an unreadable file) exits 2 with the refusal of its rule: `why` names the first offending key, its layer and the file, and the count of further errors; `instead` names `bdk config schema <module>` and the file to fix. Without errors it exits 0 and reports warnings only: `missing-modeline` (a present YAML file without the yaml-language-server modeline), `schema-outdated` (a modeline pointing at another kernel version) and `legacy-settings` (`.bdk/settings.json` exists and is not read; `bdk import` converts it). As a side effect, in a project that has `.bdk/`, it writes the resolved snapshot and the offline schema copy under `.bdk/.machine/` (caches, not state; the command stays `read`); without `.bdk/` it writes nothing. The plugin's SessionStart hook runs it until `hooks session-start` (T13) takes over. `hooks session-start` (T13) runs the same validation and reports errors as content, not as an exit code.
- **Writes:** nothing
- **Output:** `schema/cli/output/config-check.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/unknown-config-key`, `policy/config-invalid`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config check --json
  ```

  ```json
  {
    "problems": [
      {
        "layer": "local",
        "path": ".bdk/settings.local.yaml",
        "code": "missing-modeline",
        "message": "no yaml-language-server modeline; bdk doctor --fix adds it"
      }
    ],
    "snapshot": ".bdk/.machine/config/resolved.yaml",
    "overriddenKeys": ["features.lavish"]
  }
  ```

- **Owner:** T12
- **Slice:** `config`

#### Scenario: example run

- **WHEN** `bdk config check --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/config-check.json`

#### Scenario: policy/unknown-config-key

- **WHEN** a layer holds a key no module declares
- **THEN** the exit code is 2 and the error object carries `rule: policy/unknown-config-key`, with the key, the layer and the file in `why`

#### Scenario: policy/config-invalid

- **WHEN** a value in a layer fails its module schema
- **THEN** the exit code is 2 and the error object carries `rule: policy/config-invalid`, with the key, the layer and the file in `why`

#### Scenario: warnings only

- **WHEN** every layer validates and the project layer has no modeline
- **THEN** the exit code is 0 and `problems` holds one `missing-modeline` entry for that file

#### Scenario: v2 settings file left behind

- **WHEN** every layer validates and the project still has `.bdk/settings.json`
- **THEN** the exit code is 0 and `problems` holds one `legacy-settings` entry naming `.bdk/settings.json` and `bdk import`

#### Scenario: project without .bdk

- **WHEN** `bdk config check` runs in a git work tree without `.bdk/`
- **THEN** the exit code is 0 and no file is written

### Requirement: bdk config schema

Print the JSON Schema of the settings (the file committed under `schema/`) or of one module. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config schema [<module>] [--url]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<module>` (optional). The root key of one registered module, e.g. `tools`.
  - `--url`. Print only the versioned raw URL used in the yaml-language-server modeline.
- **Behaviour:** Prints the JSON Schema generated from the module registry, equal to the committed `schema/settings.json` for the running kernel (`kernel-settings`, Settings JSON Schema), or the part of one module. With `--url` the output carries the URL and the offline copy path but no schema. An unregistered module answers `input/not-found`.
- **Writes:** nothing
- **Output:** `schema/cli/output/config-schema.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config schema --url --json
  ```

  ```json
  {
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

- **WHEN** `<module>` names no registered module
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk config set

Set one key in the project, local or global layer after validating the result. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config set <key> <value> [--global] [--local]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<key>` (required). Dotted key; array elements merged by `id` are addressed by `id`.
  - `<value>` (required). YAML scalar or inline collection.
  - `--global`. Write the global layer file (`kernel-settings`, Configuration layers).
  - `--local`. Write .bdk/settings.local.yaml (gitignored).
- **Behaviour:** Without a layer flag the project layer is written; both flags together answer `input/invalid-argument`. The key must be declared by a module and the merged result of all layers must validate before anything is written; a refused set leaves every file unchanged. The edit keeps the file's comments, key order and modeline; a file that does not exist yet is created with the modeline as its first line. The write is atomic. A local override that disables a policy shows up in the overridden-key list of the snapshot, and T20 records it in the Change.
- **Writes:** `.bdk/settings.yaml`, `.bdk/settings.local.yaml`, the global layer file, `.bdk/.machine/config/`
- **Output:** `schema/cli/output/config-set.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/unknown-config-key`, `policy/config-invalid`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config set features.lavish false --local --json
  ```

  ```json
  {
    "key": "features.lavish",
    "value": false,
    "previous": true,
    "layer": "local",
    "path": ".bdk/settings.local.yaml"
  }
  ```

- **Owner:** T12
- **Slice:** `config`

#### Scenario: example run

- **WHEN** `bdk config set features.lavish false --local --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/config-set.json`

#### Scenario: policy/unknown-config-key

- **WHEN** the key is not declared by any module
- **THEN** the exit code is 2, the error object carries `rule: policy/unknown-config-key` and no file changes

#### Scenario: policy/config-invalid

- **WHEN** the value fails the key's module schema
- **THEN** the exit code is 2, the error object carries `rule: policy/config-invalid` and no file changes

#### Scenario: comments survive

- **WHEN** `bdk config set` edits a project file that holds comments and the modeline
- **THEN** the file keeps its comments, the modeline and the order of the other keys, and only the edited value differs
