# Proposal

## Why

The kit's `skill-authoring` skill is 122 lines plus five references that mostly restate Anthropic's own documentation (frontmatter tables, progressive disclosure, description writing) and the kit's rule catalogue, so an agent pays for it on every skill task and gains little that `skill-creator` and the Agent Skills best-practices guide do not already give. The kit's real value is the deterministic checker, and four of its checks are behind the current guidance: skills that ask the model to put its reasoning in the output are declined by the current models with safety classifiers (`reasoning_extraction`, which has no fallback model), names and descriptions with reserved words or XML tags are rejected by the Skills API, first-person descriptions hurt discovery, and `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` are reported as ignored on every agent though only plugin agents ignore them, while the skill names Claude Code reserves outside a plugin are reported inside one.

## What Changes

- New generic rule `reasoning-prompts` (skills, agents, warning by default): the body, `description` and `when_to_use` hold no phrase that asks the model to put its reasoning in the output (`think step by step`, `show your reasoning`, `chain of thought`, `<thinking>`, `scratchpad` and the rest of the option `phrases`).
- `name-format` rejects reserved names: in the portable profile a `name` containing `anthropic` or `claude`; in the `claude-code` profile on a target with `plugin: false` the names `synced` and `anthropic-skills`, which the host refuses to load outside a plugin. Its explanation says the agent format is the kit's convention. `description` rejects an XML tag in the description. `description-front-loaded` also rejects a first- or second-person opener (`I`, `I'll`, `We`, `You`).
- Targets gain the option `plugin` (default `true`). On agents with `plugin: false` the fields `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` are admitted and their values validated; with `plugin: true` the `fields` message names the option.
- `skill-check --explain <rule>` prints what a rule checks, why, how to fix a finding and its options. The explanation lives on the rule definition, and a plugin rule can carry one too.
- **BREAKING**: the `skill-authoring` skill is removed. Everything it said is in Anthropic's Agent Skills best practices, in `skill-creator` or in a rule's explanation, and the kit keeps no prose of its own that could diverge from those guides. The plugin ships `skill-check` alone. The kit's test that compares cited IDs with the catalogue is replaced by a test that every generic rule has an explanation.
- `skill-check` (the skill) tells the agent to run `--explain` on a finding and to run the checker after each `skill-creator` iteration.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `skill-kit`: the invocation requirement gains `--explain`; the targets requirement gains `plugin`; the rule API gains `explain`; the profiles requirement makes the plugin-ignored agent fields conditional on `plugin`; the rule catalogue gains `reasoning-prompts` and changes the rows of `name-format`, `description` and `description-front-loaded`; the rule tester accepts `plugin`; the requirement "Skills shipped by the kit" is removed and replaced by "Kit skill", which ships `skill-check` alone.

## Impact

- New: `fixtures/violations/reasoning-prompts/`, explanation text on every generic rule.
- Changed: `src/index.ts` (`Target.plugin`, `ResolvedTarget.plugin`, `Rule.explain`), `src/config.ts`, `src/testing.ts`, `src/main.ts` (`--explain`, usage text), `src/profiles.ts`, `src/rules/frontmatter.ts`, `src/rules/content.ts`, `src/rules/index.ts`, `src/skills.test.ts`, the clean fixture config, `skills/skill-authoring/` (deleted), `skills/skill-check/SKILL.md`, README, `openspec/config.yaml` (the rule that asked for a cited guideline now asks for an explanation), `dist/`.
- Consumers of the plugin lose the `skill-authoring` skill. `reasoning-prompts` is a warning by default, so a clean run stays exit 0 without `--strict`. The reserved-name, XML-tag and person checks are errors; a consumer hit by one has a real host problem.
