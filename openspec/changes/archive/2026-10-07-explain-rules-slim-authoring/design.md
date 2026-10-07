# Design

## Context

See proposal.md - Why. The checker has 27 generic rules in `src/rules/`, each a `defineRule` value registered in `src/rules/index.ts`; `src/skills.test.ts` compares the rule IDs cited in `skills/skill-authoring/` with that list. `src/main.ts` parses flags with `node:util` `parseArgs` and already has a config-loading flag (`--list-rules`). Agents targets resolve through `loadTarget` in `src/config.ts` into `ResolvedTarget`, which rules read as `doc.target`. The field lists sit in `src/profiles.ts`, with `PLUGIN_IGNORED_AGENT_FIELDS` separate from the admitted agent fields.

## Goals / Non-Goals

**Goals:**

- A finding's rule ID resolves to a full explanation without loading any skill into the agent's context.
- The kit keeps no prose of its own about writing a skill, so nothing in it can diverge from Anthropic's guides.
- The four host behaviours the kit now misses (reasoning extraction declines, reserved names and XML tags, point of view, non-plugin agent fields) become deterministic checks.

**Non-Goals:**

- A skill creation or evaluation workflow. Anthropic's `skill-creator` and `claude plugin eval` cover it.
- Replacing the spec's rule catalogue table with the explanations. The table stays the contract; the explanation is the help text.
- Detecting reasoning prompts by meaning. The rule matches a phrase list, and a project tunes the list.

## Decisions

**The explanation lives on the rule definition as `explain`.** Each generic rule gains an `explain` string next to its `check`, and the `Rule` interface exposes the field so a plugin rule can carry one. Alternative: a separate `src/explanations.ts` map from ID to text. It lost because the text drifts from the check when they live apart, and a plugin author would have no way to add one. Alternative: generate the text from the spec table. It lost because the table says what, not why or how to fix, and the CLI must not read the spec at run time.

**`--explain` loads the config, like `--list-rules`.** The config is where plugin rules come from, so resolving `acme/no-todo` needs it. Alternative: resolve generic IDs without a config and load it only for namespaced IDs. It lost because two resolution paths for one flag is more surface than the gain: the kit's `skill-check` skill runs from a project root where the config exists, and a project without a config has no findings to explain.

**`reasoning-prompts` is a warning with a phrase list, modelled on `model-names`.** The phrases follow the examples in Anthropic's refusals guide for `reasoning_extraction`: wording that asks for the reasoning itself in the output (a `<thinking>` or scratchpad section, reasoning shown or written out, chain-of-thought steps). Encouragement such as `think carefully` or `think through` asks for no output and is not on the list. The phrases are matched case-insensitively on whole words in body lines and in `description` and `when_to_use`, since the guide says the wording counts in a skill or tool description too; one finding per matched phrase per line, with the matched text as the fingerprint. Default severity is warning, not error: on Opus 5.5 and Fable 5.1 such a line can make the whole run be declined, but on other models it is only waste, and a consumer with such lines must not go red on a minor upgrade. The kit's own config sets it to error. Alternative: error by default, as `portable-syntax` is. It lost for the upgrade reason; a consumer that targets the current models raises it in one line.

**Reserved names depend on the profile.** The Skills API rejects `anthropic` and `claude` anywhere in a name; Claude Code refuses to load `synced` and `anthropic-skills`. The portable profile models the first, the `claude-code` profile with `plugin: false` the second: the Claude Code docs reserve both names outside a plugin only (`synced` in the enterprise, personal and project locations; `anthropic-skills` "outside a plugin"), so a plugin skills target is exempt. Alternative: reject both sets in both profiles. It lost because a Claude Code plugin skill named `claude-md-sync` is legal and in use, and a portable skill named `synced` is legal on the API. The XML-tag check on `description` applies in both profiles, with backticked spans exempt so a description can mention `<component>` as code: a tag in the system prompt listing is a problem on every host.

**Point of view is a filler check, not a new rule.** The first- and second-person openers join the `FILLER` pattern of `description-front-loaded`, whose message now says to write in the third person. Alternative: a separate `description-person` rule. It lost because the check is the same shape (what the first words are) with the same severity and fix, and a consumer would set both the same way.

**`plugin` is a target option, resolved to a boolean on `ResolvedTarget`.** `fields` reads `doc.target.plugin` to decide whether the four ignored fields (`hooks`, `mcpServers`, `permissionMode`, `initialPrompt`, per the plugins/components page) are admitted, and `field-values` validates them only when admitted; `name-format` reads it on skills for the reserved names. The default `true` keeps every current finding. Alternative: a per-rule option on `fields`. It lost because `field-values` and `name-format` need the same knowledge, and whether a directory ships in a plugin is a fact about the directory, not a rule setting. The rule tester mirrors the option so a rule can be tested in both modes.

**`skill-authoring` is deleted, not slimmed.** A first draft kept the skill at 40 lines of kit opinions and Claude Code traps. Checked against the docs, every line was either in Anthropic's best practices, in `skill-creator`'s loop (testing a skill with and without), in the Claude Code docs (pre-approval through `allowed-tools`, the host waiting for a subagent's completion notification, plugin namespacing) or in a rule's explanation. What remained was the kit's own stance on process versus knowledge, which the kit does not want to hold against Anthropic's guidance. The test that compared cited IDs with the catalogue is replaced by a test that every generic rule has an explanation, and the OpenSpec rule that asked for a cited guideline per new rule now asks for the explanation. Alternative: keep a 20-line skill of traps. It lost because each trap is in the docs or in `--explain`, and a skill's description sits in context in every session.

## Risks / Trade-offs

- [`reasoning-prompts` matches phrases, so a sentence that mentions a scratchpad file or a `<thinking>` tag as data is flagged] → warning by default; the option `phrases` replaces the list, and the message says why the phrase is reported.
- [An existing consumer description such as "You can use this to ..." becomes a `description-front-loaded` finding] → the rule is a warning by default, and the fix is one sentence.
- [Without `skill-authoring`, an agent has no kit text on how to write a skill] → that is by design: `skill-creator` and the best-practices guide are the process, and the `skill-check` skill sends the agent to `--explain` on a finding.
- [`--explain` output is prose that may be quoted in the spec or README later and drift] → the spec requires what the text covers, not its wording; the README points at the flag instead of copying any text.
