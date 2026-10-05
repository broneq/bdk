## MODIFIED Requirements

### Requirement: setup brings a project to a working layout

`/bdk:setup` SHALL leave the project with a `.bdk/settings.yaml` that `bdk config check` accepts and a `bdk doctor` run with `ok: true`, or report each remaining `doctor` finding with its repair action. It SHALL write every settings key through `bdk config set`, so the kernel validates the value, keeps the schema modeline as the first line and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`.

The skill SHALL detect the project's languages and the `test`, `lint` and `build` commands from the project files, ask the user to confirm only the full commands, and derive every entry's `tier` and scoped forms from the runner without a question. It SHALL ask nothing the kernel measures or derives.

When the project has no tool of the `test` or `lint` group, the skill SHALL ask the user whether the project runs without one, and on a yes SHALL run `bdk config set tools.<group> none`; it SHALL never leave either group unset, because `bdk change new` refuses an unset group (`kernel-cli/change`, bdk change new; T49).

#### Scenario: fresh TypeScript project

- **WHEN** `/bdk:setup` runs in a git repository with a `package.json` whose scripts are `test` (vitest) and `lint` (eslint), no `.bdk/` and a `pnpm-lock.yaml`, and the user confirms the detected commands
- **THEN** `.bdk/settings.yaml` starts with the modeline, holds a `tools.test` entry with id `vitest`, tier `fast` and a `scoped` form containing `{files}`, and a `tools.lint` entry with id `eslint` and tier `lint`; `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true`

#### Scenario: project without a linter

- **WHEN** `/bdk:setup` runs in a project whose files name a test runner and no linter, and the user answers that the project has no linter
- **THEN** `.bdk/settings.yaml` holds the test entry and `lint: none` under `tools`, and `bdk change new` afterwards does not refuse with `policy/tools-unset`

#### Scenario: settings already present

- **WHEN** `/bdk:setup` runs where `.bdk/settings.yaml` exists
- **THEN** the skill shows the current values and changes a key only after the user asks for it
