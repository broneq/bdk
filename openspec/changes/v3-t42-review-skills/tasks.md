# Tasks

## 1. Probe

- [x] 1.1 Probe in a scratch repository with the built bundle and record the outputs in this task:
  - a fix after a failed round, committed with `git commit` as `round.e2e.ts` does, then `bdk rebuild`; record whether a commit with only `BDK-Change` raises `state/trailer-mismatch`;
  - `dispatch build <change> implementer <ticket>` on a `review-fix` ticket with one finding triaged `blocker`; record whether the finding is embedded;
  - `change new --inferred` on a branch with commits, then `attempt open review-fix`; record the refusal;
  - `rules show` without a ticket.

  The failing tests of groups 2-5 start from these observed outputs.

  Probe 2026-10-03, bundle 2.7.0, through a throwaway E2E on `executed(started())`:
  - a group `reviewer` package with one `--file` is 6 202 bytes;
  - `log triage <finding> blocker` answers `level: blocker`, `status: proposed`;
  - the round-2 `implementer` package (5 369 bytes, target the Change) does NOT embed the finding triaged `blocker`;
  - a `git commit` carrying only `BDK-Change` makes `bdk rebuild` exit 4 with `state/trailer-mismatch` ("carries BDK-Change ... without BDK-Part and BDK-Task");
  - `bdk commit <change-id>` exits 3 with `input/not-found` ("no plan part holds task <change-id>");
  - `bdk rules show` without `<id>` or `--ticket` exits 3 with `input/missing-argument`;
  - `change new --inferred` on a branch with commits opens `kind: feature`, `profile: small`, `next: /bdk:design`, so `attempt open review-fix` waits on design, plan and execute.

## 2. Review Change kind (design D3)

- [x] 2.1 Write failing tests in `kernel/src/change/tests/` and as E2E:
  - `change new --kind review --inferred` stamps `kind: review` and `base` equal to `git merge-base HEAD origin/HEAD`, and `next` is `/bdk:cr`;
  - `--base main` uses `main`;
  - `--base` with no `--kind review` is `input/invalid-argument`;
  - an unknown ref is `input/not-found` and writes nothing;
  - `HEAD` equal to the base is `policy/empty-range` and writes nothing;
  - a `feature` Change has no `base`.
- [x] 2.2 Write failing tests in `kernel/src/graph/tests/` and `kernel/src/review/tests/`:
  - a `review` Change lists `intent`, `tests-full`, `lint-full`, `review`, `gate:review` and `close` only;
  - `bdk next` names `/bdk:cr`;
  - `attempt open review-fix` is admitted with no `steps`;
  - `review plan` anchors `full` at the stamped `base` after `change.md` is committed, and groups by module.
- [x] 2.3 Implement:
  - the `kind` enum and `base` in the state schema;
  - `change new --kind review --base`, using `resolveCommit` and `mergeBase`;
  - `changeBase` reading `base`;
  - `kinds: [feature, bug]` on the design, plan, execute, step and `spec-delta` nodes of `pipeline/pipeline.yaml`;
  - `policy/empty-range` in the rule catalogue and the `change-new` command record;
  - run `pnpm build` to regenerate `schema/`.

  Verify that the tests of 2.1 and 2.2 and `pnpm test:contract` are green.

## 3. Review fix commit (design D3)

- [x] 3.1 Write failing tests in `kernel/src/commit/tests/`, `kernel/src/attempt/tests/` and E2E:
  - `bdk commit <change-id>` with an open `review-fix` ticket commits the touched paths and the Change directory, with trailers `BDK-Change` and `BDK-Ticket`;
  - the ticket stays open, and the output names `ticket`;
  - a fully staged user path stays staged;
  - with no open `review-fix` ticket the command is `policy/no-open-ticket`;
  - a `do-not-touch` path is refused;
  - `attempt close` and `commit` of the Change target report no `diff.undeclared` and write no `finding`;
  - `bdk rebuild` after such a commit raises no `state/trailer-mismatch`.
- [x] 3.2 Implement:
  - the Change-target branch of `commit`;
  - the Change-target diff check without the undeclared report;
  - trailer reading that accepts `BDK-Ticket` of a `review-fix` ticket;
  - the `commit` record's refusals and the output schema (`task` or `ticket`).

  Verify that the tests of 3.1 are green and that `kernel/src/review/tests/round.e2e.ts` uses `bdk commit <change-id>` in place of `git commit`.

## 4. Fix package and stateless rules (design D3)

- [ ] 4.1 Write failing tests in `kernel/src/dispatch/tests/` and `kernel/src/graph/tests/`:
  - an `implementer` package on a `review-fix` ticket embeds a finding triaged `blocker` and a live `blocker` in full, and not a `nice-to-have`;
  - its `rules` follow those entries' file refs;
  - the shared blocking predicate gives the same set as the `review` verdict's `blockers` check on the same ledger.
- [ ] 4.2 Write failing tests in `kernel/src/rules/tests/`:
  - `rules show --role pr-reviewer --file src/api/login.ts` with no Change prints `API-1` with its text and not `UI-1`, and equals `rules explain` ids;
  - `--role` without `--file`, `--file` without `--role`, and either with `--ticket` are `input/invalid-argument`;
  - an unknown role is `input/not-found`.
- [ ] 4.3 Implement:
  - move the blocking predicate to `shared/`, used by `graph` verdicts and `dispatch build`;
  - the review-fix entry selection;
  - `rules show --role --file`;
  - command records and output schema.

  Verify that the tests of 4.1 and 4.2 are green and `structure.test.ts` passes the import matrix.

## 5. Context part for the P8 lists (design D8)

- [ ] 5.1 Write failing tests in `kernel/src/ctx/tests/`:
  - `ctx skill plan`, `design` and `cr` render `### Blocking categories (P8)` with the resolved categories and `#### Not a fail`;
  - a project category added in settings appears;
  - `ctx skill bdk-rules-security` is a STOP block with `input/not-found`.
- [ ] 5.2 Implement:
  - the `verifier-policy` part kind;
  - manifest entries: `design` and `plan` gain the part; `cr` is `[verifier-policy]`; `pr-review` is the comment templates `file` part under `skills/tools/pr-review/references/`; the eight `bdk-*` entries are removed;
  - update the `ctx-skill-output` snapshot.

  Verify that the tests of 5.1 and `pnpm test:contract` are green.

## 6. Role contracts (role-contracts delta)

- [ ] 6.1 Write failing contract tests in `kernel/tests/contract/role-contracts.test.ts`:
  - `pr-reviewer` names `bdk rules show --role pr-reviewer --file` and the result block fields, and names no `bdk dispatch show`, `bdk log add` or `bdk log ingest`;
  - the exceptions in the ingest, messages, `bdk log add` and rule-citation checks apply to `pr-reviewer` only;
  - the `implementer` body covers a `review-fix` package, naming fixed entry ids and resolving none;
  - P3 wording passes for every body.
- [ ] 6.2 Rewrite the role bodies:
  - `skills/roles/pr-reviewer/SKILL.md`: the PR brief input, rules by file set, the review of the range against the intent and contract, the result block, no ledger;
  - add the review-fix paragraph to `skills/roles/implementer/SKILL.md`;
  - each body at most 4 096 bytes.

  Verify that the tests of 6.1, `pnpm skill-check` and `bdk export agents --host claude --check` are green.

## 7. The cr skill (review-skills, design D1, D2, D4-D6)

- [ ] 7.1 Write failing content tests in `kernel/tests/contract/`, a new review skill test:
  - `skills/tools/cr/SKILL.md` exists, is at most 200 lines and has the context lines;
  - `disallowed-tools: Edit Write NotebookEdit`;
  - `allowed-tools` holds the kernel pair, `Agent`, `SendMessage`, `Skill`, `Read`, `Bash(git diff *)` and `Bash(git log *)` and no `Write(`;
  - no `disable-model-invocation`;
  - it names no `.bdk/cr/`, no `bdk_run_state.py` and no v2 agent;
  - it names `bdk review plan`, `bdk attempt open review-fix`, `--group`, `bdk log triage`, `@merge`, `bdk commit <change-id>`, `bdk done review` and `--kind review`.
- [ ] 7.2 Write `skills/tools/cr/SKILL.md`:
  - finding or opening the Change;
  - the round loop of D1, with the fix first when blocking entries exist;
  - packages per group and the gate runner through the swarm skill;
  - triage and the merged report;
  - `next.action` handling;
  - flags, `--inline` and the final report from kernel output.

  Delete `skills/cr/` with its three references. Verify that the tests of 7.1 and `pnpm skill-check` are green.

- [ ] 7.3 Write an E2E in `kernel/src/review/tests/round.e2e.ts` or a new file. It drives the command sequence the skill names on a `review` Change: open by `change new --inferred --kind review`, one round with a blocker, a fix round with `bdk commit <change-id>`, and `done review`. Verify that it is green through the built bundle.

## 8. The pr-review skill (review-skills, design D7)

- [ ] 8.1 Write failing content tests:
  - `skills/tools/pr-review/SKILL.md` is at most 200 lines with `disallowed-tools: Edit Write NotebookEdit`;
  - it starts `bdk:pr-reviewer` through `Skill` and names no `Agent` call, no `general-purpose` and no `/bdk:cr --inline`;
  - it names the brief fields, the Change contract lookup (active and archive), the confirmation before posting and the verdict policy table;
  - `references/reviewer-prompt.md` is gone.
- [ ] 8.2 Write `skills/tools/pr-review/SKILL.md`. Move `references/comment-templates.md` to the new directory and adapt its fields to the role's result block. Delete `skills/pr-review/`. Verify that the tests of 8.1, `pnpm skill-check` and `pnpm docs:build` are green.

## 9. Stage skills: run, design, plan (stage-skills delta)

- [ ] 9.1 Write failing content tests:
  - `skills/stages/run/SKILL.md` starts `/bdk:cr` from the loop table and has no stop row for `/bdk:cr`;
  - `design` and `plan` name the self-check step before `/bdk:verify-design` and `/bdk:verify-plan`;
  - `execute`'s Finish names `/bdk:cr` as the next stage.
- [ ] 9.2 Edit `run`, `design`, `plan` and `execute`. Update the stage skill E2E or eval seeds that expected the run to stop at review. Verify that the tests of 9.1, `pnpm skill-check` and `pnpm test:e2e` are green.

## 10. Plugin layout and removal (plugin-tooling delta, design D9)

- [ ] 10.1 Write failing content tests in `kernel/tests/contract/`:
  - `agents/` holds exactly the six adapters and `web-researcher.md`;
  - no directory under `skills/` starts with `bdk-`;
  - `plugin.json` `skills` lists `./skills/tools/`;
  - no `skills/cr/` or `skills/pr-review/` exists;
  - the `git grep` of removed agent names over `skills/`, `agents/`, `rules/`, `hooks/`, `STARTUP_INSTRUCTIONS.md`, `README.md` and `docs/guide/` is empty.
- [ ] 10.2 Delete the twelve v2 agents and the eight meta-skills. Add `./skills/tools/` to `plugin.json`. Fix every reference (`.claude/rules/portability-check.md`, the docs-sync map, `CONTRIBUTING.md`, `docs/INJECTION-FLOWS.md`, `docs/guide/` agents, shared foundation and skills pages, `README.md` Skills, Agents and Removed tables, the lines in `skills/debug` and `skills/test-driven-development`). Regenerate `STARTUP_INSTRUCTIONS.md` from `bdk ctx startup`. Run `pnpm skill-check --baseline-prune`. Verify that the tests of 10.1, `pnpm skill-check`, `bdk export agents --host claude --check`, `pnpm docs:build` and `claude plugin validate .` are green.

## 11. Evals: review-models and stage cases (skill-evals delta, design D10)

- [ ] 11.1 Write failing harness tests in `evals/suites/review-models/` and `evals/suites/stages/`:
  - the answer key parses;
  - every key file exists in the seed after its patch;
  - the variant rewrites only the `model` line of `agents/reviewer.md`;
  - the metrics count a found defect, a miss and a false alarm from a recorded ledger listing;
  - `pnpm eval check` validates the new suite and the new stage cases;
  - an unknown seed is refused.
- [ ] 11.2 Implement:
  - the suite (seed, defect patch, answer key, cells `sonnet`, `sonnet-prime` and `opus`, judge, metrics, report);
  - the `cr` cases (happy, blocker, refusal) and the `run --auto` case of `stages`;
  - the `evals/README.md` suites table row.

  Verify that the tests of 11.1 and `pnpm eval check` are green.

- [ ] 11.3 Run `pnpm eval review-models --probe` and `pnpm eval stages --skill cr --probe`, and record the per-cell cost and the projected series in this task. Stop for the user's approval before any series.

## 12. Acceptance and validation

- [ ] 12.1 Check the acceptance signal end to end:
  - content tests and `pnpm skill-check` are green, with the baseline pruned;
  - E2E: a `cr` round on a fixture Change writes reviewer findings through `log add --ticket <ticket>@<group>`, each with a rule id ref, and their reports through `log ingest`;
  - `bdk export agents --host claude --check` is green after the removal;
  - the `stages` probe of `run --auto` reaches an archived Change with `review` done.
- [ ] 12.2 Run the full gate:
  - `pnpm build`;
  - `pnpm lint`, `pnpm format:check`, `pnpm typecheck` and `pnpm knip`;
  - `pnpm test:unit`, `pnpm test:e2e` and `pnpm test:contract`;
  - `pnpm skill-check`, `pnpm docs:build`, `pnpm eval check`, `pnpm lint:py` and `pytest tests/unit/`.

  Fix any failure, including ones this Change did not cause.

- [ ] 12.3 Sync the deltas into `openspec/specs/` (the new `review-skills` main spec by hand). Run `openspec validate v3-t42-review-skills --strict` and `openspec validate --specs --strict`, and verify that both pass.
