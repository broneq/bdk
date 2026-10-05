## MODIFIED Requirements

### Requirement: setup migrates a v2 project

When `bdk doctor` reports the v2 layout, `/bdk:setup` SHALL migrate the project itself; no kernel command converts v2 state. It SHALL read `.bdk/settings.json` as detection hints, so the v2 commands are offered as the detected ones, write the confirmed settings through `bdk config set` like any other project, and import hand-written rules as for any other project. It SHALL then list the v2 files it found (`.bdk/settings.json`, `.bdk/plans/`, `.bdk/design/`, `.bdk/runs/`, `.bdk/verify-plan/`) and delete them only after the user confirms; an old design is not converted, and the skill names `/bdk:change` as the way to continue one. Whenever `bdk doctor` reports `bdk-ignored`, with or without the v2 layout, the skill SHALL show the ignore rule that covers `.bdk/settings.yaml` and, after the user confirms, remove that rule and add the kernel's two ignored paths (`/.bdk/.machine/`, `/.bdk/settings.local.yaml`) that no other rule covers, before it writes any setting; it SHALL commit the `.gitignore` edit in a commit of its own. A rule outside `.gitignore` (`.git/info/exclude`, a global excludes file) is named with its file, and the skill edits it only after the user confirms that file too.

#### Scenario: v2 layout

- **WHEN** `/bdk:setup` runs in a project whose `.bdk/settings.json` names `pytest` as the test command, and the user confirms the commands and the deletion
- **THEN** `.bdk/settings.yaml` holds a `tools.test` entry with the command `pytest`, `bdk config check` exits 0, `.bdk/settings.json` is gone and `bdk doctor --json` reports layout `v3`

#### Scenario: deletion declined

- **WHEN** the user declines the deletion of the v2 files
- **THEN** the v2 files stay, `.bdk/settings.yaml` is written, and the closing render names the `v2-layout` finding that `bdk doctor` still reports

#### Scenario: v2 ignore rule replaced

- **WHEN** `/bdk:setup` runs in a project whose `.gitignore` holds `/.bdk/` from v2 and the user confirms the replacement
- **THEN** `.gitignore` no longer holds `/.bdk/`, it holds `/.bdk/.machine/` and `/.bdk/settings.local.yaml`, `git check-ignore .bdk/settings.yaml` exits 1, and `bdk doctor --json` reports no `bdk-ignored` finding

#### Scenario: ignore rule replacement declined

- **WHEN** the user declines the replacement of the v2 ignore rule
- **THEN** `.gitignore` is unchanged and the closing render names the `bdk-ignored` finding and says that the files under `.bdk/` that BDK commits stay out of git
