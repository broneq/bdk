---
name: verify-plan
description: 'Checks the plan parts of a BDK Change against the code, the spec deltas and the design before execute, in a bdk:verifier agent, and writes .bdk/runs/CHANGE/plan/verify-N.md with Verdict PASS or FAIL. Use when a Change has plan/parts and they should be checked before implementing, or when bdk:verifier is asked to run bdk:verify-plan.'
argument-hint: "[change name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Read Write Glob Grep Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Verify plan

The block above says `BDK not configured: run /bdk:setup` or `BDK configuration invalid`: write nothing, pass that line on, stop.

## 0. Where you run

The check runs on a fresh context in the agent `bdk:verifier`, so it reads the plan as the implementers will.

- **You are not `bdk:verifier`** (the main thread, or any other agent): do not check the plan yourself. Start one agent with the `Agent` tool in the foreground (`run_in_background: false`): `subagent_type: "bdk:verifier"`, the prompt `Run the skill bdk:verify-plan for the Change <change>.` (the argument above; without one, say so and let it pick), `model` set to `models.verifier.model` and `effort` set to `models.verifier.effort`, each only when the configuration above sets it. Wait for it. Reply with its verdict line, the report path and its `Must address` IDs, and stop.
- **You are `bdk:verifier`**: continue with step 1. When you were continued with a message after a fix, start again at step 1; the previous report is now the last one.

## 1. Find the plan

- The Change is the argument. Without one, Glob `openspec/changes/*/plan/parts/01.md` (ignore `archive/`): one match is the Change; several: name them and stop.
- No `plan/parts/*.md` in the Change: write nothing, reply that the plan is missing and `/bdk:plan-draft` writes it, stop.
- Glob `.bdk/runs/<change>/plan/verify-*.md`. Your report is `verify-N.md`, N one more than the highest existing number (1 when none). When one exists, read the last one now: its IDs carry over (your agent instructions, "The report").

Done when you know the Change and your report path.

## 2. Read

Read every part, the proposal, every spec delta and the design. List every scenario of the spec deltas as `<capability>` / `Requirement: <name>` / `Scenario: <name>`. Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" plan check openspec/changes/<change>/plan/parts` and keep its output: waves and problems.

For each part, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" rules for --stage plan --files <file> --files <file> ...` with the part's `files`, one `--files` per path, as a Bash command of its own, and keep the rules it prints for that part. A rule another part's files select does not hold for this part.

## 3. Check

Go through every part and task. Open the code each task names; do not take a claim of the plan on trust.

Put into **Must address** what makes an implementer build the wrong thing, fail or stop:

1. Every problem `bdk plan check` lists. Evidence: its output line.
2. A task without one of the lines `File:`, `Interface:`, `Verified by:`, or a `File:` path missing from the part's `files`.
3. A path, function, type or command the task names as existing that does not exist as named: a wrong name, a wrong signature, a wrong module. Evidence: the file and line of what does exist, or the search that found nothing.
4. A scenario of the spec deltas that no part names under `## Acceptance scenarios`, or that two parts name.
5. A decision of the design that no task carries out.
6. A part that uses what another part creates (a function, a type, a file) without depending on it, directly or through other parts. Trace two or three concrete inputs through the tasks that change behaviour: the value one part produces must be what the next part reads.
7. A fact a part needs that only another part states: a signature from an earlier part, a source, a command. The implementer reads only its own part, the specs and the design.
8. A `Verified by:` line that names commands by exclusion ("every test except ..."), or a command that spends money, needs credentials or reaches a shared or external system.
9. An interface the plan changes whose callers behave differently and no task covers them. Find the callers with Grep.
10. A part that breaks a rule selected for its files in step 2. The item names the rule's id and the part; evidence: the rule's sentence and the part's task or `files` that break it.

Put into **Should consider** the rest: a cut with fewer waves (more than three waves needs a reason), code written into a task, an unclear sentence, a part close to a limit.

Done when every part and task is checked and every `Must address` item has its evidence.

## 4. Write the report

Write `.bdk/runs/<change>/plan/verify-N.md` in the report body of your agent instructions. Under `## Checked`, name what holds, for example: `bdk plan check`: 2 parts, 2 waves, no problem; every scenario owned once; signatures of the named functions match the code.

Change no other file. Then return the verdict line, the report path and the `Must address` IDs.
