## MODIFIED Requirements

### Requirement: Configuration layers

The kernel SHALL resolve the configuration from four layers, higher wins: bundle defaults < global < project (`.bdk/settings.yaml`) < local (`.bdk/settings.local.yaml`), named `default`, `global`, `project` and `local` in every output.

The global layer file is `$XDG_CONFIG_HOME/bdk/settings.yaml` when `XDG_CONFIG_HOME` is set and absolute, `%APPDATA%\bdk\settings.yaml` on Windows, and `~/.config/bdk/settings.yaml` otherwise. The project root is the directory `findProjectRoot` resolves (the nearest directory holding `.bdk/` up to the work tree root). An absent file is skipped; an empty file is an empty layer. A file that is not valid YAML, or whose top level is not a mapping, answers `policy/config-invalid` naming the file and, for a syntax error, the line. The default layer is the defaults of the registered modules, compiled into the bundle. `.bdk/settings.json` (v2) is never read; `/bdk:setup` migrates it.

#### Scenario: precedence

- **WHEN** the global, project and local files each set `features.lavish` to a different value
- **THEN** `bdk config show features.lavish --origins --json` returns the local value with origin `local`

#### Scenario: XDG_CONFIG_HOME

- **WHEN** `XDG_CONFIG_HOME` points at a directory holding `bdk/settings.yaml`
- **THEN** that file is the global layer and `~/.config/bdk/settings.yaml` is not read

#### Scenario: Windows

- **WHEN** the kernel runs on Windows with `APPDATA` set and `XDG_CONFIG_HOME` unset
- **THEN** the global layer file is `%APPDATA%\bdk\settings.yaml`

#### Scenario: YAML syntax error

- **WHEN** `.bdk/settings.yaml` holds a syntax error on line 3
- **THEN** every `config` command exits 2 with `rule: policy/config-invalid` and `why` naming the file and line 3
