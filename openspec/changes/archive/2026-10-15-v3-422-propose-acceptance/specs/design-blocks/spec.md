## MODIFIED Requirements

### Requirement: Blocks of the design stage

The `bdk` plugin SHALL ship three skills, each runnable alone by its own command: `explore` (`/bdk:explore`), `design-draft` (`/bdk:design-draft`) and `verify-design` (`/bdk:verify-design`). Each SHALL take the name of an OpenSpec Change as its argument; without one it SHALL use the only active Change under `openspec/changes/`, and when there are several or none it SHALL name them and stop without writing a file. Each SHALL keep its run files in `.bdk/runs/<change>/`. Each SHALL do one job: `explore` and `verify-design` change no file but their own run file, and `design-draft` writes only the Change's spec deltas, `design.md`, the `proposal.md` edits a user's scope answer needs and the entries it appends to `scope-log.md` ("Scope changes and deviations in the design"), the intent page ("Intent page") and its Lavish pages under `.lavish/`.

#### Scenario: Change from the argument

- **WHEN** `/bdk:explore add-csv-export` runs in a project whose `openspec/changes/` holds `add-csv-export` and another active Change
- **THEN** the block works on `add-csv-export` and writes under `.bdk/runs/add-csv-export/`

#### Scenario: Ambiguous Change

- **WHEN** a block runs without an argument and `openspec/changes/` holds two active Changes
- **THEN** it names both Changes, asks which one to use, and writes no file

### Requirement: Explore writes a code map

`explore` SHALL read the Change's `proposal.md` and the code it touches, and SHALL write `.bdk/runs/<change>/explore/design.md` with the front matter of the `explore/` directory ("Explore directory and its index", `stage: design`) and these sections: `## Touches` (the modules, entry points, data types and boundaries the proposal touches), `## Patterns` (conventions the change must follow), `## Tests` (where and how the touched code is tested), `## Gaps` (what the proposal needs that the code lacks) and `## Unsure` (what it could not settle). When `explore/propose-recon.md` exists, `explore` SHALL read it and SHALL NOT check its facts again. Every claim about the code SHALL name a file and line. `explore` SHALL follow the project's test command to the script it runs and the test runner's setup files, and SHALL read the project's rules for the commands the Change runs (`CLAUDE.md` or `AGENTS.md`, the hooks of `.claude/settings.json` and the scripts they call, the docs on how to build, test or run the project); a hook, wrapper or setup step that changes how such a command runs SHALL be named under `## Patterns` or `## Gaps` with its `file:line`. A question about the options or output of a command-line tool the proposal relies on SHALL be settled by running the tool's read-only help or version command (`<tool> --help`, `<tool> <subcommand> --help`, `<tool> --version`) and naming that command as the evidence; that command SHALL run as a Bash command of its own from the project root, with the tool's path as the project writes it (no `cd`, no absolute path, nothing chained); only when that command cannot run SHALL the point go to `## Unsure`, naming the command that would settle it. The reply to the caller SHALL be the path of the file and at most three lines. Continued with a question, the agent SHALL answer it from the code and append the answer to `explore/design.md` as a `## Follow-up <n>` section.

#### Scenario: Map of a Change

- **WHEN** `explore` runs for a Change whose proposal adds a CSV export of ledger entries
- **THEN** `.bdk/runs/<change>/explore/design.md` exists, starts with a front matter holding `question`, `summary`, `stage: design` and `files`, holds the five sections, and names the ledger module with a `file:line` reference

#### Scenario: Options of a CLI settled

- **WHEN** the proposal uploads the export with the project's `bin/upload` CLI and does not say which flag names the target folder, and `bin/upload --help` lists `--folder <name>`
- **THEN** a command running `bin/upload --help` ran, `explore/design.md` names `--folder`, and its `## Unsure` does not hold the upload flag

#### Scenario: How the tests run

- **WHEN** the project's `npm test` runs a budget wrapper that starts `node --test` with a global setup file starting a server, and a hook in `.claude/settings.json` blocks a direct `node --test` call
- **THEN** `explore/design.md` names the wrapper, the global setup file and the hook, each with a `file:line` reference

#### Scenario: Follow-up question

- **WHEN** the caller continues the explorer with a question about where amounts are formatted
- **THEN** `explore/design.md` gains a `## Follow-up 1` section answering it with `file:line` references, and the earlier sections are unchanged

### Requirement: Design draft writes the specs and the design

`design-draft` SHALL run in the `bdk:designer` agent. It SHALL read the Change's `proposal.md`, `scope-log.md` when present, `.bdk/runs/<change>/source/issue.md` when present, and `.bdk/runs/<change>/explore/index.md` when present, then the `explore/` files it needs (without an index, every file of `explore/`); without a code map, it SHALL read the code the proposal touches itself before asking anything. It SHALL read the rules `bdk rules for --stage design` selects, without files, and follow each as a constraint on the design; a decision that follows from a rule, or that departs from one with the user's agreement, SHALL name the rule's id. It SHALL write one spec delta per capability the proposal names and the Change's `design.md`, each following the instruction and template of the Change's OpenSpec schema. Every AC of `## Acceptance` that no `By: user` scope-log entry dropped SHALL be answered by a requirement of a delta or, when the Change sets `skip_specs: true`, by a section of `design.md` that names its id. For each branching decision it SHALL weigh at least two approaches, or say why only one is viable, and `design.md` SHALL record each decision with its reason and the alternatives with why they lost, a Mermaid diagram for each flow or structure that prose alone leaves ambiguous, and risks naming at least one bottleneck, one single point of failure or operational risk, one hidden cost and one assumption the user did not confirm. It SHALL NOT write implementation code or plan parts.

#### Scenario: Specs and design written

- **WHEN** `design-draft` finishes for a Change whose proposal names the capability `ledger-export`
- **THEN** `openspec/changes/<change>/specs/ledger-export/spec.md` holds requirements with `#### Scenario:` blocks in WHEN / THEN form, and `openspec/changes/<change>/design.md` holds numbered decisions with alternatives and a Mermaid diagram

#### Scenario: Design rule followed

- **WHEN** the project layer declares a rule `IO-1` for stage `design`, "every module that reads or writes a file format lives in `src/io/`, one module per format (`src/io/csv.js`)", and `design-draft` designs a Change that adds a CSV export
- **THEN** `design.md` puts the CSV writer into `src/io/csv.js` and names `IO-1` in the decision that does

### Requirement: Verify design checks the design against the code

`verify-design` SHALL read the Change's `proposal.md`, `scope-log.md`, spec deltas and `design.md`, `.bdk/runs/<change>/source/issue.md` when present, `.bdk/runs/<change>/explore/index.md` and the `explore/` files it needs when present, and the code they name. It SHALL check that every claim about the code holds, that every capability of the proposal has a spec delta whose requirements have runnable scenarios, that the design answers every requirement and the proposal's changes without contradicting them, that every decision names its alternatives, that the design breaks no rule `bdk rules for --stage design` selects (without files) unless it records the user's agreement to depart from it, that the stated constraints are met or deferred, that diagrams match the prose, that risks are concrete, and that the open questions change neither the specs, the decisions nor the plan. It SHALL check the acceptance criteria against the source ("Acceptance criteria checked by verify-design"). Before it raises a doubt about the options or output of a command-line tool, it SHALL run that tool's read-only help or version command and judge the claim by its output. A defect that would make the plan or the product wrong, and a broken design rule, SHALL be a `Must address` item that names the rule's id; every other gap SHALL be a `Should consider` item. It SHALL write the report `.bdk/runs/<change>/design/verify-N.md`, N one more than the highest existing report, with the verifier report body and stable item IDs (spec `bdk-verifier`), and reply with the verdict line and the report path.

#### Scenario: False claim about the code

- **WHEN** `design.md` says the change reuses a function `formatAmount` and no file of the project defines it
- **THEN** `verify-1.md` starts with `Verdict: FAIL` and its `## Must address` names `formatAmount` with evidence from the code

#### Scenario: Sound design

- **WHEN** every claim of the design holds and every requirement has an answer
- **THEN** the report starts with `Verdict: PASS` and its `## Must address` is empty

#### Scenario: Design breaks a design rule

- **WHEN** the project declares `IO-1` for stage `design` and `design.md` puts the CSV writer into `src/export.js`
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` holds an item naming `IO-1`

### Requirement: Scope changes and deviations in the design

When a user's answer adds, drops, narrows or reinterprets an AC, a capability or a "What Changes" item of the proposal, `design-draft` SHALL change `proposal.md` (Intent, Acceptance, What Changes, Capabilities, Out of scope) to match before it writes the spec deltas, an AC keeping its id with its old text struck, SHALL append an entry to `scope-log.md` with `Stage: design` and `By: user` (spec `bdk-propose`, "Scope log opened by propose"), and SHALL record the change under the decision in `design.md` with a line `Scope changed by the user:` naming the entry. In a revision, it SHALL delete the spec delta of a capability the answer dropped. A change of an AC SHALL NOT be taken without the user: with `policy.questions: decide-and-record`, or when no way to ask is left, the designer SHALL leave the AC as it is, append an open entry `By: needs-user`, write no spec delta and no `design.md`, and end with the line `Needs user: SL-<n>`; it SHALL NOT mark such a decision `Decided without the user:`. Every open `By: needs-user` entry of the log SHALL be asked in the first round of the designer's questions, and its answer appended as an entry with `Answers: SL-<n>` and `By: user`. When an answer contradicts the acceptance signal the proposal carries or a rule of the project (`CLAUDE.md`, `.claude/rules/`, the rules of `openspec/config.yaml`, a rule `bdk rules for --stage design` selects), the designer SHALL ask it again in the next round, naming and quoting that rule, with following the rule as the recommended answer; when the user keeps the answer, `design.md` SHALL record it under the decision with a line `Deviation:` naming the rule or acceptance signal, its source or rule id, and what the user chose. The designer SHALL NOT write to the GitHub issue.

#### Scenario: Capability dropped by an answer

- **WHEN** the proposal names the capabilities `ledger-export` and `ledger-import`, and the user's answer says to leave the import for later
- **THEN** `proposal.md` no longer lists `ledger-import` under its capabilities and names it under Out of scope, no spec delta for `ledger-import` is written, `scope-log.md` gains an entry with `Stage: design` and `By: user`, and `design.md` holds a `Scope changed by the user:` line naming it

#### Scenario: Answer against a project rule

- **WHEN** the project's `CLAUDE.md` says every amount is stored in integer cents and the user's note on the page asks for decimal amounts
- **THEN** the next round asks whether to keep decimal amounts, quoting the rule, with integer cents recommended, and when the user keeps decimal amounts `design.md` holds a `Deviation:` line naming `CLAUDE.md`

#### Scenario: AC change under decide-and-record

- **WHEN** `policy.questions` is `decide-and-record` and the code cannot meet `AC-2` as written
- **THEN** `scope-log.md` gains an entry naming `AC-2` with `By: needs-user`, no `design.md` is written, and the reply ends with `Needs user: SL-<n>`

#### Scenario: Open entry asked first

- **WHEN** `scope-log.md` holds an open entry `SL-1` with `By: needs-user` and `policy.questions` is `stop`
- **THEN** the first round asks `SL-1`, and after the answer `scope-log.md` holds an entry with `Answers: SL-1` and `By: user`

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `explore` settling a CLI's options with its help command, one for `explore` naming the project's test wrapper, test setup and test hook (`explore-project-facts`), one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, eight for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, a project rule of stage `design` the design must follow and cite (`design-draft-rules`), a follow-up round opened by a note, an answer that drops a capability of the proposal, a page in the user's language whose every card holds the three sections of the page contract (`design-draft-page-contract`), and a bare page from an earlier round caught and rewritten before it opens again (`design-draft-page-resume-bare`), one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`), and two for `verify-design` on a design that drops an AC of the source: without a scope-log entry (`verify-design-dropped-ac`, graded `Verdict: FAIL` with a `Must address` item naming the AC) and with an entry `By: user` that drops it (`verify-design-dropped-ac-user`, graded `Verdict: PASS`). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

#### Scenario: Effect over no plugin

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs the cases `explore-*`, `design-draft-*` and `verify-design-*` with and without the plugin
- **THEN** each block's mean `WITH` score is above its `W/OUT` score

#### Scenario: Design rule cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-rules` and `verify-design-rules` with the plugin
- **THEN** `design-draft-rules` grades that `design.md` follows the rule and names its id, and `verify-design-rules` grades that the report fails and names the rule's id

#### Scenario: Page contract cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-page-contract` and `design-draft-page-resume-bare` with the plugin
- **THEN** the first grades that every card of the opened page holds the three sections and is in Polish, and the second that the bare page is rewritten with the three sections before the command that opens it

#### Scenario: Dropped AC cases

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `verify-design-dropped-ac` and `verify-design-dropped-ac-user` with the plugin
- **THEN** the first report starts with `Verdict: FAIL` and names the dropped AC under `## Must address`, and the second starts with `Verdict: PASS`

## ADDED Requirements

### Requirement: Explore directory and its index

`.bdk/runs/<change>/explore/` SHALL hold the files of the blocks that read code for a Change: `propose-recon.md` (`/bdk:recon`), `design.md` (`/bdk:explore`) and room for more, each with one writer. Each such file SHALL start with a YAML front matter of `question` (what the file answers), `summary` (the answer in one line), `stage` (`propose` or `design`) and `files` (the project files it read for it). `explore/index.md` SHALL be built, never edited by hand, by the orchestrator that ran the block (`/bdk:propose` after recon, `/bdk:design` after explore): it SHALL read the front matter of every other file of `explore/` and write the whole index again, one line per file `- [<file>](<file>) (<stage>) <question> - <summary>`. A reader SHALL read `index.md` first and then only the files whose question it needs.

#### Scenario: Index after the design map

- **WHEN** `/bdk:design` has run `explore` for a Change whose `explore/` already holds `propose-recon.md`
- **THEN** `explore/index.md` holds one line for `propose-recon.md` with stage `propose` and one for `design.md` with stage `design`, each with the question and summary of its front matter

### Requirement: Acceptance criteria checked by verify-design

`verify-design` SHALL treat `source/issue.md`, `## Intent` and `## Acceptance` of `proposal.md` and `scope-log.md` as the reference. A `Must address` item SHALL be: an acceptance point of `source/issue.md` that `## Acceptance` lacks or states differently with no `By: user` entry for it; an AC the spec deltas or `design.md` drop, narrow or reinterpret with no `By: user` entry naming it (an entry `By: setting` or an open `By: needs-user` entry does not cover it, and neither does a `Decided without the user:` line); an AC no requirement, decision or, with `skip_specs: true`, design section answers. An AC outside the proposal's other sections SHALL NOT be excused as "outside the proposal". When `source/issue.md` is missing, the check SHALL run against `## Acceptance` and the report SHALL say so under `## Checked`; when the proposal has no `## Acceptance` either, that SHALL be a `Should consider` item.

#### Scenario: AC dropped without the user

- **WHEN** `## Acceptance` holds `AC-3`, `design.md` leaves `AC-3` out with a `Decided without the user:` line, and `scope-log.md` holds no entry for `AC-3`
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` names `AC-3`

#### Scenario: AC dropped by the user

- **WHEN** `scope-log.md` holds an entry `AC: AC-3`, `After: dropped`, `By: user`, and the design leaves `AC-3` out
- **THEN** no `Must address` item names `AC-3`, and `## Checked` names the entry

### Requirement: Intent page

Run with the arguments `<change> intent page`, `design-draft` SHALL write `.bdk/runs/<change>/design/intent.html`, and nothing else, from `scope-log.md`, `## Intent` and `## Acceptance` of `proposal.md`, `source/issue.md` and `design.md`, as HTML it writes itself (no Markdown conversion) following its reference `intent-page.md`. The page SHALL hold: the intent quoted from the source with every changed word struck (`<del>`) and the new words marked (`<ins>`), each change tagged with its entry id; for each scope-log entry whose `Stage` is not `propose`, when and by whom it was decided, what the design found with `file:line`, what was chosen, and the options rejected with why; a table of every AC before and after with a status `changed`, `unchanged`, `added` or `dropped`; and an inline SVG of the flow the change alters, before and after. Its `<head>` SHALL hold `<meta name="bdk-scope-log" content="SL-<n>">` naming the last entry of the log. Its words SHALL be in the language the prompt names as the user's.

#### Scenario: Page of a changed AC

- **WHEN** `design-draft` runs with `add-csv-export intent page` and `scope-log.md` holds an entry with `Stage: design`, `AC: AC-2` and `By: user`
- **THEN** `.bdk/runs/add-csv-export/design/intent.html` exists, holds a `<del>` element in the intent, a table row for `AC-2` with the status `changed` and its before and after text, an `<svg>` element, and the meta `bdk-scope-log` naming that entry
