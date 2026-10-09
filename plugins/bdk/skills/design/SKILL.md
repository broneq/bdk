---
name: design
description: 'Runs the design stage of an OpenSpec Change - maps the code with explore, drafts the specs and design.md with design-draft, checks them with verify-design until a report passes or policy.budgets.verifier is spent, then applies the design gate of policy.gates.design. Resumes from the run files. Use when a Change has a proposal and needs its design, when asked to "design" a Change, or when /bdk:run reaches the design stage.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Read Glob Grep Write Skill Agent SendMessage ToolSearch AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Design

You compose three blocks and apply the gate; you never do a block's work. Do not map the code, write or fix a spec delta or `design.md`, or check the design yourself: the blocks do that. The only file you write is the gate file `.bdk/runs/<change>/design/gate.md`. Never commit, create a branch or start the plan stage.

The blocks:

- **explore**: start an agent with the Agent tool, `subagent_type: "bdk:explorer"`, prompt `Run the skill bdk:explore with the arguments: <change>`, and `model` set to `models.explorer` when the configuration above sets it. It writes `.bdk/runs/<change>/design/explore.md`.
- **design-draft**: call the Skill tool with `bdk:design-draft` and the arguments `<change>` (or `<change> <revision request>` after a gate asking for changes). It runs here, in the main thread, because it may ask the user; it writes the spec deltas and `design.md`, or fixes them when the last report failed.
- **verify-design**: start an agent with the Agent tool, `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:verify-design with the arguments: <change>`, and `model` set to `models.verifier` when the configuration above sets it. It writes the next `.bdk/runs/<change>/design/verify-N.md` and returns its verdict line. Keep the agent ID it returns.

Before each block, tell the user in one line which block runs and which file it writes, e.g. `Mapping the code: bdk:explorer writes .bdk/runs/add-csv-export/design/explore.md`.

## 1. Check the configuration and the Change

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: run no block, write nothing, and reply with that line. Otherwise note `policy.gates.design` (`manual` when absent) and `policy.budgets.verifier` (3 when absent).

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found, ask which Change to design, and stop. When `openspec/changes/<change>/proposal.md` is missing, stop: run no block and name `/bdk:propose` as the stage to run first.

Done when you hold the Change name, the gate setting and the budget.

## 2. Find where to start

List `.bdk/runs/<change>/design/`, and check whether `openspec/changes/<change>/design.md` exists. The last report is `verify-N.md` with the highest N; read its first line. Take the first row that matches:

| # | Files | Start at |
|---|---|---|
| 1 | `gate.md` says `Gate: approved` and its `Report:` line names the last report | nothing to run: go to step 6 and report the approved design |
| 2 | no `explore.md` and no `design.md` | step 3, explore |
| 3 | no `design.md` | step 3, design-draft |
| 4 | no `verify-N.md` | step 4 |
| 5 | the last report says `Verdict: FAIL` | step 4, starting with the fix |
| 6 | the last report says `Verdict: PASS` | step 5 |

A step whose file exists never runs again. Done when you know the row.

## 3. Map and draft

1. Without `explore.md` and `design.md`: run **explore** and wait for it.
2. Run **design-draft** with `<change>`. When it ends its turn with questions for the user instead of writing files, stop here as well: the user's answers continue it, and a later `/bdk:design <change>` resumes at row 3.

Done when `design.md` exists.

## 4. Verify within the budget

Count the verifier passes you start in this run; at most `policy.budgets.verifier`.

1. When the last report says `Verdict: FAIL` (row 5, or a failed pass of this loop): run **design-draft** with `<change>`; it fixes the report's `Must address` items. Then verify.
2. Verify: the first pass of this run starts the **verify-design** agent. A later pass continues the same agent with `SendMessage` (load it first with `ToolSearch` query `select:SendMessage` when it is listed only by name): `Verify the design of <change> again: design-draft fixed it.` Without the agent's ID or the tool, start a new **verify-design** agent instead; the report numbers and open IDs come from the files either way.
3. Tell the user the verdict line and the report path.
4. `Verdict: PASS`: go to step 5. `Verdict: FAIL` with budget left: back to 1. `Verdict: FAIL` with the budget spent: stop before the gate and write no gate file. Report the last report's path, its open `Must address` IDs, and that `/bdk:design <change>` continues with a new budget.

Done when the last report passes, or you stopped on a spent budget.

## 5. Apply the design gate

Collect every line of `design.md` that starts with `Decided without the user:` (Grep, not a full read).

- `policy.gates.design: auto`: approve without asking.
- `manual`: ask with one `AskUserQuestion` call, header `Design gate`: approve the design of `<change>`? Name `design.md`, the spec deltas, the passing report and the decisions taken without the user. Options: `Approve` (recommended) and `Request changes` (the user says what to change in a note or in "Other").
  - Approve: approved.
  - Request changes: run **design-draft** with `<change> <the requested change>`, then go back to step 4, verify step, within the same budget; after a pass, ask again.
  - When `AskUserQuestion` is not available: ask in your reply whether the design may be approved, naming the same files and decisions, and end your turn without writing the gate file. When the user approves in the conversation, write the gate file then.

On approval write `.bdk/runs/<change>/design/gate.md`:

```markdown
Gate: approved
By: user
Report: design/verify-2.md
```

`By:` is `user`, or `policy.gates.design auto` for the automatic gate; `Report:` names the passing report. Done when the gate file exists, or you asked for approval and ended your turn.

## 6. Report

Reply in a few lines:

- the files written in this run (`explore.md`, the spec deltas, `design.md`, each `verify-N.md`, `gate.md`);
- the last verdict and the verifier passes used of the budget;
- every `Decided without the user:` line of `design.md`;
- the gate's outcome;
- after an approval, the next stage: `/bdk:plan <change>`.

End your turn there; the design stays uncommitted for review.
