# Proposal

## Why

Tracks #184. The design section "Rules" of `docs/design/2026-10-07-v3-architecture.md` gives each role the rules of its stage and files: a rule pack with one file per rule (`kind`, `paths`, `stages`), language packs enabled by `languages`, project rules in `.bdk/rules/`, `rules.disabled`, and `bdk rules for` to select them (design section "CLI"). The orchestrators and blocks that put rules into an agent's prompt (`conform-part`, `review-group`) need that selection before they can be built. Draft 1 measured which rule text changes a review (`docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md`): of 131 bullets, 13 were effective and 4 corrected the model; v3 keeps a rule only while a measurement shows it changes the outcome (design section "Rules").

## What Changes

- A BDK rule pack in `plugins/bdk/rules/`: one Markdown file per rule with YAML frontmatter `kind` (`house` or `knowledge`), `paths` (globs), `stages` (`design`, `plan`, `execute`, `review`), `source` and `verified` for `knowledge` rules, and `measured` naming the measurement that admits the rule. Language packs live in `rules/languages/<name>/` and are read only when `languages` lists them.
- The pack holds the 16 draft rules with a measured effect: the 13 `effective` bullets and the 3 bullets that still `correct the model` after the judge spot-check (resolves "Which draft rules survive", see design D1). The other 74 of the 90 rules in `draft/v3-1:rules/` stay out: none has a measured effect.
- Project rules: the same file format under `.bdk/rules/` of the project; their ids may not use the `BDK-` prefix of the pack. `rules.disabled` switches off a rule of either origin by id.
- New command `bdk rules for --stage <stage> [--files <file>]...`: prints the rules a role of that stage reads for those files, with their text ready for a prompt, or one JSON document under `--json`. New slice `src/rules/`, with a matrix edge to `config` for `languages` and `rules.disabled`.
- The CLI frame accepts a repeatable string flag (`--files a --files b`), the shape #183 adopts for its own lists.

## Capabilities

### New Capabilities

- `rule-pack`: the rule file format, where the BDK pack and project rules live, language packs, `rules.disabled`, and the admission rule (a pack rule names the measurement that shows its effect).
- `bdk-cli/rules`: the `bdk rules for` command - selection by stage, path and language, output, errors.

### Modified Capabilities

- `bdk-cli`: "Invocation and routing" and "Help" gain the repeatable string flag.

## Impact

- `plugins/bdk/rules/` (new: 16 rule files and `README.md`), `plugins/bdk/src/rules/` (new slice), `src/slices.ts` (row `rules -> config`), `src/main.ts` (wiring, the pack directory).
- Shared ground: `src/shared/cli/` (`Flag.multiple`, list values in `Input.flags`, help), `plugins/bdk/package.json` and `pnpm-lock.yaml` (dependency `minimatch` 10.2.6, already in the lockfile through ESLint).
- Out of scope: putting the rules into prompts (`conform-part`, `review-group` and their orchestrators, later issues), `/bdk:add-rule` and `/bdk:refine-rules` (tools of the design section "Blocks"), `/bdk:setup` writing `languages` (#181), re-measuring the dropped draft rules.
