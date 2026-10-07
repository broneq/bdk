## Purpose

Defines the blocks of the BDK design stage in the `bdk` plugin - `explore`, `design-draft` and `verify-design` - and the `bdk:explorer` agent: what each reads, the file it writes, how questions reach the user, how a block that runs on an agent is started and continued, and the eval cases that admit each block.

## ADDED Requirements

### Requirement: Blocks of the design stage

The `bdk` plugin SHALL ship three skills, each runnable alone by its own command: `explore` (`/bdk:explore`), `design-draft` (`/bdk:design-draft`) and `verify-design` (`/bdk:verify-design`). Each SHALL take the name of an OpenSpec Change as its argument; without one it SHALL use the only active Change under `openspec/changes/`, and when there are several or none it SHALL name them and stop without writing a file. Each SHALL keep its run files in `.bdk/runs/<change>/`. Each SHALL do one job: `explore` and `verify-design` change no file but their own run file, and `design-draft` writes only the Change's spec deltas and `design.md`.

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

`explore` SHALL run on the agent `bdk:explorer` and `verify-design` on the agent `bdk:verifier`. A caller SHALL start such a block as an agent of that type whose prompt runs the block's skill with its arguments, so the caller receives the agent's ID and can continue the same agent with `SendMessage`. When a user invokes the skill in the main thread, the skill SHALL start its agent that way, wait for it, and reply with the agent's result; the main thread SHALL NOT do the block's work itself.

#### Scenario: Typed by the user

- **WHEN** a user types `/bdk:verify-design add-csv-export` in the main thread
- **THEN** a `bdk:verifier` agent writes `.bdk/runs/add-csv-export/design/verify-1.md`, and the main thread replies with its verdict line and the report path

#### Scenario: Continued with SendMessage

- **WHEN** a caller started `verify-design` as a `bdk:verifier` agent, the report said `Verdict: FAIL`, the design was fixed, and the caller sends that agent a message to verify again
- **THEN** the same agent writes the next report `verify-2.md`

### Requirement: Explorer agent

The plugin SHALL ship the agent `bdk:explorer` (`plugins/bdk/agents/explorer.md`) on the model `haiku`, with only the tools to search and read code, to run its block's skill, and to write its run file. It SHALL change no file of the project.

#### Scenario: Agent definition

- **WHEN** `plugins/bdk/agents/explorer.md` is read
- **THEN** its frontmatter names `explorer`, model `haiku`, and tools that include `Read`, `Grep`, `Glob`, `Write` and `Skill` and exclude `Edit`

### Requirement: Explore writes a code map

`explore` SHALL read the Change's `proposal.md` and the code it touches, and SHALL write `.bdk/runs/<change>/design/explore.md` with these sections: `## Touches` (the modules, entry points, data types and boundaries the proposal touches), `## Patterns` (conventions the change must follow), `## Tests` (where and how the touched code is tested), `## Gaps` (what the proposal needs that the code lacks) and `## Unsure` (what it could not settle). Every claim about the code SHALL name a file and line. The reply to the caller SHALL be the path of the file and at most three lines. Continued with a question, the agent SHALL answer it from the code and append the answer to `explore.md` as a `## Follow-up <n>` section.

#### Scenario: Map of a Change

- **WHEN** `explore` runs for a Change whose proposal adds a CSV export of ledger entries
- **THEN** `.bdk/runs/<change>/design/explore.md` exists, holds the five sections, and names the ledger module with a `file:line` reference

#### Scenario: Follow-up question

- **WHEN** the caller continues the explorer with a question about where amounts are formatted
- **THEN** `explore.md` gains a `## Follow-up 1` section answering it with `file:line` references, and the earlier sections are unchanged

### Requirement: Design draft writes the specs and the design

`design-draft` SHALL run in the main thread. It SHALL read the Change's `proposal.md` and, when present, `.bdk/runs/<change>/design/explore.md`; without it, it SHALL read the code the proposal touches itself before asking anything. It SHALL write one spec delta per capability the proposal names and the Change's `design.md`, each following the instruction and template of the Change's OpenSpec schema. For each branching decision it SHALL weigh at least two approaches, or say why only one is viable, and `design.md` SHALL record each decision with its reason and the alternatives with why they lost, a Mermaid diagram for each flow or structure that prose alone leaves ambiguous, and risks naming at least one bottleneck, one single point of failure or operational risk, one hidden cost and one assumption the user did not confirm. It SHALL NOT write implementation code or plan parts.

#### Scenario: Specs and design written

- **WHEN** `design-draft` finishes for a Change whose proposal names the capability `ledger-export`
- **THEN** `openspec/changes/<change>/specs/ledger-export/spec.md` holds requirements with `#### Scenario:` blocks in WHEN / THEN form, and `openspec/changes/<change>/design.md` holds numbered decisions with alternatives and a Mermaid diagram

### Requirement: Questions follow the policy and the session

`design-draft` SHALL ask the user only what the proposal, the code and the project configuration leave open, all open questions in one round, each with the recommended answer first. With `policy.questions: decide-and-record` it SHALL ask nothing, take the recommended answers, and mark each such decision in `design.md` with the line `Decided without the user:` followed by the reason. Otherwise it SHALL ask through a Lavish page when `npx -y lavish-axi` opens one, and apply the feedback the page returns; when that command fails, through `AskUserQuestion`; and when that tool is not available, by listing the questions in its reply and ending its turn. It SHALL write no spec delta and no `design.md` before the open questions are answered.

#### Scenario: Lavish opens

- **WHEN** `policy.questions` is `stop`, a decision is open, and `npx -y lavish-axi <page>` opens the page and its poll returns "use a semicolon as the delimiter"
- **THEN** the design and the spec delta use a semicolon as the delimiter

#### Scenario: Lavish cannot open

- **WHEN** `policy.questions` is `stop`, a decision is open, `npx -y lavish-axi <page>` exits non-zero, and `AskUserQuestion` is not available
- **THEN** the reply lists the open questions with the recommended answer first, and no `design.md` is written

#### Scenario: Decide and record

- **WHEN** `policy.questions` is `decide-and-record` and a decision is open
- **THEN** no question is asked, `design.md` is written, and the decision carries a `Decided without the user:` line

### Requirement: Design draft fixes a failed verification

When the last `.bdk/runs/<change>/design/verify-N.md` says `Verdict: FAIL`, `design-draft` SHALL fix every `Must address` item of that report in the spec deltas and `design.md`, decide each `Should consider` item, and reply with the item IDs it fixed and those it left with a reason. It SHALL ask the user only when a fix changes a decision the user took.

#### Scenario: Fix a false claim

- **WHEN** the last report holds `M1` saying `design.md` names a function the code does not have
- **THEN** `design.md` no longer names that function, and the reply lists `M1` as fixed

### Requirement: Verify design checks the design against the code

`verify-design` SHALL read the Change's `proposal.md`, spec deltas and `design.md`, `.bdk/runs/<change>/design/explore.md` when present, and the code they name. It SHALL check that every claim about the code holds, that every capability of the proposal has a spec delta whose requirements have runnable scenarios, that the design answers every requirement and the proposal's changes without contradicting them, that every decision names its alternatives, that the stated constraints are met or deferred, that diagrams match the prose, that risks are concrete, and that the open questions change neither the specs, the decisions nor the plan. A defect that would make the plan or the product wrong SHALL be a `Must address` item; every other gap SHALL be a `Should consider` item. It SHALL write the report `.bdk/runs/<change>/design/verify-N.md`, N one more than the highest existing report, with the verifier report body and stable item IDs (spec `bdk-verifier`), and reply with the verdict line and the report path.

#### Scenario: False claim about the code

- **WHEN** `design.md` says the change reuses a function `formatAmount` and no file of the project defines it
- **THEN** `verify-1.md` starts with `Verdict: FAIL` and its `## Must address` names `formatAmount` with evidence from the code

#### Scenario: Sound design

- **WHEN** every claim of the design holds and every requirement has an answer
- **THEN** the report starts with `Verdict: PASS` and its `## Must address` is empty

### Requirement: Eval cases of the design blocks

`plugins/bdk/evals/` SHALL hold, tagged `block` and built on a shared fixture of a configured project with an OpenSpec Change, at least one case for `explore`, one for `verify-design` with a false claim about the code, one for `verify-design` on a second pass, and three for `design-draft`: the Lavish path, the path without Lavish, and `policy.questions: decide-and-record`. Run with and without the plugin, each block SHALL score higher with it than without it, and the results SHALL be recorded in the Change.

#### Scenario: Effect over no plugin

- **WHEN** `pnpm --filter @bdk/bdk run eval` runs the cases `explore-*`, `design-draft-*` and `verify-design-*` with and without the plugin
- **THEN** each block's mean `WITH` score is above its `W/OUT` score
