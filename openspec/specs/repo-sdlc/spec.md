# repo-sdlc Specification

## Purpose

Defines the development workflow of the BDK repository: how a task runs as an OpenSpec Change, and how CI keeps the living specs valid.

## Requirements

### Requirement: Main specs are validated on every pull request
CI SHALL run `openspec validate --specs --strict` with OpenSpec 1.13.2 on every pull request, and the run SHALL fail when any main spec under `openspec/specs/` fails strict validation.

#### Scenario: Valid main specs
- **WHEN** a pull request leaves every main spec under `openspec/specs/` valid in strict mode
- **THEN** the `openspec` CI job passes

#### Scenario: Invalid main spec
- **WHEN** a pull request adds a requirement without a scenario to a main spec
- **THEN** the `openspec` CI job fails and names the invalid spec

### Requirement: OpenSpec workflow commands are installed
The repository SHALL ship the OpenSpec 1.13.2 workflows `propose`, `explore`, `new`, `continue`, `apply`, `update`, `ff`, `sync`, `archive` and `verify` for Claude Code, as `/opsx:<workflow>` commands and `openspec-*` skills, so that a contributor who opens Claude Code in the repository can run a task as an OpenSpec Change without installing anything into the repository.

#### Scenario: Propose creates a Change
- **WHEN** a contributor runs `/opsx:propose` with a name of the form `v3-<N>-<slug>` in this repository
- **THEN** a Change with that name exists under `openspec/changes/` with its proposal, specs, design and tasks

#### Scenario: Fast-forward and verify are available
- **WHEN** a contributor lists the `/opsx:` commands in Claude Code in this repository
- **THEN** `/opsx:ff` and `/opsx:verify` are among them

### Requirement: Project context and artifact rules apply to every Change
`openspec/config.yaml` SHALL hold the v3 project context and per-artifact rules, so that `openspec instructions` returns them for every artifact of every Change.

#### Scenario: Rules reach the proposal
- **WHEN** a contributor runs `openspec instructions proposal --change <name> --json`
- **THEN** the output carries the project context and the proposal rules, including the `v3-<N>-<slug>` naming rule

### Requirement: Pull requests run the required checks within five minutes
Every pull request SHALL run the jobs `openspec`, `check`, `plugins`, `commitlint`, `docs` and `docs-impact` on Linux, in parallel, and all of them SHALL finish within 5 minutes of wall-clock time on a pull request that does not change dependencies. These six jobs SHALL be required status checks on `main` and `staging/v3`.

#### Scenario: Required checks on a pull request
- **WHEN** a contributor opens a pull request into `staging/v3`
- **THEN** the jobs `openspec`, `check`, `plugins`, `commitlint`, `docs` and `docs-impact` run on `ubuntu-latest` and each finishes within 5 minutes

#### Scenario: A failed required check blocks the merge
- **WHEN** any of `openspec`, `check`, `plugins`, `commitlint`, `docs` or `docs-impact` fails on a pull request
- **THEN** GitHub does not allow the pull request to merge

### Requirement: The check job lints, formats, typechecks, tests and builds the workspace
The `check` job SHALL install the pnpm workspace from its lockfile and run, over every workspace package, lint with zero warnings, a format check, a typecheck, the vitest suite and the build. A contributor SHALL be able to run the same sequence locally with one command, `pnpm check`.

#### Scenario: Type error
- **WHEN** a pull request adds a TypeScript file with a type error
- **THEN** the `check` job fails at the typecheck step

#### Scenario: Unformatted file
- **WHEN** a pull request adds a TypeScript, JSON or YAML file that prettier would rewrite
- **THEN** the `check` job fails at the format step

#### Scenario: Same checks locally
- **WHEN** a contributor runs `pnpm check` at the repository root
- **THEN** the lint, format, typecheck, test and build steps of the `check` job run in that order and the command exits non-zero on the first failure

### Requirement: The plugins job validates the marketplace and every plugin
The `plugins` job SHALL run `claude plugin validate --strict`, with the Claude Code version pinned in the lockfile, on `.claude-plugin/marketplace.json` and on every directory under `plugins/`, and SHALL fail when any of them fails.

#### Scenario: Invalid plugin manifest
- **WHEN** a pull request adds a `plugins/<name>/.claude-plugin/plugin.json` that strict validation rejects
- **THEN** the `plugins` job fails and its log names that plugin directory

#### Scenario: Valid repository
- **WHEN** a pull request leaves the marketplace and every plugin directory valid in strict mode
- **THEN** the `plugins` job passes

### Requirement: Commits follow Conventional Commits
The `commitlint` job SHALL check every commit of the pull request, from its base to its head, against the Conventional Commits rules of `@commitlint/config-conventional`, because release-please derives versions and changelogs from them.

#### Scenario: Non-conventional commit
- **WHEN** a pull request contains a commit with the subject `update stuff`
- **THEN** the `commitlint` job fails and names that commit

#### Scenario: Conventional commits
- **WHEN** every commit of a pull request has a subject such as `feat(skills): add design block`
- **THEN** the `commitlint` job passes

### Requirement: The docs site builds when its inputs change
The `docs` job SHALL build the VitePress site in `docs/` when a pull request changes a file under `docs/`, `pnpm-lock.yaml` or `.github/workflows/pr.yml`, and SHALL pass without building otherwise. A failed build SHALL fail the job.

#### Scenario: Docs change with a broken link
- **WHEN** a pull request adds a page under `docs/` that links to a page that does not exist
- **THEN** the `docs` job builds the site and fails

#### Scenario: No docs change
- **WHEN** a pull request changes no file under `docs/`, `pnpm-lock.yaml` or `.github/workflows/pr.yml`
- **THEN** the `docs` job passes without building the site

### Requirement: Every plugin directory is a release component
The workspace tests SHALL fail unless the directories under `plugins/` that hold `.claude-plugin/plugin.json` and the packages of `release-please-config.json` are the same set, and every package's `component` equals its directory name.

#### Scenario: Plugin without a release entry
- **WHEN** a pull request adds `plugins/<name>/.claude-plugin/plugin.json` without a `plugins/<name>` package in `release-please-config.json`
- **THEN** the `check` job fails at the test step and names `<name>`

#### Scenario: Release entry without a plugin
- **WHEN** `release-please-config.json` lists a package whose directory holds no `.claude-plugin/plugin.json`
- **THEN** the `check` job fails at the test step and names that package

### Requirement: A plugin's only version file is its manifest
The workspace tests SHALL fail when a directory under `plugins/` holds a `version.txt`. Release type `simple` bumps a `version.txt` that exists, which would give the plugin a second version next to `version` in `.claude-plugin/plugin.json`.

#### Scenario: Plugin with a version.txt
- **WHEN** a pull request adds `plugins/<name>/version.txt`
- **THEN** the `check` job fails at the test step and names `plugins/<name>/version.txt`

#### Scenario: Plugin without a version.txt
- **WHEN** no directory under `plugins/` holds a `version.txt`
- **THEN** the test passes

### Requirement: Plugin manifests keep the layout release-please writes
The workspace tests SHALL fail unless every `plugins/<name>/.claude-plugin/plugin.json` is byte-identical to its parsed content serialized as JSON with two-space indent and one trailing newline, the layout the release-please json updater writes. The formatter check SHALL skip plugin manifests, so a release pull request that bumps `version` changes only that line and passes the `check` job.

#### Scenario: Manifest in another layout
- **WHEN** a pull request adds a `plugin.json` whose layout differs from the serialized form, e.g. `"keywords": ["a", "b"]` on one line
- **THEN** the `check` job fails at the test step and names that `plugin.json`

#### Scenario: Release pull request of a manifest with an array
- **WHEN** release-please bumps `version` in a `plugin.json` in the serialized form that holds an array
- **THEN** the release pull request's diff is the `version` line only and `pnpm format:check` passes

### Requirement: Every plugin uses the root toolchain
A plugin directory under `plugins/` SHALL NOT carry its own lint, format, test or commit tooling (no Biome, ESLint, Prettier, Vitest, commitlint, husky or knip config, no lockfile, no `.github/` directory). Its TypeScript and JavaScript SHALL be linted by the root ESLint config, formatted by the root Prettier config, typechecked by `pnpm typecheck` and tested by the root Vitest suite, so the `check` job covers it.

#### Scenario: Plugin test runs in the workspace suite
- **WHEN** a contributor runs `pnpm test` at the repository root
- **THEN** the tests of `plugins/git-identity` and `plugins/bdk-skill-kit` run in that suite

#### Scenario: Type error in a plugin hook
- **WHEN** a pull request adds a JSDoc type error to `plugins/git-identity/hooks/session-start.mjs`
- **THEN** the `check` job fails at the typecheck step

#### Scenario: Plugin with its own tool config
- **WHEN** a pull request adds a `biome.json`, `eslint.config.*`, `vitest.config.*`, `pnpm-lock.yaml` or `.github/` under `plugins/<name>/`
- **THEN** the `check` job fails at the test step and names the file

### Requirement: Behaviour-changing Changes update the docs
The SDLC in `CLAUDE.md` SHALL require that a Change which changes what a BDK user sees (a skill, agent, hook, `bdk` command, settings key, or the flow between them) updates the hand-written pages of the site (`docs/guide/`, `docs/concepts/`) and regenerates the Reference in the same pull request. The update SHALL cover the Mermaid diagrams of those pages as well as their prose and tables: a Change that adds, removes or reorders a step, an exit, a command, a settings key, a file or an agent of a flow SHALL update every diagram that draws that flow. The `tasks` rules in `openspec/config.yaml` SHALL require such a Change to hold a docs task of its own that names the pages it updates and the diagrams on them it redraws, or to state in its proposal's Impact why no page changes. The `apply` and `archive` guidance in `openspec/config.yaml` SHALL name the docs task, so that an unchecked docs task shows in `/opsx:verify` as an incomplete task and blocks the archive.

#### Scenario: Instructions carry the docs rule
- **WHEN** a contributor runs `openspec instructions tasks --change <name> --json`
- **THEN** the rules in the output require a docs task for a behaviour-changing Change

#### Scenario: Docs task left open
- **WHEN** a Change's docs task is unchecked and a contributor runs `/opsx:verify`
- **THEN** the report lists the docs task as incomplete

#### Scenario: A step added to a flow
- **WHEN** a contributor runs `openspec instructions tasks --change <name> --json` for a Change that adds a step to a skill
- **THEN** the rules in the output require its docs task to name the diagrams that draw the skill's flow, and the SDLC "Docs" rule in `CLAUDE.md` says the same

### Requirement: Pull requests that change behaviour without docs say why
The `docs-impact` job SHALL fail a pull request that changes a file under `plugins/*/skills/`, `plugins/*/agents/`, `plugins/*/hooks/`, `plugins/*/src/` or `openspec/specs/` and changes no hand-written page under `docs/guide/` or `docs/concepts/`, unless the pull request body holds a line `Docs-impact: none - <reason>` with a non-empty reason. The job SHALL run again when the pull request body is edited. Its failure message SHALL name the changed source paths and the line that lets it pass. A pull request template SHALL hold a Docs section with that line, so the reviewer sees either the changed pages or the stated reason.

#### Scenario: Skill changed without docs
- **WHEN** a pull request changes `plugins/bdk/skills/plan/SKILL.md`, no file under `docs/guide/` or `docs/concepts/`, and its body has no `Docs-impact:` line
- **THEN** the `docs-impact` job fails and names `plugins/bdk/skills/plan/SKILL.md`

#### Scenario: Reason given
- **WHEN** the author adds `Docs-impact: none - internal refactor, no user-visible change` to that pull request's body
- **THEN** the `docs-impact` job runs again and passes

#### Scenario: Docs changed with the skill
- **WHEN** a pull request changes `plugins/bdk/skills/plan/SKILL.md` and `docs/concepts/orchestrators.md`
- **THEN** the `docs-impact` job passes

#### Scenario: No user-visible source changed
- **WHEN** a pull request changes only files outside the watched paths
- **THEN** the `docs-impact` job passes without reading the body

### Requirement: Every new issue carries a dependency analysis
The SDLC in `CLAUDE.md` SHALL require, from its **Create** step, a dependency analysis for every new issue against the open and recently closed issues of its milestone. Every issue body SHALL hold a `Dependencies` section that either names its dependencies or says `None.`. Each dependency on an open issue SHALL be a GitHub "blocked by" relation: the new issue's blockers set with `--blocked-by`, the issues it blocks with `--blocking`. The SDLC SHALL give the commands to set, remove and read these relations, and the **Pick** step SHALL give the command that reads a candidate's open blockers.

#### Scenario: Issue without dependencies
- **WHEN** a contributor creates an issue whose analysis finds no dependency
- **THEN** its body's `Dependencies` section says `None.` and the issue has no "blocked by" relation

#### Scenario: Issue with a blocker and a blocked issue
- **WHEN** a contributor creates an issue that needs open issue A merged first and must land before open issue B
- **THEN** after the commands of the SDLC, `gh issue view <new> --json blockedBy,blocking` lists A under `blockedBy` and B under `blocking`, and `gh issue view B --json blockedBy` lists the new issue

#### Scenario: Picking reads open blockers
- **WHEN** a contributor runs the Pick step's command on an issue whose blockers are all closed
- **THEN** it prints `[]`
