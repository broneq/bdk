# Proposal

## Why

Tracks #342. Two `/bdk:plan` orchestrator eval cases failed for reasons unrelated to the plan: Bash calls of `bdk` were denied in the run ("don't ask mode"). Reproduced on 2026-10-09 (Claude Code 2.1.292, clean `HOME`, `--ablation none`, `--allow-tools Write Edit "Bash(*/bin/bdk *)"`): `plan-model-effort` scored 0.89 over 3 runs; in 2 runs the `bdk:verifier` agent sent `cd <workspace>; ls -R ... | head -50; "<root>/bin/bdk" plan check ...` as one Bash call, the call was denied as a whole, and the verifier wrote no report (one run) or a report without the check (another). The main-thread denial of #342 (`bdk plan check ...; echo exit=$?`) comes back because the commit of #284 (d79cfcfd) reverted the fix of #292 (#296): the `/bdk:plan` check block, the `bdk-plan` spec requirement and the archived Change `v3-292-plan-evals-denied-check`.

## What Changes

- `/bdk:plan` check block: the `bdk plan check` call is the whole Bash command again (nothing before or after it), with the reason; the #296 wording is restored and its claim about quotes corrected (a probe shows the quoted path matches the grant).
- `/bdk:plan` step 5: a verifier that returns no verdict line (a denied or failed command) stops the stage with its message, instead of being read as a verdict.
- `bdk:verifier` agent: each command is a Bash command of its own; files are read and listed with Read, Glob and Grep, not with Bash; a denied or failed command is never a problem of the artifact: when a command the skill needs stays denied, the agent writes no report and returns the command and the denial.
- `verify-plan` step 2: `bdk plan check` is a Bash command of its own, as `bdk rules for` already is.
- Eval cases `plan-fresh` and `plan-model-effort` get a grader `no-denied-call`: no tool call of the run is denied.
- The deleted archive `openspec/changes/archive/2026-10-09-v3-292-plan-evals-denied-check/` is restored from 03decd04.

## Capabilities

### New Capabilities

### Modified Capabilities
- `bdk-plan`: "Check before every verification" states the form of the check call (as #292 had it); "Verify loop within the budget" handles a pass without a verdict.
- `bdk-verifier`: "Verifier agent" states how the agent runs commands and what it does on a denied command.

## Impact

- `plugins/bdk/skills/plan/SKILL.md`, `plugins/bdk/skills/verify-plan/SKILL.md`, `plugins/bdk/agents/verifier.md`, `plugins/bdk/evals/plan-fresh/`, `plugins/bdk/evals/plan-model-effort/`, `plugins/bdk/evals/README.md`; specs `bdk-plan`, `bdk-verifier`.
- Docs: `docs/concepts/orchestrators.md` (`/bdk:plan`: a verifier pass without a verdict stops the stage); `pnpm docs:reference` reports the Reference up to date (no skill or agent description changed).
