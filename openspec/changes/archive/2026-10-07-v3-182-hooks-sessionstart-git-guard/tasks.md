# Tasks

The problem these hooks answer is recorded in proposal.md (architecture "Hooks", risk "Guard blocks the merge-back", validation rows 1 and 3).

## 1. Stdin boundary and slice skeleton

- [x] 1.1 Rely on the slice parity the architecture lint already tests (`plugins/bdk/tests/architecture-lint.test.ts`, "fails to load when a slice directory has no matrix entry") instead of a new test: a `src/hooks/` without its `src/slices.ts` row fails `pnpm lint`
- [x] 1.2 Add `src/shared/stdin/index.ts` (`readStdin`), the `hooks` row in `src/slices.ts`, the `SHARED` row, and an empty `hooksGroup` wired in `src/main.ts`; verify `pnpm lint` and the test pass

## 2. Command reading and the git history table (domain)

- [x] 2.1 Write failing unit tests for the shell reader: separators, quotes, escapes, comments, heredocs, redirections, wrappers, assignments, `sh -c`/`eval` and `$(...)`/backtick nesting up to three levels, unterminated input; verify they fail
- [x] 2.2 Port the reader into `src/hooks/domain/shell.ts`; verify the tests pass
- [x] 2.3 Write failing unit tests for every row of the spec's "Git history changes" table, the listing forms that pass, global options and the spec scenarios; verify they fail
- [x] 2.4 Implement `src/hooks/domain/git-history.ts`; verify the tests pass

## 3. `bdk hooks pre-tool-use`

- [x] 3.1 Write failing tests through the frame with an in-memory project: payload parsing (`usage/invalid-payload`, argument other than `-`), the five deny conditions and each allow path (main thread, `bdk:lead`, guard off, unconfigured, invalid config, non-Bash, read-only git), deny output shape, `{}` on allow, `--json` against the schema, and that no file is read when conditions 1 to 4 fail; verify they fail
- [x] 3.2 Implement payload domain, use case, render, schema and command; verify the tests pass

## 4. `bdk hooks session-start`

- [x] 4.1 Write failing tests through the frame: configured context (root, `bdk config show`, at most six lines), the guard line when on, the not-configured and invalid warnings with no `hookSpecificOutput`, payload `cwd` used over the process cwd, `--json` against the schema; verify they fail
- [x] 4.2 Implement use case, render, schema and command; verify the tests pass

## 5. Registration and end-to-end

- [x] 5.1 Write a failing end-to-end test against the built bundle outside the workspace: `hooks.json` registers exactly the two events with the spec's commands; running each `hooks.json` command through `sh -c` with a payload on stdin gives the spec's output for a worker commit (denied), a `bdk:lead` commit (allowed), and a session without configuration (one warning); the `pre-tool-use` command exits 1 without `dist/bdk.mjs`; verify it fails
- [x] 5.2 Add `plugins/bdk/hooks/hooks.json`; verify the test passes and `claude plugin validate plugins/bdk --strict` passes
- [x] 5.3 Update the "Current state" of `CLAUDE.md` with the `hooks` slice (#182); verify by reading it

## 6. Acceptance and gates

- [x] 6.1 Acceptance in a separate test project with `claude -p --plugin-dir plugins/bdk`: with `hooks.subagent-git: true`, a `general-purpose` subagent's `git commit` is refused with the guard's reason and the main thread's commit passes; a session without configuration shows the one warning (`systemMessage` in stream-json); record the results in the PR
- [x] 6.2 Run every check of `.github/workflows/pr.yml` (`pnpm check` and the rest), `openspec validate v3-182-hooks-sessionstart-git-guard --strict` and `openspec validate --specs --strict`; verify all pass
