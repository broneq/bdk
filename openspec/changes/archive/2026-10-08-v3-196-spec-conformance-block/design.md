## Context

See proposal.md for why. What this Change builds on:

- Architecture (`docs/design/2026-10-07-v3-architecture.md`): the block row "`spec-conformance` | `bdk:verifier` (opus) | Do the spec deltas describe the product after the change?" ("Catalog"); `/bdk:close` composes `spec-conformance`, `openspec archive`, `commit`, PR ("Catalog", "Autopilot"); row 9 of "Autopilot continuation" resumes `close` while there is no passing spec-conformance report; principles 2 (one block, one job) and 7 (plain skill first).
- D6 of `docs/design/2026-10-07-v3-skills-decisions.md`: the verifier report body (`Verdict:` line, `Must address`, `Should consider`, `Checked`, stable IDs, evidence on every `Must address` item).
- Spec `bdk-cli/run` (#188): `bdk run status` reads `.bdk/runs/<change>/close/spec-conformance.md` and passes it when its first verdict line reads `Verdict: PASS`, so the file name and the first line are fixed already.
- `e2e-check` (#194): `.bdk/runs/<change>/e2e/verdict.md` (`Verdict: PASS|FAIL|SKIPPED|BLOCKED`) and one `e2e/<scenario>.md` per scenario whose first line is `Result: ...`. Its design D3 hands every scenario no user can observe to `review-integration` and `spec-conformance`.
- `verify-plan` (#191, merged) shipped the `bdk:verifier` agent (`plugins/bdk/agents/verifier.md`) and spec `bdk-verifier`: the agent runs the verifier skill its prompt names, checks and never fixes, writes only its report in the D6 body with `Closed:` on later passes. `verify-design` (#190, in flight) uses the same agent. Both use the hand-off pattern: the block's skill starts the agent when it runs anywhere else.
- The eval suite (#189, spec `skill-evals`): block cases with and without the plugin; `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` in skill text because `bin/` is not on `PATH` in eval runs.
- Inputs read, not copied: v2 (`main`) has no spec check; its `agents/design-verifier.md` and `plan-verifier.md` check an artifact against the code with a YAML verdict and confidences, replaced by D6. Draft 1 (`draft/v3-1`) closes a Change with a kernel dry run, archive and merge (`kernel/src/change/use-cases/close.ts`, eval `stages/cases/close.yaml`), and its findings record that nothing checked the merged spec against the product ("Living documentation", "Not evaluated").

## Goals / Non-Goals

**Goals:**

- A spec delta that the code contradicts is reported (issue, "Acceptance signal").
- Behaviour the Change adds that no delta describes is reported: a missing statement is as wrong for the living documentation as a false one.
- No false `FAIL` on a Change that conforms: a verifier that fails everything is skipped by its users.
- The block runs alone (`/bdk:spec-conformance`), so `/bdk:close` (#202) and a user call the same thing.

**Non-Goals:**

- Fixing the spec or the code after a `FAIL`, and deciding which side is wrong: `/bdk:close` (#202) owns that loop. The block names both sides and what the proposal says.
- Running the product or its tests: `e2e-check` drives the product, `bdk check run` runs the checks; this block reads their results.
- Checking the delta format: `openspec archive` validates it in the next step of `close`.
- Reviewing code quality or test coverage: `review-group` and `review-integration` (#193).

## Decisions

### D1. One skill on the shared `bdk:verifier` agent

`plugins/bdk/skills/spec-conformance/SKILL.md` holds the check. Its step 0 is the hand-off of #190 and #191: when the skill does not run on `bdk:verifier`, it starts `Agent(subagent_type: "bdk:verifier", prompt: "Run the skill bdk:spec-conformance with the arguments: ...")`, waits, and replies with the agent's verdict and path. The agent is used as #191 shipped it: its description already names `bdk:spec-conformance`, and its body (check, never fix, one report, D6 body) is what this block needs. Until #191 merged, this Change carried a byte-identical copy of the agent and the `bdk-verifier` delta; after the rebase both dropped to no diff.

Why: the architecture names `bdk:verifier` (opus) for this block, and the verifier must not be the conversation that wrote the Change: in `close` the main thread wrote or led the whole Change and would confirm its own account.

Alternatives: a `spec-conformer` agent of its own - lost, the catalog names one verifier for three blocks with one report contract. `skills: [spec-conformance]` preloaded in the agent - lost for the reasons #190 recorded (three blocks would load into every run; a user could not run the block alone). Running in the main thread - lost, self-review of the Change's author.

### D2. Input: the Change, its main specs, its code and its E2E results

The arguments are `[<change>] [--base <ref>]`. The block reads `proposal.md` (the intent, to say which side of a disagreement it supports), every delta, and the main spec of every capability a delta modifies, removes or renames (`openspec/specs/<capability>/spec.md`), because archive applies the delta to that file and the result is what must be right. The code is `git diff <base>...HEAD` plus whatever each scenario runs through from its entry point. `<base>`: `--base`, else the branch `git symbolic-ref --short refs/remotes/origin/HEAD` names, else `main` - the rule `review-integration` uses. E2E results are read when `e2e/verdict.md` exists; a `SKIPPED` or `BLOCKED` verdict and a missing file are stated under `Checked`, and the check rests on the code.

Alternatives: the run's review report as input - lost, findings are about code, and a blocker left in it already stops `close` (row 7); reading it would duplicate the judge. Requiring E2E results - lost, a project without `tools.e2e` still needs a correct spec.

### D3. Six problems that make the documentation wrong

`Must address` holds what would make the main specs wrong after archive (spec "What the block checks"): a contradicted or unreachable scenario, an E2E `fail`, a removed requirement whose behaviour stays, a modified requirement that silently drops still-true scenarios (OpenSpec's MODIFIED replaces the whole block, the common pitfall its own instructions warn about), user-visible behaviour no delta describes, and a delta that contradicts another main-spec requirement after merge. Everything else that the block notices goes to `Should consider`.

The check per scenario is the one `review-integration` uses for a different purpose: take the scenario's own WHEN, follow it from the entry point through the code, and compute the THEN value by value. Here the question is not "is the code right" but "is this sentence true of the product"; when it is false, the block does not decide whether the code or the spec is wrong. Each `Must address` item names the spec location, the code location and, when the proposal settles it, which side the proposal supports.

Alternatives: report only contradictions (the literal acceptance signal) - lost, undocumented behaviour is the more common gap and the one archive cannot notice. Findings in a findings log - lost, D6 fixes a report, `close` reads one verdict, and row 9 reads the file. Running the product to confirm - lost, `e2e-check` does that and the verifier runs only commands that read (spec `bdk-verifier`).

### D4. One report file, replaced on a rerun

The file is `.bdk/runs/<change>/close/spec-conformance.md`, the name spec `bdk-cli/run` reads; there is no `-N` suffix. A rerun reads the previous file for its IDs, writes `Closed:`, and replaces it, so IDs stay stable (D6) while row 9 keeps reading one file. This differs from `verify-N.md`, which keeps every iteration: the design loop reads its history, while `close` needs only the current verdict, and the previous items survive as IDs. The skill states the replacement, because the agent body speaks of "the next report" in the numbered form.

Alternatives: `close/spec-conformance-N.md` - lost, a change to spec `bdk-cli/run` and its parser for a history nobody reads. Appending iterations to one file - lost, the first verdict line would be the stale one.

### D5. No CLI helper

Every step is a Read, a Grep, a read-only `git` call or one Write. No eval or measurement asks for a command (CLAUDE.md, "Building skills (v3)"); the problems the runs showed and the answers in skill text are recorded under "Measurements".

### D6. Eval cases on one shared fixture

`plugins/bdk/evals/fixtures/tally-change.sh` builds a `tally` CLI on `main` with a main spec (`Add`, `Usage`), and a branch `add-total` holding the Change `add-total`: an ADDED requirement `Total` with the scenarios "Total of added amounts" and "Empty ledger", a MODIFIED `Usage`, and code that conforms. Each case's scaffold changes what it tests in one more commit. It is a new fixture, not `tally-cli.sh`: that one is a single commit on `main` with the broken code built in, while this block needs a base branch to diff against and a main spec to merge into.

| Case | Scaffold on top of the fixture | Graders |
|---|---|---|
| `spec-conformance-contradicted` | `tally total` exits 1 with `tally: no ledger here` when no ledger exists; no E2E results | `file_exists` report; `regex` `^Verdict: FAIL`; `regex` "empty ledger" under `Must address`; `regex` an `Evidence:` line with `bin/tally.js:<n>`; `tool_used` Agent `bdk:verifier`; `tool_used` Skill |
| `spec-conformance-undocumented` | adds `tally clear`, which deletes the ledger, in the code and the usage line only | `file_exists` report; `regex` `^Verdict: FAIL`; `regex` `clear` under `Must address`; `tool_used` Agent `bdk:verifier`; `tool_used` Skill |
| `spec-conformance-conforming` | E2E results: `e2e/verdict.md` `Verdict: PASS` and the scenario files | `file_exists` report; `regex` `^Verdict: PASS`; `regex` `Must address` holds `- None.`; `regex` "Empty ledger" under `Checked`; `tool_used` Agent `bdk:verifier`; `tool_used` Skill |

All three are `block` cases with and without the plugin; prompts ask as a user would before archiving, without naming the skill. Grants: `Write` and `Bash` narrowed to `bdk` and `git`. Skill text uses examples from another product, so the eval's names are not taught (lesson of #194).

Alternatives: one case (the acceptance signal only) - lost, a verifier that reports `FAIL` on everything would pass it; the conforming case is the false-positive check. A rerun case with `Closed:` - left out: the stable-ID logic is the agent's, shared and tested by `verify-design-second-pass` (#190); the skill only names the file.

## Risks / Trade-offs

- [The verifier reports a style or wording problem as `Must address`, and `close` loops] -> the skill lists the six problems that make the documentation wrong and puts everything else under `Should consider`; the conforming case measures false `FAIL`.
- [Undocumented behaviour is judged too wide: every refactor looks like new behaviour] -> only what a user observes counts (a command, option, output, exit code, endpoint, page, configuration key); internal code never needs a delta.
- [Code reading misses what only a run shows] -> E2E results are read when present, and an E2E `fail` is `Must address` by itself.
- [A later Change edits the shared agent body for its own block] -> the block's specifics live in this skill, not in the agent; spec `bdk-verifier` fixes what the agent owes every block.
- [opus on every close costs more than sonnet] -> the architecture chose opus for verifiers ("Catalog"); the block runs once per close, and the measured cost is recorded below.

## Measurements

Acceptance runs (`claude -p --plugin-dir plugins/bdk --permission-mode auto`, Claude Code 2.1.293, projects scaffolded from the three cases in a scratch directory outside this repository; the prompt asks to check the specs before archiving, without naming the skill):

| Project | Report | Turns | Time | Cost |
|---|---|---|---|---|
| contradicted | `Verdict: FAIL`, `M1` "Total" / "Empty ledger" with `bin/tally.js:18-21` as evidence; "Total of added amounts", both "Usage" scenarios, the kept main-spec scenarios and "no E2E results" under `Checked` | 5 | 53 s | $0.43 |
| undocumented | `Verdict: FAIL`, `M1` "Usage" / "Help" (the usage line now names three commands), `M2` `tally clear` described by no delta, with `bin/tally.js:20-22` | 5 | 47 s | $0.42 |
| conforming | `Verdict: PASS`, `Must address` `- None.`, all four scenarios and the E2E `PASS` under `Checked` | 5 | 45 s | $0.44 |
| contradicted, rerun after reverting the defect | `Verdict: PASS`, `Closed: M1` | 5 | 43 s | $0.44 |
| conforming code, E2E `Result: fail` for "Empty ledger" | `Verdict: FAIL`, `M1` naming the E2E file; it also says the code computes `Total: 0.00`, so the E2E run likely saw another build | 5 | 102 s | $0.46 |
| no `.bdk/settings.yaml` | reply `BDK not configured: run /bdk:setup`, no agent, no file | 3 | 6 s | $0.20 |

In every configured run the main thread started `bdk:verifier` (transcripts show `"subagent_type":"bdk:verifier"` and one subagent file), the agent wrote `close/spec-conformance.md` with no refused write, and `git status` stayed clean. `bdk run status` on the rerun project, with the earlier stages' files added and a `run.json`, derived row 9 step `archive` from the passing report and step `spec-conformance` once its first line was changed to `Verdict: FAIL`.

The runs showed no problem that skill text or a helper had to answer: no CLI helper (D5). One observation: the undocumented case also contradicts "Usage" / "Help", because the added command changed the usage line; the verifier reported both, which is correct, and the grader checks only `clear`.

Eval suite, `--runs 3`, both arms, `-j 4`, Claude Code 2.1.292 (clean `HOME`, `PATH` without other plugins, `CLAUDE_CODE_SHELL_PREFIX` per "Host limits"):

| Case | WITH | W/OUT | Δ |
|---|---|---|---|
| `spec-conformance-contradicted` | 1.00 | 0.00 | +1.00 |
| `spec-conformance-undocumented` | 1.00 | 0.00 | +1.00 |
| `spec-conformance-conforming` | 1.00 | 0.00 | +1.00 |

Mean Δ +1.00, the skill fired in 9 of 9 runs with the plugin, 189 s wall time, $4.34 for 18 runs. Without the plugin the model answers in the reply and leaves no report file, so `bdk run status` would never see the check.

## Open Questions

None. Report body decided by D6; the file name by spec `bdk-cli/run`.
