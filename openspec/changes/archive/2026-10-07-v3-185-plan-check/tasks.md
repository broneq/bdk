# Tasks

The recorded problem this command answers (`.claude/rules/bdk-cli.md`): the B1 measurement in `docs/design/2026-10-07-v3-architecture.md` ("Stages and units of work", risk "Assumption: 15 min execute is reachable") - 6 waves took 47 minutes, so the plan stage needs the wave count and the part sizes computed, not estimated.

## 1. Part domain

- [x] 1.1 Write `plugins/bdk/src/plan/tests/part.test.ts` (failing): part file names, frontmatter rules (missing, not a mapping, unquoted `id`, `id` not the stem, `depends-on`, `isolation`, empty `files`, glob, directory, `..`, absolute, `[id]` allowed), task counting (section bounds, fenced code, `1)` form, nested items), distinct files, bytes
- [x] 1.2 Implement `plugins/bdk/src/plan/domain/part.ts` (D2, D8) and verify `part.test.ts` passes

## 2. Plan checks and waves

- [x] 2.1 Write `plugins/bdk/src/plan/tests/check.test.ts` (failing): limits at and above each setting, `no-tasks`, `unknown-dependency`, cycle of two and self-loop with dependents left without a wave, waves of the spec example, overlap within a wave only, `shared-not-alone`, `no-parts`, problem order
- [x] 2.2 Implement `plugins/bdk/src/plan/domain/check.ts` (D6) and verify `check.test.ts` passes

## 3. Slice wiring and output

- [x] 3.1 Write `plugins/bdk/src/plan/tests/use-cases.test.ts` and `render.test.ts` (failing): in-memory `Files`, configured / not configured / invalid configuration, configured limit override, `env/plan-missing`, stray files ignored or named, nothing written; the text format of D7 and the singular forms
- [x] 3.2 Implement `store/parts.ts`, `use-cases/check.ts`, `schema/check.ts`, `render/check.ts`, `commands/check.ts`, `index.ts` of `plugins/bdk/src/plan/`; verify the tests of 3.1 pass and the result validates against the schema
- [x] 3.3 Add the `plan` row (imports `config`) to `src/slices.ts` and `planGroup` to `src/main.ts`; verify `pnpm lint` (architecture lint) and `plugins/bdk/tests/architecture-lint.test.ts` pass
- [x] 3.4 Update `CLAUDE.md` "Current state" with the `plan` slice (#185) and verify the line matches the slice list in `src/slices.ts`

## 4. End to end and gates

- [x] 4.1 Write `plugins/bdk/tests/plan.test.ts`: a temporary configured project on the real file system through the frame; acceptance signal: an oversized part, a cycle and an overlap each reported with the part id, waves printed in order, exit 0 and 1, `--json` validates against the schema, `env/plan-missing`, `env/not-configured`; verify it passes
- [x] 4.2 Run the built CLI (`pnpm build`, then `plugins/bdk/bin/bdk plan check <dir>` on a sample plan in a temporary configured project) and verify text and exit codes match the spec
- [x] 4.3 Run every check CI runs (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `claude plugin validate .claude-plugin/marketplace.json --strict`, commitlint on the commit), `openspec validate v3-185-plan-check --strict` and `openspec validate --specs --strict`; verify all pass
