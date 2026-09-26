# Tasks

## 1. Option validation

- [x] 1.1 Write tests in `src/config.test.ts` (loader) and `src/testing.test.ts` (tester): a rule enabled without a required option, or with a malformed one, is a `ConfigError` naming the rule; a rule that is off is not validated; verify they fail
- [x] 1.2 Add `validateOptions` to the `Rule` interface, call it from the loader and the tester, and verify 1.1 passes

## 2. Rules

- [x] 2.1 Write `src/rules/policy.test.ts` with the tester, porting the edge cases of BDK's rule tests to `block-form`, `block-allowed-tools`, `forbidden-text`, `required-fields`, `body-shape` and `namespaced-refs`, plus option validation; verify it fails for the missing module
- [x] 2.2 Implement the six rules in `src/rules/policy.ts` with helpers in `src/rules/shared.ts`, and verify 2.1 passes
- [x] 2.3 Write `portable-syntax` tests in `src/rules/content.test.ts`; verify they fail
- [x] 2.4 Implement `portable-syntax` in `src/rules/content.ts`, register all seven rules, and verify 2.3 passes

## 3. Fixtures

- [x] 3.1 Enable the policy rules with options in `fixtures/clean/skill-check.config.mjs`, keep the clean tree clean, and add one violation overlay per new rule; verify the fixture suite passes

## 4. Kit skills

- [x] 4.1 Add a test that `skills/skill-authoring` passes the portable profile on its own; move the kit config to the `claude-code` profile and the `self-check` script to the config as written
- [x] 4.2 Extend `skill-authoring`: cite the seven new IDs, add portability of reusable skills and agents, read-only agents, and a `references/claude-code.md` on substitutions, `!` blocks, subagent dispatch, skill-scoped hooks and sharing within a plugin; verify the citation test passes

## 5. Docs and integration

- [x] 5.1 Update the README
- [x] 5.2 Run the full local CI (build, bundle diff, lint, format check, typecheck, knip, test, self-check) and `openspec validate add-policy-rules --strict`
