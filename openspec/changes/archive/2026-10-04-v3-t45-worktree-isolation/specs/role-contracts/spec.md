## MODIFIED Requirements

### Requirement: The verifier checks a whole plan

The `verifier` contract SHALL verify every plan part its package names, together, against the code as it is and against the design documents the package names. Besides the per-task checks (symbols and files exist as stated, a traced input reaches what the next step consumes, edge cases, callers of changed symbols, files used but missing from `Files:`), it SHALL tell the agent to check:

- **Test cases.** Each test case names an input or situation and the observable result expected from it; every behaviour the task text states has a case. A stated behaviour without a case is an execution-critical omitted requirement, raised as a blocker of category `unresolved-decision`.
- **Design coverage.** Every requirement, decision and failure path the design documents or the accepted `decision` entries state is covered by some task; an uncovered one is a blocker of category `unresolved-decision`.
- **Callers.** A caller of a changed symbol whose user-visible behaviour the Change alters, with no task or `decision` entry covering it, is a blocker of category `unresolved-decision`, so the user decides between repairing it in this Change and a follow-up Change; a caller change users do not see is a finding.
- **Between parts.** A part that consumes another part's output names it in `depends-on`; two parts of the same wave do not both modify one file; a signature one part changes is used in its new form by the parts that call it.
- **Isolation (T45).** Two parts of the same wave that both touch state outside their `Files:` (a lockfile or codegen output both regenerate, migration numbering, snapshot files, a whole-project build or typecheck that would see the other part's unfinished code, a shared port, database or fixtures) while both are `isolation: shared` are a blocker of category `integration-failure` naming the parts and the state; one of them set to `worktree` with a reason naming that state settles it. A `worktree` part whose `isolation-reason` names no state outside `Files:`, or names only files of its own `Files:`, is a finding, since a worktree costs a setup and a merge. Overlapping `Files:` stay a `depends-on` matter: a worktree does not settle them.
- **No implementation code.** A task that carries a function body in a code block is a finding, since the plan states contracts and test cases.

#### Scenario: verifier contract covers the plan checks

- **WHEN** the content test reads `skills/roles/verifier/SKILL.md`
- **THEN** its body tells the agent to verify every plan part the package names together with the design, and names the checks for test cases, design coverage and dependencies between parts

#### Scenario: user-visible caller regression

- **WHEN** a task makes `formatTimestamp` return its English default for a whitespace-only value, three pages that call it without a fallback would then show `Unknown` instead of their own text, and no task or `decision` entry covers them
- **THEN** the verifier raises one blocker of category `unresolved-decision` naming the three callers, and `plan-verify` is not done

#### Scenario: behaviour without a test case

- **WHEN** a task states that `formatDate` returns an unparseable value verbatim and none of its test cases names an unparseable value
- **THEN** the verifier raises a blocker of category `unresolved-decision` naming the task, and `plan-verify` is not done

#### Scenario: shared parts with a hidden shared lockfile

- **WHEN** parts `01` and `02` have disjoint `Files:` and no `depends-on`, both add a dependency in `package.json` files of their own packages so both regenerate `pnpm-lock.yaml`, and both are `isolation: shared`
- **THEN** the verifier raises a blocker of category `integration-failure` naming parts `01` and `02` and `pnpm-lock.yaml`, and `plan-verify` is not done

#### Scenario: worktree without shared state

- **WHEN** part `02` sets `isolation: worktree` with the reason "keeps it apart" and touches nothing outside its `Files:`
- **THEN** the verifier writes a finding naming part `02` and no blocker for it

### Requirement: Role contract content

Every role skill body SHALL be the role contract only, in this order: input (read the package with `bdk dispatch show <path>`, then the rules the package names with `bdk rules show --ticket <ticket>`), the role's work, ledger writes, output. The contract SHALL NOT repeat usage documentation of any command (`--help` is the only usage source, T02 decision R-13) and SHALL name no language-specific tool.

- **Ledger writes.** Every role writes its entries itself with `bdk log add <type> ... --ticket <ticket>` (superseding the `bdk-entries` block of T2 for role contracts). An agent reads the entries of other agents with `bdk log list --for <task|part|file>`.
- **Messages (T41-D5).** An agent's own id, its parent and its ticket are the `BDK-AGENT-ID`, `BDK-PARENT` and `BDK-TICKET` lines of its start context. Every contract tells the agent that a message carries a ledger id and one sentence, never the content, and that the entry comes first: an entry that affects the rest of the part goes to the parent; one that must stop other work goes to `main`, as before; one that affects particular siblings goes to the ids that `bdk agents list --affected-by <entry>` returns, its own id left out. On a message, the agent reads the named entry with `bdk log show <id>`, then continues, adapts its work within its package, or returns `blocked` with the entry id.
- **PR reviewer without a package (T42).** The `pr-reviewer` contract covers a reviewer that `/bdk:pr-review` starts as a forked skill with a PR brief as its argument (`review-skills`, pr-review reviews without state): it relies on nothing but the brief; it reads the rules of the PR's changed files with `bdk rules show --role pr-reviewer --file <path>...`; it reviews the range of the brief in its worktree against the brief's intent and, when the brief names one, the Change directory as contract; it writes no ledger entry and stores no report, because the PR has no ticket; it returns one result block holding each finding with its file, line, category, severity, rule id when a rule applies, problem and fix, and whether it blocks. The verdict is computed from that block by `/bdk:pr-review`, never by the role. The Ledger writes, Messages and Output bullets do not apply to it.
- **Review fix (T42).** The `implementer` contract covers a package on a `review-fix` ticket: it fixes each blocking entry the package embeds, names each entry it fixed by id in its report, and resolves none, because the orchestrator resolves them after the commit.
- **Scout without a package (T41-D4).** The `scout` contract covers a scout that a worker starts with a question instead of a package: it answers the question from the code, returns the answer in at most 15 lines naming files and lines, and writes a finding worth keeping with `bdk log add` and file refs.
- **Output.** Every role, the `implementer` included, pipes its report (the envelope fields `status`, `files`, `entries`, `evidence` and `reason` as frontmatter, then the full report) to `bdk log ingest --ticket <ticket>`, which stamps `schema`, `ticket` and `role` and stores it at the active package's `report` path (`kernel-state`, Report envelope). The contract SHALL tell the agent to check that `log ingest` exits 0 and, when it refuses, to fix the named field and call it again before returning. The agent then returns only the envelope of at most 15 lines, plus the report path.
- **Verdict record.** The `verifier` and `design-verifier` contracts tell the agent, after `log ingest` stored its report, to record it with `bdk log add report "<verdict in one line>" --ref <target> --ticket <ticket>`, so the verdict node of its target reads the report (`kernel-pipeline`, Artifact kinds; `kernel-cli/log`, bdk log add).
- **No authorisation (P3).** The `verifier`, `design-verifier`, `reviewer`, `integration-reviewer` and `pr-reviewer` contracts state a verdict and findings only, and contain no statement that approves, signs off, or tells anyone to merge or proceed.
- **Working tree (T3).** The `implementer` contract carries one sentence forbidding git commands that discard or rewrite work or history, with the reason: return `blocked` with the cause instead.
- **Blocking categories (P8).** The `verifier` and `design-verifier` contracts tell the agent to raise a `blocker` only with a category from the closed list in its package and to treat everything on the package's "not a FAIL" list as an `observation` or nothing; the list itself comes from policy through the package, not from the role body.
- **Simplify (T23-D43).** The `simplifier` contract tells the agent to simplify the ticket's uncommitted diff without changing behaviour, within the task's `Files:`, and to leave the changes uncommitted; it carries the implementer's working-tree sentence (T3).
- **Evidence (T4).** The `runner` contract tells the agent to run each check of its package's `Checks` section and record it with `bdk evidence record <kind> <file> --ticket <ticket>` and a verdict, citing the output line or JSON value that shows the result for `pass`, and to record `not-run` with the reason when a check cannot run.
- **Rule citations (S4).** The `implementer`, `simplifier`, `reviewer`, `integration-reviewer`, `pr-reviewer`, `verifier` and `design-verifier` contracts tell the agent to cite the id of every rule that forced a decision or that a finding violates, as a `--ref <id>` of the entry it writes (`BDK-CQ-4`, `API-2`) and by id in its report; a rule id is written exactly as `rules show --ticket` prints it. The kernel counts those refs as citations (`kernel-cli/rules`, bdk rules stats).
- **Lead (T41-D2, D11).** The `lead` contract tells the agent that it runs one plan part and writes no file: from its package's `Tasks` section it starts, in the background, every task whose `Depends on:` tasks are committed and whose `Files:` are disjoint from the running ones, through `bdk attempt open task-redispatch <task>`, `bdk dispatch build` and `Agent` with the package path; between dispatches it calls `bdk agents wait <own id>` instead of ending its turn, and acts on each event: a report leads to the ticket's steps, `bdk attempt close` and `bdk commit`; `next.action: escalate` leads to `bdk attempt open task-redispatch <task> --escalate`, whose agents it starts on the `model` that `bdk dispatch build` returns, and `parked` to a `blocked` return; a message leads to the named entry and, when it affects other running agents, a message to them; a `suspect` child gets one resume. When every task is committed it stores its report with `bdk log ingest --ticket <own ticket>` and returns the envelope. It names `elapsed` from `wait` as its time signal and states that an earlier correct result is better.
- **Review groups (T42-A1).** The `reviewer` and `integration-reviewer` contracts tell the agent that its ticket is the `<ticket>@<group>` reference its package names, and to use that reference in every `--ticket`. The `reviewer` reviews its group's files over the package's range against the plan part named as contract: whether the code does what the tasks state, logic errors within functions, and whether the tests check the stated behaviour, with the unit and end-to-end cases that are missing; it leaves style, duplication within a task and dead code to `simplify` and `lint`. The `integration-reviewer` reviews the whole range against the intent, the design and the plan: how the parts work together, spec deltas, files changed outside every task's `Files:`, duplication across parts, and each item of the package's `Risks` section the range touches. Both write each finding with a `category` from the P8 list when it blocks, and never write `level`, which is the orchestrator's (`kernel-cli/log`, bdk log triage).
- **Work root (T45).** The `implementer`, `simplifier`, `runner`, `scout` and `lead` contracts carry one sentence: when the package has a `Work root` section, every file read or edit and every command, its `Checks` included, happens inside that path, and kernel commands stay as they are, since the kernel finds the home checkout itself (`kernel-cli`, Invocation).
- **Conflict (T45).** The `implementer` contract carries one sentence: when the package has a `Conflict` section, edit only its paths and follow its instruction, leave staging and the merge commit to the kernel (the working-tree sentence already forbids `git commit`), and return `blocked` naming the paths the instruction does not settle.
- **Size.** A role skill body, without frontmatter, SHALL be at most 4 096 bytes, so that it fits in a 12 KB package next to the task (K4).

#### Scenario: P3 wording

- **WHEN** the content test searches the five reviewing role bodies for approve, LGTM, sign-off, ready to merge, go ahead and proceed
- **THEN** it finds none

#### Scenario: P3 wording of the integration reviewer

- **WHEN** the content test searches `skills/roles/integration-reviewer/SKILL.md` for the same words
- **THEN** it finds none, and the body names `--ticket` with the group reference and the `Risks` section

#### Scenario: git sentence in the implementer contract

- **WHEN** the content test reads `skills/roles/implementer/SKILL.md` and `skills/roles/simplifier/SKILL.md`
- **THEN** each has exactly one sentence that forbids discarding or history-writing git commands and tells the agent to return `blocked`

#### Scenario: no bdk-entries block

- **WHEN** the content test searches every role body for `bdk-entries`
- **THEN** it finds none, and every role body but `pr-reviewer` names `bdk log add`

#### Scenario: body within budget

- **WHEN** the content test measures each role body without frontmatter
- **THEN** each is at most 4 096 bytes

#### Scenario: every role stores its report through ingest

- **WHEN** the content test reads each of the ten role bodies
- **THEN** each but `pr-reviewer` names `bdk log ingest --ticket` and tells the agent to fix a refused report and call again, and none tells the agent to write a report file itself

#### Scenario: runner records evidence

- **WHEN** the content test reads `skills/roles/runner/SKILL.md`
- **THEN** it names `bdk evidence record`, a citation for `pass` and `not-run` with the reason

#### Scenario: simplifier keeps behaviour

- **WHEN** the content test reads `skills/roles/simplifier/SKILL.md`
- **THEN** it tells the agent to keep behaviour unchanged and to stay within the task's `Files:`

#### Scenario: rule ids are cited

- **WHEN** the content test reads the bodies of `implementer`, `simplifier`, `reviewer`, `integration-reviewer`, `pr-reviewer`, `verifier` and `design-verifier`
- **THEN** each but `pr-reviewer` tells the agent to cite the rule id with `--ref` on the entry and in the report, `pr-reviewer` tells it to cite the rule id in each finding of its result block, and the bodies of `runner`, `scout` and `lead` carry no such line

#### Scenario: messages in every contract

- **WHEN** the content test reads each of the ten role bodies
- **THEN** each but `pr-reviewer` names `BDK-AGENT-ID`, `bdk agents list --affected-by`, `bdk log show` and returning `blocked` on a message it cannot absorb

#### Scenario: lead waits instead of ending its turn

- **WHEN** the content test reads `skills/roles/lead/SKILL.md`
- **THEN** it names `bdk agents wait`, background dispatch, `bdk attempt close`, `bdk commit` and `bdk log ingest --ticket`, and names no `Edit` or `Write`

#### Scenario: verifiers record their verdict

- **WHEN** the content test reads `skills/roles/verifier/SKILL.md` and `skills/roles/design-verifier/SKILL.md`
- **THEN** each names `bdk log add report` with `--ticket` after `bdk log ingest --ticket`

#### Scenario: stateless PR reviewer

- **WHEN** the content test reads `skills/roles/pr-reviewer/SKILL.md`
- **THEN** it names `bdk rules show --role pr-reviewer --file`, the result block and its fields, and names neither `bdk dispatch show`, `bdk log add` nor `bdk log ingest`

#### Scenario: implementer fixes review blockers

- **WHEN** the content test reads `skills/roles/implementer/SKILL.md`
- **THEN** it tells the agent, on a `review-fix` package, to fix the embedded blocking entries, name their ids in its report and resolve none

#### Scenario: work root sentence

- **WHEN** the content test reads the `implementer`, `simplifier`, `runner`, `scout` and `lead` role bodies
- **THEN** each names the `Work root` section of its package, and the `implementer` body names the `Conflict` section
