# The BDK workflow - from an intent to a pull request

How the BDK v3 stages chain into one workflow, where the user decides, and how the autopilot `/bdk:run` drives a queue of Changes.

Notation in the diagrams: see the [glossary](./glossary.md#notation-in-the-diagrams).

## From intent to pull request

Each stage is a command of its own, and each one ends its turn with a report that names the next command. A stage writes its result to files and starts at its first missing file, so any stage can be run again after a break.

```mermaid
flowchart TB
  SETUP["/bdk:setup<br/>once per project"] --> PROP["/bdk:propose<br/>C/proposal.md"]
  PROP --> DES["/bdk:design<br/>C/specs, C/design.md"]
  DES --> DG(["design gate<br/>policy.gates.design"])
  DG -.->|"request changes"| DES
  DG -->|"approve"| PLAN["/bdk:plan<br/>C/plan/parts/NN.md"]
  PLAN --> COMMIT["commit the Change files"]
  COMMIT --> EXE["/bdk:execute<br/>code, a commit per part"]
  EXE --> AR["/bdk:auto-review<br/>rounds and fix passes"]
  AR --> TG(["/bdk:triage per round<br/>policy.gates.review"])
  TG -.->|"fix decisions:<br/>fix pass, next round"| AR
  TG -->|"no fix left"| CLOSE["/bdk:close<br/>archive, push, PR"]
  CLOSE --> PR(["pull request<br/>the user reviews and merges"])
```

Propose, design and plan leave the Change files uncommitted for review; `/bdk:run` commits them before execute, otherwise the user does. Three more entry points reuse these stages:

```mermaid
flowchart TB
  subgraph A["/bdk:run"]
    direction TB
    A1["queue from an intent<br/>or issues"] --> A2["per Change: branch,<br/>propose ... close"]
    A2 --> A3["PR per Change"]
  end
  subgraph B["/bdk:debug"]
    direction TB
    B1["/bdk:diagnose-bug:<br/>one-part fix Change"] --> B2(["fix gate"])
    B2 --> B3["execute,<br/>auto-review"]
  end
  subgraph C["/bdk:pr-review"]
    direction TB
    C1["review lead<br/>on any open PR"] --> C2(["post the review?"])
    C2 --> C3["one GitHub review"]
  end
```

Points where the user decides, and the setting that skips them:

| Point | Skill | Asked when | Skipped when |
|---|---|---|---|
| Open questions of the intent | `/bdk:propose` | two readings change the scope | `policy.questions: decide-and-record` (recorded under `## Decided without the user`) |
| Open design decisions, data-model changes | `/bdk:design-draft` | a decision the proposal, code or conventions do not settle | `policy.questions: decide-and-record` (recorded as `Decided without the user:`) |
| Design gate | `/bdk:design` | after a passing `verify-N.md` | `policy.gates.design: auto` |
| Retry blocked parts | `/bdk:execute` | the lead returns `Status: blocked` | never retried under `decide-and-record`: the stage stops |
| Triage of findings | `/bdk:triage` | every round with undecided findings | `policy.gates.review: auto` (fixed policy table) |
| Fix gate | `/bdk:debug` | after a `ready` diagnosis | `policy.gates.design: auto` |
| Post the PR review | `/bdk:pr-review` | before anything reaches GitHub | `policy.questions: decide-and-record`, or "post without asking" in the request |

## Autopilot: `/bdk:run` over a queue

`/bdk:run` writes only `.bdk/runs/run.json`. It calls the same stage skills a user would, one Change at a time, each Change on its own branch from the base (no stacking). It stops whenever a stage ends without moving its Change on.

```mermaid
flowchart TB
  A["/bdk:run<br/>[intent | #issue ...]"] --> Q{{"arguments?<br/>run.json?"}}
  Q -->|"none, run.json<br/>exists"| NEXT
  Q -->|"given, a queue<br/>is unfinished"| STOP1["stop: show the queue"]
  Q -->|"given"| BUILD["build the queue<br/>gh issue view, blocked-by<br/>write run.json"]
  BUILD --> NEXT
  NEXT{{"next Change<br/>not done?"}}
  NEXT -->|"none left"| FINAL["final report:<br/>PRs and decisions"]
  NEXT -->|"its branch exists"| SW["git switch"]
  NEXT -->|"no branch"| BLK{{"blockers in<br/>the queue merged?"}}
  BLK -->|"no"| WAIT["the Change waits"] --> NEXT
  BLK -->|"yes"| NEW["new branch<br/>from origin/base"]
  SW --> ST
  NEW --> ST
  ST["bdk run status --json<br/>stage of this Change"]
  ST -->|"done"| NEXT
  ST -->|"a stage"| CALL["Skill /bdk:&lt;stage&gt;"]
  CALL --> MOVED{{"stage<br/>moved on?"}}
  MOVED -->|"yes"| ST
  MOVED -->|"no"| STOP2["stop the run:<br/>the stage waits<br/>for the user"]
```

- A Change is done when `R/close/pr.md` exists. A blocker counts as merged only when `gh pr view` of its pull request says `MERGED`; a blocker outside the queue never makes a Change wait.
- The stage stays `design` while `R/design/gate.md` is not approved, whatever `bdk run status` says.
- Before `execute`, `/bdk:run` commits the uncommitted Change files with `/bdk:commit`: the execute lead builds only on a clean tree.
- A stage stops the run when it waits for the user: a gate or a question, a blocked part, a spent budget, a failing `/bdk:spec-conformance` report, a failed push.

## Sources

- `plugins/bdk/skills/*/SKILL.md`, in particular `run`, `propose`, `design`, `plan`, `execute`, `auto-review`, `close`, `debug`, `pr-review`
- `plugins/bdk/src/run/domain/status.ts` (`bdk run status`)
