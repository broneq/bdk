# Tasks

## 1. Start

- [ ] 1.1 Confirm issue #56's card is "In progress" on the project board; verify the item's `status` reads `In Progress`
- [ ] 1.2 Record the T24 resolutions in `docs/V3-IMPLEMENTATION-PLAN.md`: the T24 section gets a "Resolution" block pointing each "To resolve in the spec" item to this Change, and the T41 section notes the hand-off (late `auto` gates under `/bdk:run`); verify both sections name this Change

## 2. Contract: specs, index and catalogue

- [ ] 2.1 Sync this Change's deltas into the main specs so the contract tests read the amended text; update `schema/cli/commands.json` (`hooks prompt-expansion`: `changeScoped: false` and the Change rules; `hooks session-end`: no refusals; `hooks pre-tool`: the three new rules) and the rule list in `shared/refusal`; verify `pnpm test:contract` passes

## 3. Registry: guard block output

- [ ] 3.1 Write failing tests in `shared/registry/tests/`: a guard block writes `<rule>: <why>` on stderr; a registration's `blockOutput` goes to stdout without `--json` and is replaced by the error object with `--json`
- [ ] 3.2 Implement `blockOutput` and the stderr prefix in `shared/registry/run.ts`; verify 3.1 and the existing registry tests pass

## 4. Command reader and pre-tool guards

- [ ] 4.1 Write failing unit tests in `hooks/tests/shell.test.ts`: quotes, escapes, comments, heredocs (quoted and `<<-`), separators, grouping, `$(...)` kept in a word, `sh -c` / `bash -c` / `eval` recursion with the depth limit, assignments and wrappers before the command word, redirections with fd numbers and duplications
- [ ] 4.2 Implement `hooks/domain/shell.ts`; verify 4.1 passes
- [ ] 4.3 Write failing unit tests in `hooks/tests/pre-tool.test.ts`, one group per guard of `kernel-cli/hooks`, Pre-tool guards, with the recorded payload shapes: every denied git form and the allowed ones, global options, quoted verbs; kernel verbs by class from the real index; `bdk.mjs hooks` in both threads; nested `claude` stage commands; spec paths for the three edit tools and Bash writes, reading passes; every write form for the three read-only adapters and the allowed test and kernel commands; dispatch prompts (path plus one sentence passes, extra sentences, a blank line, no path, two paths, a long sentence, a v2 agent); a payload that is not JSON or lacks `tool_input` is `input/invalid-argument`
- [ ] 4.4 Implement `hooks/domain/payload.ts`, `hooks/domain/guards.ts`, `use-cases/pre-tool.ts`, the command, render and zod schema; add the command index to `HooksDeps`; register the handler with `blockOutput`; verify 4.3 passes

## 5. Transitions and prompt-expansion

- [ ] 5.1 Write a failing test in `log/tests/` that `appendEntry` writes `gate`, `session`, `command`, `skip-verify` and a kernel-only `source` of `user` or `policy` on a `transition`, and that `log add` still cannot produce any of them
- [ ] 5.2 Extend `EntryDraft` and `appendEntry`; verify 5.1 and the existing log tests pass
- [ ] 5.3 Write failing unit tests in `hooks/tests/prompt-expansion.test.ts` on repository fixtures, one per row of Prompt-expansion outcomes: gate ready writes `source: user` with the fields and refs and the gate becomes done; not ready blocks naming the missing requirement and writes nothing; done passes without writing; `tiny` `/bdk:plan` writes a plain transition; `/bdk:execute --skip-verify` writes `skip-verify: true` once; `/bdk:run` with an `auto` gate writes `source: policy`, with a manual gate writes nothing; no active Change blocks; a non-stage command passes without a Change; missing `expansion_type`, `session_id` or `command_name` blocks with `input/invalid-argument`; `command_input` read when `command_args` is absent
- [ ] 5.4 Implement `use-cases/prompt-expansion.ts` with its command, render and zod schema over `graph`'s `readGraph` and `log`'s `appendEntry`; export what it needs from `graph/index.ts`; resolve the Change through the resolver `main.ts` binds; verify 5.3 passes

## 6. Session end and takeover

- [ ] 6.1 Write failing tests: `hooks session-end` commits a checkpoint and prints the line, reports `open tickets`, a rebase in progress, `no active Change` and a disabled policy as `skipped` with exit 0 and no STOP block; `change takeover` reports `previousSession` from the latest transition with a `session` before the oldest open ticket, and omits it without one
- [ ] 6.2 Implement `use-cases/session-end.ts` over `checkpointChange`, its command, render and zod schema; implement `previousSession` in `change/use-cases/takeover.ts`; verify 6.1 and the existing change tests pass

## 7. Hooks file and guard scripts

- [ ] 7.1 Extend `kernel/tests/contract/hooks-file.test.ts` (failing first): `hooks/hooks.json` holds exactly the four entries of `kernel-cli/hooks`, Guard hooks file and prefilter; each guard script's kernel line matches `guard-wrapper`; `pre-tool.sh` exits 0 without Node for the main-thread `git status` payload; both scripts exit 2 with `guard/kernel-unavailable` without the bundle; the prefilter hands every payload of the pre-tool unit fixtures that the kernel denies to the kernel (no false negative)
- [ ] 7.2 Write `hooks/guard/pre-tool.sh`, `hooks/guard/prompt-expansion.sh` and the new `hooks/hooks.json`; verify 7.1 passes

## 8. Documentation

- [ ] 8.1 Run `/docs-sync` for the guards, the gates and the session-end checkpoint (`docs/guide/`), and document the known gaps (the user's `!` commands, interpreters); verify `pnpm docs:build` passes

## 9. Acceptance

- [ ] 9.1 Write `hooks/tests/guards.e2e.ts` through the bundle and the guard scripts on repository fixtures, driven by the recorded T01 payloads, one case per item of the T24 acceptance signal: typed command -> `source: user` entry and the gate done; payload without the user marker -> no entry; `/bdk:plan` before the design is ready -> blocked with the reason, no entry; subagent `git stash` denied while the main thread passes; subagent `bdk.mjs commit` denied; kernel removed: subagent `git commit` exits 2, main-thread `bdk.mjs hooks` exits 2, main-thread `git status` passes without starting Node; `Edit` under `.bdk/specs/` denied; verify it passes
- [ ] 9.2 Write `hooks/tests/guards.perf.ts`: 750 payloads, p95 of the dropped prefilter < 5 ms, of a kernel-reaching `pre-tool` < 150 ms, of a writing `prompt-expansion` < 150 ms; verify `pnpm test:perf` passes locally
- [ ] 9.3 Run `pnpm build` then `git diff --exit-code dist/ schema/`; `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`; `pnpm test:unit` (coverage thresholds), `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `pnpm docs:build`; verify all pass
- [ ] 9.4 Run `openspec validate v3-t24-guard-hooks-gates --strict`; verify it is valid
