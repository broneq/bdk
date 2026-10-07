---
name: verify-design
description: 'Checks the spec deltas and design.md of an OpenSpec Change against the code and the proposal on the bdk:verifier agent, and writes the run file design/verify-N.md with a PASS or FAIL verdict. Use when a design is ready for review, before planning, when asked to check or verify a design, or when /bdk:design verifies an iteration.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git log *) Bash(git show *) Bash(git diff *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Verify design

When the block above says "BDK not configured: run /bdk:setup", stop: reply with that line and write nothing.

## 0. Run as `bdk:verifier`

This block runs on the `bdk:verifier` agent, whose instructions start with "You are `bdk:verifier`". The verifier must not be the conversation that wrote the design. When you are not that agent (a user typed the command in the main conversation), do not check the design yourself: start the agent with the Agent tool, `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:verify-design with the arguments: <the arguments above>`, wait for it, reply with its verdict line and report path, and stop. Keep its agent ID: after a fix, `SendMessage` to the same agent verifies again.

Done when you are `bdk:verifier`, or the agent has answered.

## 1. Find the Change and the report number

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found and stop.

List `.bdk/runs/<change>/design/verify-*.md`. Your report is `verify-N.md` with N one above the highest number (1 when none). When an earlier report exists, read the latest one first: its open IDs carry over.

When `design.md` or the spec deltas are missing, write a report with `Verdict: FAIL` and `M1` naming the missing file, and go to step 5.

## 2. Read

Read `proposal.md`, every `specs/**/spec.md` of the Change, `design.md`, and `.bdk/runs/<change>/design/explore.md` when present. On a later pass, read again every file that changed (`git diff`, or the files the caller names) and every file an open item names.

Done when you can list each claim the design makes about existing code.

## 3. Check

1. **Claims about the code.** Open every file, function, type, field and command the design or explore map relies on, and check the signature and behaviour it states. A claim you could not check is a problem, not a pass.
2. **Capabilities.** Every capability of the proposal has a spec delta; every requirement has at least one `#### Scenario:` with WHEN and THEN that can run against the product.
3. **Coverage.** Every requirement and every "What Changes" bullet has an answer in the design; nothing in the design contradicts the specs or the proposal.
4. **Decisions.** Each decision states its choice, reason and the alternatives with why they lost.
5. **Constraints.** Every constraint or non-functional need the proposal or the specs state is met or explicitly deferred.
6. **Diagrams.** A flow, structure or state machine that prose leaves ambiguous has a diagram, and the diagram matches the prose.
7. **Risks.** Concrete: a named bottleneck, failure mode, hidden cost or unconfirmed assumption, not "could be a concern".
8. **Open questions.** Only unknowns that change neither the specs, the decisions nor the plan.
9. **Plan readiness.** The design names the modules, interfaces and data the plan parts will touch.

## 4. Sort

- **Must address**: a defect that would make the plan or the product wrong. A false claim about the code; a requirement without an answer, or one the design contradicts; a capability without a spec delta; a scenario that cannot run; a failure path the specs imply and the design ignores; a decision against the proposal.
- **Should consider**: every other gap from step 3.

Not a problem: wording, style, a choice among valid alternatives the design argued, anything outside the proposal.

## 5. Write the report

Write `.bdk/runs/<change>/design/verify-N.md` in the report body of your agent instructions:

```markdown
Verdict: FAIL
Closed: M2

## Must address
- M1 design.md "D1": the export calls `formatAmount`, which no file defines.
  Evidence: src/format.js:2 defines `formatCents`; grep finds no `formatAmount`

## Should consider
- S1 design.md "Risks": <what>.

## Checked
- `listEntries` exists with the range the design names (src/store.js:12).
```

`Verdict: FAIL` if and only if `Must address` holds an item. The `Closed:` line appears from the second report on. Keep the ID of every problem still open; a new problem takes the next unused number. An empty section holds `- None.` Change no other file.

Done when the report exists and its first line is the verdict.

## 6. Reply

Reply with three lines at most: the verdict line, the report path, and the `Must address` IDs.

When continued after a fix, go back to step 1: the next report number, the latest report's IDs, the files that changed.
