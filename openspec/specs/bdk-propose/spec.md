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

The skill SHALL take one argument, plus an optional `--name <name>` (requirement "Change opened with the BDK schema"): a GitHub issue reference (`#<n>`, `<n>`, `<owner>/<repo>#<n>` or an issue URL) or, otherwise, an intent in the user's words. It SHALL read an issue with `gh issue view <ref> --json number,title,body,labels,state,url,comments` and work from its title, body and comments, and SHALL read the same way each issue the body names as the source of its scope (a parent issue, or one it continues or splits from). When `gh` cannot read the issue, the skill SHALL stop, create nothing, and report the `gh` error. With no argument, it SHALL ask the user what to change and create nothing until it has an answer. It SHALL NOT write to GitHub: no comment, label, assignment or new issue.

#### Scenario: Issue reference

- **WHEN** `/bdk:propose #42` runs in a configured project whose repository has an open issue 42
- **THEN** the skill reads it with `gh issue view 42 --json number,title,body,labels,state,url,comments` before it writes `proposal.md`

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

The skill SHALL write `proposal.md` from the BDK schema's proposal instruction and template as `openspec instructions proposal --change <name>` prints them: sections Why, Intent, Acceptance, What Changes, Capabilities (New and Modified), Out of scope and Impact, also when the project's copy of the template lacks Intent or Acceptance. `## Intent` SHALL quote the goal of the issue, or the intent, word for word. `## Acceptance` SHALL list every acceptance point of the source (its acceptance signal and every point of its scope a user can check) as `AC-1` to `AC-n`, one per line, ids in order and never reused; a conditional point SHALL keep its condition in the source's words; it SHALL be written also when the Change sets `skip_specs: true`. An AC the decision round changes SHALL keep its id: its old text struck through and the new text after it, or struck whole when dropped, each naming the scope-log entry that changed it. A proposal from an issue SHALL name the issue on the first line under Why, and SHALL carry the issue's scope and the work it names as out of scope or as owned by other issues. Every Modified capability SHALL be the exact id of an existing main spec, as `openspec list --specs` lists it, and every New capability SHALL be an id no main spec has. The skill SHALL read every main spec the change touches before naming it. A Change that changes no behaviour SHALL set `skip_specs: true` in its `.openspec.yaml` instead of naming a capability. The proposal SHALL say why and what, never how or in which order.

#### Scenario: Issue becomes a valid proposal

- **WHEN** `/bdk:propose #42` runs in a configured project whose main spec `ledger` defines the balance, for an issue that asks for a CSV export and for the balance to skip void entries, and names issue 40 as out of scope
- **THEN** `proposal.md` has the sections Why, Intent, Acceptance, What Changes, Capabilities, Out of scope and Impact, names `#42` under Why, lists `ledger` under Modified Capabilities, and names `#40` under Out of scope

#### Scenario: Intent touching an existing spec

- **WHEN** `/bdk:propose "reject entries whose amount is not a number"` runs in a project whose main spec `ledger` defines entries
- **THEN** `proposal.md` lists `ledger` under Modified Capabilities and no new capability that duplicates it

#### Scenario: Conditional point and acceptance step kept

- **WHEN** the issue says "Add the void variant if the seed helper can mark an entry void" and, as its acceptance signal, "run the balance by hand once on the sample ledger"
- **THEN** `## Acceptance` holds one AC with the void variant and its condition, and one AC with the run by hand on the sample ledger, each with an id

### Requirement: Questions follow policy.questions

The skill SHALL ask only what the source, the recon file and the project's files cannot settle and what changes the proposal's scope: two readings that change different behaviour, a closed issue, a condition of an AC that recon found false or left open, an AC recon shows cannot be met as written, and every AC the skill would drop, narrow or reinterpret. Which capability holds a behaviour SHALL NOT be a question: an existing main spec that holds it is modified, otherwise the capability is new. The skill SHALL ask in one decision round, after recon: every open question at once, each with its options and the default first (`AskUserQuestion` takes at most four per call; more go into the next call of the same round). With `policy.questions: stop` and `AskUserQuestion`, each answer SHALL be applied to `proposal.md` and recorded as a scope-log entry `By: user`. With `policy.questions: decide-and-record`, or when it cannot ask, a question that touches no AC SHALL take the default, be recorded in a section `## Decided without the user` of `proposal.md` and as a scope-log entry `By: setting policy.questions decide-and-record`; a question that touches an AC SHALL NOT be decided: the AC SHALL stay as the source says and the question SHALL be recorded as an open scope-log entry `By: needs-user`. A decision on an AC SHALL never be recorded under `## Decided without the user`. When nothing is open it SHALL ask nothing. A closed issue SHALL count as an open question.

#### Scenario: Clear issue asks nothing

- **WHEN** `/bdk:propose #42` runs for an open issue whose scope names the behaviour to change and no AC is conditional
- **THEN** the skill writes the proposal without calling `AskUserQuestion`

#### Scenario: Decide and record

- **WHEN** `/bdk:propose` runs in a project with `policy.questions: decide-and-record` for an intent with two readings that change different behaviour and touch no AC ("reject an entry whose amount is not a number": throw, or skip the entry, where the intent names no acceptance point on it)
- **THEN** `proposal.md` holds a `## Decided without the user` section naming the choice taken, `scope-log.md` holds an entry `By: setting policy.questions decide-and-record`, and no question is asked

#### Scenario: AC question under decide-and-record

- **WHEN** `/bdk:propose` runs with `policy.questions: decide-and-record` and recon finds that the condition of `AC-3` does not hold in the code
- **THEN** `AC-3` stays in `## Acceptance` as the source says, `scope-log.md` holds an entry naming `AC-3` with `By: needs-user`, `## Decided without the user` does not name `AC-3`, and no question is asked

### Requirement: Report

The skill SHALL end with a short report: the Change name, the path of `proposal.md`, the New and Modified capabilities, the AC ids, the source file and the recon file when one was written, every scope-log entry it wrote with its `By:` line (an open `By: needs-user` entry named as waiting for the user), every decision taken without the user, and the next stage, `/bdk:design <name>`. It SHALL NOT commit, create a branch, or start the design stage.

#### Scenario: Report names the next stage

- **WHEN** the skill has written `openspec/changes/42-csv-export/proposal.md`
- **THEN** the reply names that path, the capabilities, and `/bdk:design 42-csv-export`, and `git status` shows the Change uncommitted on the branch the run started on

### Requirement: Eval cases

The `bdk` eval suite SHALL hold `block` cases for the skill, each built on a project configured for BDK with a main spec: `propose-from-issue` (an issue becomes a proposal, read through the offline `gh` stand-in), `propose-from-intent` (an intent becomes a proposal), `propose-naming-rule` (an issue in a project whose `rules.proposal` names Changes `v3-<N>-<slug>`), `propose-not-configured` (an unconfigured project stops) and `propose-conditional-ac` (an issue with a comment, a conditional point whose condition the code does not meet, and an acceptance step a proposal would otherwise lose, under `policy.questions: decide-and-record`). `propose-conditional-ac` SHALL grade that `source/issue.md` holds the body and the comment word for word, that `## Acceptance` holds the conditional point with its condition and the acceptance step, each with an id, that `explore/propose-recon.md` names the fact that settles the condition with a `file:line`, and that `scope-log.md` holds an open `By: needs-user` entry for the conditional AC. Each case SHALL grade the result and the steps and show that the skill fired.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the five `propose-*` cases load with no error at zero cost and their scaffolds exit 0

### Requirement: Source saved word for word

After it opens the Change, the skill SHALL write `.bdk/runs/<change>/source/issue.md` once, before the proposal: from an issue, its number, title, URL, state, labels, body and every comment with its author, each as `gh` printed it, then each issue it read as the source of the scope under its own heading the same way; from an intent, the intent as the user wrote it. The skill SHALL NOT summarise, reorder or shorten that text, and no later stage SHALL change the file.

#### Scenario: Body and comments kept

- **WHEN** `/bdk:propose #42` runs for an issue whose body holds the line "Add the void variant if the seed helper can mark an entry void" and whose one comment says "Keep the CSV header in English"
- **THEN** `.bdk/runs/<change>/source/issue.md` holds both lines exactly as written

### Requirement: Scope log opened by propose

The skill SHALL create `openspec/changes/<change>/scope-log.md` with the heading `# Scope log: <change>` and the line `Append only. An AC changes only through an entry By: user.`, also when no scope changes. Each entry SHALL be a section `## SL-<n>` (n from 1, in order) with the lines `Stage:` (`propose` or `design`), `Date:` (`YYYY-MM-DD`), `AC:` (the AC ids it touches, `Intent`, or `none`), `Before:` and `After:` (quotes; `After: dropped` for a dropped AC), `Why:` (with `file:line` when code settled it), `Options:` (the default first) and `By:`, which SHALL be `user`, `setting <key>` or `needs-user`. An entry with `By: setting` SHALL name `AC: none`. An entry `By: needs-user` is open until a later entry with the line `Answers: SL-<n>` and `By: user` settles it. Every writer SHALL only append; no entry SHALL be edited or removed.

#### Scenario: Log opened with no change

- **WHEN** `/bdk:propose #42` runs for an issue whose AC need no decision
- **THEN** `openspec/changes/<change>/scope-log.md` exists with its heading and rule line and holds no `## SL-` entry

#### Scenario: User answer logged

- **WHEN** `policy.questions` is `stop` and the user answers the question on conditional `AC-3` with "drop it"
- **THEN** `scope-log.md` holds `## SL-1` with `Stage: propose`, `AC: AC-3`, the AC's source text under `Before:`, `After: dropped` and `By: user`, and `## Acceptance` shows `AC-3` struck naming `SL-1`

### Requirement: Recon of conditional and unclear AC

When an AC of `## Acceptance` is conditional or unclear, the skill SHALL start one agent, `subagent_type: "bdk:explorer"`, prompt `Run the skill bdk:recon with the arguments: <change> <AC ids>`, with `models.explorer.model` and `models.explorer.effort` when set, in the foreground, before its decision round; with no such AC it SHALL start none. The `bdk` plugin SHALL ship the skill `recon` (`/bdk:recon`), which runs on `bdk:explorer`: it SHALL read `source/issue.md` and the named AC of `proposal.md`, answer for each only factual questions from the code (does the condition hold, does a named symbol or file exist, how many copies of a thing exist), and write `.bdk/runs/<change>/explore/propose-recon.md` with the front matter of the `explore/` directory (spec `design-blocks`, "Explore directory and its index") and one section per AC holding its facts, each with `file:line` or the help command that showed it, and a line `Settles:` saying that the condition holds, does not hold, or stays open. It SHALL write no recommendation, approach or reuse candidate, and change no other file. After the agent returns, the skill SHALL build `explore/index.md` from the front matter of every file of `explore/`.

#### Scenario: Condition checked in the code

- **WHEN** `AC-3` holds the condition "if the seed helper can mark an entry void" and the project's seed helper `seedEntries(amounts)` takes no `void` flag
- **THEN** `explore/propose-recon.md` has a section for `AC-3` naming `seedEntries` with its `file:line` and `Settles:` saying the condition does not hold, and `explore/index.md` lists `propose-recon.md`

#### Scenario: No conditional AC

- **WHEN** every AC of the proposal is unconditional and clear
- **THEN** no `bdk:explorer` agent starts and no `explore/propose-recon.md` is written
