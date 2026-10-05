## ADDED Requirements

### Requirement: Keys of run diagnostics

The settings SHALL declare the run diagnostics keys below, registered below the root `diagnostics` as one module per key, each with the slice that reads it (T47-D4, D5).

| Key                          | Type             | Default | Owner | Consumer      | v2 origin |
| ---------------------------- | ---------------- | ------- | ----- | ------------- | --------- |
| `diagnostics.verbose`        | boolean          | `false` | T47   | `hooks`       | none      |
| `diagnostics.repeat-refusal` | integer 2 to 50  | `3`     | T47   | `diagnostics` | none      |
| `diagnostics.repeat-read`    | integer 2 to 50  | `3`     | T47   | `diagnostics` | none      |
| `diagnostics.outlier-factor` | number 1.5 to 20 | `3`     | T47   | `diagnostics` | none      |

`diagnostics.verbose` switches the verbose log on from the next session start (`kernel-cli/hooks`, Run journal and verbose lines); set in `.bdk/settings.local.yaml` with `bdk config set diagnostics.verbose true --local`, it switches it on for one user only. The run journal and the deterministic report have no switch. `diagnostics.repeat-refusal` is how many times one rule must be refused in a session for detector D3; `diagnostics.repeat-read` is how many reads of one file by one agent make detector D5; `diagnostics.outlier-factor` is the multiple of the session median above which detector D8 flags a task's tokens or wall time (`kernel-cli/diagnostics`, bdk diagnostics report). There is no key for automatic model analysis: `/bdk:diagnose` runs only when the user invokes it (T47-D1).

#### Scenario: diagnostics defaults

- **WHEN** no layer sets a `diagnostics` key and `bdk config show diagnostics --json` runs
- **THEN** the exit code is 0 and the values are `verbose: false`, `repeat-refusal: 3`, `repeat-read: 3` and `outlier-factor: 3`

#### Scenario: verbose for one user

- **WHEN** `bdk config set diagnostics.verbose true --local` runs
- **THEN** `.bdk/settings.local.yaml` holds `diagnostics.verbose: true`, `.bdk/settings.yaml` is unchanged, and the text output says the setting applies from the next session

#### Scenario: threshold out of range

- **WHEN** `.bdk/settings.yaml` sets `diagnostics.repeat-refusal: 1`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `diagnostics.repeat-refusal`

#### Scenario: no analyze key

- **WHEN** `.bdk/settings.yaml` sets `diagnostics.analyze: always`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `diagnostics.analyze`
