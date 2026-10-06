# Tasks

## 1. Reproduce

- [x] 1.1 Build the bundle and, in a fresh temporary repository, run `bdk change new`, `bdk rules accept`, `bdk log add decision` with a body, and the pinned `prettier --check` over the written files. Verify that the rule file and the profile assumption entry fail the check, as #140 reports. Keep the commands for the final check in 6.1.

## 2. Markdown document shape (`kernel-state`, Markdown document shape)

- [x] 2.1 Write failing unit tests for `splitFrontmatter`: one blank line after the closing `---` is consumed, a second one stays in the body, the old shape reads to the same body, and CRLF input behaves the same. Verify they fail.
- [x] 2.2 Make `splitFrontmatter` consume at most one line break after the closing `---` line, and verify the 2.1 tests pass.
- [x] 2.3 Write failing unit tests for `renderDocument` (block and flow style): a non-empty body is preceded by exactly one blank line, an empty body ends at `---\n`, and render-split-render is byte-stable for both input shapes. Verify they fail.
- [x] 2.4 Change `renderDocument` to the new separator, and verify the 2.3 tests pass.
- [x] 2.5 Write a failing test in `kernel/src/spec/` showing that a living spec renders in the new shape, that its `bdk-merge-hash` equals the hash of `renderBody`, and that an old-shape file still verifies. Then route `renderFile` through `renderDocument` with the keys in order `bdk-merge-hash`, `bdk-change`, and verify the test passes.
- [x] 2.6 Regenerate the byte snapshots and the state fixture (`kernel/tests/fixtures/state/`) that change because of the separator, review the diff so that only separator lines change, and verify `pnpm test:unit` and `pnpm test:contract` pass for the affected files.
- [x] 2.7 Write the contract test `kernel/tests/contract/markdown-prettier.test.ts` (design D5). It writes every kernel Markdown kind of the `Markdown document shape` scenario through the bundle and asserts that `prettier.format(text, { filepath })` of the pinned devDependency equals the bytes. Verify it passes. Verify it fails when the 2.4 change is reverted locally.

## 3. Formatter guard (`kernel-state`, Formatter guard)

- [x] 3.1 Write failing unit tests for `ensureFormatterGuard` next to `kernel/src/shared/store/ignore.ts`: it creates `.bdk/.prettierrc` with the guard content when absent, leaves an existing file of any content byte-identical, and reports whether it wrote. Verify they fail, then implement it, export it from `shared/store/index.ts`, and verify they pass.
- [x] 3.2 Write failing E2E scenarios for `change new` (guard created, idempotent, refused `policy/empty-range` writes no guard) and `config set` (guard created, a user's `{"semi": false}` kept). Call `ensureFormatterGuard` where both commands call `ensureIgnored`, and verify the scenarios pass.
- [x] 3.3 Write failing E2E scenarios for `rules accept` and `rules import` (guard created; `rules import --dry-run` writes none). Call the guard before their first write, and verify the scenarios pass.
- [x] 3.4 Add `.bdk/.prettierrc` to the `writes` of `change-new`, `config-set`, `rules-accept` and `rules-import` in `schema/cli/commands.json`, matching the delta `**Writes:**` lines. Verify `pnpm test:contract` (`state-write-map`, `cli-contract`) passes.
- [x] 3.5 Write an E2E test for the `explicit paths are skipped` scenario: the pinned Prettier `--check`s a hand-broken rule file by path from the project root and from `.bdk/rules/`. Verify both runs exit 0 with the guard, and verify the test fails without it.

## 4. Session-start warning (`kernel-cli/hooks`, bdk hooks session-start)

- [x] 4.1 Write failing unit tests in `session-start.test.ts` for a missing guard, an unparseable guard, a guard that is not in force (warning line first after the STARTUP text, file untouched), a valid guard (no line), and no `.bdk/` (no line). Update the `known keys stay silent` fixture to carry a valid guard. Verify the tests fail.
- [x] 4.2 Implement the check in `hooks/use-cases/session-start.ts` and the line in `hooks/render/session-start.ts` (design D4), and verify the 4.1 tests and `hooks.e2e.ts` pass. Verify `pnpm test:perf` keeps `session-start.perf.ts` within its budget.

## 5. Formatter E2E and repository cleanup (`kernel-state`, Committed state is hashed byte for byte)

- [x] 5.1 Rework `kernel/src/spec/tests/formatter.e2e.ts` to the three scenarios of the delta: no guard with `--prose-wrap always --print-width 40` (stale node and `merge-hash`), the guard (nothing changes), and no guard with default options (no kernel-written file changes, no `merge-hash`). Update the header comment, and verify the file passes.
- [x] 5.2 Remove the `.prettierignore` entries that exist only for kernel output: `kernel/tests/fixtures/state/` if the regenerated fixture passes `prettier --check`, and any `.bdk/` path. Verify `pnpm format:check` passes. If an entry must stay, give it a comment that says why.
- [x] 5.3 Update the user documentation that describes what the kernel writes and what session start reports (`docs/guide/reference/hooks.md`, `docs/guide/reference/artifacts.md`, `docs/guide/troubleshooting.md`, `docs/guide/getting-started/setup.md`, as each applies) with the guard, its warning, and the fix. Verify with `/docs-sync` against the diff, and verify `pnpm docs:build` passes.

## 6. Acceptance

- [x] 6.1 Rerun the 1.1 reproduction against the new bundle. Verify that `prettier --check` passes on every kernel-written file with the guard removed, and that with the guard in place `prettier --write .` changes nothing under `.bdk/`.
- [x] 6.2 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm build && pnpm test:e2e` and `pnpm test:contract`, and verify all of them pass.
- [x] 6.3 Run `openspec validate prettier-stable-markdown --strict` and verify it reports the change as valid.
