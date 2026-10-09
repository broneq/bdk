## Context

`e2e-check` (#194, Playwright driver #267) starts the product from `tools.e2e` and walks each `#### Scenario:` of the Change's spec deltas. #317 moved the checks to the `part`, `wave` and `review` points and, in its design decision D7 (approved by the user on a Lavish review page), decided what the E2E check drives instead: the user processes the proposal adds or changes, up to 5 paths per process (main path, variants, at least one that tries to break it), no global cap, each path traced to a proposal line; the spec scenarios are proven by the project's own tests. This Change carries D7 out. It does not reopen it.

Readers of the E2E files today: `review-round` (first line of `verdict.md`), `close` (first line of the latest `verdict.md`), `spec-conformance` (the latest `verdict.md` and every non-passing file next to it). The judge reads findings, not the E2E files.

## Goals / Non-Goals

**Goals:**

- The tester answers "does the change work when I use it", derived from the proposal, not a replay of the spec scenarios.
- Every path is traceable to a proposal line, in its file, in `verdict.md` and in its finding.
- A Change without a user-visible change costs no product start.

**Non-Goals:**

- Narrowing the E2E check in later review rounds (#264).
- Changing the implementer's acceptance tests: `implement-part` step 4 already writes one test per acceptance scenario in the project's test conventions (a Playwright spec where the project tests its UI that way).

## Decisions

### D1. The proposal names the processes; design and deltas give only expected values

The tester reads `proposal.md` (Why and What Changes) and lists the user processes it adds or changes: something a user sets out to do and sees the result of ("see the ledger total", "export notes as CSV"). It then reads `design.md` and the spec deltas only to make the expected outcome exact (the text, the exit code, the status a path should show). A proposal line that changes nothing a user does (a refactor, a module, a test, a dependency) is listed with its reason under `## Not a user process` of `verdict.md` and is not driven; this keeps the old `not-driven` traceability for internals without driving them.

Alternatives: keep replaying the spec scenarios and add proposal paths on top (lost: the scenarios are the project's tests already, D7, and the run gets slower, problem 1); derive processes from the spec deltas' requirements (lost: the deltas are written for tests and miss what the proposal promises but no scenario states, which is exactly what a user meets).

### D2. Paths: `main`, variants, `break`; 5 per process, no global cap

Per process: one `main` path (the process as the proposal describes it), variants (another state or input the proposal, the design or a delta names, or a user plainly meets: empty, many, a second run), and at least one `break` path (wrong input, wrong order, a repeated, quick or interrupted action, a missing precondition). At most 5 paths per process; a larger Change has more processes, so the run grows with what changed. A process is one user goal: two ways to reach the same goal are two paths of one process, not two processes. A process whose interface no `tools.e2e` item reaches gets one `main` line `not-driven` with the reason.

Alternatives: a fixed cap per Change (rejected by the user in #317 D7); no `break` path required (lost: the paths that try to break a feature are where a manual tester finds what tests miss).

### D3. A break path without a stated outcome is judged by the baseline every user expects

When neither the proposal, the design nor a delta states the outcome of a break path, it passes when the product refuses or handles it visibly (a message naming the problem; a non-zero exit, a 4xx status or an error shown on the page), shows no crash or stack trace, loses or corrupts no data, and still works for the next action. Anything else fails. The `## Expected` section of the path file states which source gave the expectation: the proposal line, a delta or design location (`Expected from:`), or `baseline`.

Alternatives: drive break paths but never fail them (lost: they would be noise); fail only on a crash (lost: silently accepting bad input and corrupting the ledger is worse than a crash).

### D4. Evidence names: `<process>--<path>`, flat in `E2E`

A process name is the user goal in kebab-case (`see-the-total`); a path name is `main` or what the path does in kebab-case (`empty-ledger`, `bad-amount`). The path file is `E2E/<process>--<path>.md`; the double hyphen cannot occur inside a kebab-case name, so the pair splits back without doubt. Screenshots `E2E/<process>--<path>-<n>.png`, video `E2E/<process>--<path>.webm` (`-<actor>` before `.webm` per actor). The file starts:

```markdown
Result: fail
Process: see-the-total
Path: empty-ledger (variant)
Proposal: openspec/changes/add-total/proposal.md:7 - New command `tally total`.
Item: cli (cli)
```

`verdict.md` holds one line per path, grouped under one `## <process>` heading per process, each line `- <result>: <path> (<kind>, proposal.md:<N>) - <file>`, then `## Not a user process`.

Alternatives: one directory per process (lost: readers glob one level today, and a browser evidence path grows by a directory for no gain); numbered paths `01-main` (lost: the name no longer says what was driven).

### D5. A finding points at the proposal line

`bdk findings add <log> --source e2e-check --summary "<process> / <path>: <what the product did instead>" --file openspec/changes/<change>/proposal.md --line <N> --evidence "<E2E/file>: expected <...>, observed <...>"`. The proposal line is what was promised; when the expectation came from a delta, the evidence names it. Start failures and defects outside every path keep their form without `--file`.

Alternatives: point at the spec delta when a delta gave the expected value (lost: two kinds of location for one kind of finding, and break paths have no delta).

### D6. Skip reasons

`no tools.e2e entry; add one with /bdk:setup` is checked first, before the proposal is read. Then `the proposal changes nothing a user does` when step 2 finds no user process. `the Change has no spec scenarios` goes: a Change with `skip_specs: true` may still change what a user sees, and the proposal decides.

### D7. Readers follow

`spec-conformance` keeps "an E2E failure is `Must address`": a failed path is a broken promise of the proposal, so the specs about to be archived would describe a product that does not work. Its item names the proposal line and the path file as evidence. `review-round` and `close` read only the first line of `verdict.md`, which does not change. The fixtures that model E2E evidence (`tally-reviewed.sh`, `spec-conformance-conforming`) are rewritten into path files so the evals keep showing what the tester really writes.

Alternatives: drop E2E from `spec-conformance` (lost: the last check before archive would stop seeing a red product).

### D8. Eval cases

- `e2e-check-cli-broken`: the shared `tally-cli.sh` proposal gains an internal line (parsing in one module); graders: the empty-ledger defect is a finding at `proposal.md`, `main` passes, the internal line is under `## Not a user process`, each path line names a proposal line. The old `count:1` on findings goes: a `break` path may find a second real defect in the fixture.
- `e2e-check-proposal-paths` (new): the proposal promises `tally total --json`, no delta mentions it and the product ignores the flag. A spec replay cannot see it; a tester deriving from the proposal must. Graders: a finding for `--json` at the proposal line, a `break` path, at most 5 paths per process.
- `e2e-check-no-user-change` (new): a refactor proposal gives `Verdict: SKIPPED`, `the proposal changes nothing a user does`, and the product is never run.
- `e2e-check-no-e2e`: only its prompt wording changes.

## Risks / Trade-offs

- [The tester invents expectations a proposal never made] -> every path names its proposal line and its `Expected from`, so the judge and triage see an unfounded finding; break paths use one stated baseline.
- [Too many processes from a long proposal] -> a process is one user goal, two paths of one goal stay one process; the cost grows with the Change, which D7 accepted.
- [A spec scenario no path reaches stays unchecked on the running product] -> the project's acceptance test proves it, and `spec-conformance` still follows every scenario through the code.
- [Break paths find old defects outside the Change] -> they are real defects of a process the Change touches; the judge levels them and triage may defer them.

## Spec delta shape

OpenSpec 1.13.2 refuses a MODIFIED requirement that drops a scenario of its main-spec version. The four requirements whose scenarios were about spec scenarios (`Input and scenarios`, `Drive scenarios as a user`, `Evidence files`, `Findings`) are therefore REMOVED and ADDED under new names (`Input and user processes`, `Drive paths as a user`, `Path evidence files`, `Findings at the proposal line`) instead of renamed and modified; keeping the old scenario names over new content would have documented paths under names that say "scenario".

## Measurements

Eval suite `e2e-check-*`, `--runs 1`, both arms, Claude Code 2.1.295 (`pnpm --filter @bdk/bdk run eval --trust-plugin --allow-tools Write Bash --case 'e2e-check-*' --runs 1 -j 4`):

| Case | First run WITH | Final WITH | W/OUT | Δ |
|---|---|---|---|---|
| `e2e-check-cli-broken` | 1.00 | 1.00 | 0.14 | +0.86 |
| `e2e-check-proposal-paths` | 0.86 | 1.00 | 0.00 | +1.00 |
| `e2e-check-no-user-change` | 0.00 | 1.00 | 0.40 | +0.60 |
| `e2e-check-no-e2e` | 1.00 | 1.00 | 0.50 | +0.50 |

Final run $1.45 for 8 runs; each WITH run $0.13 to $0.30.

What the first run showed, and the answer:

- `e2e-check-no-user-change` scored 0.00: the tester made a process of the line "its commands, output and exit codes stay as they are", drove the old commands, and reported as a finding that `src/store.js` did not exist. Two causes. The skill did not say that a line keeping behaviour as it was is no process, and it did not say that whether code was written is code review's question; both are now in the skill (steps 2 and 4). The fixture announced a refactor it had not done; its scaffold now writes `src/store.js` and makes `bin/tally.js` use it.
- `e2e-check-proposal-paths` missed `json-path-fail`: the tester made `--json` its own process (`print-total-json`), so the failing line was `- fail: main (main, proposal.md:8)` without "json" in it. That is a valid reading of D2 (a script reading the total is another goal), so the grader now checks for a failed path at `proposal.md:8`.

A kept run of `e2e-check-proposal-paths` wrote two processes (`print-total`: `main`, `empty-ledger`, `corrupt-ledger` break; `print-total-json`: the same three), four findings at `proposal.md:7` and `:8`, and two `break` paths that found a real defect no spec scenario names: a corrupt `ledger.json` gives a raw `SyntaxError` stack trace (`Expected from: baseline`).
