# Spec Delta

## ADDED Requirements

### Requirement: Paid measurement discipline

`plugins/bdk/evals/README.md` SHALL hold a part "Before a paid run" under "Run" that says: probe one case with `--runs 1` before a series; while iterating on a fix, run only the cases the fix touches and the full set once at the end; put `--max-cost-usd` on every command; pin the agent to `--model sonnet` unless the case measures the main thread's model; run both arms only when the question is whether a block changes the outcome; use a full unattended `/bdk:run` on a B1-sized fixture to discover defects, and a snapshot of a built workspace or a block case to confirm a fix; and before a run, check that the fixture reaches the path under test and that no merged work already answers the question. The README SHALL also say that a flaky case is accepted by the cause read in a kept run's trace and removed, with a pass count only as the check after it.

A Change whose design reports a paid measurement SHALL record in that design the total cost and machine time of every paid run it made, probe, failed and repeated runs included, or name the runs whose cost is unknown.

#### Scenario: README keeps the rules

- **WHEN** `pnpm test` runs
- **THEN** the eval suite test fails unless `plugins/bdk/evals/README.md` has a "Before a paid run" heading whose part names `--runs 1`, `--max-cost-usd` and `--ablation none`

#### Scenario: Measuring Change records its total

- **WHEN** a Change measures with paid runs and its design is written
- **THEN** its "Measurement" or "Results" section gives one total in USD and machine time over all its paid runs, or names each run whose cost was not recorded

#### Scenario: Flake accepted by its cause

- **WHEN** an issue tracks a case that fails in some of its runs
- **THEN** its acceptance names the cause found in the trace of a kept failing run, and a series of passing runs is the check after the fix, not the acceptance alone

## MODIFIED Requirements

### Requirement: Block and orchestrator cases

A case of a block SHALL carry the tag `block`, hold graders that hold in a run with and in a run without the plugin, and hold at least one grader on the result (`file_exists`, `regex` or `llm`) and one on the steps (`tool_used` or `tool_order`). A block case SHALL run with and without the plugin when the question is whether the block changes the outcome; a run that confirms a fix or checks a regression MAY run it with `--ablation none`. A case of an orchestrator SHALL carry the tag `orchestrator` and is run with `--ablation none`; it SHALL hold `tool_order` graders for the order of its blocks and `file_exists` graders for the files the run writes. An orchestrator case whose correct run writes no file SHALL also carry the tag `writes-nothing`; it SHALL then hold no `file_exists` grader and at least one `regex` grader with `target: trace`. Every case SHALL carry exactly one of the tags `block`, `orchestrator` or `sample`.

#### Scenario: Block case graders

- **WHEN** a case tagged `block` is loaded
- **THEN** it has a grader of type `file_exists`, `regex` or `llm`, and a grader of type `tool_used` or `tool_order`

#### Scenario: Block case arms follow the question

- **WHEN** a contributor runs block cases as the eval README says
- **THEN** the command for whether a block changes the outcome runs both arms, and the command for confirming a fix passes `--ablation none`

#### Scenario: Orchestrator case graders

- **WHEN** a case tagged `orchestrator` and not `writes-nothing` is loaded
- **THEN** it has a grader of type `tool_order` and a grader of type `file_exists`

#### Scenario: Orchestrator case that writes nothing

- **WHEN** a case tagged `orchestrator` and `writes-nothing` is loaded
- **THEN** it has a grader of type `tool_order`, a `regex` grader with `target: trace`, and no grader of type `file_exists`

#### Scenario: Orchestrators run one arm

- **WHEN** a contributor runs the orchestrator cases as the eval README says
- **THEN** the command filters on the tag `orchestrator` and passes `--ablation none`
