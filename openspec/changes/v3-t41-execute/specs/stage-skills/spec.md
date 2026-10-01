## ADDED Requirements

### Requirement: execute runs the execute stage the kernel hands it

`/bdk:execute` SHALL loop on `bdk next` and keep working while `next` returns a node of the `execute` stage: the `execute-part` instances of its `wave`, `spec-delta` (marked with `bdk done spec-delta`) and a post-task step node of a part that is already done (run in a `verify-fix` ticket of that part). One `/bdk:execute` SHALL run every ready part; a pending `review: true` entry or the status of a later gate SHALL NOT end the loop while an execute-stage node is ready. When `next` returns a node of an earlier stage, the skill SHALL dispatch nothing and name the stage command that `next` gives. It SHALL never edit a project file or run tests or linters itself (`disallowed-tools: Edit Write NotebookEdit`): role agents do the work and the kernel records it.

The v2 skill `subagent-execute-plan` SHALL NOT ship: `/bdk:execute` is the only skill that executes a plan.

#### Scenario: every ready part in one run

- **WHEN** `/bdk:execute` runs on a `tiny` Change whose plan has parts 01 and 02, 02 depending on 01, and `next` lists a pending `review: true` finding after part 01 is done
- **THEN** the skill runs part 02 without asking the user, and both `execute-part:01` and `execute-part:02` are done before its turn ends

#### Scenario: plan not done

- **WHEN** `/bdk:execute` runs while the Change's plan part is written and not done
- **THEN** no attempt record and no task commit exist after the run, and the final reply names `/bdk:plan`

#### Scenario: no v2 executor

- **WHEN** the plugin is loaded
- **THEN** no directory of the plugin holds a skill named `subagent-execute-plan`, and `skills/stages/execute/SKILL.md` sets `disable-model-invocation: true` and disallows `Edit`, `Write` and `NotebookEdit`

### Requirement: execute runs each part in the mode the kernel gives

For each part of `wave` that is not started, `/bdk:execute` SHALL run `bdk part start <part>` and then follow the part's `mode`:

- `flat`: the main thread runs the part's task tickets as the swarm skill states (a task starts once the tasks its `Depends on:` names are committed and its `Files:` are disjoint from the running ones; `attempt open task-redispatch`, `dispatch build <task> implementer`, a background `Agent` with the package path; the ticket's `steps` under the same ticket; `attempt close`; `commit` on `next.action: commit`), and runs `bdk part done <part>` when every task of the part is committed;
- `tree`: the main thread opens `bdk attempt open part-lead <part>`, builds the lead's package with `bdk dispatch build <part> lead <ticket>`, starts `bdk:lead` in the background with the package path as the whole prompt, and when the lead returns closes the `part-lead` ticket and, on `next.action: part-done`, runs `bdk part done <part>`.

The main thread SHALL run at most `execution.concurrency` agents at once, SHALL start every agent in the background and SHALL end its turn while they run, to be woken by the host's task notification. After `bdk part done` it SHALL run `bdk next` again.

#### Scenario: flat part

- **WHEN** `wave` lists part 01 with `mode: flat` and two tasks
- **THEN** the main thread opens one `task-redispatch` ticket per task, each task ends as a commit with its trailer, and no `part-lead` ticket exists for part 01

#### Scenario: tree parts

- **WHEN** `wave` lists parts 01 and 02 of a `large` Change, both `mode: tree` and not started
- **THEN** the main thread starts parts 01 and 02, opens one `part-lead` ticket for each, starts two `bdk:lead` agents in the background, and after both return runs `bdk part done` for each part

### Requirement: execute acts on envelopes and next actions

`/bdk:execute` SHALL act on each envelope status of a role agent or lead: `done` continues; `done-with-concerns` continues after reading the entries it names unless one is a live `blocker`, which closes the ticket `fail`; `needs-context` resumes the same agent once naming what it asked for; `blocked` closes the ticket `fail` with the reason. An agent that returns without its report stored, with a report `log ingest` refused, or turns `suspect`, SHALL be resumed once with the cause named, and a second failure SHALL close the ticket `fail`.

It SHALL act on `next.action` of `attempt close`: `commit` runs `bdk commit <task>`; `part-done` runs `bdk part done <part>`; `retry` and `narrow` open the next ticket of the target; `escalate` opens it with `--escalate` and starts each of its agents on the `model` that `bdk dispatch build` returns; `parked` stops the loop and finishes. A `SendMessage` to the main thread about a critical entry SHALL stop new dispatches until the skill has decided on the entry, asking the user only when the entry needs a decision the plan and the design do not hold.

#### Scenario: escalation on its model

- **WHEN** `attempt close` of a task ticket answers `next.action: escalate`
- **THEN** the skill opens the next ticket with `bdk attempt open task-redispatch <task> --escalate` and starts the implementer with the `model` that `dispatch build` returned, so `guard/escalation-model` does not deny it

#### Scenario: parked target

- **WHEN** `attempt close` answers `next.action: parked`
- **THEN** the skill starts no further agent for that target and its final message names the park question and the `bdk change resume` command

### Requirement: execute ends with a report

`/bdk:execute` SHALL end its turn, once `next` leaves the execute stage or the Change is parked, with a report taken from the kernel's output: the parts with their state (`bdk part list`), the tasks committed in this run, the open `blocker` and `finding` entries of the Change, the pending `review: true` entries, and the next command: `/bdk:cr`, the review stage command the user types, or the resume command of a parked Change.

#### Scenario: review next

- **WHEN** every part is done and `next` returns the `review` node
- **THEN** the skill's last message lists the parts as done and names `/bdk:cr`
