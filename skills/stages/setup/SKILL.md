---
name: setup
description: Prepares a project for BDK - settings derived from its files, gates, review risks, tracker, Lavish, v2 migration. Use when starting BDK in a project or after cloning, or when BDK reports missing settings or a v2 layout.
argument-hint: "[what to change, e.g. 'add the e2e suite']"
disable-model-invocation: true
allowed-tools: Bash(bdk *) Bash(echo *) Bash(npx -y lavish-axi *) Bash(gh auth status) Bash(git remote get-url origin) Bash(git add *) Bash(git commit *) Bash(date +%Y%m%d-%H%M%S) Read Edit Write Grep Glob AskUserQuestion
---

!`bdk ctx skill setup 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: setup" heading appears above, run `bdk ctx skill setup` first and apply its output; on a `BDK STOP` line, stop and report it.

# Setup

Bring this project to a working BDK layout. Done when `bdk config check` exits 0 and `bdk doctor --json` reports `ok: true`, or when every remaining `doctor` finding is reported to the user with its repair. Add `--json` to every command whose output you act on.

The "Project commands" sections above show the settings the project has now. "declared none" means the project runs without a tool of that group; "unset: no command configured" means no layer sets the group yet, and `bdk change new` refuses until it is set; "none configured" means `build` has no entry.

The "Setup coverage" section above lists every settings key with its value and the layer it comes from, in three groups: "Derived" keys you read from the project files, "Asked" keys you ask the user about, and "Not set by setup" keys you never write. The kernel owns that grouping; follow it, not a list of your own.

Arguments: $ARGUMENTS

When the arguments name a change ("add the e2e suite"), do only that, then go to "Finish".

## Constraints

- Write settings only with `bdk config set`, one key or tool entry per call. The kernel validates each value, keeps the schema modeline and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`; never edit `.bdk/` files yourself. The only project files you edit are the ignore lists of its tools, a v2 rule that ignores `.bdk/`, each after the user accepts it, and the setup page under `.lavish/`.
- Ask the user only what the project files cannot tell you: which detected commands and derived values to keep, whether a project without a test or lint tool runs without one, who passes the gates, which review risks apply, where findings are tracked, which tools to keep off `.bdk/`, whether to delete v2 files, whether to replace the v2 ignore rule, whether to install Lavish. Tiers and scoped forms follow from the runner, and every key under "Not set by setup" stays on its default, so none of them is a question.
- Detect everything first and write nothing until the user has answered: every question goes on one page, in "Ask", and the writes follow in "Apply". The one question asked before it is whether to install Lavish, which the page needs.
- Write a key only when the value differs from the one the coverage shows. A confirmed default is not written, so a later change of the default still reaches the project.
- Do not run `bdk export agents`: on Claude Code the agents ship with the plugin, and a copy in the project would register each one twice.

## Start from the diagnosis

`bdk doctor --json` decides the path:

- A `bdk-ignored` finding, with any layout: the page asks to replace the rule as [the v2 ignore rule](references/v2-migration.md#the-v2-ignore-rule) describes, and "Apply" replaces it before you write any setting.
- `layout: v2`: migrate the project as [the v2 migration](references/v2-migration.md) describes; its settings are the detected values and its files a question of the page.
- `layout: v3` with `test` and `lint` each configured or declared none: show the settings and change only what the user asks for.
- Otherwise detect the stack.

## Lavish

The setup page and BDK's design conversations use Lavish when `features.lavish` is on, the default. Run `npx -y lavish-axi --help`. When it fails, show the error and ask with `AskUserQuestion` whether to install it with `npm install -g lavish-axi`. When the user declines, or the network is unavailable, "Apply" runs `bdk config set features.lavish false`, and "Ask" uses the terminal.

## Settings

Detect the languages and the `test`, `lint` and `build` commands from the project files with [the stack table](references/stacks.md): each command with its `id`, `tier`, the scoped forms the table gives for its runner, and the file it came from.

Derive the other keys under "Derived" with the same table, each with the file it came from:

- `execution.worktree.setup.command`: [the install command of the lockfile](references/stacks.md#worktree-setup-command).
- `policy.evidence.build-config` and `policy.evidence.non-executable`: [the globs to append](references/stacks.md#evidence-globs).
- `spec.normative-word`: [the word the project's specs carry](references/stacks.md#normative-word), only when it is not `SHALL`.

A key already set by a layer is shown, not derived again. `test` and `lint` are never left unset: a group with no command found is a question of the page, answered with a command or with "the project has none". `build` may stay empty.

## Keep `.bdk/` out of the project's tools

The files BDK commits under `.bdk/` are written by the kernel and hashed byte for byte. A project linter that reads them fails on them, and a formatter that rewrites them makes finished work stale. With [the ignore lists](references/stacks.md#ignore-lists), find each tool of the project that reads Markdown, YAML or JSON, and each project script that lists files itself, such as with `git ls-files`, and the entry each one's ignore list gets (`.markdownlint-cli2.mjs: ignores ".bdk/**"`). Skip one whose ignore list already covers `.bdk/`. The page offers them as one multi-select, all of them recommended.

## Gates, risks and tracker

The keys under "Asked" are decisions of the team: who passes the gates (`policy.gates.design`, `policy.gates.review`), which review risks apply (`review.risks`), and where findings are tracked (`tracker`). Ask them while they show their defaults; when a layer already sets one, show it and ask only on the user's request. Prepare:

- for each risk of the coverage, up to three project files its `paths` match (find them with Glob), or none;
- for the tracker, while unset: GitHub when `gh auth status` exits 0 and `git remote get-url origin` names `github.com`, with that as the reason; otherwise no proposal, with the reason found.

## Ask

When `features.lavish` is on and `npx -y lavish-axi --help` ran, ask everything through [the setup page](references/setup-page.html). Copy it to `.lavish/bdk-setup-<stamp>.html`, `<stamp>` being the output of `date +%Y%m%d-%H%M%S`: Lavish never reopens a page whose session the user ended, so each run needs a page of its own. Replace only the JSON of its `setup-data` block, as its example shows: `v2` (the ignore rule and the v2 paths), `commands` (the entries and the groups `missing`), `derived`, `exclusions`, `gates`, `risks` with their matched files and `enabled`, and `tracker` (`current`, `proposal`, `reason`). Set a key to `null` when it has nothing to ask, so its section is left out. Open it with `npx -y lavish-axi <page>`, then wait with `npx -y lavish-axi poll <page>` in the foreground. Each section returns one prompt whose `data` holds `{question, answer}`:

| `question`   | `answer`                                                                  |
| ------------ | ------------------------------------------------------------------------- |
| `v2`         | `{replaceIgnoreRule, deletePaths}`                                        |
| `commands`   | `{keep, drop, add: [{group, command}], none}`, an entry as `<group>/<id>` |
| `derived`    | `{keep, drop}`, by key                                                    |
| `exclusions` | `{accept, decline}`, by file                                              |
| `gates`      | `{design, review}`                                                        |
| `risks`      | `{keep, off, add: [{id, paths, instruction}]}`                            |
| `tracker`    | `{kind}`, or `{kind: instruction, instruction}`                           |

A section without an answer stays open: poll again until every section is answered or the user ends the session. A section still open then, a non-zero exit, or a reply that does not parse is asked in the terminal as below; never reopen a session the user ended. An answer you cannot apply as given, such as a command no tool of the project runs, is asked again in the terminal with the reason.

In the terminal, ask each section in an `AskUserQuestion` call of its own, in the page's order, so the user weighs one at a time. The host takes four options per question: split a longer list into multi-select questions of at most four, such as the six default risks as `auth`, `migration`, `secrets`, then `public-api`, `dependencies`, `configuration`. Gates: one question per gate, `manual` first (recommended: the user reads the design or the review report, then types `/bdk:plan` or `/bdk:close`), then `auto`. Tracker: the proposal first, then "None"; when there is no proposal, ask whether findings go to another tracker and, when the user names one, how an issue is filed there (a CLI or an MCP server and its project).

## Apply

Write the answers in this order, each only where it differs from the coverage:

1. The v2 ignore rule, when accepted, as [the v2 ignore rule](references/v2-migration.md#the-v2-ignore-rule) describes, with its commit; then the v2 files, when their deletion is accepted.
2. The commands: each kept or added command as one entry with its `id`, `tier` and scoped forms, `languages` as one list, and `bdk config set tools.<group> none` for a group the user said has none: the Change skips that group's steps, and status, the review report and the PR summary say it was not used.
3. The derived values kept: `bdk config set execution.worktree.setup.command '<command>'`, each evidence list written whole with `bdk config set policy.evidence.<list> '[...]'` (the kernel appends it to the defaults), `bdk config set spec.normative-word MUST`.
4. The asked keys: a gate `bdk config set policy.gates.<gate> auto`; a dropped risk `bdk config set review.risks.<id>.enabled false`; an added risk `bdk config set review.risks.<id> '{instruction: "<text>", paths: ["<glob>"]}'`, with a kebab-case `<id>`; GitHub `bdk config set tracker '{kind: github}'`, another tracker `bdk config set tracker '{kind: instruction, instruction: "<their description>"}'`. A declined tracker proposal leaves `tracker` unset; the review report then offers no `track`.
5. `bdk config set features.lavish false` when the user declined the install.
6. The accepted exclusions, each as the smallest edit to that tool's own ignore list; create the ignore file only where the table says so. Then run the `command` of every `tools.lint` entry once, never a formatter's write mode, and look for every path under `.bdk/` in the output. A path there means an exclusion is missing: add it to the page as a new `exclusions` section and ask again, or ask in the terminal. Report other failures as the project's own; fixing them is not this skill's work. When you edited files, commit only the files you edited, in a commit of their own: `git add <files>`, then `git commit -m "chore(bdk): keep .bdk/ out of the project's tools" -- <files>`.

A refused `config set` (exit 2 `policy/config-invalid`) names the key and the reason. When the key is one you set, correct the value and set it again. When the file already held the invalid value, every `config set` is refused until it is gone: set the enclosing key the `why` names (a whole tool group as `bdk config set tools.<group> '[{id: ..., tier: ..., command: ...}]'`) with its corrected full value. That is how this skill does the "fix .bdk/settings.yaml" of `instead`.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP`, exit 4 or exit 5: stop and report the output to the user.

## Finish

Run `bdk doctor --fix --json`, which writes the schema copy and the modeline, then `bdk config check --json` and `bdk doctor --json`, and report in a few lines:

- each tool entry as `<tier> <id>: <command>` with its scoped forms, so a wrong derivation is caught now by the person who knows the project;
- each other derived value written, with the file it came from;
- the gates and the review risks: the ones kept on their defaults, and each one changed;
- each group declared none; for `test`, that no Change of the project will run a test;
- what was deleted or not carried over from v2, and whether the v2 ignore rule was replaced;
- the exclusions committed, and each declined exclusion with its consequence: agents log a `question` naming `/bdk:setup` when that tool reports a `.bdk/` file;
- the tracker, or that the review report offers no `track` while it is unset;
- every key under "Not set by setup", grouped by its first segment (`policy`, `execution`, `agents`, ...), each with its value, and the layer when it is not `default`; say that any of them is changed with `bdk config set <key> <value>` and that `docs/guide/reference/configuration.md` describes each;
- every remaining `doctor` finding with its repair;
- that `.bdk/settings.yaml` belongs in git, so the team shares the commands, and that personal overrides go to `.bdk/settings.local.yaml`;
- the next step: `/bdk:change "<what you want to build>"`.
