## MODIFIED Requirements

### Requirement: Keys of execution and archive

The settings SHALL declare the execution and archive keys below.

| Key                                | Type              | Default                   | Owner | Consumer | v2 origin |
| ---------------------------------- | ----------------- | ------------------------- | ----- | -------- | --------- |
| `execution.concurrency`            | integer 1 to 15   | `5`                       | T23   | `ctx`    | none      |
| `execution.tree.enabled`           | boolean           | `true`                    | T41   | `graph`  | none      |
| `execution.tree.min-parts`         | integer 2 to 15   | `2`                       | T41   | `graph`  | none      |
| `execution.worktree.enabled`       | boolean           | `true`                    | T45   | `graph`  | none      |
| `execution.worktree.dir`           | non-empty string  | `.bdk/.machine/worktrees` | T45   | `graph`  | none      |
| `execution.worktree.setup.command` | non-empty string  | none                      | T45   | `graph`  | none      |
| `execution.worktree.setup.timeout` | integer 10 to 540 | `300`                     | T45   | `graph`  | none      |
| `execution.worktree.max-live`      | integer 1 to 15   | `3`                       | T45   | `graph`  | none      |
| `archive.keep-evidence`            | boolean           | `false`                   | T30   | `change` | none      |

`execution.concurrency` caps how many dispatches of one wave the orchestrator runs at once through the host's own subagents; the kernel runs no dispatch process itself, so there is no runner or host key. `ctx` consumes it: the swarm skill's context (`bdk ctx skill swarm`) carries a `Concurrency` section stating the resolved value (T23-D52). `execution.tree` is its own module, consumed by `graph`: `bdk next` marks a part of the execute wave that is not started `tree` (one lead per part) only on a `large` Change, with `enabled` true and at least `min-parts` such parts in the wave, and `flat` otherwise (`kernel-cli/graph`, bdk next; T41-D3). No `features.workflow` key exists: a layer setting it gets `policy/unknown-config-key` (user decision 2026-10-01, Change `v3-t41-execute`). `archive.keep-evidence: true` keeps the full `dispatch/` and `reports/` bodies in the archived Change; by default `change close` replaces them with their hash index (`kernel-state`, Pruned index; T23-D53). T30 registers its module with its consumer, `change close`.

`execution.worktree` is its own module, consumed by `graph`, which applies `enabled` and `max-live` in the wave of `bdk next`; `part start` and `part done` read the module through `graph/index.ts` (`kernel-state`, Part worktree; T45). `enabled: false` is the only downgrade of a part with `isolation: worktree`: the part then runs in the home checkout and alone in its wave. `dir` is resolved against the project root of the home checkout, or used as is when absolute, so a project can keep worktrees outside the repository; it is the user's job then to let the host's agents edit there. `setup.command` runs in a new worktree through the shell, with the worktree as working directory, after the `.worktreeinclude` files are copied; without it no setup runs. `setup.timeout` bounds it in seconds; the upper bound keeps one `part start` inside the 600 s limit of a host's shell tool. `max-live` bounds the disk: a part not started with `isolation: worktree` waits for a later wave while that many kernel worktrees of the project exist. The gitignored files a worktree needs are listed in `.worktreeinclude` at the project root (gitignore syntax: a file is copied when it matches a pattern and is ignored by git), the file Claude Code reads for its own worktrees, so no settings key lists them.

#### Scenario: concurrency default

- **WHEN** the `execution` module is registered, no layer sets `execution.concurrency` and `bdk config show execution.concurrency --json` runs
- **THEN** the exit code is 0 and the value is `5`

#### Scenario: detected key unset

- **WHEN** the `execution` module is registered and `bdk config show execution.runner` runs
- **THEN** the exit code is 2 with `rule: policy/unknown-config-key`, because the module declares no runner or host key

#### Scenario: removed runner key in a layer

- **WHEN** `.bdk/settings.yaml` sets `execution.runner: headless`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `execution.runner`

#### Scenario: concurrency in the swarm context

- **WHEN** `.bdk/settings.yaml` sets `execution.concurrency: 3` and `bdk ctx skill swarm` runs
- **THEN** its `Concurrency` section states 3

#### Scenario: concurrency out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.concurrency: 16`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `execution.concurrency`

#### Scenario: keep evidence registered

- **WHEN** no layer sets `archive.keep-evidence` and `bdk config show archive.keep-evidence --json` runs
- **THEN** the exit code is 0 and the value is `false`

#### Scenario: tree defaults

- **WHEN** no layer sets `execution.tree` and `bdk config show execution.tree --json` runs
- **THEN** the value is `{enabled: true, min-parts: 2}`

#### Scenario: tree threshold out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.tree.min-parts: 1`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `execution.tree.min-parts`

#### Scenario: no workflow switch

- **WHEN** `.bdk/settings.yaml` sets `features.workflow: true`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `features.workflow`

#### Scenario: worktree defaults

- **WHEN** no layer sets `execution.worktree` and `bdk config show execution.worktree --json` runs
- **THEN** the value is `{enabled: true, dir: .bdk/.machine/worktrees, setup: {timeout: 300}, max-live: 3}`

#### Scenario: setup timeout out of range

- **WHEN** `.bdk/settings.yaml` sets `execution.worktree.setup.timeout: 900`
- **THEN** `bdk config check` exits 2 with `rule: policy/config-invalid` naming `execution.worktree.setup.timeout`

### Requirement: Prompt values

Markdown configuration values SHALL be files, one per prompt key, resolved across the same four layers, each layer contributing by `mode: extends` (appended to the value below) or `mode: replace` (discarding it).

A prompt key is the file path relative to a prompts directory without `.md` (`fragments/decision/lavish`), so it never contains a dot; its first segment is never `dir` or `files`. Each layer has one prompts directory, set only by `prompts.dir` in that layer's own file and never inherited; a relative `prompts.dir` resolves against the project root for the project and local layers and against the global layer's directory for the global layer. In the same layer, `prompts.files.<key>` wins over `<dir>/<key>.md`; its string form is a path with `mode: extends`, its object form carries `path`, `mode` and `applies`. A file's optional frontmatter carries `mode` and `applies` (a list of globs); for a file mapped by `prompts.files`, a frontmatter `mode` or `applies` that differs from the YAML entry answers `policy/config-invalid`. The default layer is the plugin file the prompt key declares, when it has one. Prompt keys are registered like YAML keys, as literal keys or as one-segment patterns: a prompts directory file or a `prompts.files` entry whose key is not registered answers `policy/unknown-config-key`. `applies` is validated as a list of globs and passed to the consumer, which interprets it. Rules are not prompt values (T31): the keys `rules/<category>` and `rules/languages/*` are not registered, and a prompts file or `prompts.files` entry for one answers `policy/unknown-config-key` whose `why` says that project rules live in `.bdk/rules/` and BDK rules are switched off with `rules.disabled`.

| Prompt key                                              | Default file (plugin)            | Owner | Consumer   | v2 origin |
| ------------------------------------------------------- | -------------------------------- | ----- | ---------- | --------- |
| `fragments/decision/lavish`                             | `fragments/decision/lavish.md`   | T13   | `ctx`      | none      |
| `fragments/decision/ask-user`                           | `fragments/decision/ask-user.md` | T13   | `ctx`      | none      |
| `pipeline/<kind>` (one literal key per registered kind) | `pipeline/<kind>.md`             | T21   | `graph`    | none      |
| `fragments/merge-conflicts`                             | `fragments/merge-conflicts.md`   | T45   | `dispatch` | none      |

`pipeline/<kind>` is the instruction template of an artifact kind (`kernel-pipeline`, Instruction); a file for a name that is not a registered kind answers `policy/unknown-config-key`. `fragments/merge-conflicts` is the project's instruction for resolving merge conflicts (T45, user decision 2026-10-04). `dispatch build` copies it into the `Conflict` section of a merge ticket's package (`kernel-cli/dispatch`, bdk dispatch build); it names no BDK flow, so a later flow that merges the default branch into a Change can reuse it. The default file states the rules common to every language: a package manager's lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `Cargo.lock`, `poetry.lock`, `uv.lock`, `Pipfile.lock`, `go.sum`, `Gemfile.lock`, `composer.lock`, `mix.lock`, `pubspec.lock`, `Package.resolved`, `packages.lock.json`, and the like) is never merged by hand: take either side, then regenerate it with the project's package manager from the merged manifests; any other generated file (codegen output, snapshots) is regenerated by the command that produces it; migrations that collide on a number or timestamp are renumbered; in source code the intent of both sides is kept. A project appends its own commands with `mode: extends` (the default) or replaces the text with `mode: replace`. Later tasks add prompt keys through a delta.

#### Scenario: extends then replace

- **WHEN** the plugin default of `fragments/decision/lavish` exists, the project layer has `.bdk/prompts/fragments/decision/lavish.md` with `mode: extends` and the local layer has `.bdk/prompts.local/fragments/decision/lavish.md` with `mode: replace`
- **THEN** the resolved value of `fragments/decision/lavish` is the local file alone, and `bdk config show prompts.fragments/decision/lavish --json` lists only the local file with mode `replace`

#### Scenario: file mapped from anywhere

- **WHEN** `.bdk/settings.yaml` sets `prompts.files.fragments/decision/lavish: docs/lavish.md` and that file has no frontmatter
- **THEN** the project contribution to `fragments/decision/lavish` is `docs/lavish.md` with `mode: extends`

#### Scenario: custom directory

- **WHEN** `.bdk/settings.yaml` sets `prompts.dir: docs/bdk-prompts` and `docs/bdk-prompts/fragments/decision/ask-user.md` exists
- **THEN** that file is the project contribution to `fragments/decision/ask-user` and `.bdk/prompts/` is not read

#### Scenario: unknown prompt file

- **WHEN** `.bdk/prompts/fragments/decision/lavsh.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `fragments/decision/lavsh` and the project layer

#### Scenario: rule prompt file refused

- **WHEN** `.bdk/prompts/rules/security.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key`, and `why` names the file, `.bdk/rules/` and `rules.disabled`

#### Scenario: dropped funnel key

- **WHEN** `.bdk/settings.yaml` sets `rules.propose-when.authors: 1`
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming the key

#### Scenario: project replaces a fragment

- **WHEN** `.bdk/prompts/fragments/decision/ask-user.md` has `mode: replace`
- **THEN** the resolved value of `fragments/decision/ask-user` is that file alone, and `bdk config show prompts.fragments/decision/ask-user --json` lists only that file

#### Scenario: template for an unknown kind

- **WHEN** `.bdk/prompts/pipeline/desing.md` exists
- **THEN** `bdk config check` exits 2 with `rule: policy/unknown-config-key` naming `pipeline/desing`

#### Scenario: merge instruction extended

- **WHEN** `.bdk/prompts/fragments/merge-conflicts.md` holds "Regenerate `pnpm-lock.yaml` with `pnpm install --lockfile-only`." without frontmatter
- **THEN** the resolved value of `fragments/merge-conflicts` is the plugin default followed by that line
