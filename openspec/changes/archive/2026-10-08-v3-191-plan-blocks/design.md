# Design

## Context

The plan stage of the architecture (design `2026-10-07-v3-architecture.md`, "Flows", "Plan") is `/bdk:plan` (#199) composing two blocks: `plan-draft` (main thread) writes `plan/parts/NN.md`, `bdk plan check` measures them, and `verify-plan` (`bdk:verifier`, opus) checks them against the code in a loop until PASS. This Change builds the two blocks and the agent; the loop is #199.

What it builds on:

- The part format: spec `bdk-openspec-schema` ("Plan parts are files with frontmatter") and the template `plugins/bdk/openspec/schemas/bdk/templates/part.md` (#180). D1 of `docs/design/2026-10-07-v3-skills-decisions.md` fixes the task lines inside `## Tasks`; D6 fixes the verifier report body.
- `bdk plan check <dir>` (#185, spec `bdk-cli/plan`): limits, `depends-on` cycles, waves, overlapping files and lonely `shared` parts; exit 0 or 1, exit 3 when not configured. It does not parse tasks (D1).
- `bdk run status` (#188, spec `bdk-cli/run`) reads `.bdk/runs/<change>/plan/verify-N.md`, the highest N being the last, and passes it when its first verdict line reads `Verdict: PASS`.
- `/bdk:setup` (#181): the skill pattern: a `!` block with `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`, `allowed-tools` naming that path, `bdk` always called by its plugin path (not on `PATH` in eval runs, #189).
- The eval setup (#189, spec `skill-evals`): cases under `plugins/bdk/evals/<block>-<case>/`, shared fixtures in `evals/fixtures/`.

Inputs read, not copied: v2 `skills/create-plan` (explorer agents, approaches and questions, one task per test file, 40 LOC limit, `Files:` and `Depends on:` per task, wide waves), v2 `skills/verify-plan` with `agents/plan-verifier` (six-section checklist, YAML envelope with confidences, two iterations through `SendMessage`, a plan hash), draft 1 `skills/stages/plan` with `references/task-shape.md` (kernel `bdk next`, ledger questions, test cases per behaviour, `Stop rule:`, `isolation-reason`) and `skills/stages/verify-plan` with `skills/roles/verifier` (tickets, dispatch packages, blocker categories, `log ingest`). What held in B1 (`docs/v3-draft1/run-b1/`): plan verification found tasks without an owner; the implementer stopped on a plan defect. What went wrong: the part preamble did not reach the implementer (the source line, finding 2 of the run report), an acceptance line named commands by exclusion and ran paid ones (finding 5), the parts formed a chain of 6 waves (finding 10), and two opus verify-plan rounds took 13.7 min.

Host facts that shape the verifier, probed by the parallel tasks on Claude Code 2.1.293 and passed on to this one:

| Fact | Source |
|---|---|
| A `context: fork` skill returns no agent id, so a forked verifier cannot be continued with `SendMessage` | i190 (#190) |
| `Agent(subagent_type: bdk:verifier)` whose prompt asks it to run `Skill(bdk:verify-design)` works: the `!` block resolves, an agent id is returned, `SendMessage` resumes it | i190 (#190) |
| A subagent `Write` to a file named `report-1.md` is refused ("Subagents should return findings as text, not write report files"); `.bdk/runs/<c>/design/verify-1.md` is written | i190 (#190), i193 (#193) |
| A skill preloaded with `skills:` resolves its `!` block and `${CLAUDE_PLUGIN_ROOT}` | i193 (#193) |

## Goals / Non-Goals

**Goals:**

- Plans that an implementer builds without coming back: every scenario owned by one part, every named symbol real, every part self-contained.
- Plans with few waves, because wave depth sets the execute time (design "Stages and units of work").
- A verifier that finds what would break execute, writes one report the resume rules read, and can be continued across iterations.
- Each block runs alone (`/bdk:plan-draft`, `/bdk:verify-plan`) and shows an effect in its eval cases.

**Non-Goals:**

- The draft, check, verify loop and its budget (#199).
- A new `bdk` command; the blocks use `bdk config show` and `bdk plan check` (D9).
- Confidence scores, per-task verdict tables, a YAML envelope or a plan hash (v2): the D6 body and `bdk run status` replace them.

## Decisions

### D1. Two skills and one shared agent

- `plugins/bdk/skills/plan-draft/SKILL.md`: the author block, run in the main thread (design "Catalog"), user- and model-invocable, with one reference `references/part-example.md` holding a worked part, read when writing the first part.
- `plugins/bdk/skills/verify-plan/SKILL.md`: the verifier block, with the plan checklist.
- `plugins/bdk/agents/verifier.md`: `bdk:verifier`, `model: opus`, tools `Read, Grep, Glob, Write, Bash, Skill`. Its body is the role every verifier block shares: check, never fix; write only the report the skill names; the D6 body; stable IDs. The checklist of each artifact stays in its skill, so `verify-design` (#190) and `spec-conformance` (#196) add their own skill and reuse the agent.

Alternatives: one `plan` skill that drafts and verifies - lost, one block one job (CLAUDE.md "Building skills (v3)"), and the verifier needs a fresh context to read the plan as the implementer will. An agent per verifier (`plan-verifier`, v2) - lost, three agents with the same role and report body would drift; the architecture names one `bdk:verifier`.

### D2. verify-plan runs in a `bdk:verifier` agent started with the `Agent` tool

The caller starts `Agent(subagent_type: "bdk:verifier", prompt: "Run the skill bdk:verify-plan for the Change <name>.")`; the agent runs the skill with the `Skill` tool. The skill's first section tells it where it runs: inside `bdk:verifier` it checks; in any other thread (a user typing `/bdk:verify-plan`) it starts that agent itself, passing `model` from `models.verifier` when the configuration sets it, and relays the verdict line and the report path. #199 starts the agent the same way and continues it with `SendMessage` for the next iteration (design "Catalog": "continued with `SendMessage` across iterations").

Alternatives: `context: fork` with `agent: bdk:verifier` (draft 1 HOST-FACTS `fork-plugin-agent`) - lost, a fork returns no agent id, so it cannot be continued (host facts above), and `models.verifier` cannot reach it. Preloading the skill with `skills:` in the agent - lost, every `bdk:verifier` would then carry the checklists of all three verifier blocks; the `Skill` call loads only the one it runs.

### D3. The report: D6 body, stable IDs through the previous report

The report is `.bdk/runs/<change>/plan/verify-N.md`, N one more than the highest existing (spec `bdk-cli/run`, "Files the derivation reads"); the file name has no "report" in it (host fact above). Body as D6 (spec `bdk-verifier`), plus a `Closed:` line under the verdict from the second report on.

IDs stay stable because the verifier reads the previous report of the same plan, whether it is a continued agent or a fresh one (a new session, a crash, `/bdk:verify-plan` typed twice). A continued agent saves reading the code again; the file makes the IDs right either way.

Alternatives: IDs only through `SendMessage` memory (v2) - lost, a new session loses them and the resume table restarts verification from files. A YAML envelope (v2, draft 1) - lost, D6 decided the body, and `bdk run status` reads the verdict line.

### D4. What `verify-plan` checks, and what blocks

The checklist follows what a plan must give its implementer, not v2's six code-centred sections. `Must address` holds what makes an implementer build the wrong thing, fail or stop (spec `bdk-plan-blocks`, "verify-plan checks the plan against the code"): `bdk plan check` problems; missing D1 lines; false claims about the code; scenarios owned by no part or by two; design decisions no task carries out; a dependency used but not declared; a fact the part needs that only another part states (B1 finding 2); commands by exclusion or with cost (B1 finding 5); a changed interface whose callers no task covers. `Should consider` holds the rest: a cut with fewer waves, code inside a task, an unclear sentence.

This mirrors D2 of the skills decisions for findings: a plan defect blocks only when the product or the run breaks on it, so a style remark never costs an opus round.

The verifier traces two or three concrete inputs through the tasks that change behaviour (v2 "data trace"), because that is how an interface mismatch between parts shows; it does not score confidences.

Alternatives: draft 1's closed blocker categories with ledger entries - lost with the ledger. Every finding blocks - lost, B1 spent review rounds on minor entries, and a verifier loop costs opus minutes per round.

### D5. `plan-draft` cuts for short waves

The skill's cutting rules, in order: find the contracts that several parts use (types, a function signature, a file format) and put them into one small first part; split the rest by the files it touches, so parts without a shared file run in one wave; put a task's tests into its part; depend only on parts whose output a part uses; `isolation: shared` only for state outside `files` that a parallel part could also change (a lockfile, generated code, a migration sequence). The target is the fewest waves the dependencies allow, two or three for a B1-sized Change (design "Stages and units of work"); the reply states the count `bdk plan check` reports.

A part is written for an implementer who reads only that part, the specs and the design: a fact several parts need (a source to copy from, a shared constant, a command) is written into each of them (B1 finding 2).

Alternatives: v2's task sizing (one test file, one production file, 40 LOC per task) - lost, the unit of work is the part (design principle 3), and the part limits are configuration that `bdk plan check` measures. Draft 1's `isolation-reason` field - lost, not in the schema; the rule above decides `shared` without a field.

### D6. `plan-draft` runs `bdk plan check` itself

`plan-draft` is not done until `bdk plan check` exits 0: it fixes oversized parts, overlaps and missing ids itself. The orchestrator (#199) runs the check again before verification; one run costs under a second and no model turn.

Alternatives: leave the check to the orchestrator - lost, the block would hand over a plan it knows nothing about, and run alone (`/bdk:plan-draft`) it would never be checked.

### D7. `plan-draft` after a failed verification

When the last `plan/verify-N.md` of the run fails, `plan-draft` fixes every `Must address` item in the existing parts and leaves the rest of the plan alone, then checks again. It names the IDs it fixed, so the next verifier report can close them. This is the "fix per must_address" arrow of the plan flow, owned by the author block because only it writes parts.

Alternatives: the verifier fixes the plan - lost, a verifier checks and never fixes (one block one job), and it would then verify its own text.

### D8. Product questions stop the draft

The plan stage does not decide what the product does. When the specs and the design leave open a choice that changes behaviour and the code does not settle it, `plan-draft` names it as a gap of the design and writes no part for it; the design stage answers it. A choice inside the design's frame (file layout, a helper's name) is the plan's to make, and the reply lists those taken.

Alternatives: ask the user from `plan-draft` (v2) - lost for now, it moves a design question into the plan stage, where the autopilot cannot ask; `policy.questions` decides how the design stage asks.

### D9. No CLI helper

Both blocks use only `bdk config show` and `bdk plan check`. Coverage of scenarios, the D1 lines and false code claims are model work over a few files; no eval showed a need (CLAUDE.md "Building skills (v3)"). A candidate for later, only after a measurement: a `bdk plan check` row for tasks missing a D1 line.

### D10. The part template shows the D1 lines

`templates/part.md` and the `plan` instruction in `schema.yaml` show a task with `File:`, `Interface:` and `Verified by:`, so a user writing parts with OpenSpec alone and `plan-draft` produce one format (spec `bdk-openspec-schema`, MODIFIED). Projects get it from `bdk openspec install`, which `/bdk:setup` runs on every run.

### D11. Eval cases

A shared fixture `evals/fixtures/ledger-change.sh` builds a configured BDK project on top of `tiny-ledger`: `.bdk/settings.yaml`, `openspec/` with the BDK schema copied from the plugin, and a Change `add-csv-export` with proposal, a spec delta of six scenarios (CSV text, export command) and a design. Four `block` cases:

| Case | Scaffold adds | Graders |
|---|---|---|
| `plan-draft-csv-export` | nothing | `file_exists` part `01.md`; `regex` on `01.md` for the frontmatter and the D1 lines (only `01.md`: every plan has it, the number of parts is the plan's choice); `tool_order` design read before a part is written; `llm` on the reply (parts and waves stated, which only `bdk plan check` reports; a `tool_used` Bash grader cannot load under the free check's grants, as in #181 D9); `tool_used` Skill |
| `verify-plan-defects` | two parts with three planted defects: a function the code does not have, the scenario `Missing input file` owned by no part, part `02` using part `01`'s function without `depends-on` | `file_exists` `verify-1.md`; `regex` verdict `FAIL`; one `regex` per defect inside `Must address`; `tool_used` Agent `bdk:verifier`; `tool_used` Skill |
| `plan-draft-fix-after-verify` | the parts of `verify-plan-defects` and a failed `verify-1.md` naming M1-M4 | `regex` on `01.md` (no `sumAmounts`, total from `balance(entries`) and on `02.md` (owns `Missing input file`, `depends-on: ["01"]`); `tool_order` report read before a part is edited; `tool_used` Skill |
| `verify-plan-sound` | the same plan, correct | `regex` verdict `PASS`; `tool_used` Agent; `tool_used` Skill |

The planted defects pass `bdk plan check`, so only reading the code and the specs finds them. `verify-plan-sound` guards against a verifier that fails everything.

Measured results: see "Eval results" below.

Alternatives: grade the plan with an `llm` grader over the parts - lost, long output is graded by `regex` (#189 D3). A case per defect - lost, each verifier run costs an opus run; one case with three defects measures the same.

## Acceptance runs

`claude -p "/bdk:<block> add-csv-export" --plugin-dir plugins/bdk` (Claude Code 2.1.292, default model), each in a project scaffolded from the eval case outside this repository:

| Run | Turns | Time | Cost | Outcome |
|---|---|---|---|---|
| `plan-draft` on `ledger-change` | 7 | 51 s | $0.40 | 2 parts, 2 waves, every one of the 6 scenarios owned once, D1 lines in every task, `bdk plan check` ok; named one design gap (no subcommand, unknown subcommand) without deciding it |
| `verify-plan` on the sound plan | 2 | 44 s | $0.43 | `Verdict: PASS`; S1 (sign of small negative amounts), S2 (executable bit); no file changed besides `verify-1.md` |
| `verify-plan` on the planted plan | 2 | 43 s | $0.40 | `Verdict: FAIL`, M1 `sumAmounts`, M2 `Missing input file`, M3 the error path of design D2 (a consequence of M2), M4 the missing `depends-on`, each with evidence |
| `plan-draft` after that FAIL | 7 | 36 s | - | fixed M1-M4 in the two parts, `bdk plan check` ok, reply `Fixed: M1, M2, M3, M4` |
| `verify-plan` again | 2 | 46 s | - | `verify-2.md`: `Verdict: PASS`, `Closed: M1, M2, M3, M4, S1, S2`, new items `S3`, `S4` (D3 holds across a fresh agent) |

## Eval results

`pnpm --filter @bdk/bdk run eval --trust-plugin --allow-tools Write Edit "Bash(*/bin/bdk *)" --case <case> --model sonnet` (Claude Code 2.1.292, judge default, 3 runs per arm unless named), clean `HOME`, `PATH` without other plugins' `bin/`:

| Case | WITH | W/OUT | Δ | Runs | Cost |
|---|---|---|---|---|---|
| `verify-plan-defects` | 1.00 | 0.00 | +1.00 | 6 | $1.15 |
| `verify-plan-sound` | 1.00 | 0.00 | +1.00 | 6 | $1.20 |
| `plan-draft-csv-export` | 1.00 | 1.00 | 0.00 | 6 | $0.85 |
| `plan-draft-fix-after-verify` | 1.00 | 1.00 | 0.00 | 6 | $0.73 |

`verify-plan` changes the outcome: without the plugin no run checks the plan into a report, so no verdict exists for an orchestrator to read; with it every run fails the planted plan with all three defects under `Must address` and passes the sound one.

`plan-draft` shows no effect on these Changes. Both arms write the same parts: the BDK schema's plan instruction and part template, which `/bdk:setup` installs and the fixture copies, already carry the frontmatter, the D1 task lines and "few wide waves", and a run without the plugin follows them; it also finds `.bdk/runs/<change>/plan/verify-1.md` and fixes its items. Two more graders were tried and dropped, both without a Δ: a project limit `plan.part.max-tasks: 2` (the run without the plugin reads `.bdk/settings.yaml` too), and part 02 stating the signature of `toCsv` (with the plugin, 2 of 5 runs wrote one part, which is a valid cut). What the skill adds over the schema, `bdk plan check` with the project's limits, the self-contained part rule and the gap stop, needs a Change wider than six scenarios to show; the B1-sized fixture (#208) is where that is measured. `plan-draft` stays as the named author block the orchestrator (#199) composes with `verify-plan`, and is reconsidered when #208 measures it.

## Risks / Trade-offs

- [A main-thread `/bdk:verify-plan` must recognise it is not the verifier] -> the agent's prompt names the skill and the agent's own body says it is `bdk:verifier`; the eval case typed by a user covers the dispatch path.
- [opus verifier rounds are slow (B1: 13.7 min for two)] -> only defects that break execute block (D4); a continued agent does not reread unchanged code; the round count is #199's budget.
- [The verifier writes into `.bdk/runs/` while the host refuses some subagent writes] -> the file name avoids "report" (host fact); the eval case grades the file.
- [The template change reaches a project only on the next `bdk openspec install`] -> `/bdk:setup` runs it on every run; `plan-draft` states the D1 lines itself.
- [`plan-draft` shows no Δ over the schema alone on the `ledger-change` cases] -> recorded in "Eval results"; #208 measures it on a B1-sized Change.
- [`bdk:verifier` is also written by #190] -> announced to the other agents; the second to merge keeps one file with both intents (tools include `Skill`).

## Open Questions

None.
