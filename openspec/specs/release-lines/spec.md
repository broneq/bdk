# release-lines Specification

## Purpose

Defines how the v3 line `staging/v3` relates to the v2 line `main` and to side branches, so that the 3.0 merge into `main` loses no fix and inherits no pending merge.

## Requirements

### Requirement: The v3 line contains the other lines

`staging/v3` SHALL contain the tip of `main` and the tip of every side branch it absorbs, and SHALL receive them through merge commits, never through a rebase, squash or cherry-pick of the other line. The pull request that lands a reconciliation SHALL be merged with a merge commit. In a conflict the `staging/v3` side SHALL win, except for a fix the other line carries and `staging/v3` lacks, and for files that release-please owns (`CHANGELOG.md`, `.github/.release-please-manifest.json`), which SHALL take the `main` side. An absorbed side branch SHALL be deleted after the merge.

#### Scenario: main is an ancestor after reconciliation

- **WHEN** the T05 pull request has merged into `staging/v3`
- **THEN** `git merge-base --is-ancestor <main tip at merge time> origin/staging/v3` exits 0

#### Scenario: improvements-pack is an ancestor after reconciliation

- **WHEN** the T05 pull request has merged into `staging/v3`
- **THEN** `git merge-base --is-ancestor <improvements-pack tip> origin/staging/v3` exits 0, and the branch `improvements-pack` no longer exists on `origin`

#### Scenario: release-please files follow main

- **WHEN** the reconciliation resolves `.github/.release-please-manifest.json`
- **THEN** the file holds the version of the `main` tip (2.7.0), and `.claude-plugin/plugin.json` holds the same version

### Requirement: Reconciliation does not grow the skill-check baseline

A merge of another line into `staging/v3` SHALL NOT add entries to `skill-check.baseline.json`. A change that the other line makes to a skill or an agent SHALL come over only when `pnpm skill-check` still passes with it. When the change removes a baselined finding, the baseline SHALL be pruned with `pnpm skill-check --baseline-prune` in the same pull request.

#### Scenario: baseline after the merges

- **WHEN** both merges of T05 are resolved
- **THEN** `pnpm skill-check` exits 0, and the baseline holds no entry that the `staging/v3` tip before T05 did not hold

#### Scenario: a skilllint fix that removes a baselined finding

- **WHEN** a frontmatter fix from `improvements-pack` removes a finding that the baseline holds
- **THEN** the fix is kept, and `pnpm skill-check --baseline-prune` removes the entry in the same pull request
