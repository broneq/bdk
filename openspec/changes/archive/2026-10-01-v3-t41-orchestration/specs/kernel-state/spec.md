## MODIFIED Requirements

### Requirement: Attempt record

An attempt record SHALL be one file per ticket, created by `attempt open`, stamped with `package` by every `dispatch build` and with `rules-read` by the first `rules show --ticket` call under the implementer package, and completed by `attempt close`, with these fields.

| Field           | Type                                                                   | Req. | Stamped | Meaning                                                                                                                              |
| --------------- | ---------------------------------------------------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`        | integer                                                                | yes  | kernel  |                                                                                                                                      |
| `ticket`        | `A-` id                                                                | yes  | kernel  |                                                                                                                                      |
| `loop`          | `task-redispatch \| verify-fix \| review-fix \| verifier \| part-lead` | yes  |         | The loop the ticket counts against (`kernel-loops`, Loops, targets and rounds).                                                      |
| `target`        | string                                                                 | yes  |         | Task, part, artifact or Change id.                                                                                                   |
| `attempt`       | integer >= 1                                                           | yes  | kernel  | Derived from the records of the same loop, target and round (`kernel-loops`).                                                        |
| `of`            | integer >= 1                                                           | yes  | kernel  | Budget from policy.                                                                                                                  |
| `scope`         | `full \| high+ \| blockers`                                            | yes  |         |                                                                                                                                      |
| `narrowed-from` | `full \| high+ \| blockers`                                            | no   |         |                                                                                                                                      |
| `escalation`    | boolean                                                                | no   |         | The round's one-shot escalation ticket (`attempt open --escalate`); not counted against `of`.                                        |
| `model`         | string                                                                 | no   | kernel  | On the escalation ticket: `policy.escalation.model` when it opened. `dispatch build` copies it into the ticket's packages (T41-D14). |
| `opened-at`     | timestamp                                                              | yes  | kernel  |                                                                                                                                      |
| `author`        | string                                                                 | yes  | kernel  |                                                                                                                                      |
| `closed-at`     | timestamp                                                              | no   | kernel  | Present exactly when `outcome` is.                                                                                                   |
| `outcome`       | `ok \| fail \| not-run`                                                | no   |         |                                                                                                                                      |
| `findings`      | array of `{fingerprint, type, file, symbol?}`                          | no   | kernel  | Fingerprints of the `finding` and `blocker` entries of a `fail` (oscillation check).                                                 |
| `dropped`       | array of `L-` ids                                                      | no   |         | Findings that fell out of scope N+1.                                                                                                 |
| `rules-read`    | timestamp                                                              | no   | kernel  | First `rules show --ticket` call under the ticket's implementer package (risk R2); read by `attempt close`.                          |
| `package`       | relative path                                                          | no   | kernel  | The ticket's active package: the latest `dispatch build` of the ticket (T23-D42).                                                    |

The body is the close reason (`--reason` of `attempt close`, `taken over` from `change takeover`). `not-run` counters and budgets are derived from the records of a loop, target and round (`kernel-loops`, Loops, targets and rounds), never stored.

#### Scenario: closed without timestamp

- **WHEN** an attempt record has `outcome` but no `closed-at`
- **THEN** validation fails naming `closed-at`

#### Scenario: escalation loop name is gone

- **WHEN** an attempt record carries `loop: task-escalation`
- **THEN** reading the Change reports `state/ledger-invalid` naming `loop`

#### Scenario: rules-read survives a rebuild

- **WHEN** a ticket's record carries `rules-read` and `bdk rebuild` recreates the index
- **THEN** `attempt close` still finds the ticket's rules read

#### Scenario: active package follows the last build

- **WHEN** `dispatch build 02-3 implementer A-7f3k9m2q` and then `dispatch build 02-3 runner A-7f3k9m2q` run
- **THEN** the record's `package` is `dispatch/02-3-runner-A-7f3k9m2q.md`

#### Scenario: part-lead ticket

- **WHEN** an attempt record carries `loop: part-lead` and `target: 02`
- **THEN** it validates, and `bdk attempt list --for 02 --json` lists it

### Requirement: Write map

Every path of the Change directory, every ledger entry type and every rule file SHALL have at least one writer named in the tables below, and only the named writers SHALL write them.

Files:

| Path                              | Writers                                                                                                                                                                                                   | Channel                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `change.md`                       | `change new`; `import` (each v2 design becomes a Change with `source: inferred`, through the code of `change new --inferred`)                                                                             | kernel                  |
| `log/`                            | the commands of the entry-type table                                                                                                                                                                      | kernel                  |
| `design.md`, `architecture.md`    | `design` skill                                                                                                                                                                                            | host file tools         |
| `design/parts/`                   | `design` skill                                                                                                                                                                                            | host file tools         |
| `design/index.md`                 | `done`, `rebuild`, `change takeover`                                                                                                                                                                      | kernel                  |
| `plan/parts/`                     | `plan` skill; `part split`                                                                                                                                                                                | host file tools; kernel |
| `plan/index.md`                   | `done`, `part split`, `rebuild`, `change takeover`                                                                                                                                                        | kernel                  |
| `spec-delta/`                     | `design` and `plan` skills                                                                                                                                                                                | host file tools         |
| `attempts/`                       | `attempt open`, `attempt close`, `change takeover`; `rules show --ticket` (the `rules-read` stamp); `dispatch build` (the `package` stamp)                                                                | kernel                  |
| `evidence/`                       | `evidence record`; `attempt close` (the `simplify` manifest)                                                                                                                                              | kernel                  |
| `dispatch/`                       | `dispatch build`                                                                                                                                                                                          | kernel                  |
| `reports/`                        | `log ingest` (the report of every role, on stdin, at the active package's `report` path)                                                                                                                  | kernel                  |
| any file (migration)              | `rebuild`, `change takeover`                                                                                                                                                                              | kernel                  |
| the Change directory (archive)    | `change close`, which writes `dispatch/pruned.md` and `reports/pruned.md` through the prune function unless `archive.keep-evidence`, then moves the directory to `.bdk/changes/archive/<changeId>/` (T30) | kernel                  |
| `.bdk/specs/<capability>/spec.md` | `spec merge`, `change close` (through the merge); never a host file tool (V1-7; T24 guards it)                                                                                                            | kernel                  |
| `.bdk/rules/<ruleId>.md`          | `rules accept`, `rules import`, `import`                                                                                                                                                                  | kernel                  |

Entry types (`source` values each writer stamps):

| Type          | Writers and `source`                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decision`    | `log add` (`agent:<role>`, or `kernel` on the main thread without a ticket); `change resume`, `part split`, `done` for the profile raise of a split design (`kernel`)                                                                                                                             |
| `finding`     | `log add`; `attempt close` and `commit` for undeclared files, `attempt close` for an implementer that read no rules, `attempt open` for dropped findings, `commit` and `part done` for the tiny guard, `hooks stop` and `hooks subagent-stop` for a thread that stopped with work open (`kernel`) |
| `observation` | `log add` (including a downgraded uncategorised verifier blocker, P8)                                                                                                                                                                                                                             |
| `blocker`     | `log add`                                                                                                                                                                                                                                                                                         |
| `question`    | `log add`; `change park` and `attempt close` at the end of the ladder (`kernel`, with `park: true`)                                                                                                                                                                                               |
| `assumption`  | `log add`; `change new` for the proposed profile (`kernel`)                                                                                                                                                                                                                                       |
| `risk`        | `log add`                                                                                                                                                                                                                                                                                         |
| `learning`    | `log add` (`agent:<role>` or `kernel`); status by `log resolve`                                                                                                                                                                                                                                   |
| `report`      | `log add`                                                                                                                                                                                                                                                                                         |
| `transition`  | `hooks prompt-expansion` (`user` for a typed stage command, `policy` for an auto gate, `kernel` for a stage without a gate); `done`, `part start` (without `input-hash`), `part done`, `change takeover`, `change close` (`kernel`)                                                               |

Rules without exception: `intent` lives only in `change.md`, written only by `change new` (which `import` reuses); a stage skill started without an active Change calls `change new --inferred`; `plan` and `close` never create a Change (R-12). `log add` never writes `transition`, `log ingest` writes no entry at all, and never stamp `user`, `policy` or `inferred`. `source: user` is stamped only by `hooks prompt-expansion` (T1, P1).

#### Scenario: every file has a writer

- **WHEN** the write map contract test walks the layout table and the ten entry types
- **THEN** each has at least one writer in the tables above

#### Scenario: log add cannot write a transition

- **WHEN** `log add` is called with `type: transition`
- **THEN** the exit code is 3 and no file is written

#### Scenario: ladder writers are mapped

- **WHEN** the write map contract test reads the records of `attempt open`, `attempt close`, `part done` and `change takeover`
- **THEN** every Change path in their `writes[]` appears in the file table naming them

#### Scenario: nested delta path

- **WHEN** a Change directory holds `spec-delta/auth/login.md`
- **THEN** reading the Change accepts it as the spec delta of capability `auth/login`, and `spec-delta/Auth_Login.md` is `state/ledger-invalid`

#### Scenario: spec-impact omitted

- **WHEN** a plan part's frontmatter has no `spec-impact` field
- **THEN** it validates against the plan part schema

### Requirement: Dispatch package

A dispatch package SHALL be written only by `dispatch build`, with the frontmatter fields below (K3, K4, P10) and the body sections that `kernel-cli/dispatch`, `bdk dispatch build`, lists in order; the whole file is at most 12 288 bytes.

| Field            | Type                        | Req. | Stamped | Meaning                                                                                                                                                      |
| ---------------- | --------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema`         | integer                     | yes  | kernel  |                                                                                                                                                              |
| `ticket`         | `A-` id                     | yes  | kernel  |                                                                                                                                                              |
| `target`         | string                      | yes  | kernel  |                                                                                                                                                              |
| `role`           | string                      | yes  | kernel  | Role skill name (`implementer`, `verifier`, ...).                                                                                                            |
| `adapter`        | string                      | yes  | kernel  | The role's adapter (`role-contracts`, Role-to-adapter map).                                                                                                  |
| `attempt`        | integer >= 1                | yes  | kernel  |                                                                                                                                                              |
| `of`             | integer >= 1                | yes  | kernel  |                                                                                                                                                              |
| `scope`          | `full \| high+ \| blockers` | yes  | kernel  |                                                                                                                                                              |
| `model`          | string                      | no   | kernel  | The escalation ticket's `model`, on every package of the ticket but a `runner` or `scout` one; the agent must run on it (T41-D14, `guard/escalation-model`). |
| `at`             | timestamp                   | yes  | kernel  |                                                                                                                                                              |
| `kernel-version` | string                      | yes  | kernel  | P10.                                                                                                                                                         |
| `template-hash`  | hash                        | yes  | kernel  | P10.                                                                                                                                                         |
| `report`         | path                        | yes  | kernel  | Where the role's report is written (`reports/...`).                                                                                                          |
| `rules`          | array of rule ids           | yes  | kernel  | The rules selected for the ticket, in order (T31); may be empty.                                                                                             |

#### Scenario: package without template hash

- **WHEN** a dispatch package lacks `template-hash`
- **THEN** validation fails naming `template-hash`

#### Scenario: package with an unknown adapter

- **WHEN** a dispatch package carries `adapter: planner`
- **THEN** validation fails naming `adapter`

#### Scenario: escalation package names its model

- **WHEN** `dispatch build` builds the `implementer` and the `runner` package of an escalation ticket opened with `policy.escalation.model: opus`
- **THEN** the implementer package holds `model: opus` and the runner package holds no `model`

#### Scenario: package records its rules

- **WHEN** a package is built for a `runner` ticket
- **THEN** its frontmatter holds `rules: []`, and a package without `rules` fails validation naming `rules`

## ADDED Requirements

### Requirement: Agent registry

The kernel SHALL keep a registry of the subagents of the project's sessions in `.bdk/.machine/agents.sqlite` and `.bdk/.machine/agents/`, written only by the agent hooks, `hooks pre-tool`, `hooks session-start` and `agents wait`, and SHALL derive each agent's state from the recorded signals and the heartbeat at read time (T41-D6).

The registry is live machine state, not a cache: no committed file can rebuild it, so it is a database of its own, never a table of `index.sqlite` (Rebuildable index), and it is never committed (Ignored paths). A registry of another schema version, or one SQLite cannot open, is replaced by an empty one; deleting it loses only the view of agents that run at that moment. Every write runs in one `BEGIN IMMEDIATE` transaction with a busy timeout of 5 s, as the index does.

| Field           | Type                                                          | Meaning                                                                                                                                             |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string                                                        | The host's `agent_id`; the main thread is `main` and has no row.                                                                                    |
| `type`          | string                                                        | `agent_type` (`bdk:worker`, `Explore`, ...).                                                                                                        |
| `session`       | string                                                        | `session_id` of the payload that created the row.                                                                                                   |
| `parent`        | agent id, `main` or null                                      | From the parent's `PostToolUse` on `Agent` (HOST-FACTS `agent-link`): its `agent_id`, or `main` when it has none.                                   |
| `package`       | relative path or null                                         | The dispatch package path in the parent's `tool_input.prompt` (`guard/dispatch-prompt` ensures exactly one for a BDK adapter).                      |
| `ticket`        | `A-` id or null                                               | The package's ticket.                                                                                                                               |
| `target`        | string or null                                                | The package's target.                                                                                                                               |
| `started-at`    | timestamp or null                                             | `SubagentStart`.                                                                                                                                    |
| `linked-at`     | timestamp or null                                             | The parent's `PostToolUse` on `Agent`; for a background spawn it precedes `started-at` (HOST-FACTS `agent-link`).                                   |
| `ended-at`      | timestamp or null                                             | The last end signal.                                                                                                                                |
| `ended-by`      | `subagent-stop \| task-stop \| agent-result \| stale` or null | Which signal ended it: `SubagentStop` allowed by the continuation check, `PostToolUse` on `TaskStop`, a foreground `Agent` result, a stale session. |
| `continuations` | integer                                                       | Consecutive turn ends the continuation check blocked without progress (`kernel-cli/hooks`, bdk hooks subagent-stop).                                |

A heartbeat file `.bdk/.machine/agents/<id>` is written by the shell prefilter on every tool call of a subagent (`kernel-cli/hooks`, Guard hooks file and prefilter): its modification time is the agent's last activity and its content is `open` between `PreToolUse` and `PostToolUse` and `idle` after. Messages admitted by `hooks pre-tool` are rows of a second table with the sender, the recipient, the ledger id, the time and whether a `wait` of the recipient returned them; a child has reported when the `report` path of its package exists (`log ingest` wrote it), which the registry reads and never stores; the child reports and state changes a `wait` returned are tracked by a per-agent cursor.

State, derived at every read with `last` = the later of the heartbeat time and `started-at`:

| State      | When                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ended`    | `ended-at` is set and no heartbeat is newer than it. A heartbeat newer than `ended-at` (an agent resumed by `SendMessage`, HOST-FACTS `send-by-id`) makes it `running` again.               |
| `suspect`  | Not `ended`, and either the heartbeat is `idle` or absent and `last` (or `linked-at` before any start) is older than `agents.ttl`, or it is `open` and older than `agents.open-call-limit`. |
| `starting` | Linked by the parent, no `SubagentStart` yet, and not `suspect`.                                                                                                                            |
| `running`  | Otherwise.                                                                                                                                                                                  |

`suspect` is never written: the next heartbeat turns the agent `running` without any hook for it. `SubagentStop` is missing when an agent is cut off by `maxTurns` or killed with `TaskStop` (HOST-FACTS `stop-on-maxturns`, `stop-on-taskstop`), so the lease is the only end signal the registry can count on; the others only make the end visible sooner. `hooks session-start` ends, as `stale`, every row of another session whose `last` is older than `agents.ttl`; rows of a session that still runs next to this one keep their state.

#### Scenario: lifecycle of a background worker

- **WHEN** the recorded payloads of `lifecycle-bg.json` arrive in order: the parent's `PostToolUse` on `Agent` with `status: async_launched`, the child's `SubagentStart`, its tool calls and its `SubagentStop`
- **THEN** the row is `starting` after the first, `running` after the second with `parent` set, and `ended` with `ended-by: subagent-stop` after the last

#### Scenario: killed agent

- **WHEN** the recorded payloads of `stop-kill.json` arrive, with a `PostToolUse` on `TaskStop` and no `SubagentStop` for the killed agent
- **THEN** the agent is `ended` with `ended-by: task-stop`

#### Scenario: cut off by maxTurns

- **WHEN** the recorded payloads of `max-turns.json` arrive, with no `SubagentStop`, and `agents.ttl` passes without a heartbeat
- **THEN** the agent is `suspect`

#### Scenario: long tool call is not suspect

- **WHEN** a worker's heartbeat is `open` for eight minutes with `agents.ttl` at 5 min and `agents.open-call-limit` at 12 min
- **THEN** the worker is `running`

#### Scenario: resumed agent runs again

- **WHEN** an agent `ended` by `subagent-stop` receives a `SendMessage` and calls a tool
- **THEN** it is `running` again

#### Scenario: registry is not in the index

- **WHEN** `bdk rebuild` runs or `index.sqlite` is deleted
- **THEN** the registry keeps every row, and `bdk query "select * from agents"` fails because the index has no such table

#### Scenario: stale session

- **WHEN** a session starts and the registry holds a `running` row of another session whose heartbeat is an hour old, and a row of another session whose heartbeat is ten seconds old
- **THEN** the first is `ended` with `ended-by: stale` and the second keeps its state
