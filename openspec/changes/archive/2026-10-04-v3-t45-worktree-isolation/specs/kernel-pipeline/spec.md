## MODIFIED Requirements

### Requirement: Plan stage nodes

The `plan` node of `pipeline/pipeline.yaml` SHALL carry `rules: [code-quality, architecture, test-quality, plan]`, so its instruction lists the `BDK-PL` rules the planner ticks by id. The `plan-verify` node SHALL require `plan`, `design`, `design-index` and `architecture`: a requirement absent or skipped in the Change's graph variant is satisfied, as for any node, so a `bug` Change still reaches `plan-verify` after `plan`; the verifier's package names the design documents that exist, because a package names the files of the node and of the nodes it requires; and the `fresh` check makes a verdict given before the design last changed fail. The instruction template of `plan-part` SHALL state the task shape (a contract with concrete test cases, no implementation code), the `isolation` and `isolation-reason` fields (`kernel-state`, Plan part and plan index) and that the spec deltas of `spec-impact` are written before `done`; the template of `plan-verify` SHALL name `/bdk:verify-plan`.

#### Scenario: plan instruction lists the plan rules

- **WHEN** `bdk next --json` returns the `plan` node of a `small` feature Change after `gate:design`
- **THEN** the instruction's "Rules" section lists `BDK-PL-1`, `BDK-PL-2`, `BDK-PL-3` and `BDK-PL-4`

#### Scenario: plan verifier reads the design

- **WHEN** `design`, `architecture` and every plan part are done, and `bdk dispatch build plan-verify verifier <ticket>` runs
- **THEN** the package names `design.md`, `architecture.md` and every plan part

#### Scenario: bug Change reaches plan-verify

- **WHEN** a `bug` Change of profile `small` has every plan part done
- **THEN** `bdk next --json` returns `plan-verify`, whose instruction names `/bdk:verify-plan`
