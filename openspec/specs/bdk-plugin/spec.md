# bdk-plugin Specification

## Purpose

Defines the `bdk` plugin package: its manifest, the `bin/bdk` launcher, the build that turns the CLI source into one runnable file, and the marketplace entry that installs the released plugin.

## Requirements

### Requirement: Plugin manifest passes strict validation

`plugins/bdk/.claude-plugin/plugin.json` SHALL name the plugin `bdk` and hold its `version`, `description` and `author`, and `claude plugin validate plugins/bdk --strict` SHALL pass. The `version` field SHALL be the only place the plugin's version is written; no other file in `plugins/bdk/` SHALL hold it.

#### Scenario: Strict validation

- **WHEN** `claude plugin validate plugins/bdk --strict` runs on a clean checkout
- **THEN** it reports that validation passed, with no warning

#### Scenario: One version

- **WHEN** the files of `plugins/bdk/` outside `.claude-plugin/plugin.json` are searched for the plugin's version string
- **THEN** none holds it, `package.json` included

### Requirement: Build produces one runnable file

Building the plugin (`pnpm build` at the root, or `pnpm run build` in `plugins/bdk/`) SHALL write `plugins/bdk/dist/bdk.mjs`, one file that runs on Node 22.18 or later with no `node_modules` next to it, with the plugin version from `.claude-plugin/plugin.json` built in. `dist/` SHALL never be committed.

#### Scenario: Bundle runs alone

- **WHEN** `dist/bdk.mjs` is copied with `bin/` and `.claude-plugin/` into an empty directory outside the workspace and run with `--version`
- **THEN** it prints the version from `plugin.json` and exits 0

#### Scenario: dist is ignored

- **WHEN** the plugin is built and `git status` runs
- **THEN** no path under `plugins/bdk/dist/` is listed

### Requirement: Launcher runs the CLI from any directory

`plugins/bdk/bin/bdk` SHALL run `dist/bdk.mjs` of its own plugin directory with Node, passing every argument and the exit code through, whatever the working directory and whether it is called by its path or through a symbolic link. When Node is not on `PATH` or `dist/bdk.mjs` is missing, it SHALL print one line on stderr naming the missing piece and how to repair it, and exit with the environment error code of `bdk-cli` (3).

#### Scenario: Version from a test project

- **WHEN** the plugin is built and `bin/bdk --version` runs with a separate test project as the working directory
- **THEN** it prints the version from `plugins/bdk/.claude-plugin/plugin.json` and exits 0

#### Scenario: Called through a symbolic link

- **WHEN** a symbolic link to `bin/bdk` in another directory is run with `--version`
- **THEN** it prints the same version and exits 0

#### Scenario: Bundle missing

- **WHEN** `bin/bdk` runs in a plugin directory without `dist/bdk.mjs`
- **THEN** it prints one line on stderr naming `dist/bdk.mjs` and the repair (`pnpm build` in development, reinstalling the plugin otherwise) and exits 3

### Requirement: Marketplace entry installs the released plugin

The `bdk` entry of `.claude-plugin/marketplace.json` SHALL install `plugins/bdk` from this repository's `release` branch, and `claude plugin validate .claude-plugin/marketplace.json --strict` SHALL pass.

#### Scenario: Entry points at the release branch

- **WHEN** the `bdk` entry of `.claude-plugin/marketplace.json` is read
- **THEN** its source is a `git-subdir` of `broneq/bdk` with `path` `plugins/bdk` and `ref` `release`

#### Scenario: Marketplace stays valid

- **WHEN** `claude plugin validate .claude-plugin/marketplace.json --strict` runs
- **THEN** it reports that validation passed

### Requirement: No run file named like a refused report

No file that a skill, an agent or the CLI of the `bdk` plugin writes SHALL have a base name matching `^(REPORT|SUMMARY|FINDINGS|ANALYSIS).*\.md$`, compared without regard to case: Claude Code refuses a subagent's `Write` to such a file ("Subagents should return findings as text, not write report files"), and every BDK block may run as a subagent. A test of the plugin SHALL fail when a Markdown file name in the text of `skills/`, `agents/` or the CLI source outside its tests matches the pattern.

#### Scenario: Plugin text names no refused file

- **WHEN** the plugin's tests run on a clean checkout
- **THEN** the check of file names passes, and no file name in `skills/`, `agents/` or `src/` outside its tests matches the pattern

#### Scenario: A refused name is caught

- **WHEN** a skill's text names `execute/summary.md` or `review/round-1/Report.md` as a file it writes
- **THEN** the check fails and names the skill file and the file name

#### Scenario: Review round eval writes its record

- **WHEN** the orchestrator case `auto-review-first-round` runs, where the round runs in a `bdk:lead` subagent and the judge in a subagent under it
- **THEN** `.bdk/runs/monthly-report/review/round-1/review.md` exists after the run

### Requirement: Every Agent call names its run mode

Every `Agent` call that a skill or an agent of the `bdk` plugin writes SHALL name its run mode as the `run_in_background` parameter, because a host that gets no value may start the agent in the background. An agent the caller waits for SHALL be started with `run_in_background: false`: every worker a `bdk:lead` starts (`bdk:implementer`, `bdk:conformer`, `bdk:reviewer`, `bdk:integration-reviewer`, `bdk:e2e-tester`, `bdk:judge`), every block an orchestrator starts, and the agent a block starts when it is typed in the main thread. Only an orchestrator that starts a `bdk:lead` with `execution.lead: background` SHALL pass `run_in_background: true`; with `execution.lead: foreground` it SHALL pass `run_in_background: false`. A `bdk:lead` SHALL NOT read or poll a worker's task output file and SHALL NOT sleep to wait for a worker. A workspace test SHALL fail and name the skill and the agent when a paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` names neither `run_in_background: false` nor `run_in_background: true`.

#### Scenario: Every skill names the run mode

- **WHEN** the plugin's tests run on a clean checkout
- **THEN** the run-mode check passes: every paragraph of a `SKILL.md` that starts `subagent_type: "bdk:<agent>"` names `run_in_background: false` or `run_in_background: true`

#### Scenario: A call without a run mode is caught

- **WHEN** a paragraph of `skills/review-round/SKILL.md` starts `subagent_type: "bdk:reviewer"` and names no `run_in_background` value
- **THEN** the check fails and names `review-round: reviewer`

#### Scenario: Review workers run in the foreground

- **WHEN** `/bdk:debug` runs on the `debug-fix` scaffold to its review round
- **THEN** the meta file of every worker the review lead starts reads `"requestShape":"foreground"`, and `bdk diagnostics report` for the session lists no `slow-call` for the review lead
