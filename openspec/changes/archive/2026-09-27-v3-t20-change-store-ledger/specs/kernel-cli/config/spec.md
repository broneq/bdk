# Spec Delta

## MODIFIED Requirements

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
- **Behaviour:** Without a layer flag the project layer is written; both flags together answer `input/invalid-argument`. The key must be declared by a module and the merged result of all layers must validate before anything is written; a refused set leaves every file unchanged. The edit keeps the file's comments, key order and modeline; a file that does not exist yet is created with the modeline as its first line. The write is atomic. A local override that disables a policy shows up in the overridden-key list of the snapshot, and `change new` records it in the Change. Every successful set first completes the project `.gitignore` through the ignored-paths rule (`kernel-state`, Ignored paths), so `.bdk/settings.local.yaml` and `.bdk/.machine/` are never committable once `/bdk:setup` ran.
- **Writes:** `.bdk/settings.yaml`, `.bdk/settings.local.yaml`, the global layer file, `.bdk/.machine/config/`, `.gitignore`
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

#### Scenario: local layer is ignored

- **WHEN** `bdk config set features.lavish false --local` runs in a repository whose `.gitignore` names no `.bdk` path
- **THEN** `.gitignore` gains exactly `/.bdk/.machine/` and `/.bdk/settings.local.yaml`, and `git check-ignore .bdk/settings.local.yaml` succeeds
