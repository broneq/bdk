## ADDED Requirements

### Requirement: Diagram fit check runs in parallel
The diagram fit check SHALL serve the built site on a port the operating system assigns, so that several runs at once on one machine (for example from different worktrees) do not fail on a port in use. It SHALL fail only on a diagram that does not fit or cannot be measured.

#### Scenario: Two runs at once
- **WHEN** two diagram fit checks are started at the same time on one machine
- **THEN** both serve the site on different ports and both exit 0 when every diagram fits
