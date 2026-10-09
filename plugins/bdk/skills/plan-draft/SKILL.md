---
name: plan-draft
description: 'Writes the plan of a BDK Change - plan parts openspec/changes/CHANGE/plan/parts/NN.md with depends-on, isolation, files, acceptance scenarios from the spec deltas and tasks as contracts (File, Interface, Verified by) - cut into few waves and checked with bdk plan check; after a failed plan verification, fixes what its Must address names. Use when a Change has its specs and design and needs an implementation plan, or when plan/verify-N.md failed.'
argument-hint: "[change name]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Read Write Edit Glob Grep Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Plan draft

Write the plan parts of one Change so that one implementer agent per part builds it without coming back, and so that the parts run in as few waves as possible. You write parts only: never code, specs, the proposal or the design. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own. Read and search with Read, Glob and Grep.

## 0. Run on the planner

This block runs on the `bdk:planner` agent, whose instructions start with "You are `bdk:planner`". When you are that agent, go to step 1. When you are not (a user typed the command, or another skill invoked this one in the main thread), do not read the design or write a part yourself: start the agent with the Agent tool, `subagent_type: "bdk:planner"`, prompt `Run the skill bdk:plan-draft with the arguments: <the arguments above>`, `model` set to `models.planner.model` and `effort` set to `models.planner.effort`, each only when the configuration above sets it. Wait for it, reply with its reply, and stop.

## 1. Start

- The block above says `BDK not configured: run /bdk:setup` or `BDK configuration invalid`: write nothing, pass that line on, stop.
- The Change is the argument. Without one, Glob `openspec/changes/*/design.md` (ignore `archive/`): one match is the Change; several: name them, ask which, stop.
- The Change needs `proposal.md`, at least one `specs/**/spec.md` and `design.md`. Name what is missing and stop.
- Glob `.bdk/runs/<change>/plan/verify-*.md`. The one with the highest number is the last report. When it exists and its first line is not `Verdict: PASS`, go to step 6. Otherwise, when parts exist, you are redrafting: keep what still holds.

Done when you know the Change and whether this is a draft or a fix.

## 2. Read

Read the proposal, every spec delta in full and the design. List every scenario of the spec deltas as `<capability>` / `Requirement: <name>` / `Scenario: <name>`, where `<capability>` is the spec's directory under `specs/`. Then read the code the design names: each module it changes, the functions it calls, the callers of what it changes, the tests beside them, and the test setup (`package.json` scripts or the project's equivalent, the `tools.test` commands above).

Every path, function, type and command a task will name as existing comes from a file you read, exactly as written there. A task never guesses a signature.

When the specs and the design leave open a choice that changes what the product does, and the code does not settle it, do not decide it: name it in the reply as a gap of the design, write no part for it, and stop if nothing can be planned without it. A gap is about behaviour this Change adds or changes; behaviour no requirement of the Change touches (an input or a command it does not name) is not a gap: leave it as the code has it and plan nothing for it. Choices inside the design's frame (a file name, a private helper, the order of tasks) are yours; list them in the reply.

Done when every scenario is listed and every symbol you will name is confirmed in the code.

## 3. Cut the parts

Wave depth decides how long execute takes: parts of one wave run in parallel, one agent each.

1. Find the contracts several parts need (a type, a function signature, a file format). When a later part cannot be tested without them, put them first, in a part as small as it can be.
2. Split the rest by the files it touches. Parts that share no file and use nothing of each other run in the same wave.
3. Keep a task's tests in the part of the code they test.
4. `depends-on` lists only the parts whose output this part uses. Every extra edge lengthens the run.
5. `isolation: shared` only when the part changes state outside its `files` that a parallel part could also change: a lockfile, generated code, a migration sequence. Every other part is `worktree`.
6. Assign every scenario to exactly one part: the part whose code makes it true.

Aim for the fewest waves the dependencies allow; a chain longer than three waves needs a reason in the reply. Respect the part limits `plan.part.*` in the configuration (default 5 tasks, 10 files, 8192 bytes): a unit of work over a limit becomes two parts that can share a wave.

Done when each part has its files, dependencies and scenarios, and no two parts of one wave share a file.

## 4. Write the parts

Write `openspec/changes/<change>/plan/parts/NN.md`, `NN` from `01` in the order the parts can be done. Follow the part format of the project's schema (`openspec/schemas/bdk/templates/part.md`); [a worked part](references/part-example.md) shows a complete one. Read it before writing the first part.

- Frontmatter: `id` quoted (`"01"`), `depends-on` (`[]` when none), `isolation`, `files` as exact repository-relative paths, tests included, no globs or directories.
- `## Goal`: what works after the part, one or two sentences.
- `## Acceptance scenarios`: the part's scenarios, one per line, as listed in step 2.
- `## Tasks`: numbered contracts, no code. Each task:

  ```markdown
  1. <what changes, in one line>
     - File: <paths from the part's files>
     - Interface: <signature of the function, command, endpoint or type that changes; none when no interface changes>
     - Verified by: <spec scenario, test file, or both>
  ```

The implementer reads only its part, the specs and the design. Write into each part every fact it needs: the exact signature of what an earlier part provides, the source a file is copied from, a constant, the command that runs its tests. A fact several parts need goes into each of them.

`Verified by:` names tests, scenarios or exact commands. Never a set described by exclusion ("every command except ..."), never a command that spends money, needs credentials or reaches a shared or external system.

Done when every scenario is named in one part and every task has its three lines.

## 5. Check

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" plan check openspec/changes/<change>/plan/parts`. Exit 1 lists problems under `problems:`: fix each (split an oversized part, quote an id, move a shared file into one part or add the dependency) and run it again. Exit 3 is an environment problem: pass it on and stop.

Done when it exits 0. Keep its `waves:` lines for the reply.

## 6. Fix after a failed verification

Read the last report. Fix every item under `## Must address` in the parts it names; apply a `## Should consider` item only when it changes no other part. Leave every other part as it is. Then run step 5.

Done when every `Must address` item is fixed and the check exits 0.

## 7. Reply

Briefly:

- the part files written or changed, each with its goal in a few words;
- the waves from `bdk plan check` (`1: 01`, `2: 02 03`) and the number of waves;
- that every scenario is owned by one part, or which are not and why;
- after a fix: the report IDs fixed (`Fixed: M1, M3`);
- choices you made inside the design's frame, and gaps of the design you did not decide.
