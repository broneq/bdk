## MODIFIED Requirements

### Requirement: bdk config check

Validate every layer against the module schema registry; name unknown keys. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config check`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Validates every layer and the merged result (`kernel-settings`). An error (an unknown key, a value failing its module, an unknown prompt file, an unreadable file) exits 2 with the refusal of its rule: `why` names the first offending key, its layer and the file, and the count of further errors; `instead` names `bdk config schema <module>` and the file to fix. Without errors it exits 0 and reports warnings only: `missing-modeline` (a present YAML file without the yaml-language-server modeline), `schema-outdated` (a modeline pointing at another kernel version) and `legacy-settings` (`.bdk/settings.json` exists and is not read; `/bdk:setup` migrates it). As a side effect, in a project that has `.bdk/`, it writes the resolved snapshot and the offline schema copy under `.bdk/.machine/` (caches, not state; the command stays `read`); without `.bdk/` it writes nothing. The plugin's SessionStart hook runs it until `hooks session-start` (T13) takes over. `hooks session-start` (T13) runs the same validation and reports errors as content, not as an exit code.
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
- **THEN** the exit code is 0 and `problems` holds one `legacy-settings` entry naming `.bdk/settings.json` and `/bdk:setup`

#### Scenario: project without .bdk

- **WHEN** `bdk config check` runs in a git work tree without `.bdk/`
- **THEN** the exit code is 0 and no file is written
