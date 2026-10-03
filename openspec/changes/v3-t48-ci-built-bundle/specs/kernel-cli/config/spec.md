## MODIFIED Requirements

### Requirement: bdk config schema

Print the JSON Schema of the settings (the file `pnpm build` writes under `schema/`) or of one module. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk config schema [<module>] [--url]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<module>` (optional). The root key of one registered module, e.g. `tools`.
  - `--url`. Print only the versioned raw URL used in the yaml-language-server modeline.
- **Behaviour:** Prints the JSON Schema generated from the module registry, equal to the `schema/settings.json` of the same build for the running kernel (`kernel-settings`, Settings JSON Schema), or the part of one module. With `--url` the output carries the URL and the offline copy path but no schema. An unregistered module answers `input/not-found`.
- **Writes:** nothing
- **Output:** `schema/cli/output/config-schema.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk config schema --url --json
  ```

  ```json
  {
    "url": "https://raw.githubusercontent.com/broneq/bdk/dist-v3.0.0/schema/settings.json",
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
