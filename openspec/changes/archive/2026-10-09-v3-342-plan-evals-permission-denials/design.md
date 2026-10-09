# Design

## Context

See proposal.md, "Why". Measured 2026-10-09 on Claude Code 2.1.292 (the pinned version), clean `HOME`, `--ablation none`, `--allow-tools Write Edit "Bash(*/bin/bdk *)"`, `--keep-temp`, denials listed from the kept transcripts:

- `plan-fresh` 1.00 over 3 runs; one verifier call denied (`cd <workspace>; for f in ...; do cat -n $f; done`), after which it read the files with `Read`.
- `plan-model-effort` 0.89 over 3 runs (sonnet verifier): in all 3 runs the first Bash call of a verifier was `cd <workspace>; ls -R ... | head -50; "<root>/bin/bdk" plan check ...` (or `...; git rev-parse --show-toplevel`), denied. In 2 runs the verifier stopped and wrote no report (`review-written` failed); in one it wrote a report without the check.

A probe (`claude -p` under `--permission-mode dontAsk --allowedTools "Bash(*/bin/bdk *)"`, haiku) of single commands:

| Command | Result |
|---|---|
| `"<root>/bin/bdk" plan check x` | allowed |
| `<root>/bin/bdk plan check x` | allowed |
| `<root>/bin/bdk plan check x 2>&1` | allowed |
| `<root>/bin/bdk plan check x && echo ok` | allowed |
| `<root>/bin/bdk plan check x; ls` | allowed |
| `<root>/bin/bdk plan check x; echo exit=$?` | denied |
| `cat a.txt; <root>/bin/bdk plan check x` | denied |

Claude Code splits a compound command and allows it only when every piece is granted or judged read-only; which pieces pass is not stable (`ls` passes, `cat a.txt` does not, a `cd` to another directory depends on the shell's directory). So the only form that is always allowed is the `bdk` command alone.

The main-thread form of #342 (`...; echo exit=$?`) was fixed by #296, but the squash commit of #284 (d79cfcfd) was built on a tree before #296 and reverted the skill line, the spec requirement and the archived Change of #292.

## Goals / Non-Goals

**Goals:** every `plan-*` orchestrator case at 1.00 over 3 runs; the cause fixed in the text that the denied caller reads.

**Non-Goals:** the same rule in every other agent and skill (lead, implementer, conformer use `cd <worktree> && ...` under a `Bash(cd *)` grant on purpose); no measured denial there. A process guard against a squash reverting another PR is not part of this Change (see D5).

## Decisions

- **D1. Forbid compound `bdk` calls in the text, do not widen the grant.** The question of the issue. A `bdk` call never gets `;`, `&&`, `|`, `cd` or `echo` around it. Widening the eval grant (`Bash(*)`, or extra `Bash(cd *)`, `Bash(ls *)`) would hide the problem in evals only: a real session runs on the skill's `allowed-tools` (`Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)`) and the user's rules, so it would still be prompted or denied for the same compound form. Rejected: grant change; a `PreToolUse` hook that splits compound commands (machinery for a wording problem; the CLI and hooks do not steer the model's commands).
- **D2. The rule lives where the caller reads it.** The main thread reads the `/bdk:plan` check block; the verifier reads its agent file, which all three verifier skills (`verify-design`, `verify-plan`, `spec-conformance`) share. So the rule goes into the check block and into `agents/verifier.md`, mirroring `agents/planner.md` ("Read files with Read, Grep and Glob; run with Bash only `bdk`"), which had no denial in the measured runs. Alternative rejected: one sentence in every agent and skill that calls `bdk` (31 files), without a measured failure there and against the `cd <worktree> &&` form the execute agents need.
- **D3. Keep the quoted path.** #292 claimed the quote breaks the grant; the probe shows `"<root>/bin/bdk" ...` is allowed on 2.1.292, and every other skill uses the quoted form, which also survives a plugin root with spaces. The restored wording keeps the quotes and drops that claim.
- **D4. A denied command is an environment problem, not a verdict.** The verifier writes no report and returns the denied command; `/bdk:plan` stops on a pass without a verdict line and passes the message on. Alternatives rejected: report the denial under `Must address` (what happened in #342: a sound plan got `FAIL`, and `plan-draft` would then "fix" a plan that has no defect); continue without `bdk plan check` (a `PASS` that skipped item 1 of the checklist).
- **D5. Restore the archive of #292.** It is the record of the earlier fix and was deleted by mistake, together with its fix; restoring it keeps the history of the requirement this Change modifies. The lost fix itself was already reported by #342; no separate issue.
- **D6. Grader `no-denied-call` on `plan-fresh` and `plan-model-effort`.** A regex on the trace (which holds the subagents' calls) that fails on `don't ask mode`. A denial that the model works around still costs time and, as measured, sometimes the outcome; the grader makes the acceptance signal ("stable against denials") visible directly rather than only through the outcome graders. Only these two cases, where the denials were measured; the other `plan-*` cases share their blocks.

## Risks / Trade-offs

- [The model still chains commands] -> the reason (a denied call stops the stage) is in the text; the grader shows it.
- [A real user's verifier needs `git log`] -> still allowed; only chaining is ruled out.

## Measurements

Before: `plan-fresh` 1.00 (3 runs, $2.13), `plan-model-effort` 0.89 (3 runs, $1.17).

After (same setup, 3 runs each, `-j 4`): every `plan-*` orchestrator case 1.00 (`plan-budget-spent`, `plan-design-gap`, `plan-fresh`, `plan-model-effort`, `plan-models-verifier`, `plan-passed`, `plan-resume-after-fail`, `plan-verify-written`), 353 s, $8.88. One denied call was left in the 24 kept runs: a verifier's `mkdir -p .bdk/runs/<change>/plan` before writing its report (`plan-models-verifier`, score 1.00). `agents/verifier.md` now says that Write creates the report's directory; after it, `plan-models-verifier` and `plan-model-effort` 1.00 over 3 runs each ($2.54) with no denied call in any transcript.
