# Skills

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

!!! note "BDK 3"

    [Stage skills](#stage-skills) describes BDK 3.

Every skill is invoked as `/bdk:<name>`. This page lists one section per user-invocable skill - purpose, arguments, the artifact it writes, when to reach for it, and the skills it works with. Skills whose frontmatter carries `user-invocable: false` are meta-skills: they are preloaded into agents via `skills:` frontmatter and are never typed as a slash command, so they get one collective paragraph near the end instead of individual sections.

For the deeper "why" behind the pipeline these skills form, see the [tier table](../index.md#how-you-work-with-it), [The full pipeline](../workflows/full-pipeline.md), and [Plan pipeline](../concepts/plan-pipeline.md).

## Stage skills

BDK 3 works in Changes: one unit of work on one branch, whose intent, design, plan, ledger and progress the kernel keeps. A stage skill runs one step of a Change and ends by naming the command to type next; you type it, so every stage starts from your decision. `/bdk:run` types them for you, one stage after another, and stops where a gate needs you. Stage skills write only through kernel commands (`bdk ...`) and follow a kernel refusal's `instead` rather than working around it.

## /bdk:setup

**Purpose.** Bring a project to a working BDK layout: `.bdk/settings.yaml` with the project's languages and its test, lint and build commands (detected from the project files and confirmed with you), Lavish, your hand-written `.claude/rules/` as BDK rules, and the migration of a BDK 2 project. Settings are written only with `bdk config set`, which validates every value. See [Project setup](../getting-started/setup.md).

**Arguments:** `[what to change, e.g. 'add the e2e suite']` - with none, the whole setup; with a request, only that.

**Artifact:** `.bdk/settings.yaml` (tracked), `.bdk/rules/` when rules were imported, `.bdk/.machine/` (ignored). A v2 project's `.bdk/settings.json`, `plans/`, `design/`, `runs/` and `verify-plan/` are deleted after you confirm.

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

**Related skills:** `/bdk:change` before it, `/bdk:verify-design` inside it, `/bdk:plan` after the gate, `/bdk:mermaid-drawer` for its diagrams.

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

**Related skills:** `/bdk:design` or `/bdk:change` before it, `/bdk:verify-plan` inside it, `/bdk:debug`, which hands a large fix to a `bug` Change.

## /bdk:verify-plan

**Purpose.** Check the plan of the active Change against the code and the design on a fresh context: one `verifier` agent that knows only its dispatch package reads every plan part together with the design documents and the spec deltas. Besides each task's claims about the code, it checks that every stated behaviour has a test case, that the plan covers the design, and that parts declare the dependencies between them. It blocks only on the categories of `policy.verifier.blocking-categories`. A passing verdict marks the `plan-verify` node done; an edit to a plan part, a spec delta or the design afterwards makes it stale.

**Arguments:** none.

**Artifact:** a ticket under `attempts/`, the verifier's package under `dispatch/` and report under `reports/`, and its `report`, `blocker` and `finding` entries under `log/`, all in `.bdk/changes/<changeId>/`.

**When to use.** `/bdk:plan` runs it after writing the plan; run it yourself after editing a plan part by hand. It refuses while a plan part is not done.

**Related skills:** `/bdk:plan`, which starts it and acts on its verdict.

## /bdk:execute

**Purpose.** Build the verified plan of the active Change through role agents. It loops on `bdk next` and runs every ready plan part in the mode the kernel marks: `flat`, where the main session dispatches each task as one ticket (implementer, then the post-task steps simplify, scoped tests and lint), or `tree`, where one `lead` agent runs each part of a `large` Change with at least two independent parts ready. `bdk config set execution.tree.enabled false` runs every part flat, and `execution.tree.min-parts` (2 to 15) sets how many ready parts a tree needs. Each task ends as one commit with its `BDK-Change`, `BDK-Part` and `BDK-Task` trailers; the kernel decides retries, the narrower scope and escalation to a stronger model. One `/bdk:execute` runs every ready part, then marks the spec deltas done and reruns the steps of a part a later part changed. It never edits a file or runs a test itself, and asks you only about a critical finding the plan and the design do not settle.

**Arguments:** none.

**Artifact:** task commits in the project, and in `.bdk/changes/<changeId>/` the tickets under `attempts/`, the dispatch packages under `dispatch/`, the agents' reports under `reports/`, the evidence under `evidence/` and the entries under `log/`.

**When to use.** After `/bdk:plan` has verified the plan. When the plan is not done it dispatches nothing and names `/bdk:plan`. It ends with a report of the parts, the tasks committed, the open findings and the gate items, naming `/bdk:cr`, which you type. Claude starts it only inside a `/bdk:run` of your session.

**Related skills:** `/bdk:plan` before it, `/bdk:cr` after it.

## /bdk:close

**Purpose.** Close the reviewed Change. It checks the close with `bdk change close --dry-run` and stops on what the kernel refuses (an open ticket, a spec conflict), regenerates `.claude/rules/bdk-generated*.md` when the project's rules changed, then runs `bdk change close`: the spec deltas are merged into `.bdk/specs/`, the Change is archived under `.bdk/changes/archive/<changeId>/` and committed as `chore(bdk): close <changeId>`. It ends with the PR summary from the ledger (intent, decisions, assumptions, risks, open findings, merged capabilities), the gates passed by policy rather than by you, and the regenerated rule files for you to commit. It asks nothing, edits no file and opens no PR: publishing the PR is your step.

**Arguments:** none.

**Artifact:** `.bdk/changes/archive/<changeId>/`, the merged `.bdk/specs/`, the close commit, and the regenerated rule projection when the rules changed.

**When to use.** After `/bdk:cr`, when the review gate is ready; typing `/bdk:close` passes it. Claude starts it only inside a `/bdk:run` of your session.

**Related skills:** `/bdk:cr` before it, `/bdk:run`, which can end with it.

## /bdk:run

**Purpose.** Carry a Change through its stages without typing each command. It loops on `bdk next` and starts the stage skill the kernel names (`/bdk:change` with your intent, then `/bdk:design`, `/bdk:plan`, `/bdk:execute` and `/bdk:close`), each with its own instructions and tools. While it runs nobody answers questions: the skills take the option they recommend, and each choice becomes a `decision` entry with `review: true`, shown at the next gate and in the PR summary. It stops when a gate needs you, when the Change is parked, when a stage reports a refusal it could not resolve, at the review stage (it names `/bdk:cr`, which you type; a later Change lets it start the review), and after the close. It prints one line per stage and the full status only at the stop.

**Arguments:** `[--auto] ["<intent>"]` - an intent opens a new Change on a branch without one; none continues the active Change. `--auto` as the first word passes every gate that is ready during this run; without it only the gates `policy.gates` sets to `auto` pass, and the run stops at each `manual` gate naming the command you type.

**Artifact:** none of its own. The stage skills write theirs; the run's state is `.bdk/.machine/runs/<session>.json`, kept by the hooks and removed when you type a stage command or end the session. A gate the run passes is a `transition` with `source: policy` and your `/bdk:run` line as its command.

**When to use.** For a feature or fix you want carried end to end, with `--auto` when you accept every gate without looking, without it to stop at each one. Claude never starts it on its own.

**Related skills:** every stage skill, which it starts; `/bdk:cr`, which you type at the review stage.

## Review

`/bdk:cr` is still the BDK 2 reviewer; a later v3 Change moves it onto the review stage of a Change.

## /bdk:cr

**Purpose.** Dynamic code review orchestrator: determines what changed, dispatches specialized `bdk:code-reviewer` subagents in parallel (3-13, scaled to change size), and merges their findings into one report. Delta (only commits since the last review) by default.

**Arguments:** `[--full] [--inline] [--base <ref>] [focus]` - `--full` reviews the whole branch (always do this before opening a PR, since a delta pass cannot see a later commit breaking an earlier, already-reviewed one); `--inline` runs every cohort in-session with no subagents; `--base <ref>` reviews against an explicit base, for stacked branches.

**Artifact:** `.bdk/cr/{stamp}-{branch-slug}-{delta|full}.md`, where `stamp=$(git log -1 --format=%cd --date=format:%Y-%m-%d-%H%M)` - the reviewed head's own commit date, so re-running on an unchanged head overwrites rather than accumulates.

**When to use.** After `/bdk:execute` finishes a Change, or as the closing step of the trivial tier via `--inline`. Always run `--full` before opening a PR.

**Related skills:** `/bdk:execute` (previous pipeline stage), `/bdk:pr-review` (each of its per-PR subagents runs `/bdk:cr --inline`).

**Safety.** `disallowed-tools: Edit NotebookEdit` in this skill's frontmatter removes those tools from the pool for the whole turn, so "review only" is enforced mechanically rather than by instruction; `Write` is scoped to `Write(.bdk/cr/**)` only.

## Code review beyond your own branch

`/bdk:pr-review` extends the same reviewing logic to GitHub PRs, and is stack-aware.

## /bdk:pr-review

**Purpose.** Review GitHub PRs from URLs: one subagent per PR runs `/bdk:cr --inline`, and the orchestrator lands the result as templated inline comments plus a summary ending in an explicit verdict, which you confirm or override before anything posts. `--verify` runs a follow-up pass instead, checking whether a previous review's comments were implemented.

**Arguments:** `<pr-url> [<pr-url> ...] [--verify] [focus]`

**Artifact:** No local documentation file. Each PR gets a scratch working directory via `mktemp -d -t "bdk-pr-{number}"`; the durable output is what gets posted to GitHub (inline comments, one summary comment, one review event per PR), rendered only from `references/comment-templates.md`.

**When to use.** Reviewing one or more open GitHub PRs (your own or someone else's) before merge, or re-checking with `--verify` that requested changes were made.

**Related skills:** `/bdk:cr` (invoked in `--inline` mode by each per-PR subagent).

**Safety.** `disallowed-tools: Edit Write NotebookEdit` in this skill's frontmatter removes those tools mechanically; nothing is posted to GitHub until the user confirms each PR's verdict in the terminal report.

## Debugging

## /bdk:debug

**Purpose.** Debug issues through structured investigation, failing-test creation, and a targeted fix - or a hand-off to planning when the fix is too large for an inline patch. Runs its phases strictly in order, announcing each one (`[debug] Phase 2: Investigate`).

**Arguments:** `[error message, traceback, or steps to reproduce]`

**Artifact:** None fixed. A HIGH-risk finding (affects many call sites, introduces new architecture) routes to Phase 5b: a hand-off text for a `bug` Change, with the failing test paths as acceptance criteria, which you pass to `/bdk:change` before typing `/bdk:plan`. A LOW/MEDIUM-risk finding is fixed in place instead.

**When to use.** The user supplies an error message, a traceback, steps to reproduce, or describes unexpected behavior.

**Related skills:** `/bdk:change` and `/bdk:plan` (hand-off targets for HIGH-risk fixes).

## Docs and decisions

Four skills produce or refresh written documentation, all sharing the same Mermaid standard.

## /bdk:create-adr

**Purpose.** Create Architecture Decision Records following the MADR template.

**Arguments:** `[decision context, options, constraints, preferences]`

**Artifact:** `docs/adr/NNNN-{slugified-title}.md`. Scans `docs/adr/` for existing `NNNN-*.md` files to pick the next number.

**When to use.** The user asks to "create an ADR", "document a decision", "write an ADR", or supplies decision context that needs formalizing.

**Related skills:** `/bdk:mermaid-drawer` (used for any diagrams the ADR embeds).

## /bdk:explain-complex-code

**Purpose.** Generate comprehensive architecture documentation for a complex code module, with Mermaid diagrams and examples.

**Arguments:** `[path]`

**Artifact:** `.bdk/explain-complex-code/[feature-name].md`. A `Stop` hook verifies completeness before the skill can finish: an Overview, a Core Architecture section with a file tree, at least one fenced ` ```mermaid ` block, a Critical Rules section with examples, Live Examples using prototype (not real) code, a Core Classes section, and a Testing Coverage section.

**When to use.** The user asks to "explain this code", "document the architecture", or wants to understand how a module or system works.

**Related skills:** `/bdk:mermaid-drawer` (diagram standard), `/bdk:update-docs` (refreshes what this skill produces, later).

## /bdk:update-docs

**Purpose.** Refresh existing architecture documentation by comparing it against current code, merging updates while preserving accurate manual prose. The result reads as uniform text - no changelog markers, no diff markers, no "updated on" annotations.

**Arguments:** `[doc_path]`

**Artifact:** Saved to the same path as the input `$ARGUMENTS` (the existing `doc_path`), overwriting it. The same `Stop` hook completeness checks as `/bdk:explain-complex-code` apply, plus the uniform-text requirement.

**When to use.** Existing architecture documentation needs refreshing after code changes, for periodic doc maintenance, or when the user asks to "update docs", "refresh documentation", or "sync docs with code".

**Related skills:** `/bdk:explain-complex-code` (produces the doc this refreshes), `/bdk:mermaid-drawer`.

## /bdk:mermaid-drawer

**Purpose.** BDK's shared Mermaid standard: diagram type selection, a node budget, and a palette verified legible in both light and dark themes. Every BDK skill that emits a diagram goes through this standard so diagrams read the same regardless of who drew them or where they are viewed.

**Arguments:** `[what to draw]`

**Artifact:** None of its own - it is a drawing standard invoked by whichever skill needs a diagram; the diagram lands in that caller's own output.

**When to use.** Whenever writing a Mermaid block, or when asked to diagram, visualize, or map a flow, architecture, or state machine.

**Related skills:** `/bdk:design`, `/bdk:create-adr`, `/bdk:explain-complex-code`, `/bdk:update-docs` (all invoke it for their diagrams).

## Rules hygiene

Two skills keep `.claude/rules/` accurate instead of letting it accrete into a changelog - see [Rules hygiene](../workflows/rules-hygiene.md).

## /bdk:add-rule

**Purpose.** Capture one lesson or convention as a properly-homed rule - routed to `.claude/rules/`, a doc comment, or a test signpost - deduplicating against existing rules and respecting file budgets. "Nothing is a rule here" is a frequent, correct output: the skill is designed to say so rather than write something just to have written something.

**Arguments:** `[lesson or convention to capture]`

**Artifact:** Routes the distilled lesson, in priority order, to: the narrowest-scoped existing `.claude/rules/<file>.md` that already covers the constraint (sharpened in place, never duplicated); the narrowest new/target rule file under budget; a skill; a doc comment; or nothing. If the chosen target file is over its budget (checked via `python3 ${CLAUDE_PLUGIN_ROOT}/skills/refine-rules/scripts/lint_rules.py`), the candidate goes to `.claude/rules/_inbox.md` instead, with a recommendation to run `/bdk:refine-rules`. Content that fails admission never goes to `docs/`.

**When to use.** "Add a rule", "capture this as a rule", "remember this convention".

**Related skills:** `/bdk:refine-rules` (its write-side counterpart; also the skill `/bdk:add-rule` recommends when a target file is over budget).

## /bdk:refine-rules

**Purpose.** Compact and verify `.claude/rules/*.md` against real code: an admission test, relocation of stale content into doc comments, budget enforcement, and one uniform format across every file. Treats every existing sentence in a rule file as an unverified claim, not a fact, until it is checked against the code it describes.

**Arguments:** `[rules-dir]` (defaults to `.claude/rules`)

**Artifact:** Rewrites the target `.claude/rules/*.md` files in place - no new file is created. Uses `scripts/list_rule_files.py` for discovery (`frontmatter_paths`, `headings`, `line_count`, `char_count` per file) and `scripts/lint_rules.py` for a budget/narrative-marker baseline.

**When to use.** "Clean up rules", "refine .claude/rules", or when rule files have gone stale or bloated. Also invoked standalone by `/bdk:add-rule` when its target file is over budget.

**Related skills:** `/bdk:add-rule` (its read/write counterpart).

## Other skills

## /bdk:commit

**Purpose.** Generate a conventional commit message from the current git changes. The skill body is a one-line delegation: `Invoke /caveman:caveman-commit $ARGUMENTS`. A `UserPromptSubmit` hook checks that the `caveman-commit` skill exists before the delegation runs.

**Arguments:** `[scope] (e.g. 'from main', 'only src/foo.py')`

**Artifact:** None - produces a commit message, does not run `git commit` itself.

**When to use.** Whenever a conventional-commit-format message is wanted for staged or unstaged changes.

**Related skills:** None within BDK; depends on the separate `caveman` plugin's `caveman-commit` skill being installed.

## /bdk:test-driven-development

**Purpose.** Rigid, gated TDD process: receives test-case bullet points and an implementation spec, writes one test per bullet, and enforces the red (all fail) then green (implementation makes them pass) cycle in strict gate order, with no skipping.

**Arguments:** None declared in frontmatter.

**Artifact:** None fixed - it writes the test files the task at hand requires, as part of the red-green cycle; it does not produce a separate report.

**When to use.** Implementing any feature or bugfix, wherever test cases have already been broken into bullet points (typically by `/bdk:plan`).

**Related skills:** `/bdk:plan` (source of the test cases), `/bdk:execute` (its implementer packages carry the same red-green process).

## Meta-skills

Eight skills carry `user-invocable: false` and are never typed as `/bdk:<name>` - they exist to be preloaded into agents via `skills:` frontmatter, resolving at preload time through their `bdk ctx skill` context line so a fresh subagent gets the same rule guidance the orchestrator gets. `bdk-implementer-return-contract` carries the shared YAML return-contract schema used by the `bdk:implementer` and `bdk:fixer` agents. `bdk-lint-tools` and `bdk-test-tools` surface this project's configured lint/format/typecheck and test commands from `.bdk/settings.yaml`, falling back to on-the-fly detection with a warning when none are configured. `bdk-rules-architecture`, `bdk-rules-code-quality`, `bdk-rules-design-patterns`, and `bdk-rules-security` each carry one language-agnostic quality-rule category; `bdk-rules-languages` carries the project's language-specific rule sheets. See [Shared foundation](../concepts/shared-foundation.md) for how this injection fits into a session.

## Removed skills

Claude Code removed the `TaskCreate` / `TaskUpdate` / `TaskList` tools, which several skills used as their only state mechanism. Those skills are gone rather than patched:

| Removed                                           | Use instead                                                                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:execute-plan`, `/bdk:subagent-execute-plan` | `/bdk:execute`                                                                                                                                                                                      |
| `/bdk:save-progress`, `/bdk:restore-progress`     | Nothing to invoke. The Change's ledger and the task commits' trailers hold the state; `/bdk:execute` resumes from `bdk next`                                                                        |
| `/bdk:create-tasks`, `/bdk:refactor`              | `/bdk:plan`                                                                                                                                                                                         |
| `/bdk:audit-prompt`                               | Nothing                                                                                                                                                                                             |
| `/bdk:graphviz-docs-compiler`                     | Nothing to invoke. Mermaid diagrams render natively wherever the doc is viewed - `/bdk:explain-complex-code`, `/bdk:update-docs`, and `/bdk:create-adr` now embed Mermaid directly, no compile step |
| `/bdk:brainstorming`                              | `/bdk:design`                                                                                                                                                                                       |
| `/bdk:brainstorm-architecture`                    | `/bdk:design`                                                                                                                                                                                       |
