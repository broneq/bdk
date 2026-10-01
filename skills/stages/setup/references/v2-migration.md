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

## Settings as hints

Offer the v2 values as the detected ones; the user confirms them like any other detection.

| v2 key                                            | v3 key                                                                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `languages`                                       | `languages`                                                                                                                                        |
| `test-tools`, `lint-tools`, `build-tools`         | `tools.test`, `tools.lint`, `tools.build`; an item's `type` becomes its `id`, and the tier and scoped forms come from [the stack table](stacks.md) |
| `features.lavish`                                 | `features.lavish`                                                                                                                                  |
| `quality.<category>`, `language-rules.<language>` | `prompts.files.<key>`; name the v3 key to the user, and set it only when they ask                                                                  |

Any other v2 key has no v3 counterpart: list it in the closing render as not carried over.

## Deleting the v2 files

List the v2 paths that exist and ask once whether to delete them. Delete only after a yes, and only those paths. When the user declines, `bdk doctor` keeps reporting `v2-layout`; say so in the closing render.
