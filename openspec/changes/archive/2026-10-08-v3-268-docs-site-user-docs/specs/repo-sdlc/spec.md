## MODIFIED Requirements

### Requirement: Pull requests run the required checks within five minutes
Every pull request SHALL run the jobs `openspec`, `check`, `plugins`, `commitlint`, `docs` and `docs-impact` on Linux, in parallel, and all of them SHALL finish within 5 minutes of wall-clock time on a pull request that does not change dependencies. These six jobs SHALL be required status checks on `main` and `staging/v3`.

#### Scenario: Required checks on a pull request
- **WHEN** a contributor opens a pull request into `staging/v3`
- **THEN** the jobs `openspec`, `check`, `plugins`, `commitlint`, `docs` and `docs-impact` run on `ubuntu-latest` and each finishes within 5 minutes

#### Scenario: A failed required check blocks the merge
- **WHEN** any of `openspec`, `check`, `plugins`, `commitlint`, `docs` or `docs-impact` fails on a pull request
- **THEN** GitHub does not allow the pull request to merge

## ADDED Requirements

### Requirement: Behaviour-changing Changes update the docs
The SDLC in `CLAUDE.md` SHALL require that a Change which changes what a BDK user sees (a skill, agent, hook, `bdk` command, settings key, or the flow between them) updates the hand-written pages of the site (`docs/guide/`, `docs/concepts/`) and regenerates the Reference in the same pull request. The `tasks` rules in `openspec/config.yaml` SHALL require such a Change to hold a docs task of its own that names the pages it updates, or to state in its proposal's Impact why no page changes. The `apply` and `archive` guidance in `openspec/config.yaml` SHALL name the docs task, so that an unchecked docs task shows in `/opsx:verify` as an incomplete task and blocks the archive.

#### Scenario: Instructions carry the docs rule
- **WHEN** a contributor runs `openspec instructions tasks --change <name> --json`
- **THEN** the rules in the output require a docs task for a behaviour-changing Change

#### Scenario: Docs task left open
- **WHEN** a Change's docs task is unchecked and a contributor runs `/opsx:verify`
- **THEN** the report lists the docs task as incomplete

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
