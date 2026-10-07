# Tasks

## 1. Eval seed and baseline

- [x] 1.1 Extend the `executed-two-parts` seed (`evals/suites/stages/seeds/executed-two-parts/`):
  - add a spec delta for the two parts: one capability, an ADDED requirement per part with its scenarios, and one scenario whose test the defects patch leaves out;
  - add a binary snapshot as a `GIT binary patch` section with `new file mode`, and name it in the `Files:` of task `02-1` (`02-problem-title.md`) so `bdk commit` records no undeclared file;
  - teach `patchFiles`, `sectionsFor` (`seeds.ts`) and `hunkRanges` (`key.ts`) the binary section, and make `patched()` list new untracked files, not only `git diff --name-only`;
  - copy `spec-delta/` and run `bdk done spec-delta` in `executedTwoParts`.

  Write the failing seed tests first, then verify that `pnpm eval check` and the seed's unit tests (`evals/suites/stages`) pass.

- [x] 1.2 Write failing unit tests in `evals/suites/review-models/metrics.test.ts` for the metrics of `skill-evals`, Review models measurement:
  - raw false alarms, recall after triage per class, and defects dismissed by triage (the scenario "triage that drops a seeded defect is visible");
  - integration reviewer and judge wall time and tokens, and whether the judge ended before the gate runner;
  - reviewer groups holding a binary file;
  - `guard/reader-write` denials of reviewers and the judge, and `guard/judge-scope` denials;
  - group reports with `## Seams`, and an integration report with `## Intent` before `## Areas`;
  - findings with a `Failure scenario:` paragraph;
  - the share of judge package entries that its `## Verdicts` names with the level they hold.

  Then wire the sources `hooks.ts` does not read today: per-agent wall time and tokens and guard denials from `bdk diagnostics report` and the run journal (as `evals/suites/stages/refusals.ts` does), and report bodies and dispatch packages from the Change directory. Implement the metrics in `metrics.ts` (strip the `Triaged as` lines from bodies before matching) and add them to `report.ts`. Verify that the suite's unit tests and `pnpm eval check` pass.

- [x] 1.3 Run `pnpm eval review-models --probe` on the code before this change and commit its result rows as the baseline. The full series was not approved (projection 25.65 USD), so the probe series `evals/results/review-models/probe-2026-10-07-051533.jsonl` (one run per cell, bdk commit `f671adbd`) is the baseline; `pnpm eval report` reads measured series only, so 10.2 compares with this file directly.

## 2. Binary files out of the review groups

- [x] 2.1 Write failing unit tests in `kernel/src/measure/tests/measure.test.ts` for the per-file numstat rows: `binary: true` for a `-\t-\t<path>` row and `false` otherwise, with the added and removed counts unchanged, and the range measurement aggregating the same rows with no second git call. Implement this in `kernel/src/measure/domain/measure.ts` and `use-cases/measure.ts`: export the rows and the range reader from `measure/index.ts`, and run numstat with `-M` so renames resolve as `--name-only -M` does today. Verify that the measure tests pass.
- [x] 2.2 Write failing unit tests in `kernel/src/review/tests/groups.test.ts` for:
  - the scenarios "binary files belong to no group" and "only binary files changed";
  - an `integration` group without binary files;
  - the changed "nothing new to review" behaviour (no group and an empty `binary`).

  Implement them in `kernel/src/review/domain/groups.ts` and `review/use-cases/plan.ts`: one numstat read through `measure` gives the group files, the binary list and `measure`, replacing `diffNames`. Export a range-to-binary function from `review/index.ts` for `dispatch`. Verify that the tests pass.

- [x] 2.3 Add `binary` to the output schema `kernel/src/review/schema/plan.ts`, regenerate the schemas with `pnpm build`, and extend `review.e2e.ts` with a range holding a PNG; verify `pnpm test:e2e` for review and the `cli-contract` example scenario pass.
- [x] 2.4 Write a failing test in `report-render.test.ts` for the Summary line `Not reviewed as text` in HTML and Markdown; implement it in `review/render/report-html.ts` and `report-md.ts` and verify the test and the snapshot pass.
- [x] 2.5 Document `binary` and the summary line in `docs/guide/workflows/code-review.md`; verify `pnpm docs:build` passes.

## 3. The `integrator` and `judge` adapters

- [x] 3.1 Write failing tests and verify that they fail:
  - `export/tests/agents.test.ts` and `agents.e2e.ts` expect eight adapters, among them `integrator` (tools of `reader`, `opus`, `high`) and `judge` (tools of `reader`, `sonnet`, `high`);
  - `plugin-layout.test.ts` and `host-probe.test.ts` expect `agents/integrator.md` and `agents/judge.md`;
  - the `role-contracts` adapter scenarios expect the adapter table and the body-shape rule for both;
  - the `kernel-architecture` generated-outputs test expects the eight adapter files.
- [x] 3.2 Add both adapters to `ADAPTERS` in `kernel/src/export/domain/adapters.ts`, to the enums in `export/schema/agents.ts` and `dispatch/schema/outputs.ts`, and to the generated list in `CONTRIBUTING.md`. Drop "with test runs" from the `reviewer` adapter description. Run `pnpm build` and verify that the tests of 3.1 pass and that `bdk export agents --host claude --check` exits 0.
- [x] 3.3 Write failing tests in `kernel/src/hooks/tests/guards.e2e.ts`, `pre-tool.test.ts` and `payloads.ts` for these `kernel-cli/hooks` scenarios:
  - "integrator payload reaches the kernel";
  - "integrator cannot write a file";
  - "judge cannot write a file";
  - "report through a stdin heredoc passes";
  - "integrator dispatch needs a package path".

  Add `bdk:integrator` and `bdk:judge` to `READ_ONLY_ADAPTERS` and `ADAPTERS` in `kernel/src/hooks/domain/guards.ts`, to the prefilter in `hooks/guard/pre-tool.sh`, and to the `guard/reader-write` row of the rule catalogue. Verify that the hook unit and E2E tests, the perf budgets and the contract tests pass.

- [x] 3.4 Name both adapters in `docs/guide/reference/agents.md`, `docs/guide/concepts/agents.md`, `docs/guide/reference/hooks.md` and in the adapter count and mapping of `docs/guide/getting-started/migration-from-v2.md`. Regenerate `STARTUP_INSTRUCTIONS.md` with `node dist/bdk.mjs ctx startup`. Verify that `pnpm test:contract` (startup, docs coverage, P11) and `pnpm docs:build` pass.

## 4. Finding body, severity and the P8 lists

- [x] 4.1 Write failing tests in `kernel/src/log/tests/` for the `kernel-cli/log` scenarios "severity of a finding" and "severity on a blocker". Add the `--severity` flag and its validation to `bdk log add` (`log/commands/log.ts`, `use-cases/add.ts`) and to `schema/cli/commands.json`; the entry schema and the index already hold `severity`. Verify that the log unit and E2E tests and the CLI contract test pass.
- [x] 4.2 Write failing tests in `kernel/src/review/tests/report.test.ts` and `report-render.test.ts` for the `kernel-cli/review` scenario "failure scenario as a field":
  - `Failure scenario:` as a fourth label after Problem;
  - no paragraph of a labelled body dropped;
  - the latest triage reason next to the level.

  Implement it in `review/domain/report.ts` (`BODY_LABELS`, `splitBody`) and both renderers, and verify that the tests and snapshots pass.

- [x] 4.3 Write failing tests in `kernel/src/dispatch/tests/build.test.ts` for "reviewer package carries the P8 lists" and the unchanged "verifier categories". Give the `categories` section to `reviewer` and `integration-reviewer` in `dispatch/use-cases/build.ts` and `domain/template.ts`, behind one list of P8 roles that 7.2 extends with `judge`. The verifiers keep the verifier sentence and the reviewing roles get the triage sentence. Verify that the dispatch tests and the template hash test pass.
- [x] 4.4 Write a failing test in `build.test.ts` for "return section reads the report from stdin". Change the Return section of `kernel/src/dispatch/domain/template.ts` from `< <report-file>` to the quoted heredoc form, and update the template hash fixtures. Verify that the dispatch tests and `dispatch.e2e.ts` pass.

## 5. The integration package

- [x] 5.1 Write failing tests in `kernel/src/dispatch/tests/build.test.ts` for these `kernel-cli/dispatch` scenarios, and verify that they fail:
  - "integration reviewer package": `adapter: integrator`, `git diff --stat`, no whole-range diff, and the six default risks;
  - "integration package names the group reports", with the gate left out;
  - "integration package names the spec deltas";
  - "integration package names the binary files";
  - "no file list for the integration reviewer".
- [x] 5.2 Add a `shared/store` query that lists the `reviewer` group packages of a ticket with their `group`, `files` and `report`, whether the report exists, and without `gate`, `integration`, `judge` or scouts. `packageRoles` matches only ungrouped packages. Then:
  - implement the `integration-reviewer` text in `kernel/src/dispatch/domain/review.ts`, and in `template.ts` where the review section says the groups run in parallel, from that query, the Change's spec delta paths and the binary list of the range from `review/index.ts` (2.2), with the Intent table format only when spec deltas exist;
  - make `--range` required for it and refuse `--file` and `--part`;
  - set `integration-reviewer` to `integrator` in `ROLE_ADAPTERS` and in the `agent:` of `skills/roles/integration-reviewer/SKILL.md`.

  Verify that these pass: the tests of 5.1, `dispatch.e2e.ts`, the template hash test, and the `role-contracts` test "integration reviewer runs on the reader adapter". Also verify that the package stays under the 163 840-byte limit on a ticket with nine groups.

- [x] 5.3 Remove the 12 288-byte residue of the earlier limit (#150):
  - the `bytes` maximum in `kernel/src/dispatch/schema/outputs.ts`;
  - the header comment of `dispatch/use-cases/build.ts`;
  - the assertions in `dispatch.e2e.ts`, `kernel/src/dispatch/tests/groups.test.ts` and `build.test.ts` (assert against the 163 840 limit or the fixture's measured size);
  - the "12 KB" in `docs/guide/concepts/context.md`, which also gives the risks to a reviewer instead of the integration reviewer.

  Write first a failing test that builds a package above 12 288 bytes and validates the output against `dispatch-build.json`. Verify that the dispatch tests, the CLI contract test, the acceptance catalogue guard for `S-DISPATCH` and `pnpm docs:build` pass.

## 6. The Intent section of the review report

- [x] 6.1 Export the delta parser from `kernel/src/spec/index.ts` and add the edge `review` to `spec` to the import test of `kernel-architecture` ("review imports only measure"). Write failing unit tests in `kernel/src/review/tests/report.test.ts` for a parser of the `## Intent` table next to `areaLines` in `review/domain/report.ts`:
  - rows by capability, requirement and scenario, with names trimmed and otherwise matched exactly;
  - `State` as `ok` or entry ids;
  - a malformed row skipped;
  - a missing table.

  Implement it, and verify that the tests and the structure test pass.

- [x] 6.2 Write failing tests in `render.test.ts` and `report-render.test.ts` for these `kernel-cli/review` scenarios:
  - "intent rows from the spec deltas": an `untraced` scenario with its warning, a REMOVED requirement row with scenario `-`, linked entry ids, and a report row that names no scenario left out;
  - "no Intent section without spec deltas";
  - the warning that names a missing table, and HTML escaping of the scenario names and of the report's `Code` and `Test` cells.

  Implement the section in `review/use-cases/render.ts` and both renderers, with scenarios from `spec`'s parser, and renumber the sections. Verify that the tests, the snapshots and the "same state, same file" test pass.

- [x] 6.3 Describe the Intent section and the Failure scenario field in `docs/guide/workflows/code-review.md`; verify `pnpm docs:build` passes.

## 7. The judge role

- [x] 7.1 Write failing tests and verify that they fail:
  - `role-contracts.test.ts` expects eleven roles with `judge` on `bdk:judge` ("Role skills", "Role-to-adapter map");
  - `rules/tests/show.test.ts` expects "the judge reads no stage rules";
  - `dispatch/tests/build.test.ts` expects "judge package lists the round's entries" (with `entries` in the frontmatter and no entry body) and "no file list for the judge";
  - the `kernel-state` test of the Dispatch package expects "judge package names its entries".
- [x] 7.2 Wire the judge into the kernel:
  - add `judge` to `ROLES` and `ROLE_STAGE` (no stage) in `kernel/src/shared/vocabulary/index.ts`, to `ROLE_ADAPTERS`, to `GROUPED_ROLES` and `REVIEWING_ROLES` in `dispatch/domain/review.ts`, and to the P8 roles of 4.3;
  - update the role texts of `schema/cli/commands.json`: the `dispatch build` role list, `--range` required for the judge, and "one of the eleven roles" in `rules show`;
  - implement the judge `Review` section and the `entries` frontmatter in `dispatch/domain/review.ts` and `use-cases/build.ts`, with the shared ledger entries section left out of a judge package, and add `entries` to the package frontmatter schema.

  Verify that the tests of 7.1 that do not need the role body pass.

- [x] 7.3 Write failing tests in `kernel/src/hooks/tests/guards.e2e.ts` and `pre-tool.test.ts` for these scenarios:
  - from `kernel-cli`: "judge triages an entry of its package", "judge outside its package", "judge may not resolve" and "judge without a registry package";
  - from `kernel-cli/hooks`: "guard/judge-scope".

  Implement the judge exception in `kernel/src/hooks/domain/guards.ts`: `needsAgentFacts` covers a Bash call of `bdk:judge`, the agent facts read the `entries` frontmatter of the registry row's package as `packageWorkdir` reads `workdir`, and the deny rule is `guard/judge-scope`. Register the rule in the guard rule list, in the pre-tool refusals of `schema/cli/commands.json`, in the `bdk hooks pre-tool` rule list and in the rule catalogue of "Exit codes and the error object". Verify that the hook tests, `cli-contract.test.ts` and the guard perf budget pass.

- [x] 7.4 Write `skills/roles/judge/SKILL.md` from the Judge bullet of `role-contracts`:
  - input, the three checks, and rules read by id with `bdk rules show <id>`;
  - the four levels and the `blocker`-type rule;
  - no new entries, no test run, and no rule-citation line;
  - `## Verdicts` and the heredoc hand-over;
  - messages, and no authorisation wording.

  Verify that these pass: the tests of 7.1, "judge triages and finds nothing new", "readers hand over without a file", the P3, messages and "rule ids are cited" scenarios, the 4 096-byte body budget and `pnpm skill-check`.

- [x] 7.5 Name the judge in these docs: `docs/guide/concepts/agents.md`, `docs/guide/concepts/context.md`, `docs/guide/reference/skills.md` (role list), `docs/guide/reference/hooks.md` (`guard/judge-scope`), the stage-readers tables of `docs/guide/concepts/quality-and-language-rules.md` and `rules/README.md`, and `docs/guide/workflows/code-review.md`. Verify that `pnpm test:contract` and `pnpm docs:build` pass.

## 8. Reviewer and integration reviewer contracts

- [x] 8.1 Write failing content tests in `kernel/tests/contract/role-contracts.test.ts`, and verify that they fail:
  - "readers hand over without a file";
  - "reviewer lists its seams";
  - "integration reviewer traces the spec deltas";
  - "integration reviewer summarises the areas", with `## Intent` before `## Areas`;
  - "findings explain why they matter", with `Failure scenario:` and `--severity`;
  - "reviewers run no tests";
  - no role body linking a `references/` file.

  Also update the review-groups assertions: no duplication across parts and no whole-range diff.

- [x] 8.2 Rewrite `skills/roles/integration-reviewer/SKILL.md` from scratch, not by adding to it, because 128 bytes of its budget are free. Build it around:
  - the five checks of `role-contracts`: intent to code, behaviour to test, test cases, seams from the group reports, and risks;
  - the `## Intent` table before `## Areas`, and the `observation` for a Change without spec deltas;
  - the failure scenario, the severity and the heredoc hand-over.

  Then update `skills/roles/reviewer/SKILL.md`:
  - add `## Seams`, the failure scenario, the severity and the heredoc;
  - replace its `description` claim that it runs the named tests, within the 250-character limit, with what it does: it reads its group's files and their tests and logs findings with a failure scenario;
  - add the sentence that the gate runs the checks.

  Verify that the tests of 8.1, the 4 096-byte body budget, `pnpm skill-check` and the `role-contracts` suite pass.

- [x] 8.3 Review the three contracts (`reviewer`, `integration-reviewer`, `judge`) with `/bdk-skill-kit:skill-authoring` and fix what it finds; verify `pnpm skill-check` still passes.

## 9. `/bdk:cr` runs integration and the judge after the groups

- [x] 9.1 Write failing content tests in `kernel/tests/contract/tools-skills.test.ts`, and verify that they fail:
  - "cr runs a review round": the reviewers and the gate first, integration after every reviewer has returned, the judge after the integration reviewer and in the background, and the all-binary range ("only binary files changed");
  - "cr triages every entry of the round": `main` triages only entries without a level and changes no level the judge set;
  - "cr inline": the packages are built in the same order, and `main` plays the integration reviewer and the judge.
- [x] 9.2 Rewrite steps 5 and 6, the Triage section and the `--inline` section of `skills/tools/cr/SKILL.md` into the three dispatch steps, the triage and the inline order of `review-skills`. Extend `review-round.e2e.ts` so that:
  - the integration package is built after the reviewer reports are stored;
  - the judge package is built after the integration report;
  - a judge `log triage` of a listed entry passes.

  Verify that the tests of 9.1, the E2E test and `pnpm skill-check` pass.

- [x] 9.3 Update the `cr` section of `docs/guide/reference/skills.md`, the round diagram of `docs/guide/workflows/code-review.md` and the cr roles in `README.md`; verify `pnpm test:contract` and `pnpm docs:build` pass.

## 10. Acceptance

- [x] 10.1 Run `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip`, `pnpm test:unit`, `pnpm build && pnpm test:e2e`, `pnpm test:contract` and `pnpm skill-check` on the branch; verify all pass.
- [ ] 10.2 Run `pnpm eval review-models --probe`, get the projection approved, run the series and commit its rows. Then compare with `pnpm eval report review-models` against the baseline of 1.3 and verify:
  - no reviewer group holds a binary file, and the snapshot is reported as not reviewed as text;
  - every group report ends with `## Seams`, and the integration report has `## Intent` before `## Areas`;
  - every integration finding is about intent, tests, seams or risks;
  - false alarms are clearly below the baseline, recall after triage is the same or higher, and triage dismisses no seeded defect, judged by a direct comparison of the series with the baseline rows, not by the `sonnet`/`sonnet-prime` noise-floor rule;
  - every finding has a `Failure scenario:`;
  - the judge's `## Verdicts` covers every entry of its package with the level it holds;
  - the integration wall time and tokens are well below the baseline, and the judge ends before the gate;
  - no reviewer or judge is denied by `guard/reader-write` or `guard/judge-scope`.
  Skipped in this Change: both probes ran with bypass mode disabled by managed settings and are invalid; the measurement moves to #167.
- [ ] 10.3 Run `/bdk:cr` with `claude --plugin-dir ~/projects/bdk` in a separate test project on a branch with a PNG and a spec delta (REPO-1). Open the rendered report and check in light and dark scheme: the Summary, the Intent section, the Failure scenario field, the triage reasons, Settled and the Change map. Fix what looks off.
  Skipped in this Change by the user's decision.
- [x] 10.4 Run `openspec validate v3-158-improve-review --strict` and `openspec validate --specs --strict`; verify both report valid.
