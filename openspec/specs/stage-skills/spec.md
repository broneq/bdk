# stage-skills Specification

## Purpose

The stage skills of the `bdk` plugin (`setup`, `change`, `design`, `verify-design`, `plan`, `verify-plan`, `execute`, `close`, `run`): the contract every one of them keeps, and what each one does for the user. The kernel holds the order of the work and every write of state; a stage skill asks the kernel, does the part only a model can do, and reports what the kernel answered.

## Requirements

### Requirement: Stage skill shape

Every stage skill SHALL live at `skills/stages/<name>/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists, and SHALL:

- start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill (`ctx skill <name>`) or `next`, and list the `allowed-tools` pair of `kernel-cli`, Invocation;
- set `disable-model-invocation: true` when it is `setup`, `change`, `plan`, `execute`, `close` or `run`, so only the user starts it; `design`, `verify-design` and `verify-plan` stay model-invocable, because another skill starts them (T02 section 13.1);
- stay at or below 200 lines in `SKILL.md`, with longer reference material in `references/` beside it;
- name BDK skills and agents with the `/bdk:` and `bdk:` namespace and name no model;
- write state only through kernel commands, never by editing a file under `.bdk/` by hand. Writing the content of an artifact file at the path the kernel's instruction names (`design.md`, `architecture.md`, a design or plan part) is the artifact's work, not a state write; its frontmatter carries only the fields that instruction names.

No two skills of the plugin SHALL share a name, so `/bdk:<name>` resolves to exactly one skill.

#### Scenario: a stage skill over the limit

- **WHEN** a `SKILL.md` under `skills/stages/` has 201 lines
- **THEN** `pnpm skill-check` reports an error for that file

#### Scenario: one skill per name

- **WHEN** the plugin is loaded with `skills/stages/setup/` and `skills/stages/design/` present
- **THEN** no other directory of the plugin holds a skill named `setup` or `design`, and `claude plugin validate` passes

#### Scenario: design starts verify-design

- **WHEN** the plugin is loaded
- **THEN** neither `design` nor `verify-design` sets `disable-model-invocation: true`, and `setup`, `change`, `plan`, `execute`, `close` and `run`, where present, set it

### Requirement: Kernel refusals in a stage skill

A stage skill SHALL act on the kernel's exit code as `kernel-cli`, Exit codes and the error object, defines it: on exit 2 it follows the refusal's `instead` and never repeats the refused command unchanged; on exit 3 it corrects the argument the error names, using `<command> --help`; on a `BDK STOP` line or exit 4 or 5 it stops and reports the kernel's output to the user.

#### Scenario: refusal followed

- **WHEN** `bdk change new` answers exit 2 with `rule: policy/change-exists` during `/bdk:change <intent>`
- **THEN** the skill does not run `bdk change new` again unchanged and tells the user the active Change and the commands of `instead`

### Requirement: Closing render

A stage skill SHALL end its turn with a short report that names the command the user types next, taken from the kernel's output (`next` of the command it ran, or the gate status of `bdk change status`), and the pending `review: true` entries the kernel lists, so the user sees them before typing the next stage command (design, "UX Touchpoints").

#### Scenario: after a new Change

- **WHEN** `/bdk:change "Add passwordless login"` opens a `feature` Change
- **THEN** the skill's last message names `/bdk:design`, the `next` value of `bdk change new`

### Requirement: setup brings a project to a working layout

`/bdk:setup` SHALL leave the project with a `.bdk/settings.yaml` that `bdk config check` accepts and a `bdk doctor` run with `ok: true`, or report each remaining `doctor` finding with its repair action. It SHALL write every settings key through `bdk config set`, so the kernel validates the value, keeps the schema modeline as the first line and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`.

The skill SHALL detect the project's languages and the `test`, `lint` and `build` commands from the project files, ask the user to confirm only the full commands, and derive every entry's `tier` and scoped forms from the runner without a question. It SHALL ask nothing the kernel measures or derives.

#### Scenario: fresh TypeScript project

- **WHEN** `/bdk:setup` runs in a git repository with a `package.json` whose scripts are `test` (vitest) and `lint` (eslint), no `.bdk/` and a `pnpm-lock.yaml`, and the user confirms the detected commands
- **THEN** `.bdk/settings.yaml` starts with the modeline, holds a `tools.test` entry with id `vitest`, tier `fast` and a `scoped` form containing `{files}`, and a `tools.lint` entry with id `eslint` and tier `lint`; `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true`

#### Scenario: settings already present

- **WHEN** `/bdk:setup` runs where `.bdk/settings.yaml` exists
- **THEN** the skill shows the current values and changes a key only after the user asks for it

### Requirement: setup migrates a v2 project

When `bdk doctor` reports the v2 layout, `/bdk:setup` SHALL migrate the project itself; no kernel command converts v2 state. It SHALL read `.bdk/settings.json` as detection hints, so the v2 commands are offered as the detected ones, write the confirmed settings through `bdk config set` like any other project, and import hand-written rules as for any other project. It SHALL then list the v2 files it found (`.bdk/settings.json`, `.bdk/plans/`, `.bdk/design/`, `.bdk/runs/`, `.bdk/verify-plan/`) and delete them only after the user confirms; an old design is not converted, and the skill names `/bdk:change` as the way to continue one.

#### Scenario: v2 layout

- **WHEN** `/bdk:setup` runs in a project whose `.bdk/settings.json` names `pytest` as the test command, and the user confirms the commands and the deletion
- **THEN** `.bdk/settings.yaml` holds a `tools.test` entry with the command `pytest`, `bdk config check` exits 0, `.bdk/settings.json` is gone and `bdk doctor --json` reports layout `v3`

#### Scenario: deletion declined

- **WHEN** the user declines the deletion of the v2 files
- **THEN** the v2 files stay, `.bdk/settings.yaml` is written, and the closing render names the `v2-layout` finding that `bdk doctor` still reports

### Requirement: setup checks Lavish

`/bdk:setup` SHALL check whether `npx -y lavish-axi --help` succeeds. When it fails, the skill SHALL offer to install Lavish and, when the user declines, set `features.lavish` to `false` through `bdk config set` (T02 R-11).

#### Scenario: Lavish missing and declined

- **WHEN** `npx -y lavish-axi --help` fails and the user declines the install
- **THEN** `bdk config show features.lavish --json` reports `false` from the project layer

### Requirement: setup imports hand-written rules

When the project has hand-written `.claude/rules/*.md` files (any file other than the generated `bdk-generated*.md`), `/bdk:setup` SHALL show `bdk rules import --dry-run`, run `bdk rules import` only after the user confirms, and then offer to delete the imported source files, since the projection carries their rules. The `BDK-*` pack SHALL never be imported: the kernel reads it from the plugin.

#### Scenario: one rules file

- **WHEN** the project has `.claude/rules/api-style.md` with two top-level bullets and the user confirms the import
- **THEN** `.bdk/rules/` holds `API-STYLE-1` and `API-STYLE-2` with `origin: import`, and `.claude/rules/bdk-generated.md` lists both

### Requirement: setup on Claude Code exports no adapters

On Claude Code `/bdk:setup` SHALL NOT run `bdk export agents`: the adapters ship in the plugin's `agents/`, and a copy in the project would register each adapter twice.

#### Scenario: no project adapters

- **WHEN** `/bdk:setup` finishes on Claude Code
- **THEN** the project has no `.claude/agents/` file written by BDK

### Requirement: change opens a Change

`/bdk:change <intent>` SHALL open a Change with `bdk change new`. Before the call it SHALL ask the user whether to create a new branch (`feat/<slug>`, or `fix/<slug>` for a bug) or to stay on the current branch, on every branch, and SHALL create the chosen branch with git before the call.

The skill SHALL pass `--kind bug` when the intent reports a defect, and SHALL pass `--profile tiny --reason <why>` only when every item of the `tiny` checklist holds after it has read the code the intent touches (T20 design D-11): no new or changed behaviour visible to a user or an API, no change to a data model, schema or configuration, no spec impact, and at most 2 files in 1 module. Any doubt SHALL leave the profile to the kernel's `small` default. The skill SHALL NOT pass `--inferred`; that flag belongs to the skills that open a Change on the user's behalf.

#### Scenario: new branch chosen

- **WHEN** `/bdk:change "Add a --verbose flag to the CLI"` runs on `main` and the user chooses a new branch
- **THEN** the Change is bound to the branch `feat/<slug>`, and `main` has no active Change

#### Scenario: current branch kept

- **WHEN** the user chooses to stay on the current branch `work`
- **THEN** the Change is bound to `work` and no branch is created

#### Scenario: tiny Change

- **WHEN** the intent is "Fix the typo 'recieve' in README.md" and the typo occurs in that one file
- **THEN** `change.md` carries `profile: tiny` and the profile assumption entry's body states why each checklist item holds

#### Scenario: doubt stays small

- **WHEN** the intent adds an option to a command that users run
- **THEN** `bdk change new` runs without `--profile`, and `change.md` carries `profile: small`

#### Scenario: bug intent

- **WHEN** the intent is "Login fails after a password reset"
- **THEN** `change.md` carries `kind: bug` and the closing render names `/bdk:plan`

### Requirement: change shows and moves a Change

`/bdk:change` SHALL map its arguments to kernel commands: no argument renders `bdk change status`; `list` runs `bdk change list`; `resume <id> [--option <n>]`, `park [--reason <text>]` and `takeover` run the kernel command of the same name. An argument that is none of these is an intent and opens a Change. When a parked Change has options, the skill SHALL show them with the single resume command the kernel prints.

#### Scenario: status

- **WHEN** `/bdk:change` runs without arguments on a branch with an active Change at stage `design`
- **THEN** the skill reports the stage, the gate status and the command to type next as `bdk change status` gives them, and writes nothing

#### Scenario: parked Change

- **WHEN** `/bdk:change` runs on a branch whose Change is parked with two options
- **THEN** the skill lists both options and the `bdk change resume <id> --option <n>` command the kernel names

### Requirement: Asking the user in two tiers

A stage skill SHALL ask the user through the `Asking the user` section of its context, which states two tiers:

- **Simple decision**: every option is described by a label and one sentence, as in "new branch or the current one", "keep these commands". It SHALL go to `AskUserQuestion` in the terminal, also when `features.lavish` is on.
- **Rich decision**: an option needs a diagram, a side-by-side comparison, a schema delta or an annotated draft to be judged, as the approaches of a design or the review of a draft design. When the section is the Lavish one (`features.lavish` on and `lavish-axi` on `PATH`), it SHALL go to a Lavish review page; otherwise the skill SHALL print the comparison in the terminal and then ask with `AskUserQuestion`.

Either way the recommended option comes first with the tradeoff of each option, and a decision the user did not answer stays open. When the Lavish page fails (non-zero exit, a reply that does not parse, a session the user ended), the skill SHALL ask the same decision with `AskUserQuestion` and SHALL NOT reopen a session the user ended.

#### Scenario: branch question with Lavish on

- **WHEN** `features.lavish` is on, `lavish-axi` is on `PATH` and `/bdk:change "<intent>"` asks for the branch
- **THEN** the question goes through `AskUserQuestion` and no `lavish-axi` command runs

#### Scenario: approaches with Lavish off

- **WHEN** `features.lavish` is off and `/bdk:design` reaches a choice between two approaches
- **THEN** both approaches with their diagrams are printed before one `AskUserQuestion` call whose first option is the recommended approach

### Requirement: design writes the design the kernel asks for

`/bdk:design` SHALL read `bdk next --json` and write the artifact it names, at the path and with the frontmatter its instruction names, then mark it with `bdk done <id>`; it SHALL repeat this until `next` names a node outside the `design` stage or the gate. Before it asks the user anything, it SHALL read the code the Change's intent touches and report what exists, what the project already does and what it is unsure of.

For each branching decision the skill SHALL offer at least two approaches, each with a Mermaid diagram and a self-critique naming at least one bottleneck, one single point of failure, one hidden cost and one assumption the user did not confirm; when only one approach is viable it SHALL say why the others fail. The user chooses each approach before the skill writes it.

The skill SHALL write a split design (three or more subsystems, or a `design.md` over 12 KB) as `design/parts/<nn>-<slug>.md` without `design.md`, so `bdk done design` raises the profile to `large` itself, and then follow `next` through the parts and `design-index`. It SHALL write `architecture.md` unless the design declares `architecture: false`, which it SHALL set only for a Change without any structural change (product-only).

When `bdk next` refuses because no Change is active, the skill SHALL write nothing and name the command of the refusal's `instead`.

#### Scenario: small design

- **WHEN** `/bdk:design` runs on a `small` feature Change opened for "Add a --verbose flag to the CLI" and the user takes the first option of every question
- **THEN** `design` and `architecture` are done, `design.md` has `schema: 1` and a `title`, and `bdk change status --json` reports `gate:design` ready

#### Scenario: product-only design

- **WHEN** the Change's intent changes only wording visible to users and no module boundary
- **THEN** `design.md` declares `architecture: false` and the `architecture` node is `skipped`

#### Scenario: no active Change

- **WHEN** `/bdk:design` runs on a branch without an active Change
- **THEN** no file under `.bdk/changes/` is written and the final reply names `/bdk:change`

### Requirement: design records decisions in the ledger

`/bdk:design` SHALL record every decision taken with the user as a `decision` entry and every point left open as a `question` entry, through `bdk log add`, each with at least one ref to the artifact or node it concerns, and SHALL NOT restate them as a list in `design.md`. A decision the user did not answer stays a `question`. This replaces the decision capture of the v2 `create-adr` (T02 OD-1).

When the chosen approach changes a data model (a table, column, type, constraint, index or migration), the skill SHALL show the current shape it read from the code, offer the proposals with their migration impact (additive or breaking, backfill, rollback), and record the approved proposal as a `decision` before it runs verification; approval of the broader design does not count as approval of the schema.

#### Scenario: decision entry

- **WHEN** the user picks approach B for the token store during `/bdk:design`
- **THEN** `bdk log list --type decision --json` holds an entry whose summary names approach B and whose refs include `design`

#### Scenario: schema approval

- **WHEN** the chosen approach adds a column and the user has approved only the overall design
- **THEN** the skill asks for the schema proposal before `/bdk:verify-design` runs, and the ledger holds a `decision` naming the approved proposal

### Requirement: design ends with verification and the gate

After the last design-stage artifact is done, `/bdk:design` SHALL run `/bdk:verify-design` and then show the user the written design together with the verdict in one review (a rich decision of Asking the user in two tiers), so the verifier's findings and blockers are judged next to the text they concern. A change the user asks for in that review is written, marked with `bdk done`, and verified again before the next review. Once the user accepts the reviewed design with a passing verdict, it SHALL end with the gate status of `bdk change status`: the gate, the pending `review: true` entries and the command that passes it (`/bdk:plan`). On blockers it SHALL correct a `false-code-claim` blocker itself, by changing the claim to what the code holds, and ask the user about every blocker of another category in one question, each with a proposed fix; a correction that changes a recorded decision is not a fact fix and goes to the user too. It then writes the fixes, marks them done and verifies again, or stops when the kernel's next action is `parked`, naming the resume command.

On a `done-with-concerns` verdict the skill SHALL decide for each finding whether it must be fixed before planning or can go on to the plan, fix the first kind and verify again, and show every finding with its decision and reason in the review, where the user can overrule it.

#### Scenario: design passes

- **WHEN** `/bdk:verify-design` returns a passing verdict and the user accepts the design in the review
- **THEN** the last message of `/bdk:design` names `/bdk:plan` and lists the pending review entries

#### Scenario: false claim corrected without a question

- **WHEN** the verdict holds one `false-code-claim` blocker naming a function under a wrong path, and the function exists elsewhere
- **THEN** the skill corrects the path in the design without asking the user, runs `bdk done` and `/bdk:verify-design` again, and the review lists the correction

#### Scenario: findings judged by the coordinator

- **WHEN** the verdict is `done-with-concerns` with two findings
- **THEN** the review shows both findings, each marked "fixed" or "goes to planning" with a reason, before the user accepts the design

#### Scenario: change requested in the review

- **WHEN** the user asks for a change to `design.md` in the review after a passing verdict
- **THEN** the skill writes the change, runs `bdk done design`, and runs `/bdk:verify-design` again before it shows the next review, so the gate is never rendered on a verdict older than the design

### Requirement: verify-design verifies on a fresh context

`/bdk:verify-design` SHALL verify the current design without relying on the conversation that wrote it: it SHALL open a `verifier` ticket on `design-verify` with `bdk attempt open`, build the `design-verifier` package with `bdk dispatch build`, start the role through the `bdk:reader` adapter with the package path as the whole prompt and, on an escalation ticket, the `model` that `dispatch build` returned (`role-contracts`, Dispatch prompt; `guard/escalation-model`), wait for it, close the ticket with `bdk attempt close` and the role's report as envelope, and on a passing report with no live blocker run `bdk done design-verify`. An agent that returns without a stored report is resumed once with the cause named; a second failure closes the ticket `fail`. It SHALL be startable by `/bdk:design` and by the user.

On a refusal of `attempt open` (for example `policy/not-ready` while a design artifact is not done) it SHALL open no ticket and name the refusal's `instead`. On blockers it SHALL list each with its category and the next action the kernel returned (retry, escalate or parked), and SHALL NOT mark `design-verify` done.

#### Scenario: clean design

- **WHEN** `/bdk:verify-design` runs on a Change whose `design.md` and `architecture.md` are done and agree with the code
- **THEN** the ledger holds a `report` naming `design-verify` with status `done` or `done-with-concerns`, the ticket is closed `ok`, and `design-verify` is done

#### Scenario: false code claim

- **WHEN** `design.md` states that a module `src/auth/tokens.ts` exists and the repository has no such file
- **THEN** the ledger holds a live `blocker` with category `false-code-claim` naming `design-verify`, and `design-verify` is not done

#### Scenario: design not done

- **WHEN** `/bdk:verify-design` runs while `design` is ready and not done
- **THEN** no ticket is opened and the final reply names the refusal's `instead`

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
- every blocker whose fix needs a decision the design does not hold, or grows the scope beyond the intent (a caller whose user-visible behaviour the Change alters), SHALL go to the user in one question listing each such blocker with a proposed fix and, for scope, the intent-only option; the answer is recorded as a `decision`;
- findings that come with a failing verdict MAY be fixed together with its blockers; a passing verdict, `done-with-concerns` included, SHALL close the plan: no part is edited after it except for a change the user requests in `--review`, and every finding goes to execution with its reason in the report.

After any correction it SHALL run `bdk done plan` again and `/bdk:verify-plan` again, so the verdict is never older than the plan, and repeat until the verdict passes or the kernel's next action is `parked`; the kernel's verifier budget is the only limit on rounds, so no blocker fix is skipped to save a round; on `escalate` the next round opens escalated. On `parked` it SHALL stop and name the resume command the kernel printed, with the blockers that remain.

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
