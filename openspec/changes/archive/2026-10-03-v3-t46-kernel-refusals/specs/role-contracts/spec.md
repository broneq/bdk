## ADDED Requirements

### Requirement: Contracts steer the kernel calls that repeat as refusals

Each role contract SHALL carry the call forms that the `execute` probes of T41 showed refused, so an agent following the contract does not meet the refusal:

- The runner contract names the citation grammar with a worked `--cite <file>:<line>=<text>` example and states that a console line is not a citation.
- The envelope example in every role contract is a complete frontmatter with its opening and closing `---` lines and shows `reason` as an optional field for `blocked` and `needs-context` only, not as a field to fill with an empty value.
- Every role contract shows each `bdk log add` with `--ticket`. The dispatch package's `Return` section, which every role reads, states that envelope `entries` are the ids `log add` printed, the summary limit of 120 characters and the entry types, and that the envelope is piped to `bdk log ingest --ticket <ticket>` with no frontmatter flag.
- The lead contract states that a task ticket closes only after the last of its `steps` has recorded evidence, that task commands take the task's ticket and never the lead's own, and that the earlier ticket of a task is closed before `attempt open task-redispatch` opens the next.

The dispatch package's `Return` section SHALL name the summary limit, the entry types and the `log ingest` pipe form.

#### Scenario: Runner contract shows the citation form

- **WHEN** the runner contract is read
- **THEN** it holds a `--cite` example in the `<file>:<line>=<text>` form

#### Scenario: Envelope example is complete and reason is optional

- **WHEN** the envelope example of any role contract is parsed as frontmatter
- **THEN** it has opening and closing `---` lines and `reason` is not given a value in the example's `status: done` form

#### Scenario: Lead contract orders close after steps

- **WHEN** the lead contract is read
- **THEN** it orders `attempt close` after every step's evidence, and names the task ticket for task commands

#### Scenario: Package Return section

- **WHEN** `bdk dispatch build` writes a package
- **THEN** its `Return` section names the 120 character summary limit and the entry types
