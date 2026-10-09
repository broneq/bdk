## MODIFIED Requirements

### Requirement: plan-draft writes the parts

`plan-draft` SHALL read the proposal, every spec delta and the design of the Change, and the code they name, before it writes a part. It SHALL read the rules `bdk rules for --stage plan` selects, without files, and follow them in how it cuts the parts and writes the tasks; a part or task that follows from a rule SHALL name the rule's id. It SHALL write the plan as `openspec/changes/<change>/plan/parts/NN.md`, in the part format of spec `bdk-openspec-schema` ("Plan parts are files with frontmatter"): frontmatter, `## Goal`, `## Acceptance scenarios` and `## Tasks` with the task contract lines `File:`, `Interface:` and `Verified by:`. It SHALL NOT change code, specs, the proposal or the design. A gap of the design SHALL be a choice about behaviour the Change adds or changes; a case a requirement of the Change reaches, whose possible answers give the user materially different results (an existing file that a new option writing one would overwrite or refuse), SHALL be such a behaviour even when no scenario names it; ordinary input handling the Change's error rules settle by analogy (a missing argument, a malformed value) and behaviour no requirement of the Change touches SHALL NOT be named as a gap. The reply SHALL list every gap under the heading `Gaps of the design`, also a gap it planned around.

- Every scenario of the Change's spec deltas SHALL be named in the acceptance scenarios of exactly one part, as `<capability>` / `Requirement: <name>` / `Scenario: <name>`.
- Every path, function, command and type a task names as existing SHALL exist in the code as named.
- A part SHALL hold everything its implementer needs beyond the specs and the design: a fact several parts need is written into each of them, not into one part only.
- A `Verified by:` line SHALL name tests, spec scenarios or exact commands; it SHALL NOT name a set of commands by exclusion, nor a command that spends money, needs credentials or reaches a shared or external system.
- The tests of a task SHALL be in the same part as the code they test.

#### Scenario: Parts written

- **WHEN** `/bdk:plan-draft add-csv-export` runs on a Change with proposal, spec deltas and design and no plan
- **THEN** `openspec/changes/add-csv-export/plan/parts/01.md` exists with the frontmatter keys `id`, `depends-on`, `isolation` and `files`, and every task in it has the lines `File:`, `Interface:` and `Verified by:`

#### Scenario: Every scenario covered once

- **WHEN** the spec deltas of the Change hold six scenarios
- **THEN** each of the six is named in the acceptance scenarios of exactly one part

#### Scenario: Open product question

- **WHEN** the specs and the design leave open a choice that changes what the product does and the code does not settle it
- **THEN** `plan-draft` writes no part for that choice and the reply names the question as a gap of the design

#### Scenario: Unnamed case of a new requirement is a gap

- **WHEN** a requirement of the Change adds `ledger export <file> --out <path>` with a scenario for a new `<path>` only, and neither the specs nor the design say what happens when `<path>` exists
- **THEN** the reply names what happens to an existing `<path>` under `Gaps of the design`, and no part decides it

#### Scenario: Ordinary input handling is not a gap

- **WHEN** the Change defines the error for an unreadable input file and says nothing about an entry without an `amount`
- **THEN** the reply names no gap for it

#### Scenario: Behaviour outside the Change is not a gap

- **WHEN** the Change adds `ledger export <file>` and no requirement says what `ledger` does with no argument or an unknown subcommand
- **THEN** the reply names no gap for it, and no part plans or tests it

#### Scenario: Plan rule followed

- **WHEN** the project layer declares a rule `API-DOC-1` for stage `plan` and paths `src/**`, "a part that adds or changes a function exported from a module under `src/` ends with a task that documents it in `docs/api.md`", and the Change adds the exported `toCsv` in `src/csv.js`
- **THEN** the part that adds `toCsv` holds `docs/api.md` in its `files`, ends with the task that documents `toCsv` there, and names `API-DOC-1`
