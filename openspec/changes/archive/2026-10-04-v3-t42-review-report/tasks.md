# Tasks

## 1. Settings: risk paths, `configuration` and `tracker` (design R4, R8)

- [x] 1.1 Write failing tests in `kernel/src/dispatch/tests/` and `kernel/src/review/tests/config.test.ts`:
  - `bdk config show review --json` holds six defaults, each with its `paths`;
  - a project item merged by `id` replaces `paths`;
  - a duplicate glob in `paths` is `policy/config-invalid`;
  - `tracker` is unset by default, and `config show tracker` answers `input/not-found`;
  - `{kind: instruction}` without `instruction` is `policy/config-invalid`, and `{kind: github, instruction: x}` is `policy/unknown-config-key`, each naming `tracker.instruction`.
- [x] 1.2 Implement:
  - `paths` and the `configuration` default in `kernel/src/dispatch/config.ts`;
  - `review` as a second consumer of `review.risks`;
  - the `tracker` module, with the discriminated union, consumer `review` and owner T42.

  Verify with the tests of 1.1, the settings JSON Schema contract test and `pnpm build`.

- [x] 1.3 Check that the `integration-reviewer` package still lists only `id` and `instruction` per risk: `kernel/src/dispatch` package tests green and no package size test moved.

## 2. Attempt rounds end on `ok` (design R6)

- [x] 2.1 Write failing tests:
  - in `kernel/src/attempt/tests/ladder.test.ts`: `currentRound` drops the records of a round ended by `ok`; a record carrying `after: <ok>` starts the round; a later `fail` keeps the same `after`; ladder-question rounds inside an `after` round still cut;
  - in the attempt E2E: `attempt open review-fix` after a `fail` then an `ok` stamps `after`, answers `attempt: 1` and `scope: full`, and `attempt list` shows `{used: 0, of: 2}`.
- [x] 2.2 Implement:
  - `after` in the attempt record schema and in the index `attempts` table;
  - stamping in `attempt open`;
  - the `after` key in `currentRound`.

  Verify with 2.1 and the whole `kernel/src/attempt` suite. Old records without `after` read as the first round.

## 3. Entry dispositions: `bdk log decide` (design R2)

- [x] 3.1 Write failing tests in `kernel/src/log/tests/` and as E2E, one per scenario of `kernel-cli/log`, bdk log decide:
  - the example against `schema/cli/output/log-decide.json`;
  - not found, resolved, wrong type, `reject` without a reason, `track` without an issue, `--issue` with `defer`, and `defer` on a `blocker` level;
  - `fix` sets `level: blocker`; that the next `implementer` package of a `review-fix` ticket embeds it is checked by the E2E of 6.3;
  - `defer --review` sets `accepted` and `review: true`;
  - a changed disposition drops `issue` and appends a second line;
  - `log add` and `log ingest` cannot set `disposition` or `issue`.
- [x] 3.2 Implement:
  - `disposition` and `issue` in `kernel/src/shared/store/state/entry.ts`, at version 1;
  - the index `entries` columns, with the index going to version 8;
  - the `decide` use case, command and output schema in `kernel/src/log/`, as `triage` does it.

  Verify with 3.1, the state fixture test and the CLI index contract test.

## 4. `change close` enforces dispositions (design R3)

- [x] 4.1 Write failing tests in `kernel/src/change/tests/`:
  - a live `should-fix` finding without a disposition gives `policy/undecided-entries`, naming it, with `instead` naming `/bdk:cr --report`, and nothing is written;
  - a live entry decided `fix` gives the same refusal;
  - `--dry-run` refuses the same;
  - `summary` lists a deferred entry marked "to be reviewed" when `review: true`, and a tracked entry with its issue link.
- [x] 4.2 Implement the check after `policy/ticket-open` and the summary lines in `kernel/src/change/`. Add `bdk log decide` calls to every close E2E fixture and the `stage-skills` E2E that closes with live entries. Verify with `pnpm test:unit` and `pnpm test:e2e` for `kernel/src/change` and `kernel/src/hooks`.

## 5. `bdk review render` (design R1, R4, R7, R9, R10)

- [x] 5.1 Write failing tests for the view model (`kernel/src/review/tests/report.test.ts`) on a fixed fixture:
  - parts against modules, with the row `outside the plan`;
  - risk cards from `paths`, with files tagged by entries naming the risk id or the file;
  - per file, the tasks whose `Files:` declare it and the commits of the range that changed it, oldest first;
  - the card summary from the `## Areas` line of the latest `integration-reviewer` report, a later report overriding an earlier one per risk id, and a card opened by a summary line without a glob match;
  - gate verdicts and coverage from evidence;
  - Decisions grouped `should-fix`, `nice-to-have`, `untriaged`, with blocker-level entries left out;
  - a body labelled `Problem:`, `Why it matters:`, `Suggested fix:` split into three fields, and an unlabelled body kept as written;
  - resolved entries under Settled;
  - live decisions, assumptions and risks under Context.
- [x] 5.2 Implement the view model in `kernel/src/review/domain/report.ts`. It reuses the module and `unplanned` logic of `groups.ts` with `review plan --full`'s range, `git diff --numstat` and `git log --format='%h %s' -- <file>` through the existing git port, the plan parts' `Files:`, and `shared/store/glob.ts`. Verify with 5.1.
- [x] 5.3 Write failing tests for the templates:
  - a byte-exact snapshot of the HTML and of the Markdown for the fixture;
  - escaping of `<script>` in a summary, a body, an area summary and a path;
  - the disposition legend above Decisions;
  - no `<link`, `src=`, `@import` or `url(` to an external resource (links to the PR and the issue are navigation, not resources);
  - `track` offered only with `tracker` set;
  - the inline script queues one prompt with `items` of `{id, disposition, reason}` for every Decisions entry;
  - the form is disabled and names `/bdk:cr --report` when `window.lavish` is absent.
- [x] 5.4 Implement `kernel/src/review/render/report-html.ts` and `report-md.ts`: a shared escaping helper, CSS tokens for light and dark mode, and the parts and areas grid. Verify with 5.3, and by opening the fixture page in a browser in both colour schemes and at phone width.
- [x] 5.5 Write failing E2E tests in `kernel/src/review/tests/render.e2e.ts`, one per scenario of `kernel-cli/review`, bdk review render:
  - the example against `schema/cli/output/review-render.json`;
  - `runtime/git-missing`;
  - two runs give byte-identical files;
  - the default path is under `.bdk/.machine/review/`;
  - `--format md`;
  - `--pr -` with `--out`: the ids `<number>-<n>`, the preselection from `blocking`, `why` shown when given, the computed verdict and no write under `.bdk/`;
  - `--pr` without `--out`, and malformed `--pr` input naming `prs[0].number`.
- [x] 5.6 Implement the `render` command, the use case and the `--pr` input schema in `kernel/src/review/`. Verify with 5.5, `pnpm test:contract` (CLI index, output schemas, spec and schema pair) and `pnpm build`.

## 6. `cr` report step and `--report` (design R5, R8)

- [x] 6.1 Write failing contract tests in `kernel/tests/contract/` for `skills/tools/cr/SKILL.md`:
  - `allowed-tools` holds `AskUserQuestion`, `Bash(lavish-axi *)` and `Bash(gh issue create *)`, and still no `Write(`;
  - `argument-hint` names `--report`;
  - the body names `bdk review render`, `bdk log decide`, `lavish-axi poll`, `--format md`, `defer --review` inside `/bdk:run`, `gh issue create` and the `tracker` instruction kind;
  - the body says that `fix` starts a new round and that every submitted id is accounted for;
  - the body says that the round, and `--report`, triage every live entry of the Change without a level, whichever stage wrote it;
  - the file is at most 200 lines.
- [x] 6.2 Write the report section of `skills/tools/cr/SKILL.md` and the `--report` argument, and extend Finish with the report path and the dispositions. Run `/bdk-skill-kit:skill-authoring` on it. Verify with 6.1 and `pnpm skill-check`; the baseline does not grow.
- [x] 6.3 Extend `kernel/src/review/tests/review-round.e2e.ts` with the sequence `cr` names after `done review`:
  - `log triage` of an execute-stage observation the round did not write;
  - `review render`, with that observation under its level and no `untriaged` group;
  - `log decide` with `fix` on a `should-fix` entry;
  - a new round opened with `attempt: 1`, whose `implementer` package embeds the entry, that fixes it, commits and resolves it;
  - `done review`, a second `review render` without it in Decisions;
  - `log decide` with `defer` for the rest;
  - `change close` passes.

## 7. Role contracts: finding body and area summaries (design R9, R10)

- [x] 7.1 Write failing content tests in `kernel/tests/contract/` for the scenarios of `role-contracts`, Role contract content: `reviewer` and `integration-reviewer` name `Problem:`, `Why it matters:` and `Suggested fix:`; `pr-reviewer` names the result block field `why`; `integration-reviewer` names `## Areas` and `- <risk-id>: <sentence>`.
- [x] 7.2 Edit `skills/roles/reviewer/SKILL.md`, `skills/roles/integration-reviewer/SKILL.md` and `skills/roles/pr-reviewer/SKILL.md`, and the parsing of the result block in `skills/tools/pr-review/SKILL.md`. Run `/bdk-skill-kit:skill-authoring` on each. Verify with 7.1, the body size test (4 096 bytes), `pnpm build` (agents adapters) and `node dist/bdk.mjs export agents --host claude --check`.

## 8. `pr-review` decision step (design R7, R8)

- [x] 8.1 Write failing contract tests:
  - `pr-review` allows `Bash(lavish-axi *)` and names `--quick`, `bdk review render --pr -`, `lavish-axi poll` and the four choices;
  - it falls back to the `AskUserQuestion` confirmation on `--quick` or any Lavish failure;
  - a `tracker` finding is filed and listed;
  - `references/comment-templates.md` has a tracked-issues section in both summaries.
- [x] 8.2 Rewrite "Confirm" in `skills/tools/pr-review/SKILL.md` as the decision step plus the `--quick` fallback, and add the tracked section to `references/comment-templates.md`. Verify with 8.1, `pnpm skill-check` and the 200-line limit.

## 9. `run` and `setup` (design R5, R8)

- [x] 9.1 Write failing contract tests:
  - `skills/stages/run/SKILL.md` names `bdk log decide <id> defer --review` for the report, says the run never chooses `fix`, and names the report path and `/bdk:cr --report` in Finish;
  - `skills/stages/setup/SKILL.md` names `gh auth status`, `bdk config set tracker` and both kinds.
- [x] 9.2 Edit both skills. Verify with 9.1 and `pnpm skill-check`.
- [x] 9.3 Update the `stages` eval case `run-auto` (`evals/suites/stages/cases/run.yaml`). Its expectations now include the report path and a `defer` disposition with `review: true` before the close. Verify with `pnpm eval check` and `npx vitest run evals`. Probe it only after the user approves the cost.

## 10. Documentation

- [x] 10.1 Update `docs/guide/workflows/code-review.md`, `docs/guide/reference/artifacts.md` (dispositions, `log decide`, risk `paths`, `configuration`, `tracker`), `docs/guide/workflows/full-pipeline.md` (the report in a run) and the README skills table row of `cr` and `pr-review`. Verify with `pnpm docs:build` and the docs drift guards in `pnpm test:contract`.

## 11. Acceptance

- [x] 11.1 Run the full gate:
  - `pnpm build`, `lint`, `format:check`, `typecheck`, `knip`, `lint:py`;
  - `test:unit`, `test:e2e`, `test:contract`, `npx vitest run evals`;
  - `skill-check`, `docs:build`, `eval check`, `pytest tests/unit/`;
  - `node dist/bdk.mjs export agents --host claude --check`, `claude plugin validate .`;
  - `openspec validate --specs --strict` and `openspec validate v3-t42-review-report --strict`.
