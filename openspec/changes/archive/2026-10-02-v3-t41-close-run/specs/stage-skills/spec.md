## ADDED Requirements

### Requirement: close closes a reviewed Change

`/bdk:close` SHALL close the active Change through the kernel and never by hand:

- it runs `bdk change close --dry-run`; on a refusal it follows `instead` (Requirement: Kernel refusals in a stage skill) and closes nothing;
- it runs `bdk rules export --claude --check`, and on `policy/generated-drift` runs `bdk rules export --claude` and names the regenerated files, which the close commit does not stage, for the user to commit with the PR;
- it runs `bdk change close`; a `policy/git-hook-failed` leaves the archive in the work tree, which the skill reports with the hook's output.

It SHALL ask no question: the typed command, or a run that passed `gate:review`, is the consent. It SHALL propose no rule and route no `learning` entry: lessons stay in the archived ledger for the audit skill (T31). It SHALL never edit a project file (`disallowed-tools: Edit Write NotebookEdit`).

#### Scenario: reviewed Change closed

- **WHEN** the user types `/bdk:close` on a Change whose `gate:review` is done and no ticket is open
- **THEN** `.bdk/changes/archive/<id>/` exists, the latest commit has the subject `chore(bdk): close <id>`, and the branch has no active Change

#### Scenario: open ticket

- **WHEN** a ticket of the Change is open and the user types `/bdk:close`
- **THEN** `bdk change close --dry-run` refuses with `policy/ticket-open`, the Change is not archived, and the final reply names the open ticket and the commands of `instead`

### Requirement: close reports the PR summary

`/bdk:close` SHALL end with the `summary` of `bdk change close` verbatim, the gates passed by policy (`gatesByPolicy`), the archive path and the commit, the regenerated rule projection files when there are any, and the next step: open the PR with that summary. It SHALL NOT open the PR itself.

#### Scenario: summary shown

- **WHEN** `/bdk:close` closes a Change with one live `assumption` entry
- **THEN** the final reply holds the PR summary with that assumption and names the archive path

### Requirement: run drives a Change through the stages

`/bdk:run [--auto] [<intent>]` SHALL loop on `bdk next` and start, through the host's `Skill` tool, the stage skill `next` names in `command` (`kernel-cli/graph`, bdk next): `/bdk:change` with the intent when no Change is active, then `/bdk:design`, `/bdk:plan`, `/bdk:execute` and `/bdk:close`. At the review stage it SHALL stop and name `/bdk:cr` for the user to type, without starting it: `disallowed-tools` of `execute` still refuses `Write` to a skill started later in the same turn (HOST-FACTS `skill-tool-disallowed`), and `cr` writes its report (user decision 2026-10-02; T42 makes `run` start `cr`). Each stage skill runs with its own frontmatter and body; `run` holds no copy of a stage procedure. After each stage skill it SHALL run `bdk next` again. It SHALL write no state of its own: every gate a run passes is written by the kernel's hooks (`kernel-cli/hooks`, Pre-tool guards, Stage skill), never by a command `run` calls. `run` SHALL set `disable-model-invocation: true`.

#### Scenario: run from an intent to the review stage

- **WHEN** the user types `/bdk:run --auto "<intent>"` on the fixture with no active Change, `/bdk:cr` does not yet record the `review` node, and every stage succeeds
- **THEN** a Change exists, `gate:design` is done with `passedBy: policy` where the profile has it, every `execute-part` instance is done, `bdk next --json` returns the `review` node, and the final reply names `/bdk:cr`

#### Scenario: run closes a reviewed Change

- **WHEN** the user types `/bdk:run --auto` on a Change whose `review` node is done and `gate:review` is ready
- **THEN** the Change is archived and the `transition` of `gate:review` has `source: policy`

### Requirement: run stops only where the user is needed

A run SHALL stop and end with its closing render when `next` waits on a gate the kernel refused to pass by policy (`guard/gate-manual`), when the Change is parked, when a stage skill reports a refusal it could not resolve, when `next` returns the `review` node, or when the Change is closed. It SHALL NOT stop for a pending `review: true` entry. While it runs it SHALL print one line per stage it enters or leaves, and the full closing render only when it stops (T41 "To resolve in the spec").

#### Scenario: manual design gate

- **WHEN** the user types `/bdk:run "<intent>"` without `--auto` and `policy.gates.design` is `manual`
- **THEN** the run ends after the design stage, `gate:design` is ready and not done, no plan part exists, and the final reply names `/bdk:plan` as the command the user types

### Requirement: run decides instead of asking

While a run lasts, wherever a stage skill would ask the user (Requirement: Asking the user in two tiers), the run SHALL take the recommended option and record it with `bdk log add decision <summary> --review` naming the question and the options it did not take, so the decision appears at the next gate and in the PR summary (R-9). A park question of the attempt ladder is not a stage skill's question: it parks the Change and stops the run.

#### Scenario: branch question inside a run

- **WHEN** `/bdk:change`, started by a run, reaches its branch question
- **THEN** no `AskUserQuestion` call is made and the ledger holds a `decision` entry with `review: true` naming the branch it chose

## MODIFIED Requirements

### Requirement: Stage skill shape

Every stage skill SHALL live at `skills/stages/<name>/SKILL.md`, a directory the `skills` array of `.claude-plugin/plugin.json` lists, and SHALL:

- start its body with the two context lines of `kernel-cli`, Output modes, naming its own skill (`ctx skill <name>`) or `next`, and list the `allowed-tools` pair of `kernel-cli`, Invocation;
- set `disable-model-invocation: true` when it is `setup` or `run`, so only the user starts it. `change`, `plan`, `execute` and `close` stay model-invocable so that `/bdk:run` can start them through the host's `Skill` tool, and `hooks pre-tool` denies a model's call to them outside a run (`kernel-cli/hooks`, Pre-tool guards, Stage skill; user decision 2026-10-02); `design`, `verify-design` and `verify-plan` stay model-invocable, because another skill starts them (T02 section 13.1);
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
- **THEN** `setup` and `run` set `disable-model-invocation: true`, and `change`, `design`, `verify-design`, `plan`, `verify-plan`, `execute` and `close` do not

### Requirement: Asking the user in two tiers

A stage skill SHALL ask the user through the `Asking the user` section of its context, which states two tiers:

- **Simple decision**: every option is described by a label and one sentence, as in "new branch or the current one", "keep these commands". It SHALL go to `AskUserQuestion` in the terminal, also when `features.lavish` is on.
- **Rich decision**: an option needs a diagram, a side-by-side comparison, a schema delta or an annotated draft to be judged, as the approaches of a design or the review of a draft design. When the section is the Lavish one (`features.lavish` on and `lavish-axi` on `PATH`), it SHALL go to a Lavish review page; otherwise the skill SHALL print the comparison in the terminal and then ask with `AskUserQuestion`.

Inside a run (Requirement: run decides instead of asking) the stage skill asks nothing: it takes the recommended option and records the choice as the run's decision. Either way the recommended option comes first with the tradeoff of each option, and a decision the user did not answer stays open. When the Lavish page fails (non-zero exit, a reply that does not parse, a session the user ended), the skill SHALL ask the same decision with `AskUserQuestion` and SHALL NOT reopen a session the user ended.

#### Scenario: branch question with Lavish on

- **WHEN** `features.lavish` is on, `lavish-axi` is on `PATH` and `/bdk:change "<intent>"` asks for the branch
- **THEN** the question goes through `AskUserQuestion` and no `lavish-axi` command runs

#### Scenario: approaches with Lavish off

- **WHEN** `features.lavish` is off and `/bdk:design` reaches a choice between two approaches
- **THEN** both approaches with their diagrams are printed before one `AskUserQuestion` call whose first option is the recommended approach

### Requirement: Closing render

A stage skill SHALL end its turn, or, when `/bdk:run` started it, its part of the run, with a short report that names the command the user types next, taken from the kernel's output (`next` of the command it ran, or the gate status of `bdk change status`), and the pending `review: true` entries the kernel lists, so the user sees them before typing the next stage command (design, "UX Touchpoints").

#### Scenario: after a new Change

- **WHEN** `/bdk:change "Add passwordless login"` opens a `feature` Change
- **THEN** the skill's last message names `/bdk:design`, the `next` value of `bdk change new`
