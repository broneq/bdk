# BDK — Broneq Dev Kit

A personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks into a single installable unit.

**Core design principle**: Language-agnostic by default. Skills contain workflow logic only; environment discovery is delegated to `STARTUP_INSTRUCTIONS.md` and the local project's `CLAUDE.md`.

---

## Installation

**Requirements:** Claude Code and Node.js 22.13 or later on `PATH`; the kernel uses Node's built-in `node:sqlite`. BDK needs no Python and no `uv`. `bdk doctor` reports a Node below the minimum with the line that installs a newer one.

**From GitHub directly (recommended until marketplace listing is live):**

1. Add the BDK marketplace source:
   ```
   /plugin marketplace add broneq/bdk
   ```
2. Install:
   ```
   /plugin install bdk@bdk
   ```

The marketplace installs the latest release from the `release` branch, which carries the built kernel (`dist/bdk.mjs`). The `main` branch holds sources only.

**Requirements:** Claude Code (CLI, desktop app or IDE extension) and Node >= 22.13 on `PATH`. The plugin's `bin/bdk` launcher runs the kernel; Claude Code puts `bin/` on the Bash tool's `PATH`, so skills, agents and you in a `!` command call it as `bdk <command>`. claude.ai and Cowork do not install a plugin with a `bin/` directory, so BDK does not run there.

When a skill stops with `BDK STOP: kernel unavailable (exit <n>)`: exit 5 means the launcher found no `node` or no `dist/bdk.mjs` (its line above names which), and exit 127 means no `bdk` was found (the plugin is disabled). Any other code can mean that another executable named `bdk`, earlier on your `PATH` than the plugin's `bin/`, answered instead: rename or remove it.

**Craft skills (optional):** the same marketplace lists `bdk-craft`, a separate plugin of portable engineering skills (test-driven development, debugging, Mermaid diagrams and more; `plugins/bdk-craft/README.md`). It works without `bdk`; with `bdk` installed, implementer agents are told to read its `tdd` skill, and `debugging` on a bug Change.

```
/plugin install bdk-craft@bdk
```

### Code tools

BDK ships no MCP server and starts no background process. Skills and agents explore, search and trace code with Claude Code's built-in tools (`Grep`, `Glob`, `Read`, `Bash`), so nothing beyond Claude Code needs installing, and BDK adds no tool-guidance layer on top of them. The reasoning is in `docs/adr/0001-remove-bundled-mcp-servers.md`.

If you want a semantic code-navigation or code-graph MCP server, configure it yourself at user or project level with `claude mcp add`. BDK neither depends on it nor tells its agents to call it.

### Settings

A project keeps its settings in `.bdk/settings.yaml`, which `/bdk:setup` writes. Its first line is a `yaml-language-server` modeline pointing at the versioned JSON Schema (`schema/settings.json`), so an IDE with the YAML extension completes and validates keys. Four layers merge, lowest first: the plugin defaults, your global file (`$XDG_CONFIG_HOME/bdk/settings.yaml`, else `~/.config/bdk/settings.yaml`; `%APPDATA%\bdk\settings.yaml` on Windows), the project's `.bdk/settings.yaml` and a personal, uncommitted `.bdk/settings.local.yaml`. Maps merge deeply, lists of entries with an `id` merge by `id`, the glob lists of `policy.evidence` only grow (a layer appends, the defaults stay), other lists are replaced whole.

The kernel reads the settings; skills and scripts ask it. Skills need Node >= 22.13.

| Command                        | What it does                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bdk config show [<key>]`      | Prints the merged value as YAML (`--json` for JSON, `--origins` for the layers).                                                                        |
| `bdk config check`             | Validates every layer and refreshes `.bdk/.machine/config/resolved.yaml`.                                                                               |
| `bdk config set <key> <value>` | Edits `.bdk/settings.yaml` (`--global`, `--local` for the other files), comments kept. Adds the two BDK lines to `.gitignore` when no rule covers them. |
| `bdk config schema [<module>]` | Prints the JSON Schema; `--url` prints the modeline URL.                                                                                                |

`features.lavish` (default `true`) turns on decision points in the browser through `lavish-axi` when it is installed. A key BDK does not declare is refused, with a "did you mean" hint or, for a key earlier versions wrote (`test-tools`, `quality`, `features.caveman`, the MCP flags), the key that replaces it or why it is gone. The one `SessionStart` hook (`bdk hooks session-start`) prints the shared foundation and, in a BDK project, one line per settings problem; it never blocks. A `PreToolUse` guard denies subagents' git and orchestrator commands, writes under `.bdk/specs/` and long dispatch prompts, and blocks when the kernel is missing; see [the hooks reference](docs/guide/reference/hooks.md).

The `policy` keys bound the workflow, each subtree read by its own part of the kernel: `policy.gates.design` and `policy.gates.review` (`manual` or `auto`), `policy.budgets` (tickets per loop and round: `task-redispatch` 3, `verify-fix` 2, `review-fix` 2, `verifier` 2, and 3 consecutive `not-run` closes), `policy.oscillation.threshold` (2 failed attempts with the same finding end the retries early), `policy.escalation` (`enabled` true, `model` `opus`, at most `per-change` 3 escalation tickets per Change) `policy.checkpoint.enabled` (true: the kernel commits the Change directory when it parks or escalates) and `policy.verifier` (`blocking-categories`, the only categories a verifier may block on, and `not-a-fail`, what it must never block on; each item an `id` and a `description`, merged by `id`, so a project adds or rewords a category but the default items always stay) and `policy.evidence` (`non-executable` globs whose changes never make evidence stale, `build-config` globs that always count as source, and `max-committed-bytes`, 65 536: a smaller text evidence file is committed, the rest stays in `.bdk/.machine`). `bdk config show policy` prints them all with their defaults. `execution.concurrency` (1 to 15, default 5) caps how many role agents of one wave run at once. `spec.normative-word` (default `SHALL`) is the word every requirement of a spec delta must state, and `archive.keep-evidence` (default `false`) keeps the full `dispatch/` and `reports/` bodies when a Change closes instead of pruning them to a hash index.

A skill gets everything that depends on the settings (rules, the decision fragment, the configured tool commands, shared reference files) from `bdk ctx skill <name>`, called by two context lines at the top of its body: a `!` line Claude Code runs at load time, and a fallback sentence that makes the model run the same command when the host did not. Fragments are prompt values (`fragments/decision/lavish`, `fragments/decision/ask-user`), which a project extends or replaces through `.bdk/prompts/` or `prompts.files`. `.bdk/settings.json` from BDK 2 is not read; `/bdk:setup` migrates it.

### Change state

The kernel keeps each Change in `.bdk/changes/<id>/`, which is committed: `change.md` holds the intent and the starting profile, `log/` holds one file per ledger entry, so two branches of one Change merge without conflicts. `bdk change new | status | list | resume | park` open, inspect, park and rebind a Change (`status` also lists the plan parts as `part list` does); `bdk change checkpoint` commits the Change directory alone as `chore(bdk): checkpoint <id>`, leaving anything the user staged out, and `park`, the escalation ladder and the `SessionEnd` hook run the same checkpoint (`policy.checkpoint.enabled`), reporting a skip instead of failing; `bdk change takeover --close-tickets` takes over a Change whose previous session died with tickets open, closing them as `not-run` (budgets stay), rebuilding the index and naming the previous session; `bdk log add | ingest | list | show | resolve` write and read the ledger; `bdk measure [<range>]` reports diff signals (files, lines, modules); `bdk query "<select>"` runs read-only SQL over the index. Every command takes `--json`.

What each machine derives stays out of git under `.bdk/.machine/`: the SQLite index `index.sqlite`, a cache rebuilt from the committed files whenever it is missing or stale, and the branch markers that bind a local branch to its Change. `bdk rebuild` is the repair path behind every exit 4: it migrates older documents, rebuilds the index from the committed files, regenerates `plan/index.md` and `design/index.md`, and checks the `BDK-*` commit trailers against the plan and the attempt records, reporting a disagreement as `state/trailer-mismatch` instead of hiding it. On a fresh clone, `bdk change resume <id>` binds the branch and `bdk rebuild` follows; `--all` widens the rebuild to every Change. `change new` and `config set` add exactly `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore` when no rule covers them; `.bdk/` as a whole is never ignored.

### Artifact graph

Which artifact a Change needs next is decided by the kernel, not by a skill. `pipeline/pipeline.yaml` in the plugin declares the stages (`intent`, `design`, `plan`, `execute`, `review`, `close`, each with the command that enters it) and the nodes: `intent`, `design` or `design-parts` plus `design-index`, `architecture`, `gate:design`, `plan` (one node per plan part), `plan-verify`, `execute`, `spec-delta`, `review`, `gate:review` and `close`. Its modeline points at `schema/pipeline.json`. The profile and the Change kind choose the variant: `tiny` and `bug` go from `intent` to `plan`, `large` splits the design into parts. A node is `blocked`, `ready`, `done`, `stale` (its files changed after it was marked done) or `skipped`.

| Command                     | What it does                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bdk next`                  | Prints the instruction for the next artifact: template, paths to write, rule sets, relevant ledger entries. Or says the Change waits for a gate or the user. |
| `bdk explain <artifact>`    | Explains a node's state through its chain of requirements, with both hashes of a stale node.                                                                 |
| `bdk validate [<artifact>]` | Runs the node's checks and prints the current input hash; writes nothing.                                                                                    |
| `bdk done <artifact>`       | Marks a node done after its checks pass and records the hash in a `transition` entry; the only way an artifact becomes done.                                 |

A gate is never marked done by a command: it opens only on a `transition` entry with `source: user` (or `source: policy` when `policy.gates.design` or `policy.gates.review` is `auto`; both default to `manual`), written after its requirements were done. The `UserPromptExpansion` hook writes it: typing `/bdk:plan` or `/bdk:close` passes the gate before that stage, or blocks with what is missing, and `/bdk:run` passes the `auto` gates, once those stage skills ship (T41). The hook writes only for a command the user typed, so the model cannot pass a gate. `change status` lists every node and gate, and which gates the user or the policy passed. Each artifact kind has a template, the prompt value `pipeline/<kind>`, so a project extends or replaces it in `.bdk/prompts/pipeline/<kind>.md` like any other prompt.

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

| Command                                | What it does                                                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bdk part list`                        | Lists the parts with their state (`blocked`, `ready`, `started`, `done`, `stale`), tasks committed, size and wave.                                                                                            |
| `bdk part start <part>`                | Checks the part and records its start, which moves the Change to `execute`; prints the tasks, `do-not-touch` and the success measure.                                                                         |
| `bdk part done <part>`                 | Closes the part once every task has a commit carrying its trailers and no ticket is open; lists open findings. Editing the part afterwards makes it `stale`.                                                  |
| `bdk part split <part> <task-ids>`     | Moves tasks to a new part with the same dependencies, keeping their ids and attempt history; the plan must be verified again.                                                                                 |
| `bdk commit <task> [--message <text>]` | Commits the task's files and the Change directory with the three trailers, after the same diff check as `attempt close`; files you staged yourself stay staged and out of the commit, and your git hooks run. |

Progress lives in git, not in the plan: a task is committed when a commit reachable from `HEAD` carries `BDK-Change: <id>`, `BDK-Part: <part>` and `BDK-Task: <task>`, which `bdk commit` writes. A trailer naming a task no part holds, or the wrong part, is reported as `state/trailer-mismatch` naming the commit and the plan. For a `tiny` Change, `commit` and `part done` measure the Change's commits and record a finding for the review gate when they exceed 2 files, 1 module or 50 lines.

### Loops and attempts

Every retry loop runs under a ticket, and the kernel counts it: `task-redispatch` (a task), `verify-fix` (a part), `review-fix` (the Change) and `verifier` (an artifact such as `plan`). A ticket is a committed record in `attempts/`, so the counts are the same on any clone. The ladder of one loop and target always ends in a named state:

1. Attempts in a narrowing scope: the first runs `full`, the second `high+` (blockers and `critical` or `high` findings), the rest `blockers`. Findings a narrower scope drops are listed and recorded in one finding for the review gate.
2. When the round's budget (`policy.budgets`) is used up, or the same finding comes back in `policy.oscillation.threshold` failed attempts, one escalation ticket with `policy.escalation.model`, at most `policy.escalation.per-change` per Change. The kernel checkpoints the Change directory first.
3. Then the kernel writes a question with the options (retry with a fresh budget, accept as debt, split the part) and parks the Change. Answering it with `bdk change resume <id> --option <n>` starts a new round; nothing else resets a budget.

A `not-run` close (the check could not run, `--reason` required) never uses the budget; `policy.budgets.not-run` consecutive ones end the ladder at once. `attempt close` compares the real working tree with the plan: a path under `do-not-touch` is refused and the ticket stays open, a file no task declares is recorded as a finding. A `fail` stores the fingerprints of the findings written under the ticket that name a file (`log add --ticket`), which is how the kernel sees a finding come back.

A task is done only with evidence. After the implementer, the same ticket runs the post-task steps `attempt open` lists: `simplify` (the `simplifier` role; `attempt close ok` records its evidence from the simplifier's report), then `tests-scoped` and `lint` (the `runner` role, whose package lists the project's commands scoped to the task's executable files). The runner records each check with `bdk evidence record`, citing the output line or JSON value that shows a `pass`. `attempt close ok` refuses a missing or failing step (`policy/missing-evidence`), evidence recorded on another working tree (`policy/stale-evidence`) and a `pass` without a valid citation (`policy/missing-citation`); a change to a `policy.evidence.non-executable` file keeps evidence fresh. The step nodes of the artifact graph are done from the latest fresh evidence of each part.

An orchestrator starts a role with one file (the `swarm` skill holds the rules for running them in waves): `bdk dispatch build <target> <role> <ticket>` writes the dispatch package under `dispatch/`, holding the target (the task text, its `Files:` and `do-not-touch`), the accepted decisions and open blockers on the target in full with the other entries only counted, the role skill's body, the commands that fetch the rules and write the report, and for a verifier the blocking categories. It refuses a package above 12 288 bytes naming its largest section, a task with a placeholder, and a ticket that is not open on the target. A ticket keeps one package per role, and the one built last is its active package, which the ticket-keyed commands follow. The agent reads the package with `bdk dispatch show <ticket|path>` and its rules with `bdk rules show --ticket <ticket>`; an implementer that closes its ticket without reading them gets a finding for review.

Every role writes its entries with `bdk log add --ticket <ticket>` and stores its report with `bdk log ingest --ticket <ticket>`, the envelope (`status`, `files`, `entries`, `evidence`, and `reason` for `blocked` or `needs-context`) as the report's frontmatter; an empty `reason` on `done` reads as absent. The kernel stamps `schema`, `ticket` and `role`, refuses a bad field naming it and its line, checks that every listed entry and evidence id was recorded under the ticket, and stores the report at the dispatch package's `report` path; a later call under the same open ticket replaces it. A blocker a verifier writes outside `policy.verifier.blocking-categories` (`log add --category`) is stored as an observation for review (P8).

| Command                                               | What it does                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bdk attempt open <loop> <target> [--escalate]`       | Opens a ticket with its attempt number, budget and scope, or refuses with the next rung (`policy/budget-exhausted`, `policy/oscillation`, `policy/not-ready`). |
| `bdk attempt close <ticket> ok\|fail\|not-run`        | Checks the diff and the envelope's entries (`--envelope`), closes the ticket and prints the next rung: `commit`, `retry`, `narrow`, `escalate` or `parked`.    |
| `bdk attempt list [--for <task\|part>] [--all]`       | Lists tickets, open first, with the budgets used in the current round of the `--for` target; `--all` includes earlier rounds.                                  |
| `bdk attempt show <ticket>`                           | Prints one ticket's record: loop, target, state and, for a code loop, its steps.                                                                               |
| `bdk dispatch build <target> <role> <ticket>`         | Writes the ticket's dispatch package and prints its path and size.                                                                                             |
| `bdk dispatch show <ticket\|path>`                    | Prints a dispatch package as written.                                                                                                                          |
| `bdk rules show --ticket <ticket>`                    | Prints the rules for the ticket's role and target and records that they were read.                                                                             |
| `bdk log ingest --ticket <ticket>`                    | Stores a role's report, its envelope as frontmatter, at the ticket's `report` path; writes no entry.                                                           |
| `bdk log list --since-ticket-start <ticket>`          | Lists the entries written since the ticket opened, so an orchestrator reads what a wave logged.                                                                |
| `bdk evidence record <kind> <file> --ticket <ticket>` | Records a check's output with its verdict and citations, and the tree hash of the files it covers.                                                             |
| `bdk evidence check <target\|evidence-id>`            | Tells whether the target's evidence is still fresh, naming the files changed since.                                                                            |

---

### Living spec

The behaviour a project has shipped lives in `.bdk/specs/<capability>/spec.md`, one file per capability, in the OpenSpec format (`openspec validate --specs --strict` accepts it). A Change never edits it directly: it writes a delta, `spec-delta/<capability>.md` in the Change directory, with `## ADDED Requirements`, `## MODIFIED Requirements` and `## REMOVED Requirements` sections (and a `## Purpose` when it creates the capability). Each requirement is a `### Requirement: <name>` block whose statement uses the normative word, followed by `#### Scenario: <name>` blocks with `- **WHEN**` and `- **THEN**` bullets. A MODIFIED block replaces the whole requirement, so every scenario it drops must be listed under the same requirement in REMOVED; dropping one silently is an error.

At close, the kernel merges the deltas deterministically: REMOVED first, MODIFIED in place, ADDED appended. It writes each file with a `bdk-merge-hash` of its body and the `bdk-change` that merged it; running the merge twice gives the same bytes. A spec file whose body no longer matches its hash was edited by hand: the merge and `change close` refuse it, and `bdk doctor` reports it with the command that restores the file. When an archived Change that closed after this one began changed the same requirement differently, the merge refuses with both blocks; rewrite the delta on top of the current spec and record the resolution with `bdk log add decision "<summary>" --ref <other Change> --ref spec-delta/<capability>.md`.

| Command                               | What it does                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bdk spec delta check [<capability>]` | Checks the Change's deltas against the current specs and lists every problem with its line; `validate spec-delta` and the plan part checks run the same check.                                                                                                                            |
| `bdk spec diff [<capability>]`        | Previews the merge: each requirement a delta names, added, modified or removed, with the scenarios it adds and drops.                                                                                                                                                                     |
| `bdk spec merge [--dry-run]`          | Merges the deltas into `.bdk/specs/` once `gate:review` is done; `--dry-run` shows the result and any conflict at any time.                                                                                                                                                               |
| `bdk change close [--dry-run]`        | After `gate:review`, with no ticket open and no rebase or merge in progress: merges the specs, prunes the evidence, moves the Change to `.bdk/changes/archive/<id>/`, unbinds the branch and commits only those paths as `chore(bdk): close <id>`. Prints the PR summary from the ledger. |

## Skills

Invoke with `/bdk:<skill-name>`:

| Skill                | Description                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:setup`         | Prepare a project for BDK: `.bdk/settings.yaml` with its test, lint and build commands, Lavish, hand-written rules, migration from BDK 2. Run once per project or after cloning                                                                                                                                                                                                                   |
| `/bdk:change`        | Open a Change from an intent (asks whether to create a `feat/` or `fix/` branch or stay on the current one), or show, list, resume, park or take over one, and name the command to type next                                                                                                                                                                                                      |
| `/bdk:cr`            | Review the Change on the branch in rounds: a reviewer per group, an integration reviewer and a gate runner; triages every entry and fixes the blocking ones through implementer packages, then renders a report in which you fix, defer, reject or track each open entry. Opens a review Change on a branch without one; `--full`, `--base <ref>`, `--inline`, `--report`                         |
| `/bdk:pr-review`     | Review GitHub PRs from URLs through the stateless `pr-reviewer` role, against the PR's intent and its BDK Change when it has one; you decide each finding on a Lavish page (blocker, nice-to-have, tracker, drop) before one templated review per PR posts; `--quick` confirms only the verdict; stack-aware; `--verify` checks the previous review's blocker threads and resolves the fixed ones |
| `/bdk:commit`        | Commit your own changes with a Conventional Commits message written from the diff and the project's convention (commitlint, `CONTRIBUTING.md`, then `git log`); never `--no-verify`, no attribution                                                                                                                                                                                               |
| `/bdk:plan`          | Plan the active Change as plan parts of task contracts with concrete test cases, verify and correct them, and report the waves; `--review` asks for your acceptance first                                                                                                                                                                                                                         |
| `/bdk:verify-plan`   | Verify the plan of the active Change against the code and the design on a fresh context; a passing verdict marks `plan-verify` done                                                                                                                                                                                                                                                               |
| `/bdk:execute`       | Build the verified plan of the active Change through role agents: every ready part in one run, flat or with one lead per part, one commit per task; ends naming `/bdk:cr`                                                                                                                                                                                                                         |
| `/bdk:close`         | Close the reviewed Change: merge its spec deltas, archive it in one commit, regenerate drifted rule files, and report the PR summary; it opens no PR                                                                                                                                                                                                                                              |
| `/bdk:run`           | Carry a Change through the stages for you: opens it from an intent, then design, plan, execute, review and close; asks nothing and records each choice for the next gate; `--auto` passes every ready gate                                                                                                                                                                                        |
| `/bdk:design`        | Design the active Change with you: grounds in the code, 2+ approaches with Mermaid and self-critique, writes the design files the kernel names, records decisions in the ledger, verifies and ends at the design gate                                                                                                                                                                             |
| `/bdk:verify-design` | Verify the design of the active Change against the code on a fresh context; a passing verdict marks `design-verify` done, which the design gate requires                                                                                                                                                                                                                                          |
| `/bdk:adr`           | Record one architecture decision as MADR under `docs/adr/`, from a description or a `decision` entry of a Change                                                                                                                                                                                                                                                                                  |
| `/bdk:docs`          | Write architecture documentation for a code path (`docs/architecture/<module>.md` by default), or refresh an existing document against the code after you approve the plan; Mermaid diagrams and prototype examples                                                                                                                                                                               |
| `/bdk:rules`         | Audit recurring lessons into project rules through `bdk rules accept`, capture one lesson, or check the rule files and their `.claude/rules/` projection; removes a rule only as a tombstone you approve                                                                                                                                                                                          |
| `swarm` (internal)   | Rules the stage skills follow to run role agents in waves: disjoint `Files:`, `execution.concurrency`, the ledger as channel, steps under the ticket, one resume                                                                                                                                                                                                                                  |
| `/bdk:doctor`        | Diagnose the BDK installation with `bdk doctor`, apply the safe repairs, and walk the rest with you; a system change only on your agreement                                                                                                                                                                                                                                                       |
| `/bdk:diagnose`      | Analyze one session from its run journal, report and transcript slices; store a cited analysis whose BDK issue section is checked for project code. By hand only                                                                                                                                                                                                                                  |
| `/bdk:bdk-cli`       | Points the agent at the kernel CLI and its `--help` for Change state, the ledger, rules, evidence and configuration                                                                                                                                                                                                                                                                               |

### Removed skills

Claude Code removed the `TaskCreate` / `TaskUpdate` / `TaskList` tools, which several skills used as their only state mechanism. Those skills are gone rather than patched:

| Removed                                           | Use instead                                                                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:execute-plan`, `/bdk:subagent-execute-plan` | `/bdk:execute`                                                                                                                                      |
| `/bdk:save-progress`, `/bdk:restore-progress`     | Nothing to invoke. The Change's ledger and the task commits' trailers hold the state; `/bdk:execute` resumes from `bdk next`                        |
| `/bdk:create-tasks`, `/bdk:refactor`              | `/bdk:plan`                                                                                                                                         |
| `/bdk:audit-prompt`                               | Nothing                                                                                                                                             |
| `/bdk:graphviz-docs-compiler`                     | Nothing to invoke. Mermaid diagrams render natively wherever the doc is viewed - `/bdk:docs` and `/bdk:adr` embed Mermaid directly, no compile step |

BDK 3 replaced the v2 tools skills:

| Removed                                         | Use instead  |
| ----------------------------------------------- | ------------ |
| `/bdk:explain-complex-code`, `/bdk:update-docs` | `/bdk:docs`  |
| `/bdk:create-adr`                               | `/bdk:adr`   |
| `/bdk:add-rule`, `/bdk:refine-rules`            | `/bdk:rules` |

BDK 3 also removed the internal skills and agents its role skills replace:

| Removed                                                                                                        | Use instead                                                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| The `bdk-*` meta-skills (`bdk-rules-*`, `bdk-lint-tools`, `bdk-test-tools`, `bdk-implementer-return-contract`) | Nothing to invoke. A role agent reads its rules with `bdk rules show --ticket` and its commands from its dispatch package |
| Agents `implementer`, `fixer`                                                                                  | `worker` running the `implementer` role                                                                                   |
| Agents `plan-verifier`, `design-verifier`                                                                      | `reader` running the `verifier` and `design-verifier` roles                                                               |
| Agents `code-reviewer`, `architecture-reviewer`, `dead-code-detector`, `duplicate-detector`                    | `reviewer` and the Opus `integration-reviewer` of `/bdk:cr`                                                               |
| Agents `test-runner`, `static-analyse`                                                                         | `runner`                                                                                                                  |
| Agents `explorer`, `log-analyzer`                                                                              | `scout`                                                                                                                   |

BDK 3 moved the craft skills to the `bdk-craft` plugin:

| Removed                        | Use instead                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `/bdk:test-driven-development` | `/bdk-craft:tdd`                                                                                                    |
| `/bdk:debug`                   | `/bdk-craft:debugging` for the process; open a bug Change with `/bdk:change` when the fix needs a plan and a review |
| `/bdk:mermaid-drawer`          | `/bdk-craft:mermaid-drawer`                                                                                         |

---

## The plan pipeline

In BDK 3 every stage works on the active Change in `.bdk/changes/<changeId>/`, and the kernel (`bdk next`) says which step is ready:

```
/bdk:change  →  /bdk:design  →  /bdk:plan  →  /bdk:execute  →  /bdk:cr  →  /bdk:close
```

`/bdk:design` writes the design and ends at the design gate; `/bdk:plan` writes the plan parts (`plan/parts/`) and verifies them with `/bdk:verify-plan`; `/bdk:execute` builds every ready part through role agents, flat or with one lead per part, and ends naming `/bdk:cr`. `/bdk:close` merges the spec deltas, archives the Change and hands you the PR summary. You type each stage command, so every stage starts from your decision, or let `/bdk:run "<intent>"` type them for you: it stops at every `manual` gate (the default for the design and review gates) and names the command you type, and with `--auto` it passes those gates too, recording that it did. The BDK 2 skills `/bdk:create-plan` and `/bdk:subagent-execute-plan` are gone.

The seams are files, not conversation state, so any stage can run in a fresh session:

| Seam             | Carrier                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| design → plan    | `design.md` or `design/parts/`, `architecture.md`, the design verdict and the gate transition |
| plan → execute   | `plan/parts/`, the plan verdict                                                               |
| execute → review | one commit per task with its `BDK-Change`, `BDK-Part` and `BDK-Task` trailers                 |

The ledger under `log/` holds every decision, finding and transition, and the kernel derives each node's state from the files' hashes: a plan part edited after its verdict makes `plan-verify` stale, and the next `bdk next` says so.

### Running Changes in parallel worktrees

A Change is bound to its branch, so two Changes run side by side in two worktrees, one Claude Code session in each:

```bash
git worktree add ../myproject-featA -b feat/a
git worktree add ../myproject-featB -b feat/b
```

Merge them the way you merge any two branches.

## Agents

Six adapters, generated by `bdk export agents --host claude` and started with a dispatch package by the stage skills, `/bdk:cr` and the `swarm` skill; the role itself lives in a role skill under `skills/roles/`. They are not for general tasks. A `lead` runs one plan part and starts its part's role agents; a `worker` may start a `scout`. Every agent is recorded in the agent registry, which `bdk agents list|show|wait` reads:

| Adapter    | Model  | Roles                                                 |
| ---------- | ------ | ----------------------------------------------------- |
| `lead`     | sonnet | `lead`                                                |
| `worker`   | sonnet | `implementer`, `simplifier`                           |
| `reader`   | opus   | `verifier`, `design-verifier`, `integration-reviewer` |
| `reviewer` | sonnet | `reviewer`, `pr-reviewer`                             |
| `runner`   | haiku  | `runner`                                              |
| `scout`    | haiku  | `scout`                                               |

One more agent is for any session:

| Agent            | Model | Purpose                               |
| ---------------- | ----- | ------------------------------------- |
| `web-researcher` | haiku | Search the web for solutions and docs |

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

A rule is a choice among valid alternatives that BDK or your project made and wants followed, stated as one instruction: a `house` rule states the choice, a `knowledge` rule a fact about a library or tool that a model gets wrong (with `source` and `verified`). A fact about your own system or a process lesson is not a rule. Each rule is one file named by its id, and agents cite that id.

BDK ships its pack in `rules/<category>/` (`BDK-CQ`, `BDK-ARCH`, `BDK-DP`, `BDK-SEC`, `BDK-TQ`, `BDK-EJ`, `BDK-PL`) and `rules/languages/<name>/` (`BDK-JS`, `BDK-TS`, `BDK-REACT`), read from the installed plugin. A language pack is read when its name is in `languages`. Your project's rules live in `.bdk/rules/<ID>.md` with your own prefixes; `applies` globs scope a rule to files, `roles` names the roles that read it.

```yaml
languages: [react, typescript]
rules:
  disabled: [BDK-CQ-4]   # switch a rule off, shipped ones included
  warn-above: 100        # session start warns when one role reads more rules
```

`dispatch build` selects the rules for the role and the task's files, with no cap, and records their ids in the package; the agent reads them with `rules show --ticket`.

| Command                               | What it does                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `bdk rules check [<path>]`            | Validates the shipped and project rule files and refuses a duplicate id.                             |
| `bdk rules show <id>`                 | Prints one rule, a tombstone or a disabled rule included.                                            |
| `bdk rules explain <file> [--role]`   | Lists the rules a role reads for a file, with the glob that matched.                                 |
| `bdk rules import [<dir>]`            | Turns hand-written `.claude/rules/*.md` into rule files, one per top-level bullet.                   |
| `bdk rules export --claude [--check]` | Writes the `.claude/rules/bdk-generated*.md` projection of the project rules, or checks it.          |
| `bdk rules stats [--entries]`         | The audit view: recurring learnings and findings across Changes, raw entries, citations per rule id. |
| `bdk rules accept "<text>" --prefix`  | Adopts a rule: writes the next id of the prefix and regenerates the projection.                      |
| `bdk rules prune [--uncited <n>]`     | Reports rules whose globs match no file and rules no recent entry cites.                             |

A lesson is recorded as `log add learning` and becomes a rule only through `rules accept`; see [Quality and language rules](docs/guide/concepts/quality-and-language-rules.md) and [Rules hygiene](docs/guide/workflows/rules-hygiene.md). Adding a rule to the pack: `.claude/rules/quality-rules.md` (BDK-dev convention).

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
