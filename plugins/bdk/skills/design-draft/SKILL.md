---
name: design-draft
description: 'Drafts the spec deltas and design.md of an OpenSpec Change from its proposal and the code map - approaches with diagrams and self-critique, questions to the user through a Lavish page or AskUserQuestion (or decided and recorded by policy) - and fixes them after a failed design verification. Use when a Change has a proposal and needs its specs and design, when asked to design a Change, or when /bdk:design drafts or fixes a design.'
argument-hint: "[change-name] [what to focus on]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(openspec *) Bash(npx -y @fission-ai/openspec@1.13.2 *) Bash(npx -y lavish-axi *) Bash(rm openspec/changes/*/specs/*/spec.md) Read Grep Glob Write Edit Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Design draft

When the block above says "BDK not configured: run /bdk:setup", stop: reply with that line and write nothing.

You write the Change's spec deltas and `design.md`, the `proposal.md` edits a scope answer needs, and your Lavish pages, nothing else: no code, no plan parts, no run files. Run each command on its own, without pipes or `&&`.

## 0. Run on the designer

This block runs on the `bdk:designer` agent, whose instructions start with "You are `bdk:designer`". When you are that agent, go to step 1. When you are not (a user typed the command, or another skill invoked this one in the main thread), do not read the code or write a file yourself:

1. Start the agent with the Agent tool in the foreground (`run_in_background: false`): `subagent_type: "bdk:designer"`, prompt `Run the skill bdk:design-draft with the arguments: <the arguments above>`, `model` set to `models.designer.model` and `effort` set to `models.designer.effort`, each only when the configuration above sets it. Keep the agent ID it returns.
2. When it ends with `Page open: <page>`: the page is where the user answers; the decisions listed after that line are only for you to name. Tell the user in one line that the questions are on that page in the browser, then always wait for the feedback with `npx -y lavish-axi poll <page>` in the foreground, whatever else the designer reports about the page; never ask the page's questions in your reply instead (Bash `timeout` 600000; run it again when it times out). Continue the same agent with `SendMessage` (load it first with `ToolSearch` query `select:SendMessage` when it is listed only by name): `Answers: <the poll's output, verbatim>`. Do not summarise, interpret or settle anything in it: a note the user wrote may open a new decision, and only the designer decides that. When the poll is interrupted, or the user asks to stop waiting, do not poll again in this turn: answer what the user asked, name the page and its open decisions, say that answers given on the page stay queued and that `/bdk:design-draft <change>` picks them up, and end your turn.
3. When it ends with open questions and no page: ask them with `AskUserQuestion`: at most four questions per call, the recommended option first, each option one label and one sentence. Then continue the same agent with `SendMessage`: `Answers: <question>: <chosen option or the user's note>; ...`. Without the tool or the agent ID, start a new designer as in 1 with the arguments `<change> Answers: ...`.
4. When `AskUserQuestion` is not available: say that the browser review page (Lavish) could not open, when the designer says so, then list the questions in your reply, numbered, the recommended option first and marked "(recommended)", and end the reply with one line saying how to answer (`Reply with the numbers of your choices, or your own answer.`). When the user answers in the conversation, send the answers as in 3.
5. The designer may come back with a further round (2 to 4 again) until it writes the files. Then reply with the agent's reply and stop.

Done when the designer has written the files or the questions are with the user.

## 1. Find the Change and the mode

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found, ask which one, and stop.

List `.bdk/runs/<change>/design/verify-*.md`. When the latest one starts with `Verdict: FAIL`, this is a **fix**: go to "Fix after a failed verification". Otherwise, when `design.md` exists and the arguments hold text after the Change name, this is a **revision**: go to "Revise on a request". Otherwise this is a **draft**.

Note `policy.questions` from the configuration above (`stop` when absent). Text after the Change name that starts with `Answers:`, or a message with answers, decides the open decisions it names: do not ask them again.

## 2. Ground in the code

Read `proposal.md` and `.bdk/runs/<change>/design/explore.md`, and the project's rules: `CLAUDE.md` at the root, `.claude/rules/*.md`, and the `rules` of `openspec/config.yaml`, each when present. Every recommendation follows them, and step 4 checks the user's answers against them. Without the map, read the code the proposal touches yourself (its nouns, their callers one level out, their tests) before anything else. Every claim you later make about the code comes from a file and line you read; the verifier checks each one.

Read the files with Read, not with `cat`. Then run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" rules for --stage design`, without files, as a Bash command of its own: it prints the design rules of the BDK pack and of the project, each under its id. Each rule is a constraint on the design. When a rule and the proposal pull apart, the departure is an open decision (step 3).

Done when you know what exists, which patterns the project uses, what is missing, and which rules hold.

## 3. Find the decisions

List what the Change must decide: each branching technical decision (where the logic lives, data shape, interfaces, failure handling) and each product point the proposal leaves open (formats, limits, defaults, what the user sees on failure).

For each branching decision, weigh at least two approaches as [approaches](references/approaches.md) describes, and pick a recommendation. When only one is viable, say why the others fail.

Sort each decision: **settled** when the proposal, the code, a rule of step 2 or the project's conventions answer it; **open** when they do not. A data-model change (new or changed fields, tables, migrations) is always open: approval of a design is not approval of a schema.

Done when every decision has a recommendation and is settled or open.

## 4. Ask in rounds

With no open decision, go to step 5.

With `policy.questions: decide-and-record`: ask nothing. Take the recommended answers; step 6 records them.

Otherwise ask in rounds, at most three. Round 1 asks every open decision; a later round asks only what the last answers opened (below), never an answered decision again. Each question puts the recommended option first, each option with its trade-off in one line.

1. **Lavish.** Write the round's page: `.lavish/design-<change>.html` for round 1, `.lavish/design-<change>-<round>.html` for a later one (a new file, because the user may have ended the last page's session). One card per open decision with its options as radio inputs, the recommended one checked, a short trade-off per option, and a free-text note. Run `npx -y lavish-axi playbook input` once for the page shape first. Open the page with `npx -y lavish-axi <page>`. When it opens, end your turn: the first line `Page open: <page>`, then the round's decisions, numbered, the recommended option first. Do not poll: the thread that started you waits for the feedback, so the user can stop the wait, and sends it back as `Answers: ...`. Write nothing else before the answers.
2. **In your reply** when the Lavish open command exits non-zero: list the round's decisions as numbered questions, each with its options, the recommended option first and marked "(recommended)", each option with its trade-off in one line, and end your turn. Write nothing before the answers: the thread that started you asks the user and sends them back.

Resuming: when a round's page exists, `design.md` does not, and no answers came with the arguments or a message, the user has not answered yet. Open the latest page again with `npx -y lavish-axi <page>` and end your turn as in 1 with its decisions; write no new page.

When answers arrive, apply them, then look for what they opened:

- a free note asking for something no decision covers: a new decision;
- an answer that adds, drops or narrows a capability or a "What Changes" item of the proposal: a scope change ([Scope changes and deviations](#scope-changes-and-deviations));
- an answer that contradicts the acceptance signal the proposal carries, or a rule of step 2 (`CLAUDE.md`, `.claude/rules/`, the `rules` of `openspec/config.yaml`, a rule `bdk rules for` printed): a decision to confirm. Quote the rule and its file or id; options "Follow the rule" (recommended) and "Keep <the answer> as a deviation".

Ask what they opened in the next round. A decision still open after round 3 takes the recommended answer; step 6 marks it `Decided without the user:`.

Done when every open decision has an answer.

## 5. Write the spec deltas

Get the instruction and template: `openspec instructions specs --change <change> --json` (or `npx -y @fission-ai/openspec@1.13.2 instructions ...`); when neither runs, read the `specs` artifact of `openspec/schemas/<schema>/schema.yaml` (the schema is in `openspec/changes/<change>/.openspec.yaml`) and its template. Follow it, and the `rules` it returns.

Write one `openspec/changes/<change>/specs/<capability>/spec.md` per capability the proposal names: behaviour only, every requirement with SHALL and at least one `#### Scenario:` with **WHEN** and **THEN** that can run against the product. Put each answer of step 4 where it belongs (a delimiter, a format, a limit is a requirement).

## 6. Write the design

Get the `design` instruction and template the same way, and write `openspec/changes/<change>/design.md`:

- **Context** checked against the code, with `file:line` for what exists.
- **Decisions** numbered D1, D2, ...: the choice, the reason, the alternatives with why each lost. A decision that follows from a rule names its id in the reason (`follows IO-1`); one that departs from a rule names the id and the user's agreement. Under every decision taken by policy without asking, or left open after round 3, a line `Decided without the user: <why this answer>`; under a decision that changed the scope or kept a deviation, its `Scope changed by the user:` or `Deviation:` line.
- **Diagrams**: a Mermaid diagram for each flow or structure that prose leaves ambiguous, edges labelled, small.
- **Risks / Trade-offs** from the self-critique of [approaches](references/approaches.md): at least a bottleneck, a failure mode or operational risk, a hidden cost, an assumption the user did not confirm.
- **Open Questions**: only unknowns that change neither the specs, the decisions nor the plan.
- Name the modules, interfaces and data the plan parts will touch. No code.

Done when both files exist. When an OpenSpec CLI runs, run `openspec validate <change> --strict` and fix what it reports.

## 7. Reply

Reply briefly: the files written, each decision taken without the user, each scope change and deviation, and the questions asked with their answers, by round.

## Scope changes and deviations

You own the edits of `proposal.md` that a user's answer needs; nothing else changes it after `/bdk:propose`.

- **Scope change.** Before step 5, edit `proposal.md` with Edit: What Changes, the capability lists and Out of scope, so they match the answer (a dropped capability moves to Out of scope with the reason). Change nothing else in it. Write no spec delta for a dropped capability; in a revision, delete one already written with `rm openspec/changes/<change>/specs/<capability>/spec.md`. Under the decision in `design.md`, a line `Scope changed by the user: <what changed and why>`.
- **Deviation.** When the user keeps an answer that contradicts the acceptance signal or a project rule, record it under the decision in `design.md`: `Deviation: <the rule or the acceptance signal> (<its file or rule id, or "proposal">) - <what the user chose and why>`, and move what it drops to Out of scope of `proposal.md`. Never write to the GitHub issue: the caller reports each deviation so the user changes the issue.

## Fix after a failed verification

Read the latest `verify-N.md`. For each `Must address` item, change the spec delta or `design.md` so the defect is gone: read the code the evidence names before you change a claim about it. For each `Should consider` item, fix it or keep a one-line reason to leave it. Ask the user (step 4) only when a fix changes a decision the user took; under `decide-and-record`, record the new answer instead.

Change only what the items need. Run `openspec validate <change> --strict` when a CLI runs. Reply with the IDs fixed and the IDs left, each left one with its reason.

## Revise on a request

The text after the Change name is a change the user asked for, often at the design gate of `/bdk:design`. Read `proposal.md`, the spec deltas and `design.md`, and the code the request touches. Change the spec deltas and `design.md` only as far as the request needs, and `proposal.md` when it changes the scope ([Scope changes and deviations](#scope-changes-and-deviations)); keep every other decision as it is. When the request leaves a decision open, ask it as step 4 says (under `decide-and-record`, take the recommended answer and record it).

Run `openspec validate <change> --strict` when a CLI runs. Reply with what you changed, in a few lines.
