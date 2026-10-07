# Tasks

## 1. Shared ground

- [x] 1.1 Add `zod` 4.6.5 (exact) to the `dependencies` of `plugins/bdk/package.json`, run `pnpm install`, and verify `pnpm typecheck` passes
- [x] 1.2 Write the failing tests of `shared/fs` (`readText` undefined on a missing file, `list` sorted and undefined on a missing directory, `writeText` and `appendText` creating parent directories, `appendText` adding to the end) and verify they fail
- [x] 1.3 Implement `src/shared/fs/index.ts` (the `Files` interface and `files`, API agreed with #179), admit it in `src/slices.ts` as `os-boundary`, and verify its tests and `pnpm lint` pass

## 2. Domain: events, id and fold

- [x] 2.1 Write the failing unit tests of the dedupe key and id (spec "Finding id and dedupe key": same rule on the same line, same normalised summary, different rule) and verify they fail
- [x] 2.2 Implement `domain/events.ts` (zod event schemas) and `domain/id.ts`, and verify the id tests pass
- [x] 2.3 Write the failing unit tests of the fold (latest level and decision win, duplicates fold with sources and reports, filters and counts, damaged and orphan lines skipped with their numbers) and verify they fail
- [x] 2.4 Implement `domain/fold.ts` and verify the fold tests pass

## 3. Commands

- [x] 3.1 Write the failing use-case and command tests for `add`, `level`, `decide` and `list` against an in-memory `Files` (usage errors of the spec, unknown id, defer without issue, missing directory `env/log-dir-missing`, text and JSON output validated against each `schema/`) and verify they fail
- [x] 3.2 Implement `store/log.ts`, `use-cases/`, `schema/`, `render/`, `commands/` and `index.ts` (`findingsGroup(deps)`, `addFinding`, `listFindings`), register the slice in `src/slices.ts` and `findingsGroup({ files })` in `src/main.ts`, and verify the slice tests and `pnpm lint` pass
- [x] 3.3 Update the `bdk findings` row of the CLI table in `docs/design/2026-10-07-v3-architecture.md` to the verbs `add|level|decide|list` (design D4), and verify `pnpm format:check` passes

## 4. Acceptance and gates

- [x] 4.1 Write an end-to-end test of the built CLI (`plugins/bdk/tests/findings-cli.test.ts`): 50 parallel `bdk findings add` processes on one log leave 50 valid lines and `list` counts 50; a finding with two levels and two decisions lists with the latest of each; verify it passes
- [x] 4.2 Run every check CI runs (`pnpm check`, `claude plugin validate` on the marketplace and every plugin, commitlint on the commit), `openspec validate v3-187-findings-event-log --strict` and `openspec validate --specs --strict`, and verify all pass
