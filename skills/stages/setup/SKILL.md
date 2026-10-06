---
name: setup
description: Prepares a project for BDK - settings with its test, lint and build commands, Lavish, the tracker, migration from BDK 2. Use when starting BDK in a project or after cloning, or when BDK reports missing settings or a v2 layout.
argument-hint: "[what to change, e.g. 'add the e2e suite']"
disable-model-invocation: true
allowed-tools: Bash(bdk *) Bash(echo *) Bash(npx -y lavish-axi --help) Bash(gh auth status) Bash(git remote get-url origin) Bash(git add *) Bash(git commit *) Read Edit Write Grep Glob AskUserQuestion
---

!`bdk ctx skill setup 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: setup" heading appears above, run `bdk ctx skill setup` first and apply its output; on a `BDK STOP` line, stop and report it.

# Setup

Bring this project to a working BDK layout. Done when `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true`, or when every remaining `doctor` finding is reported to the user with its repair. Add `--json` to every command whose output you act on.

The "Project commands" sections above show the settings the project has now. "declared none" means the project runs without a tool of that group; "unset: no command configured" means no layer sets the group yet, and `bdk change new` refuses until it is set; "none configured" means `build` has no entry.

Arguments: $ARGUMENTS

When the arguments name a change ("add the e2e suite"), do only that, then go to "Finish".

## Constraints

- Write settings only with `bdk config set`, one key or tool entry per call. The kernel validates each value, keeps the schema modeline and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`; never edit `.bdk/` files yourself. The only project files you edit are the ignore lists of its tools and a v2 rule that ignores `.bdk/`, each after the user accepts it.
- Ask the user only what the project files cannot tell you: which detected commands to keep, whether a project without a test or lint tool runs without one, which tools to keep off `.bdk/`, whether to import rules, whether to delete v2 files, whether to replace the v2 ignore rule, whether to install Lavish, where findings are tracked. Tiers, scoped forms, profiles and sizes follow from the runner or are measured by the kernel later, so they are never questions.
- Ask with `AskUserQuestion`, several questions in one call where they are independent. A multi-select with one option per detected command lets the user drop or add commands; the host adds "Other" for a command you did not find.
- Do not run `bdk export agents`: on Claude Code the agents ship with the plugin, and a copy in the project would register each one twice.

## Start from the diagnosis

`bdk doctor --json` decides the path:

- A `bdk-ignored` finding, with any layout: replace the rule as [the v2 ignore rule](references/v2-migration.md#the-v2-ignore-rule) describes before you write any setting.
- `layout: v2`: migrate the project as [the v2 migration](references/v2-migration.md) describes, then continue with the settings.
- `layout: v3` with `test` and `lint` each configured or declared none: show the settings and change only what the user asks for.
- Otherwise detect the stack.

## Settings

Detect the languages and the `test`, `lint` and `build` commands from the project files with [the stack table](references/stacks.md). Confirm the full commands with the user, then write each confirmed command as one entry with its `id`, `tier` and the scoped forms the table gives for its runner, and `languages` as one list.

`test` and `lint` are never left unset. When no command of one of them is found or kept, ask whether the project runs without one. On a yes, run `bdk config set tools.<group> none`: the Change skips that group's steps, and status, the review report and the PR summary say it was not used. On a no, ask for the command and write it as an entry. `build` may stay empty.

A refused `config set` (exit 2 `policy/config-invalid`) names the key and the reason. When the key is one you set, correct the value and set it again. When the file already held the invalid value, every `config set` is refused until it is gone: set the enclosing key the `why` names (a whole tool group as `bdk config set tools.<group> '[{id: ..., tier: ..., command: ...}]'`) with its corrected full value. That is how this skill does the "fix .bdk/settings.yaml" of `instead`.

## Keep `.bdk/` out of the project's tools

The files BDK commits under `.bdk/` are written by the kernel and hashed byte for byte. A project linter that reads them fails on them, and a formatter that rewrites them makes finished work stale. Keep every tool of the project off them:

1. With [the ignore lists](references/stacks.md#ignore-lists), find each tool of the project that reads Markdown, YAML or JSON, and each project script that lists files itself, such as with `git ls-files`. Skip one whose ignore list already covers `.bdk/`.
2. Ask one multi-select with `AskUserQuestion`: one option per file, labelled with the file and the entry it gets (`.markdownlint-cli2.mjs: ignores ".bdk/**"`), all of them recommended.
3. Write each accepted entry as the smallest edit to that tool's own ignore list; create the ignore file only where the table says so.
4. Run the `command` of every `tools.lint` entry once, never a formatter's write mode, and look for every path under `.bdk/` in the output. A path there means an exclusion is missing: offer it, as in step 2. Report other failures as the project's own; fixing them is not this skill's work.
5. When you edited files, commit only the files you edited, in a commit of their own: `git add <files>`, then `git commit -m "chore(bdk): keep .bdk/ out of the project's tools" -- <files>`.

## Lavish

BDK's design conversations use Lavish when `features.lavish` is on, the default. Run `npx -y lavish-axi --help`. When it fails, show the error and offer to install it with `npm install -g lavish-axi`; when the user declines, or the network is unavailable, run `bdk config set features.lavish false`.

## Tracker

The review report offers `track` for an entry only while `tracker` is set. When `bdk config show tracker --json` shows no value, propose one:

- When `gh auth status` exits 0 and `git remote get-url origin` names `github.com`, propose GitHub issues; on a yes run `bdk config set tracker '{kind: github}'`.
- Otherwise ask whether findings go to another tracker. When the user names one, ask how an issue is filed there (a CLI or an MCP server and its project) and run `bdk config set tracker '{kind: instruction, instruction: "<their description>"}'`.

A declined proposal leaves `tracker` unset.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP`, exit 4 or exit 5: stop and report the output to the user.

## Finish

Run `bdk doctor --fix --json`, which writes the schema copy and the modeline, then `bdk config check --json` and `bdk doctor --json`, and report in a few lines:

- each tool entry as `<tier> <id>: <command>` with its scoped forms, so a wrong derivation is caught now by the person who knows the project;
- each group declared none; for `test`, that no Change of the project will run a test;
- what was imported, deleted, or not carried over from v2, and whether the v2 ignore rule was replaced;
- the exclusions committed, and each declined exclusion with its consequence: agents log a `question` naming `/bdk:setup` when that tool reports a `.bdk/` file;
- the tracker, or that the review report offers no `track` while it is unset;
- every remaining `doctor` finding with its repair;
- that `.bdk/settings.yaml` belongs in git, so the team shares the commands, and that personal overrides go to `.bdk/settings.local.yaml`;
- the next step: `/bdk:change "<what you want to build>"`.
