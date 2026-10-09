## MODIFIED Requirements

### Requirement: The Concepts show where execute runs the checks

The Concepts page of the orchestrators SHALL show, in the execute diagrams, every run of `bdk check run` in the execute stage: the red acceptance tests and the part checks of `/bdk:implement-part`, the checks of `/bdk:conform-part`, the checks of `/bdk:resolve-conflict` after a conflicted merge, and the wave check of the execute lead with its repair. Its text SHALL say which files a check on changed files covers, which check point each run uses, and that the checks of the `review` point run only in `/bdk:auto-review`. The execute stage of the Concepts and of the Guide SHALL link to it.

#### Scenario: Where the tests of a part run

- **WHEN** a reader of the execute stage in `docs/guide/workflow.md` follows its link about the checks
- **THEN** they reach the part of `docs/concepts/orchestrators.md` that names each check run of the execute stage, who runs it, at which point, on which files, and what happens when it is red

#### Scenario: What execute does not check

- **WHEN** a reader looks for what runs the checks on a wave merged into the Change branch
- **THEN** the page says that the execute lead runs the checks of the `wave` point on the files changed since the wave's base, repairs a red wave with `/bdk:resolve-conflict --wave`, and leaves the `review` point to `/bdk:auto-review`
