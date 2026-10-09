---
name: plan
description: 'Runs the plan stage of an OpenSpec Change - drafts the plan parts with plan-draft on bdk:planner, checks them with bdk plan check, and verifies them with verify-plan on bdk:verifier, fixing and verifying again until a report passes or policy.budgets.verifier is spent. Stops on an unfinished design or a gap of the design. Resumes from the run files. Use when a Change has its specs and design and needs a plan, when asked to "plan" a Change, or when /bdk:run reaches the plan stage.'
argument-hint: "[change-name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Read Glob Grep Agent SendMessage ToolSearch
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Plan

You compose the plan blocks; you never do a block's work. Do not write, fix or check a plan part yourself, and write no file: the blocks do that. Never commit, create a branch or start the execute stage.

The blocks:

- **plan-draft**: start an agent with the Agent tool, `subagent_type: "bdk:planner"`, prompt `Run the skill bdk:plan-draft with the arguments: <change>`, `model` set to `models.planner.model` and `effort` set to `models.planner.effort`, each only when the configuration above sets it. Start a new planner each time this block runs. It writes the parts `openspec/changes/<change>/plan/parts/NN.md`, or fixes them when the last report failed, and runs `bdk plan check` itself.
- **check**: run `${CLAUDE_PLUGIN_ROOT}/bin/bdk plan check openspec/changes/<change>/plan/parts` as the whole Bash command: without quotes around the path, without `cd`, `;`, `&&` or `echo`, because the grant `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)` matches no other form and a denied call stops the stage. The exit code comes back in the tool result. It prints the waves, and the problems under `problems:` with exit 1; exit 3 is an environment problem.
- **verify-plan**: start an agent with the Agent tool, `subagent_type: "bdk:verifier"`, prompt `Run the skill bdk:verify-plan for the Change <change>.`, `model` set to `models.verifier.model` and `effort` set to `models.verifier.effort`, each only when the configuration above sets it. It writes the next `.bdk/runs/<change>/plan/verify-N.md` and returns its verdict line. Keep the agent ID it returns.

Before each block, tell the user in one line which block runs and which file it writes, e.g. `Drafting the plan: bdk:planner writes openspec/changes/add-csv-export/plan/parts/`, `Checking the plan: bdk:verifier writes .bdk/runs/add-csv-export/plan/verify-1.md`.

## 1. Check the configuration and the Change

When the block above says `BDK not configured: run /bdk:setup` or that the configuration is invalid, stop: run no block and reply with that line. Otherwise note `policy.budgets.verifier` (3 when absent).

The argument names the Change. Without one, list `openspec/changes/` and take the only directory other than `archive/`. With none or several, name what you found, ask which Change to plan, and stop.

The plan needs a finished design. Stop, run no block, and name `/bdk:design <change>` as the stage to run first when:

- `openspec/changes/<change>/` has no `proposal.md`, no `specs/**/spec.md` or no `design.md`;
- the last design report `.bdk/runs/<change>/design/verify-N.md` (highest N) exists and its first line is not `Verdict: PASS`.

A design without any design report was written by hand: plan it.

Done when you hold the Change name and the budget, and the design is finished.

## 2. Find where to start

Glob `openspec/changes/<change>/plan/parts/*.md` and `.bdk/runs/<change>/plan/verify-*.md`. The last report is `verify-N.md` with the highest N; read its first line. Take the first row that matches:

| # | Files | Start at |
|---|---|---|
| 1 | no part | step 3 |
| 2 | parts, no report | step 4 |
| 3 | the last report says `Verdict: FAIL` | step 5, starting with the fix |
| 4 | the last report says `Verdict: PASS` | nothing to run: go to step 6 and report the passed plan |

A step whose file exists never runs again. Done when you know the row.

## 3. Draft

Run **plan-draft** with `<change>`. Read its reply:

- It names a gap of the design (a choice that changes what the product does, which the specs and the design leave open): stop here, before any verification. Quote each gap, and name `/bdk:design <change>` to answer it and `/bdk:plan <change>` to plan again afterwards. A plan without that part would pass verification and miss the behaviour.
- It stops on a configuration or environment problem: pass it on and stop.

Done when the parts exist and no gap is named.

## 4. Check

Run **check**.

- Exit 0: keep its `waves:` lines for the report and go on.
- Exit 1, the first time in this step: run **plan-draft** with `<change>`; it fixes what the check lists. Then check again.
- Exit 1 after that: stop before the verifier. List the problems and say that the limits are `plan.part.*` in the configuration.
- Exit 3: pass the message on and stop.

Done when the check exits 0.

## 5. Verify within the budget

Count the verifier passes you start in this run; at most `policy.budgets.verifier`.

1. When the last report says `Verdict: FAIL` (row 3, or a failed pass of this loop): run **plan-draft** with `<change>`; it fixes the report's `Must address` items. When its reply names a gap of the design, stop as in step 3. Then run step 4 and come back.
2. Verify: the first pass of this run starts the **verify-plan** agent. A later pass continues the same agent with `SendMessage` (load it first with `ToolSearch` query `select:SendMessage` when it is listed only by name): `Verify the plan of <change> again: plan-draft fixed it.` Without the agent's ID or the tool, start a new **verify-plan** agent instead; the report numbers and open IDs come from the files either way.
3. Tell the user the verdict line and the report path.
4. `Verdict: PASS`: go to step 6. `Verdict: FAIL` with budget left: back to 1. `Verdict: FAIL` with the budget spent: stop, and run no further **plan-draft**. Report the last report's path, its open `Must address` IDs, and that `/bdk:plan <change>` continues with a new budget.

Done when the last report passes, or you stopped on a spent budget.

## 6. Report

Reply in a few lines:

- the part files, from Glob;
- the waves and their number, from the last check (row 4: run **check** once for them);
- the last verdict with its report path, and the verifier passes used of the budget;
- the choices `plan-draft` named as made inside the design's frame;
- after a passing report, the next stage: `/bdk:execute <change>`.

End your turn there; the plan stays uncommitted for review.
