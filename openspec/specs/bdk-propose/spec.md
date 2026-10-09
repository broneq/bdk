# bdk-propose Specification

## Purpose

Defines the `/bdk:propose` skill of the `bdk` plugin: how it opens an OpenSpec Change with the BDK schema from an intent or a GitHub issue and writes the Change's `proposal.md` with the capabilities the design stage works from.

## Requirements

### Requirement: Configured project only

`/bdk:propose` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/propose/`). It SHALL read the configuration with `bdk config show` before anything else. When the project is not configured or its configuration is invalid (spec `bdk-cli/config`, "Configured project" and "config check"), the skill SHALL create no Change and no file, and SHALL tell the user `BDK not configured: run /bdk:setup`, or that the configuration is invalid and `bdk config check` lists the problems.

#### Scenario: Unconfigured project stops

- **WHEN** `/bdk:propose` runs with an intent in a git project without `.bdk/settings.yaml`
- **THEN** no directory is created under `openspec/changes/`, no `proposal.md` is written, and the reply says `BDK not configured: run /bdk:setup`

### Requirement: Input is an intent or a GitHub issue

The skill SHALL take one argument, plus an optional `--name <name>` (requirement "Change opened with the BDK schema"): a GitHub issue reference (`#<n>`, `<n>`, `<owner>/<repo>#<n>` or an issue URL) or, otherwise, an intent in the user's words. It SHALL read an issue with `gh issue view <ref> --json number,title,body,labels,state,url` and work from its title and body. When `gh` cannot read the issue, the skill SHALL stop, create nothing, and report the `gh` error. With no argument, it SHALL ask the user what to change and create nothing until it has an answer. It SHALL NOT write to GitHub: no comment, label, assignment or new issue.

#### Scenario: Issue reference

- **WHEN** `/bdk:propose #42` runs in a configured project whose repository has an open issue 42
- **THEN** the skill reads it with `gh issue view 42 --json number,title,body,labels,state,url` before it writes `proposal.md`

#### Scenario: Unreadable issue

- **WHEN** `/bdk:propose #42` runs and `gh issue view` exits non-zero
- **THEN** no Change is created and the reply quotes the `gh` error

### Requirement: Change opened with the BDK schema

The skill SHALL open the Change with `openspec new change <name> --schema bdk`. When the arguments hold `--name <name>`, the Change SHALL take that name; it SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`), otherwise the skill SHALL stop and create nothing. Without `--name`, the skill SHALL read the project's `openspec/config.yaml` before it names the Change, and when a `rules.proposal` entry says how a Change is named, the name SHALL follow that rule. Without such a rule, the name SHALL be kebab-case and describe the change in two to five words, and a Change from an issue SHALL be named `<issue-number>-<slug>`. When the name is already taken by a Change that has a `proposal.md`, the skill SHALL NOT overwrite it: it SHALL report that Change and its proposal path and stop. When the taken Change has no `proposal.md`, the skill SHALL write the proposal into it.

#### Scenario: Change from an issue

- **WHEN** `/bdk:propose #42` runs for an issue titled "Export the ledger as CSV" in a project whose `openspec/config.yaml` has no naming rule
- **THEN** a directory `openspec/changes/42-<slug>/` exists whose `.openspec.yaml` names `schema: bdk`

#### Scenario: Project naming rule

- **WHEN** `/bdk:propose #42` runs in a project whose `openspec/config.yaml` `rules.proposal` says "A change is named `v3-<N>-<slug>`, where N is the tracking issue number"
- **THEN** the Change is `openspec/changes/v3-42-<slug>/`

#### Scenario: Name given

- **WHEN** `/bdk:propose #42 --name 42-csv-export` runs
- **THEN** the Change is `openspec/changes/42-csv-export/`, whatever the issue's title and the project's naming rule

#### Scenario: Existing proposal kept

- **WHEN** `/bdk:propose` would open a Change whose directory already holds a `proposal.md`
- **THEN** the file is unchanged and the reply names the existing Change and its proposal

### Requirement: Proposal follows the BDK schema

The skill SHALL write `proposal.md` from the BDK schema's proposal instruction and template as `openspec instructions proposal --change <name>` prints them: sections Why, What Changes, Capabilities (New and Modified), Out of scope and Impact. A proposal from an issue SHALL name the issue on the first line under Why, and SHALL carry the issue's scope, its acceptance signal and the work it names as out of scope or as owned by other issues. Every Modified capability SHALL be the exact id of an existing main spec, as `openspec list --specs` lists it, and every New capability SHALL be an id no main spec has. The skill SHALL read every main spec the change touches before naming it. A Change that changes no behaviour SHALL set `skip_specs: true` in its `.openspec.yaml` instead of naming a capability. The proposal SHALL say why and what, never how or in which order.

#### Scenario: Issue becomes a valid proposal

- **WHEN** `/bdk:propose #42` runs in a configured project whose main spec `ledger` defines the balance, for an issue that asks for a CSV export and for the balance to skip void entries, and names issue 40 as out of scope
- **THEN** `proposal.md` has the sections Why, What Changes, Capabilities, Out of scope and Impact, names `#42` under Why, lists `ledger` under Modified Capabilities, and names `#40` under Out of scope

#### Scenario: Intent touching an existing spec

- **WHEN** `/bdk:propose "reject entries whose amount is not a number"` runs in a project whose main spec `ledger` defines entries
- **THEN** `proposal.md` lists `ledger` under Modified Capabilities and no new capability that duplicates it

### Requirement: Questions follow policy.questions

The skill SHALL ask only what the issue, the intent and the project's files cannot settle and what changes the proposal's scope. Which capability holds a behaviour SHALL NOT be a question: an existing main spec that holds it is modified, otherwise the capability is new. With `policy.questions: stop` it SHALL ask the user, in one `AskUserQuestion` call with the recommended answer first, before writing the proposal. With `policy.questions: decide-and-record`, or when it cannot ask, it SHALL take the recommended answer, write the proposal, and record each such decision in a section `## Decided without the user` of `proposal.md` and in its report. When nothing is open it SHALL ask nothing. A closed issue SHALL count as an open question.

#### Scenario: Clear issue asks nothing

- **WHEN** `/bdk:propose #42` runs for an open issue whose scope names the behaviour to change
- **THEN** the skill writes the proposal without calling `AskUserQuestion`

#### Scenario: Decide and record

- **WHEN** `/bdk:propose` runs in a project with `policy.questions: decide-and-record` for an intent with two readings that change different behaviour ("reject an entry whose amount is not a number": throw, or skip the entry)
- **THEN** `proposal.md` holds a `## Decided without the user` section naming the choice taken, and no question is asked

### Requirement: Report

The skill SHALL end with a short report: the Change name, the path of `proposal.md`, the New and Modified capabilities, every decision taken without the user, and the next stage, `/bdk:design <name>`. It SHALL NOT commit, create a branch, or start the design stage.

#### Scenario: Report names the next stage

- **WHEN** the skill has written `openspec/changes/42-csv-export/proposal.md`
- **THEN** the reply names that path, the capabilities, and `/bdk:design 42-csv-export`, and `git status` shows the Change uncommitted on the branch the run started on

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill, each built on a project configured for BDK with a main spec: `propose-from-issue` (an issue becomes a proposal, read through the offline `gh` stand-in), `propose-from-intent` (an intent becomes a proposal), `propose-naming-rule` (an issue in a project whose `rules.proposal` names Changes `v3-<N>-<slug>`) and `propose-not-configured` (an unconfigured project stops). Each SHALL grade the result and the steps and show that the skill fired.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the four `propose-*` cases load with no error at zero cost and their scaffolds exit 0
