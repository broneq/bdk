## Purpose

The stage skills of the `bdk` plugin (`setup`, `change`, `design`, `verify-design`, `plan`, `verify-plan`, `execute`, `close`, `run`): the contract every one of them keeps, and what each one does for the user. The kernel holds the order of the work and every write of state; a stage skill asks the kernel, does the part only a model can do, and reports what the kernel answered.

## ADDED Requirements

### Requirement: Stage skill shape

Every stage skill SHALL live at `skills/stages/<name>/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists, and SHALL:

- start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill (`ctx skill <name>`) or `next`, and list the `allowed-tools` pair of `kernel-cli`, Invocation;
- set `disable-model-invocation: true`, so only the user starts it;
- stay at or below 200 lines in `SKILL.md`, with longer reference material in `references/` beside it;
- name BDK skills and agents with the `/bdk:` and `bdk:` namespace and name no model;
- write state only through kernel commands, never by editing a file under `.bdk/` by hand.

No two skills of the plugin SHALL share a name, so `/bdk:<name>` resolves to exactly one skill.

#### Scenario: a stage skill over the limit

- **WHEN** a `SKILL.md` under `skills/stages/` has 201 lines
- **THEN** `pnpm skill-check` reports an error for that file

#### Scenario: one skill per name

- **WHEN** the plugin is loaded with `skills/stages/setup/` present
- **THEN** no other directory of the plugin holds a skill named `setup`, and `claude plugin validate` passes

### Requirement: Kernel refusals in a stage skill

A stage skill SHALL act on the kernel's exit code as `kernel-cli`, Exit codes and the error object, defines it: on exit 2 it follows the refusal's `instead` and never repeats the refused command unchanged; on exit 3 it corrects the argument the error names, using `<command> --help`; on a `BDK STOP` line or exit 4 or 5 it stops and reports the kernel's output to the user.

#### Scenario: refusal followed

- **WHEN** `bdk change new` answers exit 2 with `rule: policy/change-exists` during `/bdk:change <intent>`
- **THEN** the skill does not run `bdk change new` again unchanged and tells the user the active Change and the commands of `instead`

### Requirement: Closing render

A stage skill SHALL end its turn with a short report that names the command the user types next, taken from the kernel's output (`next` of the command it ran, or the gate status of `bdk change status`), and the pending `review: true` entries the kernel lists, so the user sees them before typing the next stage command (design, "UX Touchpoints").

#### Scenario: after a new Change

- **WHEN** `/bdk:change "Add passwordless login"` opens a `feature` Change
- **THEN** the skill's last message names `/bdk:design`, the `next` value of `bdk change new`

### Requirement: setup brings a project to a working layout

`/bdk:setup` SHALL leave the project with a `.bdk/settings.yaml` that `bdk config check` accepts and a `bdk doctor` run with `ok: true`, or report each remaining `doctor` finding with its repair action. It SHALL write every settings key through `bdk config set`, so the kernel validates the value, keeps the schema modeline as the first line and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`.

The skill SHALL detect the project's languages and the `test`, `lint` and `build` commands from the project files, ask the user to confirm only the full commands, and derive every entry's `tier` and scoped forms from the runner without a question. It SHALL ask nothing the kernel measures or derives.

#### Scenario: fresh TypeScript project

- **WHEN** `/bdk:setup` runs in a git repository with a `package.json` whose scripts are `test` (vitest) and `lint` (eslint), no `.bdk/` and a `pnpm-lock.yaml`, and the user confirms the detected commands
- **THEN** `.bdk/settings.yaml` starts with the modeline, holds a `tools.test` entry with id `vitest`, tier `fast` and a `scoped` form containing `{files}`, and a `tools.lint` entry with id `eslint` and tier `lint`; `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true`

#### Scenario: settings already present

- **WHEN** `/bdk:setup` runs where `.bdk/settings.yaml` exists
- **THEN** the skill shows the current values and changes a key only after the user asks for it

### Requirement: setup migrates a v2 project

When `bdk doctor` reports the v2 layout, `/bdk:setup` SHALL migrate the project itself; no kernel command converts v2 state. It SHALL read `.bdk/settings.json` as detection hints, so the v2 commands are offered as the detected ones, write the confirmed settings through `bdk config set` like any other project, and import hand-written rules as for any other project. It SHALL then list the v2 files it found (`.bdk/settings.json`, `.bdk/plans/`, `.bdk/design/`, `.bdk/runs/`, `.bdk/verify-plan/`) and delete them only after the user confirms; an old design is not converted, and the skill names `/bdk:change` as the way to continue one.

#### Scenario: v2 layout

- **WHEN** `/bdk:setup` runs in a project whose `.bdk/settings.json` names `pytest` as the test command, and the user confirms the commands and the deletion
- **THEN** `.bdk/settings.yaml` holds a `tools.test` entry with the command `pytest`, `bdk config check` exits 0, `.bdk/settings.json` is gone and `bdk doctor --json` reports layout `v3`

#### Scenario: deletion declined

- **WHEN** the user declines the deletion of the v2 files
- **THEN** the v2 files stay, `.bdk/settings.yaml` is written, and the closing render names the `v2-layout` finding that `bdk doctor` still reports

### Requirement: setup checks Lavish

`/bdk:setup` SHALL check whether `npx -y lavish-axi --help` succeeds. When it fails, the skill SHALL offer to install Lavish and, when the user declines, set `features.lavish` to `false` through `bdk config set` (T02 R-11).

#### Scenario: Lavish missing and declined

- **WHEN** `npx -y lavish-axi --help` fails and the user declines the install
- **THEN** `bdk config show features.lavish --json` reports `false` from the project layer

### Requirement: setup imports hand-written rules

When the project has hand-written `.claude/rules/*.md` files (any file other than the generated `bdk-generated*.md`), `/bdk:setup` SHALL show `bdk rules import --dry-run`, run `bdk rules import` only after the user confirms, and then offer to delete the imported source files, since the projection carries their rules. The `BDK-*` pack SHALL never be imported: the kernel reads it from the plugin.

#### Scenario: one rules file

- **WHEN** the project has `.claude/rules/api-style.md` with two top-level bullets and the user confirms the import
- **THEN** `.bdk/rules/` holds `API-STYLE-1` and `API-STYLE-2` with `origin: import`, and `.claude/rules/bdk-generated.md` lists both

### Requirement: setup on Claude Code exports no adapters

On Claude Code `/bdk:setup` SHALL NOT run `bdk export agents`: the adapters ship in the plugin's `agents/`, and a copy in the project would register each adapter twice.

#### Scenario: no project adapters

- **WHEN** `/bdk:setup` finishes on Claude Code
- **THEN** the project has no `.claude/agents/` file written by BDK

### Requirement: change opens a Change

`/bdk:change <intent>` SHALL open a Change with `bdk change new`. Before the call it SHALL ask the user whether to create a new branch (`feat/<slug>`, or `fix/<slug>` for a bug) or to stay on the current branch, on every branch, and SHALL create the chosen branch with git before the call.

The skill SHALL pass `--kind bug` when the intent reports a defect, and SHALL pass `--profile tiny --reason <why>` only when every item of the `tiny` checklist holds after it has read the code the intent touches (T20 design D-11): no new or changed behaviour visible to a user or an API, no change to a data model, schema or configuration, no spec impact, and at most 2 files in 1 module. Any doubt SHALL leave the profile to the kernel's `small` default. The skill SHALL NOT pass `--inferred`; that flag belongs to the skills that open a Change on the user's behalf.

#### Scenario: new branch chosen

- **WHEN** `/bdk:change "Add a --verbose flag to the CLI"` runs on `main` and the user chooses a new branch
- **THEN** the Change is bound to the branch `feat/<slug>`, and `main` has no active Change

#### Scenario: current branch kept

- **WHEN** the user chooses to stay on the current branch `work`
- **THEN** the Change is bound to `work` and no branch is created

#### Scenario: tiny Change

- **WHEN** the intent is "Fix the typo 'recieve' in README.md" and the typo occurs in that one file
- **THEN** `change.md` carries `profile: tiny` and the profile assumption entry's body states why each checklist item holds

#### Scenario: doubt stays small

- **WHEN** the intent adds an option to a command that users run
- **THEN** `bdk change new` runs without `--profile`, and `change.md` carries `profile: small`

#### Scenario: bug intent

- **WHEN** the intent is "Login fails after a password reset"
- **THEN** `change.md` carries `kind: bug` and the closing render names `/bdk:plan`

### Requirement: change shows and moves a Change

`/bdk:change` SHALL map its arguments to kernel commands: no argument renders `bdk change status`; `list` runs `bdk change list`; `resume <id> [--option <n>]`, `park [--reason <text>]` and `takeover` run the kernel command of the same name. An argument that is none of these is an intent and opens a Change. When a parked Change has options, the skill SHALL show them with the single resume command the kernel prints.

#### Scenario: status

- **WHEN** `/bdk:change` runs without arguments on a branch with an active Change at stage `design`
- **THEN** the skill reports the stage, the gate status and the command to type next as `bdk change status` gives them, and writes nothing

#### Scenario: parked Change

- **WHEN** `/bdk:change` runs on a branch whose Change is parked with two options
- **THEN** the skill lists both options and the `bdk change resume <id> --option <n>` command the kernel names
