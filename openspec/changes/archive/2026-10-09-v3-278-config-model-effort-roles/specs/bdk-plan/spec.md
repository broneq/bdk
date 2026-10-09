## MODIFIED Requirements

### Requirement: The orchestrator only composes the plan blocks

The skill SHALL run `plan-draft` as a `bdk:planner` agent whose prompt runs the skill `bdk:plan-draft`, `bdk plan check` on the Change's `plan/parts/` before every verifier pass, and `verify-plan` as a `bdk:verifier` agent whose prompt runs the skill `bdk:verify-plan`. Each agent SHALL get `model` and `effort` from `models.planner` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says. It SHALL NOT write, fix or check a plan part itself, and SHALL write no file. It SHALL NOT commit, create a branch or start the execute stage.

#### Scenario: Full plan of a designed Change

- **WHEN** `/bdk:plan add-csv-export` runs for a Change that has a proposal, a spec delta and a design, and no plan parts
- **THEN** a `bdk:planner` agent starts before a `bdk:verifier` agent starts, `bdk plan check` runs on `openspec/changes/add-csv-export/plan/parts` before the verifier starts, and `openspec/changes/add-csv-export/plan/parts/01.md` and `.bdk/runs/add-csv-export/plan/verify-1.md` exist
