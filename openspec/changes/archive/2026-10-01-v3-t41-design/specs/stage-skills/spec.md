## MODIFIED Requirements

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

## ADDED Requirements

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
