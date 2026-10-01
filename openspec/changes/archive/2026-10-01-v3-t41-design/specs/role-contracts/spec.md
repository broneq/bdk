## MODIFIED Requirements

### Requirement: Role contract content

Every role skill body SHALL be the role contract only, in this order: input (read the package with `bdk dispatch show <path>`, then the rules the package names with `bdk rules show --ticket <ticket>`), the role's work, ledger writes, output. The contract SHALL NOT repeat usage documentation of any command (`--help` is the only usage source, T02 decision R-13) and SHALL name no language-specific tool.

- **Ledger writes.** Every role writes its entries itself with `bdk log add <type> ... --ticket <ticket>` (superseding the `bdk-entries` block of T2 for role contracts). An agent reads the entries of other agents with `bdk log list --for <task|part|file>`.
- **Messages (T41-D5).** An agent's own id, its parent and its ticket are the `BDK-AGENT-ID`, `BDK-PARENT` and `BDK-TICKET` lines of its start context. Every contract tells the agent that a message carries a ledger id and one sentence, never the content, and that the entry comes first: an entry that affects the rest of the part goes to the parent; one that must stop other work goes to `main`, as before; one that affects particular siblings goes to the ids that `bdk agents list --affected-by <entry>` returns, its own id left out. On a message, the agent reads the named entry with `bdk log show <id>`, then continues, adapts its work within its package, or returns `blocked` with the entry id.
- **Scout without a package (T41-D4).** The `scout` contract covers a scout that a worker starts with a question instead of a package: it answers the question from the code, returns the answer in at most 15 lines naming files and lines, and writes a finding worth keeping with `bdk log add` and file refs.
- **Output.** Every role, the `implementer` included, pipes its report (the envelope fields `status`, `files`, `entries`, `evidence` and `reason` as frontmatter, then the full report) to `bdk log ingest --ticket <ticket>`, which stamps `schema`, `ticket` and `role` and stores it at the active package's `report` path (`kernel-state`, Report envelope). The contract SHALL tell the agent to check that `log ingest` exits 0 and, when it refuses, to fix the named field and call it again before returning. The agent then returns only the envelope of at most 15 lines, plus the report path.
- **Verdict record.** The `verifier` and `design-verifier` contracts tell the agent, after `log ingest` stored its report, to record it with `bdk log add report "<verdict in one line>" --ref <target> --ticket <ticket>`, so the verdict node of its target reads the report (`kernel-pipeline`, Artifact kinds; `kernel-cli/log`, bdk log add).
- **No authorisation (P3).** The `verifier`, `design-verifier`, `reviewer` and `pr-reviewer` contracts state a verdict and findings only, and contain no statement that approves, signs off, or tells anyone to merge or proceed.
- **Working tree (T3).** The `implementer` contract carries one sentence forbidding git commands that discard or rewrite work or history, with the reason: return `blocked` with the cause instead.
- **Blocking categories (P8).** The `verifier` and `design-verifier` contracts tell the agent to raise a `blocker` only with a category from the closed list in its package and to treat everything on the package's "not a FAIL" list as an `observation` or nothing; the list itself comes from policy through the package, not from the role body.
- **Simplify (T23-D43).** The `simplifier` contract tells the agent to simplify the ticket's uncommitted diff without changing behaviour, within the task's `Files:`, and to leave the changes uncommitted; it carries the implementer's working-tree sentence (T3).
- **Evidence (T4).** The `runner` contract tells the agent to run each check of its package's `Checks` section and record it with `bdk evidence record <kind> <file> --ticket <ticket>` and a verdict, citing the output line or JSON value that shows the result for `pass`, and to record `not-run` with the reason when a check cannot run.
- **Rule citations (S4).** The `implementer`, `simplifier`, `reviewer`, `pr-reviewer`, `verifier` and `design-verifier` contracts tell the agent to cite the id of every rule that forced a decision or that a finding violates, as a `--ref <id>` of the entry it writes (`BDK-CQ-4`, `API-2`) and by id in its report; a rule id is written exactly as `rules show --ticket` prints it. The kernel counts those refs as citations (`kernel-cli/rules`, bdk rules stats).
- **Lead (T41-D2, D11).** The `lead` contract tells the agent that it runs one plan part and writes no file: from its package's `Tasks` section it starts, in the background, every task whose `Depends on:` tasks are committed and whose `Files:` are disjoint from the running ones, through `bdk attempt open task-redispatch <task>`, `bdk dispatch build` and `Agent` with the package path; between dispatches it calls `bdk agents wait <own id>` instead of ending its turn, and acts on each event: a report leads to the ticket's steps, `bdk attempt close` and `bdk commit`; `next.action: escalate` leads to `bdk attempt open task-redispatch <task> --escalate`, whose agents it starts on the `model` that `bdk dispatch build` returns, and `parked` to a `blocked` return; a message leads to the named entry and, when it affects other running agents, a message to them; a `suspect` child gets one resume. When every task is committed it stores its report with `bdk log ingest --ticket <own ticket>` and returns the envelope. It names `elapsed` from `wait` as its time signal and states that an earlier correct result is better.
- **Size.** A role skill body, without frontmatter, SHALL be at most 4 096 bytes, so that it fits in a 12 KB package next to the task (K4).

#### Scenario: P3 wording

- **WHEN** the content test searches the four reviewing role bodies for approve, LGTM, sign-off, ready to merge, go ahead and proceed
- **THEN** it finds none

#### Scenario: git sentence in the implementer contract

- **WHEN** the content test reads `skills/roles/implementer/SKILL.md` and `skills/roles/simplifier/SKILL.md`
- **THEN** each has exactly one sentence that forbids discarding or history-writing git commands and tells the agent to return `blocked`

#### Scenario: no bdk-entries block

- **WHEN** the content test searches every role body for `bdk-entries`
- **THEN** it finds none, and every role body names `bdk log add`

#### Scenario: body within budget

- **WHEN** the content test measures each role body without frontmatter
- **THEN** each is at most 4 096 bytes

#### Scenario: every role stores its report through ingest

- **WHEN** the content test reads each of the nine role bodies
- **THEN** each names `bdk log ingest --ticket`, tells the agent to fix a refused report and call again, and none tells the agent to write the report file itself

#### Scenario: runner records evidence

- **WHEN** the content test reads `skills/roles/runner/SKILL.md`
- **THEN** it names `bdk evidence record`, a citation for `pass` and `not-run` with the reason

#### Scenario: simplifier keeps behaviour

- **WHEN** the content test reads `skills/roles/simplifier/SKILL.md`
- **THEN** it tells the agent to keep behaviour unchanged and to stay within the task's `Files:`

#### Scenario: rule ids are cited

- **WHEN** the content test reads the bodies of `implementer`, `simplifier`, `reviewer`, `pr-reviewer`, `verifier` and `design-verifier`
- **THEN** each tells the agent to cite the rule id with `--ref` on the entry and in the report, and the bodies of `runner`, `scout` and `lead` carry no such line

#### Scenario: messages in every contract

- **WHEN** the content test reads each of the nine role bodies
- **THEN** each names `BDK-AGENT-ID`, `bdk agents list --affected-by`, `bdk log show` and returning `blocked` on a message it cannot absorb

#### Scenario: lead waits instead of ending its turn

- **WHEN** the content test reads `skills/roles/lead/SKILL.md`
- **THEN** it names `bdk agents wait`, background dispatch, `bdk attempt close`, `bdk commit` and `bdk log ingest --ticket`, and names no `Edit` or `Write`

#### Scenario: verifiers record their verdict

- **WHEN** the content test reads `skills/roles/verifier/SKILL.md` and `skills/roles/design-verifier/SKILL.md`
- **THEN** each names `bdk log add report` with `--ticket` after `bdk log ingest --ticket`
