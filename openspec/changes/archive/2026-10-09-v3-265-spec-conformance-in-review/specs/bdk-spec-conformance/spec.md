## MODIFIED Requirements

### Requirement: Input

The block SHALL take the name of a Change and, optionally, `--base <ref>`, the branch the Change's code is compared with, and `--round <round dir>`, the directory of a review round it runs in (Requirement "Run inside a review round"). Without a Change name it SHALL use the only Change under `openspec/changes/` other than `archive/`, and stop naming what it found when there is none or several. Without `--base` it SHALL use the branch `origin/HEAD` names, else `main`. It SHALL read the Change's `proposal.md` and every spec delta (`openspec/changes/<change>/specs/**/spec.md`), the main spec under `openspec/specs/` of every capability a delta modifies, removes or renames, the code the Change touches (`git diff <base>...HEAD`) and the code each scenario runs through. With `--round` it SHALL also read the Change's `design.md`, as intent only, to place each finding where its fix goes, never as evidence of what the code does. Without `--round` it SHALL also read the latest E2E results of the Change when there are any: of the files `.bdk/runs/<change>/e2e/verdict.md` and `.bdk/runs/<change>/review/round-<N>/e2e/verdict.md`, the one modified last, with the path files next to it.

#### Scenario: No E2E results

- **WHEN** the Change has no `e2e/verdict.md`, neither in `.bdk/runs/<change>/` nor in any review round
- **THEN** the block checks the deltas against the code alone and its report says under `Checked` that no E2E results were read

#### Scenario: Latest E2E results

- **WHEN** `review/round-1/e2e/verdict.md` says `Verdict: FAIL` and the later `review/round-2/e2e/verdict.md` says `Verdict: PASS`
- **THEN** the block reads the round 2 results, and its report names `review/round-2/e2e/verdict.md` under `Checked`

### Requirement: What the block checks

The block SHALL compare every spec delta with the product after the Change and put under `Must address` each of these problems:

- a scenario of an added or modified requirement whose THEN the code does not produce for its WHEN, or that no entry point of the product reaches;
- a SHALL sentence of an added or modified requirement that the code breaks for an input the sentence covers, although the requirement's scenarios hold: the sentence promises every input it names (a path "absolute or relative", "any" command, an empty value), not only the scenario's example;
- an E2E path whose result is `Result: fail`: the product breaks a promise of the proposal that the deltas are about to document;
- a removed requirement whose behaviour the product still has;
- a modified requirement that drops a scenario of its main-spec version while the product still behaves that way, so archive would lose documented behaviour;
- behaviour a user can observe (a command, an option, an output such as an error message, an exit code, an endpoint, a page, a configuration key) that the Change adds or changes and that no delta describes;
- a delta that, merged by archive, would contradict another requirement of the main spec.

Every `Must address` item SHALL name the spec location (file and requirement or scenario), or for a failed E2E path the proposal line the path comes from, and carry evidence: the code location with what it does, or the E2E path file. The block SHALL judge only from the code and the E2E results it read, never from what a design or a plan says the code does, and SHALL NOT run the product, its tests or any command that writes a project file. Problems that do not make the documentation wrong (unclear wording, a scenario no user can observe, internal names in a requirement) SHALL go under `Should consider`. A scenario the block checked and found to hold SHALL be listed under `Checked`.

#### Scenario: Delta contradicted by the code

- **WHEN** a delta's scenario says `tally total` prints `Total: 0.00` and exits 0 on an empty ledger, and the code exits 1 with `tally: no ledger here` when no ledger file exists
- **THEN** the report starts with `Verdict: FAIL` and a `Must address` item names that scenario, with the code line that exits 1 as evidence

#### Scenario: Behaviour no delta describes

- **WHEN** the Change also adds a command `tally clear` that deletes the ledger, and no delta mentions it
- **THEN** the report starts with `Verdict: FAIL` and a `Must address` item names `tally clear` as behaviour no delta describes

#### Scenario: Requirement text broken outside its scenario

- **WHEN** a delta requires that every command use the ledger file `TALLY_LEDGER` names, "a path absolute or relative to the current directory", its only scenario uses the relative path `books/2026.json`, and the code joins the value to the current directory
- **THEN** the report starts with `Verdict: FAIL` and a `Must address` item names that requirement: `TALLY_LEDGER=/tmp/ledger.json` reads `<cwd>/tmp/ledger.json`, with the joining code line as evidence

#### Scenario: Conforming Change

- **WHEN** every scenario of the deltas holds in the code, the E2E verdict is `PASS`, and the Change adds no behaviour outside the deltas
- **THEN** the report starts with `Verdict: PASS`, `Must address` holds `- None.`, and `Checked` lists the scenarios it checked

#### Scenario: E2E failure

- **WHEN** `.bdk/runs/<change>/e2e/see-the-total--empty-ledger.md` starts with `Result: fail` and names line 7 of the proposal
- **THEN** the report has a `Must address` item for that path naming the proposal line, whose evidence names the E2E path file

### Requirement: Report file

Without `--round`, the block SHALL write one file, `.bdk/runs/<change>/close/spec-conformance.md`, in the verifier report body (spec `bdk-verifier`), and change no other file. When that file already exists from an earlier run, the block SHALL read it first, keep the ID of every problem still open, give a new problem the next unused number, write `Closed: <IDs>` under the verdict line, and replace the file. Its reply SHALL be at most three lines: the verdict line, the report path, and the `Must address` IDs.

#### Scenario: Rerun after a fix

- **WHEN** `close/spec-conformance.md` holds `M1` and `M2`, the Change fixed `M1`, and the block runs again
- **THEN** the new `close/spec-conformance.md` holds `Closed: M1` under the verdict line and keeps `M2` with its ID

#### Scenario: Read by the run status

- **WHEN** the block wrote `close/spec-conformance.md` starting with `Verdict: PASS`
- **THEN** `bdk run status` no longer derives the step `spec-conformance` of row 9 for that Change

## ADDED Requirements

### Requirement: Run inside a review round

With `--round <round dir>`, the block SHALL run the same check as a worker of a review round, so that what close would refuse is found while the review loop can still fix it:

- It SHALL write its report, in the verifier report body, to `<round dir>/spec-conformance.md`, replacing an earlier one, with no `Closed:` line, and SHALL NOT write `close/spec-conformance.md`.
- It SHALL read no E2E results and report no E2E failure: the round's E2E tester appends its own failures to the round's log.
- For each `Must address` item it SHALL append one finding to `<round dir>/findings.jsonl` with `bdk findings add --source spec-conformance`, placed where the fix goes: at the code line when the code breaks what the proposal asks for, at the requirement in the spec delta when the delta misses or misstates behaviour the proposal or the design settles and neither contradicts; `--file` SHALL be repository-relative. The evidence SHALL name the item's ID, the spec location, what the spec says, what the product does, and which side the proposal supports.
- It SHALL change no other file.

Its reply SHALL be at most three lines: the verdict line, the report path, and the ids of the findings it added.

#### Scenario: Undocumented error message in a round

- **WHEN** `spec-conformance add-total --round .bdk/runs/add-total/review/round-1` runs on a Change whose proposal asks for a short error on a bad amount, whose code prints `tally: not an amount: abc` and exits 1, and whose deltas list no such error
- **THEN** `round-1/spec-conformance.md` starts with `Verdict: FAIL`, `round-1/findings.jsonl` holds a finding of source `spec-conformance` on `openspec/changes/add-total/specs/tally/spec.md` whose evidence names the message, and `close/spec-conformance.md` does not exist

#### Scenario: Path defect in a round

- **WHEN** the same round runs on the Change whose code joins `TALLY_LEDGER` to the current directory although its delta allows an absolute path
- **THEN** `round-1/findings.jsonl` holds a finding of source `spec-conformance` on `bin/tally.js` whose evidence names an absolute `TALLY_LEDGER` read under the current directory

### Requirement: Eval cases of spec conformance in the review round

The suite SHALL hold the block cases `spec-conformance-round`, `judge-spec-conformance` and `plan-fixes-spec-delta`, tagged `block`, built from the shared fixture `tally-ledger-path`: the `tally-change` fixture plus a commit whose proposal asks for a short error on a bad amount and a ledger file chosen by `TALLY_LEDGER` (absolute or relative), whose delta documents `TALLY_LEDGER` with a relative-path scenario only and lists no error, and whose code prints `tally: not an amount: <text>` and joins `TALLY_LEDGER` to the current directory. `spec-conformance-round` SHALL grade both findings in the round log and no `close/spec-conformance.md`; `judge-spec-conformance` SHALL grade the level `blocker` for both findings when they are given unleveled; `plan-fixes-spec-delta` SHALL grade, from both findings decided `fix`, fix parts whose `files` hold the spec delta and `bin/tally.js` and an `index.md` with nothing under `## Not planned`. The block cases `implement-part-spec-delta` and `conform-part-spec-delta` SHALL start from the shared fixture `tally-spec-fix-part` (`tally-ledger-path` plus round 1 with the error-message finding decided `fix` and fix part `01`, whose one task adds the error to the delta, verified by the next round's spec check): `implement-part-spec-delta` SHALL grade `Status: done`, the error in the delta and `bin/tally.js` unchanged; `conform-part-spec-delta`, with the part built and a report with no test, SHALL grade `Verdict: PASS`. The orchestrator case `auto-review-first-round` SHALL grade that the round lead starts `bdk:verifier` for `spec-conformance` with `--round` and `run_in_background: false`, and that `round-1/spec-conformance.md` exists.

#### Scenario: Round defects found with the plugin

- **WHEN** `spec-conformance-round` runs with the plugin, with the Bash grants the eval README names for it
- **THEN** its graders on the error-message finding and the path finding pass

#### Scenario: Spec-only fix part built and conformed

- **WHEN** `implement-part-spec-delta` and `conform-part-spec-delta` run with the plugin, with the Bash grants the eval README names for the part cases
- **THEN** the implementer reports `Status: done` with the error in the delta, and the conformer's verdict is `PASS`

#### Scenario: Spec-delta fix planned

- **WHEN** `plan-fixes-spec-delta` runs with the plugin
- **THEN** a fix part under `round-1/fixes/parts/` lists `openspec/changes/add-total/specs/tally/spec.md` in `files`, and `round-1/fixes/index.md` holds `- None.` under `## Not planned`
