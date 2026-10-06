# Proposal

## Why

Scope: #147. Tracks #147.

`/bdk:setup` writes six keys (`languages`, `tools.test`, `tools.lint`, `tools.build`, `features.lavish`, `tracker`) of a registry that holds about fifty. Nothing records which of the others a person is meant to set at setup and which stay on their defaults on purpose, so the gap looks accidental, keys such as `policy.gates.*`, `review.risks` or `execution.worktree.setup.command` are found only by reading `docs/guide/reference/configuration.md`, and a key a later task registers can slip past setup unnoticed.

## What Changes

- Every config module of the registry carries a required `setup` classification for each of its leaf keys: `derived` (setup reads it from the project files and shows it for confirmation), `asked` (a project fact the files cannot tell, so setup asks) or `default` (setup leaves it on its default on purpose). The registry refuses a module with an unclassified leaf at startup, as it refuses overlapping module keys today.
- The classification, decided with the user on 2026-10-06:
  - `derived`: `languages`, `tools.test`, `tools.lint`, `tools.build`, `features.lavish`, `execution.worktree.setup.command`, `policy.evidence.build-config`, `policy.evidence.non-executable`, `spec.normative-word`.
  - `asked`: `policy.gates.design`, `policy.gates.review`, `review.risks`, `tracker`.
  - `default`: every other key (budgets, oscillation, escalation, checkpoint, verifier categories, `policy.evidence.max-committed-bytes`, `archive.keep-evidence`, `execution.*` other than the setup command, `agents.*`, `review.group.max-files`, `rules.*`, `diagnostics.*`, `prompts.*`).
- `kernel-settings` gets a table of every key with its setup class; the contract test `settings-spec.test.ts` fails when the table and the registry disagree, so a new key without a classification, or with a different one, fails `pnpm test:contract`.
- `bdk ctx skill setup` gets a new `setup-coverage` part: the derived, asked and default keys with their resolved values and origins, so the skill reads the classification from the kernel, never from its own text.
- `/bdk:setup` covers every `derived` and `asked` key in one flow: it derives the worktree setup command from the lockfile, the evidence globs from a docs build and test fixtures, and the normative word from existing living specs; it detects everything first and asks every question on one Lavish page (the commands, the derived values, the exclusions, the gates, the review risks, the tracker, the rules, the v2 files), or one `AskUserQuestion` call per section when Lavish is off, then writes. It writes only values that differ from the defaults.
- The Finish report of setup names every `default` key with its value, and marks one a layer sets with that layer.
- A contract test fails when a `derived` or `asked` key is not named in `skills/stages/setup/` (its `SKILL.md` or `references/`).
- `docs/guide/reference/configuration.md` states each key's setup class; the setup section of `docs/guide/reference/skills.md` and `docs/guide/getting-started/setup.md` say which keys setup covers.

Out of scope: a `setup` field in `bdk config show` (user decision 2026-10-06: the classification reaches the skill through its context only, `kernel-cli/config` is unchanged); an "advanced" opt-in group of questions (user decision 2026-10-06); changing any key's default or schema.

## Resolved from "To resolve in the spec"

- Where the classification is stored: a required `setup` field of the config module, beside its schema (user decision 2026-10-06). The spec table mirrors it and a contract test keeps both equal.
- One flow or skippable groups: one flow with a small `asked` set; no "advanced" group (user decision 2026-10-06).
- How many questions per run: every question of setup moves to one Lavish page; without Lavish, one `AskUserQuestion` call per section.
- Whether `bdk config show` marks a key setup never sets: no; the `setup-coverage` context part carries it (user decision 2026-10-06).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-settings`: every config module classifies its leaves for setup; a new requirement holds the classification table and its drift guard.
- `kernel-cli/ctx`: `bdk ctx skill` gains the `setup-coverage` part kind, and the setup skill's manifest entry carries it.
- `stage-skills`: setup derives and asks every key its classification names, writes only non-default values and reports the keys left on defaults.
- `docs-site`: the settings page states each key's setup class.

## Impact

- Kernel: `kernel/src/shared/config/registry.ts` (`ConfigModule.setup`, validation), every `config.ts` that defines a module and `shared/config/modules.ts`, `shared/store/config.ts`; `kernel/src/ctx/` (manifest, new part renderer); `schema/cli/output/ctx.json` (part kind enum).
- Skill: `skills/stages/setup/SKILL.md`, `skills/stages/setup/references/stacks.md` (install commands, docs builds, fixtures).
- Tests: `kernel/tests/contract/settings-spec.test.ts`, `kernel/tests/support/settings-table.ts`, `kernel/tests/contract/stage-skills.test.ts`, `kernel/tests/docs/configuration.test.ts`, registry and ctx unit tests.
- Docs: `docs/guide/reference/configuration.md`, `docs/guide/reference/skills.md`, `docs/guide/getting-started/setup.md`.
- No settings file of a user project changes; no key, default or CLI output other than `ctx skill setup` changes.
