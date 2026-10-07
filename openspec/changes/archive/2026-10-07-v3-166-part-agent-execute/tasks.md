# Tasks

## 1. Stdin never hangs

- [x] 1.1 Write the failing E2E of the issue's hang: `bdk log ingest --ticket <t>` without `--file`, run from a shell whose stdin never closes, must exit 3 with `input/missing-argument` within 2 s; `--file` naming a missing path exits 3 with `input/not-found`; `--file` with a valid report stores it. Verify the first fails on the current bundle by hanging (perl alarm).
- [x] 1.2 Write failing E2E tests for `log add --body -`, `rules accept -`, `review render --pr -` and `diagnostics write`: a TTY or a pipe that delivers no byte within 3 s refuses with `input/stdin-unavailable`; a pipe with data works as before. Verify they fail.
- [x] 1.3 Implement `--file` for `log ingest` (no stdin read), the bounded stdin reader in `shared/store` and `input/stdin-unavailable` in the vocabulary, the index `stdin` fields and the output schema; verify 1.1 and 1.2 pass and the hooks commands still read stdin as before.

## 2. Settings, pipeline and state

- [x] 2.1 Write failing tests for the settings: `execution.tree.*`, `policy.budgets.task-redispatch` and `policy.budgets.part-lead` are unknown keys; `policy.budgets.part` (3), `execution.checks.timeout` (300, 10..540), `plan.part.max-tasks` (5, 1..8), `plan.part.max-files` (10, 1..30) and the default category `costly-command` resolve. Implement them in the registry and `schema/settings.json`; verify the tests and the settings-spec contract pass.
- [x] 2.2 Rename the step and evidence kind `simplify` to `conform` in `pipeline/pipeline.yaml`, the vocabulary and the state schemas; record `tests-scoped` and `lint` as kernel evidence; replace the loops `task-redispatch` and `part-lead` by `part` in the attempt record with the `base` field; add `draft` to the dispatch package. Verify the unit and contract tests pass after updating their fixtures.
- [x] 2.3 Add the `files` plan part check (`policy/part-too-many-files`) and make the `tasks` check read `plan.part.max-tasks`; test both limits and their boundaries first.

## 3. The `part` loop and git progress

- [x] 3.1 Write failing E2E tests of `attempt open part <part>` (stamps `base`, refuses a task target and the removed loops), `attempt close` of a `part` ticket (`policy/tasks-uncommitted` naming the task, `part-done` on success, the conform manifest from the conformer report, the diff check over the work tree and the `BDK-Part` commits of `base..HEAD`), and the ladder per part. Implement them; verify they pass.
- [x] 3.2 Write failing tests for progress from git: a commit with `BDK-Part` and the `BDK-Ticket` of a part or verify-fix ticket counts as part work and commits no task. Implement; verify they pass.
- [x] 3.3 Remove `bdk commit <task>` (a task id is `input/invalid-argument` naming `bdk check run`); keep `bdk commit <change-id>` and the lock for it and the merge back of `part done`; make `part done` write the checkpoint. Test first; verify.

## 4. `bdk check run`

- [x] 4.1 Write the failing E2E tests of every scenario of `kernel-cli/check` (example, refusals, failing test with tail, stdin closed, timeout with the process group killed, no executable file, exit 127, `--skip`, outputs per ticket, part commit command, nothing to commit, evidence closes the ticket). Verify they fail for the missing command.
- [x] 4.2 Implement the `check` slice, its index entry (Owner T22, availability agent), the output schema `schema/cli/output/check-run.json` and the architecture tables; verify 4.1 and the contract tests pass.
- [x] 4.3 Write failing tests for `evidence record` refusing an agent file outside `.bdk/.machine/checks/<ticket>/` (`policy/evidence-outside-ticket`); implement; verify.

## 5. Packages, wave and guards

- [x] 5.1 Write failing tests for `dispatch build`: a part target embeds the whole part file with its preamble, the `Tasks` and `Checks` sections, the `draft` path; the conformer package adds `Range` and `Project instructions`; task targets, `lead` and an ungrouped `runner` are refused. Implement; verify they pass and the 163 840-byte limit holds.
- [x] 5.2 Write failing tests for `bdk next`: the wave item has no `mode` and lists the open `part` and `verify-fix` tickets. Implement; verify.
- [x] 5.3 Write failing E2E tests for the guards: a `bdk:worker` may run `git add -- <paths>` and the printed `git commit`, and every denied flag and pathspec is refused; the lead verbs and `guard/lead-scope` are gone; `guard/draft-only` allows a read-only adapter's Write only under `.bdk/.machine/drafts/`; `check run` is an agent verb. Implement in `hooks/domain/guards.ts`; verify.
- [x] 5.4 Remove the lead adapter and add the `draft` tool class (`Write`) to the read-only adapters and the runner in `kernel/src/export/`; run `pnpm build` to regenerate `agents/`; verify the adapter content tests pass and `agents/lead.md` is gone.

## 6. Skills and documentation

- [x] 6.1 Delete `skills/roles/lead`, rename `skills/roles/simplifier` to `conformer` with the conform contract, rewrite `implementer` as the part agent, narrow `runner` to the review gate, and change every role's output to `log ingest --file` with the draft path; update the content tests first and verify they pass.
- [x] 6.2 Rewrite `skills/stages/execute` and `skills/swarm` for one ticket and two agents per part; update `skills/stages/plan` and `verify-plan` (part limits, exact acceptance commands, `costly-command`), `skills/roles/verifier` and `skills/tools/cr` (`--file`); update the manifest parts that deliver the part limits. Verify `pnpm skill-check` and the content tests pass.
- [x] 6.3 Update `docs/guide/` (execute, roles, agents, configuration, CLI reference) and the eval cases (`execute-ab`, `stages/cases/execute.yaml`, `seeds.ts`, `review-models` hooks test); verify `pnpm eval check`, `pnpm docs:build` and the drift guards pass.

## 7. Acceptance

- [x] 7.1 Run all gates: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm build && pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `openspec validate v3-166-part-agent-execute --strict`.
- [x] 7.2 Re-run the hang reproduction of #166 against the built bundle (`sleep 30 | perl -e 'alarm 8; exec @ARGV' sh -c 'cat r.md | bdk log ingest --ticket <t>'`) and verify it exits at once with `input/missing-argument`.
- [x] 7.3 Run one scripted part end to end on a fixture project: `attempt open part`, three tasks each through `check run` and the printed commit, `check run <part>`, `attempt close ok`, `part done`; verify at most 2 agents would be dispatched, no two tickets share a check file, and the conformance findings carry rule ids.
- [x] 7.4 Report the execute wall time and main-thread turns of a benchmark run against the B1 baseline (47 min, 1 037 turns), or state that the benchmark could not run here and why.
