## ADDED Requirements

### Requirement: plan writes the plan the kernel asks for

`/bdk:plan` SHALL read `bdk next --json` and write the plan parts its instruction names, at `plan/parts/<nn>-<slug>.md` with exactly the frontmatter fields the instruction lists, then mark them with `bdk done plan`. Before it writes, it SHALL read the design files of the Change (when the Change has a design stage), the accepted decisions and live questions of the ledger, and the code the tasks will touch; a `bug` or `tiny` Change, which has no design stage, is planned from its intent and the code.

The intent and the design SHALL set the size of the plan: a task states only the behaviour the Change alters, and anything else the skill notices (a guard in a caller, an input nobody reported, a cleanup) is recorded as a `finding`, not planned. Scope SHALL grow only to keep correct what the Change itself breaks (a direct caller whose output the fix changes), and only by tasks in the existing parts; growth that would add a part, change a shared data model or reach modules beyond those direct callers SHALL be recorded as a `finding` for a follow-up Change, and a question about growing the scope SHALL name the tasks and files it adds and offer the option that keeps the plan to the intent. Each part SHALL hold at most 8 tasks and stay within 8 KB, and SHALL group tasks so that parts without a dependency between them can run in the same wave; `depends-on` names every part whose output a part consumes. For each capability a part names in `spec-impact`, the skill SHALL write `spec-delta/<capability>.md` and check it with `bdk spec delta check` before `bdk done plan`. Before `bdk done plan` it SHALL go through the `BDK-PL` rules of the instruction by id and correct the parts until each holds.

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

#### Scenario: no active Change

- **WHEN** `/bdk:plan` runs on a branch without an active Change
- **THEN** no file under `.bdk/changes/` is written and the final reply names `/bdk:change`

#### Scenario: not started by the model

- **WHEN** a model calls the `Skill` tool with `bdk:plan`
- **THEN** the host refuses the call, because `plan` sets `disable-model-invocation: true`

### Requirement: plan tasks are contracts with concrete test cases

A task SHALL state what the code must do and SHALL NOT carry implementation code: its goal in a few sentences, the exact signatures, types, file formats and messages that another task or part consumes, `Files:` naming every file it creates, modifies or tests, `Depends on:` for tasks of the same part it builds on, and `Stop rule:` where a worker could widen it beyond its files. A fenced code block appears only to fix an exact external format (a wire format, a file format, a command line), never a function body.

Every task with executable code SHALL carry `Test cases:`, and each test case SHALL name an input or situation and the observable result expected from it, written so a test can assert it. Every behaviour the task text states SHALL have at least one test case, including the boundaries and error paths the task or the design names. A task whose files are all non-executable content carries `Verification: none` instead (`.claude/rules/verification-scoping.md`).

#### Scenario: concrete test case

- **WHEN** a task adds `formatDate(value, fallback)` with a fallback for a missing value
- **THEN** its test cases include one naming a missing value and the fallback it returns, not only "test the fallback"

#### Scenario: no implementation code

- **WHEN** `/bdk:plan` finishes on a `small` feature Change
- **THEN** no task of any part holds a fenced code block with a function body

### Requirement: plan verifies and corrects itself

After `bdk done plan`, for a Change whose graph holds `plan-verify`, `/bdk:plan` SHALL run `/bdk:verify-plan` and act on the verdict without asking the user what the plan, the design or the code settle:

- every blocker whose fix changes no decision recorded in the ledger or the design (a `false-code-claim`, a behaviour without a test case, an undeclared dependency between parts, a design requirement no task covers when the design states it) SHALL be corrected, its blocker resolved with `bdk log resolve` and a reason;
- every blocker whose fix needs a decision the design does not hold SHALL go to the user in one question listing each such blocker with a proposed fix; the answer is recorded as a `decision`;
- every finding of a `done-with-concerns` verdict SHALL be judged "fixed" or "goes to execution" with a reason, and the first kind fixed.

After any correction it SHALL run `bdk done plan` again and `/bdk:verify-plan` again, so the verdict is never older than the plan, and repeat until the verdict passes or the kernel's next action is `parked`; the kernel's verifier budget is the only limit on rounds, so no fix judged necessary is skipped to save a round; on `escalate` the next round opens escalated. On `parked` it SHALL stop and name the resume command the kernel printed, with the blockers that remain.

#### Scenario: blocker corrected without a question

- **WHEN** the verdict holds one `false-code-claim` blocker: task `01-2` calls `formatTimestamp(value)` with a second argument `locale` that the function does not take
- **THEN** the skill corrects the task to the real signature, resolves the blocker, runs `bdk done plan` and `/bdk:verify-plan` again, and asks the user nothing

#### Scenario: decision asked once

- **WHEN** the verdict holds two blockers that need a product decision the design does not record
- **THEN** the skill asks the user one question covering both, records the answers as `decision` entries, corrects the plan and verifies again

### Requirement: plan ends with a report

Once the verdict passes, or for a Change whose graph holds no `plan-verify`, `/bdk:plan` SHALL end with a report taken from the kernel's output: the parts with their waves and task counts (`bdk part list`), the corrections it made, each finding with its decision and reason, the pending `review: true` entries, and the command that starts execution, `/bdk:execute`, which the user types.

When its arguments hold `--review`, the skill SHALL first show the verified plan in one review (a rich decision of Asking the user in two tiers), with the same content, where the user accepts the plan or requests changes; a requested change is written, marked with `bdk done plan`, verified again and shown in a new review before the report.

#### Scenario: report by default

- **WHEN** `/bdk:plan` runs without arguments and the verdict passes
- **THEN** the skill asks no review question and its last message lists the parts with their waves and names `/bdk:execute`

#### Scenario: review on request

- **WHEN** `/bdk:plan --review` runs and the verdict passes
- **THEN** the skill shows the plan for acceptance before the report, and a change requested there is verified again before the report

### Requirement: verify-plan verifies on a fresh context

`/bdk:verify-plan` SHALL verify the whole current plan without relying on the conversation that wrote it: it SHALL open a `verifier` ticket on `plan-verify` with `bdk attempt open`, build the `verifier` package with `bdk dispatch build`, start one role agent through the `bdk:reader` adapter with the package path as the whole prompt and, on an escalation ticket, the `model` that `dispatch build` returned, wait for it, close the ticket with `bdk attempt close` and the role's report as envelope, and on a passing report with no live blocker run `bdk done plan-verify`. An agent that returns without a stored and recorded report is resumed once with the cause named; a second failure closes the ticket `fail`. It SHALL be startable by `/bdk:plan` and by the user.

On a refusal of `attempt open` (for example `policy/not-ready` while a plan part is not done) it SHALL open no ticket and name the refusal's `instead`. On blockers it SHALL list each with its category and the next action the kernel returned (`retry`, `narrow`, `escalate` or `parked`), and SHALL NOT mark `plan-verify` done.

#### Scenario: clean plan

- **WHEN** `/bdk:verify-plan` runs on a Change whose one plan part is done and agrees with the code
- **THEN** the ledger holds a `report` naming `plan-verify` with status `done` or `done-with-concerns`, the ticket is closed `ok`, and `plan-verify` is done

#### Scenario: false code claim

- **WHEN** a task states that it modifies `formatRelative` in `src/ui/format.ts` and the file exports no such function
- **THEN** the ledger holds a live `blocker` with category `false-code-claim` naming `plan-verify`, and `plan-verify` is not done

#### Scenario: plan not done

- **WHEN** `/bdk:verify-plan` runs while a plan part is written and not done
- **THEN** no ticket is opened and the final reply names the refusal's `instead`
