---
name: setup
description: Prepares a project for BDK - settings with its test, lint and build commands, Lavish, the tracker, hand-written rules, migration from BDK 2. Use when starting BDK in a project or after cloning, or when BDK reports missing settings or a v2 layout.
argument-hint: "[what to change, e.g. 'add the e2e suite']"
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Bash(npx -y lavish-axi --help) Bash(gh auth status) Bash(git remote get-url origin) Read Grep Glob AskUserQuestion
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill setup 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: setup" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill setup` first and apply its output; on a `BDK STOP` line, stop and report it.

# Setup

Bring this project to a working BDK layout. Done when `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true`, or when every remaining `doctor` finding is reported to the user with its repair. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

The "Project commands" sections above show the settings the project has now; "none configured" means that group is empty.

Arguments: $ARGUMENTS

When the arguments name a change ("add the e2e suite"), do only that, then go to "Finish".

## Constraints

- Write settings only with `bdk config set`, one key or tool entry per call. The kernel validates each value, keeps the schema modeline and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`; never edit `.bdk/` files yourself.
- Ask the user only what the project files cannot tell you: which detected commands to keep, whether to import rules, whether to delete v2 files, whether to install Lavish, where findings are tracked. Tiers, scoped forms, profiles and sizes follow from the runner or are measured by the kernel later, so they are never questions.
- Ask with `AskUserQuestion`, several questions in one call where they are independent. A multi-select with one option per detected command lets the user drop or add commands; the host adds "Other" for a command you did not find.
- Do not run `bdk export agents`: on Claude Code the agents ship with the plugin, and a copy in the project would register each one twice.

## Start from the diagnosis

`bdk doctor --json` decides the path:

- `layout: v2`: migrate the project as [the v2 migration](references/v2-migration.md) describes, then continue with the settings.
- `layout: v3` with settings in every group the project needs: show them and change only what the user asks for.
- Otherwise detect the stack.

## Settings

Detect the languages and the `test`, `lint` and `build` commands from the project files with [the stack table](references/stacks.md). Confirm the full commands with the user, then write each confirmed command as one entry with its `id`, `tier` and the scoped forms the table gives for its runner, and `languages` as one list.

A refused `config set` (exit 2 `policy/config-invalid`) names the key and the reason. When the key is one you set, correct the value and set it again. When the file already held the invalid value, every `config set` is refused until it is gone: set the enclosing key the `why` names (a whole tool group as `bdk config set tools.<group> '[{id: ..., tier: ..., command: ...}]'`) with its corrected full value. That is how this skill does the "fix .bdk/settings.yaml" of `instead`.

## Lavish

BDK's design conversations use Lavish when `features.lavish` is on, the default. Run `npx -y lavish-axi --help`. When it fails, show the error and offer to install it with `npm install -g lavish-axi`; when the user declines, or the network is unavailable, run `bdk config set features.lavish false`.

## Tracker

The review report offers `track` for an entry only while `tracker` is set. When `bdk config show tracker --json` shows no value, propose one:

- When `gh auth status` exits 0 and `git remote get-url origin` names `github.com`, propose GitHub issues; on a yes run `bdk config set tracker '{kind: github}'`.
- Otherwise ask whether findings go to another tracker. When the user names one, ask how an issue is filed there (a CLI or an MCP server and its project) and run `bdk config set tracker '{kind: instruction, instruction: "<their description>"}'`.

A declined proposal leaves `tracker` unset.

## Hand-written rules

When `.claude/rules/` holds Markdown files other than the generated `bdk-generated*.md`, show `bdk rules import --dry-run --json` and ask whether to import them. After `bdk rules import --json` the generated projection carries their rules, so offer to delete the imported source files; a file the import skipped stays, with the reason the output gives. BDK's own `BDK-*` rules come from the plugin and are never imported.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP`, exit 4 or exit 5: stop and report the output to the user.

## Finish

Run `bdk doctor --fix --json`, which writes the schema copy and the modeline, then `bdk config check --json` and `bdk doctor --json`, and report in a few lines:

- each tool entry as `<tier> <id>: <command>` with its scoped forms, so a wrong derivation is caught now by the person who knows the project;
- what was imported, deleted, or not carried over from v2;
- the tracker, or that the review report offers no `track` while it is unset;
- every remaining `doctor` finding with its repair;
- that `.bdk/settings.yaml` belongs in git, so the team shares the commands, and that personal overrides go to `.bdk/settings.local.yaml`;
- the next step: `/bdk:change "<what you want to build>"`.
