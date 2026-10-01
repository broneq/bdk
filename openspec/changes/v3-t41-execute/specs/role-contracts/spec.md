## MODIFIED Requirements

### Requirement: Swarm skill

The plugin SHALL ship `skills/swarm/SKILL.md`, `user-invocable: false`, which the stage skills that dispatch roles (`execute` of T41, `cr` of T42) and the `lead` role follow, holding principles only (T23-D6, D15; T41-D1 to D9, which supersede T23-D50's flat swarm) and no command usage beyond naming the commands:

- **Isolation.** A wave dispatches in parallel only tasks whose `Files:` are disjoint (P6); overlapping tasks wait for the next wave.
- **Prompt.** Each agent gets its package path and at most one sentence (Dispatch prompt).
- **Concurrency.** Each orchestrating agent, `main` or a lead, runs at most `execution.concurrency` children at once; the value comes from the skill's context (`Concurrency` section of `bdk ctx skill swarm`).
- **Tree.** `bdk next` marks each part of the execute wave `tree` or `flat` (`wave`, `kernel-cli/graph`, bdk next): `main` starts one lead per `tree` part and that lead runs the part's tasks; `main` runs the tasks of `flat` parts itself. The orchestrator never decides the mode. `main` never builds a deeper tree than lead, role agent and, under a worker, a scout.
- **Waiting.** Every agent is started in the background. A lead waits with `bdk agents wait <own id>` between dispatches, never by ending its turn; `main` ends its turn and is woken by the host's task notification.
- **Files carry the substance.** Everything an agent must know is in its package, the ledger or a report; a message names a ledger id and adds one sentence. Before the next wave the orchestrator reads what the finished tickets logged with `bdk log list --since-ticket-start <ticket>`, and a `SendMessage` to `main` about a critical finding stops the wave.
- **Steps under the ticket.** After an implementer returns with its report stored, its orchestrator dispatches the ticket's `steps` from `attempt open` in order under the same ticket, then closes it; `attempt close` decides whether the evidence suffices.
- **Escalation.** On `next.action: escalate` the orchestrator opens the escalation ticket with `bdk attempt open <loop> <target> --escalate` and starts each agent of that ticket on the `model` its `bdk dispatch build` returns, through the host's model parameter (T41-D14); `guard/escalation-model` denies a start without it. On `parked` it stops the target and reports.
- **Single resume.** An agent that returns without a stored report, with a refused one, or turns `suspect`, is resumed once with the cause named; a second failure closes the ticket `fail`.

Host specifics live in `skills/swarm/references/hosts/claude-code.md`, the only host in 3.0 (T23-D21): `Agent` with `run_in_background: true` returns the child's id at once and several such calls run concurrently; a subagent that ends its turn ends, and its background children report to `main` (HOST-FACTS `lead-detach`); a `SendMessage` reaches a running agent at its next tool round (HOST-FACTS `send-live`) and resumes a finished one (HOST-FACTS `send-by-id`); forked skills do not run concurrently under `claude -p` (HOST-FACTS `fork-concurrency`); the `Agent` call's `model` parameter overrides the adapter's model (HOST-FACTS `model-override`).

#### Scenario: swarm skill shape

- **WHEN** the content test reads `skills/swarm/SKILL.md`
- **THEN** its frontmatter has `user-invocable: false`, its body carries the skill context lines, names `--escalate` with the `model` of `bdk dispatch build`, `execution.concurrency`, `bdk log list --since-ticket-start`, `bdk agents wait`, disjoint `Files:`, the package path as the prompt, background dispatch, `SendMessage` to `main`, and links `references/hosts/claude-code.md`

#### Scenario: single resume wording

- **WHEN** the content test reads `skills/swarm/SKILL.md`
- **THEN** it tells the orchestrator to resume an agent with a missing or refused report, or a `suspect` one, once, naming the cause, and to close the ticket `fail` after a second failure

#### Scenario: mode from the kernel

- **WHEN** the content test reads `skills/swarm/SKILL.md`
- **THEN** it names `wave` of `bdk next` as the source of `tree` and `flat`, and holds no rule of its own on when a wave runs as a tree

#### Scenario: no flat-swarm sentence

- **WHEN** the content test reads `skills/swarm/SKILL.md`
- **THEN** it holds no sentence stating that the swarm is flat or that adapters carry no Agent tool
