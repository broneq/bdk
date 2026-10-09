## Context

See proposal.md, "Why". The skill texts of the `bdk` plugin describe the run mode of an `Agent` call in prose ("Start every Agent call in the foreground", "one foreground Agent call", "in the foreground when it is `foreground`"). Some name the parameter (`design`, `explore`, `verify-design`, `design-draft`), most do not. In the recorded run (fixture `plugins/bdk/evals/fixtures/diagnose-run/`) the execute lead passed `run_in_background: false` and its workers ran in the foreground; the review lead left the field out and three of its five workers ran in the background (`requestShape: background` in their meta files). The lead then polled their task output files for `"stop_reason":"end_turn"` every 5 s for 550 s.

The `models.<agent>` test (`plugins/bdk/tests/agent-models.test.ts`, spec `bdk-cli/config`, "Every agent is a models role") already reads every paragraph of a `SKILL.md` that writes `subagent_type: "bdk:<agent>"` as one Agent call.

## Goals / Non-Goals

**Goals:**

- No `Agent` call written by a BDK skill leaves the run mode to the host.
- A skill text that drops the parameter fails a workspace test, not a run.

**Non-Goals:**

- Changing when a lead runs in the background (`execution.lead` stays as it is).
- Detecting the polling loop at run time: `bdk diagnostics report` (#322) already reports it as `slow-call` after the fact.

## Decisions

### D1. The run mode is explicit both ways

Resolves the "To resolve in the spec" item of #326. Every Agent call names `run_in_background: false` or `run_in_background: true`. An orchestrator that starts a lead with `execution.lead: background` passes `run_in_background: true` (it already does), and passes `run_in_background: false` with `execution.lead: foreground`, instead of "in the foreground".

- Alternative: name only `false`, and leave the background lead as prose. Lost: the root cause is a host that picks the mode when the field is missing; the same gap exists in reverse (a host that defaults to foreground would block the main thread on a background lead), and one rule ("always name the value") is simpler to test and to read than two.

### D2. The rule covers every skill, not only the lead skills

The issue names the lead skills and the orchestrators that wait for a worker. Every block that delegates to its agent when typed in the main thread (`implement-part`, `conform-part`, `plan-draft`, `verify-plan`, `spec-conformance`, `resolve-conflict`, `diagnose-run`) also waits for it, so the same defect applies; the orchestrators `plan` and `close` too.

- Alternative: test only `review-round`, `pr-review-round`, `execute-waves`. Lost: a main-thread block whose agent runs in the background replies before its agent has a result, which is the same failure in the main thread; a narrower test leaves it to chance.

### D3. One shared reader of Agent calls, two tests

The paragraph split of the `models.<agent>` test moves into `plugins/bdk/tests/skill-agent-calls.ts` (every `{ skill, agent, paragraph }` of the plugin's `SKILL.md` files). `agent-models.test.ts` keeps its check; a new `agent-run-mode.test.ts` checks the run mode. The run-mode test also checks that the reader finds the lead skills' worker calls, so a skill that stops writing `subagent_type:` does not pass by having no calls.

- Alternative: add the check to `agent-models.test.ts`. Lost: that file is the test of spec `bdk-cli/config`; the run mode is a plugin rule (spec `bdk-plugin`), and one file per rule keeps the failure message pointing at the right spec.
- Alternative: a second copy of the paragraph split. Lost: two copies of the same parser drift.

### D4. `pr-review-round` writes its workers as `subagent_type:` calls

Its step 6 named the workers as `bdk:reviewer` and set `model` from a generic `models.<role>`, so neither test saw its calls. Each of its three worker steps now writes `subagent_type: "bdk:<agent>"`, `run_in_background: false`, and `models.<agent>.model` / `models.<agent>.effort`, like `review-round`.

- Alternative: widen the test's pattern to match a bare `bdk:reviewer`. Lost: every skill names agents in prose ("the `bdk:lead` agent"), so the pattern would no longer mean "an Agent call".

### D5. A lead never polls a worker's output

`agents/lead.md` names `run_in_background: false` and forbids reading or polling a worker's task output file and sleeping on a worker. The loop in the recorded run waited for a marker that never came, because the workers reported through the host's report tool; any home-made wait loop depends on the host's file format and is never faster than a foreground call.

- Alternative: teach the lead how to wait for a background worker correctly. Lost: with D1 there is no background worker to wait for; a second path is untested code in prose.

### D6. The eval grader is a `tool_used` with `max: 0`

`auto-review-first-round` gets the grader `workers-foreground`: `tool_used` on `Agent` with `min: 0`, `max: 0` and an `input_match` that matches a call input naming `bdk:reviewer`, `bdk:integration-reviewer`, `bdk:e2e-tester` or `bdk:judge` and holding no `"run_in_background": false` (a lookahead and a negative lookahead). It fails when any such call is made. Run against the recorded review lead of the fixture, it matches exactly its three background calls (two reviewers, the E2E tester) and neither foreground one. The tool graders see the calls of subagents: `execute-escalation-model-effort` grades the lead's `bdk:implementer` call the same way.

- Alternative: a `tool_used` requiring a worker call with `run_in_background: false`. Lost: it passes when one call of five carries the field, which is exactly the recorded failure (the judge and the integration reviewer ran in the foreground).
- Alternative: a `regex` with `match: not_contains` on the trace. Lost: the plugin-evals docs do not say how the trace serializes a tool call, so a pattern bounded by one input object is a guess; `input_match` is documented as matched against the JSON-encoded input of one call.

## Risks / Trade-offs

- [A host that ignores `run_in_background: false`] → the skill still waits for the agent's result; `bdk diagnostics report` reports a long wait as `slow-call`, and the meta file's `requestShape` shows the mode.
- [The test reads prose, so a paragraph could name the value for a different call] → the same limit as the `models.<agent>` test; each paragraph in the plugin starts one agent, and the eval grader checks the calls a model really makes.

## Measurement

Acceptance signal of #326, run 2026-10-09 with Claude Code 2.1.295: `claude -p "<debug-fix prompt>" --plugin-dir plugins/bdk --permission-mode auto` in a fresh copy of the `debug-fix` scaffold (`execution.lead: foreground`, both gates `auto`).

| | Recorded run (fixture, #322) | This Change |
|---|---|---|
| Session wall time | 14m00s | 4m37s |
| Host cost | $1.78 | $1.52 |
| Review lead wall time | about 10 min (9.3 min in one Bash wait loop) | 1m22s |
| Workers with `requestShape: background` | 3 of 7 (two reviewers, the E2E tester) | 0 of 7 |
| `slow-call` findings of `bdk diagnostics report` | 1 (the review lead) | 0 |

All nine agents of the run (two leads, implementer, conformer, two reviewers, E2E tester, integration reviewer, judge) read `requestShape: foreground`. The only finding left is one `repeat-bash` of the integration reviewer (one repeated `bdk findings list`, no wall time of note).

## Migration Plan

None: skill text and tests only. No setting and no command changes.
