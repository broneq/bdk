# Tasks

The command is a CLI helper for a recorded problem: the main thread is the most expensive agent of a run (B1: 1,037 turns, 3 compactions; `docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`), and each resume reads the files of the nine-row table turn by turn (proposal.md - Why).

## 1. Shared ground

- [x] 1.1 Add `zod` `4.6.5` (exact) to `plugins/bdk/package.json` `dependencies`, run `pnpm install`, and verify `pnpm --filter @bdk/bdk typecheck` passes
- [x] 1.2 Write the failing test `src/shared/fs/tests/fs.test.ts` for `readText` (text, undefined on a missing file and on a path under a file) and `list` (entries sorted by name with `dir`, undefined on a missing directory) against a temporary directory
- [x] 1.3 Add `src/shared/fs/index.ts` with the agreed `Files` interface (design D6), admit it in `src/slices.ts` `SHARED` as `os-boundary`, and verify the test of 1.2 and `pnpm lint` pass (at rebase replaced by the same module merged by #187, design D6)

## 2. Domain: verdict, fold and resume table

- [x] 2.1 Write failing tests `src/run/tests/domain.test.ts`: the verdict line (plain, bold, heading, lower case, FAIL, missing), and one test per resume table row 1-9 (each close step) plus `done` and "earlier row wins", on hand-built snapshots
- [x] 2.2 Implement `src/run/domain/status.ts` and verify the tests of 2.1 pass

## 3. Store, use case, render, schema, command

- [x] 3.1 Write failing tests `src/run/tests/status.test.ts` that build run trees in an in-memory `Files` (`tests/files.ts`; the OS boundary keeps `node:fs` out of slice tests, the real file system is covered by 3.3) and run the command through the frame's `run()`: each resume table row end to end, archived Change, missing `state.json`, `env/no-run`, `env/invalid-run-state` for invalid JSON, a wrong `current`, an unsafe name and an invalid part status, text output, `--json` validated by the output schema, warnings from the `findings` fold (broken line, unknown id, latest level wins), and byte-identical repeated output
- [x] 3.2 Implement `src/run/store/status.ts` (zod schemas of `run.json` and `state.json`, the snapshot read), `use-cases/status.ts`, `render/status.ts`, `schema/status.ts`, `commands/status.ts` and `index.ts` (`runGroup({ files, cwd })`), add the `run` row with the edge `run -> findings` (`listFindings`, design D5) to `src/slices.ts` and `runGroup` to `GROUPS` in `src/main.ts`, and verify the tests of 3.1 and `pnpm lint` pass
- [x] 3.3 Extend `tests/cli.test.ts` with `bdk run status --json` through the built launcher on a temporary project, and verify it passes

## 4. Acceptance and gates

- [x] 4.1 Check the Acceptance signal: every row of the resume table has a test in 2.1 and in 3.1 (list them against the spec `bdk-cli/run` scenarios)
- [x] 4.2 Run `pnpm build` and `bdk run status` from `plugins/bdk/bin/` in a scratch project with a hand-written run, and verify text and `--json` output
- [x] 4.3 Run every check CI runs (`.github/workflows/`), `openspec validate v3-188-run-status --strict` and `openspec validate --specs --strict`, and verify all pass
