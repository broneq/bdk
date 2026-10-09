## MODIFIED Requirements

### Requirement: Input

The block SHALL take the name of a Change and, optionally, `--base <ref>`, the branch the Change's code is compared with. Without a Change name it SHALL use the only Change under `openspec/changes/` other than `archive/`, and stop naming what it found when there is none or several. Without `--base` it SHALL use the branch `origin/HEAD` names, else `main`. It SHALL read the Change's `proposal.md` and every spec delta (`openspec/changes/<change>/specs/**/spec.md`), the main spec under `openspec/specs/` of every capability a delta modifies, removes or renames, the code the Change touches (`git diff <base>...HEAD`) and the code each scenario runs through, and the latest E2E results of the Change when there are any: of the files `.bdk/runs/<change>/e2e/verdict.md` and `.bdk/runs/<change>/review/round-<N>/e2e/verdict.md`, the one modified last, with the path files next to it.

#### Scenario: No E2E results

- **WHEN** the Change has no `e2e/verdict.md`, neither in `.bdk/runs/<change>/` nor in any review round
- **THEN** the block checks the deltas against the code alone and its report says under `Checked` that no E2E results were read

#### Scenario: Latest E2E results

- **WHEN** `review/round-1/e2e/verdict.md` says `Verdict: FAIL` and the later `review/round-2/e2e/verdict.md` says `Verdict: PASS`
- **THEN** the block reads the round 2 results, and its report names `review/round-2/e2e/verdict.md` under `Checked`

### Requirement: What the block checks

The block SHALL compare every spec delta with the product after the Change and put under `Must address` each of these problems:

- a scenario of an added or modified requirement whose THEN the code does not produce for its WHEN, or that no entry point of the product reaches;
- an E2E path whose result is `Result: fail`: the product breaks a promise of the proposal that the deltas are about to document;
- a removed requirement whose behaviour the product still has;
- a modified requirement that drops a scenario of its main-spec version while the product still behaves that way, so archive would lose documented behaviour;
- behaviour a user can observe (a command, an option, an output, an exit code, an endpoint, a page, a configuration key) that the Change adds or changes and that no delta describes;
- a delta that, merged by archive, would contradict another requirement of the main spec.

Every `Must address` item SHALL name the spec location (file and requirement or scenario), or for a failed E2E path the proposal line the path comes from, and carry evidence: the code location with what it does, or the E2E path file. The block SHALL judge only from the code and the E2E results it read, never from what a design or a plan says the code does, and SHALL NOT run the product, its tests or any command that writes. Problems that do not make the documentation wrong (unclear wording, a scenario no user can observe, internal names in a requirement) SHALL go under `Should consider`. A scenario the block checked and found to hold SHALL be listed under `Checked`.

#### Scenario: Delta contradicted by the code

- **WHEN** a delta's scenario says `tally total` prints `Total: 0.00` and exits 0 on an empty ledger, and the code exits 1 with `tally: no ledger here` when no ledger file exists
- **THEN** the report starts with `Verdict: FAIL` and a `Must address` item names that scenario, with the code line that exits 1 as evidence

#### Scenario: Behaviour no delta describes

- **WHEN** the Change also adds a command `tally clear` that deletes the ledger, and no delta mentions it
- **THEN** the report starts with `Verdict: FAIL` and a `Must address` item names `tally clear` as behaviour no delta describes

#### Scenario: Conforming Change

- **WHEN** every scenario of the deltas holds in the code, the E2E verdict is `PASS`, and the Change adds no behaviour outside the deltas
- **THEN** the report starts with `Verdict: PASS`, `Must address` holds `- None.`, and `Checked` lists the scenarios it checked

#### Scenario: E2E failure

- **WHEN** `.bdk/runs/<change>/e2e/see-the-total--empty-ledger.md` starts with `Result: fail` and names line 7 of the proposal
- **THEN** the report has a `Must address` item for that path naming the proposal line, whose evidence names the E2E path file

