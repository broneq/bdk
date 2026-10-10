# Proposal

## Why

Tracks #376. The `judge-*` block eval cases fail at random on a permission denial, not on a level. Measured on 2026-10-10 while working on #371 (Claude Code as pinned in the root `package.json`, `--ablation none`, `--model sonnet`, `--allow-tools "Bash(*/bin/bdk *)" "Bash(git *)"`): in three runs of `--case 'judge-*' --runs 1 -j 5` one case failed each time, a different one each time. In the failing `judge-instruction` run the judge sent `cd <workspace>; B="<plugin>/bin/bdk"; L=<log>; "$B" findings list $L --level unleveled` as one Bash call; the shell variable puts no `/bin/bdk ` into the command, so the grant `Bash(*/bin/bdk *)` does not match, the call was denied ("don't ask mode"), and the judge never wrote `review.md`. The block text says "each command on its own, without pipes or `&&`", which names neither `cd`, `;` nor shell variables. `review-group`, `review-integration` and `triage` carry the same gap. #342 fixed the same failure for `/bdk:plan` and `bdk:verifier` (archived Change `v3-342-plan-evals-permission-denials`).

## What Changes

- `judge`, `review-group`, `review-integration` and `triage`: every `bdk` call is the whole Bash command, the form #342 gave `/bdk:plan`: nothing before or after it, no `cd`, `;`, `&&`, `|`, `echo` or shell variables, the plugin path and every argument written out; files are read with Read, Grep and Glob; the reason is stated. The `--workdir` form `cd <path> && "<bdk>" ...` of the three review blocks stays the one named exception (both of its pieces are granted).
- The inline `bdk findings list` / `bdk rules for` / `bdk git groups` mentions of the four blocks are written with the full `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` path, so no step invites a shorthand or a variable.
- Eval cases: the grader `no-denied-call` of `plan-fresh` (#354) is added to every `judge-*`, `review-group-*`, `review-integration-*` and `triage-*` case.
- `plugins/bdk/evals/README.md` records the measurement.

## Capabilities

### New Capabilities

### Modified Capabilities
- `review-blocks`: new requirement "Single-command bdk calls in the review blocks" and its eval grader.
- `triage-block`: new requirement "Single-command bdk calls in triage" and its eval grader.

## Impact

- `plugins/bdk/skills/{judge,review-group,review-integration,triage}/SKILL.md`, `plugins/bdk/evals/{judge-*,review-group-*,review-integration-*,triage-*}/graders/no-denied-call.md`, `plugins/bdk/evals/README.md`; specs `review-blocks`, `triage-block`.
- Docs: `docs/concepts/agents.md` gains one paragraph on how the review blocks and `/bdk:triage` run `bdk` (so the permission rule matches); no flow, command, settings key or file changes, so no diagram is redrawn. `pnpm docs:reference` reports the Reference up to date (no skill description changed).
