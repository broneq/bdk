---
name: verify-plan
description: Verifies the plan of the active BDK Change against the code and its design on a fresh context and records the verdict. Use when the plan parts are done and the Change waits on plan-verify.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Read Agent SendMessage
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill verify-plan 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: verify-plan" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill verify-plan` first and apply its output; on a `BDK STOP` line, stop and report it.

# Verify plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

The plan of the active Change is checked by one `verifier` that knows only its dispatch package, never this conversation, so it reads every plan part, with the design and the spec deltas, the way the workers will. This skill runs one verifier round in the main thread: it opens the ticket, starts the role, closes the ticket and marks `plan-verify` done when the verdict passes. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

Done when the ticket is closed and either `plan-verify` is done or the blockers and the kernel's next action are reported.

## Open the round

Run `bdk attempt open verifier plan-verify --json`.

- On success, keep its `ticket`.
- On a refusal (exit 2), read `rule`, `why` and `instead`. `policy/not-ready` means a plan part is not done: open nothing, and name the command of `instead` (usually `/bdk:plan`). When `instead` names `--escalate`, run `bdk attempt open verifier plan-verify --escalate --json`; the kernel allows it only when the round's budget is used up or it oscillates. A parked target ends the skill with the resume command the kernel prints.

Then run `bdk dispatch build plan-verify verifier <ticket> --json` and keep its `path`, `report` and, on an escalation ticket, `model`.

## Start the verifier

Start one agent with the `Agent` tool and wait for it in the foreground:

- `subagent_type: bdk:reader`;
- the prompt is the package `path` and nothing else;
- `model` set to the build output's `model` when it has one; the kernel's guard refuses an escalation start without it.

The role stores its report with `bdk log ingest --ticket <ticket>` and records it with `bdk log add report ... --ticket <ticket>`. When the agent returns, check both: the file at `report` exists, and `bdk log list --type report --for plan-verify --json` has an entry with this `ticket`. If either is missing, or the agent says `log ingest` refused its report, resume it once with `SendMessage`, naming what is missing in one sentence. A second failure closes the ticket `fail` with the cause.

## Close the round

Read the report's envelope (`Read` the file at `report`) and the live blockers of the node: `bdk log list --type blocker --for plan-verify --json`, keeping those with status `proposed` or `accepted`. Every blocker the role raises under the ticket names `plan-verify`.

- `status` is `done` or `done-with-concerns` and no live blocker names `plan-verify`: run `bdk attempt close <ticket> ok --envelope <report> --json`, then `bdk done plan-verify --json`.
- Otherwise: run `bdk attempt close <ticket> fail --envelope <report> --json`, and keep its `next.action`.

When `bdk done plan-verify` refuses, report its `why`; a check `fresh` means a plan part or a design document changed after the report, and the next round verifies the new text.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP`, exit 4 or exit 5: stop and report the output to the user.

## Finish

Report from the kernel's output and the report only:

- the verdict: the report's `status`, and whether `plan-verify` is done;
- every live blocker with its id, its `category` and its summary;
- every finding and observation the role wrote under the ticket (`bdk log list --since-ticket-start <ticket> --json`), with its id and summary;
- on `fail`, the `next.action` of `attempt close`: `retry` (fix the plan and run `/bdk:verify-plan` again), `narrow` (the same, and the next round checks only the `scope` it names), `escalate` (the next round opens with `--escalate`) or `parked` (the resume command the kernel prints).

Moving the Change on is not this skill's work: when `/bdk:plan` started it, return to that skill's flow; otherwise end with the gate status of `bdk change status --json`.
