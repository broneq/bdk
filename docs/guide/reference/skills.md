# Skills

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

Every skill is invoked as `/bdk:<name>`. This page lists one section per user-invocable skill - purpose, arguments, the artifact it writes, when to reach for it, and the skills it works with. Skills whose frontmatter carries `user-invocable: false` are meta-skills: they are preloaded into agents via `skills:` frontmatter and are never typed as a slash command, so they get one collective paragraph near the end instead of individual sections.

For the deeper "why" behind the pipeline these skills form, see the [tier table](../index.md#how-you-work-with-it), [The full pipeline](../workflows/full-pipeline.md), and [Plan pipeline](../concepts/plan-pipeline.md).

## Pipeline skills

These five skills form the full-tier chain: `/bdk:design` -> `/bdk:create-plan` -> `/bdk:verify-plan` -> `/bdk:subagent-execute-plan` -> `/bdk:cr`. Each stage's output is a file the next stage reads, so any stage can start in a fresh session - see [The full pipeline](../workflows/full-pipeline.md).

## /bdk:design

**Purpose.** Design partner for any feature: classifies the request as product, architecture, or combined, then explores two or more approaches with Mermaid diagrams, self-critique, and a "what we did NOT decide" section. Per its own description, it replaces the retired `/bdk:brainstorming` and `/bdk:brainstorm-architecture` skills.

**Arguments:** `[feature or capability]`

**Artifact:** `.bdk/design/<ts>-<slug>-design.md` (file name format `YYYY-MM-DD-HHMM-<slug>-design.md`), written from the design template in Phase 4 - Write.

**When to use.** A new feature, an architecture or schema change, or any request where the shape of the solution is not yet obvious - the point where getting it wrong costs weeks. Not for clear-scope, few-file changes; those start at `/bdk:create-plan` directly.

**Related skills:** `/bdk:create-plan` (consumes the design doc), `/bdk:mermaid-drawer` (draws its diagrams).

## /bdk:create-plan

**Purpose.** Create a comprehensive, TDD-driven implementation plan through structured exploration and trade-off analysis.

**Arguments:** `[feature description or design doc path]`

**Artifact:** `.bdk/plans/<timestamp>-<slug>.md`. On a filename collision it appends `-v2`, `-v3`, ... (lowest free integer). The `.bdk/plans/` directory is pre-created by the skill's own `UserPromptSubmit` hook (`mkdir -p .bdk/plans`). Phase 6 scans `.bdk/design/` for a matching design doc by slug keywords before writing.

**When to use.** Any full- or standard-tier change: a clear scope with several files, or the required second stage after `/bdk:design` for ambiguous/architectural scope.

**Related skills:** `/bdk:design` (optional upstream source), `/bdk:verify-plan` (downstream consumer), `/bdk:test-driven-development` (consumes the plan's test-case bullets during execution).

## /bdk:verify-plan

**Purpose.** Verify an implementation plan against real code before execution, using a single Opus subagent (`bdk:plan-verifier`) driven by a structured six-section checklist, returning a YAML verdict envelope.

**Arguments:** `[plan-file]`

**Artifact:** `.bdk/verify-plan/<plan-slug>-verification.md`, rendered from `references/verdict-template.md`. The header carries `plan_sha256`, computed via `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py hash-plan <plan-path>` - a hash over the plan file's bytes, so it identifies exactly the plan version that was verified.

**When to use.** Any time there is a written plan (from `/bdk:create-plan` or written by hand) and you want it checked against the real codebase before writing code - always before a full-tier execution.

**Related skills:** `/bdk:create-plan` (produces the input), `/bdk:subagent-execute-plan` (re-hashes the plan at its Step 0 and compares against this stamp; a mismatch means the plan was edited after verification).

## /bdk:subagent-execute-plan

**Purpose.** Coordinator that executes a plan in parallel groups via background subagents: spawns implementers, then dedicated test-runner / static-analyse subagents, then routes failures back to the original implementer (via `SendMessage`) or a fresh fixer. Fully autonomous - no human-in-the-loop (`disallowed-tools: AskUserQuestion`). The coordinator itself never edits files, runs tests, or reads source code; subagents do all of that.

**Arguments:** `[plan-path]`

**Artifact:** A run manifest at `.bdk/runs/<run-id>.json` - a resume cache, not the source of truth. The durable ground truth is git commit trailers (`BDK-Run:`, `BDK-Group:`), one commit per completed group. Both are mediated exclusively by `scripts/bdk_run_state.py`; on disagreement, git wins and the manifest is corrected.

**When to use.** After a plan has passed (or been deliberately run without) `/bdk:verify-plan`, to execute it task-by-task without manual supervision. Two plans that touch the same files need separate git worktrees - see [The full pipeline](../workflows/full-pipeline.md).

**Related skills:** `/bdk:verify-plan` (precondition), `/bdk:cr` (the step after execution finishes), `/bdk:test-driven-development` (preloaded into the `bdk:implementer` agent this skill spawns).

## /bdk:cr

**Purpose.** Dynamic code review orchestrator: determines what changed, dispatches specialized `bdk:code-reviewer` subagents in parallel (3-13, scaled to change size), and merges their findings into one report. Delta (only commits since the last review) by default.

**Arguments:** `[--full] [--inline] [--base <ref>] [focus]` - `--full` reviews the whole branch (always do this before opening a PR, since a delta pass cannot see a later commit breaking an earlier, already-reviewed one); `--inline` runs every cohort in-session with no subagents; `--base <ref>` reviews against an explicit base, for stacked branches.

**Artifact:** `.bdk/cr/{stamp}-{branch-slug}-{delta|full}.md`, where `stamp=$(git log -1 --format=%cd --date=format:%Y-%m-%d-%H%M)` - the reviewed head's own commit date, so re-running on an unchanged head overwrites rather than accumulates.

**When to use.** After `/bdk:subagent-execute-plan` finishes a plan (full-tier and standard-tier), or as the closing step of the trivial tier via `--inline`. Always run `--full` before opening a PR.

**Related skills:** `/bdk:subagent-execute-plan` (previous pipeline stage), `/bdk:pr-review` (each of its per-PR subagents runs `/bdk:cr --inline`).

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

**Artifact:** None fixed. A HIGH-risk finding (affects many call sites, introduces new architecture) routes to Phase 5b: hand off to `/bdk:create-plan`, passing the failing test paths as acceptance criteria, printing `[debug] Routing to /bdk:create-plan`. A LOW/MEDIUM-risk finding is fixed in place instead.

**When to use.** The user supplies an error message, a traceback, steps to reproduce, or describes unexpected behavior.

**Related skills:** `/bdk:create-plan` (hand-off target for HIGH-risk fixes).

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

## Setup and other

## /bdk:setup

**Purpose.** Initialize `.bdk/settings.json` for a project: probes project files to detect languages, test commands, lint commands, and build commands, then confirms every value with the user before writing.

**Arguments:** `[--force to re-run even if settings exist]`

**Artifact:** `.bdk/settings.json`, plus the `.bdk/plans/` and `.bdk/design/` directories it creates.

**When to use.** Once per project, before using any other BDK skill - the SessionStart hook blocks a session until this has run.

**Related skills:** None - it is the prerequisite every other skill assumes has already run.

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

**When to use.** Implementing any feature or bugfix, wherever test cases have already been broken into bullet points (typically by `/bdk:create-plan`).

**Related skills:** `/bdk:create-plan` (source of the test-case bullets), `/bdk:subagent-execute-plan` (its `bdk:implementer` agent preloads this skill via `skills:` frontmatter so subagents get the same red-green process).

## Meta-skills

Eight skills carry `user-invocable: false` and are never typed as `/bdk:<name>` - they exist to be preloaded into agents via `skills:` frontmatter, resolving at preload time through their `bdk ctx skill` context line so a fresh subagent gets the same rule guidance the orchestrator gets. `bdk-implementer-return-contract` carries the shared YAML return-contract schema used by the `bdk:implementer` and `bdk:fixer` agents. `bdk-lint-tools` and `bdk-test-tools` surface this project's configured lint/format/typecheck and test commands from `.bdk/settings.yaml`, falling back to on-the-fly detection with a warning when none are configured. `bdk-rules-architecture`, `bdk-rules-code-quality`, `bdk-rules-design-patterns`, and `bdk-rules-security` each carry one language-agnostic quality-rule category; `bdk-rules-languages` carries the project's language-specific rule sheets. See [Shared foundation](../concepts/shared-foundation.md) for how this injection fits into a session.

## Removed skills

Claude Code removed the `TaskCreate` / `TaskUpdate` / `TaskList` tools, which several skills used as their only state mechanism. Those skills are gone rather than patched:

| Removed                                       | Use instead                                                                                                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:execute-plan`                           | `/bdk:subagent-execute-plan`                                                                                                                                                                        |
| `/bdk:save-progress`, `/bdk:restore-progress` | Nothing to invoke. `/bdk:subagent-execute-plan` checkpoints itself to a run manifest plus git commit trailers and resumes automatically; `--force` takes a run over from a dead session             |
| `/bdk:create-tasks`, `/bdk:refactor`          | `/bdk:create-plan`                                                                                                                                                                                  |
| `/bdk:audit-prompt`                           | Nothing                                                                                                                                                                                             |
| `/bdk:graphviz-docs-compiler`                 | Nothing to invoke. Mermaid diagrams render natively wherever the doc is viewed - `/bdk:explain-complex-code`, `/bdk:update-docs`, and `/bdk:create-adr` now embed Mermaid directly, no compile step |
| `/bdk:brainstorming`                          | `/bdk:design`                                                                                                                                                                                       |
| `/bdk:brainstorm-architecture`                | `/bdk:design`                                                                                                                                                                                       |
