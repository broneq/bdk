---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/src/config/tests/domain.test.ts
  - plugins/bdk/src/config/tests/commands.test.ts
  - plugins/bdk/evals/propose-not-configured
---

# ADR-0008: Configuration in three layers merged by `id`, required before any stage skill runs

## Context and Problem Statement

Teams use BDK in different ways (problem 4 of v3): their own test, lint and E2E commands, gates, budgets and models. A team shares most of that, and each developer changes a little of it on their machine. Skills hold the logic, and a skill that guesses a missing setting (a test command, a gate) acts on a guess the user never sees. Where does configuration live, how do the parts combine, and what does a skill do when there is none?

## Decision Drivers

- **One shared, committed configuration** per project, with personal overrides that stay out of git.
- **Override one item, not a list:** changing one test command must not mean copying all of them.
- **No guessed defaults** for what decides the work: a stage runs only on a configuration someone set up.
- **The configuration reaches the model before its first turn**, without a CLI call the model may skip.

## Considered Options

1. **Three YAML layers merged by `id`, required:** global, project (committed) and local; arrays of items merge by `id`; a skill without a configuration stops and names `/bdk:setup`.
2. **One project file**, no layers.
3. **Layers with whole-array replacement:** a higher layer that sets an array replaces it.
4. **Zero configuration:** skills run with built-in defaults and detect the rest.

## Decision Outcome

**Chosen option: 1.** The layers are global (`~/.config/bdk/settings.yaml`, or under `$XDG_CONFIG_HOME`), project (`.bdk/settings.yaml`, committed) and local (`.bdk/settings.local.yaml`), later over earlier. Mappings merge deeply, scalars and scalar arrays are replaced, and an array of items with an `id` merges item by item, new ids appended in order. Every skill that reads the configuration injects `bdk config show` through a `!` block before the model's first turn; when the project is not configured the block prints `BDK not configured: run /bdk:setup`, and the skill's first instruction is to stop and pass that line on. Only `/bdk:setup` and the tools that read no configuration (`/bdk:commit`, `/bdk:adr`) run without one.

It is the only option that lets a developer change one command locally, keeps the team's file the single shared source, and never lets a stage run on a guess.

### Consequences

- ✅ `bdk config show` names the layer each value came from, so an override is visible.
- ✅ A local file holds only the items it changes.
- ❌ A new project must run `/bdk:setup` before any stage; there is no zero-config path.
- ❌ Changing the merge rules changes the meaning of every team's existing files: it is a breaking change of the settings schema.
- 🟡 Two items with the same `id` in one layer are an error that `bdk config check` names.

## Pros and Cons of the Options

### 1 - Three layers merged by `id`, required

- Good: shared and personal settings apart; minimal override files; no hidden defaults for commands.
- Bad: setup friction; merge rules to learn.

### 2 - One project file

- Good: nothing to merge.
- Bad: a personal model or command means editing a committed file.

### 3 - Whole-array replacement

- Good: simplest merge.
- Bad: overriding one test command copies the whole list, which then drifts from the team's.

### 4 - Zero configuration

- Good: works at once.
- Bad: stages run on detected commands nobody confirmed; a wrong guess shows only as a wrong result.
