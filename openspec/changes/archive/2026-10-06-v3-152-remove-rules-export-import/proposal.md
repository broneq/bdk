# Proposal

## Why

Scope: #152 and #153. Tracks #152.

`bdk rules export --claude` writes a projection of `.bdk/rules/` into `.claude/rules/bdk-generated*.md`, and `bdk rules import` cuts hand-written `.claude/rules/*.md` files into `.bdk/rules/`, one rule per top-level bullet. Together they mix two separate systems: `.claude/rules/` is a Claude Code mechanism the project owns, and `.bdk/rules/` holds the rules BDK agents read through `bdk rules show`. In a real project (ocean-recap) the import turned 25 files into 609 rules, `paths:` loading hints such as `**` became hard `applies` scopes, one file selected 340 rules for an implementer, and the export wrote a 190 KB file with 797 `paths:` entries, so Claude Code loaded every rule twice from two sources of truth. `bdk doctor` and `/bdk:setup` push every project with hand-written `.claude/rules/` into this flow. The user decided (2026-10-06) to remove both commands now instead of redesigning them, and not to keep backward compatibility, since v3 is unreleased.

This reverses T31 design D-7 (projection for the main session) and D-8 (import), and the T50 move of BDK's own development rules into `.bdk/rules/`.

## What Changes

- **BREAKING** Remove `bdk rules export` (with `--claude` and `--check`) and its projection code. `bdk rules accept` no longer regenerates a projection, and its output loses `projection`.
- **BREAKING** Remove `bdk rules import` and its bullet parser. A project rule is created only by `bdk rules accept`.
- **BREAKING** Drop `import` from the rule `origin` enum. A rule file with `origin: import` fails `bdk rules check` with `policy/rule-format`; no migration and no doctor notice.
- `bdk doctor` drops the `rule-without-id` finding (hand-written `.claude/rules/` files are the project's own and never a BDK finding) and the `projection-outdated` finding. `rules-invalid` stays and runs when `.bdk/rules/` exists.
- `policy/generated-drift` stays: `bdk export agents --check` still uses it. `policy/rule-format` and `policy/duplicate-rule-id` lose the removed commands from their emitter lists.
- Skills: `/bdk:setup` drops the "Hand-written rules" step; `/bdk:close` drops the projection check and regeneration and no longer reports regenerated rule files; `/bdk:rules` `check` mode and rule removal run only `bdk rules check`; `/bdk:doctor` no longer names `bdk rules import` or `bdk rules export --claude` as repairs.
- The removed-key reasons for `quality` and the retired `rules/` prompt keys name `bdk rules accept` instead of `bdk rules import`.
- BDK's own repository: the 13 development rules move from `.bdk/rules/` back to hand-written `.claude/rules/*.md` files with `paths:`, `.bdk/rules/` and the projection files are deleted, and the contract test that enforced the projection goes.
- User guide pages and the docs-sync map stop describing import, export and the projection.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-cli/rules`: remove the requirements `bdk rules import` and `bdk rules export`; `bdk rules accept` no longer writes or reports a projection.
- `kernel-cli`: `Exit codes and the error object` drops `rules import` and `rules export` from the emitters of `policy/rule-format`, `policy/generated-drift` and `policy/duplicate-rule-id`.
- `kernel-cli/service`: `bdk doctor` drops the `rule-without-id` and `projection-outdated` checks.
- `kernel-state`: `Rule file frontmatter` drops `origin: import`; `Write map` drops `rules import` as a writer of `.bdk/rules/`; `Markdown document shape` and `Formatter guard` drop `rules import`.
- `kernel-settings`: `Removed v2 keys` names `bdk rules accept` as the replacement of `quality`.
- `stage-skills`: remove `setup imports hand-written rules`; `close closes a reviewed Change` and `close reports the PR summary` drop the projection.
- `tools-skills`: `rules audits, captures and checks rules through the kernel` and `doctor walks the findings of bdk doctor` drop the export and import commands.
- `plugin-tooling`: `Repository rules managed by the kernel` is replaced by a requirement that keeps BDK's development rules as hand-written `.claude/rules/` files.

## Impact

- Kernel: `kernel/src/rules/` (commands, `use-cases/export.ts`, `use-cases/import.ts`, `domain/import.ts`, `domain/projection.ts`, `use-cases/health.ts`, `use-cases/accept.ts`, report, render and schema files), `kernel/src/service/use-cases/doctor.ts`, `kernel/src/shared/store/state/rule.ts`, `kernel/src/shared/config/known.ts`; regenerated `schema/` and `dist/`.
- CLI contract: two commands leave the command index; `rules-accept.json` loses `projection`; `rules-export.json` and `rules-import.json` are deleted.
- Tests: rules unit, E2E and acceptance tests, the doctor tests, the contract tests `repo-rules`, `markdown-prettier`, `stage-skills`, `tools-skills`, `state-merge`, `ctx-skill-output` and the state fixture rule `NODE-1.md`.
- Skills: `setup`, `close`, `rules`, `doctor`; `README.md`.
- Repository: `.claude/rules/`, `.bdk/rules/`, `CLAUDE.md`, `CONTRIBUTING.md`.
- Docs: `docs/guide/` (quality-and-language-rules, rules-hygiene, setup, migration-from-v2, artifacts, skills, troubleshooting) and `.claude/skills/docs-sync/references/docs-map.md`.
- Users: a project that ran the import keeps its `.bdk/rules/` files but must change `origin: import` (to `user`) or delete them before `bdk rules check` passes; leftover `.claude/rules/bdk-generated*.md` files are deleted by hand.
- Out of scope: a redesigned import (#153 is closed by this removal; a new design gets its own issue) and any way to show BDK project rules in the interactive session (the open question of #152, its own issue if needed).
