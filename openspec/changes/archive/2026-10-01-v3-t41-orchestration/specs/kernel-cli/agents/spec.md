## Purpose

Agent registry commands (`agents`). They read the registry that the agent hooks write (`kernel-state`, Agent registry): which subagents run in this session, who started whom, which package each one works on, whom a ledger entry affects, and a blocking wait that lets a lead react to its children and to messages without ending its turn.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; a command that is Change-scoped only with a flag emits the Change-scoped common rules (`policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`) only with that flag. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "input/not-found",
  "why": "no agent a1b2c3d4e5f6a7b8c in the registry of this project",
  "instead": [
    "bdk agents list --all",
    "use the id from the BDK-AGENT-ID line of your start context"
  ]
}
```

## ADDED Requirements

### Requirement: bdk agents list

The agents of the registry with their state, parent and package. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk agents list [--children-of <agent-id>] [--affected-by <entry-id>] [--state starting|running|suspect|ended] [--all]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped only with `--affected-by`
- **Arguments:**
  - `--children-of <agent-id>`. Only the agents whose parent is this agent; `main` names the main thread.
  - `--affected-by <entry-id>`. Only the `running` agents whose active package's target the entry names: a ref of the entry names the target, the target's part, a task of a part target, or one of the `Files:` of the target (the match rule of `kernel-cli/dispatch`, bdk dispatch build, for ledger entries of a target).
  - `--state <state>`. Only agents in this state.
  - `--all`. Include `ended` agents; without it they are left out.
- **Behaviour:** Reads `.bdk/.machine/agents.sqlite` and the heartbeat files, and derives each agent's state at the time of the call (`kernel-state`, Agent registry), so a `suspect` agent is listed as `suspect` although no hook fired. Rows are ordered by start time, oldest first. A project without a registry lists nothing and exits 0. `--affected-by` resolves the entry in the active Change; an unknown entry id is `input/not-found`. An agent without an active package (a non-BDK agent type, or a BDK agent started without a package) never matches `--affected-by`. Text mode prints one line per agent: id, type, state, parent, target and ticket.
- **Writes:** nothing
- **Output:** `schema/cli/output/agents-list.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command, and with `--affected-by` of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk agents list --affected-by L-q7w2e9r4 --json
  ```

  ```json
  {
    "agents": [
      {
        "id": "a1b2c3d4e5f6a7b8c",
        "type": "bdk:worker",
        "state": "running",
        "parent": "a9f8e7d6c5b4a3f2e",
        "session": "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11",
        "package": ".bdk/changes/2026-09-25-login/dispatch/02-4-implementer-A-9k2m4n6p.md",
        "ticket": "A-9k2m4n6p",
        "target": "02-4",
        "startedAt": "2026-09-30T10:14:03.120Z",
        "lastSeenAt": "2026-09-30T10:19:44.901Z"
      }
    ]
  }
  ```

- **Owner:** T41
- **Slice:** `agents`

#### Scenario: example run

- **WHEN** `bdk agents list --affected-by L-q7w2e9r4 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/agents-list.json`

#### Scenario: affected by a file ref

- **WHEN** worker A runs task `02-3` with `Files: src/auth/token.ts`, worker B runs task `02-4` with `Files: src/auth/session.ts`, and entry `L-q7w2e9r4` has the ref `src/auth/session.ts`
- **THEN** `bdk agents list --affected-by L-q7w2e9r4 --json` lists worker B and not worker A

#### Scenario: affected by a part ref reaches the lead

- **WHEN** a lead runs the `part-lead` ticket of part `02` and an entry has the ref `02`
- **THEN** `--affected-by` lists the lead and every running worker of a task of part `02`

#### Scenario: suspect without a hook

- **WHEN** a worker's last heartbeat is older than `agents.ttl` and it has no open tool call
- **THEN** `bdk agents list --json` lists it with `state: suspect`, although no hook has fired since

#### Scenario: ended agents hidden by default

- **WHEN** one child of a lead has ended and one runs
- **THEN** `bdk agents list --children-of <lead> --json` lists one agent and `--all` lists two

#### Scenario: input/not-found

- **WHEN** `--affected-by` names an entry id the active Change does not hold
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk agents show

One agent of the registry with its lifecycle signals and children. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk agents show <agent-id>`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<agent-id>` (required). The host's agent id, or `main`.
- **Behaviour:** Prints every field of the agent's registry row (`kernel-state`, Agent registry), its derived state, whether a tool call is open and since when, the signal that ended it, its continuation count and its children with their states. An agent learns its own id and its parent's id from its start context (`kernel-cli/hooks`, bdk hooks subagent-start); this command is how it reads the rest. An id the registry does not hold is `input/not-found`.
- **Writes:** nothing
- **Output:** `schema/cli/output/agents-show.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk agents show a9f8e7d6c5b4a3f2e --json
  ```

  ```json
  {
    "id": "a9f8e7d6c5b4a3f2e",
    "type": "bdk:lead",
    "state": "running",
    "parent": "main",
    "session": "5d1c9e0a-2b7f-4c3e-9a61-0f2d8b7c4e11",
    "package": ".bdk/changes/2026-09-25-login/dispatch/02-lead-A-3h5j7k9m.md",
    "ticket": "A-3h5j7k9m",
    "target": "02",
    "startedAt": "2026-09-30T10:13:58.004Z",
    "lastSeenAt": "2026-09-30T10:20:01.377Z",
    "linkedAt": "2026-09-30T10:13:57.861Z",
    "openCallSince": "2026-09-30T10:19:02.110Z",
    "endedAt": null,
    "endedBy": null,
    "continuations": 0,
    "children": [
      { "id": "a1b2c3d4e5f6a7b8c", "type": "bdk:worker", "state": "running", "target": "02-4" }
    ]
  }
  ```

- **Owner:** T41
- **Slice:** `agents`

#### Scenario: example run

- **WHEN** `bdk agents show a9f8e7d6c5b4a3f2e --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/agents-show.json`

#### Scenario: ended by TaskStop

- **WHEN** the main thread stopped an agent with `TaskStop` and the recorded `PostToolUse` payload of `stop-kill.json` arrived
- **THEN** `bdk agents show <id> --json` has `state: ended` and `endedBy: task-stop`

#### Scenario: input/not-found

- **WHEN** `bdk agents show` names an id the registry does not hold
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

### Requirement: bdk agents wait

Block until something happens that the calling agent must react to. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk agents wait <agent-id> [--timeout <seconds>]`
- **Availability:** `agent`
- **Mode:** `command`
- **Arguments:**
  - `<agent-id>` (required). The caller's own id, from its start context.
  - `--timeout <seconds>`. How long to block with nothing to report; default 300, at most 540, so the call ends before the host's 10-minute `Bash` limit.
- **Behaviour:** The call a lead makes between dispatches instead of ending its turn (a lead that ends its turn ends, HOST-FACTS `lead-detach`). It returns every event for `<agent-id>` that no earlier `wait` of the same agent returned, at once when there is one, otherwise as soon as one occurs, checking at least once per second:
  - `message`: a `SendMessage` to the caller that `hooks pre-tool` admitted, with the sender and the ledger id it names; the host delivers the message itself when this tool call returns (HOST-FACTS `send-live`), so the event tells the caller to read it;
  - `report`: a child's report was stored by `log ingest`, with the child, its ticket and the envelope's `status`;
  - `ended`: a child ended without a stored report, with the signal that ended it;
  - `suspect`: a child turned `suspect`;
  - `timeout`: nothing happened within `--timeout`.

  Every answer also carries `elapsed`, the seconds since the caller's start, and the count of the caller's children in each state; this is the lead's time signal (T41-D8), with no budget. The Markdown output is one line per event followed by the one sentence `Read each message and report, act on it, then dispatch or wait again.` The call never ends the caller's turn and never writes to the Change. An id the registry does not hold is `input/not-found`; an `ended` caller is `input/invalid-argument`.

- **Writes:** `.bdk/.machine/agents.sqlite`
- **Output:** `schema/cli/output/agents-wait.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `input/not-found`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object). A timeout is exit 0 with a `timeout` event.
- **Example:**

  ```bash
  bdk agents wait a9f8e7d6c5b4a3f2e --json
  ```

  ```json
  {
    "events": [
      {
        "kind": "report",
        "agent": "a1b2c3d4e5f6a7b8c",
        "ticket": "A-9k2m4n6p",
        "status": "done"
      },
      {
        "kind": "message",
        "from": "a7c6b5d4e3f2a1b0c",
        "entry": "L-q7w2e9r4"
      }
    ],
    "elapsed": 344,
    "children": { "starting": 0, "running": 2, "suspect": 0, "ended": 1 }
  }
  ```

- **Owner:** T41
- **Slice:** `agents`

#### Scenario: example run

- **WHEN** `bdk agents wait a9f8e7d6c5b4a3f2e --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/agents-wait.json`

#### Scenario: returns on a stored report

- **WHEN** a lead waits and its child stores its report with `bdk log ingest` two seconds later
- **THEN** `wait` returns within three seconds of the ingest with one `report` event naming the child and its ticket

#### Scenario: returns on an admitted message

- **WHEN** a lead waits and a worker's `SendMessage` to the lead, naming `L-q7w2e9r4`, passes `hooks pre-tool`
- **THEN** `wait` returns with one `message` event carrying the worker's id and `L-q7w2e9r4`

#### Scenario: child cut off without a signal

- **WHEN** a lead waits and its child stops calling tools without any end signal, as with `maxTurns` (HOST-FACTS `stop-on-maxturns`)
- **THEN** `wait` returns a `suspect` event for the child once its heartbeat is older than `agents.ttl`

#### Scenario: no event is returned twice

- **WHEN** a `wait` returned a `report` event and the lead calls `wait` again
- **THEN** the second call does not return that event

#### Scenario: event between two waits

- **WHEN** a child's report is stored while the lead is not in `wait`
- **THEN** the lead's next `wait` returns the `report` event at once

#### Scenario: timeout

- **WHEN** nothing happens for `--timeout 2`
- **THEN** `wait` exits 0 after about two seconds with one `timeout` event and `elapsed`

#### Scenario: input/not-found

- **WHEN** `bdk agents wait` names an id the registry does not hold
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: timeout above the limit

- **WHEN** `bdk agents wait <id> --timeout 600` runs
- **THEN** the exit code is 3 and the error object carries `rule: input/invalid-argument` naming 540
