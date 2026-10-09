# Tasks

The hook exists; this Change replaces its content. The problem it answers: the session start context had no stated purpose and told the main session nothing about how work is done in a BDK project (proposal, Why). No measurement is made (design.md, D5).

## 1. Session start context

- [x] 1.1 Rewrite the session-start tests in `plugins/bdk/src/hooks/tests/commands.test.ts` to the four scenarios of the spec delta (Configured project, No CLI pointers, Guard on, Same text whatever the run state) and add the D2a check to the end-to-end `plugins/bdk/tests/hooks.test.ts` (every `/bdk:<name>` in the context has `plugins/bdk/skills/<name>/SKILL.md`); verify they fail with `pnpm vitest run plugins/bdk/src/hooks/tests/commands.test.ts plugins/bdk/tests/hooks.test.ts`
- [x] 1.2 Replace the context lines in `plugins/bdk/src/hooks/use-cases/session-start.ts` with the five fixed lines of design.md D2, drop the `LEAD` import and the `hooks.subagent-git` read; verify the tests of 1.1 pass

## 2. Docs

- [x] 2.1 Update `docs/concepts/cli-config-hooks.md`: the `hooks.subagent-git` row names only `bdk hooks pre-tool-use`, and the SessionStart sequence diagram says the context is the BDK process in five fixed lines; update `docs/guide/install.md` to say the hook also gives the BDK process, and verify `docs/guide/first-run.md` still matches
- [x] 2.2 Run `pnpm docs:reference` and verify the Reference is unchanged or regenerated

## 3. Acceptance and gates

- [x] 3.1 End to end: build the plugin, run `bdk hooks session-start -` through `node plugins/bdk/dist/bdk.mjs` in a temporary configured project and in an unconfigured one, and start `claude -p --plugin-dir plugins/bdk` in the configured project to check that the session receives the five lines; verify the output matches the spec delta
- [x] 3.2 Run every check CI runs: `pnpm check`, `claude plugin validate` for the marketplace and every plugin, `node scripts/docs-impact.ts` where it applies, `pnpm --filter @bdk/docs docs:build`, `openspec validate v3-285-session-start-context --strict` and `openspec validate --specs --strict`; verify each passes
