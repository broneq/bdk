# Skills

Every skill is invoked as `/bdk:<name>`. This page lists one section per user-invocable skill - purpose, arguments, the artifact it writes, when to reach for it, and the skills it works with. Skills whose frontmatter carries `user-invocable: false` (the role skills and `swarm`) are loaded by agents and orchestrators, never typed as a slash command, so they get one collective paragraph near the end instead of individual sections.

For the pipeline these skills form, see [The Change pipeline](../concepts/change-pipeline.md) and the [profiles](../index.md#how-you-work-with-it).

## Stage skills

BDK works in Changes: one unit of work on one branch, whose intent, design, plan, ledger and progress the kernel keeps. A stage skill runs one step of a Change and ends by naming the command to type next; you type it, so every stage starts from your decision. `/bdk:run` types them for you, one stage after another, and stops where a gate needs you. Stage skills write only through kernel commands (`bdk ...`) and follow a kernel refusal's `instead` rather than working around it.

## /bdk:setup

**Purpose.** Bring a project to a working BDK layout: `.bdk/settings.yaml` with the project's languages and its test, lint and build commands (detected from the project files and confirmed with you), Lavish, and the migration of a BDK 2 project. Settings are written only with `bdk config set`, which validates every value. See [Project setup](../getting-started/setup.md).

**Arguments:** `[what to change, e.g. 'add the e2e suite']` - with none, the whole setup; with a request, only that.

**Artifact:** `.bdk/settings.yaml` (tracked), `.bdk/.machine/` (ignored). A v2 project's `.bdk/settings.json`, `plans/`, `design/`, `runs/` and `verify-plan/` are deleted after you confirm.

**When to use.** Once per project, after cloning, or when the session start or `bdk doctor` reports missing settings or a v2 layout. Claude does not start it on its own.

**Related skills:** `/bdk:change`, the step that follows.

## /bdk:change

**Purpose.** Open a Change from an intent, or show where the current one stands. Opening asks whether to create a new branch (`feat/<slug>`, or `fix/<slug>` for a bug) or stay on the current one, on every branch, because a branch holds one active Change. It passes `--kind bug` for a defect, and `--profile tiny` with a reason only when the code the intent touches shows no user-visible behaviour change, no data model, schema or configuration change, no change to a specified capability and at most 2 files in 1 module.

**Arguments:** `"<intent>"` opens a Change; none shows the current Change's stage and gate; `list`, `resume <id> [--option <n>]`, `park [--reason <text>]` and `takeover` run the kernel command of the same name.

**Artifact:** `.bdk/changes/<changeId>/`, written by `bdk change new`; the branch binding lives in `.bdk/.machine/`.

**When to use.** At the start of every feature or fix, and whenever you want to know which command comes next. When the branch already has an active Change, it shows that Change and opens nothing. Claude starts it only inside a `/bdk:run` of your session; the kernel's hooks deny any other call.

**Related skills:** `/bdk:setup` before it; the stage it names next, `/bdk:design` for a feature or `/bdk:plan` for a bug.

## /bdk:design

**Purpose.** Design the active Change with you. It reads the code the intent touches and tells you what exists before asking anything, then offers at least two approaches for each real decision, each with a Mermaid diagram and a self-critique (a bottleneck, a single point of failure, a hidden cost, an assumption you did not confirm), and writes the approach you choose. It writes exactly the files the kernel names: `design.md`, or design parts for a design that spans three or more subsystems, and `architecture.md` unless the Change touches no module boundary. Every decision you take becomes a `decision` entry in the Change's ledger and every open point a `question`; a data-model change needs its own approval first. It then runs `/bdk:verify-design`, corrects false claims about the code itself, decides which findings to fix before planning, and shows you the design and the verdict in one review. Simple questions go to the terminal; comparisons and the review go to a Lavish page when Lavish is on.

**Arguments:** `[what to focus on]` - optional; the Change's intent is the subject.

**Artifact:** `.bdk/changes/<changeId>/design.md` (or `design/parts/<nn>-<slug>.md` and `design/index.md`), `architecture.md`, and `decision` and `question` entries under `log/`.

**When to use.** When `/bdk:change` or `bdk next` names it: after opening a feature Change of profile `small` or `large`. It ends at the design gate, naming `/bdk:plan`, which you type to accept the design.

**Related skills:** `/bdk:change` before it, `/bdk:verify-design` inside it, `/bdk:plan` after the gate, `/bdk-craft:mermaid-drawer` for its diagrams when `bdk-craft` is installed.

## /bdk:verify-design

**Purpose.** Check the design of the active Change against the code on a fresh context: a `design-verifier` agent that knows only its dispatch package reads `design.md`, `architecture.md` and the design parts, checks every claim about the code, and blocks only on the categories of `policy.verifier.blocking-categories` (a false claim about the code, for example). A passing verdict marks the `design-verify` node done, which the design gate requires; a design edited afterwards needs a new verdict. On blockers it lists them with their category and what the kernel allows next: another round, an escalation round on a stronger model, or parking the Change.

**Arguments:** none.

**Artifact:** a ticket under `attempts/`, the verifier's package under `dispatch/` and report under `reports/`, and its `report`, `blocker` and `finding` entries under `log/`, all in `.bdk/changes/<changeId>/`.

**When to use.** `/bdk:design` runs it after writing the design; run it yourself after editing a design file by hand. It refuses, naming `/bdk:design`, while a design file is not done.

**Related skills:** `/bdk:design`, which starts it and acts on its verdict.

## /bdk:plan

**Purpose.** Plan the active Change as plan parts that workers build without the conversation. Each part holds at most 8 tasks and 8 KB, and parts without a dependency between them run in the same wave. Each task is a contract, not code: its goal, the exact signatures and formats other tasks consume, its `Files:`, and test cases that each name an input and the expected result, one or more for every behaviour the task states. It reads the design (a `bug` Change has none and is planned from its intent), the ledger and the code first, writes the spec delta of every capability a part changes, then runs `/bdk:verify-plan` and corrects the plan itself until the verdict passes. It asks you only about a blocker that needs a decision the design does not hold.

**Arguments:** `[--review] [what to focus on]` - `--review` shows the verified plan for your acceptance before the report; any other text is a focus for the plan.

**Artifact:** `.bdk/changes/<changeId>/plan/parts/<nn>-<slug>.md`, `spec-delta/<capability>.md` for the capabilities a part names in `spec-impact`, and `decision` entries under `log/`.

**When to use.** After the design gate, or right after opening a `bug` or `tiny` Change. It ends with a report of the parts, their waves, the corrections it made and each finding with its decision, naming `/bdk:execute`, which you type. Claude starts it only inside a `/bdk:run` of your session.

**Related skills:** `/bdk:design` or `/bdk:change` before it, `/bdk:verify-plan` inside it; a `bug` Change from `/bdk:change` starts here.

## /bdk:verify-plan

**Purpose.** Check the plan of the active Change against the code and the design on a fresh context: one `verifier` agent that knows only its dispatch package reads every plan part together with the design documents and the spec deltas. Besides each task's claims about the code, it checks that every stated behaviour has a test case, that the plan covers the design, and that parts declare the dependencies between them. It blocks only on the categories of `policy.verifier.blocking-categories`. A passing verdict marks the `plan-verify` node done; an edit to a plan part, a spec delta or the design afterwards makes it stale.

**Arguments:** none.

**Artifact:** a ticket under `attempts/`, the verifier's package under `dispatch/` and report under `reports/`, and its `report`, `blocker` and `finding` entries under `log/`, all in `.bdk/changes/<changeId>/`.

**When to use.** `/bdk:plan` runs it after writing the plan; run it yourself after editing a plan part by hand. It refuses while a plan part is not done.

**Related skills:** `/bdk:plan`, which starts it and acts on its verdict.

## /bdk:execute

**Purpose.** Build the verified plan of the active Change through role agents. It loops on `bdk next` and runs every ready plan part in the mode the kernel marks: `flat`, where the main session dispatches each task as one ticket (implementer, then the post-task steps simplify, scoped tests and lint), or `tree`, where one `lead` agent runs each part of a `large` Change with at least two independent parts ready. `bdk config set execution.tree.enabled false` runs every part flat, and `execution.tree.min-parts` (2 to 15) sets how many ready parts a tree needs. A part the plan marks `isolation: worktree` is built in its own git worktree and merged back by a merge commit; a merge conflict becomes a merge ticket ([Worktree parts](../concepts/worktree-parts.md)). Each task ends as one commit with its `BDK-Change`, `BDK-Part` and `BDK-Task` trailers; the kernel decides retries, the narrower scope and escalation to a stronger model. One `/bdk:execute` runs every ready part, then marks the spec deltas done and reruns the steps of a part a later part changed. It never edits a file or runs a test itself, and asks you only about a critical finding the plan and the design do not settle.

**Arguments:** none.

**Artifact:** task commits in the project, and in `.bdk/changes/<changeId>/` the tickets under `attempts/`, the dispatch packages under `dispatch/`, the agents' reports under `reports/`, the evidence under `evidence/` and the entries under `log/`.

**When to use.** After `/bdk:plan` has verified the plan. When the plan is not done it dispatches nothing and names `/bdk:plan`. It ends with a report of the parts, the tasks committed, the open findings and the gate items, naming `/bdk:cr`, which you type. Claude starts it only inside a `/bdk:run` of your session.

**Related skills:** `/bdk:plan` before it, `/bdk:cr` after it.

## /bdk:close

**Purpose.** Close the reviewed Change. It checks the close with `bdk change close --dry-run` and stops on what the kernel refuses (an open ticket, a spec conflict), then runs `bdk change close`: the spec deltas are merged into `.bdk/specs/`, the Change is archived under `.bdk/changes/archive/<changeId>/` and committed as `chore(bdk): close <changeId>`. It ends with the PR summary from the ledger (intent, decisions, assumptions, risks, open findings, merged capabilities), the gates passed by policy rather than by you, and the regenerated rule files for you to commit. It asks nothing, edits no file and opens no PR: publishing the PR is your step.

**Arguments:** none.

**Artifact:** `.bdk/changes/archive/<changeId>/`, the merged `.bdk/specs/` and the close commit.

**When to use.** After `/bdk:cr`, when the review gate is ready; typing `/bdk:close` passes it. Claude starts it only inside a `/bdk:run` of your session.

**Related skills:** `/bdk:cr` before it, `/bdk:run`, which can end with it.

## /bdk:run

**Purpose.** Carry a Change through its stages without typing each command. It loops on `bdk next` and starts the stage skill the kernel names (`/bdk:change` with your intent, then `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:cr` and `/bdk:close`), each with its own instructions and tools. While it runs nobody answers questions: the skills take the option they recommend, and each choice becomes a `decision` entry with `review: true`, shown at the next gate and in the PR summary. It stops when a gate needs you, when the Change is parked, when a stage reports a refusal it could not resolve, and after the close. Blocking review entries do not stop it: `/bdk:cr` fixes them in its own rounds. It prints one line per stage and the full status only at the stop.

**Arguments:** `[--auto] ["<intent>"]` - an intent opens a new Change on a branch without one; none continues the active Change. `--auto` as the first word passes every gate that is ready during this run; without it only the gates `policy.gates` sets to `auto` pass, and the run stops at each `manual` gate naming the command you type.

**Artifact:** none of its own. The stage skills write theirs; the run's state is `.bdk/.machine/runs/<session>.json`, kept by the hooks and removed when you type a stage command or end the session. A gate the run passes is a `transition` with `source: policy` and your `/bdk:run` line as its command.

**When to use.** For a feature or fix you want carried end to end, with `--auto` when you accept every gate without looking, without it to stop at each one. Claude never starts it on its own.

**Related skills:** every stage skill and `/bdk:cr`, which it starts.

## Review

## /bdk:cr

**Purpose.** Review the Change on the current branch in rounds on the v3 kernel: one `reviewer` package per group of the range, an Opus `integration-reviewer` over the whole range and a `runner` for the full gate and diff coverage. It triages every finding to `blocker`, `should-fix`, `nice-to-have` or `not-a-problem`, merges the round's report, and fixes blocking entries in the next round through an `implementer` package until none is left or the Change is parked. Without an active Change it opens a review Change of the branch (`bdk change new --inferred --kind review`).

**Arguments:** `[--full] [--base <ref>] [--inline] [focus]` - the delta since the last merged review by default; `--full` reviews the whole Change; `--base <ref>` reviews from an explicit base, for stacked branches; `--inline` runs the packages in the session with no agents and fixes nothing.

**Artifact:** none of its own. Findings, triage levels and the merged report `<ticket>@merge` live in the Change's ledger.

**When to use.** At the review stage after `/bdk:execute` (`/bdk:run` starts it there), or on any branch you want reviewed.

**Related skills:** `/bdk:execute` before it, `/bdk:close` after it, `/bdk:run`, which starts it.

**Safety.** `disallowed-tools: Edit Write NotebookEdit` removes those tools for the whole turn; every fix goes through an implementer package.

## Code review beyond your own branch

`/bdk:pr-review` reviews GitHub PRs, and is stack-aware.

## /bdk:pr-review

**Purpose.** Review GitHub PRs from URLs: the `pr-reviewer` role reviews each PR in a detached worktree, against its intent and, when the range adds or changes a Change under `.bdk/changes/`, that Change's contract. You confirm or override each computed verdict before anything posts; the result lands as templated inline comments plus a summary. `--verify` checks instead whether a previous review's blocker threads were fixed.

**Arguments:** `<pr-url> [<pr-url> ...] [--verify] [focus]`

**Artifact:** none local; it keeps no ticket, ledger entry or file under `.bdk/`. The durable output is the review posted to GitHub (inline comments, one summary, one review event per PR), rendered only from `references/comment-templates.md`.

**When to use.** Reviewing one or more open GitHub PRs (your own or someone else's) before merge, or re-checking with `--verify` that requested changes were made.

**Related skills:** `/bdk:cr`, which reviews your own branch with the full process.

**Safety.** `disallowed-tools: Edit Write NotebookEdit` removes those tools mechanically; nothing is posted to GitHub until the user confirms each PR's verdict.

## Docs and decisions

Two skills produce written documentation; the diagram standard is `/bdk-craft:mermaid-drawer` of the [craft skills](#craft-skills).

## /bdk:docs

**Purpose.** Write architecture documentation for a code module, or refresh an existing document against the current code. Every document has the same shape: an overview, a file tree, Mermaid diagrams, critical rules with examples, examples in prototype code, the main components and the tests.

**Arguments:** `<code path to document | existing .md document to refresh>`

**Artifact:** With a code path, a new document at the path you name, or else `docs/architecture/<module>.md`; never under `.bdk/`. With an existing Markdown file, that file rewritten in place after you approve the update plan: accurate sections stay word for word, and the result reads as one document with no changelog or "updated on" note.

**When to use.** The user asks to explain or document code, or to update or sync docs with the code.

**Related skills:** `/bdk:adr` (records the decisions a document refers to).

## /bdk:adr

**Purpose.** Record one architecture decision as a MADR file, from a free-form description or from a `decision` entry of a BDK Change, which it reads with `bdk log show`. It asks only for the status and for what the input leaves out.

**Arguments:** `<decision context, options and choice | decision entry id L-... or <changeId>/L-...>`

**Artifact:** `docs/adr/NNNN-<slug>.md`, numbered one above the highest existing record. It commits nothing.

**When to use.** The user asks to write an ADR or to document a decision, or a decision taken in a Change needs to outlive it.

**Related skills:** `/bdk:design` (records the `decision` entries this skill can start from).

## Rules hygiene

One skill turns lessons into project rules through the kernel - see [Rules hygiene](../workflows/rules-hygiene.md).

## /bdk:rules

**Purpose.** Keep the project's rules under `.bdk/rules/` small and current. `audit` (the default) reads `bdk rules stats --entries`, groups the recurring lessons by meaning, drops what is not a rule, proposes the rest and adopts the ones you accept with `bdk rules accept`, then offers the rules `bdk rules prune` lists for removal. `capture <lesson>` records one lesson as a `learning` entry of the active Change, or, without a Change, proposes it as a rule. `check` runs `bdk rules check`. "Nothing is a rule here" is a frequent, correct output.

**Arguments:** `[audit | capture <lesson> | check]`

**Artifact:** Rule files under `.bdk/rules/`, created only by `bdk rules accept`; a removed rule stays as a tombstone with `removed: <reason>`.

**When to use.** "Add a rule", "capture this as a rule", "clean up rules", or when repeated findings should become a rule.

**Related skills:** `/bdk:cr` and the stage skills (record the `learning` and `finding` entries an audit reads).

## Other skills

## /bdk:commit

**Purpose.** Commit your own changes with a Conventional Commits message written from the staged diff. The convention comes from the project's commitlint configuration, then `CONTRIBUTING.md`, then the recent `git log`. It commits what is staged, stages the paths you name, or asks; it never passes `--no-verify` and adds no attribution.

**Arguments:** `[paths or scope to commit, e.g. 'only src/auth']`

**Artifact:** One commit. Task and review commits of a BDK Change go through `bdk commit` instead, which `/bdk:execute` and `/bdk:cr` run with the BDK trailers.

**When to use.** The user asks to commit, or for a commit message for their changes.

**Related skills:** None.

## /bdk:doctor

**Purpose.** Diagnose the BDK installation of the project with `bdk doctor`, apply the repairs that need no system change with `bdk doctor --fix`, and walk you through the rest. A `bdk` command or a `/bdk:` skill runs on your yes; a system change (an install line, a version manager) is shown for you to run yourself.

**Arguments:** None.

**Artifact:** None; the last `bdk doctor` report with what is left.

**When to use.** BDK misbehaves, a kernel command fails, or after an upgrade. Only you can start it.

**Related skills:** `/bdk:setup` (the repair for a project BDK has not prepared).

## /bdk:diagnose

**Purpose.** Analyze one session from `bdk diagnostics report`, the run journal, the ledger and bounded transcript slices, and store a cited analysis under `.bdk/.machine/diagnostics/`. It sorts each problem by where its fix belongs, records a project problem as a `learning` entry, and ends with a `## For a BDK issue` section the kernel checks for project code. It runs in a separate read-only agent.

**Arguments:** `[session-id]`; without one, the latest session of the active Change, or the latest session.

**Artifact:** `.bdk/.machine/diagnostics/<change>-<session>.md`, never committed.

**When to use.** A run failed, looped or cost more than expected. Only you can start it. See [Diagnostics](../workflows/diagnostics.md).

**Related skills:** `/bdk:doctor` (for a broken installation rather than a bad run).

## /bdk:bdk-cli

**Purpose.** Point the agent at the kernel CLI for Change state, the ledger, rules, evidence and configuration, with `bdk --help` as the only usage reference.

**Arguments:** None.

**Artifact:** None.

**When to use.** The agent needs a fact the kernel holds outside a stage skill that already names the command.

**Related skills:** None.

## Craft skills

The separate `bdk-craft` plugin ships portable engineering skills, invoked as `/bdk-craft:<name>`. Install it with `/plugin install bdk-craft@bdk`; it works without `bdk`. Each skill was measured with and without it before it was admitted (`docs/V3-EVAL-CRAFT.md` in the repository).

| Skill              | What it fixes                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `tdd`              | A red-green-refactor loop with a test list, an observed failure before every change, and a log of each gate        |
| `debugging`        | Reproduce as a failing test, rank hypotheses by evidence, bisect, fix the cause, keep the regression test          |
| `mermaid-drawer`   | Diagram type chosen by the relationship, a node budget, labelled edges, a palette legible in light and dark themes |
| `oop-design`       | Value objects, composition over inheritance, constructor injection, tell-don't-ask, strategy and state objects     |
| `api-design`       | Resource naming, the status code per outcome, problem+json errors, cursor pagination, idempotency keys             |
| `refactoring`      | Characterisation tests first, one named refactoring per step, tests green after each step                          |
| `testing-strategy` | One job per test level, mocks at owned boundaries, Test Data Builders, Page Objects, contract tests                |
| `modularizing`     | Modules by feature, one public entry each, one dependency direction, the signals to split                          |

With `bdk` installed, every implementer package has a `Craft` section that names `tdd`, and `debugging` before it on a `bug` Change, with `bdk ctx craft <name>` to print each one. [Debugging](../workflows/debugging.md) shows the flow.

## Role skills

The skills under `skills/roles/` and `swarm` carry `user-invocable: false` and are never typed as `/bdk:<name>`. A role skill is the contract of one role (implementer, simplifier, verifier, design-verifier, reviewer, integration-reviewer, pr-reviewer, runner, scout, lead): what the agent reads, does, writes and returns. A dispatch package embeds its role's section, and the [agents](agents.md) run it. `swarm` holds how an orchestrator dispatches packages and waits for their agents. BDK 3 removed the eight `bdk-*` meta-skills that BDK 2 preloaded into agents; see [Context](../concepts/context.md#dispatch-packages) for how an agent gets its context now.

The v2 skills BDK 3 removed, and what replaced each, are on [Migration from v2](../getting-started/migration-from-v2.md#skills).
