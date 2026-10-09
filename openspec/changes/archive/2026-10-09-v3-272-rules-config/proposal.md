## Why

Tracks #272.

A project's own rules live as Markdown files with frontmatter under `.bdk/rules/`, while switching a rule off lives in `.bdk/settings.yaml`: what rules a project has, where they apply and which layer set them is visible only by opening each file, `bdk config check` does not validate them, and a `local` `rules.disabled` replaces the team's whole list. Separately, the rule format promises the stages `design` and `plan`, and 14 of the 16 pack rules name one of them, but no design or plan block calls `bdk rules for`, so those rules reach no role (`docs/concepts/rules.md`, found for #268).

## What Changes

- **BREAKING** Project rules are declared in the settings: `rules` becomes a map keyed by rule id, merged across the layers `global` < `project` < `local` like every mapping (spec `bdk-cli/config`, "Merge"). A project rule holds exactly one of `text` (inline) or `file` (a Markdown file; a leading frontmatter block is skipped). `kind` defaults to `house`, `paths` to `["**"]`, `stages` to `[execute, review]`, `enabled` to `true`; `source` and `verified` stay required for `kind: knowledge`.
- **BREAKING** `.bdk/rules/` is no longer read, with no warning and no migration: v3 is unreleased (#213) and v2 (`v2.7.0`) had no `.bdk/rules/`.
- **BREAKING** `rules.disabled` is removed. An entry `enabled: false` switches a rule off; an entry whose id starts with `BDK-` adjusts a pack rule and may set only `enabled`, `paths` and `stages`, never a text.
- A key segment directly under `rules` follows the rule id grammar (letters, digits, `-`), the one exception to kebab-case keys, so ids keep the case findings and docs cite (`rules.API-1.enabled`).
- `bdk rules for` reads project rules from the resolved configuration. A rule's `origin` is `bdk` or the layer that defines its text (`global`, `project`, `local`). The warning "no rules for language X" is removed; `languages` selects only the BDK language packs.
- `/bdk:design-draft` and `/bdk:verify-design` read `bdk rules for --stage design`; `/bdk:plan-draft` reads `--stage plan`, `/bdk:verify-plan` reads it per part with the part's files. The draft follows the rules and cites the id of a rule a decision, part or task follows from; the verifier reports a design or a part that breaks one.
- Pack rules keep `plan` only in `BDK-ARCH-3`, `BDK-ARCH-4` and `BDK-CQ-1`; `BDK-CQ-4` and the nine language rules drop it.
- Eval cases for the design and the plan stage rules.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `rule-pack`: "Project rules" move from `.bdk/rules/` files into the settings; "Switching rules off" becomes `enabled: false` with pack rule adjustments; "Rule file" covers the pack only.
- `bdk-cli/rules`: selection reads project rules and pack adjustments from the configuration, `origin` names the layer, the language warning goes, errors for a rule file named by `file`.
- `bdk-cli/config`: the `rules` row of "Settings keys" and the key grammar exception for rule ids.
- `design-blocks`: `design-draft` and `verify-design` read and apply the design rules; eval cases.
- `bdk-plan-blocks`: `plan-draft` and `verify-plan` read and apply the plan rules; eval cases.
- `docs-site`: the rule catalogue of the Reference no longer refers to `rules.disabled`.

## Impact

- Code: `plugins/bdk/src/config/` (settings schema, `loadConfig` result with origins and layer files), `plugins/bdk/src/rules/` (selection, project rules from the configuration, `file` reading; `store/rules.ts` keeps only the pack), `scripts/docs-reference/` (rules page intro), 11 pack rule files (`stages`), `plugins/bdk/src/slices.ts` (the `why` of the `rules` edge).
- Skills: `plugins/bdk/skills/design-draft/`, `verify-design/`, `plan-draft/`, `verify-plan/`, rebuilt with `/skill-creator`, with new eval cases under `plugins/bdk/evals/`.
- User docs: `docs/concepts/rules.md`, `docs/concepts/cli-config-hooks.md`, `docs/concepts/stages.md`, `docs/guide/configuration.md`, `docs/guide/footprint.md`, `plugins/bdk/rules/README.md`, and the Reference regenerated with `pnpm docs:reference`.
- Breaking for any project that has `.bdk/rules/` or `rules.disabled`: `bdk config check` reports a leftover `rules.disabled` as an invalid rule entry.
- Out of scope: reviewers reading `CLAUDE.md` and `.claude/rules/` (#273), models and effort for designer and planner roles (#278, blocked by this Change), `models.verifier` in `verify-design` (#274).
