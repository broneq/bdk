# Spec Delta

## MODIFIED Requirements

### Requirement: cr runs a review round

A round SHALL run on one ticket of `bdk attempt open review-fix <change-id>`. Before opening it, `cr` SHALL run `bdk review plan` with the user's `--full` or `--base <ref>`. When the plan has no group, `cr` SHALL open no ticket: with an empty `binary` list it SHALL report that nothing changed since the last review; otherwise the range changes only binary files (`kernel-cli/review`, bdk review plan), and it SHALL report that the range holds no text file to review, naming the binary files.

`cr` SHALL build one package per group with `bdk dispatch build <change-id> <role> <ticket> --group <id>`, each at the step that starts its agent:

- a group of kind `part`, `unplanned` or `module` gets role `reviewer`, with `--range` from the plan, a `--file` for every file of the group and, for a part, `--part <nn>`;
- one more package of role `runner` with `--group gate` runs the full gate (`tests-full`, `lint-full` and coverage) from its `Checks` section;
- the group `integration` gets role `integration-reviewer`, with `--range` and no `--file` or `--part`;
- one more package of role `judge` with `--group judge` and `--range`, and no `--file` or `--part`.

The user's focus text SHALL become `--focus <text>` of every reviewer and integration-reviewer package. `cr` SHALL load the `bdk:swarm` skill and start each package's agent in the background, with `subagent_type` set to `bdk:` plus the package's `adapter` and the package path as the whole prompt, at most `execution.concurrency` at once, in three steps:

1. `cr` SHALL build the `reviewer` packages and the `runner` package of the gate and start their agents;
2. once every `reviewer` agent of the round has returned, after its one resume when it needed one, `cr` SHALL build the `integration-reviewer` package and start its agent, while the gate agent may still run. The package is built only then, so it names the reports the reviewers stored and the groups whose report is missing (`kernel-cli/dispatch`, bdk dispatch build);
3. once the integration reviewer has returned, `cr` SHALL build the `judge` package and start its agent, while the gate agent may still run. The judge triages the entries its package lists (`role-contracts`, Role contract content).

It SHALL resume an agent at most once, as the swarm skill says.

#### Scenario: packages of a planned Change

- **WHEN** `/bdk:cr` runs on an executed Change whose `review plan` returns the groups `p01`, `p02` and `integration`
- **THEN** the ticket holds the packages of `reviewer` for `p01` and `p02`, of `integration-reviewer` for `integration` and of `runner` for `gate`, every `Agent` call's prompt is one package path, the `integration-reviewer` package is built and its agent started only after both `reviewer` agents have returned, and the `judge` package only after the integration reviewer has returned

#### Scenario: nothing new to review

- **WHEN** `/bdk:cr` runs and `review plan` returns no group because no commit follows the last merged review
- **THEN** no ticket is opened and the final reply says that nothing changed since the last review, naming its head

#### Scenario: only binary files changed

- **WHEN** `/bdk:cr` runs and the range changes only `snapshots/a.png` and `snapshots/b.png`
- **THEN** no ticket is opened and the final reply says that the range holds no text file to review and names both files

#### Scenario: integration reviewer starts after the group reviewers

- **WHEN** `/bdk:cr` runs on a Change whose `review plan` returns `m1`, `m2` and `integration`, and the reviewer of `m2` returns `blocked` with no stored report after its one resume
- **THEN** the integration reviewer's package is built after both reviewers returned, names the report of `m1`, and names `m2` as not reviewed with its files

### Requirement: cr triages every entry of the round

When every agent of the round has returned, the round SHALL be triaged: the judge has set the levels of the entries its package listed, and `cr` triages in the main thread only what is left.

- Every live `finding`, `blocker` and `observation` written under the round's ticket holds one level. `cr` reads the levels from the kernel, never from the judge's reply, and gives a level with `bdk log triage <id> <level>` to each entry still without one, such as when the judge returned `blocked`. It SHALL NOT change a level the judge set; the human changes it at the report.
- So does every other live `finding`, `blocker` and `observation` of the Change that has no level yet, whichever stage wrote it, such as the entries the verifier or an implementer wrote during execute. The human then decides only entries the judge or the orchestrator has triaged, and an entry that is noise leaves the report as `not-a-problem` with its reason. The level is judged against the failure scenario the entry states, checked at its refs, the intent, the spec deltas, the accepted decisions, the configured `review.risks` and the category the reviewer gave.
- A `blocker` is an entry that must be fixed before the gate and names a P8 category.
- An entry that repeats another of the round is triaged `not-a-problem`, with `--reason` naming the entry it repeats.
- `cr` SHALL NOT change an entry's text, type or refs.

Then `cr` SHALL store the merged review with `bdk log ingest --ticket <ticket>@merge`, before it closes the ticket: the kernel refuses an `ok` or `fail` close of a `review-fix` ticket without it (`kernel-cli/attempt`, bdk attempt close). The report's `entries` name every entry written under the round's ticket; entries of earlier rounds it fixed are named in its body. Its body lists, per level, each entry's id and summary, then the gate's verdicts and diff coverage. `cr` SHALL then run `bdk log add report "<counts per level>" --ticket <ticket>@merge`.

#### Scenario: every entry triaged

- **WHEN** a round's reviewers wrote three findings and one observation, one finding repeating another
- **THEN** each of the four entries holds a `level`, the repeated one `not-a-problem` with a reason naming the other, and the round's `merge` report names all four

#### Scenario: execute entries are triaged in the round

- **WHEN** the verifier of part 02 wrote a live observation during execute, and the first review round closes
- **THEN** the observation holds a `level`, as the round's own entries do, and the report lists it under that level, not as untriaged

#### Scenario: the judge triages the round

- **WHEN** a round's reviewers wrote four findings, one of them with a failure scenario that a check upstream prevents, and the judge returned
- **THEN** each finding holds the level the judge set, the prevented one `not-a-problem` with the judge's reason, and `cr` ran no `bdk log triage` for them

#### Scenario: main triages what the judge left

- **WHEN** the judge returned `blocked` after triaging two of four entries
- **THEN** `cr` triages the other two in the main thread, and the `merge` report names all four

### Requirement: cr inline

With `--inline`, `cr` SHALL start no agent. It SHALL build the same packages under the same ticket, each at the same step as without `--inline`, and then work each package itself, one after another: first the `reviewer` packages and the gate, then the `integration-reviewer` package, built only after every reviewer report is stored, then the `judge` package. It reads a package with `bdk dispatch show`, follows the role section it embeds, writes entries and stores the report under the package's `<ticket>@<group>`; for the `judge` package it sets each level with `bdk log triage` itself. It then triages what is left and merges as without `--inline`. It SHALL NOT fix blockers: with blocking entries it closes the ticket `fail` and stops, naming the blockers and `/bdk:cr` without `--inline` as the way to fix them.

#### Scenario: inline round

- **WHEN** the user types `/bdk:cr --inline` on an executed Change
- **THEN** no `Agent` call is made, and the ledger holds a stored report for every group of the round, the `integration` and `judge` groups included, and a `merge` report

#### Scenario: inline integration package names the reports

- **WHEN** the user types `/bdk:cr --inline` on a Change whose `review plan` returns `p01` and `integration`
- **THEN** the `integration-reviewer` package names the stored report of `p01`, because it was built after that report was stored
