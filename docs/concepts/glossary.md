# Glossary - the words BDK uses, in one place

| Term | Meaning |
|---|---|
| **Change** | One piece of work: an [OpenSpec Change](./openspec-changes.md) under `openspec/changes/<change>/` with its proposal, spec deltas, design and plan. Each Change gets its own branch and one pull request. |
| **Spec delta** | The requirements a Change adds, modifies or removes, with their scenarios; merged into the main specs when the Change closes. |
| **Main specs** | `openspec/specs/`: what the product does today, kept current by every closed Change. |
| **Scenario** | A WHEN / THEN example of a requirement that can run against the product; the acceptance criterion of the whole run. |
| **Stage** | One of propose, design, plan, execute, review, close: one command each. |
| **Orchestrator** | The command that runs a stage, such as `/bdk:design`; it composes blocks and applies the gate, and does no block's work. |
| **Block** | One job inside a stage, such as `/bdk:verify-design`; every block is also a skill you can run alone. |
| **Agent** | A subagent a block runs on, such as `bdk:verifier`, with its own model and tools ([agents](./agents.md)). |
| **Lead** | The `bdk:lead` agent that runs a long stage (execute, a review round) in the background and is the only one that commits and merges. |
| **Author and checker** | A block that writes (a design, code) and a separate block that checks it on a fresh context; the author never checks its own work ([what each stage checks](./stages.md)). |
| **Plan part** | A slice of the work one agent builds alone: its files, the scenarios it makes true, its tasks (`plan/parts/NN.md`). |
| **Wave** | Parts with no dependency between them, built in parallel; the next wave starts when one is merged. |
| **Gate** | A point where a stage waits for your approval: the design gate and the fix gate of `/bdk:debug` ([gates and budgets](./gates-and-budgets.md)). |
| **Budget** | The most passes or retries a loop may take, so a run always ends. |
| **Review round** | One pass of reviewers, checks, the E2E tester and the judge over the Change, or over the fixes of the round before. |
| **Finding** | One problem a round found, with its evidence; judged to a level, then decided: fix, accept or defer ([findings](./findings.md)). |
| **Triage** | Deciding what happens to each finding, by you or by policy. |
| **Rule** | A short coding choice or fact the implementers follow and the reviewers check ([rules](./rules.md)). |
| **Run state** | The files under `.bdk/runs/` every stage writes, so the work can resume and be traced ([run state](./run-state.md)). |
| **Autopilot** | `/bdk:run`: the stages for a queue of Changes, one after another, each to its own pull request. |

## Notation in the diagrams

`/bdk:<name>` is a skill (a command, a lead skill or a block), `bdk:<agent>` a subagent from the plugin's agents, `bdk <group> <verb>` a command of the `bdk` command line. `R` is the run directory of a Change, `.bdk/runs/<change>/`, and `C` its Change directory, `openspec/changes/<change>/`. Hexagons are decisions taken from files or settings; rounded nodes are points where you decide.
