# Tasks

## 1. Explanations and `--explain`

- [x] 1.1 Add to `src/skills.test.ts` a test that every generic rule carries a non-empty `explain` that mentions each key of its `defaultOptions`, and to `src/main.test.ts` tests for `--explain <generic>`, `--explain <plugin rule>` with and without `explain`, and `--explain nope` (exit 2); verify they fail
- [x] 1.2 Add `explain?: string` to `Rule` in `src/index.ts`, write an explanation (what, why, fix, options) on all 27 generic rules, implement `--explain` in `src/main.ts` with its usage line, and verify 1.1 passes
- [x] 1.3 Replace the citation comparison in `src/skills.test.ts` with the explanation test from 1.1 and verify the suite passes

## 2. `reasoning-prompts`

- [x] 2.1 Write tests in `src/rules/content.test.ts`: one warning per phrase per line, case-insensitive, whole words, frontmatter exempt, option `phrases` replaces the list; verify they fail
- [x] 2.2 Implement `reasoning-prompts` in `src/rules/content.ts` with `explain`, register it in `src/rules/index.ts`, and verify 2.1 passes
- [x] 2.3 Add `fixtures/violations/reasoning-prompts/` and the rule at `error` in `fixtures/clean/skill-check.config.mjs`; verify `src/fixtures.test.ts` passes

## 3. Names, descriptions and point of view

- [x] 3.1 Write tests in `src/rules/frontmatter.test.ts`: portable `name` with `claude` or `anthropic` fails, `synced` and `anthropic-skills` fail in `claude-code` only, `claude-md-sync` passes in `claude-code`; an XML tag in `description` fails and a backticked one passes; `I review...`, `You can...`, `We ...` openers fail with a third-person message; verify they fail
- [x] 3.2 Implement the three checks in `src/rules/frontmatter.ts`, update the three `explain` texts, and verify 3.1 passes

## 4. `plugin` on agents targets

- [x] 4.1 Write tests: `src/config.test.ts` (`plugin: false` resolves, `plugin` on a skills target is a `ConfigError`), `src/testing.test.ts` (`plugin: false` reaches `doc.target`), `src/rules/frontmatter.test.ts` (`permissionMode`, `hooks`, `mcpServers` pass under `plugin: false`, fail under the default with a message naming `plugin: false`; `permissionMode: yolo`, a non-map `hooks` and a non-list `mcpServers` fail `field-values`); verify they fail
- [x] 4.2 Add `plugin` to `Target`, `ResolvedTarget` and `RuleTest` in `src/index.ts` and `src/testing.ts`, resolve it in `src/config.ts`, extend `allowedFields` in `src/profiles.ts`, update `fields` and `field-values`, and verify 4.1 passes

## 5. Kit skills, docs and spec

- [x] 5.1 Add to `src/skills.test.ts` a test that `skills/` holds `skill-check` alone; verify it fails while `skill-authoring` exists
- [x] 5.2 Delete `skills/skill-authoring/`, update `skills/skill-check/SKILL.md` (`--explain`, run after each iteration, within 30 lines), set `reasoning-prompts` to `error` in `skill-check.config.ts`; verify 5.1 and `pnpm self-check` pass
- [x] 5.3 Update the README (one skill, `--explain` in Rules, `plugin` in Configure), the plugin manifest description and the specs rule in `openspec/config.yaml` to ask for an explanation instead of a cited guideline; verify `grep -n "cited guideline" openspec/config.yaml` finds nothing

## 6. Docs check

- [x] 6.1 Add tests: `initialPrompt` reported on a plugin agents target and admitted (as a string) under `plugin: false`; `plugin: false` on a skills target resolves; `synced` reported only under `plugin: false`; `think carefully` and `think through` not reported; `<thinking>`, `scratchpad` and a phrase in `description` or `when_to_use` reported at their lines; verify they fail
- [x] 6.2 Move `initialPrompt` to `PLUGIN_IGNORED_AGENT_FIELDS`, admit `plugin` on skills targets, gate the Claude Code reserved names on `plugin: false`, replace the reasoning phrase list with the guide's examples and scan `description` and `when_to_use`, and state in the `name-format` explanation that the agent format is the kit's convention; verify 6.1 passes

## 7. Integration

- [x] 7.1 Run `pnpm build`, `git diff --exit-code dist/` after committing nothing (the bundle diff is against the rebuilt output), `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm test`, `pnpm self-check` and `openspec validate explain-rules-slim-authoring --strict`; all pass
