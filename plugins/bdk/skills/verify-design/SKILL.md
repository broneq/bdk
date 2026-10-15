---
name: verify-design
description: 'Checks the spec deltas and design.md of an OpenSpec Change against the code, the proposal and the acceptance criteria of its source on the bdk:verifier agent, and writes the run file design/verify-N.md with a PASS or FAIL verdict. Use when a design is ready for review, before planning, when asked to check or verify a design, or when /bdk:design verifies an iteration.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git log *) Bash(git show *) Bash(git diff *) Read Grep Glob Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Verify design

When the block above says "BDK not configured: run /bdk:setup", stop: reply with that line and write nothing.

## 0. Run as `bdk:verifier`

This block runs on the `bdk:verifier` agent, whose instructions start with "You are `bdk:verifier`". The verifier must not be the conversation that wrote the design. When you are not that agent (a user typed the command in the main conversation), do not check the design yourself: start the agent with the Agent tool in the foreground (`run_in_background: false`), `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:verify-design with the arguments: <the arguments above>`, `model` set to `models.verifier.model` and `effort` set to `models.verifier.effort`, each only when the configuration above sets it; wait for it, reply with its verdict line and report path, and stop. Keep its agent ID: after a fix, `SendMessage` to the same agent verifies again.

Done when you are `bdk:verifier`, or the agent has answered.

## 1. Find the Change and the report number

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found and stop.

List `.bdk/runs/<change>/design/verify-*.md`. Your report is `verify-N.md` with N one above the highest number (1 when none). When an earlier report exists, read the latest one first: its open IDs carry over.

When `design.md` or the spec deltas are missing, write a report with `Verdict: FAIL` and `M1` naming the missing file, and go to step 5.

## 2. Read

Read `proposal.md`, `scope-log.md`, every `specs/**/spec.md` of the Change, `design.md`, `.bdk/runs/<change>/source/issue.md` when present, and `.bdk/runs/<change>/explore/index.md` when present with the `explore/` files whose question the design relies on (without an index, every file of `explore/`). The source, `## Intent`, `## Acceptance` and the scope log are the reference: the design answers to them, not only to the rest of the proposal. On a later pass, read again every file that changed (`git diff`, or the files the caller names) and every file an open item names.

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" rules for --stage design`, without files, as a Bash command of its own, and keep the rules it prints, each under its id.

Done when you can list each claim the design makes about existing code, and the design rules.

## 3. Check

1. **Claims about the code.** Open every file, function, type, field and command the design or explore map relies on, and check the signature and behaviour it states. A claim you could not check is a problem, not a pass. For a command-line tool's options or output, including a point the map left under `Unsure`, run its help first (`<tool> --help`, `<tool> <subcommand> --help`, `<tool> --version`) and judge the claim by its output; raise a doubt about the tool only when that command cannot run, and name the command.
2. **Capabilities.** Every capability of the proposal has a spec delta; every requirement has at least one `#### Scenario:` with WHEN and THEN that can run against the product.
3. **Coverage.** Every requirement and every "What Changes" bullet has an answer in the design; nothing in the design contradicts the specs or the proposal.
4. **Decisions.** Each decision states its choice, reason and the alternatives with why they lost.
5. **Constraints.** Every constraint or non-functional need the proposal or the specs state is met or explicitly deferred.
6. **Diagrams.** A flow, structure or state machine that prose leaves ambiguous has a diagram, and the diagram matches the prose.
7. **Risks.** Concrete: a named bottleneck, failure mode, hidden cost or unconfirmed assumption, not "could be a concern".
8. **Open questions.** Only unknowns that change neither the specs, the decisions nor the plan.
9. **Plan readiness.** The design names the modules, interfaces and data the plan parts will touch.
10. **Acceptance criteria.** List the acceptance points of `source/issue.md` (its acceptance signal and every point of its scope a user can check) and the AC of `## Acceptance`. Each point is an AC that states it as the source does, or one a log entry `By: user` changed or dropped. Each AC not dropped by such an entry is answered by a requirement of a delta or a decision of `design.md` (with `skip_specs: true`, by a section that names its id), as it stands. An entry `By: setting ...`, an open entry `By: needs-user` and a `Decided without the user:` line never cover a change of an AC. Without `source/issue.md`, check against `## Acceptance` and say so under `Checked`.

    Check each AC as it stands, not only that a scenario names its subject, and not from the design's own list of answered AC: such a list is a claim to check.
    1. Quote the AC and its condition; an AC with no condition holds in every case.
    2. Find every requirement and scenario of the deltas, and every decision, that touches its subject, also those written for another AC: an option, mode, setting or input another AC brings in (a second format, a locale, a flag) is a case the AC still covers.
    3. The AC is narrowed when one of them gives, under any option, mode or input, an outcome the AC rules out (a scenario whose THEN says the opposite), or limits the AC to fewer cases than its condition ("only under the default", "when the output is JSON"). A requirement that words the rule on something else ("the selected unit" for "metres") narrows it as soon as an option makes the two differ.

    Write one `Checked` line per AC: its id, the quoted condition, and the requirements and scenarios read, with every option or mode of the deltas under which the AC holds.
11. **Rules.** The design breaks no rule of step 2, unless a decision records the user's agreement to depart from it.

## 4. Sort

- **Must address**: a defect that would make the plan or the product wrong. A false claim about the code; a requirement without an answer, or one the design contradicts; a capability without a spec delta; a scenario that cannot run; a failure path the specs imply and the design ignores; a decision against the proposal; a design that breaks a rule of step 2 without the user's agreement, the item naming the rule's id; an acceptance point of the source that `## Acceptance` lacks or states differently, or an AC the deltas or the design drop, narrow (also under one option or mode only), reinterpret or leave unanswered, with no `By: user` entry of `scope-log.md` for it, the item naming the AC id and its evidence quoting the source or the AC.
- **Should consider**: every other gap from step 3.

Not a problem: wording, style, a choice among valid alternatives the design argued, anything outside the proposal and its source. An AC is never outside the proposal. A proposal without `## Acceptance` (written before BDK kept AC) is a `Should consider` item, not a `Must address` one.

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
