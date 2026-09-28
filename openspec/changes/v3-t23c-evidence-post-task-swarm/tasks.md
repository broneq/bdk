# Tasks

## 1. Contract and plan

- [x] 1.1 Update `schema/cli/commands.json` for the deltas: `evidence check <target|evidence-id>`, `log list --since-ticket-start`, `input/not-found` on `log list`, `dispatch build` roles with `simplifier` and writes `attempts/`, `attempt close` writes `evidence/` and `policy/missing-evidence`, owners and summaries; add `policy/missing-evidence` to `kernel/src/shared/refusal/index.ts`; update the hand-written output schemas `evidence-record` and `evidence-check` (examples with eight-character ids); move `archive.keep-evidence` to owner T30 and `execution.concurrency` to consumer `ctx` in the planned-keys list; verify `pnpm test:contract` fails only on the missing implementations, then passes the index and schema checks
- [x] 1.2 Sync the main specs from the deltas (`kernel-cli`, `kernel-cli/{evidence,attempt,dispatch,log,rules,ctx}`, `kernel-loops`, `kernel-pipeline`, `kernel-settings`, `kernel-state`, `role-contracts`, `kernel-architecture`); verify `openspec validate --specs --strict` and the `pnpm test:contract` spec checks pass
- [x] 1.3 Record T23-D39 to D55 in the T23 entry of `docs/V3-IMPLEMENTATION-PLAN.md` (Scope C wording: three step kinds done from evidence, steps under the task ticket, `simplifier`, `archive.keep-evidence` owner T30, `execution.concurrency` consumer `ctx`) and fix "Part B adds T23-D25 to D36" to D38; verify by reading the section against design.md

## 2. State and settings

- [x] 2.1 Write failing unit tests for the state changes: manifest `tree` field, attempt record `package` field, `pruned` document kind and its layout paths (`dispatch/pruned.md`, `reports/pruned.md`), capture path `evidence/<target>-<evidenceId>-<name>`; implement in `kernel/src/shared/store/state/` and `registry.ts`; verify unit tests and the state schema contract test pass after `pnpm build`
- [x] 2.2 Write failing tests for append-only arrays in the layer merge (`append-only array` scenario, defaults kept, duplicates dropped); implement the merge flag in `shared/config`; verify unit tests and the existing merge scenarios pass
- [x] 2.3 Write failing tests for the `policy.evidence` module (`evidence defaults`, `project appends a glob`) and the `execution` module under consumer `ctx` (`concurrency default`, out of range); register both; verify `bdk config show` E2E, the settings contract test and the S6 consumer test pass once their readers land in 3.x and 6.1
- [x] 2.4 Write failing unit tests for the `shared/store` ticket queries: the active package of a ticket, the `package` stamp written once per `dispatch build`, and the manifests of a ticket and of a part; implement; verify unit tests and the rebuild test (index recreated from files) pass

## 3. `evidence` slice

- [x] 3.1 Write failing unit tests for the file-class filter and the tree hash (non-executable dropped, build-config wins and is found outside `Files:`, scope task / part / Change, deleted file as `absent`, path order, `tree` entries); verify they fail for the missing module
- [x] 3.2 Implement `kernel/src/evidence/` domain and config (filter, tree hash, `policy.evidence`); verify 3.1 passes
- [x] 3.3 Write failing unit tests for the citation validator (the three forms, file part omitted with one file, bare `/pointer`, file by name, `=text` substring, binary not citable, missing line, JSON that does not parse); implement; verify they pass
- [x] 3.4 Write failing unit and E2E tests for `evidence record` (every scenario of the delta: example, not-found, no open ticket, missing citation, pass without citations, each citation form, committed versus machine storage and `git status`, binary not citable, project kind, dedupe, `source` from the active package); implement the command and register the slice; verify `pnpm build && pnpm test:e2e` passes them
- [x] 3.5 Write failing unit and E2E tests for `evidence check` (every scenario of the delta: example, not-found, stale in text mode exit 2, manifest older than the tree hash with `changedSince`, non-executable change keeps fresh, build config change stale, target without evidence, part and Change targets, `E-` id); implement; verify they pass

## 4. Graph: step kinds and nodes

- [x] 4.1 Write failing engine tests: step instances pair by part, other collections stay whole, evidence-derived `done` and `stale`, `next` returns a stale step, `bdk done` on a step refused naming its command, the fake `contract-snapshot` kind on the step base (T23-D51), and `plan-verify` stale after a plan part edit; verify they fail
- [x] 4.2 Implement the `post-task-step` base with `simplify`, `tests-scoped`, `lint` (done through evidence, inputs from the part tree hash through `evidence`'s `index.ts`), instance pairing in the engine, verdict kinds checking the `evidence` ids of their report (`policy/missing-citation`), `pipeline/simplify.md`, `tests-scoped.md`, `lint.md` replacing `post-task-step.md`, and the three nodes in `pipeline/pipeline.yaml` after `execute` with `review` requiring them; verify 4.1 passes, the shipped pipeline content test, the kind registry scenario (fifteen kinds) and the import scan (`graph -> evidence`) pass
- [x] 4.3 Write E2E tests for the node scenarios of the `kernel-pipeline` delta (latest fresh evidence, done refused, pairing, steps follow execute in `change status`, stale step evidence, verdict for an older part hash); verify `pnpm build && pnpm test:e2e` passes them

## 5. Dispatch, rules, log

- [x] 5.1 Write failing tests for package retention per role and ticket, the `package` stamp, `dispatch show <ticket>` printing the active package, and the `simplifier` role in the role-to-adapter map and the rules role map; implement; verify unit and E2E pass and the export check still produces five adapters
- [x] 5.2 Write failing tests for the runner `Checks` section (tools with `related` / `scoped` / `command`, `{files}` from executable files only, `when` texts, record lines, kind without a command, step order from the graph); implement with `dispatch -> ctx`; verify unit and E2E pass, the package stays within 12 288 bytes on the fixture and the import scan accepts the edge
- [x] 5.3 Write failing tests for role resolution through the active package in `rules show --ticket` (simplifier read does not stamp), `log add --ticket` (P8 by the active role) and `log ingest --ticket` (each role of a ticket keeps its report); implement; verify unit and E2E pass
- [x] 5.4 Write failing tests for `log list --since-ticket-start` (entries since a ticket started, closed ticket, unknown ticket `input/not-found`, combined with `--type`); implement; verify unit and E2E pass

## 6. `attempt` open and close

- [x] 6.1 Write failing tests for `attempt open` `steps` (pipeline order and roles for code loops, none for `verifier`); implement with `attempt -> graph`; verify unit and E2E pass
- [x] 6.2 Write failing tests for the `attempt close ok` evidence checks: simplify manifest recorded from the simplifier report (done and blocked), missing and failing step (`policy/missing-evidence`), stale step (`policy/stale-evidence`), pass without citation or with a changed committed file (`policy/missing-citation`), `not-run` within and past `policy.budgets.not-run`, verifier ticket unchecked, refusal leaves the ticket open; implement; verify unit and E2E pass
- [x] 6.3 Change `nextRung` so `ok` gives `commit` and update the `attempt-close` output schema; write the `ok gives commit` and `failing tests walk the ladder` tests first; verify unit and E2E pass and no code or schema names `post-task-steps`

## 7. Prune

- [ ] 7.1 Write failing unit tests for the prune function (index written with hashes and sizes, bodies removed, idempotent, pruned Change reads clean, manifest file hashes still found in the index); implement in `shared/store`; verify they pass and `pnpm knip` accepts the export

## 8. Content: roles, swarm, docs

- [ ] 8.1 Write `skills/roles/simplifier/SKILL.md` (worker adapter, simplify without behaviour change within `Files:`, working-tree sentence, ingest output) and extend the runner contract with `evidence record`, citations for `pass` and `not-run` with the reason; extend `kernel/tests/contract/role-contracts.test.ts` (eight roles, simplifier and runner scenarios, git sentence in both worker roles); verify the content test, `pnpm skill-check`, the 4 096-byte budget and `bdk export agents --check` pass
- [ ] 8.2 Add the `concurrency` ctx part and the `swarm` manifest entry; write `skills/swarm/SKILL.md` with its context lines and `references/hosts/claude-code.md`; add a content test for the `swarm skill shape` and `single resume wording` scenarios; verify the skill context contract test, the new content test and `pnpm skill-check` pass
- [ ] 8.3 Write the swarm eval in `tests/evals/skills/swarm/` per `.claude/rules/skill-test-eval.md` (a two-wave plan with overlapping `Files:`, a missing report, a critical `SendMessage`); verify the eval file validates in the eval format check
- [ ] 8.4 Update `README.md` (Skills row for `swarm`, the `simplifier` role, `evidence record` and `check` rows, `log list --since-ticket-start`, `policy.evidence` and `execution.concurrency` in the settings paragraph) and `.claude/rules/verification-scoping.md` (the kernel's `policy.evidence` lists as a copy of the partition); verify `pnpm docs:build` and the drift guards in `pnpm test:contract` pass

## 9. Acceptance

- [ ] 9.1 Run the part C acceptance end to end in `kernel/src/evidence/tests/acceptance.e2e.ts`: one task ticket through implementer, simplifier and runner packages, `evidence record` for `tests-scoped` and `lint`, a refused close on stale evidence, a refused `pass` without citations, the successful close with `next.action: commit`, a non-executable edit keeping the evidence fresh, `tests-scoped:01` done, `plan-verify` stale after a plan part edit, and the fake kind with manifest, `not-run` and citations; verify every output validates against its schema
- [ ] 9.2 Live check on Claude Code: in a fixture project, fork `bdk:runner` on a runner package and confirm it runs the `Checks` commands, records both kinds with citations and stores its report; record the result in the PR description
- [ ] 9.3 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm skill-check`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm test:perf`, `pytest tests/unit/`, `pnpm docs:build` and `openspec validate v3-t23c-evidence-post-task-swarm --strict`; verify all pass
