---
name: run
description: Runs a BDK Change through its stages without stopping at each one - opens it from an intent, then designs, plans and executes it, and closes it after review. Use when the user wants a feature or fix carried end to end.
argument-hint: '[--auto] ["<intent>"]'
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Skill Read
disable-model-invocation: true
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill run 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: run" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill run` first and apply its output; on a `BDK STOP` line, stop and report it.

# Run

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

A run carries one Change through the stages the user would otherwise type one by one. You start each stage skill with the `Skill` tool and let it do its stage with its own instructions and tools; you hold no copy of any stage's procedure. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

Arguments: $ARGUMENTS

The hooks started this run when the user typed `/bdk:run`, and they keep its state. `--auto` as the first argument lets the run pass every gate that is ready; without it, only gates whose policy is `auto` pass. You never pass a gate yourself: when you start the stage skill behind a gate, the kernel passes the gate or denies the call. The intent is the arguments without `--auto`.

Done when the run reaches a stop below and you have given the report of "Finish". Until then, end your turn only while a stage skill's agents run (their notifications wake you; finish that stage, then go on with the run). A turn that ends with "next I will start ..." while a stage is ready is not done.

## The loop

Run `bdk next --json` and act on what it returns, then run it again after each stage skill ends:

| `next` returns                                                 | What you do                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| refusal `policy/no-active-change`, before the run opened one   | start `/bdk:change` with the intent as its arguments                                      |
| an artifact of stage `design`, `plan`, `execute` or `close`    | start the skill of that stage: `/bdk:design`, `/bdk:plan`, `/bdk:execute` or `/bdk:close` |
| `waiting: gate`                                                | start the skill the ready gate's `command` names, such as `/bdk:plan`                     |
| an artifact of stage `review`                                  | stop: the user types `/bdk:cr`                                                            |
| `waiting: user`                                                | stop: the Change is parked                                                                |
| `waiting: nothing`, or no active Change after `/bdk:close` ran | stop: the run is over                                                                     |

Start a stage skill with the `Skill` tool, `skill` set to the command without its slash (`bdk:plan` for `/bdk:plan`). The review stage stops the run because its skill writes a report, and the `Edit` and `Write` refusal of `/bdk:execute` lasts for the rest of the turn; the user types `/bdk:cr`, then `/bdk:run` again to close.

The hooks may deny a `Skill` call. Read the reason and stop on:

- `guard/gate-manual`: the gate needs the user; the report names the command the user types to pass it;
- `policy/gate-not-ready`: the stage before is not done; report what `next` returns;
- `guard/stage-skill`: the call came outside this run's session; report it.

A stage skill that reports a refusal it could not resolve also stops the run. A pending `review: true` entry is no reason to stop: it waits for the next gate the user sees.

## Deciding instead of asking

While the run lasts, nobody answers questions. Wherever a stage skill tells you to ask the user (its `Asking the user` section, `AskUserQuestion`, a Lavish page), take the option it recommends and record the choice:

```
bdk log add decision "<choice, at most 120 characters>" --ref <node> --body "<the question; each option not taken and why>" --review --json
```

`<node>` is the node of the stage that asked (`intent`, `design`, `plan`, `execute`). A choice made before the Change exists, such as the branch `/bdk:change` asks for, is recorded right after `bdk change new`. A park question of the attempt ladder is not a stage skill's question: it parks the Change, and `next` returns `waiting: user`.

## While it runs

Print one line when you start a stage skill (`run: /bdk:plan`) and one when it ends with its outcome (`run: /bdk:plan done - 3 parts in 2 waves`). Keep the stage skill's own reports short; the full report waits for the stop.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- A `BDK STOP` line, exit 4 or exit 5: stop and report the output.

## Finish

At the stop, report from the kernel's output only. After `/bdk:close`, its report is the finish: add the stages and decisions of the run to it. Otherwise:

- why the run stopped: the stop above, with the hook's or the kernel's reason;
- the stages the run passed, and the gates passed by policy;
- the decisions the run took, from `bdk log list --type decision --review --json`;
- the gate status and the pending `review: true` entries, from `bdk change status --json`;
- the command the user types next: the gate's `command`, `/bdk:cr` at the review stage, or the resume command of a parked Change.
