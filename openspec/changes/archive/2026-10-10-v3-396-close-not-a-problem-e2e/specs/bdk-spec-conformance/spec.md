## MODIFIED Requirements

### Requirement: What the block checks

The block SHALL compare every spec delta with the product after the Change and put under `Must address` each of these problems:

- a scenario of an added or modified requirement whose THEN the code does not produce for its WHEN, or that no entry point of the product reaches;
- a SHALL sentence of an added or modified requirement that the code breaks for an input the sentence covers, although the requirement's scenarios hold: the sentence promises every input it names (a path "absolute or relative", "any" command, an empty value), not only the scenario's example;
- an E2E path whose result is `Result: fail`: the product breaks a promise of the proposal that the deltas are about to document. A failed path of a review round's verdict (`review/round-<N>/e2e/verdict.md`) is not an item when that round's findings log (`review/round-<N>/findings.jsonl`) holds at least one `e2e-check` finding whose evidence names the path file and every such finding is levelled `not-a-problem`: the round's judge traced the path through the code and found that the observation does not hold, and close fails only on what changed after the last round. That path SHALL be listed under `Checked` as cleared by the review, with each finding's id and its level reason. A failed path with no such finding, or with one at any other level or unleveled (a `blocker` that triage deferred included), and every failed path of a verdict outside a review round (`.bdk/runs/<change>/e2e/`), SHALL stay an item;
- a removed requirement whose behaviour the product still has;
- a modified requirement that drops a scenario of its main-spec version while the product still behaves that way, so archive would lose documented behaviour;
- behaviour a user can observe (a command, an option, an output such as an error message, an exit code, an endpoint, a page, a configuration key) that the Change adds or changes and that no delta describes;
- a delta that, merged by archive, would contradict another requirement of the main spec;
- a delta that OpenSpec refuses: each error that `openspec validate <change> --strict` reports, such as an added or modified requirement without a scenario, is one item, because `openspec archive` cannot merge the deltas while it stands.

The block SHALL run `openspec validate <change> --strict` in every run, with and without `--round`, and judge its result the same way in both. The command only reads.

Every `Must address` item SHALL name the spec location (file and requirement or scenario), or for a failed E2E path the proposal line the path comes from, and carry evidence: the code location with what it does, the E2E path file, or for a refused delta the command and the error line it printed. When the validation reports no error, `Checked` SHALL say that `openspec validate <change> --strict` passed. The block SHALL judge only from the code and the E2E results it read, never from what a design or a plan says the code does, and SHALL NOT run the product, its tests or any command that writes a project file. Problems that do not make the documentation wrong (unclear wording, a scenario no user can observe, internal names in a requirement) SHALL go under `Should consider`. A scenario the block checked and found to hold SHALL be listed under `Checked`.

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

#### Scenario: Requirement without a scenario at close

- **WHEN** a delta adds the requirement Bad amount with no `#### Scenario:`, the code prints the error that requirement names, and `openspec validate add-total --strict` reports `ADDED "Bad amount" must include at least one scenario`
- **THEN** `close/spec-conformance.md` starts with `Verdict: FAIL` and a `Must address` item names the requirement Bad amount in the delta, with that error line as evidence

#### Scenario: Valid deltas

- **WHEN** `openspec validate add-total --strict` reports that the Change is valid
- **THEN** the report's `Checked` section says that the validation passed

#### Scenario: E2E failure the review cleared

- **WHEN** the latest verdict is `review/round-1/e2e/verdict.md` with `Verdict: FAIL`, its failed path `see-the-total--empty-ledger.md` has one `e2e-check` finding in `review/round-1/findings.jsonl` levelled `not-a-problem`, and its failed path `see-the-total--boolean-entry.md` has one levelled `blocker` and decided `defer`
- **THEN** the report starts with `Verdict: FAIL`, a `Must address` item names `see-the-total--boolean-entry.md`, no `Must address` item names `see-the-total--empty-ledger.md`, and `Checked` names `see-the-total--empty-ledger.md` as cleared by the review with its finding id

#### Scenario: Only cleared E2E failures

- **WHEN** every failed path of the latest round verdict has its `e2e-check` findings levelled `not-a-problem`, and every scenario of the deltas holds in the code
- **THEN** the report starts with `Verdict: PASS` and `Checked` names each cleared path with its finding id
