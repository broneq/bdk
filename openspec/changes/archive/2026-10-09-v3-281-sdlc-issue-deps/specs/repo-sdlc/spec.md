## ADDED Requirements

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
