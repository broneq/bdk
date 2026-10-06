# BDK - Broneq Dev Kit

BDK is a Claude Code plugin that carries a piece of work from intent to a reviewed, mergeable branch: design, plan, execution by role agents, review and close. A small TypeScript kernel keeps the state of that work in committed files, decides what comes next and refuses what the process does not allow, so nothing depends on what a conversation remembers.

Nothing in BDK is tied to a language. Your test, lint and build commands live in `.bdk/settings.yaml`, and every skill and agent gets them from the kernel. BDK runs no MCP server and no background process: agents use Claude Code's built-in tools ([ADR 0001](docs/adr/0001-remove-bundled-mcp-servers.md)).

The full guide is the documentation site, sources in [`docs/guide/`](docs/guide/index.md).

## Installation

**Requirements:** Claude Code (CLI, desktop app or IDE extension) and Node.js 22.13 or later on `PATH`. The kernel runs on Node and its built-in `node:sqlite`; nothing else needs installing. claude.ai and Cowork do not install a plugin with a `bin/` directory, so BDK does not run there.

Add the marketplace and install the plugin:

```
/plugin marketplace add broneq/bdk
/plugin install bdk@bdk
```

The marketplace installs the latest release, which carries the built kernel. The plugin's `bin/bdk` launcher goes on the Bash tool's `PATH`, so skills, agents and you (in a `!` command) call the kernel as `bdk <command>`; `bdk doctor` checks the installation.

The same marketplace lists `bdk-craft`, an optional plugin of portable engineering skills (test-driven development, debugging, Mermaid diagrams, refactoring and more). It works without `bdk`; with both installed, implementer agents follow its `tdd` skill, and `debugging` on a bug Change.

```
/plugin install bdk-craft@bdk
```

[Installation](docs/guide/getting-started/installation.md) has the details and what to do when a skill reports the kernel unavailable.

## Quick start

```
/bdk:setup
/bdk:run "Users log in with a magic link"
```

`/bdk:setup` writes your project's commands into `.bdk/settings.yaml`, once per project. `/bdk:run` opens a Change from the intent and carries it through design, plan, execution and review to the close, stopping at each gate for you to decide; `/bdk:run --auto` passes the gates too and records that it did. To drive the stages yourself, open the Change with `/bdk:change "<intent>"` and type the command each stage names. [Your first feature](docs/guide/getting-started/first-feature.md) walks through one Change step by step.

## The Change pipeline

Every piece of work is a **Change**: one feature, fix or review on one branch, kept in `.bdk/changes/<id>/` and committed with the code. Close the session after any step and continue in a fresh one, on another machine, or after a teammate pulls the branch.

```
/bdk:change  ->  /bdk:design  ->  [gate]  /bdk:plan  ->  /bdk:execute  ->  /bdk:cr  ->  [gate]  /bdk:close
```

- `/bdk:design` writes the design with you and has it verified against the code by an independent agent.
- `/bdk:plan` splits the work into plan parts of task contracts with concrete test cases, and has them verified.
- `/bdk:execute` builds every ready part through role agents, one commit per task, each task done only with evidence that its scoped tests and lint passed.
- `/bdk:cr` reviews the Change in rounds and runs the full test and lint suite once.
- `/bdk:close` merges the Change's spec deltas into the living specs in `.bdk/specs/`, archives the Change and prints the PR summary.

Two **gates** stop the Change for your decision: after the design and after the review. Only a command you type passes one, `/bdk:plan` or `/bdk:close`, so the model cannot pass a gate for you; `policy.gates` set to `auto`, or `/bdk:run --auto`, lets the pipeline pass them and lists each such pass in the PR summary. Every retry has a budget, one escalation to a stronger model, and then a question to you. [The Change pipeline](docs/guide/concepts/change-pipeline.md) explains the state, the artifact graph, tickets, evidence and living specs.

## Profiles

The profile decides how much process a Change gets. `/bdk:change` picks it from the code the intent touches, and the kernel only ever raises it.

| Profile | When                                                                      | Stages                                                   |
| ------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `tiny`  | At most 2 files in 1 module, no behaviour, schema or configuration change | change, plan, execute, review, close                     |
| `small` | Most work; the default                                                    | change, design, plan, execute, review, close             |
| `large` | A design across three or more subsystems                                  | the same, with design parts and plan parts run as a tree |

A bug fix is a `bug` Change: no design, a plan with the failing test and the fix. See [Tiny](docs/guide/workflows/tiny.md), [Small](docs/guide/workflows/small.md), [Large](docs/guide/workflows/large.md) and [Debugging](docs/guide/workflows/debugging.md).

## Configuration

Settings merge from four layers, lowest first: the plugin defaults, your global file (`~/.config/bdk/settings.yaml`), the project's `.bdk/settings.yaml` and a personal, uncommitted `.bdk/settings.local.yaml`. The project file carries a modeline to the JSON Schema, so an editor completes and validates keys, and the kernel refuses a key it does not declare.

```sh
bdk config show policy          # the merged value with its defaults
bdk config show --origins       # which layer set each value
bdk config set policy.gates.review auto
```

[Configuration](docs/guide/reference/configuration.md) lists every key with its default.

## Rules and the learning funnel

A rule is a choice among valid alternatives that BDK or your project made and wants followed, one file per rule, named by its id. BDK ships a language-agnostic pack (`BDK-CQ`, `BDK-ARCH`, `BDK-SEC`, ...) and language packs selected by `languages`; your project adds its own in `.bdk/rules/` and switches any off with `rules.disabled`. Each agent reads the rules for its role and files and cites the ids it applied.

A lesson does not become a rule by itself. It is recorded as a `learning` entry of the Change; `/bdk:rules audit` groups the recurring ones, proposes rules, adopts the ones you accept through `bdk rules accept`, and prunes the rules nobody cites. See [Quality and language rules](docs/guide/concepts/quality-and-language-rules.md) and [Rules hygiene](docs/guide/workflows/rules-hygiene.md).

## Skills

Invoke with `/bdk:<skill-name>`:

| Skill                | Description                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bdk:setup`         | Prepare a project for BDK: `.bdk/settings.yaml` with its test, lint and build commands, Lavish, hand-written rules, migration from BDK 2. Run once per project or after cloning                    |
| `/bdk:change`        | Open a Change from an intent, or show, list, resume, park or take over one, and name the command to type next                                                                                      |
| `/bdk:run`           | Carry a Change through the stages for you, from an intent to the close; records each choice for the next gate; `--auto` passes every ready gate                                                    |
| `/bdk:design`        | Design the active Change with you: two or more approaches with Mermaid and self-critique, decisions in the ledger, verified, ending at the design gate                                             |
| `/bdk:verify-design` | Verify the design of the active Change against the code on a fresh context                                                                                                                         |
| `/bdk:plan`          | Plan the active Change as plan parts of task contracts with concrete test cases, verify and correct them, and report the waves; `--review` asks for your acceptance first                          |
| `/bdk:verify-plan`   | Verify the plan of the active Change against the code and the design on a fresh context                                                                                                            |
| `/bdk:execute`       | Build the verified plan through role agents: every ready part in one run, flat or with one lead per part, one commit per task                                                                      |
| `/bdk:cr`            | Review the Change in rounds: a reviewer per group, an integration reviewer and a gate runner; fixes the blocking findings, then you decide the rest. Opens a review Change on a branch without one |
| `/bdk:close`         | Close the reviewed Change: merge its spec deltas, archive it in one commit and report the PR summary                                                                                               |
| `/bdk:pr-review`     | Review GitHub PRs from URLs against their intent; you decide each finding before one review per PR posts; `--quick`, `--verify`                                                                    |
| `/bdk:commit`        | Commit your own changes with a Conventional Commits message written from the diff and the project's convention                                                                                     |
| `/bdk:adr`           | Record one architecture decision as MADR under `docs/adr/`                                                                                                                                         |
| `/bdk:docs`          | Write architecture documentation for a code path, or refresh an existing document against the code                                                                                                 |
| `/bdk:rules`         | Audit recurring lessons into project rules, capture one lesson, or check the rule files and their `.claude/rules/` projection                                                                      |
| `/bdk:doctor`        | Diagnose the BDK installation with `bdk doctor`, apply the safe repairs, and walk the rest with you                                                                                                |
| `/bdk:diagnose`      | Analyze one session from its run journal, report and transcript slices into a cited analysis. By hand only                                                                                         |
| `/bdk:bdk-cli`       | Point the agent at the kernel CLI and its `--help`                                                                                                                                                 |

[Skills](docs/guide/reference/skills.md) describes each one; [Agents](docs/guide/reference/agents.md) lists the role agents the skills start.

## Migration from v2

BDK 3 replaces BDK 2 completely, and BDK 2 gets no support after 3.0. Run `/bdk:setup` once to move a project over; [Migration from v2](docs/guide/getting-started/migration-from-v2.md) lists the steps and what each removed skill and file became.

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, authoring conventions, and how to add skills and agents.
