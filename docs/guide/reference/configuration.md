# Configuration

Every BDK setting is a key in a YAML file. `/bdk:setup` writes the first
values; after that you change a key with `bdk config set` or by editing the
file, and `bdk config check` tells you whether the result is valid. This page
lists every key the kernel accepts. `bdk config schema` prints the same keys as
a JSON Schema, which the modeline at the top of each settings file hands to
your editor.

## Layers

Four layers are merged, the higher one wins:

| Layer     | File                                                                                                                | Tracked                      |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `default` | compiled into the plugin                                                                                            | -                            |
| `global`  | `~/.config/bdk/settings.yaml`, or `$XDG_CONFIG_HOME/bdk/settings.yaml`, or `%APPDATA%\bdk\settings.yaml` on Windows | no, it is yours              |
| `project` | `.bdk/settings.yaml`                                                                                                | yes, the team shares it      |
| `local`   | `.bdk/settings.local.yaml`                                                                                          | no, `.gitignore` excludes it |

A missing file is skipped. Every output names the layer a value came from:

```sh
bdk config show policy.gates --origins
bdk config set tools.test.unit.scoped 'npx vitest run {files}' --local
bdk config check
```

`bdk config set` writes the project layer unless you pass `--local` or
`--global`, and validates the result before it writes. `bdk change status`
lists the keys a global or local layer overrides, so a personal setting never
changes a run silently.

### How layers merge

- Mappings merge key by key.
- A list of entries with an `id` (tool entries, risks, verifier categories)
  merges entry by entry on `id`: a higher layer changes one field of an entry
  without repeating the others, or adds entries of its own.
- The glob lists of `policy.evidence` only grow: each layer appends to the
  defaults and never removes one.
- Every other list and every scalar is replaced whole.

An entry of an `id` list is addressed by its `id` as a path segment, in
`config show`, `config set` and every message: `tools.test.unit.scoped`.

### Key spelling

Every key segment and every `id` is kebab-case (`task-redispatch`, not
`taskRedispatch`). An unknown key fails `bdk config check` with
`policy/unknown-config-key` and, when a key is close, the one you probably
meant. A key that BDK 2 used names its replacement; see
[Migration from v2](../getting-started/migration-from-v2.md).

## Project toolchain

| Key               | Default | What it sets                                                                                                                                   |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `languages`       | `[]`    | The languages and frameworks of the project. Each name selects the plugin's language rules under `rules/languages/<name>/`.                    |
| `tools.test`      | unset   | The test commands, or `none` when the project has no tests.                                                                                    |
| `tools.lint`      | unset   | The lint, format and type check commands, or `none` when the project has no linter.                                                            |
| `tools.build`     | `[]`    | The build commands. No pipeline step runs them; they tell the roles how the project builds.                                                    |
| `features.lavish` | `true`  | Run the design and review conversations in [Lavish](https://github.com/broneq/lavish); `false` asks the same questions with `AskUserQuestion`. |

`tools.test` and `tools.lint` have no default on purpose: while either is
unset, `bdk change new` refuses with `policy/tools-unset`. What each state does
to a Change is in [Project setup](../getting-started/setup.md#a-project-without-tests-or-a-linter).

### Tool entries

Each command is one entry:

```yaml
tools:
  test:
    - id: unit
      tier: fast
      command: npx vitest run
      scoped: npx vitest run {files}
      related: npx vitest related --run {files}
      coverage: { command: npx vitest run --coverage, report: coverage/lcov.info, format: lcov, min: 80 }
  lint:
    - { id: eslint, tier: lint, command: npx eslint ., scoped: "npx eslint {files}" }
```

| Field         | Required                                                     | Meaning                                                                                                                    |
| ------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `id`          | yes                                                          | Unique in the list; the merge key and the path segment.                                                                    |
| `tier`        | test: `fast` or `e2e`; lint: `lint`, `format` or `typecheck` | The cost class the runner picks by. Not allowed in `tools.build`.                                                          |
| `command`     | yes                                                          | The full, unscoped command.                                                                                                |
| `scoped`      | no                                                           | The command for given paths; `{files}` becomes the quoted, space-separated list.                                           |
| `related`     | no                                                           | The command for the tests that cover given source paths, with `{files}`.                                                   |
| `failed`      | no                                                           | Re-runs the previous failures.                                                                                             |
| `incremental` | no                                                           | The incremental form, such as a type checker's incremental run.                                                            |
| `when`        | no                                                           | Free text telling the model when this entry is the right one; passed through as written.                                   |
| `coverage`    | no, `tools.test` only                                        | `command`, `report` (path), `format` (`lcov` or `cobertura`) and an optional `min` percentage for the lines a Change adds. |

A form you leave out makes BDK fall back to the full command; a wrong one would
run the wrong thing, so leave it out when the tool takes no path list.

## Pipeline

| Key                     | Default  | What it sets                                                                                                     |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `policy.gates.design`   | `manual` | `auto` lets the pipeline pass the design gate without you typing `/bdk:plan`.                                    |
| `policy.gates.review`   | `manual` | `auto` lets the pipeline pass the review gate without you typing `/bdk:close`.                                   |
| `archive.keep-evidence` | `false`  | `true` keeps the full dispatch packages and reports in the archived Change; `false` keeps only their hash index. |
| `spec.normative-word`   | `SHALL`  | The word every requirement of a living spec carries; `bdk spec delta check` holds each delta to it.              |

Gates are explained in [The Change pipeline](../concepts/change-pipeline.md#gates).

### Loops and escalation

Each loop of a Change has a budget of tickets per round. When a budget runs
out, the ladder moves on: one escalation ticket with a fresh context and a
stronger model, then a question to you.

| Key                              | Default | What it sets                                                                                               |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `policy.budgets.task-redispatch` | `3`     | Re-dispatches of one task.                                                                                 |
| `policy.budgets.verify-fix`      | `2`     | Fix rounds after a failed verification of one part.                                                        |
| `policy.budgets.review-fix`      | `2`     | Fix rounds after the review of the Change.                                                                 |
| `policy.budgets.verifier`        | `2`     | Iterations of one verifier over one artifact.                                                              |
| `policy.budgets.part-lead`       | `2`     | Lead tickets of one plan part.                                                                             |
| `policy.budgets.not-run`         | `3`     | Consecutive closes of one loop and target that ran nothing.                                                |
| `policy.oscillation.threshold`   | `2`     | Failures of one round with the same fingerprint that shorten the ladder.                                   |
| `policy.escalation.enabled`      | `true`  | `false` skips the escalation rung.                                                                         |
| `policy.escalation.model`        | `opus`  | The model class the escalation ticket names.                                                               |
| `policy.escalation.per-change`   | `3`     | Escalation tickets one Change may open in total.                                                           |
| `policy.checkpoint.enabled`      | `true`  | Commits the Change directory at park, escalation and session end; `false` leaves that to the task commits. |

### Verifiers

A verifier blocks only on a finding of a blocking category; any other blocker
is recorded as a reviewed observation.

| Key                                   | Default                                                                                                           | What it sets                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `policy.verifier.blocking-categories` | `architecture`, `security`, `irreversible-step`, `integration-failure`, `unresolved-decision`, `false-code-claim` | The categories a blocker may name; you can add your own, the defaults stay. |
| `policy.verifier.not-a-fail`          | `style`, `template-conformance`, `files-bookkeeping`, `wording`, `report-length`, `verification-defect`           | The categories shown to a verifier as never failing an artifact.            |

Each entry is `{id, description}`, merged by `id`.

### Evidence

| Key                                   | Default                                                                        | What it sets                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `policy.evidence.non-executable`      | Markdown, text and image files, `docs/**`, `LICENSE*`, `CHANGELOG*`, `.bdk/**` | Files that never change the tree hash, so editing them needs no new test run. Layers append to it. |
| `policy.evidence.build-config`        | manifests and lockfiles (`package.json`, `pyproject.toml`, `go.mod`, ...)      | Files that always change the tree hash, wherever they are; wins over `non-executable`.             |
| `policy.evidence.max-committed-bytes` | `65536`                                                                        | The largest text evidence file copied into the Change; `0` commits none.                           |

`bdk config show policy.evidence` prints the full default lists.
[Verification scoping](../concepts/verification-scoping.md) explains the tree
hash.

## Execution

| Key                                | Default                   | What it sets                                                                                 |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------- |
| `execution.concurrency`            | `5`                       | The most dispatches of one wave that run at once.                                            |
| `execution.tree.enabled`           | `true`                    | `false` runs every part flat, with the main session dispatching its tasks.                   |
| `execution.tree.min-parts`         | `2`                       | Ready parts a `large` Change needs before they run as a tree, one lead per part.             |
| `execution.worktree.enabled`       | `true`                    | `false` runs a part marked `isolation: worktree` in your checkout, alone in its wave.        |
| `execution.worktree.dir`           | `.bdk/.machine/worktrees` | Where the kernel's worktrees live, relative to the project root unless absolute.             |
| `execution.worktree.setup.command` | unset                     | A shell command run in a new worktree after the `.worktreeinclude` copy, such as an install. |
| `execution.worktree.setup.timeout` | `300`                     | Seconds the setup command may run.                                                           |
| `execution.worktree.max-live`      | `3`                       | Worktrees alive at once; a later worktree part waits for a wave.                             |

See [Worktree parts](../concepts/worktree-parts.md).

## Agents

| Key                           | Default | What it sets                                                                    |
| ----------------------------- | ------- | ------------------------------------------------------------------------------- |
| `agents.ttl`                  | `300`   | Seconds without a tool call after which an agent with no open call is suspect.  |
| `agents.open-call-limit`      | `720`   | Seconds after which an open tool call no longer counts as the agent working.    |
| `agents.message.max-chars`    | `300`   | The longest message one agent may send another.                                 |
| `agents.continuation.max`     | `3`     | Turn ends in a row the stop check blocks without progress; `0` switches it off. |
| `agents.scout.max-per-ticket` | `2`     | Scout agents one worker may start under one ticket; `0` forbids them.           |

## Review

| Key                      | Default                                                                       | What it sets                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review.group.max-files` | `30`                                                                          | The target size of a reviewer group. Small modules are packed up to it; a module or plan part stays whole up to a third above it, and only a larger one is split, by directory. |
| `review.risks`           | `auth`, `migration`, `secrets`, `public-api`, `dependencies`, `configuration` | The risky areas a review calls out. Each is `{id, instruction, paths, enabled}`, merged by `id`.                                                                                |
| `tracker`                | unset                                                                         | Where a finding goes when you choose "track" in the review: `{kind: github}`, or `{kind: instruction, instruction: "<how to file it>"}`. Unset, the review offers no "track".   |

```yaml
review:
  risks:
    - { id: auth, instruction: "Any change under src/acl/ or to the Role enum", paths: ["src/acl/**"] }
    - { id: dependencies, enabled: false }
    - { id: billing, instruction: "Anything that computes or stores a price" }
tracker: { kind: instruction, instruction: "Create a Jira issue in project PAY with the jira CLI and return its key" }
```

## Rules

| Key                           | Default | What it sets                                                                                         |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `rules.disabled`              | `[]`    | Rule ids switched off, BDK's own included (`BDK-SEC-3`).                                             |
| `rules.warn-above`            | `100`   | Rules one role may receive before the session start warns. Every rule that applies still reaches it. |
| `rules.audit.min-changes`     | `3`     | Distinct Changes a finding must appear in before `bdk rules stats` lists it as recurring.            |
| `rules.prune.uncited-changes` | `20`    | Recent Changes `bdk rules prune` looks back over for citations.                                      |

Your own rules are files under `.bdk/rules/`, not settings; see
[Rules hygiene](../workflows/rules-hygiene.md).

## Diagnostics

| Key                          | Default | What it sets                                                                           |
| ---------------------------- | ------- | -------------------------------------------------------------------------------------- |
| `diagnostics.verbose`        | `false` | Writes a verbose log of each session under `.bdk/.machine/logs/`.                      |
| `diagnostics.repeat-refusal` | `3`     | Refusals of one rule in a session that make the report flag them.                      |
| `diagnostics.repeat-read`    | `3`     | Reads of one file by one agent that make the report flag them.                         |
| `diagnostics.outlier-factor` | `3`     | The multiple of the session median above which a task's tokens or wall time stand out. |

See [Diagnostics](../workflows/diagnostics.md).

## Prompts

Some instructions BDK hands to its agents are Markdown files you can extend or
replace, one file per prompt key:

| Prompt key                    | What it is                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `fragments/decision/lavish`   | How a stage asks you for a decision in Lavish.                                     |
| `fragments/decision/ask-user` | How a stage asks you for a decision with `AskUserQuestion`.                        |
| `fragments/merge-conflicts`   | How a merge conflict is resolved; add your own regeneration commands here.         |
| `pipeline/<kind>`             | The instruction template of one artifact kind of the pipeline (`pipeline/design`). |

| Key                   | Default | What it sets                                                                                                                                                                   |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompts.dir`         | unset   | This layer's prompts directory; never inherited by another layer. Unset, it is `.bdk/prompts/` (project), `.bdk/prompts.local/` (local) or `prompts/` next to the global file. |
| `prompts.files.<key>` | unset   | One prompt key mapped to a file anywhere, as a path or `{path, mode, applies}`; wins over the directory.                                                                       |

A file contributes with `mode: extends` (appended to the value below it, the
default) or `mode: replace` (instead of it), set in its frontmatter or in the
`prompts.files` entry:

```markdown
---
mode: extends
---
After a lockfile conflict, run `pnpm install --frozen-lockfile=false`.
```

`bdk config show prompts.fragments/merge-conflicts --origins` shows which files
make up a value.
