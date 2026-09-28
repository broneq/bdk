# BDK — Broneq Dev Kit

A personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks into a single installable unit.

**Core design principle**: Language-agnostic by default. Skills contain workflow logic only; environment discovery is delegated to `STARTUP_INSTRUCTIONS.md` and the local project's `CLAUDE.md`.

---

## Installation

**From GitHub directly (recommended until marketplace listing is live):**

1. Add the BDK marketplace source:
   ```
   /plugin marketplace add broneq/bdk
   ```
2. Install:
   ```
   /plugin install bdk@bdk
   ```

### Code tools

BDK ships no MCP server and starts no background process. Skills and agents explore, search and trace code with Claude Code's built-in tools (`Grep`, `Glob`, `Read`, `Bash`), so nothing beyond Claude Code needs installing, and BDK adds no tool-guidance layer on top of them. The reasoning is in `docs/adr/0001-remove-bundled-mcp-servers.md`.

If you want a semantic code-navigation or code-graph MCP server, configure it yourself at user or project level with `claude mcp add`. BDK neither depends on it nor tells its agents to call it.

### Settings

A project keeps its settings in `.bdk/settings.yaml`, which `/bdk:setup` writes. Its first line is a `yaml-language-server` modeline pointing at the versioned JSON Schema (`schema/settings.json`), so an IDE with the YAML extension completes and validates keys. Four layers merge, lowest first: the plugin defaults, your global file (`$XDG_CONFIG_HOME/bdk/settings.yaml`, else `~/.config/bdk/settings.yaml`; `%APPDATA%\bdk\settings.yaml` on Windows), the project's `.bdk/settings.yaml` and a personal, uncommitted `.bdk/settings.local.yaml`. Maps merge deeply, lists of entries with an `id` merge by `id`, the glob lists of `policy.evidence` only grow (a layer appends, the defaults stay), other lists are replaced whole.

The kernel reads the settings; skills and scripts ask it. Skills need Node >= 22.13.

| Command                                             | What it does                                                                                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node "$BDK/dist/bdk.mjs" config show [<key>]`      | Prints the merged value as YAML (`--json` for JSON, `--origins` for the layers).                                                                        |
| `node "$BDK/dist/bdk.mjs" config check`             | Validates every layer and refreshes `.bdk/.machine/config/resolved.yaml`.                                                                               |
| `node "$BDK/dist/bdk.mjs" config set <key> <value>` | Edits `.bdk/settings.yaml` (`--global`, `--local` for the other files), comments kept. Adds the two BDK lines to `.gitignore` when no rule covers them. |
| `node "$BDK/dist/bdk.mjs" config schema [<module>]` | Prints the JSON Schema; `--url` prints the modeline URL.                                                                                                |

`$BDK` is the plugin directory. `features.lavish` (default `true`) turns on decision points in the browser through `lavish-axi` when it is installed. A key BDK does not declare is refused, with a "did you mean" hint or, for a key earlier versions wrote (`test-tools`, `quality`, `features.caveman`, the MCP flags), the key that replaces it or why it is gone. The one `SessionStart` hook (`bdk hooks session-start`) prints the shared foundation and, in a BDK project, one line per settings problem; it never blocks.

The `policy` keys bound the workflow, each subtree read by its own part of the kernel: `policy.gates.design` and `policy.gates.review` (`manual` or `auto`), `policy.budgets` (tickets per loop and round: `task-redispatch` 3, `verify-fix` 2, `review-fix` 2, `verifier` 2, and 3 consecutive `not-run` closes), `policy.oscillation.threshold` (2 failed attempts with the same finding end the retries early), `policy.escalation` (`enabled` true, `model` `opus`, at most `per-change` 3 escalation tickets per Change) `policy.checkpoint.enabled` (true: the kernel commits the Change directory when it parks or escalates) and `policy.verifier` (`blocking-categories`, the only categories a verifier may block on, and `not-a-fail`, what it must never block on; each item an `id` and a `description`, merged by `id`, so a project adds or rewords a category but the default items always stay) and `policy.evidence` (`non-executable` globs whose changes never make evidence stale, `build-config` globs that always count as source, and `max-committed-bytes`, 65 536: a smaller text evidence file is committed, the rest stays in `.bdk/.machine`). `bdk config show policy` prints them all with their defaults. `execution.concurrency` (1 to 15, default 5) caps how many role agents of one wave run at once. `spec.normative-word` (default `SHALL`) is the word every requirement of a spec delta must state, and `archive.keep-evidence` (default `false`) keeps the full `dispatch/` and `reports/` bodies when a Change closes instead of pruning them to a hash index.

A skill gets everything that depends on the settings (rule sets, language rules, the decision fragment, the configured tool commands, shared reference files) from `node "$BDK/dist/bdk.mjs" ctx skill <name>`, called by two context lines at the top of its body: a `!` line Claude Code runs at load time, and a fallback sentence that makes the model run the same command when the host did not. Fragments are prompt values like rule sets (`fragments/decision/lavish`, `fragments/decision/ask-user`), so a project extends or replaces them the same way. `.bdk/settings.json` from BDK 2 is not read; `bdk import` (planned) converts it.

### Change state

The kernel keeps each Change in `.bdk/changes/<id>/`, which is committed: `change.md` holds the intent and the starting profile, `log/` holds one file per ledger entry, so two branches of one Change merge without conflicts. `bdk change new | status | list | resume | park` open, inspect, park and rebind a Change (`status` also lists the plan parts as `part list` does); `bdk change checkpoint` commits the Change directory alone as `chore(bdk): checkpoint <id>`, leaving anything the user staged out, and `park` and the escalation ladder run the same checkpoint (`policy.checkpoint.enabled`), reporting a skip instead of failing; `bdk change takeover --close-tickets` takes over a Change whose previous session died with tickets open, closing them as `not-run` (budgets stay) and rebuilding the index; `bdk log add | ingest | list | show | resolve` write and read the ledger; `bdk measure [<range>]` reports diff signals (files, lines, modules); `bdk query "<select>"` runs read-only SQL over the index. Every command takes `--json`.

What each machine derives stays out of git under `.bdk/.machine/`: the SQLite index `index.sqlite`, a cache rebuilt from the committed files whenever it is missing or stale, and the branch markers that bind a local branch to its Change. `bdk rebuild` is the repair path behind every exit 4: it migrates older documents, rebuilds the index from the committed files, regenerates `plan/index.md` and `design/index.md`, and checks the `BDK-*` commit trailers against the plan and the attempt records, reporting a disagreement as `state/trailer-mismatch` instead of hiding it. On a fresh clone, `bdk change resume <id>` binds the branch and `bdk rebuild` follows; `--all` widens the rebuild to every Change. `change new` and `config set` add exactly `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore` when no rule covers them; `.bdk/` as a whole is never ignored.

### Artifact graph

Which artifact a Change needs next is decided by the kernel, not by a skill. `pipeline/pipeline.yaml` in the plugin declares the stages (`intent`, `design`, `plan`, `execute`, `review`, `close`, each with the command that enters it) and the nodes: `intent`, `design` or `design-parts` plus `design-index`, `architecture`, `gate:design`, `plan` (one node per plan part), `plan-verify`, `execute`, `spec-delta`, `review`, `gate:review` and `close`. Its modeline points at `schema/pipeline.json`. The profile and the Change kind choose the variant: `tiny` and `bug` go from `intent` to `plan`, `large` splits the design into parts. A node is `blocked`, `ready`, `done`, `stale` (its files changed after it was marked done) or `skipped`.

| Command                                          | What it does                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node "$BDK/dist/bdk.mjs" next`                  | Prints the instruction for the next artifact: template, paths to write, rule sets, relevant ledger entries. Or says the Change waits for a gate or the user. |
| `node "$BDK/dist/bdk.mjs" explain <artifact>`    | Explains a node's state through its chain of requirements, with both hashes of a stale node.                                                                 |
| `node "$BDK/dist/bdk.mjs" validate [<artifact>]` | Runs the node's checks and prints the current input hash; writes nothing.                                                                                    |
| `node "$BDK/dist/bdk.mjs" done <artifact>`       | Marks a node done after its checks pass and records the hash in a `transition` entry; the only way an artifact becomes done.                                 |

A gate is never marked done by a command: it opens only on a `transition` entry with `source: user` (or `source: policy` when `policy.gates.design` or `policy.gates.review` is `auto`; both default to `manual`), written after its requirements were done. `change status` lists every node and gate, and which gates the user or the policy passed. Each artifact kind has a template, the prompt value `pipeline/<kind>`, so a project extends or replaces it in `.bdk/prompts/pipeline/<kind>.md` like any other prompt.

### Plan parts

A plan is split into parts, `plan/parts/<nn>-<slug>.md`, each small enough for one dispatch. The frontmatter holds the goal, the success measure, `do-not-touch` globs, `depends-on` and `spec-impact`; the body holds the tasks, each a level-2 heading `## <nn>-<k> <title>` followed by bold labels:

```markdown
## 02-3 Reject an expired link

**Files:**

- Modify: `src/auth/login.ts`
- Test: `src/auth/login.test.ts`

**Test cases:**

- an expired link answers 401

**Depends on:** 02-2
```

`**Files:**` is required; a task needs `**Test cases:**` or `**Verification:** none`; `**Depends on:**` and `**Stop rule:**` are optional. `validate`, `done plan` and `part start` check every part: at most 8 192 bytes, 1 to 8 tasks, no `Files:` path under a `do-not-touch` glob, no placeholder (`TODO`, `TBD`, `FIXME`, `<fill in>`, `...`) in an executable field, the task grammar, and a `spec-delta/<capability>.md` that passes `spec delta check` for each capability `spec-impact` names. `spec-impact` is optional: absent means `none` for `tiny` and `small`, and fails the check for `large`, which must declare `none` or the capabilities.

| Command                                                     | What it does                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node "$BDK/dist/bdk.mjs" part list`                        | Lists the parts with their state (`blocked`, `ready`, `started`, `done`, `stale`), tasks committed, size and wave.                                                                                            |
| `node "$BDK/dist/bdk.mjs" part start <part>`                | Checks the part and records its start, which moves the Change to `execute`; prints the tasks, `do-not-touch` and the success measure.                                                                         |
| `node "$BDK/dist/bdk.mjs" part done <part>`                 | Closes the part once every task has a commit carrying its trailers and no ticket is open; lists open findings. Editing the part afterwards makes it `stale`.                                                  |
| `node "$BDK/dist/bdk.mjs" part split <part> <task-ids>`     | Moves tasks to a new part with the same dependencies, keeping their ids and attempt history; the plan must be verified again.                                                                                 |
| `node "$BDK/dist/bdk.mjs" commit <task> [--message <text>]` | Commits the task's files and the Change directory with the three trailers, after the same diff check as `attempt close`; files you staged yourself stay staged and out of the commit, and your git hooks run. |

Progress lives in git, not in the plan: a task is committed when a commit reachable from `HEAD` carries `BDK-Change: <id>`, `BDK-Part: <part>` and `BDK-Task: <task>`, which `bdk commit` writes. A trailer naming a task no part holds, or the wrong part, is reported as `state/trailer-mismatch` naming the commit and the plan. For a `tiny` Change, `commit` and `part done` measure the Change's commits and record a finding for the review gate when they exceed 2 files, 1 module or 50 lines.

### Loops and attempts

Every retry loop runs under a ticket, and the kernel counts it: `task-redispatch` (a task), `verify-fix` (a part), `review-fix` (the Change) and `verifier` (an artifact such as `plan`). A ticket is a committed record in `attempts/`, so the counts are the same on any clone. The ladder of one loop and target always ends in a named state:

1. Attempts in a narrowing scope: the first runs `full`, the second `high+` (blockers and `critical` or `high` findings), the rest `blockers`. Findings a narrower scope drops are listed and recorded in one finding for the review gate.
2. When the round's budget (`policy.budgets`) is used up, or the same finding comes back in `policy.oscillation.threshold` failed attempts, one escalation ticket with `policy.escalation.model`, at most `policy.escalation.per-change` per Change. The kernel checkpoints the Change directory first.
3. Then the kernel writes a question with the options (retry with a fresh budget, accept as debt, split the part) and parks the Change. Answering it with `bdk change resume <id> --option <n>` starts a new round; nothing else resets a budget.

A `not-run` close (the check could not run, `--reason` required) never uses the budget; `policy.budgets.not-run` consecutive ones end the ladder at once. `attempt close` compares the real working tree with the plan: a path under `do-not-touch` is refused and the ticket stays open, a file no task declares is recorded as a finding. A `fail` stores the fingerprints of the findings written under the ticket that name a file (`log add --ticket`), which is how the kernel sees a finding come back.

A task is done only with evidence. After the implementer, the same ticket runs the post-task steps `attempt open` lists: `simplify` (the `simplifier` role; `attempt close ok` records its evidence from the simplifier's report), then `tests-scoped` and `lint` (the `runner` role, whose package lists the project's commands scoped to the task's executable files). The runner records each check with `bdk evidence record`, citing the output line or JSON value that shows a `pass`. `attempt close ok` refuses a missing or failing step (`policy/missing-evidence`), evidence recorded on another working tree (`policy/stale-evidence`) and a `pass` without a valid citation (`policy/missing-citation`); a change to a `policy.evidence.non-executable` file keeps evidence fresh. The step nodes of the artifact graph are done from the latest fresh evidence of each part.

An orchestrator starts a role with one file (the `swarm` skill holds the rules for running them in waves): `bdk dispatch build <target> <role> <ticket>` writes the dispatch package under `dispatch/`, holding the target (the task text, its `Files:` and `do-not-touch`), the accepted decisions and open blockers on the target in full with the other entries only counted, the role skill's body, the commands that fetch the rules and write the report, and for a verifier the blocking categories. It refuses a package above 12 288 bytes naming its largest section, a task with a placeholder, and a ticket that is not open on the target. A ticket keeps one package per role, and the one built last is its active package, which the ticket-keyed commands follow. The agent reads the package with `bdk dispatch show <ticket|path>` and its rules with `bdk rules show --ticket <ticket>`; an implementer that closes its ticket without reading them gets a finding for review.

Every role writes its entries with `bdk log add --ticket <ticket>` and stores its report with `bdk log ingest --ticket <ticket>`, the envelope (`status`, `files`, `entries`, `evidence`, `reason`) as the report's frontmatter. The kernel stamps `schema`, `ticket` and `role`, refuses a bad field naming it and its line, checks that every listed entry and evidence id was recorded under the ticket, and stores the report at the dispatch package's `report` path; a later call under the same open ticket replaces it. A blocker a verifier writes outside `policy.verifier.blocking-categories` (`log add --category`) is stored as an observation for review (P8).

| Command                                                                    | What it does                                                                                                                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node "$BDK/dist/bdk.mjs" attempt open <loop> <target> [--escalate]`       | Opens a ticket with its attempt number, budget and scope, or refuses with the next rung (`policy/budget-exhausted`, `policy/oscillation`, `policy/not-ready`). |
| `node "$BDK/dist/bdk.mjs" attempt close <ticket> ok\|fail\|not-run`        | Checks the diff and the envelope's entries (`--envelope`), closes the ticket and prints the next rung: `commit`, `retry`, `narrow`, `escalate` or `parked`.    |
| `node "$BDK/dist/bdk.mjs" attempt list [--for <task\|part>] [--all]`       | Lists tickets, open first, with the budgets used in the current round of the `--for` target; `--all` includes earlier rounds.                                  |
| `node "$BDK/dist/bdk.mjs" dispatch build <target> <role> <ticket>`         | Writes the ticket's dispatch package and prints its path and size.                                                                                             |
| `node "$BDK/dist/bdk.mjs" dispatch show <ticket\|path>`                    | Prints a dispatch package as written.                                                                                                                          |
| `node "$BDK/dist/bdk.mjs" rules show --ticket <ticket>`                    | Prints the rules for the ticket's role and target and records that they were read.                                                                             |
| `node "$BDK/dist/bdk.mjs" log ingest --ticket <ticket>`                    | Stores a role's report, its envelope as frontmatter, at the ticket's `report` path; writes no entry.                                                           |
| `node "$BDK/dist/bdk.mjs" log list --since-ticket-start <ticket>`          | Lists the entries written since the ticket opened, so an orchestrator reads what a wave logged.                                                                |
| `node "$BDK/dist/bdk.mjs" evidence record <kind> <file> --ticket <ticket>` | Records a check's output with its verdict and citations, and the tree hash of the files it covers.                                                             |
| `node "$BDK/dist/bdk.mjs" evidence check <target\|evidence-id>`            | Tells whether the target's evidence is still fresh, naming the files changed since.                                                                            |

---

### Living spec

The behaviour a project has shipped lives in `.bdk/specs/<capability>/spec.md`, one file per capability, in the OpenSpec format (`openspec validate --specs --strict` accepts it). A Change never edits it directly: it writes a delta, `spec-delta/<capability>.md` in the Change directory, with `## ADDED Requirements`, `## MODIFIED Requirements` and `## REMOVED Requirements` sections (and a `## Purpose` when it creates the capability). Each requirement is a `### Requirement: <name>` block whose statement uses the normative word, followed by `#### Scenario: <name>` blocks with `- **WHEN**` and `- **THEN**` bullets. A MODIFIED block replaces the whole requirement, so every scenario it drops must be listed under the same requirement in REMOVED; dropping one silently is an error.

At close, the kernel merges the deltas deterministically: REMOVED first, MODIFIED in place, ADDED appended. It writes each file with a `bdk-merge-hash` of its body and the `bdk-change` that merged it; running the merge twice gives the same bytes. A spec file whose body no longer matches its hash was edited by hand: the merge and `change close` refuse it, and `bdk doctor` reports it with the command that restores the file. When an archived Change that closed after this one began changed the same requirement differently, the merge refuses with both blocks; rewrite the delta on top of the current spec and record the resolution with `bdk log add decision "<summary>" --ref <other Change> --ref spec-delta/<capability>.md`.

| Command                                                    | What it does                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node "$BDK/dist/bdk.mjs" spec delta check [<capability>]` | Checks the Change's deltas against the current specs and lists every problem with its line; `validate spec-delta` and the plan part checks run the same check.                                                                                                                            |
| `node "$BDK/dist/bdk.mjs" spec diff [<capability>]`        | Previews the merge: each requirement a delta names, added, modified or removed, with the scenarios it adds and drops.                                                                                                                                                                     |
| `node "$BDK/dist/bdk.mjs" spec merge [--dry-run]`          | Merges the deltas into `.bdk/specs/` once `gate:review` is done; `--dry-run` shows the result and any conflict at any time.                                                                                                                                                               |
| `node "$BDK/dist/bdk.mjs" change close [--dry-run]`        | After `gate:review`, with no ticket open and no rebase or merge in progress: merges the specs, prunes the evidence, moves the Change to `.bdk/changes/archive/<id>/`, unbinds the branch and commits only those paths as `chore(bdk): close <id>`. Prints the PR summary from the ledger. |

## Skills

Invoke with `/bdk:<skill-name>`:

| Skill                          | Description                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:setup`                   | Initialize `.bdk/settings.yaml` — run once per project before using other skills                                                                                                                                                                                                                      |
| `/bdk:cr`                      | Dynamic code review (3-13 parallel agents based on change size). Reviews the delta since the last review by default; `--full` reviews the whole branch; `--inline` runs every cohort in-session with no subagents; `--base <ref>` reviews against an explicit base (stacked branches)                 |
| `/bdk:pr-review`               | Review GitHub PRs from URLs: one subagent per PR running `/bdk:cr --inline`, templated inline comments + summary on GitHub, approve / request-changes verdict; stack-aware (diff vs stack parent); `--verify` checks whether previous review comments were implemented and resolves addressed threads |
| `/bdk:commit`                  | Generate conventional commit message from git changes                                                                                                                                                                                                                                                 |
| `/bdk:create-plan`             | Create TDD-driven implementation plans                                                                                                                                                                                                                                                                |
| `/bdk:subagent-execute-plan`   | Execute a plan task-by-task with a fresh implementer subagent per task and a single end-of-branch review                                                                                                                                                                                              |
| `/bdk:verify-plan`             | Verify a plan against real code before execution                                                                                                                                                                                                                                                      |
| `/bdk:debug`                   | Structured debugging: investigate → failing tests → fix or plan                                                                                                                                                                                                                                       |
| `/bdk:test-driven-development` | Rigid TDD cycle: red → green                                                                                                                                                                                                                                                                          |
| `/bdk:design`                  | Design partner: classifies product vs architecture vs combined, 2+ approaches with Mermaid, self-critique, validation loop with warm-explorer reuse                                                                                                                                                   |
| `/bdk:create-adr`              | Generate Architecture Decision Records (MADR format)                                                                                                                                                                                                                                                  |
| `/bdk:explain-complex-code`    | Generate architecture docs with Mermaid diagrams                                                                                                                                                                                                                                                      |
| `/bdk:update-docs`             | Refresh existing architecture docs after code changes                                                                                                                                                                                                                                                 |
| `/bdk:mermaid-drawer`          | Shared Mermaid standard used by every diagram-emitting skill - type selection, node budget, and a palette verified legible in light and dark themes. Invoke directly to draw one diagram                                                                                                              |
| `/bdk:refine-rules`            | Compact and verify `.claude/rules/*.md` against real code - four-part admission test, six verdicts, budgets, relocation to doc comments, uniform format                                                                                                                                               |
| `swarm` (internal)             | Rules the stage skills follow to run role agents in waves: disjoint `Files:`, `execution.concurrency`, the ledger as channel, steps under the ticket, one resume                                                                                                                                      |
| `/bdk:add-rule`                | Capture one lesson as a properly-homed rule - routes to a narrow-glob rule file, a wide one, a skill, a doc comment, a test signpost, or nothing; dedupes, respects budgets                                                                                                                           |

### Removed skills

Claude Code removed the `TaskCreate` / `TaskUpdate` / `TaskList` tools, which several skills used as their only state mechanism. Those skills are gone rather than patched:

| Removed                                       | Use instead                                                                                                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:execute-plan`                           | `/bdk:subagent-execute-plan`                                                                                                                                                                        |
| `/bdk:save-progress`, `/bdk:restore-progress` | Nothing to invoke. `/bdk:subagent-execute-plan` checkpoints itself to a run manifest plus git commit trailers and resumes automatically; `--force` takes a run over from a dead session             |
| `/bdk:create-tasks`, `/bdk:refactor`          | `/bdk:create-plan`                                                                                                                                                                                  |
| `/bdk:audit-prompt`                           | Nothing                                                                                                                                                                                             |
| `/bdk:graphviz-docs-compiler`                 | Nothing to invoke. Mermaid diagrams render natively wherever the doc is viewed - `/bdk:explain-complex-code`, `/bdk:update-docs`, and `/bdk:create-adr` now embed Mermaid directly, no compile step |

---

## The plan pipeline

The four plan skills form one chain, each stage consuming the previous stage's output:

```
/bdk:design  →  /bdk:create-plan  →  /bdk:verify-plan  →  /bdk:subagent-execute-plan  →  /bdk:cr
```

The seams are files, not conversation state, so any stage can run in a fresh session:

| Seam             | Carrier                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| design → plan    | the design doc at `.bdk/design/`                                              |
| plan → verify    | the plan file                                                                 |
| verify → execute | `.bdk/verify-plan/<slug>-verification.md`, carrying the plan's sha256         |
| execute → review | git commit trailers (`BDK-Run:`, `BDK-Group:`) plus `.bdk/runs/<run-id>.json` |

**The plan file is immutable once verified.** Its sha256 is the run's identity, so edit before verifying, never after: the executor re-hashes the file and reports a post-verification edit as a stale stamp. To change course mid-run, stop, edit, re-verify, and start a new run - the already-committed groups stay committed and the new run picks up from the trailers.

Progress is recorded per group, in two places: commit trailers are the durable ground truth (they survive a crash, a new session, a deleted `.bdk/`, and a rebase), and the run manifest is a cache that makes resume cheap. On any disagreement git wins and the manifest is corrected. Everything under `.bdk/runs/` is machine-owned and gitignored - read it with `python3 scripts/bdk_run_state.py print --run <id>`, never by hand.

### Running plans in parallel worktrees

Two plans that touch the same files cannot run in the same checkout - the executor's clean-tree precondition and its per-group commits would interleave. Give each run its own worktree:

```bash
git worktree add ../myproject-featA -b feat/a
git worktree add ../myproject-featB -b feat/b
```

Then open a Claude Code session in each and run `/bdk:subagent-execute-plan` there. This works with no extra machinery because the run id is `<plan-slug>--<branch-slug>`: different branches mean different run ids, different manifests, and trailers that never match each other's `git log`. Nothing coordinates the two runs, which is the point - merge them the way you merge any two branches.

One session per worktree. Two sessions in one worktree contend for the same run, and the second is refused by the session guard.

---

## Agents

Used by skills internally (invoke via `subagent_type`):

| Agent                   | Model  | Purpose                                                                                                                                                                            |
| ----------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code-reviewer`         | sonnet | Layer-group deep code review                                                                                                                                                       |
| `implementer`           | sonnet | End-to-end task implementation (TDD, lint, commit) — used by `/bdk:subagent-execute-plan`                                                                                          |
| `fixer`                 | sonnet | Apply specific findings (review, lint, test failures) — used by `/bdk:subagent-execute-plan`                                                                                       |
| `explorer`              | haiku  | Fast read-only codebase exploration with the built-in tools                                                                                                                        |
| `test-runner`           | haiku  | Run tests, parse and report results                                                                                                                                                |
| `dead-code-detector`    | haiku  | Find unreachable/unused code                                                                                                                                                       |
| `duplicate-detector`    | haiku  | Find code duplication                                                                                                                                                              |
| `architecture-reviewer` | opus   | Audit against architectural rules                                                                                                                                                  |
| `static-analyse`        | haiku  | Detect and run project lint/format/type-check                                                                                                                                      |
| `plan-verifier`         | opus   | One-pass plan verification — six-section structured checklist, resumable via `SendMessage` for delta iteration. Used by `/bdk:verify-plan`                                         |
| `design-verifier`       | opus   | One-pass design verification — five-section checklist with gap-type routing (codebase / requirement / shape / honesty), resumable via `SendMessage`. Used by `/bdk:design` Phase 3 |
| `log-analyzer`          | haiku  | Parse and summarize error logs                                                                                                                                                     |
| `web-researcher`        | haiku  | Search web for solutions and docs                                                                                                                                                  |

v3 adapters, generated by `bdk export agents --host claude` and started by the role skills under `skills/roles/` (`implementer`, `simplifier`, `verifier`, `design-verifier`, `reviewer`, `pr-reviewer`, `runner`, `scout`), not for general tasks:

| Adapter    | Model  | Roles                         |
| ---------- | ------ | ----------------------------- |
| `worker`   | sonnet | `implementer`, `simplifier`   |
| `reader`   | opus   | `verifier`, `design-verifier` |
| `reviewer` | sonnet | `reviewer`, `pr-reviewer`     |
| `runner`   | haiku  | `runner`                      |
| `scout`    | haiku  | `scout`                       |

---

## Test & Lint Tiers

BDK runs checks **scoped to what changed** for the whole length of a plan, and the full suite exactly once, at the end. That only works if it knows which of your commands is the cheap one and how to narrow it — so each `tools.test` / `tools.lint` entry in `.bdk/settings.yaml` carries a tier and the narrower forms of the same command. `/bdk:setup` fills these in; this is what it writes:

```yaml
tools:
  test:
    - id: vitest
      tier: fast
      command: npm run test:unit
      scoped: npx vitest run {files}
      related: npx vitest related --run {files}
      failed: npx vitest run --changed
    - id: playwright
      tier: e2e
      command: npm run test:e2e
      scoped: npx playwright test {files}
      failed: npx playwright test --last-failed
  lint:
    - id: eslint
      tier: lint
      command: npm run lint
      scoped: npx eslint {files}
    - id: tsc
      tier: typecheck
      command: npm run typecheck
      incremental: npx tsc -b --incremental
```

| Field         | Meaning                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | The runner or framework (`vitest`, `pytest`, `eslint`, `tsc`) — not the package manager. Kebab-case, unique in its list; a layer above overrides an entry by it. |
| `tier`        | `fast` / `e2e` for tests; `lint` / `format` / `typecheck` for lint. Decides **when** the command may run. Required for tests and lint.                           |
| `command`     | The full, unscoped form. The slowest one: reserved for the end-of-plan gate.                                                                                     |
| `scoped`      | Scoped to a path list. Must contain `{files}`.                                                                                                                   |
| `related`     | The tests _covering_ given source files, for runners that compute that themselves. Must contain `{files}`. Replaces asking an agent which tests cover a change.  |
| `failed`      | Re-runs only what failed. Used by fix cycles, so a fix attempt does not pay for a suite.                                                                         |
| `incremental` | Cache-reusing form of a check that cannot take a path list — typecheckers above all.                                                                             |
| `when`        | Optional free text telling the model when this entry is the right one, e.g. when two entries share a tier.                                                       |

Omit any form your tool does not support; BDK falls back cleanly from a missing form. `tools.build` entries take the same fields without `tier`.

**What this buys.** Per task, only the task's own test file runs. Per group, only the tests covering the group's changed files — the fast tier alone, unless the group actually touched e2e specs. Fix cycles re-run failures, not suites. Lint runs on the changed files; typecheck reuses its cache between groups. The unscoped everything, e2e included, runs once per plan.

---

## Quality Rules

BDK ships language-agnostic rule sets (`code-quality`, `architecture`, `design-patterns`, `security`, `engineering-judgment`, `test-quality`) injected into `/bdk:cr`, `/bdk:create-plan`, and `/bdk:design` outputs.

### Four usage patterns

Each rule set is a prompt value: the prompt key `rules/<name>` (`rules/code-quality`, `rules/security`, ...), whose default is the plugin's `rules/<name>.md`.

**1. Zero config (recommended for most projects).** No file. BDK defaults are used as-is.

**2. Extend defaults.** Put your additions in `.bdk/prompts/rules/code-quality.md`. The BDK default content is emitted first, then your file's content appended.

**3. Replace defaults.** When your project has its own complete rule set, start the file with frontmatter:

```markdown
---
mode: replace
---
```

**4. Point at existing project doc.** Map the key to any file instead of copying it:

```yaml
prompts:
  files:
    rules/code-quality: docs/standards/coding.md
    rules/security: {path: docs/standards/security.md, mode: replace}
```

The same works one layer up (your global prompts directory next to the global settings file) and one layer down (`.bdk/prompts.local/`, personal). `prompts.dir` moves a layer's prompts directory. `bdk config show prompts.rules/code-quality` lists the files that make up the value.

### Behaviour on misconfiguration

A prompt file whose key BDK does not declare (`.bdk/prompts/rules/secrity.md`) or a `prompts.files` entry that names a missing file is refused by `bdk config check`, with the key, the layer and the file. `/bdk:cr` and `/bdk:create-plan` surface the error and stop, rather than silently dropping the rule context.

### Adding a new rule category

See `.claude/rules/quality-rules.md` (BDK-dev convention).

---

## Language Rules

Companion to Quality Rules, but keyed by the project's `languages` array rather than a flat rule name. BDK ships per-language principle sheets in `rules/languages/<lang>.md` (React, TypeScript, and JavaScript today; Vue, Python, Go, … follow the same pattern). Each agent that writes or reviews code (`code-reviewer`, `implementer`, `fixer`, `plan-verifier`) preloads them via the `bdk-rules-languages` meta-skill; `/bdk:create-plan` receives them as `Language rules: <lang>` sections of its context and copies them into the plan's `<!-- INJECT-LANGUAGES -->` marker.

Declare the project's stack in `.bdk/settings.yaml`:

```yaml
languages: [react, typescript]
```

Override or extend a default rule sheet per language through the prompt key `rules/languages/<lang>` (same `extends` | `replace` semantics as quality rules): a file `.bdk/prompts/rules/languages/react.md`, or

```yaml
prompts:
  files:
    rules/languages/react: docs/team-react-conventions.md
```

A language listed without a matching `rules/languages/<lang>.md` (and no override) is silently skipped — no error.

Authoring a new language sheet: see `.claude/rules/language-rules.md`.

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** — project-specific domain rules (architecture layers, domain logic, etc.)
- **Plans** — generated per-project
- **Project-specific hooks** — drift detection, worktree setup, directory creation
- **Domain skills** — feature-specific workflows
- **Language-specific hooks** — Python formatters, Go linters tied to one stack

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, authoring conventions, and how to add skills/agents.
