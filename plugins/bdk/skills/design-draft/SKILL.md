---
name: design-draft
description: 'Drafts the spec deltas and design.md of an OpenSpec Change from its proposal and the code map - approaches with diagrams and self-critique, questions to the user through a Lavish page or AskUserQuestion (or decided and recorded by policy) - and fixes them after a failed design verification. Use when a Change has a proposal and needs its specs and design, when asked to design a Change, or when /bdk:design drafts or fixes a design.'
argument-hint: "[change-name] [what to focus on]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(openspec *) Bash(npx -y @fission-ai/openspec@1.13.2 *) Bash(npx -y lavish-axi *) Read Grep Glob Write Edit AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Design draft

When the block above says "BDK not configured: run /bdk:setup", stop: reply with that line and write nothing.

You write the Change's spec deltas and `design.md`, and nothing else: no code, no plan parts, no run files. Run each command on its own, without pipes or `&&`.

## 1. Find the Change and the mode

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found, ask which one, and stop.

List `.bdk/runs/<change>/design/verify-*.md`. When the latest one starts with `Verdict: FAIL`, this is a **fix**: go to "Fix after a failed verification". Otherwise this is a **draft**.

Note `policy.questions` from the configuration above (`stop` when absent).

## 2. Ground in the code

Read `proposal.md` and `.bdk/runs/<change>/design/explore.md`. Without the map, read the code the proposal touches yourself (its nouns, their callers one level out, their tests) before anything else. Every claim you later make about the code comes from a file and line you read; the verifier checks each one.

Done when you know what exists, which patterns the project uses, and what is missing.

## 3. Find the decisions

List what the Change must decide: each branching technical decision (where the logic lives, data shape, interfaces, failure handling) and each product point the proposal leaves open (formats, limits, defaults, what the user sees on failure).

For each branching decision, weigh at least two approaches as [approaches](references/approaches.md) describes, and pick a recommendation. When only one is viable, say why the others fail.

Sort each decision: **settled** when the proposal, the code or the project's conventions answer it; **open** when they do not. A data-model change (new or changed fields, tables, migrations) is always open: approval of a design is not approval of a schema.

Done when every decision has a recommendation and is settled or open.

## 4. Ask, once

With no open decision, go to step 5.

With `policy.questions: decide-and-record`: ask nothing. Take the recommended answers; step 6 records them.

Otherwise ask every open decision in one round, the recommended option first, each option with its trade-off in one line:

1. **Lavish.** Write `.lavish/design-<change>.html`: one card per open decision with its options as radio inputs, the recommended one checked, a short trade-off per option, and a free-text note. Run `npx -y lavish-axi playbook input` once for the page shape first. Open the page with `npx -y lavish-axi .lavish/design-<change>.html`, then wait with `npx -y lavish-axi poll .lavish/design-<change>.html` (Bash `timeout` 600000; run it again if it times out). The poll returns the user's feedback: apply it.
2. **`AskUserQuestion`** when the Lavish open command exits non-zero: at most four questions per call, each option one label and one sentence.
3. **In your reply** when `AskUserQuestion` is not available either: list the open decisions as numbered questions, the recommended option first and marked "(recommended)", say that the specs and design are written once they are answered, and end your turn. Write nothing before the answers.

Done when every open decision has an answer.

## 5. Write the spec deltas

Get the instruction and template: `openspec instructions specs --change <change> --json` (or `npx -y @fission-ai/openspec@1.13.2 instructions ...`); when neither runs, read the `specs` artifact of `openspec/schemas/<schema>/schema.yaml` (the schema is in `openspec/changes/<change>/.openspec.yaml`) and its template. Follow it, and the `rules` it returns.

Write one `openspec/changes/<change>/specs/<capability>/spec.md` per capability the proposal names: behaviour only, every requirement with SHALL and at least one `#### Scenario:` with **WHEN** and **THEN** that can run against the product. Put each answer of step 4 where it belongs (a delimiter, a format, a limit is a requirement).

## 6. Write the design

Get the `design` instruction and template the same way, and write `openspec/changes/<change>/design.md`:

- **Context** checked against the code, with `file:line` for what exists.
- **Decisions** numbered D1, D2, ...: the choice, the reason, the alternatives with why each lost. Under every decision taken by policy without asking, a line `Decided without the user: <why this answer>`.
- **Diagrams**: a Mermaid diagram for each flow or structure that prose leaves ambiguous, edges labelled, small.
- **Risks / Trade-offs** from the self-critique of [approaches](references/approaches.md): at least a bottleneck, a failure mode or operational risk, a hidden cost, an assumption the user did not confirm.
- **Open Questions**: only unknowns that change neither the specs, the decisions nor the plan.
- Name the modules, interfaces and data the plan parts will touch. No code.

Done when both files exist. When an OpenSpec CLI runs, run `openspec validate <change> --strict` and fix what it reports.

## 7. Reply

Reply briefly: the files written, each decision taken without the user, and the questions asked with their answers.

## Fix after a failed verification

Read the latest `verify-N.md`. For each `Must address` item, change the spec delta or `design.md` so the defect is gone: read the code the evidence names before you change a claim about it. For each `Should consider` item, fix it or keep a one-line reason to leave it. Ask the user (step 4) only when a fix changes a decision the user took; under `decide-and-record`, record the new answer instead.

Change only what the items need. Run `openspec validate <change> --strict` when a CLI runs. Reply with the IDs fixed and the IDs left, each left one with its reason.
