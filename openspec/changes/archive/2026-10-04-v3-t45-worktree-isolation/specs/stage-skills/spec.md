## MODIFIED Requirements

### Requirement: plan writes the plan the kernel asks for

`/bdk:plan` SHALL read `bdk next --json` and write the plan parts its instruction names, at `plan/parts/<nn>-<slug>.md` with exactly the frontmatter fields the instruction lists, then mark them with `bdk done plan`. Before it writes, it SHALL read the design files of the Change (when the Change has a design stage), the accepted decisions and live questions of the ledger, and the code the tasks will touch; a `bug` or `tiny` Change, which has no design stage, is planned from its intent and the code.

The intent and the design SHALL set the size of the plan: a task states only the behaviour the Change alters, and anything else the skill notices (a guard in a caller, an input nobody reported, a cleanup) is recorded as a `finding`, not planned. Scope SHALL grow only to keep correct what the Change itself breaks (a direct caller whose output the fix changes), and only by tasks in the existing parts; growth that would add a part, change a shared data model or reach modules beyond those direct callers SHALL be recorded as a `finding` for a follow-up Change, and a question about growing the scope SHALL name the tasks and files it adds and offer the option that keeps the plan to the intent. Each part SHALL hold at most 8 tasks and stay within 8 KB, and SHALL group tasks so that parts without a dependency between them can run in the same wave; `depends-on` names every part whose output a part consumes. For every part that can share a wave with another part, the skill SHALL decide `isolation` (T45): `worktree`, with an `isolation-reason` naming the state, when the part touches state outside its `Files:` that a part of the same wave touches too (a lockfile or codegen output both regenerate, migration numbering, snapshot files, a whole-project build or typecheck, a port, a database or fixtures), and `shared`, written or left absent, otherwise; parts whose `Files:` overlap get a `depends-on`, never a worktree. For each capability a part names in `spec-impact`, the skill SHALL write `spec-delta/<capability>.md` and check it with `bdk spec delta check` before `bdk done plan`. Before `bdk done plan` it SHALL go through the `BDK-PL` rules of the instruction by id and correct the parts until each holds.

A live `question` entry whose answer changes what a task builds SHALL be settled before `bdk done plan`: the skill answers it from the design or the code when they settle it, and otherwise asks the user (Asking the user in two tiers); each answer is recorded as a `decision` entry with a ref to the question's ref, and the question is resolved.

When `bdk next` refuses because no Change is active, the skill SHALL write nothing and name the command of the refusal's `instead`. The skill is started only by the user (`disable-model-invocation: true`).

#### Scenario: bug Change planned without a design

- **WHEN** `/bdk:plan` runs on a `bug` Change opened with a reproduction of a wrong fallback in `formatTimestamp`
- **THEN** `plan/parts/` holds exactly one part, `bdk part list --json` reports it within 8 tasks and 8 KB, and `plan` is done without any design file in the Change

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

### Requirement: execute runs each part in the mode the kernel gives

For each part of `wave` that is not started, `/bdk:execute` SHALL run `bdk part start <part>` and then follow the part's `mode`:

- `flat`: the main thread runs the part's task tickets as the swarm skill states (a task starts once the tasks its `Depends on:` names are committed and its `Files:` are disjoint from the running ones; `attempt open task-redispatch`, `dispatch build <task> implementer`, a background `Agent` with the package path; the ticket's `steps` under the same ticket; `attempt close`; `commit` on `next.action: commit`), and runs `bdk part done <part>` when every task of the part is committed;
- `tree`: the main thread opens `bdk attempt open part-lead <part>`, builds the lead's package with `bdk dispatch build <part> lead <ticket>`, starts `bdk:lead` in the background with the package path as the whole prompt, and when the lead returns closes the `part-lead` ticket and, on `next.action: part-done`, runs `bdk part done <part>`.

For a part whose wave item carries `workdir` (`kernel-cli/graph`, bdk next), the main thread and the lead start each agent with the package path as before; the package carries the work root, so the skill passes no path of its own and starts no agent with the host's own worktree isolation (`isolation: worktree` on Claude Code branches from the default branch, T45). On `policy/merge-conflict` of `part done` the skill SHALL follow its `instead`: open the merge ticket with `bdk attempt open verify-fix <part>`, dispatch the implementer and then the ticket's `steps` as for any code ticket, close it, and on `next.action: part-done` run `part done` again; a `parked` answer goes to the user like any other. On `runtime/worktree-setup-failed` of `part start` and on `policy/worktree-dirty` of `part done`, the skill SHALL start nothing more for that part, keep running the other parts of the wave, and name the refusal and its `instead` to the user in its report. It SHALL NOT run git in a worktree, edit the worktree itself, or set `execution.worktree.enabled`. On `policy/merge-blocked` it SHALL run `part done` again after the next commit of the home checkout.

The main thread SHALL run at most `execution.concurrency` agents at once, SHALL start every agent in the background and SHALL end its turn while they run, to be woken by the host's task notification. After `bdk part done` it SHALL run `bdk next` again.

#### Scenario: flat part

- **WHEN** `wave` lists part 01 with `mode: flat` and two tasks
- **THEN** the main thread opens one `task-redispatch` ticket per task, each task ends as a commit with its trailer, and no `part-lead` ticket exists for part 01

#### Scenario: tree parts

- **WHEN** `wave` lists parts 01 and 02 of a `large` Change, both `mode: tree` and not started
- **THEN** the main thread starts parts 01 and 02, opens one `part-lead` ticket for each, starts two `bdk:lead` agents in the background, and after both return runs `bdk part done` for each part

#### Scenario: worktree and shared part in parallel

- **WHEN** `wave` lists part 01 (`isolation: shared`) and part 02 (`isolation: worktree`), disjoint, each adding a different dependency so both regenerate `pnpm-lock.yaml`
- **THEN** the main thread starts both parts before either is done, the commits of 02 land on the Change branch with their trailers through the merge commit of `part done 02`, the lockfile conflict is settled by one merge ticket whose package carries the merge instruction, the merged `pnpm-lock.yaml` holds both dependencies, the ledger of the home checkout holds the entries of both parts, and `git worktree list` holds no worktree of the Change afterwards

#### Scenario: merge conflict resolved in a merge ticket

- **WHEN** `part done 02` answers `policy/merge-conflict` naming `pnpm-lock.yaml`
- **THEN** the skill opens `verify-fix 02`, the implementer regenerates the lockfile in the worktree, the runner records the steps, the ticket closes `ok`, and the next `part done 02` exits 0 and leaves no worktree

#### Scenario: unresolved conflict goes to the user

- **WHEN** the merge tickets of part 02 use up the `verify-fix` budget and the ladder answers `parked`
- **THEN** the skill starts nothing more for part 02 and its final report names the park question, the worktree and the unmerged paths
