# BDK v3: what went wrong

A checklist of findings, not a plan. Evidence: the B1 run on `staging/v3` (Change `2026-10-06-b1-repository-bootstrap-harness`, full report in `2026-10-06-b1-full-run-report.md` and broneq/bdk#166) and a review of the kernel, skills and rules on 2026-10-07.

The findings are grouped by the four problems of v2 that v3 was meant to solve:

1. **Speed:** a run takes too long; the goal was a faster run with better results.
2. **Correctness:** confidence that the code is right; v2 checks lean towards plain code review instead of looking at the product as a whole.
3. **Living documentation:** a product without current documentation of how it works falls apart as it grows (OpenSpec).
4. **Configurability:** usable as a plugin by different teams in different ways.

## 1. Speed

v3 is slower than the problem it was meant to solve. Execute of 62 files copied from a known source took 47 min; the whole run 11 h, about 3 h of it machine work.

- [ ] **A subagent per task.** 96 agents for 27 tasks in execute (3.5 per task): implementer, simplifier and runner per task, each with a cold start, a package, `bdk rules show` and `bdk log ingest`. Where: `skills/stages/execute` ("Flat"), `skills/swarm`, kernel `bdk attempt open` (`steps` per task).
- [ ] **The lead does the same one level down.** `skills/roles/lead` dispatches the per-task chain itself, so tree mode adds an agent per part and removes none.
- [ ] **The lead never ran.** `tree` only for `profile: large` (`kernel/src/graph/domain/wave.ts:98`); the Change defaulted to `small`, `skills/stages/change` does not offer `large`, nothing raises it after the plan grew.
- [ ] **The main thread is the most expensive agent.** 1 037 turns, 199 M cache-read tokens (all subagents together about 106 M), 3 context compactions. Every agent notification wakes opus with its full context.
- [ ] **Commands hang on stdin.** 14 commands hit the 120 s timeout (8 in execute); one hung `bdk log ingest` kept a shell alive 93 min after execute ended, so execute looked like it ran for hours. Where: kernel `bdk log ingest` reads stdin without a check; role skills say "Pipe the full report to `bdk log ingest`" and leave the shell form to the model.
- [ ] **The dispatch package loses the part preamble.** Task 02-2 lacked the source line, the implementer used `find /` and an older working tree; blocker 04-1, 2 extra verify-plan rounds on opus, about 8 min. Where: kernel `bdk dispatch build`.
- [ ] **Parallel tasks share one tree and one check file.** 26 missing-citation refusals, evidence of at least 6 tickets cites another ticket's run, 4 repeated runners, `verify-fix` tickets after execute, about 6 min. Where: `skills/roles/runner` (generic path), kernel `bdk evidence record`.
- [ ] **Agents for work that takes seconds.** Runner (haiku): 46 runs of about 1.1 min and 670 k cache-read each, to run `vitest` and `eslint`. Simplifier: 30 of 35 runs changed nothing.
- [ ] **Review reruns everything every round.** 4 rounds, 55 agents; rounds 3 and 4 held 2 and 1 minor entries and still ran a gate runner, an integration reviewer and group reviewers. Where: `bdk:cr`.
- [ ] **`do-not-touch` of the plan blocks review fixes.** 3 plan edits and 2 verify-plan rounds on opus during review, about 10 min. Where: `bdk:cr`, kernel.
- [ ] **A question without a blocker stops the run.** `AskUserQuestion` about `should-fix` and `nice-to-have` entries waited 5 h 04 min. Where: `bdk:cr` decision tier.
- [ ] **Bookkeeping dominates the run.** 1 349 of 1 808 Bash calls are `bdk`; the top five are `log ingest` 212, `log add` 178, `rules show` 157, `evidence record` 137, `dispatch build` 91. None of them produces product code.

## 2. Correctness

The gates that look at the design, the plan and the whole product found every material defect. The per-task checks found none of them.

- [ ] **No product-level check during execute.** Per-task checks are scoped tests and lint. 27 tasks closed green while the product did not work: the rendered configs bypass `harness/provider.ts`, so no smoke run gets its row (L-dzhorbso). Only the integration review after execute saw it.
- [ ] **Review is mostly code review.** 25 reviewer runs, one per part group per round, read code; one integration reviewer per round looks at the product as a whole and caught the only product blocker.
- [ ] **Evidence proves the agent's account, not the product.** `evidence record` checks tree hashes and `file:line=text` citations of check output an agent produced. It costs 137 calls and refusals, and says nothing about whether the product does what the spec says.
- [ ] **The simplify step checks no rules.** The simplifier loads all 51 rules but its contract only asks it to simplify. Rule violations visible in one task's diff (BDK-TQ-1 tests that cannot fail, BDK-CQ-4 and BDK-CQ-7 untested functions and narrating comments, BDK-ARCH-5 a duplicated helper, a CLAUDE.md provenance rule, task contract drift) surfaced only in `/bdk:cr`, each costing a fix round.
- [ ] **51 rules in every package.** Rules are not filtered to the touched files and languages, so every agent reads all of them.
- [ ] **A plan acceptance ran paid commands.** "Run every `pnpm bench` command except those needing credentials": the implementer ran `pnpm bench smoke --probe` twice without approval. verify-plan raised it (L-zfku9tci) as a finding, not a blocker; the implementer contract has no rule against costly commands.
- [ ] **Setup gave check commands that fail on valid files.** Scoped prettier without `--ignore-unknown`, eslint without `--no-warn-ignored`: 2 redispatches, fixed only in `verify-fix`. Where: `bdk:setup`.

What worked here, to keep:

- design-verifier found a false claim about the code (L-fw9ettz8);
- verify-plan found tasks without an owner (L-yy53yb9x);
- the implementer stopped at a plan defect instead of breaking `do-not-touch` (L-fgzdjjq2);
- the kernel refused stale evidence, so no task closed on evidence older than its code;
- integration review caught the product blocker (L-dzhorbso);
- triage of 52 review entries on one Lavish page instead of 13 rounds of questions.

## 3. Living documentation

- [ ] **The stage does not say what it creates and when.** The user asked "why is `change.md` empty" and "when is the spec delta written"; 21 min of the design stage (#149).
- [ ] **Machine records land in the repository.** The archived Change is 570 files committed to the product repository (#164); the documentation a reader needs is buried in run records.
- [ ] **Not evaluated:** whether the merged spec (`bench-runner`) describes the product correctly after the Change. The run only shows that `spec merge` worked (dry run, archive, merge and commit in 6 s).

## 4. Configurability

- [ ] **The execute mode depends on the profile, not on configuration.** `tree.enabled` and `min-parts` exist, but `tree` needs `profile: large`, which the change stage does not offer.
- [ ] **Portability machinery costs every run.** Dispatch packages as files, `ctx craft` for agents that "cannot load skills", `export agents --host`, an own agent registry next to the host's: built for hosts other than Claude Code, which is the only host in use, and paid for by every run.
- [ ] **Limits are not stated where agents work.** `bdk log add` refused 8 summaries as too long; the limit is not in the role contracts.

## 5. Architecture: root causes

These explain most findings above.

- [ ] **Process was moved into the kernel.** `.claude/rules/prompts.md`: "the kernel holds the order". `bdk-skill-kit` `references/process-vs-knowledge.md`: "Process belongs in code", including what runs next, retries and escalation. The result: skills describe how to react to the kernel, not how to do the work.
- [ ] **The flow of a stage is spread over six places.** For execute: the stage skill, `skills/swarm`, the `bdk ctx skill` injection (`kernel/src/ctx/use-cases/manifest.ts`), the `bdk next` instruction (`kernel/src/graph/domain/instruction.ts`, `shared/config/prompts.ts`), the `bdk dispatch build` package template and the role skills. Nobody can read the flow in one file.
- [ ] **Distrust of the agent became bookkeeping.** Because agents run the checks, the kernel needs tickets, evidence manifests, citations and stale-evidence checks. Because agents share one tree, it needs a commit lock, pathspec commits and a git guard for subagents.
- [ ] **The kernel duplicates the host.** `log ingest` duplicates the `Agent` result, `dispatch build` the `Agent` prompt, `agents list`/`wait` the host's task notifications, `ctx craft` the `Skill` tool, `commit` plain `git commit`.
- [ ] **The rules of the repository enforce this design.** `.claude/rules/skills.md` requires passing the `bdk dispatch build` package path and a `bdk hooks skill-exists` hook.
- [ ] **`swarm` repeats `execute`.** Steps under the ticket, escalation and single resume are described in both.
- [ ] **Size without use.** 41 873 lines of kernel, 73 command records; 39 commands ran in B1, 25 never ran, 12 carry 80% of the calls.
- [ ] **Diagnostics missed the live session.** `bdk:diagnose` reported the current transcript as `missing`, so no tokens and no cost (#157).
- [ ] **v3 was never released.** 620 commits on `staging/v3` over `main` (`v2.7.0`); the plugin version was not raised, so the run reports "2.7.0" while running the v3 kernel.

## 6. Notes for the start of the new line

Owner's notes, to remember when the new branch starts. Not a plan.

- [ ] **Carry the SDLC over.** The `## SDLC` section of `CLAUDE.md` on `staging/v3` (issue, OpenSpec Change, PR, gates, board, after the merge) goes to the new branch, adjusted to its base branch, milestone and board.
- [ ] **Remove all Python at once.** `main` (`v2.7.0`) holds 33 Python files (`scripts/`, `tests/`, `pyproject.toml`, `uv.lock`).
- [ ] **Remove everything of v2 that is not needed** before any new work, so the new line starts clean.
- [ ] **Start by removing all `.claude/rules` of v2.** The new line behaves differently, so rules written for v2 would steer agents wrong. `main` has 13: `artifacts.md`, `fragment-system.md`, `inject-fragments.md`, `language-rules.md`, `mcp-tool-naming.md`, `portability-check.md`, `quality-rules.md`, `script-tests.md`, `skill-creation-rules.md`, `skill-structure.md`, `skill-test-eval.md`, `testing-protocol.md`, `verification-scoping.md` (plus `.claude/skills/agent-lint` and `skill-lint`, now covered by `bdk-skill-kit`).
- [ ] **BDK becomes a marketplace of many modules.** `.claude-plugin/marketplace.json` already lists `bdk`, `bdk-craft` (subdirectory `plugins/bdk-craft`), and the separate repositories `broneq/git-identity` and `broneq/bdk-skill-kit`.
- [ ] **Bring the module repositories in.** Merge `git-identity`, `bdk-skill-kit` and the other existing module repositories into this repository, each into its own directory, keeping their history, after a preparatory merge in each (to settle).
