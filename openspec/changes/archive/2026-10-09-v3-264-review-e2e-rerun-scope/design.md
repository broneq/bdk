## Context

`review-round` (#201) runs the E2E check in every round (step 4): "The E2E check runs in every round, also one with no group." Since #321 the check drives up to 5 paths per user process the proposal adds or changes, writes `round-N/e2e/<process>--<path>.md` and `verdict.md`, and adds a finding per failed path. A round after the first reviews only the commits of the previous round's fix pass (`bdk git groups --rounds`, anchor `kind` `round`).

Readers of the E2E files: `review-round` (first line of `round-N/e2e/verdict.md` into `round.md`), `/bdk:close` and `/bdk:spec-conformance` (the `verdict.md` modified last among `e2e/` and every `review/round-*/e2e/`). The judge, triage and `plan-fixes` read findings, not the E2E files.

The #208 measurement (archived `v3-208-measure-speed-b1`, design "Measurement") on the B1-sized Change (`household-book`, 7 parts, 62 files): both runs fixed round 1 with test files only, and round 2 re-ran all 71 scenarios (85 s, 102 s), its longest worker, finding nothing.

## Goals / Non-Goals

**Goals:**

- A later round whose fix commits cannot change what a user observes runs no E2E check, and says why.
- Any fix that can change the product still gets the full E2E check; a wrong skip is worse than a slow run.
- The rule is deterministic and testable, not a model's judgement over a file list.

**Non-Goals:**

- Driving only the processes a product fix touched (D4).
- The order of the integration reviewer and the E2E tester (#263); spec-conformance gaps found at close (#265).

## Decisions

### D1. The CLI names the test files; the skill decides

`bdk git scope` (and so `bdk git groups` and `groups.json`) gains `tests`, the changed, binary and deleted paths of the range that are test files, and `testsOnly`, `true` when every such path is one (also for an empty range). `review-round` reads `testsOnly` and decides. This follows the CLI rule (`.claude/rules/bdk-cli.md`): the command computes a fact from git and a fixed convention and decides nothing; the skill keeps the order of the work. The problem it solves is the #208 measurement, recorded above, as the rule for a new CLI field requires.

Alternatives: the lead classifies the files of `groups.json` itself (lost: a model comparing a list of 30 paths against naming conventions can misjudge one, and a misjudged product file skips a needed E2E check; the same state must give the same answer every time); a new command `bdk git tests` (lost: the scope already lists every path, and a second call is a second place to keep in step with it); only `tests` without `testsOnly` (lost: the lead would have to count three lists against a fourth; a boolean is the one fact the skill needs, and `tests` stays for `round.md` and the text output).

### D2. A fixed, conservative test-file convention, no settings key

A path is a test file when a directory segment is `test`, `tests`, `__tests__`, `__mocks__`, `__snapshots__` or `testdata`, or its file name matches `*.test.*`, `*.spec.*`, `*_test.*`, `*_spec.*`, `test_*.py`, `conftest.py`, or `*Test.<ext>`/`*Tests.<ext>` for the JVM, .NET, PHP and Swift extensions. Matching is case-sensitive on the path only. The two errors are not equal: a product file taken for a test file skips a needed check; a test file the convention misses only costs one E2E run, as today. So the list holds only names that are tests in every common ecosystem, and leaves out `spec/` (an OpenAPI `spec/` directory is served by the product), `fixtures/` (seed data can ship), `e2e/`, documentation and configuration.

Alternatives: a settings key with globs (lost for now: no measurement shows a project whose tests the convention misses, and CLAUDE.md "Building skills" admits configuration only for a shown problem; a missed convention fails safe, so adding the key later breaks nothing); reusing `tools.test[].paths` (lost: those globs name the files a command checks, mostly source files, the opposite of what is needed); counting documentation and OpenSpec files as "cannot change the product" too (lost: a docs site or help text read from Markdown is the product for some projects, and the issue's acceptance is about test files).

### D3. Carry the last verdict over only when it passed or was skipped, and write no `e2e/` for that round

Round `N` above 1 carries the E2E verdict over when `testsOnly` is `true` and the last E2E verdict, the first line of `round-<K>/e2e/verdict.md` for the highest `K` below `N` that has one, reads `PASS` or `SKIPPED`. Then the product is byte for byte the one that verdict checked: every round between `K` and `N` either ran the check or itself changed only tests. The round starts no E2E tester and writes no `round-N/e2e/`; `round.md` says under `## E2E`:

```markdown
## E2E
- not re-run: the fix scope holds only test files (2); carried over round-1/e2e/verdict.md: Verdict: PASS
```

The check runs in every other case: a non-test path in the scope (product code, configuration, a binary or a deleted product file), an anchor that fell back to the merge base (its scope is the whole Change, which holds product files), round 1, a last verdict `FAIL` (a carried `FAIL` would leave the round's findings log without the failing paths, and the fix must be confirmed by driving them), `BLOCKED` (the environment may be free now), or no earlier verdict. `dirty` files do not count: they are outside the range and `round.md` already lists them as a gap.

Alternatives: write a `round-N/e2e/verdict.md` that repeats the old verdict (lost: `/bdk:close` and `/bdk:spec-conformance` read the newest `verdict.md` and the path files next to it; a copy without path files would hide the evidence, and a copy with them duplicates files that already exist); carry only `PASS` (lost: a `SKIPPED` round, no `tools.e2e` or a proposal with no user process, would start an agent only to skip again, and the conditions of a skip do not depend on test files); keep running the check when the scope is empty (lost: nothing changed, so there is nothing new to observe).

### D4. No narrowing to the processes a product fix touched

The issue offered a second way: drive only the processes whose parts the fix touched. Rejected: which user processes a product file affects is a reading of the code, which the E2E tester is told never to do ("Judge only what the product shows"), and a wrong mapping misses exactly the regression a later round exists to catch. One full run costs about 90 s on the B1-sized Change; a missed regression costs a broken PR. `e2e-check` therefore gets no subset argument.

Alternatives: map files to processes through the plan parts (lost: a fix part's files say where the code changed, not which processes call it; a shared helper changes every process); re-drive only the paths that failed before (lost: a product fix for a code finding can break a path that passed).

### D5. Evidence: an eval case per branch and a measurement on the B1-sized Change

The eval suite gets `auto-review-test-only-fix` (a judged round 1 with a passing E2E verdict and one `should-fix` finding whose fix is a test; round 2 must start no E2E tester, write no `round-2/e2e/` and say why in `round.md`), and `auto-review-fix-round` gets a grader that its round 2, whose fix changes `src/parse.js`, still wrote `round-2/e2e/verdict.md`. The acceptance signal on the B1-sized Change is measured as #208 did: `/bdk:run` on `household-book-queued.sh` with the plugin built from this branch, the round times recorded under "Measurement" below.

## Risks / Trade-offs

- A project that keeps product code in a `test/` directory (a test framework itself) gets its fixes in such files taken as tests and skips E2E for them. Mitigation: rare, and the round still runs the group reviews and the `review` checks over those files; a settings key can come when a project shows it (D2).
- A test-only fix can change what a user sees when the product reads its tests at run time (a test runner product). Same mitigation.
- `review-round` changes in parallel in #263 and #265 (other steps): merge conflicts in `SKILL.md`, resolved at merge time.

## Measurement

2026-10-09, Claude Code 2.1.294, plugin built from this branch.

**Eval cases** (`--ablation none --runs 1`, clean `HOME`): `auto-review-test-only-fix` 1.00 (9 of 9 graders; round 2 recorded `"tests":["src/parse.test.js"],"testsOnly":true`, wrote no `round-2/e2e/`, and its `round.md` reads `- not re-run: the fix scope holds only test files (1); carried over round-1/e2e/verdict.md: Verdict: PASS`; 215 s, $1.43). `auto-review-fix-round` 1.00 (17 of 17, the new `round2-e2e-ran` included: its fix changed `src/parse.js`, so round 2 ran the E2E check; 217 s, $1.59).

**B1-sized Change** (`household-book-queued.sh`, `/bdk:run` as #208 did it: main thread `claude-opus-5-5`, agents on the models their files name):

| Round | Scope | E2E | Round time |
|---|---|---|---|
| 1 | 61 files from the merge base | ran: 97 s, `FAIL` (1 break path) | 164 s |
| 2 | 6 files: `src/commands/transfer.js` and 5 test files (`testsOnly` `false`) | ran: 125 s, `PASS`, the longest worker | 170 s |
| 3 | 1 file, `test/export-cli.test.js` (`testsOnly` `true`) | not re-run, `round-2/e2e/verdict.md: Verdict: PASS` carried over | 54 s |

This run's round-1 fixes touched product code (the E2E check of round 1 failed on a missing-argument path), unlike both #208 runs, so its round 2 rightly ran the full check. Round 3 was measured on a snapshot taken right after round 2 was judged (before `/bdk:close` archived the Change): one test-only commit, then `review-round --round 3` in a `bdk:lead`, the way `/bdk:auto-review` starts it. It anchored on round 2, recorded `testsOnly` `true`, started no E2E tester and finished in 54 s, against 170 s for round 2, whose E2E check alone took 125 s; round 2 of the #208 runs, also test-only fixes, took 169 s and 175 s with 85 s and 102 s of E2E. The acceptance signal holds both ways: a test-only round runs no full E2E and `round.md` says why; a round whose fix touches product code still runs it.
