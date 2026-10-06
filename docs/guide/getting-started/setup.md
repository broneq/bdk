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

| Step           | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnosis      | `bdk doctor` decides the path: a v2 layout is migrated, a v3 project with settings is shown, anything else is detected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Lavish         | Checks `lavish-axi` first, since the questions use it. When it is missing, offers `npm install -g lavish-axi`; if you decline, the questions go to the terminal and `features.lavish` is set to `false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Detection      | Reads the project files (`package.json` and its lockfile, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `*.csproj`, `pubspec.yaml`) for the languages and the test, lint and build commands, with the tier and scoped forms each runner gives. It also reads the install command a new worktree runs (from the lockfile), the Markdown sources your build or tests read (a docs build, fixtures), extra documentation formats and the normative word of your existing specs; finds the project's tools that read Markdown, YAML or JSON (markdownlint, prettier, ESLint with a Markdown plugin and others) and the scripts that list files themselves; the review risks with the files each one matches; and the tracker. Nothing is written yet. |
| Questions      | Puts every question on one Lavish page: the v2 files, the commands to keep (a test or lint group without a command asks whether the project has none), the values read from your files, which tools keep `.bdk/` in their ignore list, who passes the design and review gates, which review risks apply and which to add, where review findings are tracked. A section that has nothing to ask is left out. Without Lavish, each section is a terminal question of its own.                                                                                                                                                                                                                                                                                                                          |
| Writes         | Writes the answers with `bdk config set`, one key or tool entry per call and only where they differ from the defaults. The kernel validates each value, keeps the schema modeline and adds `/.bdk/.machine/` and `/.bdk/settings.local.yaml` to `.gitignore`. The skill never edits `.bdk/` itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Tool isolation | Adds `.bdk/` to the ignore list of each tool you accepted, runs your lint commands once to show any path under `.bdk/` they still report, and commits only those files, as `chore(bdk): keep .bdk/ out of the project's tools`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Finish         | Runs `bdk doctor --fix`, `bdk config check` and `bdk doctor`, and reports.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

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
├── rules/                 # tracked: the rules you adopt with `bdk rules accept`
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
- each other derived value written, with the file it came from, and the gates
  and review risks you changed;
- what was deleted or not carried over from v2;
- the tools kept off `.bdk/`, and each one you declined;
- every key setup leaves on its default, grouped by area, with its value and
  the layer when a file sets it, so you see the whole settings surface once;
  [Configuration](../reference/configuration.md) describes each;
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
