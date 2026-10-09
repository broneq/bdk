## MODIFIED Requirements

### Requirement: Block and orchestrator cases

A case of a block SHALL carry the tag `block`, run with and without the plugin, and hold at least one grader on the result (`file_exists`, `regex` or `llm`) and one on the steps (`tool_used` or `tool_order`). A case of an orchestrator SHALL carry the tag `orchestrator` and is run with `--ablation none`; it SHALL hold `tool_order` graders for the order of its blocks and `file_exists` graders for the files the run writes. An orchestrator case whose correct run writes no file SHALL also carry the tag `writes-nothing`; it SHALL then hold no `file_exists` grader and at least one `regex` grader with `target: trace`. Every case SHALL carry exactly one of the tags `block`, `orchestrator` or `sample`.

#### Scenario: Block case graders

- **WHEN** a case tagged `block` is loaded
- **THEN** it has a grader of type `file_exists`, `regex` or `llm`, and a grader of type `tool_used` or `tool_order`

#### Scenario: Orchestrator case graders

- **WHEN** a case tagged `orchestrator` and not `writes-nothing` is loaded
- **THEN** it has a grader of type `tool_order` and a grader of type `file_exists`

#### Scenario: Orchestrator case that writes nothing

- **WHEN** a case tagged `orchestrator` and `writes-nothing` is loaded
- **THEN** it has a grader of type `tool_order`, a `regex` grader with `target: trace`, and no grader of type `file_exists`

#### Scenario: Orchestrators run one arm

- **WHEN** a contributor runs the orchestrator cases as the eval README says
- **THEN** the command filters on the tag `orchestrator` and passes `--ablation none`

## ADDED Requirements

### Requirement: Plan stop cases

The suite SHALL hold two orchestrator cases of `/bdk:plan` for the paths that end without a verifier pass. `plan-design-gap` SHALL build the `ledger-change` fixture with one requirement added to the spec delta `ledger-export` that the design does not settle (`ledger export <file> --out <path>`, with no rule for an existing `<path>`), and SHALL grade that `plan-draft` runs, that no `bdk:verifier` agent starts and no plan report is written, that the first plan part exists, and that the reply names the gap and `/bdk:design add-csv-export`. `plan-passed` SHALL carry the tag `writes-nothing`, build the hand-written plan of `plan-verify-written` with a `.bdk/runs/add-csv-export/plan/verify-1.md` whose first line is `Verdict: PASS`, and SHALL grade that the skill reads that report and runs `bdk plan check`, that neither `plan-draft` nor a `bdk:planner` or `bdk:verifier` agent runs, that no `Write` or `Edit` call is made, and that the reply says the plan passed and names `/bdk:execute add-csv-export`. `plugins/bdk/evals/README.md` SHALL record the result of each case run with `--ablation none`.

#### Scenario: Gap stops the plan before the verifier

- **WHEN** `plan-design-gap` runs with `--ablation none` and the README's grants
- **THEN** it scores 1.00: a `bdk:planner` agent runs, no `bdk:verifier` agent starts, `plan/parts/01.md` exists, and the reply names the existing-file choice and `/bdk:design add-csv-export`

#### Scenario: Passed plan runs no block

- **WHEN** `plan-passed` runs with `--ablation none` and the README's grants
- **THEN** it scores 1.00: one `bdk plan check` runs, no block runs, no file is written, and the reply names `/bdk:execute add-csv-export`

#### Scenario: Scaffolds build clean workspaces

- **WHEN** the scaffolds of both cases run in an empty workspace as the harness runs them
- **THEN** each exits 0 and `git status --porcelain` prints nothing
