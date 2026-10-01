# Project setup

`/bdk:setup` brings a project to a working BDK layout: `.bdk/settings.yaml` with
the project's languages and its test, lint and build commands, Lavish for the
design conversations, your hand-written rules as BDK rules, and the migration
from BDK 2. It is done when `bdk config check` exits 0 and `bdk doctor` reports
no finding, or when every finding left is reported to you with its repair.

Type it yourself; the skill is user-invocable only, so Claude will not start it
on its own.

```
/bdk:setup
```

Run it again whenever you like: on a project that already has settings it shows
them and changes only what you ask for. To change one thing, name it:

```
/bdk:setup add the e2e suite
```

## What it does

| Step               | What happens                                                                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnosis          | `bdk doctor` decides the path: a v2 layout is migrated first, a v3 project with settings is shown, anything else is detected.                                                                                                                                                                       |
| Detection          | Reads the project files (`package.json` and its lockfile, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `*.csproj`, `pubspec.yaml`) for the languages and the test, lint and build commands. A lockfile decides the package manager.             |
| Confirmation       | Asks you, in one `AskUserQuestion` call, which detected commands to keep; "Other" adds one it did not find. Tiers and scoped forms follow from the runner and are never questions.                                                                                                                  |
| Settings           | Writes every confirmed command with `bdk config set`, one tool entry per call, with its `id`, `tier` and scoped forms. The kernel validates each value, keeps the schema modeline and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`. The skill never edits `.bdk/` itself. |
| Lavish             | Checks `lavish-axi`. When it is missing, offers `npm install -g lavish-axi`; if you decline, sets `features.lavish` to `false`.                                                                                                                                                                     |
| Hand-written rules | When `.claude/rules/` holds your own Markdown rules, shows what `bdk rules import` would make of them and imports them if you agree, then offers to delete the source files the generated projection now carries.                                                                                   |
| Finish             | Runs `bdk doctor --fix`, `bdk config check` and `bdk doctor`, and reports.                                                                                                                                                                                                                          |

On Claude Code the agents ship with the plugin, so setup does not export them
into the project.

### Why tiers matter

BDK runs scoped checks while a Change is executed and the full suite once, at
its end. That only works if each tool entry says which class of check it is
and how to narrow it. A test entry is `fast` or `e2e`; a lint entry is `lint`,
`format` or `typecheck`. Setup derives the tier and the scoped forms from the
runner, for example `npx vitest run {files}` for Vitest, where `{files}` is the
path list BDK substitutes. A tool that takes no path list gets no scoped form:
a missing form makes BDK fall back cleanly, a broken one would quietly run the
wrong thing.

## From BDK 2

A project with `.bdk/settings.json` or `.bdk/plans/` has the v2 layout, and
the session start says so. `/bdk:setup` migrates it:

- `.bdk/settings.json` is read as hints: its languages and its test, lint and
  build tools become v3 tool entries and `features.lavish` carries over. Every
  value is confirmed like a detected one and written with `bdk config set`.
  Quality or language rule overrides are named with their v3 key
  (`prompts.files`) and set only when you ask; any other key is reported as not
  carried over.
- v2 plans, designs, run manifests and verification reports have no v3
  counterpart. After you confirm, setup deletes `.bdk/settings.json`,
  `.bdk/plans/`, `.bdk/design/`, `.bdk/runs/` and `.bdk/verify-plan/`; if you
  decline, they stay and `bdk doctor` keeps reporting the v2 layout.

## What gets written

```
.bdk/
├── settings.yaml          # tracked: the team shares the commands
├── settings.local.yaml    # ignored: your personal overrides
├── rules/                 # tracked: imported rules, when you had any
└── .machine/              # ignored: caches and the schema copy
```

Commit `.bdk/settings.yaml`, so the whole team uses the same commands. Put a
personal override, such as a different test command on your machine, in
`.bdk/settings.local.yaml`. The full map is in
[Artifacts](../reference/artifacts.md).

## The report

Setup ends with a few lines you should read before moving on:

- each tool entry as `<tier> <id>: <command>` with its scoped forms, so a wrong
  derivation is caught now by the person who knows the project;
- what was imported, deleted, or not carried over from v2;
- every remaining `doctor` finding with its repair;
- the next step, `/bdk:change "<what you want to build>"`.

## Next step

Open a Change for what you want to build:

```
/bdk:change "Add a dark mode toggle to the settings page"
```

`/bdk:change` asks whether to work on a new branch (`feat/<slug>`, or
`fix/<slug>` for a bug) or the current one, binds the Change to that branch and
names the stage to type next. See [Skills](../reference/skills.md#bdkchange).
