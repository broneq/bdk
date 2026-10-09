## ADDED Requirements

### Requirement: The Concepts show where execute runs the checks
The Concepts page of the orchestrators SHALL show, in the execute diagrams, every run of `bdk check run` in the execute stage: the red acceptance tests and the part checks of `/bdk:implement-part`, the checks of `/bdk:conform-part`, and the checks of `/bdk:resolve-conflict` after a conflicted merge. Its text SHALL say which files a scoped check covers and that the merged result of a wave is not checked before the first round of `/bdk:auto-review`. The execute stage of the Concepts and of the Guide SHALL link to it.

#### Scenario: Where the tests of a part run
- **WHEN** a reader of the execute stage in `docs/guide/workflow.md` follows its link about the checks
- **THEN** they reach the part of `docs/concepts/orchestrators.md` that names each check run of the execute stage, who runs it, on which files, and what happens when it is red

#### Scenario: What execute does not check
- **WHEN** a reader looks for what runs the checks on a wave merged into the Change branch
- **THEN** the page says that nothing does before `/bdk:auto-review`, whose first round runs every check on the whole project
