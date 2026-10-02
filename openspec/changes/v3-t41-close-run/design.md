## Context

See proposal.md, Why. The pieces this Change stands on:

- `bdk change close` (T30) already runs every check, the spec merge, the archive, the pathspec commit and the PR summary from the ledger. `--dry-run` reports the same output and writes nothing.
- `hooks prompt-expansion` (T24) is the only writer of `source: user` transitions. For `/bdk:run` it already writes `source: policy` for the gates that are ready and `auto` at typing time. It needs an active Change and blocks without one. A gate that becomes ready later in the run has no writer: the open question of `v3-t24-guard-hooks-gates`.
- `hooks pre-tool` (T24, T41 orchestration) decides each tool call from the payload alone, after a shell prefilter. Today it writes only the agent registry.
- HOST-FACTS:
  - `skill-dmi`: the host refuses a model's `Skill` call to a skill with `disable-model-invocation: true`, before `PreToolUse`.
  - `upe-fires`: `UserPromptExpansion` fires for a typed plugin command.
  - `sub-bang`: a `!` block resolves when the skill is started through the `Skill` tool.
  - `disallowed-clears`: `disallowed-tools` removes the tools while the skill is active; they come back on the next user message. Measured only for a typed skill.
- The gate is enforced by the graph, not by the frontmatter. `plan` requires `gate:design`, `close` requires `gate:review`, and a gate node is done only through a `transition` entry, which `log add` cannot write.
- `/bdk:cr` is the review stage command of the pipeline. Today it does not record the `review` node; T42 rewires it.

## Goals / Non-Goals

**Goals:**

- One typed command, `/bdk:run --auto "<intent>"`, drives a Change from the intent to `closed` without a question to the user. Today the drive reaches the review stage; it reaches `closed` once T42 lands.
- The gates and the read-only guarantee of `execute` and `close` hold inside a run as they hold for typed commands.
- `run` holds no second copy of any stage procedure.

**Non-Goals:**

- A budget ceiling per run, and the analysis of a run (T47, #110).
- Running two runs of one Change at once, or a run that survives the end of its session.
- A `bdk run` command: the run has no state the model writes.

## Decisions

### D1 The stage skills lose `disable-model-invocation`; the kernel guards them (user decision 2026-10-02)

`change`, `plan`, `execute` and `close` drop `disable-model-invocation: true`; `setup` and `run` keep it. The field did three things, and each goes where it is enforced best:

| Duty                                     | Where it goes                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consent at a gate (T1)                   | Already in the graph: a `Skill` call fires no `UserPromptExpansion`, writes no `source: user`, and the stage's node stays blocked.                                        |
| `execute` and `close` never edit (P9)    | Their own frontmatter, which now also applies when `run` starts them through `Skill` (to confirm, D9).                                                                    |
| No stage started by the model on its own | `hooks pre-tool`, new guard `guard/stage-skill`: a model's `Skill` call to these four skills passes only inside an active run of the same session, never from a subagent. |

OD-7 (which skills keep the field) is revised for these four skills; T1 is unchanged in effect.

**Alternatives:**

- (B) Keep the field; `run` reads each stage's `SKILL.md` and follows it in its own thread. Lost: `run` needs the union of all tools, including `Write`, so inside a run the edit ban of `execute` is prose only. A late `auto` gate would also need a separate writer command.
- (C) `run` passes only the gates and tells the user what to type next. This is not the autonomous entry of R-9.

### D2 The run marker

A run is a property of one session on one machine. `hooks prompt-expansion` writes `.bdk/.machine/runs/<session_id>.json` (`kernel-state`, Run marker) when the user types `/bdk:run`. The file holds `prompt`, `auto`, `at` and `change-started`. Three writers remove it:

- a typed `/bdk:plan`, `/bdk:execute` or `/bdk:close` in that session, because a typed stage command hands the Change back to the user;
- `hooks session-end`;
- the next `/bdk:run`, which replaces it.

A marker that does not parse counts as absent, so the guard fails closed.

`change-started` lets `/bdk:change` pass once per run. Without it, a run that closed its Change would leave the branch without a Change, and the model could open a new one without being asked.

**Alternatives:**

- A ledger entry for the run. It would be committed and shared across machines, but a run is not part of the Change history, and a second machine must not inherit it.
- An environment variable. The hooks cannot read the model's shell.
- A marker per Change. A run may start before its Change exists.

### D3 `hooks pre-tool` passes a run's gate when the run enters the stage

For an admitted `Skill` call to `bdk:plan`, `bdk:execute` or `bdk:close`, `hooks pre-tool` resolves the Change from the branch and applies the outcome a typed command of that stage gets. The prompt-expansion code is split into one shared use case with the source as a parameter:

- gate done: pass, write nothing;
- gate not ready: `policy/gate-not-ready`;
- gate ready and `auto`, or ready under a run with `--auto`: write the transition with `source: policy` and the marker's `prompt` as `command`;
- gate ready and `manual`: `guard/gate-manual` naming the stage command;
- no gate in the profile: the plain stage transition.

`bdk:change` writes nothing and sets `change-started`. This answers T24's open question: a gate that became ready during the run passes when the run reaches it, and `prompt-expansion` stays the only writer of `source: user`.

**Alternatives:**

- `bdk next --advance` (T24's recommendation). This puts a writer flag on a read command, and the model must remember to call it.
- A new orchestrator command `bdk gate advance`. Any thread could call it outside a run.
- In the hook, the pass is bound to entering the stage, which is the moment the gate matters.

**Accepted:** the hook writes before the host runs the tool. A call that a later permission check refuses leaves the gate passed by policy, which the policy allowed anyway.

### D4 `--auto` is the run's own policy

`--auto` must be the first token of `command_args`. The run marker records `auto: true`, and every ready gate passes during the run: at typing time through `prompt-expansion`, later through `pre-tool`. The transition keeps `source: policy` and the typed `/bdk:run --auto ...` line in its `command` field (user decision 2026-10-02). `policy.gates.<gate>: auto` in settings stays the default for every run, and `change close`'s `gatesByPolicy` lists the gates in the PR summary.

The gate rule (`kernel-pipeline`, Gate) counted a `source: policy` transition only while the gate's policy resolves to `auto`, so a pass of a `manual` gate under `--auto` was written and never counted; the E2E test of task 2.5 found it. A transition that only `--auto` lets pass therefore carries `auto: true`, and the gate rule accepts a policy transition with it (user decision 2026-10-02). The field is in the entry schema and the index (`entries.auto`, index schema version 6). Only the hooks write it: `log add` cannot write a `transition`.

**Alternatives:**

- `source: user` for `--auto` passes, because the user typed the flag. Rejected by the user: a pass the user did not type at the gate is not a typed consent.
- The gate rule parses `command` for `/bdk:run --auto`. No new field, but the graph would read free text.
- `--auto` passes only gates whose settings policy is `auto`. The flag would then change nothing.

### D5 `/bdk:run` with an intent

`prompt-expansion` decides from two facts: whether an intent was typed (`command_args` without the `--auto` token, trimmed, is not empty) and whether the branch has an active Change.

| Intent | Active Change | Outcome                                                                                                                   |
| ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| yes    | no            | The marker only. The `run` skill starts `/bdk:change` with the intent, and `change` judges the profile as it always does. |
| yes    | yes           | `policy/change-exists`, so a typo cannot fork a second Change.                                                            |
| no     | yes           | Continue the active Change.                                                                                               |
| no     | no            | `policy/no-active-change`, naming `/bdk:run "<intent>"`.                                                                  |

### D6 Inside a run nothing is asked

The `run` body tells the model that, until the run stops, every "ask the user" of a stage skill becomes `bdk log add decision <summary> --review` on the recommended option, naming the options it did not take. Those decisions show at the next gate and in the PR summary (R-9). A park question of the ladder parks the Change and stops the run; the skill does not answer it. The rule lives in `run`'s body because a stage skill cannot tell whether a run started it: `ctx skill` has no session, and the instruction stays in context for the whole run.

**Alternative:** pass a run flag to each stage skill through its arguments, which every stage would then have to handle. That is six bodies to change for one rule.

### D7 The `run` loop and its render

- `run` repeats one cycle:
  - run `bdk next --json`;
  - map the stage to its command through the pipeline's `stages` (`next` names it);
  - start the stage with `Skill`;
  - run `bdk next --json` again.
- It prints one line when it enters a stage and one when it leaves it.
- It renders the full status only at the stop, with the kernel's gate status, the pending `review: true` entries, the decisions it took and the command the user types. This resolves T41 "re-render after each gate or only at the stop".
- Stop conditions:
  - a `guard/gate-manual` or `policy/gate-not-ready` denial of its `Skill` call;
  - a parked Change;
  - a refusal a stage skill reported as unresolved;
  - `waiting: nothing` after `close`.
- A pending `review: true` entry is no stop.
- The review stage is a stop until T42 (D10): the render names `/bdk:cr`.

`run` allows `Skill`, `Read` and the kernel wrapper pair, with no `disallowed-tools`. A stage skill brings its own tools while it is active.

### D8 The `close` skill

1. `bdk next --json`. A node of an earlier stage means close was started too early through a path the gate missed: report it and stop.
2. `bdk change close --dry-run --json`. On a refusal, follow `instead`, never repeat the command unchanged, and close nothing.
3. `bdk rules export --claude --check`. On `policy/generated-drift`, run `bdk rules export --claude` and list the files: the close commit stages only `.bdk/` paths, so the user commits these with the PR.
4. `bdk change close --json`.
5. The report: `summary` verbatim, `gatesByPolicy`, archive path, commit, regenerated files, and "open the PR with this summary".

`close` asks nothing, because the typed command or the run's gate pass is the consent. It never runs `gh`: opening a PR is outward-facing and stays with the user. `close` has `disallowed-tools: Edit Write NotebookEdit` (P9).

**Alternatives:**

- Ask for confirmation after the dry run. This adds a second consent after the one the gate already took, and it would stop every run.
- Commit the regenerated projection inside `change close`. That is a kernel change to a pathspec commit that is deliberately limited to `.bdk/`.

### D9 Host facts first

Before the guard is built, three checks are added to `tests/host-probe/` and recorded in HOST-FACTS on the current Claude Code version:

| Check                   | What it confirms                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `skill-tool-pretool`    | A model's `Skill` call to a plugin skill without the field fires `PreToolUse` with `tool_name: Skill`, `tool_input.skill` namespaced (`bdk-probe:plan`), and `session_id`. The payload is recorded as `pre-skill.json`; the check ran on 2.1.287 and confirmed it. |
| `skill-tool-upe`        | No `UserPromptExpansion` fires for that call.                                                                                                                                                                                                                      |
| `skill-tool-disallowed` | The started skill's `disallowed-tools` removes `Edit` and `Write` while it is active. The check also records whether they come back for a second skill started in the same turn.                                                                                   |

If the first or the third check contradicts this design, the work stops and the decision goes back to the user: the guard and P9 depend on them.

### D10 Review until T42 (user decision 2026-10-02)

`run` stops at the review stage and names `/bdk:cr` for the user to type; it does not start `cr`. The probe of D9 showed that `disallowed-tools` of `execute` still refuses `Write` to a skill started later in the same turn, three runs out of three, and today's `cr` writes its report with `Write(.bdk/cr/**)`. A typed `/bdk:cr` starts a new turn with every tool back. T42 makes `cr` write through kernel commands and record the `review` node, and then `run` starts it (user decision 2026-10-02, replacing the earlier decision that `run` starts `cr` now). The T41 acceptance "the same Change driven by `run` ends `closed`" is measured in two halves:

- here: from the intent to the review stage, and from a reviewed Change to `closed`;
- in T42's acceptance: the whole path.

`docs/V3-IMPLEMENTATION-PLAN.md` records the split.

### D11 Eval cases

`close.yaml`:

| Case          | Setup                                            | Expected                           |
| ------------- | ------------------------------------------------ | ---------------------------------- |
| `happy`       | seed `reviewed`                                  | archived, PR summary in the reply  |
| `ticket-open` | seed `reviewed` plus an open `review-fix` ticket | refusal followed, nothing archived |

`run.yaml`:

| Case         | Setup                                       | Expected                                            |
| ------------ | ------------------------------------------- | --------------------------------------------------- |
| `run-auto`   | `/bdk:run --auto "<intent>"` on the fixture | the review stage reached, the reply names `/bdk:cr` |
| `run-manual` | `/bdk:run "<intent>"` with default gates    | stops at `gate:design`, the reply names `/bdk:plan` |
| `run-close`  | seed `reviewed`, `/bdk:run --auto`          | closed, `gate:review` passed by policy              |

The seed `reviewed` is built through the kernel like the seeds of `v3-t41-execute` (D12 there):

1. A `tiny` Change with one part and one task whose files the seed writes and commits through `bdk commit`.
2. The post-task step evidence recorded through the kernel.
3. `part done`, `done spec-delta`.
4. A passing `review` report and `bdk done review`.

The happy path costs the most, because it drives every stage on the fixture. The probe estimate comes before any paid run, and the cost needs the user's approval.

## Risks / Trade-offs

- [The host protection moves to our hook] A broken prefilter or kernel would let a model start a stage outside a run. → The guard fails closed: a missing kernel blocks with `guard/kernel-unavailable`. The prefilter matches `Skill` as a whole tool name. A unit test and an E2E test cover the deny path. The gates stay in the graph either way.
- [`disallowed-tools` of `execute` may persist for the rest of the turn (`disallowed-clears`: they return on the next user message)] D9 confirmed it: `/bdk:cr` started after `execute` in the same run loses `Write`, which today's `cr` uses for `.bdk/cr/**`. → `run` stops at review (D10). T42 writes `cr`'s output through kernel commands only and lets `run` start it; the finding goes into T42's issue.
- [A run decides product questions on its own] → Every such choice is a `decision` with `review: true`, shown at the next gate and in the PR summary. With `manual` gates, the run stops for the user before `plan` and before `close`.
- [The pre-tool hook writes before the tool runs] → Accepted, D3.
- [Descriptions of four more skills sit in every session's context] → A few hundred tokens; accepted.
- [Eval cost] The full `run-auto` case drives every stage. → Probe first; the cost needs the user's approval.

## Migration Plan

Nothing to migrate: no v3 user has a run marker or depends on the field. A user who wants the old behaviour keeps `policy.gates.*: manual` and never types `/bdk:run`: no model can start `plan`, `execute` or `close` outside a run. Rollback is restoring the field on the four skills, which makes `/bdk:run` stop at its first stage with the host's refusal.

## Open Questions

None. The facts D9 measures can change the approach, so they are a gate inside the tasks, not open questions.
