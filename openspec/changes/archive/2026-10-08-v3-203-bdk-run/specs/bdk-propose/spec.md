## MODIFIED Requirements

### Requirement: Input is an intent or a GitHub issue

The skill SHALL take one argument, plus an optional `--name <name>` (requirement "Change opened with the BDK schema"): a GitHub issue reference (`#<n>`, `<n>`, `<owner>/<repo>#<n>` or an issue URL) or, otherwise, an intent in the user's words. It SHALL read an issue with `gh issue view <ref> --json number,title,body,labels,state,url` and work from its title and body. When `gh` cannot read the issue, the skill SHALL stop, create nothing, and report the `gh` error. With no argument, it SHALL ask the user what to change and create nothing until it has an answer. It SHALL NOT write to GitHub: no comment, label, assignment or new issue.

#### Scenario: Issue reference

- **WHEN** `/bdk:propose #42` runs in a configured project whose repository has an open issue 42
- **THEN** the skill reads it with `gh issue view 42 --json number,title,body,labels,state,url` before it writes `proposal.md`

#### Scenario: Unreadable issue

- **WHEN** `/bdk:propose #42` runs and `gh issue view` exits non-zero
- **THEN** no Change is created and the reply quotes the `gh` error

### Requirement: Change opened with the BDK schema

The skill SHALL open the Change with `openspec new change <name> --schema bdk`. When the arguments hold `--name <name>`, the Change SHALL take that name; it SHALL be kebab-case (`^[a-z0-9][a-z0-9-]*$`), otherwise the skill SHALL stop and create nothing. Without `--name`, the name SHALL be kebab-case and describe the change in two to five words; a Change from an issue SHALL be named `<issue-number>-<slug>`. When the name is already taken by a Change that has a `proposal.md`, the skill SHALL NOT overwrite it: it SHALL report that Change and its proposal path and stop. When the taken Change has no `proposal.md`, the skill SHALL write the proposal into it.

#### Scenario: Change from an issue

- **WHEN** `/bdk:propose #42` runs for an issue titled "Export the ledger as CSV"
- **THEN** a directory `openspec/changes/42-<slug>/` exists whose `.openspec.yaml` names `schema: bdk`

#### Scenario: Name given

- **WHEN** `/bdk:propose #42 --name 42-csv-export` runs
- **THEN** the Change is `openspec/changes/42-csv-export/`, whatever the issue's title

#### Scenario: Existing proposal kept

- **WHEN** `/bdk:propose` would open a Change whose directory already holds a `proposal.md`
- **THEN** the file is unchanged and the reply names the existing Change and its proposal
