# Project setup

`/bdk:setup` brings a project to a working BDK layout: `.bdk/settings.yaml` with
the project's languages and its test, lint and build commands, Lavish for the
design conversations, and the migration from BDK 2. It is done when `bdk config check` exits 0 and `bdk doctor` reports
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

| Step           | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnosis      | `bdk doctor` decides the path: a v2 layout is migrated first, a v3 project with settings is shown, anything else is detected.                                                                                                                                                                                                                                                                                                                                 |
| Detection      | Reads the project files (`package.json` and its lockfile, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `*.csproj`, `pubspec.yaml`) for the languages and the test, lint and build commands. A lockfile decides the package manager.                                                                                                                                                                       |
| Confirmation   | Asks you, in one `AskUserQuestion` call, which detected commands to keep; "Other" adds one it did not find. Tiers and scoped forms follow from the runner and are never questions.                                                                                                                                                                                                                                                                            |
| Settings       | Writes every confirmed command with `bdk config set`, one tool entry per call, with its `id`, `tier` and scoped forms. The kernel validates each value, keeps the schema modeline and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`. The skill never edits `.bdk/` itself.                                                                                                                                                           |
| Tool isolation | Finds the project's tools that read Markdown, YAML or JSON (markdownlint, prettier, ESLint with a Markdown plugin and others) and the scripts that list files themselves, and asks in one multi-select which of them get `.bdk/` in their ignore list. It writes the entries you accept, runs your lint commands once to show any path under `.bdk/` they still report, and commits only those files, as `chore(bdk): keep .bdk/ out of the project's tools`. |
| Lavish         | Checks `lavish-axi`. When it is missing, offers `npm install -g lavish-axi`; if you decline, sets `features.lavish` to `false`.                                                                                                                                                                                                                                                                                                                               |
| Finish         | Runs `bdk doctor --fix`, `bdk config check` and `bdk doctor`, and reports.                                                                                                                                                                                                                                                                                                                                                                                    |

On Claude Code the agents ship with the plugin, so setup does not export them
into the project.

### A project without tests or a linter

`tools.test` and `tools.lint` each have three states, and BDK treats them
differently:

| State         | In `.bdk/settings.yaml`          | What a Change does                                                                                                                                              |
| ------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configured    | one or more entries              | Runs the group's scoped checks after each task and its full check before the review.                                                                            |
| Declared none | `lint: none` under `tools`       | Skips the group's steps. `bdk change status`, the review report and the PR summary say the group was not used; for tests they warn that the Change ran no test. |
| Unset         | the key is absent in every layer | `bdk change new` and `bdk part start` refuse with `policy/tools-unset`, naming the commands that fix it, so a run never stops late for a missing setting.       |

When setup finds no test runner or no linter, it asks whether the project runs
without one and, on a yes, writes the declared-none state:

```
bdk config set tools.lint none
```

Adding an entry later replaces `none`. An empty list (`lint: []`) is refused by
`bdk config check`, so the two states never look alike.

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

A project with the v2 layout is migrated first: setup replaces the v2 ignore
rule, offers the v2 settings as detected values and deletes the v2 files, each
after you confirm. [Migration from v2](migration-from-v2.md) lists every step,
the v2 keys, skills and paths and what each became.

### Why `.bdk/` stays out of your tools

Everything BDK commits under `.bdk/` is written by the kernel, and parts of it
are hashed byte for byte: the inputs of each finished pipeline step and every
living spec. A linter that reads those files fails on Markdown it did not
write, and a formatter that rewrites them makes finished work stale (a reviewed
Change goes back to its plan) and makes `bdk doctor` report the living spec as
edited by hand. Excluding `.bdk/` in each tool's own ignore list also covers
pre-commit wrappers such as lint-staged. Prettier needs no exclusion: the
kernel writes `.bdk/.prettierrc`, a guard that keeps Prettier off `.bdk/`, and
the session start warns when it is missing. If you decline, BDK's agents never
"fix" your tool configuration: they log a `question` that points back to
`/bdk:setup`.

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
- each tool group declared none, and for tests that no Change will run a test;
- what was imported, deleted, or not carried over from v2;
- the tools kept off `.bdk/`, and each one you declined;
- every remaining `doctor` finding with its repair;
- the next step, `/bdk:change "<what you want to build>"`.

## Next step

Open a Change for what you want to build:

```
/bdk:change "Add a dark mode toggle to the settings page"
```

`/bdk:change` asks whether to work on a new branch (`feat/<slug>`, or
`fix/<slug>` for a bug) or the current one, binds the Change to that branch and
names the stage to type next. See [Skills](../reference/skills.md#bdk-change).
