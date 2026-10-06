## MODIFIED Requirements

### Requirement: close closes a reviewed Change

`/bdk:close` SHALL close the active Change through the kernel and never by hand:

- it runs `bdk change close --dry-run`; on a refusal it follows `instead` (Requirement: Kernel refusals in a stage skill) and closes nothing;
- it runs `bdk change close`; a `policy/git-hook-failed` leaves the archive in the work tree, which the skill reports with the hook's output.

It SHALL ask no question: the typed command, or a run that passed `gate:review`, is the consent. It SHALL propose no rule and route no `learning` entry: lessons stay in the archived ledger for the audit skill (T31). It SHALL never edit a project file (`disallowed-tools: Edit Write NotebookEdit`).

#### Scenario: reviewed Change closed

- **WHEN** the user types `/bdk:close` on a Change whose `gate:review` is done and no ticket is open
- **THEN** `.bdk/changes/archive/<id>/` exists, the latest commit has the subject `chore(bdk): close <id>`, and the branch has no active Change

#### Scenario: no rule projection at close

- **WHEN** the content test reads `skills/stages/close/SKILL.md`
- **THEN** it names neither `bdk rules export` nor `.claude/rules/`

#### Scenario: open ticket

- **WHEN** a ticket of the Change is open and the user types `/bdk:close`
- **THEN** `bdk change close --dry-run` refuses with `policy/ticket-open`, the Change is not archived, and the final reply names the open ticket and the commands of `instead`

### Requirement: close reports the PR summary

`/bdk:close` SHALL end with the `summary` of `bdk change close` verbatim, the gates passed by policy (`gatesByPolicy`), each named by its id such as `gate:review`, the archive path and the commit, and the next step: open the PR with that summary. It SHALL NOT open the PR itself.

#### Scenario: summary shown

- **WHEN** `/bdk:close` closes a Change with one live `assumption` entry
- **THEN** the final reply holds the PR summary with that assumption and names the archive path

## REMOVED Requirements

### Requirement: setup imports hand-written rules

**Reason**: `bdk rules import` is removed (`kernel-cli/rules`). A project's hand-written `.claude/rules/` files are its own Claude Code rules and stay where they are.

**Migration**: None for `/bdk:setup`: it leaves `.claude/rules/` untouched. A user who wants a rule selected for BDK agents adopts it with `bdk rules accept` or `/bdk:rules capture`.
