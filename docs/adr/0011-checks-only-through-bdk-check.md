---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/tests/check.test.ts
  - plugins/bdk/evals/implement-part-csv
---

# ADR-0011: Project checks run only as the lines `bdk check plan` prints, and are recorded by `bdk check record`

## Context and Problem Statement

Every execute and review block runs the project's tests, linters and build. Left to themselves, agents ran them as they liked: in run B1 one test call hung for 93 minutes on a watch mode waiting for input, results lived only in a transcript, and a resumed or another agent ran the same suite again because nothing recorded that it had run. The first answer, `bdk check run`, ran the commands itself, but then the agent's transcript showed only `bdk check run ...`: on a project whose hook allows only its own Playwright wrapper, nobody could tell whether a slow run was the project's wrapper, its spec budget or BDK (#408). How do the blocks run a project check so that it never hangs, its result is on record, and the real command is visible?

## Decision Drivers

- **No hang:** stdin closed and a timeout on every check command.
- **A result on record:** a later or resumed agent reads it instead of running the suite again; a red check reaches the review as a finding.
- **The real command is visible** in the transcript, and passes the project's own permission rules and hooks.
- **The selection is deterministic:** which items run at which point, on which files, is computed and tested, not re-derived by a model per call.
- **The CLI decides nothing** about what a red check means for the work ([ADR-0010](0010-cli-output-contract.md)).

## Considered Options

1. **`bdk check plan` prints the lines, the working agent runs each as its own Bash call, `bdk check record` takes the exit codes.**
2. **`bdk check run`:** the CLI runs every command in its own shell and records the result.
3. **A runner subagent** that runs the checks for the working agent.
4. **Agents run the configured commands themselves**, composing them from `settings.yaml`.

## Decision Outcome

**Chosen option: 1.** No agent runs a test, lint or build command other than a line `bdk check plan` printed.

- **Plan.** `bdk check plan <run-dir> <id>` selects the configured `tools.test`, `tools.lint` and `tools.build` items for a check point (`--at part|wave|review`, the items' `when`), hands each its files (`--changed`, `--scope`, the picked tests of `--tests`, routed by `paths` and `{files}`), runs nothing, writes `checks/<id>/plan.json` and prints for each item exactly `<command> </dev/null > <output file> 2>&1` with the Bash timeout of the call (the item's `timeout`, 600 s by default, capped by `BASH_MAX_TIMEOUT_MS`). The line holds no `cd`, variable, group or pipe, because the host's permission check refuses those.
- **Run.** The working agent (`bdk:implementer`, `bdk:conformer`, `bdk:lead`) runs each line as its own Bash call, one after another, never in parallel or in the background, and runs every line, also after a red one.
- **Record.** `bdk check record <run-dir> <id> --exit <kind>-<tool>=<code>...` writes `checks/<id>.json` with each check's status (`pass`, `fail`, `timeout`, or `not-run` for a line nobody reported, which is red), the tail of each red output, and exits 1 on a red verdict. With `--round <n>` each red check becomes a finding whose id comes from a stable dedupe key, so recording the same red check again in a round adds no second finding.

It is the only option that keeps the selection deterministic, the result on file, and the real command and its exit code in the agent's own transcript.

### Consequences

- ✅ The transcript shows each real command, how long it ran and its exit code; the project's hooks and permission rules apply to it unchanged.
- ✅ `checks/<id>.json` is the record a resumed caller, a fix part and the round summary read; nothing runs a suite twice to learn its result.
- ✅ A skipped line cannot pass: it is `not-run`, and the verdict is red.
- ❌ Checks run one after another, so a part with several items is slower than a parallel run; test and lint in parallel can fight over caches and build outputs and make timeouts flaky.
- ❌ The agent reports the exit code; a wrong code is caught only by the transcript, which `/bdk:diagnose-run` reads.
- ❌ A process a command leaves running after it exits is not killed by BDK; the test runner must stop what it started.
- 🟡 "No agent runs a check command itself" is held by skill text and evals, not by a hook.

## Pros and Cons of the Options

### 1 - Plan, the agent's own call, record

- Good: visible command, deterministic selection, result on file, project permissions apply.
- Bad: three steps per check; the line must stay free of anything the permission check refuses.

### 2 - `bdk check run`

- Good: one call; the CLI kills the process group and leftover processes.
- Bad: the transcript shows only `bdk`; a project hook that allows its own wrapper sees a different command. Replaced by option 1 (#408).

### 3 - Runner subagent

- Good: keeps check output out of the working agent's context.
- Bad: an agent start per check (red run, part check, retries, conform, wave, review); a hang looks as it did before; implementer and conformer would need the `Agent` tool.

### 4 - Agents compose the commands

- Good: no CLI involved.
- Bad: selection by point, kind and `paths`, the `{files}` replacement and the quoting re-derived by a model on every call; no record a later agent can trust; the 93-minute hang.
