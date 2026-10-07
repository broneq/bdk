## RENAMED Requirements

- FROM: `### Requirement: execute runs each part in the mode the kernel gives`
- TO: `### Requirement: execute runs each part as one ticket`

## MODIFIED Requirements

### Requirement: plan writes the plan the kernel asks for

`/bdk:plan` SHALL read `bdk next --json` and write the plan parts its instruction names, at `plan/parts/<nn>-<slug>.md` with exactly the frontmatter fields the instruction lists, then mark them with `bdk done plan`. Before it writes, it SHALL read the design files of the Change (when the Change has a design stage), the accepted decisions and live questions of the ledger, and the code the tasks will touch; a `bug` or `tiny` Change, which has no design stage, is planned from its intent and the code.

The intent and the design SHALL set the size of the plan: a task states only the behaviour the Change alters, and anything else the skill notices (a guard in a caller, an input nobody reported, a cleanup) is recorded as a `finding`, not planned. Scope SHALL grow only to keep correct what the Change itself breaks (a direct caller whose output the fix changes), and only by tasks in the existing parts; growth that would add a part, change a shared data model or reach modules beyond those direct callers SHALL be recorded as a `finding` for a follow-up Change, and a question about growing the scope SHALL name the tasks and files it adds and offer the option that keeps the plan to the intent. Each part SHALL hold at most `plan.part.max-tasks` tasks (default 5) whose `Files:` name at most `plan.part.max-files` distinct paths (default 10), both values stated in the plan instruction of `bdk next`, and stay within 8 KB, because one agent implements a whole part (#166); it SHALL group tasks so that parts without a dependency between them can run in the same wave, splitting a larger unit of work into such parts; `depends-on` names every part whose output a part consumes. For every part that can share a wave with another part, the skill SHALL decide `isolation` (T45): `worktree`, with an `isolation-reason` naming the state, when the part touches state outside its `Files:` that a part of the same wave touches too (a lockfile or codegen output both regenerate, migration numbering, snapshot files, a whole-project build or typecheck, a port, a database or fixtures), and `shared`, written or left absent, otherwise; parts whose `Files:` overlap get a `depends-on`, never a worktree. For each capability a part names in `spec-impact`, the skill SHALL write `spec-delta/<capability>.md` and check it with `bdk spec delta check` before `bdk done plan`. Every acceptance or `Verification:` line SHALL name the exact commands to run, never a set described by exclusion, and SHALL run no command that spends money, needs credentials or reaches a shared or external system unless an accepted `decision` entry names it (#166). Before `bdk done plan` it SHALL go through the `BDK-PL` rules of the instruction by id and correct the parts until each holds.

A live `question` entry whose answer changes what a task builds SHALL be settled before `bdk done plan`: the skill answers it from the design or the code when they settle it, and otherwise asks the user (Asking the user in two tiers); each answer is recorded as a `decision` entry with a ref to the question's ref, and the question is resolved.

When `bdk next` refuses because no Change is active, the skill SHALL write nothing and name the command of the refusal's `instead`. The skill is started only by the user (`disable-model-invocation: true`).

#### Scenario: bug Change planned without a design

- **WHEN** `/bdk:plan` runs on a `bug` Change opened with a reproduction of a wrong fallback in `formatTimestamp`
- **THEN** `plan/parts/` holds exactly one part, `bdk part list --json` reports it within 5 tasks, 10 files and 8 KB, and `plan` is done without any design file in the Change

#### Scenario: spec delta written before done

- **WHEN** a part the skill writes declares `spec-impact: [ui-format]`
- **THEN** `spec-delta/ui-format.md` exists and passes `bdk spec delta check ui-format` before `bdk done plan` runs, and `plan` is done

#### Scenario: open question settled

- **WHEN** the ledger holds a live `question` "Which locale does formatDate default to?" and the design does not answer it
- **THEN** the skill asks the user before `bdk done plan`, the ledger holds a `decision` with the answer, and the question is resolved

#### Scenario: hidden shared lockfile gets a worktree

- **WHEN** `/bdk:plan` plans a `large` Change whose two parts have disjoint `Files:`, no dependency between them, and each adds a dependency so that both regenerate `pnpm-lock.yaml`
- **THEN** at least one part sets `isolation: worktree` with an `isolation-reason` naming `pnpm-lock.yaml`, and the parts have no `depends-on` between them

#### Scenario: no active Change

- **WHEN** `/bdk:plan` runs on a branch without an active Change
- **THEN** no file under `.bdk/changes/` is written and the final reply names `/bdk:change`

#### Scenario: not started by the model

- **WHEN** a model calls the `Skill` tool with `bdk:plan`
- **THEN** the host refuses the call, because `plan` sets `disable-model-invocation: true`

#### Scenario: a large unit of work is split

- **WHEN** the work of one module needs seven tasks under the default settings
- **THEN** the skill writes it as two parts of at most 5 tasks each, and `bdk done plan` passes the `tasks` and `files` checks

#### Scenario: acceptance names exact commands

- **WHEN** `/bdk:plan` finishes on a `small` feature Change
- **THEN** every acceptance and `Verification:` line names its commands, none of them by exclusion

### Requirement: plan verifies and corrects itself

After `bdk done plan`, for a Change whose graph holds `plan-verify`, `/bdk:plan` SHALL run `/bdk:verify-plan` and act on the verdict without asking the user what the plan, the design or the code settle:

- every blocker whose fix changes no decision recorded in the ledger or the design (a `false-code-claim`, a behaviour without a test case, an undeclared dependency between parts, a design requirement no task covers when the design states it) SHALL be corrected, its blocker resolved with `bdk log resolve` and a reason;
- every blocker whose fix needs a decision the design does not hold, grows the scope beyond the intent (a caller whose user-visible behaviour the Change alters), or runs a costly command (category `costly-command`, unless the skill can name exact commands that need no such command), SHALL go to the user in one question listing each such blocker with a proposed fix and, for scope, the intent-only option; the answer is recorded as a `decision`;
- findings that come with a failing verdict MAY be fixed together with its blockers; a passing verdict, `done-with-concerns` included, SHALL close the plan: no part is edited after it except for a change the user requests in `--review`, and every finding goes to execution with its reason in the report.

After any correction it SHALL run `bdk done plan` again and `/bdk:verify-plan` again, so the verdict is never older than the plan, and repeat until the verdict passes or the kernel's next action is `parked`; the kernel's verifier budget is the only limit on rounds, so no blocker fix is skipped to save a round; on `escalate` the next round opens escalated. On `parked` it SHALL stop and name the resume command the kernel printed, with the blockers that remain.

#### Scenario: blocker corrected without a question

- **WHEN** the verdict holds one `false-code-claim` blocker: task `01-2` calls `formatTimestamp(value)` with a second argument `locale` that the function does not take
- **THEN** the skill corrects the task to the real signature, resolves the blocker, runs `bdk done plan` and `/bdk:verify-plan` again, and asks the user nothing

#### Scenario: decision asked once

- **WHEN** the verdict holds two blockers that need a product decision the design does not record
- **THEN** the skill asks the user one question covering both, records the answers as `decision` entries, corrects the plan and verifies again

### Requirement: execute runs the execute stage the kernel hands it

`/bdk:execute` SHALL loop on `bdk next` and keep working while `next` returns a node of the `execute` stage: the `execute-part` instances of its `wave`, `spec-delta` (marked with `bdk done spec-delta`) and a post-task step node of a part that is already done (run in a `verify-fix` ticket of that part). One `/bdk:execute` SHALL run every ready part; a pending `review: true` entry or the status of a later gate SHALL NOT end the loop while an execute-stage node is ready. When `next` returns a node of an earlier stage, the skill SHALL dispatch nothing and name the stage command that `next` gives. It SHALL never edit a project file or run tests or linters itself (`disallowed-tools: Edit Write NotebookEdit`): role agents do the work, `bdk check run` runs the checks and the kernel records them.

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

### Requirement: execute runs each part as one ticket

For each part of `wave` that is not started, `/bdk:execute` SHALL run `bdk part start <part>` and then run the part as one `part` ticket (#166): `bdk attempt open part <part>`, `bdk dispatch build <part> implementer <ticket>`, one `bdk:worker` started in the background with the package path as the whole prompt; when it returns with its report stored, `bdk dispatch build <part> conformer <ticket>` and one more `bdk:worker` for it; when that returns, `bdk attempt close <ticket>` with the outcome its envelopes give, and on `next.action: part-done` `bdk part done <part>`. The skill starts no agent per task and runs no `bdk commit`: the implementer commits each task and the conformer its fixes, after `bdk check run`. A part already started with an open ticket continues from that ticket's next step; a started part without one opens the next ticket, whose package marks the tasks already committed.

For a part whose wave item carries `workdir` (`kernel-cli/graph`, bdk next), the main thread starts each agent with the package path as before; the package carries the work root, so the skill passes no path of its own and starts no agent with the host's own worktree isolation (`isolation: worktree` on Claude Code branches from the default branch, T45). On `policy/merge-conflict` of `part done` the skill SHALL follow its `instead`: open the merge ticket with `bdk attempt open verify-fix <part>`, dispatch the implementer and then the conformer as for any part ticket, close it, and on `next.action: part-done` run `part done` again; a `parked` answer goes to the user like any other. On `runtime/worktree-setup-failed` of `part start` and on `policy/worktree-dirty` of `part done`, the skill SHALL start nothing more for that part, keep running the other parts of the wave, and name the refusal and its `instead` to the user in its report. It SHALL NOT run git in a worktree, edit the worktree itself, or set `execution.worktree.enabled`. On `policy/merge-blocked` it SHALL run `part done` again after the next commit of the home checkout.

The main thread SHALL run at most `execution.concurrency` agents at once, SHALL start every agent in the background and SHALL end its turn while they run, to be woken by the host's task notification. After `bdk part done` it SHALL run `bdk next` again.

#### Scenario: one agent per part

- **WHEN** `wave` lists part 01 with three tasks
- **THEN** the main thread opens one `part` ticket for part 01, starts exactly two agents for it, an implementer and a conformer, each task ends as a commit with its `BDK-Task` trailer, and `bdk part done 01` exits 0

#### Scenario: parts of a wave in parallel

- **WHEN** `wave` lists parts 01 and 02, disjoint and not started
- **THEN** the main thread starts the implementers of 01 and 02 before either returns, and runs `bdk part done` for each part after its ticket closes `ok`

#### Scenario: a later ticket continues the part

- **WHEN** the first `part 02` ticket closed `fail` after tasks `02-1` and `02-2` were committed
- **THEN** the next ticket's implementer package marks `02-1` and `02-2` committed and the run commits only `02-3`

#### Scenario: worktree and shared part in parallel

- **WHEN** `wave` lists part 01 (`isolation: shared`) and part 02 (`isolation: worktree`), disjoint, each adding a different dependency so both regenerate `pnpm-lock.yaml`
- **THEN** the main thread starts both parts before either is done, the commits of 02 land on the Change branch with their trailers through the merge commit of `part done 02`, the lockfile conflict is settled by one merge ticket whose package carries the merge instruction, the merged `pnpm-lock.yaml` holds both dependencies, the ledger of the home checkout holds the entries of both parts, and `git worktree list` holds no worktree of the Change afterwards

#### Scenario: merge conflict resolved in a merge ticket

- **WHEN** `part done 02` answers `policy/merge-conflict` naming `pnpm-lock.yaml`
- **THEN** the skill opens `verify-fix 02`, the implementer regenerates the lockfile in the worktree, `bdk check run 02` records the checks, the ticket closes `ok`, and the next `part done 02` exits 0 and leaves no worktree

#### Scenario: unresolved conflict goes to the user

- **WHEN** the merge tickets of part 02 use up the `verify-fix` budget and the ladder answers `parked`
- **THEN** the skill starts nothing more for part 02 and its final report names the park question, the worktree and the unmerged paths

#### Scenario: flat part

- **WHEN** `wave` lists part 01 with two tasks
- **THEN** the main thread opens one `part` ticket for part 01 and no ticket per task, and each task ends as a commit with its trailer

#### Scenario: tree parts

- **WHEN** `wave` lists parts 01 and 02 of a `large` Change, not started
- **THEN** the main thread runs them exactly as for a `small` Change: one `part` ticket and two agents per part

### Requirement: execute acts on envelopes and next actions

`/bdk:execute` SHALL act on each envelope status of a role agent: `done` continues; `done-with-concerns` continues after reading the entries it names unless one is a live `blocker`, which closes the ticket `fail`; `needs-context` resumes the same agent once naming what it asked for; `blocked` closes the ticket `fail` with the reason. An agent that returns without its report stored, with a report `log ingest` refused, or turns `suspect`, SHALL be resumed once with the cause named, and a second failure SHALL close the ticket `fail`.

It SHALL act on `next.action` of `attempt close`: `part-done` runs `bdk part done <part>`; `retry` and `narrow` open the next ticket of the part; `escalate` opens it with `--escalate` and starts each of its agents on the `model` that `bdk dispatch build` returns; `parked` stops the loop and finishes. A `SendMessage` to the main thread about a critical entry SHALL stop new dispatches until the skill has decided on the entry, asking the user only when the entry needs a decision the plan and the design do not hold.

#### Scenario: escalation on its model

- **WHEN** `attempt close` of a `part` ticket answers `next.action: escalate`
- **THEN** the skill opens the next ticket with `bdk attempt open part <part> --escalate` and starts the implementer with the `model` that `dispatch build` returned, so `guard/escalation-model` does not deny it

#### Scenario: parked target

- **WHEN** `attempt close` answers `next.action: parked`
- **THEN** the skill starts no further agent for that target and its final message names the park question and the `bdk change resume` command

#### Scenario: uncommitted task at close

- **WHEN** the implementer returned `done` and `attempt close <ticket> ok` refuses with `policy/tasks-uncommitted` naming `02-3`
- **THEN** the skill resumes the implementer once naming `02-3`, and closes the ticket `fail` when the task is still not committed

### Requirement: execute ends with a report

`/bdk:execute` SHALL end its turn, once `next` leaves the execute stage or the Change is parked, with a report taken from the kernel's output: the parts with their state (`bdk part list`), the tasks committed in this run, the wall time and the agents started per part, the open `blocker` and `finding` entries of the Change, the pending `review: true` entries, and the next command: `/bdk:cr`, the review stage command the user types, or the resume command of a parked Change.

#### Scenario: review next

- **WHEN** every part is done and `next` returns the `review` node
- **THEN** the skill's last message lists the parts as done and names `/bdk:cr`

### Requirement: setup reports the keys it leaves on defaults

The Finish report of `/bdk:setup` SHALL name every key its context lists under `#### Not set by setup`, grouped by its first key segment, each with its value, and SHALL mark a key a layer sets with that layer, so the user sees the whole settings surface once. It SHALL say that any of them is changed with `bdk config set <key> <value>` and that `docs/guide/reference/configuration.md` describes each. It SHALL also report each `derived` value it wrote with the project file it came from.

#### Scenario: Finish names the defaults

- **WHEN** `/bdk:setup` finishes on the fixture project of requirement "setup covers every derived and asked key"
- **THEN** the report names `policy.budgets.part`, `execution.concurrency`, `agents.ttl` and `diagnostics.verbose` with their values, and states how to change one

#### Scenario: Finish marks a layer value

- **WHEN** `.bdk/settings.local.yaml` sets `diagnostics.verbose: true` and `/bdk:setup` finishes
- **THEN** the report shows `diagnostics.verbose` as `true` from the `local` layer
