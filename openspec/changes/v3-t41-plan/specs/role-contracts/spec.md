## ADDED Requirements

### Requirement: The verifier checks a whole plan

The `verifier` contract SHALL verify every plan part its package names, together, against the code as it is and against the design documents the package names. Besides the per-task checks (symbols and files exist as stated, a traced input reaches what the next step consumes, edge cases, callers of changed symbols, files used but missing from `Files:`), it SHALL tell the agent to check:

- **Test cases.** Each test case names an input or situation and the observable result expected from it; every behaviour the task text states has a case. A stated behaviour without a case is an execution-critical omitted requirement, raised as a blocker of category `unresolved-decision`.
- **Design coverage.** Every requirement, decision and failure path the design documents or the accepted `decision` entries state is covered by some task; an uncovered one is a blocker of category `unresolved-decision`.
- **Between parts.** A part that consumes another part's output names it in `depends-on`; two parts of the same wave do not both modify one file; a signature one part changes is used in its new form by the parts that call it.
- **No implementation code.** A task that carries a function body in a code block is a finding, since the plan states contracts and test cases.

#### Scenario: verifier contract covers the plan checks

- **WHEN** the content test reads `skills/roles/verifier/SKILL.md`
- **THEN** its body tells the agent to verify every plan part the package names together with the design, and names the checks for test cases, design coverage and dependencies between parts

#### Scenario: behaviour without a test case

- **WHEN** a task states that `formatDate` returns an unparseable value verbatim and none of its test cases names an unparseable value
- **THEN** the verifier raises a blocker of category `unresolved-decision` naming the task, and `plan-verify` is not done
