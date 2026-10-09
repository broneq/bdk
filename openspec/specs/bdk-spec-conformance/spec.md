# bdk-spec-conformance Specification

## Purpose
Defines the `spec-conformance` block of the `bdk` plugin: before a Change is archived, it checks that the Change's spec deltas describe the product after the Change - against the code and the E2E results - so archive never turns a wrong statement into the living documentation.

## Requirements

### Requirement: Block on the verifier agent

`spec-conformance` SHALL be a skill of the `bdk` plugin (`plugins/bdk/skills/spec-conformance/`) whose check runs on the agent `bdk:verifier` (spec `bdk-verifier`), never in the conversation that wrote the Change. When it is invoked anywhere else, such as a user typing `/bdk:spec-conformance` in the main thread, it SHALL start `bdk:verifier` with a prompt naming the skill and its arguments, and with the model `models.verifier` when the configuration sets it, wait for it, and reply with the agent's verdict line and report path, without checking anything itself. The block SHALL get the configuration from its own `bdk config show` block; in a project that is not configured it SHALL stop with the line that command prints and write nothing.

#### Scenario: Typed in the main thread

- **WHEN** a user types `/bdk:spec-conformance add-total` in the main thread
- **THEN** the skill starts `bdk:verifier` to run `bdk:spec-conformance` for `add-total`, and replies with the verdict line and the path of the report the agent wrote

#### Scenario: Typed in the main thread with a model set

- **WHEN** a user types `/bdk:spec-conformance add-total` in the main thread of a project whose configuration sets `models.verifier: sonnet`
- **THEN** the skill starts `bdk:verifier` with `model` `sonnet`

#### Scenario: Not configured

- **WHEN** `spec-conformance` runs in a project without `.bdk/settings.yaml`
- **THEN** it writes no file and its reply says `BDK not configured: run /bdk:setup`

### Requirement: Input

The block SHALL take the name of a Change and, optionally, `--base <ref>`, the branch the Change's code is compared with. Without a Change name it SHALL use the only Change under `openspec/changes/` other than `archive/`, and stop naming what it found when there is none or several. Without `--base` it SHALL use the branch `origin/HEAD` names, else `main`. It SHALL read the Change's `proposal.md` and every spec delta (`openspec/changes/<change>/specs/**/spec.md`), the main spec under `openspec/specs/` of every capability a delta modifies, removes or renames, the code the Change touches (`git diff <base>...HEAD`) and the code each scenario runs through, and the latest E2E results of the Change when there are any: of the files `.bdk/runs/<change>/e2e/verdict.md` and `.bdk/runs/<change>/review/round-<N>/e2e/verdict.md`, the one modified last, with the scenario files next to it.

#### Scenario: No E2E results

- **WHEN** the Change has no `e2e/verdict.md`, neither in `.bdk/runs/<change>/` nor in any review round
- **THEN** the block checks the deltas against the code alone and its report says under `Checked` that no E2E results were read

#### Scenario: Latest E2E results

- **WHEN** `review/round-1/e2e/verdict.md` says `Verdict: FAIL` and the later `review/round-2/e2e/verdict.md` says `Verdict: PASS`
- **THEN** the block reads the round 2 results, and its report names `review/round-2/e2e/verdict.md` under `Checked`

### Requirement: What the block checks

The block SHALL compare every spec delta with the product after the Change and put under `Must address` each of these problems:

- a scenario of an added or modified requirement whose THEN the code does not produce for its WHEN, or that no entry point of the product reaches;
- a scenario whose E2E result is `Result: fail`;
- a removed requirement whose behaviour the product still has;
- a modified requirement that drops a scenario of its main-spec version while the product still behaves that way, so archive would lose documented behaviour;
- behaviour a user can observe (a command, an option, an output, an exit code, an endpoint, a page, a configuration key) that the Change adds or changes and that no delta describes;
- a delta that, merged by archive, would contradict another requirement of the main spec.

Every `Must address` item SHALL name the spec location (file and requirement or scenario) and carry evidence: the code location with what it does, or the E2E scenario file. The block SHALL judge only from the code and the E2E results it read, never from what a design or a plan says the code does, and SHALL NOT run the product, its tests or any command that writes. Problems that do not make the documentation wrong (unclear wording, a scenario no user can observe, internal names in a requirement) SHALL go under `Should consider`. A scenario the block checked and found to hold SHALL be listed under `Checked`.

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

- **WHEN** `.bdk/runs/<change>/e2e/empty-ledger.md` starts with `Result: fail`
- **THEN** the report has a `Must address` item for that scenario whose evidence names the E2E file

### Requirement: Report file

The block SHALL write one file, `.bdk/runs/<change>/close/spec-conformance.md`, in the verifier report body (spec `bdk-verifier`), and change no other file. When that file already exists from an earlier run, the block SHALL read it first, keep the ID of every problem still open, give a new problem the next unused number, write `Closed: <IDs>` under the verdict line, and replace the file. Its reply SHALL be at most three lines: the verdict line, the report path, and the `Must address` IDs.

#### Scenario: Rerun after a fix

- **WHEN** `close/spec-conformance.md` holds `M1` and `M2`, the Change fixed `M1`, and the block runs again
- **THEN** the new `close/spec-conformance.md` holds `Closed: M1` under the verdict line and keeps `M2` with its ID

#### Scenario: Read by the run status

- **WHEN** the block wrote `close/spec-conformance.md` starting with `Verdict: PASS`
- **THEN** `bdk run status` no longer derives the step `spec-conformance` of row 9 for that Change
