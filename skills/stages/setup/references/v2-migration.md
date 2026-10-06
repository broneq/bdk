# Migrating a BDK 2 Project

BDK 3 never reads the v2 state. This skill moves the project over once, with the user's confirmation, and no kernel command does it for you.

## What v2 left

| Path                 | What it was                | What happens                                                       |
| -------------------- | -------------------------- | ------------------------------------------------------------------ |
| `.bdk/settings.json` | the v2 settings            | read as detection hints, then deleted                              |
| `.bdk/plans/`        | personal plan files        | deleted                                                            |
| `.bdk/design/`       | personal design files      | deleted; a design the user still wants becomes a new `/bdk:change` |
| `.bdk/runs/`         | execution state of v2 runs | deleted                                                            |
| `.bdk/verify-plan/`  | plan verification reports  | deleted                                                            |

## The v2 ignore rule

v2 wrote `/.bdk/` into `.gitignore`. That rule keeps every file v3 commits under `.bdk/` out of git, and `bdk config set` cannot add the two v3 paths while it covers them. `bdk doctor` reports it as `bdk-ignored`, also in a project whose v2 files are already gone. Replace it before the first `bdk config set`:

1. Show the user the rule, its file and its line from the finding's summary, and ask once whether to replace it with the two paths v3 keeps out of git, `/.bdk/.machine/` and `/.bdk/settings.local.yaml`. A rule outside `.gitignore` (`.git/info/exclude`, a global excludes file) is in a file the team does not share: name the file in the question.
2. After a yes, remove only that line, and add to `.gitignore` each of the two paths it does not already hold.
3. Run `bdk doctor --json` again. A `bdk-ignored` finding that remains names another rule: handle it the same way.
4. Commit `.gitignore` alone, when you edited it: `git add .gitignore`, then `git commit -m "chore(bdk): replace the v2 .bdk/ ignore rule" -- .gitignore`. An edit of another ignore file is local and has no commit.

When the user declines, change nothing. Say in the closing render that `bdk doctor` keeps reporting `bdk-ignored` and that the files BDK commits under `.bdk/` stay out of git, so the team never sees the settings or the Changes.

## Settings as hints

Offer the v2 values as the detected ones; the user confirms them like any other detection.

| v2 key                                            | v3 key                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `languages`                                       | `languages`                                                                                                                                                                                                                                                   |
| `test-tools`, `lint-tools`, `build-tools`         | `tools.test`, `tools.lint`, `tools.build`; an item's `type` becomes its `id`, and the tier and scoped forms come from [the stack table](stacks.md)                                                                                                            |
| `features.lavish`                                 | `features.lavish`                                                                                                                                                                                                                                             |
| `quality.<category>`, `language-rules.<language>` | none: rules are no longer settings. List the key in the closing render with its replacement: the project's own rules go into `.bdk/rules/` (`bdk rules accept`), a BDK rule is switched off with `rules.disabled`, and `languages` selects the language packs |

Any other v2 key has no v3 counterpart: list it in the closing render as not carried over.

## Deleting the v2 files

List the v2 paths that exist and ask once whether to delete them. Delete only after a yes, and only those paths. When the user declines, `bdk doctor` keeps reporting `v2-layout`; say so in the closing render.
