## ADDED Requirements

### Requirement: Scope changes and deviations in the design

When a user's answer adds, drops or narrows a capability or a "What Changes" item of the proposal, `design-draft` SHALL change `proposal.md` (What Changes, Capabilities, Out of scope) to match before it writes the spec deltas, and SHALL record the change under the decision in `design.md` with a line `Scope changed by the user:` followed by what changed. In a revision, it SHALL delete the spec delta of a capability the answer dropped. When an answer contradicts the acceptance signal the proposal carries or a rule of the project (`CLAUDE.md`, `.claude/rules/`, the rules of `openspec/config.yaml`, a rule `bdk rules for --stage design` selects), the designer SHALL ask it again in the next round, naming and quoting that rule, with following the rule as the recommended answer; when the user keeps the answer, `design.md` SHALL record it under the decision with a line `Deviation:` naming the rule or acceptance signal, its source or rule id, and what the user chose. The designer SHALL NOT write to the GitHub issue.

#### Scenario: Capability dropped by an answer

- **WHEN** the proposal names the capabilities `ledger-export` and `ledger-import`, and the user's answer says to leave the import for later
- **THEN** `proposal.md` no longer lists `ledger-import` under its capabilities and names it under Out of scope, no spec delta for `ledger-import` is written, and `design.md` holds a `Scope changed by the user:` line naming it

#### Scenario: Answer against a project rule

- **WHEN** the project's `CLAUDE.md` says every amount is stored in integer cents and the user's note on the page asks for decimal amounts
- **THEN** the next round asks whether to keep decimal amounts, quoting the rule, with integer cents recommended, and when the user keeps decimal amounts `design.md` holds a `Deviation:` line naming `CLAUDE.md`

## MODIFIED Requirements

### Requirement: Blocks of the design stage

The `bdk` plugin SHALL ship three skills, each runnable alone by its own command: `explore` (`/bdk:explore`), `design-draft` (`/bdk:design-draft`) and `verify-design` (`/bdk:verify-design`). Each SHALL take the name of an OpenSpec Change as its argument; without one it SHALL use the only active Change under `openspec/changes/`, and when there are several or none it SHALL name them and stop without writing a file. Each SHALL keep its run files in `.bdk/runs/<change>/`. Each SHALL do one job: `explore` and `verify-design` change no file but their own run file, and `design-draft` writes only the Change's spec deltas, `design.md`, the `proposal.md` edits a user's scope answer needs ("Scope changes and deviations in the design") and its Lavish pages under `.lavish/`.

#### Scenario: Change from the argument

- **WHEN** `/bdk:explore add-csv-export` runs in a project whose `openspec/changes/` holds `add-csv-export` and another active Change
- **THEN** the block works on `add-csv-export` and writes under `.bdk/runs/add-csv-export/`

#### Scenario: Ambiguous Change

- **WHEN** a block runs without an argument and `openspec/changes/` holds two active Changes
- **THEN** it names both Changes, asks which one to use, and writes no file

### Requirement: Explore writes a code map

`explore` SHALL read the Change's `proposal.md` and the code it touches, and SHALL write `.bdk/runs/<change>/design/explore.md` with these sections: `## Touches` (the modules, entry points, data types and boundaries the proposal touches), `## Patterns` (conventions the change must follow), `## Tests` (where and how the touched code is tested), `## Gaps` (what the proposal needs that the code lacks) and `## Unsure` (what it could not settle). Every claim about the code SHALL name a file and line. A question about the options or output of a command-line tool the proposal relies on SHALL be settled by running the tool's read-only help or version command (`<tool> --help`, `<tool> <subcommand> --help`, `<tool> --version`) and naming that command as the evidence; only when that command cannot run SHALL the point go to `## Unsure`, naming the command that would settle it. The reply to the caller SHALL be the path of the file and at most three lines. Continued with a question, the agent SHALL answer it from the code and append the answer to `explore.md` as a `## Follow-up <n>` section.

#### Scenario: Map of a Change

- **WHEN** `explore` runs for a Change whose proposal adds a CSV export of ledger entries
- **THEN** `.bdk/runs/<change>/design/explore.md` exists, holds the five sections, and names the ledger module with a `file:line` reference

#### Scenario: Options of a CLI settled

- **WHEN** the proposal uploads the export with the project's `bin/upload` CLI and does not say which flag names the target folder, and `bin/upload --help` lists `--folder <name>`
- **THEN** a command running `bin/upload --help` ran, `explore.md` names `--folder`, and its `## Unsure` does not hold the upload flag

#### Scenario: Follow-up question

- **WHEN** the caller continues the explorer with a question about where amounts are formatted
- **THEN** `explore.md` gains a `## Follow-up 1` section answering it with `file:line` references, and the earlier sections are unchanged

### Requirement: Questions follow the policy and the session

`design-draft` SHALL ask the user only what the proposal, the code and the project configuration leave open, each question with the recommended answer first, in rounds: the first round asks every open decision; a later round asks only the decisions the previous answers opened (a free note that asks for something new, changes the scope, or contradicts a rule as "Scope changes and deviations in the design" says), and SHALL NOT ask an answered decision again. There SHALL be at most three rounds; a decision still open after the third SHALL take the recommended answer and be marked `Decided without the user:`. With `policy.questions: decide-and-record` it SHALL ask nothing, take the recommended answers, and mark each such decision in `design.md` with the line `Decided without the user:` followed by the reason.

Otherwise the designer SHALL write a Lavish page for the round (`.lavish/design-<change>.html` for the first, `.lavish/design-<change>-<round>.html` for a later one) and open it with `npx -y lavish-axi <page>`. When the page opens, the designer SHALL end its turn with the page path and the open decisions, and the thread that started it SHALL wait for the feedback with `npx -y lavish-axi poll <page>` in the foreground and continue the same designer with it (`SendMessage`). When the poll is interrupted or the user asks to stop waiting, that thread SHALL NOT poll again in that turn: it SHALL answer the user, name the page and the open decisions, and end its turn; a later run of the design stage for the Change SHALL poll the same page, whose queued feedback then arrives. When the open command fails, the designer SHALL end its turn with the open questions listed, the recommended answer first, and write nothing; the thread that started it SHALL ask them through `AskUserQuestion` and continue the same designer with the answers (`SendMessage`), or start a new designer whose arguments carry the answers. When `AskUserQuestion` is not available either, that thread SHALL list the questions in its reply and end it with one line saying how to answer. No spec delta and no `design.md` SHALL be written before the open questions are answered.

#### Scenario: Lavish opens

- **WHEN** `policy.questions` is `stop`, a decision is open, and `npx -y lavish-axi <page>` opens the page and its poll returns "use a semicolon as the delimiter"
- **THEN** the poll runs in the thread that started the designer, and the design and the spec delta use a semicolon as the delimiter

#### Scenario: Follow-up round

- **WHEN** the first round's feedback answers every question and adds the note "also let me pick the delimiter per export in the settings"
- **THEN** a second page `.lavish/design-<change>-2.html` asks only about that setting, no first-round question appears on it again, and the design uses both rounds' answers

#### Scenario: Lavish cannot open

- **WHEN** `policy.questions` is `stop`, a decision is open, `npx -y lavish-axi <page>` exits non-zero, and `AskUserQuestion` is not available
- **THEN** the reply lists the open questions with the recommended answer first, and no `design.md` is written

#### Scenario: Answers through the main thread

- **WHEN** `policy.questions` is `stop`, a decision is open, `npx -y lavish-axi <page>` exits non-zero, and the main thread has `AskUserQuestion`
- **THEN** the main thread asks the designer's questions with `AskUserQuestion`, and the designer writes `design.md` with the answers the user chose

#### Scenario: Decide and record

- **WHEN** `policy.questions` is `decide-and-record` and a decision is open
- **THEN** no question is asked, `design.md` is written, and the decision carries a `Decided without the user:` line

### Requirement: Verify design checks the design against the code

`verify-design` SHALL read the Change's `proposal.md`, spec deltas and `design.md`, `.bdk/runs/<change>/design/explore.md` when present, and the code they name. It SHALL check that every claim about the code holds, that every capability of the proposal has a spec delta whose requirements have runnable scenarios, that the design answers every requirement and the proposal's changes without contradicting them, that every decision names its alternatives, that the design breaks no rule `bdk rules for --stage design` selects (without files) unless it records the user's agreement to depart from it, that the stated constraints are met or deferred, that diagrams match the prose, that risks are concrete, and that the open questions change neither the specs, the decisions nor the plan. Before it raises a doubt about the options or output of a command-line tool, it SHALL run that tool's read-only help or version command and judge the claim by its output. A defect that would make the plan or the product wrong, and a broken design rule, SHALL be a `Must address` item that names the rule's id; every other gap SHALL be a `Should consider` item. It SHALL write the report `.bdk/runs/<change>/design/verify-N.md`, N one more than the highest existing report, with the verifier report body and stable item IDs (spec `bdk-verifier`), and reply with the verdict line and the report path.

#### Scenario: False claim about the code

- **WHEN** `design.md` says the change reuses a function `formatAmount` and no file of the project defines it
- **THEN** `verify-1.md` starts with `Verdict: FAIL` and its `## Must address` names `formatAmount` with evidence from the code

#### Scenario: Sound design

- **WHEN** every claim of the design holds and every requirement has an answer
- **THEN** the report starts with `Verdict: PASS` and its `## Must address` is empty

#### Scenario: Design breaks a design rule

- **WHEN** the project declares `IO-1` for stage `design` and `design.md` puts the CSV writer into `src/export.js`
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` holds an item naming `IO-1`

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `explore` settling a CLI's options with its help command, one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, six for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, a project rule of stage `design` the design must follow and cite (`design-draft-rules`), a follow-up round opened by a note, and an answer that drops a capability of the proposal, and one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

#### Scenario: Effect over no plugin

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs the cases `explore-*`, `design-draft-*` and `verify-design-*` with and without the plugin
- **THEN** each block's mean `WITH` score is above its `W/OUT` score

#### Scenario: Design rule cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-rules` and `verify-design-rules` with the plugin
- **THEN** `design-draft-rules` grades that `design.md` follows the rule and names its id, and `verify-design-rules` grades that the report fails and names the rule's id
