# Tasks

## 1. Probe the provider (D-2)

- [x] 1.1 Write `evals/versions.json` (fixture repository and commit `946a2081f84381ffc3b4a494467479a5b6886ead`, v2 tag `v2.7.0`) and a throwaway probe config under `evals/.runs/probe/` (not committed) that runs one Haiku 4.5 session through `anthropic:claude-agent-sdk` with a `git archive HEAD` plugin copy; verify it runs (as built: pinned tools in `evals/package.json`, because `npx` cannot resolve the SDK, D-1)
- [x] 1.2 Run the probe checks (a)-(f) of D-2: BDK agents listed and spawnable, the `pre-tool` hook denies a subagent `git commit`, a per-run `working_dir` reset by an extension `beforeEach` hook with `maxConcurrency: 1`, cost or token usage in the result, init lists exactly the plugin copy with an isolated `HOME` and `setting_sources: ["project"]`, `Workflow` and background `Task` in a v2.7.0 session; record each outcome with its evidence in `evals/README.md` (section "Provider facts"; the facts concern the harness environment, not the kernel's hook contract, so `docs/HOST-FACTS.md` is unchanged); verify every check has a pass or fail with evidence
- [x] 1.3 Choose the runner from the probe (built-in provider, or the `claude -p` custom provider of D-2) and write the choice with its reason into design.md D-2 "As built"; verify the design names one runner

## 2. Harness core (test-first)

- [x] 2.1 Add `evals/harness/` to the root vitest `unit` project, lint and typecheck; write failing unit tests for the difference rule (both spec scenarios: gap inside and outside the noise, equal ranges of zero, fewer than 2 runs refused) and the median / range helpers; verify they fail for the missing module
- [x] 2.2 Implement `evals/harness/stats.ts`; verify 2.1 passes
- [x] 2.3 Write failing unit tests for the budget ledger (sum across suites, refuse to start at the cap, `--budget` override, per-run `max_budget_usd` equals remaining budget, probe projection = per-cell cost x runs per cell) and for reading the reported cost from a provider result; implement `evals/harness/budget.ts`; verify they pass
- [x] 2.4 Write failing unit tests for fixture preparation against a local bare repository standing in for the upstream: fetch at the pin, refuse on a commit mismatch printing both commits, strip `.claude/`, `.agents/`, `CLAUDE.md`, `AGENTS.md`, base commit on `feat/eval`, fresh per-run copy without a previous run's commits; implement `evals/harness/fixture.ts`; verify they pass
- [x] 2.5 Write failing unit tests for plugin copies (`git archive` of a tag and of HEAD, a variant SKILL.md copied to `skills/<name>/`, a skill directory removed for the "without" cell, variant sha256 recorded) and for the init isolation check (extra plugin or MCP server -> discarded with reason); implement `evals/harness/plugins.ts` and `isolation.ts`; verify they pass
- [x] 2.6 Write failing unit tests for the CLI (`pnpm eval` with an unknown suite lists the three suites; no `ANTHROPIC_API_KEY` and no Claude Code login exits non-zero naming both before any model call, a login alone passes; `--probe`, `--runs`, `--budget` parsing; `check` needs no key); implement `evals/harness/cli.ts` and the `eval` script in `package.json`; verify they pass
- [x] 2.7 Write failing unit tests for result rows (provenance fields of the spec: model ids, fixture commit, BDK commit, variant hash, `template-hash` list; discard reason) and the JSONL writer; implement `evals/harness/results.ts`; verify they pass
- [x] 2.8 Add `pnpm eval check` (render every suite config and validate it with the pinned `promptfoo validate`) and the step in `.github/workflows/tests.yml`; add `evals/.runs/` to `.gitignore`; verify `pnpm eval check` passes locally with no credentials in the environment and `pnpm lint && pnpm typecheck && pnpm knip && pnpm test:unit` stay green

## 3. Execute A/B suite (D-4, D-5, D-7)

- [x] 3.1 Pick the execute feature in the fixture against D-4's criteria (two parts, four test-first tasks, `src/` only, no backend) and show it to the user with the two alternatives considered; verify the user approves one
- [x] 3.2 Write the task source (`evals/suites/execute-ab/task/`), the hidden acceptance tests (`hidden/`) and the reference solution (kept out of the fixture copies); verify the reference solution passes the hidden tests, `vitest run`, `tsc -b` and `eslint` on a fixture copy, and the hidden tests fail on the untouched fixture
- [x] 3.3 Write failing unit tests for the v3 seed (Change created with kernel commands, `bdk next --json` on the seeded copy names the first execute step, identical across two seeds) and for the v2 encoding (plan file in v2.7.0 format at `.bdk/plans/`); implement `evals/suites/execute-ab/seed.ts`; verify they pass
- [x] 3.4 Write the `v3-long` variant (approach B, from the v2.7.0 skill's structure translated to v3 commands) and the `v3-thin` variant (loop, role mapping, envelope handling only), both with `disallowed-tools` Edit and Write and `disable-model-invocation: true`; add a unit test that `v3-thin` has at most 200 lines; verify the test passes and `pnpm skill-check` reports no finding when pointed at the two variant directories
- [x] 3.5 Write failing unit tests for the metric extractors on recorded fixtures of state and `toolCalls` (acceptance score, v3 step completeness from attempt list, evidence, reports and trailers; v2 step completeness from trailers, subagent order and run manifest; `bdk` call, exit-3, exit-2 counts; envelope length); implement `evals/suites/execute-ab/metrics.ts`; verify they pass
- [x] 3.6 Write the promptfoo config for the four cells (`v2`, `v3-long` A, `v3-long` A', `v3-thin`), the post-session hook that copies hidden tests and computes metrics, and the `llm-rubric` for the final message; write the pre-registered criterion of D-7 into `docs/V3-EVAL-EXECUTE-AB.md` (criterion section only) and commit it before any measured run; verify `pnpm eval check` passes and the commit precedes the first result row

## 4. Rules no-op suite (D-8)

- [x] 4.1 Write failing unit tests for the bullet index (every `- ` bullet of `rules/*.md` and `rules/languages/*.md`, id = file + ordinal + 8 hex of sha256, 131 bullets today, stable across runs); implement `evals/suites/rules-noop/bullets.ts`; verify they pass
- [x] 4.2 Write `questions.yaml` (one question per bullet that does not quote it) and review every question against its bullet; verify a unit test that every bullet id has exactly one question and no question contains a 6-word run of its bullet
- [x] 4.3 Write 15-20 seeded patches against the fixture with `violations.yaml` (violation -> bullet id, file, line) and 3 clean control patches; mark bullets no TypeScript/React diff can violate as "not seedable"; verify a unit test that every patch applies to the stripped fixture base and every violation names an existing bullet id
- [x] 4.4 Write the promptfoo configs for M1 (Haiku 4.5 and Sonnet 5, Sonnet cell twice for A/A, Sonnet 5 judge, one-turn calls) and M2 (one-turn reviewer calls with the system prompt from `skills/roles/reviewer/SKILL.md` and `agents/reviewer.md`, with / with' / without cells, judge per violation); write failing unit tests for the per-bullet table and the provisional classes of D-8; implement `evals/suites/rules-noop/table.ts`; verify the tests and `pnpm eval check` pass

## 5. With / without mode (D-9)

- [x] 5.1 Write failing unit tests for the task file parser (`{id, prompt, assert}` list, errors name the entry) and the two-cell config generation (only the plugin copy differs); implement `evals/suites/with-without/`; verify they pass
- [ ] 5.2 Add an example task file for `bdk:mermaid-drawer` and document the mode in `evals/README.md`; verify `pnpm eval with-without --skill bdk:mermaid-drawer --tasks <example> --probe` runs one run per cell and prints the projection (after 6.1's approval of probe spending)

## 6. Probe, approval, measured series

- [x] 6.1 Run `pnpm eval execute-ab --probe` and `pnpm eval rules-noop --probe`; show the user per-cell cost and the projection against the 100 USD budget; verify the user approves the full series or a reduced one, and record the answer in design.md D-10 "As run"
- [x] 6.2 Run the approved `execute-ab` series; verify every counted run has a result row with all provenance fields, and discarded runs carry a reason
- [x] 6.3 Run the approved `rules-noop` series; spot-check 10% of judged items plus every uncertain one and record the agreement; verify every bullet has a row
- [x] 6.4 Generate the tables with `pnpm eval report execute-ab` and `pnpm eval report rules-noop`; commit `evals/results/`; verify the reports' numbers equal the rows

## 7. Reports and documentation

- [ ] 7.1 Complete `docs/V3-EVAL-EXECUTE-AB.md`: noise floor, per-arm medians and ranges, the three comparisons, the decision (thin skills or fallback B) under the criterion committed in 3.6, secondary findings for T41, any `v3-long` vs `v2` primary regression raised to the user; verify the decision follows mechanically from the rows
- [ ] 7.2 Complete `docs/V3-EVAL-RULES-NOOP.md`: noise floor, per-bullet table with provisional classes, spot-check agreement, hand-off notes for T31; verify one row per bullet
- [ ] 7.3 Add `tests/evals/README.md` naming `evals/` as the replacement and T32 as the removal task, add the removal to T32's scope and the T40 resolution (decisions, report links, T41 gate outcome) to `docs/V3-IMPLEMENTATION-PLAN.md`, point `.claude/rules/skill-test-eval.md` at `evals/`, update `CLAUDE.md` (architecture and development commands) and `README.md`; run the `docs-sync` skill for the user site; verify `pnpm docs:build` and `pnpm test:contract` pass
- [ ] 7.4 Post the T41 gate outcome as a comment on issue #61 (T41) with the report link; verify the comment is visible

## 8. Acceptance

- [ ] 8.1 Check the acceptance signal end to end: both reports present with noise floor and decision; `tests/evals/` marked for removal in T32; on a fresh clone with only credentials (an `ANTHROPIC_API_KEY` or a Claude Code login), `pnpm install && pnpm eval with-without --skill bdk:mermaid-drawer --tasks <example> --probe` runs without manual setup; `pnpm eval check` green in CI without a key
- [ ] 8.2 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip && pnpm test:unit && pnpm skill-check` and `openspec validate v3-t40-promptfoo-harness --strict`; verify all pass
