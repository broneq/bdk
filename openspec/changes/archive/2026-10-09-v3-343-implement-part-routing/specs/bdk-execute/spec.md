## ADDED Requirements

### Requirement: One part goes to implement-part

`/bdk:execute` SHALL build every part of the plan and SHALL take no part id. Its description SHALL say so and SHALL name `implement-part` as the block that builds one part; the description of `implement-part` SHALL say it builds one part, not the whole plan. When `/bdk:execute` is called with a part id after the Change (`/bdk:execute add-csv-export 01`) or is asked to build one part, it SHALL start no agent, edit no file, and reply with `/bdk:implement-part <change> <part-id>` as the command that builds that part, and `/bdk:execute <change>` as the command that builds the whole plan.

#### Scenario: Part id given to the stage

- **WHEN** `/bdk:execute add-csv-export 01` runs in a configured project whose Change `add-csv-export` has plan parts `01` and `02`
- **THEN** no `bdk:lead` starts, no file is edited, and the reply names `/bdk:implement-part add-csv-export 01`

#### Scenario: One part asked in words

- **WHEN** the user writes "Implement part 01 of the plan of the change add-csv-export." in a project where BDK is installed
- **THEN** the main session invokes the skill `implement-part`, not `/bdk:execute`, in each of 6 runs of the eval case `implement-part-csv`
