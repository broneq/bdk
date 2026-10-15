# design-blocks Specification

## Purpose

Defines the blocks of the BDK design stage in the `bdk` plugin - `explore`, `design-draft` and `verify-design` - and the `bdk:explorer` agent: what each reads, the file it writes, how questions reach the user, how a block that runs on an agent is started and continued, and the eval cases that admit each block.

## Requirements

### Requirement: Blocks of the design stage

The `bdk` plugin SHALL ship three skills, each runnable alone by its own command: `explore` (`/bdk:explore`), `design-draft` (`/bdk:design-draft`) and `verify-design` (`/bdk:verify-design`). Each SHALL take the name of an OpenSpec Change as its argument; without one it SHALL use the only active Change under `openspec/changes/`, and when there are several or none it SHALL name them and stop without writing a file. Each SHALL keep its run files in `.bdk/runs/<change>/`. Each SHALL do one job: `explore` and `verify-design` change no file but their own run file, and `design-draft` writes only the Change's spec deltas, `design.md`, the `proposal.md` edits a user's scope answer needs and the entries it appends to `scope-log.md` ("Scope changes and deviations in the design"), the intent page ("Intent page") and its Lavish pages under `.lavish/`.

#### Scenario: Change from the argument

- **WHEN** `/bdk:explore add-csv-export` runs in a project whose `openspec/changes/` holds `add-csv-export` and another active Change
- **THEN** the block works on `add-csv-export` and writes under `.bdk/runs/add-csv-export/`

#### Scenario: Ambiguous Change

- **WHEN** a block runs without an argument and `openspec/changes/` holds two active Changes
- **THEN** it names both Changes, asks which one to use, and writes no file

### Requirement: Blocks stop without a configuration

Each block SHALL read the resolved BDK configuration before its first step. When the project is not configured, it SHALL stop, pass on the line "BDK not configured: run /bdk:setup" and write no file.

#### Scenario: Project without BDK

- **WHEN** `/bdk:design-draft` runs in a project without `.bdk/settings.yaml`
- **THEN** the reply says "BDK not configured: run /bdk:setup" and no file under `openspec/` or `.bdk/` is created

### Requirement: Agent blocks are started as agents and can be continued

`explore` SHALL run on the agent `bdk:explorer`, `design-draft` on the agent `bdk:designer` and `verify-design` on the agent `bdk:verifier`. A caller SHALL start such a block as an agent of that type whose prompt runs the block's skill with its arguments, so the caller receives the agent's ID and can continue the same agent with `SendMessage`. When a user invokes the skill in the main thread, the skill SHALL start its agent that way, with `model` and `effort` from `models.explorer`, `models.designer` or `models.verifier` as spec `bdk-cli/config` ("Every agent is a models role") says, wait for it, and reply with the agent's result; the main thread SHALL NOT do the block's work itself.

#### Scenario: Typed by the user

- **WHEN** a user types `/bdk:verify-design add-csv-export` in the main thread
- **THEN** a `bdk:verifier` agent writes `.bdk/runs/add-csv-export/design/verify-1.md`, and the main thread replies with its verdict line and the report path

#### Scenario: Typed by the user with a model set

- **WHEN** a user types `/bdk:explore add-csv-export` in the main thread of a project whose configuration sets `models.explorer.model: sonnet`
- **THEN** the skill starts the `bdk:explorer` agent with `model` `sonnet`

#### Scenario: Continued with SendMessage

- **WHEN** a caller started `verify-design` as a `bdk:verifier` agent, the report said `Verdict: FAIL`, the design was fixed, and the caller sends that agent a message to verify again
- **THEN** the same agent writes the next report `verify-2.md`

#### Scenario: Design draft on the designer

- **WHEN** a user types `/bdk:design-draft add-csv-export` with `models.designer.model: sonnet` and `models.designer.effort: high` and `policy.questions: decide-and-record`
- **THEN** a `bdk:designer` agent started with `model` `sonnet` and `effort` `high` writes `openspec/changes/add-csv-export/design.md`, and the main thread writes no spec delta and no `design.md` itself

### Requirement: Explorer agent

The plugin SHALL ship the agent `bdk:explorer` (`plugins/bdk/agents/explorer.md`) on the model `sonnet`, with only the tools to search and read code, to run its block's skill, and to write its run file. It SHALL change no file of the project.

#### Scenario: Agent definition

- **WHEN** `plugins/bdk/agents/explorer.md` is read
- **THEN** its frontmatter names `explorer`, model `sonnet`, and tools that include `Read`, `Grep`, `Glob`, `Write` and `Skill` and exclude `Edit`

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

### Requirement: Questions follow the policy and the session

`design-draft` SHALL ask the user only what the proposal, the code and the project configuration leave open, each question with the recommended answer first, in rounds: the first round asks every open decision; a later round asks only the decisions the previous answers opened (a free note that asks for something new, changes the scope, or contradicts a rule as "Scope changes and deviations in the design" says), and SHALL NOT ask an answered decision again. There SHALL be at most three rounds; a decision still open after the third SHALL take the recommended answer and be marked `Decided without the user:`. With `policy.questions: decide-and-record` it SHALL ask nothing, take the recommended answers, and mark each such decision in `design.md` with the line `Decided without the user:` followed by the reason.

Otherwise the designer SHALL write a Lavish page for the round (`.lavish/design-<change>.html` for the first, `.lavish/design-<change>-<round>.html` for a later one) and open it with `npx -y lavish-axi <page>`. When the page opens, the designer SHALL end its turn with the page path and the open decisions, and the thread that started it SHALL wait for the feedback with `npx -y lavish-axi poll <page>` in the foreground and continue the same designer with it (`SendMessage`). When the poll is interrupted or the user asks to stop waiting, that thread SHALL NOT poll again in that turn: it SHALL answer the user, name the page and the open decisions, and end its turn; a later run of the design stage for the Change SHALL poll the same page, whose queued feedback then arrives. When the open command fails, the designer SHALL end its turn with the open questions listed, the recommended answer first, and write nothing; the thread that started it SHALL ask them through `AskUserQuestion` and continue the same designer with the answers (`SendMessage`), or start a new designer whose arguments carry the answers. When `AskUserQuestion` is not available either, that thread SHALL list the questions in its reply and end it with one line saying how to answer. No spec delta and no `design.md` SHALL be written before the open questions are answered. The designer and the thread that started it SHALL run each Lavish command (`playbook`, open, `poll`) as a Bash command of its own, with no `;`, `&&`, pipe or `echo` around it: the tool result carries the exit code, and a compound command falls outside the grant `Bash(npx -y lavish-axi *)`.

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

#### Scenario: Lavish commands run alone

- **WHEN** the designer opens a round's page and the thread that started it polls it
- **THEN** every Bash command that calls `lavish-axi` is that call alone, and none is denied for falling outside the grant `Bash(npx -y lavish-axi *)`

### Requirement: A question page a developer can decide from

Every card of a `design-draft` Lavish page (one card per open decision) SHALL hold three sections, each marked in the markup with `data-bdk-section` so it can be found in any language: `context`, what the proposal (or the issue it tracks) says about the decision and what the code does today, with at least one `file:line` of code the decision touches, or a statement that the project has no code for it yet; `options`, every option with its consequences: what it costs, what it risks, what it leaves uncovered and what it breaks, each named or stated as none; and `recommendation`, the recommended option and the reason, tied to the proposal, the code or a project rule. A card holding only a question and bare options SHALL be invalid. The page's layout and look SHALL follow Lavish's own guidance (`npx -y lavish-axi design` and its playbooks); BDK SHALL fix only what a card says and its section markers.

The thread that starts `bdk:designer` SHALL name in the designer's prompt the language the user writes in, and the designer SHALL write the page in that language, English when the prompt names none. Before it opens a page, a new one or one it opens again on resume, the designer SHALL read the page back and check every card against this contract and the language, and fix the page in place until every card passes; it SHALL NOT open a page with an invalid card.

#### Scenario: Cards in the user's language

- **WHEN** the user asks in Polish for the design of a Change with open decisions on the CSV delimiter and the amount format, and the Lavish page opens
- **THEN** every card of the page holds a `context` section that cites a `file:line` of the project, an `options` section that names the consequences of each option, and a `recommendation` section with its reason, and the page's text is in Polish

#### Scenario: Bare page caught before it opens

- **WHEN** the design resumes on a round's page from an earlier run whose cards hold only a question and radio options, with no `design.md` and no answers
- **THEN** the designer rewrites that page so every card holds the three sections before `npx -y lavish-axi <page>` opens it

### Requirement: Design draft fixes a failed verification

When the last `.bdk/runs/<change>/design/verify-N.md` says `Verdict: FAIL`, `design-draft` SHALL fix every `Must address` item of that report in the spec deltas and `design.md`, decide each `Should consider` item, and reply with the item IDs it fixed and those it left with a reason. It SHALL ask the user only when a fix changes a decision the user took.

#### Scenario: Fix a false claim

- **WHEN** the last report holds `M1` saying `design.md` names a function the code does not have
- **THEN** `design.md` no longer names that function, and the reply lists `M1` as fixed

### Requirement: Design draft revises on a request

When the Change already has a `design.md`, the last `.bdk/runs/<change>/design/verify-N.md` does not say `Verdict: FAIL`, and the arguments carry a revision request after the Change name, `design-draft` SHALL change the spec deltas and `design.md` only as far as the request needs, keep every other decision, and reply with what it changed. It SHALL ask the user only when the request leaves a decision open, following `policy.questions`.

#### Scenario: Revision requested at the design gate

- **WHEN** `design-draft` runs with the arguments `add-csv-export quote every label` and the Change holds a passed design that quotes only labels with a comma, a quote or a line break
- **THEN** the spec delta and `design.md` say that every label is quoted, the other decisions of `design.md` are unchanged, and the reply names the change

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

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `explore` settling a CLI's options with its help command, one for `explore` naming the project's test wrapper, test setup and test hook (`explore-project-facts`), one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, nine for `design-draft`: the Lavish path, the path without Lavish, `policy.questions: decide-and-record`, every AC of a proposal from the new propose answered under `policy.questions: decide-and-record` (`design-draft-acceptance`, graded that the spec delta answers AC-1 to AC-4, writes no scenario that leaves a comma label unquoted, reuses `listEntries` and `formatCents` in `design.md`, and appends no `needs-user` entry), a project rule of stage `design` the design must follow and cite (`design-draft-rules`), a follow-up round opened by a note, an answer that drops a capability of the proposal, a page in the user's language whose every card holds the three sections of the page contract (`design-draft-page-contract`), and a bare page from an earlier round caught and rewritten before it opens again (`design-draft-page-resume-bare`), one for `verify-design` on a design that breaks a project rule of stage `design` (`verify-design-rules`), and two for `verify-design` on a design that drops an AC of the source: without a scope-log entry (`verify-design-dropped-ac`, graded `Verdict: FAIL` with a `Must address` item naming the AC) and with an entry `By: user` that drops it (`verify-design-dropped-ac-user`, graded `Verdict: PASS`), and one for `verify-design` on a design whose delta narrows an AC under one option with an empty scope log (`verify-design-narrowed-ac`, graded `Verdict: FAIL` with a `Must address` item naming the AC). Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

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

#### Scenario: Narrowed AC case

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `verify-design-narrowed-ac` with the plugin, 3 runs
- **THEN** each report starts with `Verdict: FAIL` and names `AC-3` under `## Must address`

#### Scenario: Acceptance case

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs `design-draft-acceptance` with the plugin
- **THEN** the spec delta answers AC-1 to AC-4 with scenarios, no scenario writes a label holding a comma without quotes, `design.md` names `listEntries` and `formatCents`, and `scope-log.md` holds no `needs-user` entry

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

### Requirement: Explore directory and its index

`.bdk/runs/<change>/explore/` SHALL hold the files of the blocks that read code for a Change: `propose-recon.md` (`/bdk:recon`), `design.md` (`/bdk:explore`) and room for more, each with one writer. Each such file SHALL start with a YAML front matter of `question` (what the file answers), `summary` (the answer in one line), `stage` (`propose` or `design`) and `files` (the project files it read for it). `explore/index.md` SHALL be built, never edited by hand, by the orchestrator that ran the block (`/bdk:propose` after recon, `/bdk:design` after explore): it SHALL read the front matter of every other file of `explore/` and write the whole index again, one line per file `- [<file>](<file>) (<stage>) <question> - <summary>`. A reader SHALL read `index.md` first and then only the files whose question it needs.

#### Scenario: Index after the design map

- **WHEN** `/bdk:design` has run `explore` for a Change whose `explore/` already holds `propose-recon.md`
- **THEN** `explore/index.md` holds one line for `propose-recon.md` with stage `propose` and one for `design.md` with stage `design`, each with the question and summary of its front matter

### Requirement: Acceptance criteria checked by verify-design

`verify-design` SHALL treat `source/issue.md`, `## Intent` and `## Acceptance` of `proposal.md` and `scope-log.md` as the reference. A `Must address` item SHALL be: an acceptance point of `source/issue.md` that `## Acceptance` lacks or states differently with no `By: user` entry for it; an AC the spec deltas or `design.md` drop, narrow or reinterpret with no `By: user` entry naming it (an entry `By: setting` or an open `By: needs-user` entry does not cover it, and neither does a `Decided without the user:` line); an AC no requirement, decision or, with `skip_specs: true`, design section answers. An AC outside the proposal's other sections SHALL NOT be excused as "outside the proposal". When `source/issue.md` is missing, the check SHALL run against `## Acceptance` and the report SHALL say so under `## Checked`; when the proposal has no `## Acceptance` either, that SHALL be a `Should consider` item.

Each AC SHALL be checked as it stands, with its condition (an AC without one holds in every case), against every requirement, scenario and decision that touches its subject, also those written for another AC, under every option, mode or input the deltas bring in. A requirement or scenario that, under one of them, gives an outcome the AC rules out or holds the AC for fewer cases than its condition SHALL count as narrowing the AC. A list in `design.md` naming the AC it answers SHALL count as a claim to check, not as evidence. `## Checked` SHALL hold one line per AC naming its id, its quoted condition and the requirements and scenarios read.

#### Scenario: AC dropped without the user

- **WHEN** `## Acceptance` holds `AC-3`, `design.md` leaves `AC-3` out with a `Decided without the user:` line, and `scope-log.md` holds no entry for `AC-3`
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` names `AC-3`

#### Scenario: AC dropped by the user

- **WHEN** `scope-log.md` holds an entry `AC: AC-3`, `After: dropped`, `By: user`, and the design leaves `AC-3` out
- **THEN** no `Must address` item names `AC-3`, and `## Checked` names the entry

#### Scenario: AC narrowed under one option

- **WHEN** `AC-3` says "A label holding a comma is quoted" with no condition, the delta adds a `delimiter` option for `AC-4` and quotes only a field holding the delimiter in use, a scenario writes the label `food, drinks` without quotes under `delimiter: ";"`, `design.md` lists `AC-3` as answered, and `scope-log.md` holds no entry
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` names `AC-3`

### Requirement: Intent page

Run with the arguments `<change> intent page`, `design-draft` SHALL write `.bdk/runs/<change>/design/intent.html`, and nothing else, from `scope-log.md`, `## Intent` and `## Acceptance` of `proposal.md`, `source/issue.md` and `design.md`, as HTML it writes itself (no Markdown conversion) following its reference `intent-page.md`. The page SHALL hold: the intent quoted from the source with every changed word struck (`<del>`) and the new words marked (`<ins>`), each change tagged with its entry id; for each scope-log entry whose `Stage` is not `propose`, when and by whom it was decided, what the design found with `file:line`, what was chosen, and the options rejected with why; a table of every AC before and after with a status `changed`, `unchanged`, `added` or `dropped`; and an inline SVG of the flow the change alters, before and after. Its `<head>` SHALL hold `<meta name="bdk-scope-log" content="SL-<n>">` naming the last entry of the log. Its words SHALL be in the language the prompt names as the user's.

#### Scenario: Page of a changed AC

- **WHEN** `design-draft` runs with `add-csv-export intent page` and `scope-log.md` holds an entry with `Stage: design`, `AC: AC-2` and `By: user`
- **THEN** `.bdk/runs/add-csv-export/design/intent.html` exists, holds a `<del>` element in the intent, a table row for `AC-2` with the status `changed` and its before and after text, an `<svg>` element, and the meta `bdk-scope-log` naming that entry

### Requirement: Designer agent on opus

The `bdk` plugin SHALL ship the agent `bdk:designer` (`agents/designer.md`), which runs the skill `bdk:design-draft` its prompt names with the `Skill` tool, on the model `opus`, chosen by the #423 measurement (archived Change `v3-423-designer-planner-model`), so that, with `models.designer` not set, the design runs on `opus` whatever the session's model, and the tools `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` and `Skill`.

#### Scenario: Designer on its own model

- **WHEN** `/bdk:design add-csv-export` drafts the design in a `sonnet` session and the configuration sets nothing under `models.designer`
- **THEN** the `Agent` call that starts `bdk:designer` has neither `model` nor `effort`, and the designer runs on `opus`, the model of its frontmatter

#### Scenario: Designer model set by the project

- **WHEN** the configuration sets `models.designer.model: sonnet`
- **THEN** the `Agent` call that starts `bdk:designer` has `model` `sonnet`
