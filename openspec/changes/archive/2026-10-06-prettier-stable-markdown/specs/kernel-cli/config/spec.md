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
- **Behaviour:** Without a layer flag the project layer is written; both flags together answer `input/invalid-argument`. An item of an array merged by `id` that the layer already holds is replaced whole when the key ends at its `id`, and keeps its `id` (T49); a missing item is appended with that `id`. The key must be declared by a module and the merged result of all layers must validate before anything is written; a refused set leaves every file unchanged. The edit keeps the file's comments, key order and modeline; a file that does not exist yet is created with the modeline as its first line. The write is atomic. A local override that disables a policy shows up in the overridden-key list of the snapshot, and `change new` records it in the Change. Every successful set first completes the project `.gitignore` through the ignored-paths rule (`kernel-state`, Ignored paths), so `.bdk/settings.local.yaml` and `.bdk/.machine/` are never committable once `/bdk:setup` ran. Before its first write it creates `.bdk/.prettierrc` when the file is absent and never changes an existing one (`kernel-state`, Formatter guard).
- **Writes:** `.bdk/settings.yaml`, `.bdk/settings.local.yaml`, the global layer file, `.bdk/.machine/config/`, `.gitignore`, `.bdk/.prettierrc`
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

#### Scenario: an existing item replaced by its id

- **WHEN** the project layer holds `tools.test` item `vitest` and `bdk config set tools.test.vitest '{tier: fast, command: npx vitest run}'` runs
- **THEN** the exit code is 0, `previous` is the old item, and the layer holds one item `{id: vitest, tier: fast, command: npx vitest run}`

#### Scenario: a tool group declared none

- **WHEN** `bdk config set tools.lint none` runs, then `bdk config set tools.lint.eslint '{tier: lint, command: eslint .}'`
- **THEN** both exit 0; after the first the layer holds `tools.lint: none`, after the second a list with the one item `eslint`

#### Scenario: formatter guard created

- **WHEN** `bdk config set tools.lint none` runs successfully in a project without `.bdk/.prettierrc`
- **THEN** `.bdk/.prettierrc` exists with the guard content of `kernel-state`, Formatter guard, and running the command again leaves its bytes unchanged
