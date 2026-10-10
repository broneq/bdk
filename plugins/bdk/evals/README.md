# bdk evals

Eval cases of the `bdk` plugin for [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals). A block stays in BDK only when its case shows that it changes the outcome (ADR-0003); a CLI helper, hook or workflow comes only for a problem a case or a measurement showed. Spec: `openspec/specs/skill-evals/spec.md`.

Every run is a real model call on your account. Nothing here runs in CI except the free check below.

## Run

From the repository root, after `pnpm install`:

```bash
# Every case, with and without the plugin, 3 runs per arm
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit

# Probe one case cheaply while writing it: one run, one arm
pnpm --filter @bdk/bdk run eval --allow-tools Write --case 'sample-*' --runs 1 --ablation none

# Blocks, and orchestrators (one arm)
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit --tag block
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit --tag orchestrator --ablation none
```

The `eval` script builds the plugin, then runs `claude plugin eval . --scaffold` with the Claude Code version pinned in the root `package.json` (through `run.ts`); every other argument goes to `claude plugin eval` (`--help` lists them). Useful ones: `--model` and `--judge-model` to pin models when comparing runs, `--max-cost-usd` as a ceiling, `-j 4` for parallel runs, `--no-publish` to keep the report local. Results land in `evals/results/<timestamp>/` (ignored by git) with `report.html`.

The cases that call OpenSpec (`propose-*`, `design-*`, `plan-*`, `close-*`, `run-*`, `cli-*`, ...) need a global OpenSpec 1.13.2 outside your home directory, the version CI pins: `npm i -g @fission-ai/openspec@1.13.2` with a Node from Homebrew or the system, or a clean `HOME` (see the `openspec` entry of "Host limits"). The script removes every `node_modules/.bin` directory from the `PATH` the run inherits and warns before the run when the `openspec` left on it is missing or lies under your home directory.

Read `WITH`, `W/OUT` and `Δ`: a block whose `Δ` stays near 0 over 3 runs does not change the outcome. `tool_used: Skill` graders are not scored; they show whether the skill fired.

### Grants

A run gets only the read-only tools a case lists in `allowed_tools`; `Write`, `Edit`, `Bash`, `WebFetch` and `WebSearch` also need `--allow-tools` on the command line, for every case of the run. Repeated `--allow-tools` add up. Grant `Bash` narrowly (`"Bash(git *)"`); each granted command runs in Claude Code's OS sandbox.

### Cases that need Bash

The `setup-*` cases run `/bdk:setup`, which calls the plugin's `bdk`, OpenSpec, `git`, and `node -e` to look for a browser for Playwright. Grant them, with the clean `HOME` of "Host limits" and a `PATH` without other plugins' `bin/`:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(npx *)" "Bash(node -e *)" "Bash(git *)" --case 'setup-*'
```

`setup-multi-package` runs on a repository of `api/` (uv, pytest, ruff) and `web/` (pnpm, vitest, eslint) and grades that each check item's `paths` cover only its package; `setup-web-app` grades that a single package gets no `paths`.

Claude Code refuses every write to `.claude/settings.json` in a run, whatever the grants, so the cases grade the permission rules from the reply, where setup lists them for the user.

`setup-scoped-rewrite` starts from a configured project whose `tools.test` item holds the removed `scoped` field and a comment: setup must rewrite it into the whole command at `wave` and a `{files}` item at `part`, and keep the comment.

`setup-existing-openspec` starts from a v2 project already on OpenSpec `spec-driven`: setup cannot ask in a run, so it must keep the schema line and its `context:`, and its reply must name the removed v2 `/.bdk/` ignore rule. `setup-claude-plugin` is a Claude Code plugin with a `bin/` launcher and grades the `plugin` E2E item that validates it.

`setup-web-app` and `setup-library` also grade the decision surface setup reports: each puts a `lavish-axi` stub into the workspace's `node_modules`, which `npx -y lavish-axi` runs before any installed one. The stub of `setup-web-app` answers `--version`, so its reply names the Lavish page; the stub of `setup-library` fails, so its reply names `AskUserQuestion`. The `Bash(npx *)` grant covers both.

The review cases (`review-group-*`, `review-integration-*`, `judge-*`) run on the `monthly-report` fixture, a recorded review round of a two-part Change. `review-group-instruction` and `judge-instruction` run on `monthly-report-instructions.sh`, the same round with a `CLAUDE.md` on `main` whose testing instruction part 01 breaks: the reviewer must cite it with `--rule CLAUDE.md`, and the judge must level it `should-fix` and a citation of an instruction the file does not hold `not-a-problem`. `judge-previous-repeat` seeds a `previous-review` finding of the parse bug and, after it, a differently worded `review-group` finding of the same bug, as a verify round of `/bdk:pr-review` leaves them: the judge must keep the seeded one `blocker` and level the later one `not-a-problem` naming the seeded id (spec `review-blocks`, scenario "A previous finding reported again"). `review-integration-outside-fix-scope` starts from round 2 of `monthly-report` after a fix pass that changed only `src/parse.test.js`: round 1 logged the parse bug of amounts with fewer than two decimals (decided `accept`) and a test gap (decided `fix`), not the cents and dollars seam, and round 2's log is empty. It grades that the integration reviewer logs the seam with evidence saying it lies outside the fix scope, and does not raise the accepted parse bug again (#367). The blocks read the code and write only through `bdk findings`, so they need `bdk` and read-only `git`, and no `Write` or `Edit`:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools "Bash(*/bin/bdk *)" "Bash(git *)" --case 'review-*'
pnpm --filter @bdk/bdk run eval --allow-tools "Bash(*/bin/bdk *)" "Bash(git *)" --case 'judge-*'
```

The `triage-*` cases start from the shared fixture `monthly-report-judged.sh`: round 1 of `monthly-report` judged, one finding of each level, no decision. The block records decisions only through `bdk findings decide`, so it needs `bdk` and, for the manual cases, `Write` for the page and the Lavish CLI. `triage-lavish` and `triage-ask` put a `lavish-axi` stub into `node_modules` as the `design-draft` cases do; `triage-auto-policy` sets `policy.gates.review: auto` and grades that nothing is asked:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" "Bash(npx -y lavish-axi *)" --case 'triage-*'
```

The `cli-*` cases run `/bdk:cli` as the main session would: `cli-config` on `monthly-report.sh`, `cli-findings` on `monthly-report-judged.sh`, `cli-run-state` on `tally-queue.sh` and `cli-route` on `monthly-report.sh`. They need `bdk` and `openspec status`, no `Write`. `cli-findings` reads a file the model can also read raw, so its `Δ` stays near 0 and the case guards against a write; `cli-route` is answered from the session start context, so `skill-fired` may stay 0:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools "Bash(*/bin/bdk *)" "Bash(openspec status *)" --case 'cli-*'
```

The `propose-*` cases run `/bdk:propose`, which calls `bdk`, OpenSpec and `gh issue view`. A run has no GitHub credential, so `propose-from-issue` reads its issue through the offline stand-in `fixtures/bin/gh`: its scaffold copies the stand-in to `.git/bdk-eval/bin/gh` and the issue to `.git/bdk-eval/issues/42.json`. A run cannot execute a file outside its workspace, even with that directory on `PATH`, so put the relative directory first:

```bash
PATH=".git/bdk-eval/bin:$PATH" pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(gh *)" "Bash(git *)" --case 'propose-*'
```

`propose-naming-rule` adds to `propose-from-issue` a `rules.proposal` entry naming Changes `v3-<N>-<slug>`, and grades that the Change opens as `v3-42-*` after the skill read `openspec/config.yaml`.

A case that reads issues writes `.git/bdk-eval/issues/<n>.json` with the fields of `gh issue view --json` (`number`, `title`, `body`, `labels`, `state`, `url`) and copies the stand-in the same way.

The `e2e-check-*` cases run the product of the scaffolded project as a user would, through commands the skill cannot know in advance, so they need `Bash` itself; the sandbox still confines every command to the run's workspace. They grade paths the tester derives from the proposal of the tally Change (`fixtures/tally-cli.sh`): `e2e-check-cli-broken` a broken empty-ledger path and an internal proposal line left out, `e2e-check-proposal-paths` a `--json` promise that only the proposal makes, `e2e-check-no-user-change` a refactor proposal that gives `SKIPPED`, `e2e-check-no-e2e` a project without a `tools.e2e` item. Path names are the tester's own, so the graders read `verdict.md` lines (`- <result>: <path> (<kind>, proposal.md:<line>) - <file>`) rather than file names. `--trust-plugin` lets the run start without a terminal:

```bash
pnpm --filter @bdk/bdk run eval --trust-plugin --allow-tools Write Bash --case 'e2e-check-*'
```

The `commit-*` cases run `git` and grade `.git/COMMIT_EDITMSG` and `.git/logs/HEAD`, which their scaffolds clear (on a Mac, see the `git` entry of "Host limits"); the `adr-*` cases need only `Write` and `Edit`:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(git *)" --case 'commit-*'
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit --case 'adr-*'
```

The `plan-draft-*` and `verify-plan-*` cases start from the shared fixture `ledger-change.sh` (a configured project with the Change `add-csv-export` ready to plan) and call `bdk plan check`; `verify-plan` runs in a `bdk:verifier` agent (opus):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" --case '*plan-*'
```

The `*-rules` cases (`design-draft-rules`, `verify-design-rules`, `plan-draft-rules`, `verify-plan-rules`) declare a project rule of stage `design` (`IO-1`) or `plan` (`API-DOC-1`) in the scaffold's `.bdk/settings.yaml`, on the ledger fixtures, and grade that the draft follows and names it and that the verifier fails a design or a part that breaks it. They need the grants of both block groups (on a Mac, see "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(npx -y lavish-axi *)" "Bash(git *)" --case '*-rules'
```

Recorded 2026-10-09: `design-draft-rules` Δ 0.00 (the baseline reads the rule from the settings too), `plan-draft-rules` Δ +0.11, `verify-design-rules` and `verify-plan-rules` Δ +1.00; the archived Change `v3-272-rules-config` (design D8) holds the reading.

The `spec-conformance-*` cases start from the shared fixture `tally-change.sh` (the Change `add-total` on its branch, with `main` as the base and a main spec to merge into); each scaffold adds one commit with what it tests. The block runs in a `bdk:verifier` agent (opus), reads `git diff` against `main` and writes `close/spec-conformance.md` (on a Mac, see the `git` entry of "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" "Bash(git *)" --case 'spec-conformance-*'
```

Three block cases check the spec check inside a review round (#265) on the shared fixture `tally-ledger-path.sh`: `tally-change.sh` plus one commit with the two defects close found in run 1 of the B1 measurement after every review round had passed them (archived Change `v3-208-measure-speed-b1`, design D6). The proposal asks for a one-line error on a bad amount and for a ledger file chosen by `TALLY_LEDGER`, absolute or relative; the delta documents `TALLY_LEDGER` with a relative-path scenario only and lists no error; the code prints `tally: not an amount: <text>` and joins `TALLY_LEDGER` to the current directory. `spec-conformance-round` runs the block with `--round` and grades both findings in `round-1/findings.jsonl`, the round's report and no `close/spec-conformance.md` (it is also matched by `'spec-conformance-*'` above); `judge-spec-conformance` grades both findings `blocker`; `plan-fixes-spec-delta` grades a fix part on the spec delta, one on `bin/tally.js`, and nothing under `## Not planned`. Their grants are those of the `spec-conformance-*`, `judge-*` and `plan-fixes-*` cases:

```bash
for c in spec-conformance-round judge-spec-conformance plan-fixes-spec-delta; do
  pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" "Bash(git *)" --case "$c"
done
```

Two part cases build such a fix, on the shared fixture `tally-spec-fix-part.sh`: `tally-ledger-path.sh` plus round 1 with the error-message finding decided `fix` and fix part `01` in `round-1/fixes/parts/`, whose one task adds the error to the delta and is verified by the next round's spec check. `implement-part-spec-delta` grades `Status: done` (not a plan defect), the error in the delta and `bin/tally.js` unchanged; `conform-part-spec-delta` starts with the part built and an implementer report with no test and grades `Verdict: PASS`. They take the grants of the `*-part-*` cases above and are matched by `'*-part-*'`.

Recorded 2026-10-09 (Claude Code 2.1.295, 3 runs per arm): `spec-conformance-round` WITH 1.00, W/OUT 0.61, Δ +0.39; `judge-spec-conformance` 1.00, 0.25, +0.75; `plan-fixes-spec-delta` 1.00, 0.20, +0.80; $5.15 in all; `implement-part-spec-delta` 1.00, 0.50, +0.50 and `conform-part-spec-delta` 1.00, 0.00, +1.00, $2.96, both 1.00 also on the skills of `staging/v3` (regression cover, no skill change). Before the change (the skills of `staging/v3`, one run each, with the plugin) they scored 0.71 (no round report, a close report written), 0.80 (the error message `should-fix`) and 0.67 (the spec-delta fix `Not planned`); the archived Change `v3-265-spec-conformance-in-review` holds the design.

The `implement-part-*` and `conform-part-*` cases start from the shared fixtures `ledger-planned.sh` (the Change `add-csv-export` with its two verified plan parts) and `ledger-implemented.sh` (part 01 built and left uncommitted, with the implementer's report, as the execute lead hands it to `conform-part`). The blocks run in a `bdk:implementer` or `bdk:conformer` agent (sonnet), edit the part's files, run the checks through `bdk check run`, read the diff with `git status` and `git diff`, and create the run directory with `mkdir -p` (on a Mac, see the `git` entry of "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(mkdir -p *)" "Bash(cd *)" "Bash(git *)" --case '*-part-*'
```

`resolve-conflict-two-functions` starts from the shared fixture `ledger-totals-planned.sh` (the Change `add-totals`: two `worktree` parts in one wave that both add a function at the end of `src/ledger.js`) with both parts committed on their branches, part 01 merged and the merge of part 02 stopped on the conflict. The block runs in a `bdk:implementer` agent, reads the merge with `git`, runs the checks through `bdk check run` and leaves the merge open:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(mkdir -p *)" "Bash(git *)" --case 'resolve-conflict-*'
```

`resolve-conflict-wave` starts from `ledger-dated-merged.sh` (the Change `dated-entries`: part 01 makes `balance()` reject an entry without a date, part 02 adds a summary whose test builds undated entries; both green alone, committed on `dated-entries`, with a red `checks/wave-1.json`) and grades the wave repair: the summary test dated, part 01's rule kept, `execute/wave-1.md` written, the checks green and nothing committed.

The `execute-*` cases are the orchestrator cases of `/bdk:execute` (one arm), on the same fixture. One `bdk:lead` agent runs the parts in git worktrees under `.bdk/runs/add-totals/worktrees/`, starts `bdk:implementer` and `bdk:conformer` agents (sonnet) that work there through `cd <worktree> && ...`, commits, merges and runs `resolve-conflict`; `execute-plan-defect` makes task 1 of part 02 contradict its scenario. `execute-single-part-wave` starts from `ledger-totals-three-parts.sh`, which adds part 03 depending on both, so the waves are `1: 01 02` and `2: 03`: it grades worktrees for 01 and 02 only and part 03 committed on `add-totals` with no merge of a part-03 branch. `execute-resume-worktree` and `execute-resume-main-checkout` start from `ledger-totals-two-merged.sh` (01 and 02 built on `add-totals`) and leave part 03's test in a worktree from a broken run, or uncommitted in the main checkout after a blocked attempt: the first grades that the worktree is reused and merged, the second that the lead does not stop on the uncommitted test and builds 03 in the main checkout. The fixtures set a local git identity for the lead's commits (on a Mac, see the `git` entry of "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit SendMessage ToolSearch "Bash(*/bin/bdk *)" "Bash(mkdir -p *)" "Bash(cd *)" "Bash(git *)" --case 'execute-*'
```

`execute-one-part` starts from `ledger-planned.sh` and calls `/bdk:execute` with the arguments `add-csv-export 01`: it grades that the stage lists the plan parts, starts no agent and writes nothing (`writes-nothing`), and that the reply names `/bdk:implement-part add-csv-export 01` for the part and `/bdk:execute add-csv-export` for the whole plan (#343). The routing the other way, a prompt about one part reaching `implement-part`, is graded by the `skill-fired` grader of `implement-part-csv`. Recorded 2026-10-09 with Claude Code 2.1.292 (`--ablation none`, with the `git` entry of "Host limits"): before the fix `execute-one-part` scored 0.40 (the stage built the whole plan); after it, `execute-one-part` 1.00 in 3 of 3 runs and `implement-part-csv` 1.00 in 6 of 6 runs, each invoking `implement-part`; `execute-single-part-wave` stayed 1.00.

`execute-wave-check` starts from `ledger-dated-merged.sh` without its wave check result: both parts done and committed, wave 1 `pending`, as a run that ended before its wave check leaves it. It grades that the lead resumes at the wave check, repairs the wave, commits the repair, records wave 1 `done` in `state.json` and lists it under `## Waves` in `execute/result.md`. It does not start from `ledger-dated-planned.sh`: there the implementer of part 02 may read part 01's rule in the Change and date its test, so the wave check passes the first time and the repair is not reached.

Recorded 2026-10-09 with Claude Code 2.1.292 (one run each, `-j 3`, with the `git` entry of "Host limits"): every `execute-*` case 1.00, each starting one `bdk:lead` and its workers, 369 s, $4.44 in total.

The review stage cases start from the `monthly-report` fixtures. `plan-fixes-judged-round` (block) records the triage decisions of the judged round and grades the fix part `round-1/fixes/parts/03.md` and `fixes/index.md`; `triage-last-round` (block) runs triage with `--last-round` in auto mode and grades that the `should-fix` finding is deferred. The orchestrator cases of `/bdk:auto-review` run one arm: `auto-review-first-round` runs round 1 end to end (a `bdk:lead` with `review-round`: reviewers and `bdk check run`, then `spec-conformance --round` on an opus `bdk:verifier`, the integration reviewer on opus and the E2E tester together, then the judge) and stops at manual triage with the `lavish-axi` stub of the `triage-*` cases; its grader `workers-foreground` fails when an `Agent` call of the lead starts a worker without `run_in_background: false` (a `tool_used` with `max: 0` whose `input_match` names the worker and rejects the field, #326), and `verifier-in-round` and `conformance-written` that the round ran the spec check (#265); its grader `integration-with-e2e` fails unless the lead's `bdk:integration-reviewer` and `bdk:e2e-tester` calls carry the same assistant message id in the trace, so the integration reviewer never waits for the E2E tester (#263; recorded 2026-10-09 with Claude Code 2.1.292, `--ablation none`: `auto-review-first-round` 1.00 in 3 of 3 runs with it, `auto-review-fix-round` 1.00 in 3 of 3, $7.27 in all); its grader `verifier-with-integration` does the same for the `bdk:verifier` and `bdk:integration-reviewer` calls, so neither the integration reviewer nor the E2E tester waits for the verifier, whose output they do not read (#370; recorded 2026-10-10 with Claude Code 2.1.292, clean `HOME` and the `git` entry of "Host limits": on the skills of `staging/v3` with the grader copied in, 0.94 with only that grader red, the verifier started with the reviewers; after the change 1.00 in 2 of 2 runs, $2.55); `auto-review-fix-round` starts from the judged round in auto mode with a budget of two rounds in `.bdk/settings.local.yaml` (so the tree stays clean and round 1's recorded head stays `HEAD`), plans the fixes, builds them in a `bdk:lead` with `execute-waves --parts`, and grades that round 2 covers only the files of the fix commits and, since the fix changed `src/parse.js`, runs the E2E check again; `auto-review-test-only-fix` starts from a judged round whose E2E check passed and whose only finding to fix is a test gap, adds a `cli` e2e item, and grades that round 2, whose fix commit changes only `src/parse.test.js`, records `testsOnly`, writes no `round-2/e2e/` and says in `round.md` that round 1's verdict is carried over; its grader `result-agrees` requires `review/result.md` to follow its own round lines (`Status: done` with no `fix` decision on the line of round 2, `Status: blocked` with one), whether or not round 2 logs the seeded cents bug (#367). Recorded 2026-10-10 with Claude Code 2.1.292 (#367; clean `HOME` and the `git` entry of "Host limits"): before the skill change the main session named the seeded parse bug in its reply as "a likely bug no reviewer logged" after `plan-fixes` had read `src/parse.js`, and in 1 of 3 runs the fix-pass lead chained `bdk plan check ...; echo` into one refused Bash call, so no round 2 ran (0.80 over 3 runs); after it (`auto-review` takes no defect from code it read, `bdk:lead` runs single commands) `auto-review-test-only-fix` scored 1.00 in 3 of 3 runs ($5.19), each with the seeded bugs logged in round 2 and `Status: blocked`; `review-integration-outside-fix-scope` WITH 1.00 / W/OUT 0.67 (Δ +0.33, 3 runs per arm; the plain arm fails the seam grader in 3 of 3 runs), `review-integration-seam` WITH 1.00 / W/OUT 0.50. The orchestrator cases run several agents each; expect minutes and a few dollars per run:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" --case 'plan-fixes-*'
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" "Bash(npx -y lavish-axi *)" --case 'triage-last-round'
pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit SendMessage "Bash(*/bin/bdk *)" "Bash(mkdir -p *)" "Bash(cd *)" "Bash(git *)" "Bash(npx -y lavish-axi *)" --case 'auto-review-*'
```

A review finding that asks for a missing test of behaviour the code already has (#346) runs on the shared fixture `tally-total-untested.sh`: `tally-change.sh` with the BDK schema on `main`, plan part 01 of `add-total` committed with a test of "Total of added amounts" only, and review round 1 judged and triaged, one `should-fix` finding "Spec scenario Empty ledger has no test" decided `fix`; `tally total` already prints `Total: 0.00` for an empty ledger. `plan-fixes-present-behaviour` (block) grades that fix part 02 lists the scenario with ` (behaviour present)` and no code file; `implement-part-present-behaviour` (block) starts from that part written and grades `Status: done`, a passing red run `checks/02-red.json` and the report line ending `; green at first run (behaviour present); green seen`; `auto-review-present-behaviour` (orchestrator, the acceptance signal) runs `/bdk:auto-review` from the triaged round with a budget of two rounds and grades that the lead builds and commits part 02 (`fixes/state.json` `done`, `fixes/result.md` `Status: done`) and round 2 runs. The grants are those of the `*-part-*` cases and of `auto-review-fix-round` (on a Mac, see the `git` entry of "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(mkdir -p *)" "Bash(cd *)" "Bash(git *)" --case '*-present-behaviour'
pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit SendMessage "Bash(*/bin/bdk *)" "Bash(mkdir -p *)" "Bash(cd *)" "Bash(git *)" --case 'auto-review-present-behaviour'
```

Recorded 2026-10-09 with Claude Code 2.1.295 (on a Mac with the `git` entry of "Host limits"): before the skill change `plan-fixes-present-behaviour` scored 0.71 (no marker) and `implement-part-present-behaviour` 0.71 (no red run, a free-form report line); after it, `plan-fixes-present-behaviour` WITH 1.00 / W/OUT 0.00 (Δ +1.00, 3 runs per arm), `implement-part-present-behaviour` 1.00 in 3 of 3 runs (`--ablation none`; W/OUT 0.33), `auto-review-present-behaviour` 1.00 in 3 of 4 runs (about $1.20 and 2.5 minutes each); in the fourth (0.25) the main session stopped after `plan-fixes` had written the marked part, because the run refused its Bash calls (its reply named "don't-ask mode"), so no fix pass started; `implement-part-csv`, `implement-part-plan-defect` and `implement-part-model-effort` stayed 1.00 (3 runs each), `plan-fixes-judged-round` 1.00 (2 runs); #264's `auto-review-test-only-fix`, also a test of present behaviour, built and committed its fix part in 2 of 2 runs (0.89 each: its `reply` grader failed because the main session reported the stage blocked over the seeded `monthly-report` cents bug that round 2 did not log).

The design-block cases (`explore-*`, `design-draft-*`, `verify-design-*`) start from the fixtures `ledger-proposal.sh`, `ledger-explored.sh` and `ledger-designed.sh`, and need the `bdk` launcher, OpenSpec, `git`, the Lavish CLI, and `SendMessage` and `ToolSearch`, with which the main thread continues the `bdk:designer` agent after its questions. `design-draft-lavish` and `design-draft-ask` put a `lavish-axi` stub into the workspace's `node_modules`, which `npx -y lavish-axi` runs before any installed one: the first opens every page and answers the poll, the second fails as a session without a browser does. `AskUserQuestion` is not available in a run, so `design-draft-ask` grades the questions in the reply. The designer opens the page and hands back, and the main thread polls it: `design-draft-lavish` grades that order. It and `triage-lavish` also grade that no Bash call chains a Lavish command with another (`lavish-own-command`): the grant `Bash(npx -y lavish-axi *)` does not cover `npx -y lavish-axi <page>; echo $?`, and a run denies it (#298). `design-draft-follow-up-round` and `design-draft-scope-narrowed` put a stub into `node_modules` whose first poll answers with notes that open new decisions, and whose poll of a later page (`design-add-csv-export-2.html`) answers those: the first grades a second round that asks only the new decision, the second that an answer dropping a capability moves it to Out of scope of `proposal.md` and that an answer against the `CLAUDE.md` rule of the scaffold is asked again and recorded as a `Deviation:`. `explore-cli-options` adds an upload CLI whose options only its packed `--help` text names, so it also needs that command:

```bash
for c in "explore-*" "design-draft-*" "verify-design-*"; do
  pnpm --filter @bdk/bdk run eval --allow-tools Write Edit SendMessage ToolSearch "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(npx -y lavish-axi *)" "Bash(git *)" "Bash(node bin/upload.js --help)" --case "$c"
done
```

`design-fresh-auto-gate` and `design-manual-gate-no-ask` also grade that the blocks start in the foreground (`run_in_background: false`), and `design-manual-gate-no-ask` that its reply ends on one question.

The `design-*` cases are the orchestrator cases of `/bdk:design` (`tags: [orchestrator]`, one arm). They start from the same ledger fixtures, run the design blocks inside one run (a `bdk:explorer` and an opus `bdk:verifier` agent), and need the grants of the design blocks:

```bash
pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit SendMessage ToolSearch "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(npx -y lavish-axi *)" "Bash(git *)" --case 'design-*'
```

`--case 'design-*'` alone also matches the `design-draft-*` block cases; `--tag orchestrator` keeps only the orchestrator ones.

The `plan-fresh`, `plan-resume-after-fail`, `plan-budget-spent` and `plan-verify-written` cases are the orchestrator cases of `/bdk:plan` (one arm). They start from the shared fixture `ledger-change.sh`, reuse the part sets of the `plan-draft-*` and `verify-plan-*` cases, run `plan-draft` and an opus `bdk:verifier` inside one run, and need the grants of the plan blocks:

```bash
pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit "Bash(*/bin/bdk *)" --case 'plan-*'
```

`--case 'plan-*'` alone also matches the `plan-draft-*` block cases; `--tag orchestrator` keeps only the orchestrator ones.

Two more `plan-*` cases cover the runs that end without a verifier pass. `plan-design-gap` adds a requirement to the spec delta that the design does not settle (`ledger export <file> --out <path>`, nothing about an existing `<path>`): `plan-draft` drafts what it can and names the gap, and `/bdk:plan` stops before any verifier and names `/bdk:design add-csv-export`. `plan-passed` starts from the hand-written plan of `plan-verify-written` with a passing `plan/verify-1.md` (kept in the case directory): no block runs, one `bdk plan check` gives the waves, nothing is written, and the reply names `/bdk:execute add-csv-export`; it is tagged `writes-nothing` (see "Write a case").

Recorded 2026-10-09 (clean `HOME`, the command above): `plan-design-gap` 1.00 over 4 runs, `plan-passed` 1.00 over 3 runs, both about $0.12 to $0.50 a run. The first runs of `plan-design-gap` showed `plan-draft` calling the existing file "not touched by any requirement"; its gap rule was sharpened (archived Change `v3-249-plan-gap-evals`, design D5). Runs below 1.00 of the other `plan-*` cases in the same measurement came from denied Bash calls: a `bdk` call with `; echo exit=$?` after it, or a verifier chaining `cd`, `ls` and `bdk plan check` into one command, which the grant denies as a whole. The check block and `bdk:verifier` now run each `bdk` call as a Bash command of its own, and `plan-fresh` and `plan-model-effort` hold the grader `no-denied-call` (archived Change `v3-342-plan-evals-permission-denials`). Recorded 2026-10-09 after that fix: every `plan-*` orchestrator case 1.00 over 3 runs, 353 s with `-j 4`, $8.88 in total.

The `close-*` cases are the orchestrator cases of `/bdk:close` (one arm). They start from the shared fixture `tally-reviewed.sh`: the Change `add-total` after review, a bare repository `.git/bdk-eval/remote.git` inside the workspace as `origin`, so `git push` works offline, and the offline `gh` stand-in, which records `gh pr create` in `.git/bdk-eval/prs/<n>.json` and answers `gh pr view` from there. Put its directory first on `PATH` as for the `propose-*` cases; the run starts an opus `bdk:verifier` and runs `commit` (on a Mac, see the `git` entry of "Host limits"):

```bash
PATH=".git/bdk-eval/bin:$PATH" pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(gh *)" "Bash(git *)" --case 'close-*'
```

The `run-*` cases are the orchestrator cases of `/bdk:run` (one arm). `run-two-prs`, `run-resume` and `run-waiting-blocker` start from the shared fixture `tally-queue.sh`: `tally-reviewed.sh` plus a second reviewed Change `add-count` on its own branch from `main`, the records of the stages before review for both Changes (so `bdk run status` puts them at `close`), issues 1 and 2 for the offline `gh` stand-in, and `.bdk/runs/run.json` queueing both. `run-resume` closes `add-total` and archives `add-count` in its scaffold; `run-waiting-blocker` replaces the second entry with a Change of issue 2 blocked by `add-total` and not started. `run-queue-from-issues` starts from `tiny-ledger-bdk.sh` with a bare `origin` and two issues, 1 blocked by 2, and stops at the manual design gate of the first Change, so it runs `propose` and the design blocks (an opus `bdk:verifier`). Put the stand-in first on `PATH` as for the `close-*` cases (on a Mac, see the `git` entry of "Host limits"):

```bash
PATH=".git/bdk-eval/bin:$PATH" pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(gh *)" "Bash(git *)" --case 'run-*'
```

Recorded 2026-10-08: every `run-*` case 1.00 over 3 runs, 392 s with `-j 4`, $9.35 in total.

The `pr-review-*` cases are the orchestrator cases of `/bdk:pr-review` (one arm). They start from the shared fixture `monthly-report-pr.sh`: the `monthly-report` Change with its two seeded bugs as pull request 7 of a bare `origin` inside the workspace (`refs/pull/7/head`), the user's checkout on `main`, and the offline `gh` stand-in, which answers `gh pr view 7`, `gh repo view` and `gh api user`, and records a posted review in `.git/bdk-eval/reviews/7-<k>.json`. One `bdk:lead` fetches the head into `.bdk/runs/pr-7/worktree`, records the groups and runs the review blocks there (two `bdk:reviewer`, an opus `bdk:integration-reviewer`, a `bdk:judge`). `pr-review-post` asks to post without a question; `pr-review-confirm` does not, and grades that nothing is posted. `pr-review-verify` starts from `monthly-report-pr-reviewed.sh`: the same pull request with an earlier review of the eval user recorded as `7-1.json` (inline `blocker` threads `PRRT_7_1_1` on `src/parse.js` and `PRRT_7_1_2` on `src/report.js`, which the stand-in answers to `gh api graphql`) and a new head commit that fixes only the parse bug; the lead seeds both findings, reviews the commit since the reviewed head (group `p01` in `round-1/groups.json`, without the Change's proposal) and judges the round, and the case grades that the verify review `7-2.json` requests changes and that only `PRRT_7_1_1` is in `.git/bdk-eval/resolved.json`. `pr-review-verify-regression` starts from `monthly-report-pr-regressed.sh`, which adds to it one more commit that fixes the report blocker but makes `monthlyTotals` keep only the last entry of each month (its rewritten test has one entry per month); it grades both threads resolved, `REQUEST_CHANGES` and an inline `kind=finding` comment on `src/report.js` in `7-2.json`, and the group `p02` recorded for the commits since the review. `pr-review-verify-force-push` starts from `monthly-report-pr-force-pushed.sh`, which squashes the pull request of `monthly-report-pr-reviewed.sh` into one commit on its merge base and force-pushes it, so the reviewed head is no longer in its history (it stays in the object store, so `git merge-base --is-ancestor` exits 1): it grades that `round-1/groups.json` starts at the merge base (it holds the Change's proposal), that `7-2.json` says `Reviewed the whole pull request` and requests changes, and that only `PRRT_7_1_1` is resolved. `pr-review-verify-no-new-commit` starts from `monthly-report-pr-verified.sh`, which records a first verify review `7-2.json` at the current head (parse fixed and `PRRT_7_1_1` resolved, the report finding left): it grades an empty `groups.json`, no `bdk:reviewer` or `bdk:integration-reviewer` Agent call, a `bdk:judge` that keeps the report finding `blocker`, and a verify review `7-3.json` that requests changes and says `Reviewed no new commits`. `pr-review-several` starts from `monthly-report-two-prs.sh`, which adds a correct one-line README pull request 8, and grades one lead per pull request, `REQUEST_CHANGES` on 7 and `APPROVE` on 8 (on a Mac, see the `git` entry of "Host limits"):

```bash
PATH=".git/bdk-eval/bin:$PATH" pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --allow-tools Write Edit "Bash(*/bin/bdk *)" "Bash(gh *)" "Bash(git *)" "Bash(cd *)" "Bash(mkdir -p *)" --case 'pr-review-*'
```

Recorded 2026-10-09 with Claude Code 2.1.295 (`--ablation none`, 3 runs each, `-j 3`, clean `HOME` and the `git` entry of "Host limits"; #290): `pr-review-verify-force-push` 1.00 in 3 of 3 runs ($1.13 to $1.24 per run, 210 s wall clock for the three), `pr-review-verify-no-new-commit` 1.00 in 3 of 3 runs ($0.62 to $0.64, 106 s), `judge-previous-repeat` 1.00 in 3 of 3 runs ($0.25 to $0.29, 26 s).

The `diagnose-bug-*` and `debug-*` cases start from the shared fixture `tally-bug.sh`: the configured tally CLI on `main` with its main spec `tally`, a `cli` e2e item, a local git identity, no open Change, and one seeded bug (`tally add` stores the text it was given, so `tally total` after an add crashes). The prompts name the fix Change `fix-total-crash`, so the graders read its files by path. `diagnose-bug` reproduces the bug through commands the skill cannot know in advance, so the cases need `Bash` itself, as the `e2e-check-*` cases do. The block cases grade the reproduction, the fix Change and that no code was edited; `diagnose-bug-related-defect` gives a report whose user already has ledgers with text amounts and grades that the part keeps the reproduction as its only acceptance scenario, the spec delta holds no scenario for those ledgers, and `diagnosis.md` names them on a `Related:` line (#359); `debug-fix` (orchestrator, both gates `auto`, `execution.lead: foreground`) runs the whole fix - `diagnose-bug`, `commit`, `execute` with a `bdk:implementer` and a `bdk:conformer`, and `auto-review` with reviewers, the E2E tester, an opus integration reviewer and the judge - and is the acceptance signal of `/bdk:debug`; `debug-manual-gate` grades that the default gate asks before anything is committed or built; `debug-too-large` sets `plan.part.max-files: 1`, so the fix (code and test) does not fit one part, and grades that `diagnose-bug` writes the Change without a plan part (`Status: too-large`) and the run stops naming `/bdk:design fix-total-crash` with nothing committed or built; `debug-resume-review` starts from `diagnose-run.sh` without the review's files (the fix built and committed, `execute/result.md` `Status: done`) and grades that `/bdk:debug fix-total-crash` starts at `auto-review` and runs neither `diagnose-bug` nor `execute`. The `test-red-then-green` grader of `debug-fix` requires every acceptance line of `execute/part-01.md` to end exactly `; red seen; green seen`: a note there means a red the implementer did not see (#262). Expect `debug-fix` to take tens of minutes and a few dollars per run (on a Mac, see the `git` entry of "Host limits"):

```bash
pnpm --filter @bdk/bdk run eval --trust-plugin --allow-tools Write Edit Bash --case 'diagnose-bug-*'
pnpm --filter @bdk/bdk run eval --trust-plugin --ablation none --tag orchestrator --allow-tools Write Edit Bash SendMessage --case 'debug-*'
```

Recorded 2026-10-09 (Claude Code 2.1.292, `-j 4`): `debug-fix`, `debug-manual-gate`, `debug-too-large` and `debug-resume-review` 1.00 over 3 runs each, 420 s and $10.44 in all; the archived Change `v3-262-debug-evals` (design.md, "Measurements") holds the rounds before and what each miss was.

The `diagnose-run-*` cases start from the shared fixture `diagnose-run.sh`: `tally-bug.sh` after one recorded `debug-fix` run (Claude Code 2.1.295, 14m00s, host cost $1.78), its two commits on the branch `fix-total-crash`, its run files in `.bdk/runs/fix-total-crash/`, and the session's transcripts in `.git/bdk-eval/transcripts/` (the main transcript and 9 subagents). The prompt names that directory, as a user names copied transcripts. `diagnose-run-fixture` grades the report `.bdk/runs/fix-total-crash/diagnostics.md` against the ground truth in the archived Change `v3-322-run-diagnostics` (design.md, "Measurement"): the stage order, every agent id, the host cost, the review lead's wall time, and the review lead's 9-minute polling loop cited by its transcript line; `diagnose-run-missing-transcript` removes the judge's `.jsonl` (its `.meta.json` stays, as when the host keeps no transcript, #157) and grades that the judge is named missing and every other agent still listed. The analyst only reads and writes the report, so the cases need `bdk` and `Write`:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" --case 'diagnose-run-*' --ablation none
```

Recorded 2026-10-09 (sonnet analyst): both cases 1.00 over 3 runs, about 55 s and $0.33 a run; the plain skill without `bdk diagnostics report` scored 0.22, with no tokens or cost per stage or agent (the Change's "Measurement").

To record a new fixture run: run the `debug-fix` case with `--keep-temp`, or `/bdk:debug` with `claude --plugin-dir plugins/bdk` in a scratch copy of `tally-bug.sh`; then `node evals/fixtures/diagnose-run/trim.ts ~/.claude/projects/<project key> <session id> evals/fixtures/diagnose-run/transcripts <project root>` (it keeps every line, so citations still resolve, and empties thinking text, the host's context attachments, long tool output, and the recording machine's paths, user name and email addresses), copy `.bdk/runs/<change>/` into `diagnose-run/runs/` with the project root replaced by `/work/tally`, `git format-patch main` into `diagnose-run/patches/`, and update the ids and numbers in the graders, `tests/diagnostics-cli.test.ts` and the Change's ground truth.

The `*-model*` cases check that `models.<role>` reaches the `Agent` call of every stage that starts the role's agent (spec `bdk-cli/config`, "Every agent is a models role"): `design-models-per-role`, `plan-models-verifier` and `close-models-verifier` (orchestrators) and `explore-model-set`, `verify-design-model-set` and `spec-conformance-model-set` (blocks typed in the main thread) set `models.explorer.model` or `models.verifier.model` to `sonnet`; `design-draft-model-effort` and `implement-part-model-effort` (blocks) and `plan-model-effort` (orchestrator) set `model` and `effort` of `designer`, `implementer`, `planner` and `verifier`; `execute-escalation-model-effort` (orchestrator, on the `execute-*` fixture) sets `policy.budgets.part-attempts: 1`, so each part's only implementer run is the escalated one on `policy.escalation.model` and `policy.escalation.effort`, and `models.conformer.effort`. Each reuses the fixture of its stage's cases and writes the settings into the ignored `.bdk/settings.local.yaml`; a `tool_used` grader on `Agent` requires the `subagent_type` and the configured `"model"` and `"effort"` in the call's input, in any order. They ask whether the call carries the model, not whether the block changes the outcome, so one arm and one run are enough. The grants are those of the `close-*` cases, which cover the others (on a Mac, see the `git` entry of "Host limits"):

```bash
PATH=".git/bdk-eval/bin:$PATH" pnpm --filter @bdk/bdk run eval --ablation none --runs 1 --allow-tools Write Edit SendMessage ToolSearch "Bash(*/bin/bdk *)" "Bash(openspec *)" "Bash(gh *)" "Bash(git *)" "Bash(npx -y lavish-axi *)" "Bash(mkdir -p *)" "Bash(cd *)" --case '*-model*'
```

A grader on the order of Bash calls is a `regex` on the trace, not `tool_order`: the free check loads cases with the grants `Write Edit`, under which a `tool_order` naming Bash cannot pass.

`--case` takes one glob; a repeated `--case` keeps only the last.

### Manual browser check of `e2e-check`

No eval case covers the `browser` and `http` drivers: the run's sandbox refuses to bind a local port and finds no browser ("Host limits"). Check them by hand in projects built from the browser fixtures outside this repository, each with no Playwright of its own, so the tester installs the pinned one for the run:

```bash
mkdir -p /tmp/click-counter && cd /tmp/click-counter && bash <repo>/plugins/bdk/evals/fixtures/click-counter.sh
claude -p "Use the app the way a user would and check that change add-counter does what its spec scenarios say." --plugin-dir <repo>/plugins/bdk --permission-mode auto

mkdir -p /tmp/account-page && cd /tmp/account-page && bash <repo>/plugins/bdk/evals/fixtures/web-hard-defects.sh
claude -p "Use the app the way a user would and check that change add-account-page does what its spec scenarios say." --plugin-dir <repo>/plugins/bdk --permission-mode auto
```

Expected for `click-counter`: `.bdk/runs/add-counter/e2e/verdict.md` starts with `Verdict: FAIL`; `add-one.md` starts with `Result: fail` and its `## Evidence` lists `add-one-1.png` and `add-one.webm`, both next to it and not empty; one `e2e-check` finding for "Add one"; nothing listening on port 5180 afterwards, and no file outside `.bdk/runs/` in `git status`.

Expected for `account-page` (the three defects are described at the top of the fixture): `Verdict: FAIL`; `place-order-once.md`, `save-a-note.md` and `save-profile-on-a-narrow-screen.md` start with `Result: fail` and name, under `## Observed`, the two orders, the `Could not save` message and the element that covers "Save profile"; `no-orders-yet.md` starts with `Result: pass`; one finding per failed scenario, each scenario with a screenshot and a video; nothing listening on port 5182 afterwards.

## Write a case

One directory per case, `evals/<block>-<case>/`, where `<block>` is the skill's name:

```text
evals/<block>-<case>/
  prompt.md        frontmatter: tags, allowed_tools, max_turns, timeout_seconds; body: what a user would type
  case.yaml        only for context.scaffold_script (and plugins: for the sample); a timeout_seconds here is ignored
  scaffold.sh      builds the workspace, usually from a shared fixture
  graders/*.md     one grader per file
```

Write the prompt the way a user would ask, without naming the skill. Put `tags` in `prompt.md` as a flow list (`tags: [block]`); every case carries exactly one of `block`, `orchestrator`, `sample`.

- **Block case** (`tags: [block]`), run with and without the plugin: at least one grader on the result (`file_exists`, `regex` with `target: { source: file, path: ... }`, or a short `llm` rubric with concrete PASS and FAIL lines) and one on the steps (`tool_order` or `tool_used`), plus a `tool_used: Skill` grader that shows the block fired.
- **Orchestrator case** (`tags: [orchestrator]`), run with `--ablation none`: `tool_order` for the order of its blocks, `file_exists` for the files the run writes, `llm` for the outcome; time and turns come from the report.
- **Orchestrator case that writes nothing** (`tags: [orchestrator, writes-nothing]`): a run whose correct outcome is a stop before any block writes no file, so it holds no `file_exists` grader; a `regex` grader on the trace shows what did not happen instead (no `Write` or `Edit` call, no block started), next to its `tool_order` and `llm` graders. `plan-passed` is the example.
- Grade long output with `regex`, not `llm`: the judge's verdict varies more the longer the text.
- `file_exists` sees only files created during the run, not files the scaffold made.

`sample-handover-note` is a complete example: a plugin inside the case directory (a case may name a plugin only in its own subdirectory), the shared fixture, and one grader of each kind.

## Shared fixtures

A workspace used by more than one case is a script in `evals/fixtures/<name>.sh` that builds it in the current directory: files and git state only, no network, under 120 s. A case runs it from its own `scaffold.sh`, then adds what only it needs:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tiny-ledger.sh"
```

`claude plugin eval` runs the scaffold in place from the case directory, so the relative path holds. The scaffold gets only `PATH`, an empty `HOME`, `TMPDIR` and `TERM=dumb`; pass `-c user.name=... -c user.email=...` to `git commit`. Configuration it writes (`.claude/`, `CLAUDE.md`) is not loaded by the run.

### B1-sized fixture

The speed targets and the plan shape are measured on a Change the size of B1 (27 tasks, 62 files; architecture design, "Product requirements", Speed). Three shared fixtures hold one, in three states of the same project: the Node CLI `ledger` (a book in `ledger.json`, `add` and `balance`, 11 passing tests, its main spec), configured for BDK with a `node-test` test tool and a `cli` e2e tool, and the Change `add-household-book`, which grows it into a household book: accounts and transfers, categories and rules, CSV statement import, budgets and recurring entries, list and export, reports. Seven new capabilities and the modified `ledger`, 71 scenarios.

| Fixture | State | Start a run at |
|---|---|---|
| `household-book.sh` | proposal, spec deltas and design; `.bdk/runs/add-household-book/design/verify-1.md` (`FAIL`), `verify-2.md` and `verify-3.md` (`PASS`) and `gate.md` (`Gate: approved`, naming `verify-3.md`); no plan | plan |
| `household-book-planned.sh` | the same, plus the plan (7 parts, 27 tasks, 62 files, 3 waves: `01`, then `02`-`06`, then `07`) and `plan/verify-1.md` (`Verdict: PASS`), in one more commit | execute |
| `household-book-queued.sh` | the planned state, no further commit, plus a bare `origin` holding `main`, a local git identity, the offline `gh` stand-in at `.git/bdk-eval/bin/gh`, `.bdk/runs/run.json` queueing `add-household-book`, and `.bdk/settings.local.yaml` with both gates `auto`, `policy.questions: decide-and-record` and `execution.lead: foreground` | plan-to-PR, unattended (`/bdk:run`) |

The Change's markdown lives in `fixtures/household-book/` (`change/` mirrors `openspec/changes/add-household-book/`, `runs/` the approval records); the scripts copy it. Every approval report is what `verify-design` or `verify-plan` wrote on these files. `plugins/bdk/tests/household-book.test.ts` checks for free what the planned state must hold: `bdk plan check` passes with 7 parts in 3 waves, 27 tasks, 62 distinct files, every scenario named by exactly one part. After editing a part, a spec delta or the design, run it, and run the verifier again before replacing a report.

`verify-plan-household-book` runs `verify-plan` on the planned state (its scaffold removes the plan report), graded on `Verdict: PASS` and the `bdk plan check` line of the report; it is also the cheap probe that the scaffold builds in a run:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write "Bash(*/bin/bdk *)" "Bash(git *)" --case 'verify-plan-household-book' --runs 1 --ablation none
```

On a Mac it needs the clean `HOME` and the git shell prefix of "Host limits". Recorded 2026-10-08: score 1.00, 114 s, $0.77.

`plan-draft-household-book` runs `plan-draft` on the ready-to-plan state, with and without the plugin; it is where `plan-draft` shows what it adds over the BDK schema on a Change of this size (#242). Its graders cannot read every part, so keep each run's workspace and measure the parts there as well (`bdk plan check`, scenario ownership, a `/bdk:verify-plan` round); the archived Change `v3-242-measure-plan-draft` holds the method and the recorded result:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" --case 'plan-draft-household-book' --model sonnet -j 3 --keep-temp
```

Recorded 2026-10-08 (sonnet): WITH 1.00, W/OUT 0.80, Δ +0.20; with the plugin every plan keeps the part limits and 4 of 6 pass `verify-plan` first time, without it none does (part 01 over the limits every time).

`plan-draft-household-book-gap` measures the design-gap stop of `plan-draft` step 2 (#253). Its scaffold builds the ready-to-plan state and then opens one product choice in the Change: recurring days run from 1 to 31, and neither the specs nor the design say what an entry does in a month without its day; the edits are folded into the fixture's last commit. Its `gap-named` judge passes a reply that names the choice and leaves it undecided, and fails one that names it but writes a rule into a part. Whether a part decides it is read on the kept workspaces; the archived Change `v3-253-measure-plan-draft-gap` holds the method and the result:

```bash
pnpm --filter @bdk/bdk run eval --allow-tools Write Edit "Bash(*/bin/bdk *)" --case 'plan-draft-household-book-gap' --model sonnet -j 3 --keep-temp
```

Recorded 2026-10-08 (sonnet, $4.39): WITH 1.00, W/OUT 0.89, Δ +0.11 with the first rubric; read by hand, every run names the gap, but without the plugin every run also decides it in a part (skip the month once, clamp to the last day twice), with it none does. The gap rule is kept.

A case that plans, executes or times the Change uses the fixture from its own scaffold, as any shared fixture. By hand, build a workspace outside this repository and run the stage there:

```bash
mkdir -p /tmp/household-book && cd /tmp/household-book && bash <repo>/plugins/bdk/evals/fixtures/household-book.sh
claude -p "/bdk:plan add-household-book" --plugin-dir <repo>/plugins/bdk --permission-mode auto

mkdir -p /tmp/household-book-planned && cd /tmp/household-book-planned && bash <repo>/plugins/bdk/evals/fixtures/household-book-planned.sh
claude -p "/bdk:execute add-household-book" --plugin-dir <repo>/plugins/bdk --permission-mode auto
```

Set `LEDGER_TODAY=2026-10-08` when you drive the product by hand: the Change's scenarios count from that date.

Plan-to-PR runs from the queued state: `/bdk:run` without arguments takes the queue, creates the branch `add-household-book` from `origin/main` and runs execute, auto-review and close until the pull request is recorded in the stand-in. Put the stand-in's directory first on `PATH` by its absolute path (the lead and the agents work in other directories), and start from a plain terminal with a clean `HOME` ("Host limits"), so no other plugin, hook or global `CLAUDE.md` loads:

```bash
mkdir -p /tmp/household-book-queued && cd /tmp/household-book-queued && bash <repo>/plugins/bdk/evals/fixtures/household-book-queued.sh
PATH="$PWD/.git/bdk-eval/bin:$PATH" LEDGER_TODAY=2026-10-08 \
  claude -p "/bdk:run" --plugin-dir <repo>/plugins/bdk --permission-mode auto --output-format stream-json --verbose > run.jsonl
```

The archived Change `v3-208-measure-speed-b1` holds the method of the speed measurement (what is read from the stream, the transcripts and the run files) and the recorded result.

Recorded 2026-10-08 (main thread opus, agents as their files name): execute 7.8 min, review 11.6 min (two rounds), close 3.0 min; plan-to-PR 22.9 min of machine time, $7.42, against the targets of 15 and 45 min.

Recorded 2026-10-09 after #263 (Claude Code 2.1.295, same method): review round 1 took 192 s, its integration reviewer starting 3 s after the last group reviewer and in the same message as the E2E tester; round 2 228 s, set by its E2E tester (#264); the review stage 8.9 min, execute 6.2 min. The run stopped at close on `spec-conformance` (#265). The archived Change `v3-263-integration-reviewer-early` holds the per-worker times.

## Free check in CI

`plugins/bdk/tests/evals.test.ts` (part of `pnpm test`) loads every case with `claude plugin eval --max-cost-usd 0`, which checks the case files and the graders against the grants `Write Edit` but starts no run and needs no credential. It also runs every fixture and case scaffold as the harness does, and checks names and tags. Run it alone with `pnpm exec vitest run plugins/bdk/tests/evals.test.ts`.

## Host limits

Measured with Claude Code 2.1.292:

- **`bin/` is not on `PATH` in eval runs.** A skill that runs `bdk ...` by name, or a `!` block calling it, fails in a run although it works in a normal session. `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` in skill text is substituted and works in both.
- **Bash on a Mac with Docker Desktop.** Every Bash-granting run is refused while `~/.docker` holds symbolic links (Docker Desktop's `cli-plugins/` does). Run those cases with a clean `HOME` that keeps the login keychain:

  ```bash
  EVAL_HOME=$(mktemp -d) && mkdir -p "$EVAL_HOME/Library" && ln -s ~/Library/Keychains "$EVAL_HOME/Library/Keychains"
  HOME=$EVAL_HOME pnpm --filter @bdk/bdk run eval --allow-tools "Bash(git *)" Write --case '<case>'
  ```

- **`git` on a Mac without Homebrew git.** `git` fails in every run: `/usr/bin/git` is an `xcrun` shim that cannot write its cache in the sandbox, and the sandbox hides `/Library/Developer` from `PATH` lookup, while that git runs by its full path. `macos-git-prefix.sh` defines `git` as that full path for each Bash call; copied as `git` next to itself, it is also the `git` that git starts by name (a `git push` runs `pack-objects` and the remote's `receive-pack` that way). Pass it as Claude Code's shell prefix from a directory outside your home directory:

  ```bash
  mkdir -p /Users/Shared/bdk-eval/bin
  cp plugins/bdk/evals/macos-git-prefix.sh /Users/Shared/bdk-eval/bin/
  cp plugins/bdk/evals/macos-git-prefix.sh /Users/Shared/bdk-eval/bin/git
  CLAUDE_CODE_SHELL_PREFIX=/Users/Shared/bdk-eval/bin/macos-git-prefix.sh pnpm --filter @bdk/bdk run eval ...
  ```

  The prefix wraps every Bash call, the `!` blocks of a skill included, and the sandbox of a run denies reads under `/Users` except the directories on the caller's `PATH` (Claude Code 2.1.292 and 2.1.295 write `//Users` into `denyRead`). The `eval` script therefore puts the prefix's directory first on the run's `PATH`. A prefix the run cannot read fails every Bash call with `/bin/bash: <prefix>: Operation not permitted`, and a skill whose `!` block fails stops at once: on 2026-10-09 every `execute-*` case scored 0.13 to 0.42 for that reason alone, with no `bdk:lead` started (#313).
- **`openspec` from the workspace or the home directory.** The sandbox cannot read files under your home directory; it lets through the directories on `PATH`, but not what a file there points to. `pnpm run` puts `plugins/bdk/node_modules/.bin` first on `PATH`, and its `openspec` is a shim into `node_modules/.pnpm/`, so with a checkout under your home directory every call fails with `Cannot find module .../node_modules/.pnpm/@fission-ai+openspec@1.13.2.../bin/openspec.js` (`propose-from-issue` scored 0.22). The `eval` script removes those directories from `PATH`, so a run finds your global `openspec`; one installed under your home directory (nvm) fails the same way. Install it outside, or run with the clean `HOME` of the Docker entry, under which the sandbox reads your real home directory. An `openspec` that hangs instead, even `openspec --version`, is the overloaded host of the next entry.
- **An overloaded host stalls every process of a run.** Measured 2026-10-09 (#341): in one of three `debug-fix` runs every `openspec` call hung until killed, `openspec --version` included, and `diagnose-bug` stopped `Status: blocked`. OpenSpec was not the cause: four other agent sessions were installing packages, serving VitePress, driving Chrome and running evals on the same machine, and every process slowed down, outside the sandbox too. The run's transcript (`config/projects/*/*.jsonl` of a `--keep-temp` workspace) shows it: the plugin's `PreToolUse` hook, about 100 ms in a healthy run, takes seconds or hits its 10 s timeout (`"hookName": "PreToolUse:Bash"`, `durationMs`, `timedOut`), and plain commands such as `ls` take tens of seconds. A Node program that loads many modules, as `openspec` does, then outlasts the Bash timeout. Start paid runs on an otherwise idle machine, keep `-j` at 3 or below, and re-run a run that shows this instead of reading its score; on an idle machine `diagnose-bug-reproduced` called `openspec` 5 to 8 times in each of 9 runs at `-j 3`, every call within 2 s.
- **npm's update check reaches the registry.** Every `npm` or `npx` command checks for a newer npm when its cache holds no check from the last week, as under the clean `HOME` of the Docker entry. The sandbox denies that request and Claude Code appends `<sandbox_violations> deny network-outbound registry.npmjs.org:443` to the command's output although the command worked, here the `lavish-axi` stub that `npx -y` finds in the workspace's `node_modules/.bin` without the registry. On 2026-10-09 the model read that line as a failure, ran the stub again as `npx -y lavish-axi <page>; echo "exit=$?"`, which the grant does not cover, and `design-draft-lavish` scored 0.47 (#298). The `eval` script therefore starts the runs with `npm_config_update_notifier=false`; set it yourself when you start `claude plugin eval` another way.
- **`PATH` leaks from the caller.** A run inherits the `PATH` of the shell that starts it, including the `bin/` of plugins of a Claude Code session the command runs in. Start paid runs from a plain terminal; an agent starts them in a terminal pane it opens for that, since the permission layer of its own Claude Code session may refuse a nested `claude plugin eval`.
- **Background tasks end 10 minutes after the last turn.** Claude Code 2.1.294 in `claude -p` stops a background agent that still runs 10 minutes after the main thread's last turn ("Background tasks still running 10m after the last turn ...; stopping them"). A review round runs longer, so the `auto-review-*` cases set `execution.lead: foreground` in `.bdk/settings.local.yaml`.
- **No Artifact tool, no project configuration.** A run cannot publish artifacts and loads no `CLAUDE.md`, `.claude/` or `.mcp.json`; ship what a case needs in the plugin.
- **No local server, no browser.** Measured with Claude Code 2.1.292: a Bash-granting run cannot bind a local port (`listen EPERM: operation not permitted 0.0.0.0:5180`), so a case cannot start a web app or an HTTP API. It also cannot launch a browser: Playwright looks for its browsers under the run's own `HOME`, and the system Chrome fails with `Failed to create a ProcessSingleton for your profile directory`. `e2e-check` then reports `Verdict: BLOCKED`, as it should; its browser path is checked by hand (see "Manual browser check of `e2e-check`").
