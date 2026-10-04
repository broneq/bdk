# Tasks

## 1. Plan part fields and checks

- [x] 1.0 Set the #107 card on the board to In progress
- [x] 1.1 Failing tests (`kernel/src/shared/store/tests/`, `kernel/src/part/tests/`): a part without `isolation` parses as `shared`; `isolation: worktree` with `isolation-reason` parses; `isolation: sandbox` fails naming `isolation`; check `isolation` fails for `worktree` without a reason (`validate`, `part start` with `policy/validation-failed`); a placeholder in `isolation-reason` fails check `placeholder`
- [x] 1.2 Plan part schema and `isolation` check in the `plan-part` kind; `pnpm build` regenerates the state schema; tests of 1.1 green

## 2. Settings module `execution.worktree`

- [x] 2.1 Failing tests (`kernel/src/graph/tests/`, contract test of `kernel-settings`): defaults `{enabled: true, dir: .bdk/.machine/worktrees, setup: {timeout: 300}, max-live: 3}`; `setup.timeout: 900` and `max-live: 0` are `policy/config-invalid`; the spec table and the registry agree
- [x] 2.2 Register the module (consumer `graph`, exported through `graph/index.ts`); tests of 2.1 green

## 3. Worktree core in `shared/` (D2-D5, D10)

- [x] 3.1 Probe in a scratch repository with the built bundle and git 2.54: `git worktree add -b` from `HEAD`, a marker in `$(git rev-parse --git-dir)/bdk-home`, `git merge-tree --write-tree` on a clean and on a conflicting pair (record the exit codes and output format), `git commit-tree -p -p`, `git merge --ff-only` with a dirty unrelated path and with a dirty merged path; record what each prints so the failing tests of 3.2 start from observed output
- [x] 3.2 Failing unit tests (`kernel/src/shared/git/tests/`): worktree add, remove, list with markers; merge-tree result parsing (clean tree id, conflicting paths); merge commit with trailers; ff-only refusal parsing (paths); git version check against 2.38
- [x] 3.3 Implement the git operations in `shared/git`; tests of 3.2 green
- [x] 3.4 Failing tests (`kernel/src/shared/store/tests/`): `findProjectRoot` inside a worktree with `bdk-home` returns the home root and the marker's Change; a marker naming a removed home answers `state/worktree-orphaned`; the work root resolver returns the worktree for a task of a live worktree part and the home checkout for a shared part, a done part and a part whose worktree directory is gone
- [x] 3.5 Implement home resolution and the work root resolver in `shared/store`; tests of 3.4 green; the dependency matrix tests stay green with no new slice edge

## 4. `part start` and `part done` (`kernel-cli/part`)

- [x] 4.1 Failing E2E tests (`kernel/src/part/tests/part.e2e.ts`) through `dist/bdk.mjs` in a fixture repository: worktree from home `HEAD` on `bdk-part/<id>/<nn>` with the marker; `.worktreeinclude` copy of an ignored `.env` only; setup run and recorded in the start marker; failing setup refuses `runtime/worktree-setup-failed` and leaves no worktree, branch or entry; timeout refuses; `dir` not ignored refuses `policy/config-invalid`; `enabled: false` starts in the home checkout with `downgraded: true`; a leftover worktree at the path from a killed start is replaced
- [x] 4.2 Implement `part start` worktree creation; output schema gains `isolation`, `workdir`, `setup`, `downgraded`; tests of 4.1 green
- [x] 4.3 Failing E2E tests: merge back with a shared part committed meanwhile (merge commit trailers, original SHAs reachable, worktree and branch gone, checkpoint run); `policy/merge-conflict` leaves home and worktree unchanged and names `bdk attempt open verify-fix <part>` in `instead`; `policy/merge-blocked` on a dirty home path; `policy/worktree-dirty`; leftovers in `discarded` and one kernel `finding`; `part done` of a shared part unchanged
- [x] 4.4 Implement the merge back under the commit lock; output schema gains `merge` and `discarded`; rule catalogue rows and `schema/cli/commands.json` regenerated; tests of 4.3 green

## 4b. Merge ticket (`kernel-cli/attempt`, D6)

- [x] 4b.1 Failing E2E tests: `attempt open verify-fix 02` after a conflicting `part done` runs `git merge --no-commit` in the worktree only, stamps `merge: true` and `conflicts`, and lists the code-loop `steps`; a second ticket of the round keeps the merge in progress; the diff check of a merge ticket ignores paths equal to the Change branch and counts `conflicts` as declared (a merged-in path under the part's `do-not-touch` does not refuse); `attempt close ok` refuses `policy/merge-unresolved` on an unmerged path and on a marker line; a resolved close with `pass` steps commits a part merge commit on the part branch and answers `next.action: part-done`; the next `part done` exits 0; an exhausted round parks with a question naming the worktree, the paths and `git merge --abort`
- [x] 4b.2 Implement the merge ticket in `attempt open` and `attempt close`, the record fields, the diff check rule; output schemas and rule catalogue regenerated; tests of 4b.1 green
- [x] 4b.3 Failing tests (`kernel/src/config/tests/`, `kernel/src/dispatch/tests/`): prompt key `fragments/merge-conflicts` is registered with its plugin default; a project file extends it; the package of a merge ticket holds a `Conflict` section with the paths, the Change branch and the resolved instruction; the default text names lockfile regeneration and at least the lockfiles of npm, pnpm, yarn, Cargo, Poetry, uv, Go, Bundler and Composer
- [x] 4b.4 Write `fragments/merge-conflicts.md` (language-agnostic, per `.claude/rules/prompt-writing.md`), register the key, add the `Conflict` section to the package template; tests of 4b.3 green

## 5. Work root in commit, diff check, progress, evidence

- [x] 5.1 Failing tests: `bdk commit 02-1` of a live worktree part commits on the part branch, stages no `.bdk/` path, records an undeclared lockfile as a finding and leaves the home tree unchanged; `attempt close` runs the diff check in the worktree; `part list` counts a task committed only on the part branch; `rebuild` accepts a part merge commit and still refuses a `BDK-Change` commit without the other trailers that is not one; `evidence record` and `evidence check` of a worktree task hash the worktree's files; a manifest recorded in the worktree is fresh after a merge that changed none of its covered files and stale after one that changed a covered build-config file
- [x] 5.2 Route `commit`, `diffCheck`, `taskProgress`, the trailer rule and the tree hash through the work root resolver; tests of 5.1 green

## 6. `bdk next` wave (`kernel-cli/graph`)

- [x] 6.1 Failing unit tests (`kernel/src/graph/tests/`, pure `executeWave`): items carry `isolation` and, for a live worktree part, `workdir`; with `enabled: false` a not-started worktree part is listed only alone and nothing joins it while it runs; at `max-live` a not-started worktree part waits; the `Files:` overlap rule still applies first
- [x] 6.2 Extend `executeWave` and the `next` output schema; tests of 6.1 green

## 7. Dispatch package and guard

- [x] 7.1 Failing tests (`kernel/src/dispatch/tests/`, `kernel/src/hooks/tests/` with recorded payloads): a package of a worktree task or part has `workdir` and a `Work root` section, a shared one has neither; a relative `workdir` fails package validation; `guard/worktree-scope` denies a worker's `Edit` outside `workdir` and passes one inside, passes the main thread and a package without `workdir`; guard latency budget still met (`pnpm test:perf` locally)
- [x] 7.2 Implement the package section, the frontmatter field and the guard; tests of 7.1 green

## 8. `rebuild` recovery (`kernel-cli/service`)

- [x] 8.1 Failing E2E tests: a merged part's leftover worktree is removed; a live worktree is kept; a deleted live worktree is recreated from its branch with the include copy and setup; an unmerged branch of a done part is kept and warned; a user worktree without the marker is untouched; `worktrees` in the output
- [x] 8.2 Implement the reconciliation; output schema regenerated; tests of 8.1 green

## 9. Skills, rules and contracts

- [x] 9.1 Failing content tests (`kernel/tests/contract/`): `rules/plan/BDK-PL-4.md` exists with `kind: house` and the `plan` instruction lists it; `rules/code-quality/BDK-CQ-9.md` exists with `kind: house` and its `applies` lockfile globs, the measurement check exempts it, and `bdk rules show --ticket` of a merge ticket whose `conflicts` hold `pnpm-lock.yaml` lists it while a ticket without a lockfile does not; `skills/stages/plan/SKILL.md` names `isolation` and `isolation-reason`; `skills/roles/verifier/SKILL.md` names the isolation check and `integration-failure`; the `implementer`, `simplifier`, `runner`, `scout` and `lead` bodies name the `Work root` section and stay within 4 096 bytes; the `implementer` body names the `Conflict` section; `skills/stages/execute/SKILL.md` names `policy/merge-conflict` with `attempt open verify-fix`, `policy/merge-blocked`, `runtime/worktree-setup-failed` and starts shared parts before worktree parts; `skills/swarm/references/hosts/claude-code.md` names the missing working-directory parameter and that BDK does not use `isolation: worktree`
- [x] 9.2 Write `BDK-PL-4`, `BDK-CQ-9` (`kind: house`, `applies` with the lockfile globs of npm, pnpm, yarn, bun, Cargo, Poetry, uv, Pipenv, Go, Bundler, Composer, Mix, pub, SwiftPM and NuGet), the `plan-part` instruction template, and the skill and contract text per `.claude/rules/prompt-writing.md`; review with `/bdk-skill-kit:skill-authoring`; tests of 9.1 green; `pnpm skill-check` green

## 10. Evals and documentation

- [x] 10.1 Failing harness tests (`evals/suites/stages/`): seed `shared-lockfile` leaves `next` with a wave of two disjoint parts that add different dependencies and so both regenerate the fixture's lockfile, part 02 `isolation: worktree`; a variant with both `shared` for the `verify-plan` case; `pnpm eval check` accepts the new cases
- [x] 10.2 Seed, `execute.yaml` case `worktree`, `verify-plan.yaml` case `isolation`; tests of 10.1 green
- [x] 10.3 User docs: `execution.worktree`, `.worktreeinclude`, `isolation` in the plan reference, the merge ticket and `fragments/merge-conflicts` (how a project adds its regeneration commands), the merge refusals, the crawl risk of the default `dir` (`/docs-sync`); `pnpm docs:build` green
- [x] 10.4 After the user approves the cost: `pnpm eval stages --skill execute --probe` and `pnpm eval stages --skill verify-plan --probe` for the new cases; fix what fails, each fix with its test first; record the outcome in `evals/results/stages/` and the PR

## 11. Acceptance

- [x] 11.1 Acceptance signal end to end: `/bdk:plan` puts `isolation: worktree` on at least one part of the `shared-lockfile` shape; `/bdk:execute` runs both parts in parallel, the commits of both land on the Change branch with their trailers after `part done`, the lockfile conflict is settled by one merge ticket under `fragments/merge-conflicts` and the lockfile is regenerated, the ledger holds the entries of both, `git worktree list` shows no kernel worktree, and no agent resolved a conflict outside a merge ticket; the `shared` variant is flagged by `/bdk:verify-plan`; the `execute` probe passes (10.4)
- [x] 11.2 Full gate: `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `pnpm docs:build`, `pnpm eval check`
- [x] 11.3 `openspec validate v3-t45-worktree-isolation --strict` and `openspec validate --specs --strict`
