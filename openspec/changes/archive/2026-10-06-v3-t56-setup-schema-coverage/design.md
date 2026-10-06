# Design

## Context

- The registry (`kernel/src/shared/config/registry.ts`) is assembled in `kernel/src/registrations.ts` from the config modules each slice declares in its `config.ts`, plus `shared/config/modules.ts` (`tools`, `prompts`) and `shared/store/config.ts` (`policy.checkpoint`). It holds 51 leaf keys as the key tables of `kernel-settings` list them (`kernel/tests/support/settings-table.ts`, `registeredLeaves`).
- `createConfigRegistry` already refuses two overlapping module keys at startup (`checkModuleKeys`); `settings-spec.test.ts` already compares every registered leaf with its row in the `kernel-settings` key tables (type, default, owner, consumer).
- `bdk ctx skill setup` renders three `tools` parts (`kernel/src/ctx/use-cases/manifest.ts`, `parts.ts`). The skill text names the six keys it writes and states that tiers, scoped forms, profiles and sizes are never questions.
- The merge records an origin layer per dotted path a file sets (`shared/config/merge.ts`, `origins`); `config show --origins` resolves a leaf's origin from it, falling back to the nearest ancestor and then to `default` (`config/domain/origins.ts`).
- User decisions of 2026-10-06 (Lavish review of the open questions): the classification is a required field of the config module; one flow with a small `asked` set, no "advanced" group; `bdk config show` stays unchanged and the classification reaches the skill through `ctx skill setup`; `spec.normative-word` and `policy.evidence.*` lists are `derived`.

## Goals / Non-Goals

**Goals:**

- Every leaf key has exactly one setup class, declared next to its schema, and the build fails when one is missing or disagrees with the spec.
- `/bdk:setup` handles every `derived` and `asked` key and nothing else, and its Finish report shows the rest by name.
- A key a later task registers cannot bypass setup unnoticed: the registry, the spec table, the skill text and the settings page each fail a test until the key is classified and covered.

**Non-Goals:**

- No change to any key's schema, default, owner or consumer.
- No `setup` field in `bdk config show`, `config schema` or `schema/settings.json`.
- No "advanced" question group, and no question about a key whose value is learned by running Changes.
- No new kernel command: deriving and asking stay in the skill, which writes through `bdk config set`.

## Decisions

### D1. The class is a required `setup` field of the config module

`ConfigModule` gains `readonly setup: SetupClass | Readonly<Record<string, SetupClass>>`, where `SetupClass = "derived" | "asked" | "default"` and a record key is a leaf path below the module key (`"setup.command"` in `execution.worktree`). A single class covers every leaf of the module, which is the common case (`policy.budgets: "default"`); a record must name each leaf exactly once.

`createConfigRegistry` computes each module's leaves from its schema with the existing `keyTree` and `leafPaths` of `shared/config/keys.ts` (an id array and a whole-module leaf such as `tracker` are one leaf, a record ends in `<key>`) and fails at startup, as `checkModuleKeys` does, when a record misses a leaf or names a path that is not one. The registry exposes `setupClass(key)` and `setupKeys(): readonly {key, setup}[]` in registry order.

Alternatives considered:

- zod `.meta({ setup })` on every leaf: closest to the key, but `toJSONSchema` copies custom meta into `schema/settings.json` as a non-standard keyword, and modules that are wholly `default` would need it on every leaf. Lost on noise and on leaking into a published artifact.
- A separate table in `shared/config`: easy to scan, but lives apart from the module that adds a key, which is how the gap of #147 arose. Lost.
- Optional field defaulting to `default`: a new key would silently be `default`, which is exactly the accident the task removes. Lost; the field is required and TypeScript refuses a module without it.

### D2. The spec holds a `Setup key` table; the contract test compares it with the registry

`kernel-settings` gets the requirement "Setup classification" with one table of all 51 keys and their class. `settings-spec.test.ts` reads it with `tableRows(spec, "Setup key")` and requires the set of `{key, class}` rows to equal `setupKeys()`. The first header is `Setup key`, not `Key`, so the existing key-table reader (`tableRows(spec, "Key")`) does not take its rows as key rows.

Alternative: a `Setup` column in each of the eight existing key tables. It keeps one row per key, but needs a MODIFIED delta that restates eight requirements in full for a one-column change, and scatters the one view a reviewer of the setup surface needs. Lost.

### D3. A `setup-coverage` part of `ctx skill`

A new manifest part kind `setup-coverage`, rendered by `ctx/use-cases/parts.ts` from `settings.setupKeys()` and the resolved settings, under `### Setup coverage` with `#### Derived`, `#### Asked` and `#### Not set by setup`, one line `- <key>: <value> (<origin>)` (spec `kernel-cli/ctx`). The setup manifest entry becomes `[tools("test"), tools("lint"), tools("build"), { kind: "setup-coverage" }]`; `schema/cli/output/ctx.json` adds the kind to its enum.

The origin of a key is the logic `config show --origins` uses, generalised to "the highest layer among the key's own origin, its ancestors' and its descendants'" so an id array whose one entry a project overrides reports `project`. It moves from `config/domain/origins.ts` to `shared/config` (`keyOrigin(origins, key)`), which both `config` and `ctx` already import; `config/domain/origins.ts` keeps its leaf walk and calls it.

Values: a scalar as `config show` prints it, an id array as its ids, another array as its items, a record as its entry count, an absent key as `unset`. The evidence lists print in full; they are the values the user confirms.

Alternatives considered:

- The skill runs `bdk config show --json` and classifies itself: the skill would then hold the classification in its text, the opposite of the issue's scope item 1. Lost.
- `config show` marks the class (option B of the review): adds a field to a stable CLI contract that only setup reads. Lost by user decision.

### D4. Setup derives from the stack table, asks in one call, writes only differences

`references/stacks.md` gains three columns or tables, keyed by the same stacks:

- install command per lockfile (`pnpm-lock.yaml` -> `pnpm install --frozen-lockfile`, `package-lock.json` -> `npm ci`, `yarn.lock` -> `yarn install --immutable` with `.yarnrc.yml`, else `yarn install --frozen-lockfile`, `uv.lock` -> `uv sync --frozen`, `poetry.lock` -> `poetry install`, `Gemfile.lock` -> `bundle install`, `go.sum` -> `go mod download`, `Cargo.lock` -> `cargo fetch`);
- documentation builds whose sources are non-executable by default (`mkdocs.yml` -> its `docs_dir`, default `docs/**`; `.vitepress/` or `docusaurus.config.*` -> their source directory; Sphinx `conf.py` -> its directory; `book.toml` -> `src/**`), plus test fixture directories (`**/fixtures/**`, `**/testdata/**`, `**/__snapshots__/**`) when they hold Markdown or text;
- documentation and image formats beyond the default globs (`**/*.adoc`, `**/*.org`, `**/*.drawio`, `**/*.pdf`, `**/*.ico`, `**/*.avif`).

The derived values join the existing confirmation of the detected commands, so no new question is added for them. `spec.normative-word` is derived by counting the whole words `SHALL` and `MUST` in the requirement lines of `.bdk/specs/**/spec.md`, or of a pre-BDK spec tree the project holds (`openspec/specs/`), and set only when `MUST` holds the majority; without specs it stays `SHALL` and is not written.

The asked keys are three decisions of the team: the gates, the review risks and the tracker. The acceptance runs of 6.2 showed a model joining them to the command confirmation, and the user decided afterwards that every question of setup, not only these, belongs on one Lavish page (D6). Each answer is written only when it differs from the resolved value (scope: a kept default writes nothing).

Alternatives considered:

- A kernel command that derives the values (`bdk config derive`): deterministic and testable, but stack knowledge lives in the skill's reference today and the kernel stays language-agnostic. Lost.
- Writing every confirmed value even when it equals the default: pins the default into the project file, so a later default change would not reach the project. Lost.

### D6. Every question of setup on one Lavish page

The skill detects everything first (commands, derived values, the exclusions of `.bdk/`, the risk matches, the tracker proposal, the hand-written rules, the v2 files), asks once, then writes. The one question before the page is whether to install Lavish, which the page needs. `references/setup-page.html` renders a section per key of one JSON block the skill fills (`v2`, `commands`, `derived`, `exclusions`, `gates`, `risks`, `tracker`, `rules`), leaves out a section whose key is null, and queues one prompt per section with `data: {question, answer}`. The skill copies the page to `.lavish/bdk-setup-<stamp>.html`, a new file per run because Lavish never reopens a page whose session the user ended (the fourth acceptance run fell back to the terminal on the second run's page), and touches nothing but the JSON, so the layout is fixed and the contract test pins the data shape (every section, the six default risks) and the queued prompts.

Writes follow in a fixed order: the v2 ignore rule first (the T32 requirement keeps it before any `config set`), then the settings, `features.lavish`, the exclusions with their lint run and commit, and the rule import. A lint run that still reports a path under `.bdk/` adds an `exclusions` section to the page and asks again.

Without Lavish, or for a section the page leaves open, each section is one `AskUserQuestion` call of its own, in the page's order; a list longer than the host's four options per question is split, so the six default risks form two multi-selects of three. The user prefers one decision per call over a bundle.

This makes setup an exception to "Asking the user in two tiers", which sends a simple decision to the terminal even with Lavish on: setup's decisions are answered together before anything is written, and one page shows how they relate (the commands next to the exclusions their linter needs).

Alternatives considered:

- Simple decisions in the terminal, rich ones on the page (the tier rule as is): the user then answers in two places in one run. Lost by user decision.
- Generate the whole page per run: the layout would differ per run and per model, and no test could hold it. Lost.

### D5. Drift guards for the skill and the docs

- `stage-skills.test.ts`: every key of `setupKeys()` classed `derived` or `asked` appears as a code span in `skills/stages/setup/SKILL.md` or a file of `skills/stages/setup/references/`.
- `kernel/tests/docs/configuration.test.ts`: each key table of `reference/configuration.md` gains a `Setup` column; the guard requires each registered key's row to carry its class (`derived`, `asked` or `default`).
- The constraint line of the skill that says "Tiers, scoped forms, profiles and sizes ... are never questions" is rewritten to point at the context's `Not set by setup` list instead of a hand-kept list.

## Risks / Trade-offs

- [The classification is a judgement call per key; a team may want a `default` key asked] -> The class changes through a delta of the table, like a default, and `bdk config set` covers every key meanwhile; the Finish report makes the `default` keys visible.
- [A derived value can be wrong for an unusual stack, e.g. an install command a monorepo runs from a sub-directory] -> Every derived value is shown with the commands and confirmed; the user can edit it in the same "Other" answer.
- [`ctx skill setup` grows by about 51 lines] -> It runs only in the setup skill; the lines replace hand-kept lists the skill would otherwise need.
- [Startup failure on an unclassified leaf breaks every command of a broken build] -> It is the same failure mode as `checkModuleKeys`; the unit and contract tests catch it before a release.
- [The E2E acceptance of a skill run needs a real host session] -> It runs once in a fixture project with `claude --plugin-dir` (REPO-1), recorded in tasks; the deterministic parts are covered by the contract and unit tests.
