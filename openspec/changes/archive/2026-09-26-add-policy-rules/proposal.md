# Proposal

## Why

BDK keeps nine rules of its own in a `bdk` plugin: the form of `!` blocks, the `allowed-tools` a block needs, forbidden terms, required frontmatter per named skill, the shape of adapter agents, namespaced references and Claude Code syntax in portable skills. Each hardcodes BDK names, and BDK carries their unit tests and fixtures. None of the checks is specific to BDK once its names become options: any plugin that wraps a CLI in `!` blocks, gates skills behind `disable-model-invocation`, or ships portable skills next to Claude Code ones needs the same checks. Owning them in the kit gives every consumer the rules and their tests, and leaves a consumer with data only: its config and its baseline.

The `skill-authoring` skill also lacks guidance that BDK's own authoring rules hold today: portability of reusable skills and agents, read-only agents, string substitutions, subagent dispatch, skill-scoped hooks and sharing files between skills of one plugin.

## What Changes

- Seven generic rules:
  - `portable-syntax` (on by default): a skill in the portable profile uses no `!` block and no `${CLAUDE_*}` substitution.
  - Six project policy rules, off by default and driven by options: `block-form`, `block-allowed-tools`, `forbidden-text`, `required-fields`, `body-shape`, `namespaced-refs`.
- **BREAKING** for consumers with portable skills: `portable-syntax` reports Claude Code syntax that passed before.
- The rule API gains `validateOptions`. The config loader and the rule tester call it for every enabled rule, so a rule enabled without an option it needs, or with a malformed one, is a configuration error (exit 2) naming the rule.
- The kit's `skill-check` skill runs the plugin's bundled CLI through `${CLAUDE_PLUGIN_ROOT}`, so it moves to the `claude-code` profile. `skill-authoring` stays portable, checked by a test. The self-check CI step runs the kit's config as written instead of `--portable`.
- `skill-authoring` cites the seven new IDs and gains the guidance listed in Why, with a new reference on Claude Code features.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `skill-kit`: the rule catalogue gains seven rows and a "Project policy rules" requirement; the rule API and the rule tester validate options; the release requirement's self-check step and the shipped-skills requirement change profile for `skill-check`.

## Impact

- New: `src/rules/policy.ts`, `src/rules/shared.ts`, their tests, seven violation fixtures, `skills/skill-authoring/references/claude-code.md`.
- Changed: `src/index.ts` (the `validateOptions` hook), `src/config.ts`, `src/testing.ts`, `src/rules/content.ts`, `src/rules/index.ts`, the clean fixture config and files, `skill-check.config.ts`, `package.json` `self-check`, the CI step name, `skills/skill-authoring/`, README.
- BDK replaces its `bdk` plugin with settings of these rules.
