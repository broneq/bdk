# Design

## Context

See proposal.md - Why. The cleared-path rule lives in `plugins/bdk/skills/spec-conformance/SKILL.md` (step 2 reads the round's log, problem 2's exception, `Checked`) and `plugins/bdk/skills/close/SKILL.md` step 7 (the PR body). The verifier runs on `bdk:verifier`, whose model `models.verifier.model` sets; `close-models-verifier` already shows that the setting reaches the `Agent` call. The #396 fixture `tally-e2e-cleared.sh` has a tester error a missing string refutes: the path observed `tally: no ledger here`, which no code prints.

## Goals / Non-Goals

**Goals:**

- Measure the cleared-path rule where the old rule would stop close: a sonnet verifier and a tester error the code could produce.
- Keep the cases as regression cover for the rule.

**Non-Goals:**

- Changing a skill, an agent, the judge or the E2E tester. A gap the measurement shows is a follow-up issue.

## Decisions

### D1. The subtler error: output of the code under another state

The fixture `tally-e2e-cleared-stale.sh` rewrites the cleared path `see-the-total--empty-ledger.md` of `tally-e2e-cleared.sh` to observe `Total: 7.50`, exit 0, and the judge's `levelReason` to say why it does not hold: with no `ledger.json`, `load()` returns `[]` and `total` prints `Total: 0.00`; `7.50` is the sum the `main` path writes (`tally add 5`, `tally add 2.5`), so the tester reused that directory. The finding id `f-4d2e8a1c7b90` stays, so the #396 graders apply unchanged.

- Alternative: a different wrong number (`Total: 3.00`) - lost: it matches no state of any path, so a verifier refutes it by arithmetic alone, close to the missing string of #396.
- Alternative: a new path or a new finding id - lost: the cases would need new graders for the same claim, and the before/after comparison with #396 gets harder to read.

### D2. Both factors in one case pair, sonnet through the local layer

Each new case sets `models.verifier.model: sonnet` in `.bdk/settings.local.yaml` (ignored by git, as `close-models-verifier` does, so close sees a clean tree) and runs on the stale fixture. A `verifier-sonnet` grader checks that the `bdk:verifier` call carries `"model": "sonnet"`, so a score cannot come from an opus verifier by accident.

- Alternative: four cases (sonnet only, subtle error only, both, for each block) - lost: the issue asks whether the rule holds where the old one would stop; the case that combines both is the hardest setup and the one the acceptance signal needs. If before already passes there, neither factor alone stops close.
- Alternative: `--model sonnet` on the run - lost: it sets the main thread's model, not the verifier's, and leaves `models.verifier` untested.

### D3. The block case reuses the #396 block scaffold

`spec-conformance-e2e-cleared/scaffold.sh` takes the base fixture name as an optional first argument (default `tally-e2e-cleared.sh`, so the #396 case is unchanged); the new block scaffold calls it with `tally-e2e-cleared-stale.sh`, which adds the deferred `blocker` path `boolean-entry` on top.

- Alternative: copy the 35 lines that add `boolean-entry` - lost: two copies of one fixture layer drift.
- Alternative: move the `boolean-entry` layer into its own fixture - lost: fixtures build a whole workspace (README "Shared fixtures"); a layer-only script would be a new convention for one use.

### D4. Before = the two skills of `d1a718f8`

The before arm runs from a scratch worktree of this branch with `plugins/bdk/skills/spec-conformance/SKILL.md` and `plugins/bdk/skills/close/SKILL.md` checked out from `d1a718f8` (`staging/v3` right before the merge of #401); everything else, the new cases included, is this branch. Both arms: Claude Code version pinned by the root `package.json`, clean `HOME`, the `git` entry of "Host limits", `--ablation none`, 3 runs, `-j 3`.

## Measurement

Claude Code 2.1.292, clean `HOME`, the `git` entry of "Host limits", `--ablation none`, 3 runs per case, `-j 3`. The `verifier-sonnet` grader passed in every run of both arms.

| Case | Before (`d1a718f8`) | After |
|---|---|---|
| `close-e2e-cleared-sonnet` | 0.71 (1.00 0 of 3; 0.86, 0.86, 0.43) | 1.00 in 3 of 3 |
| `spec-conformance-e2e-cleared-sonnet` | 0.56 (0.50, 0.50, 0.67) | 1.00 in 3 of 3 |
| Cost | $2.64 | $2.62 |

Paid runs in all, $5.74 and about 5 minutes of machine time: before $2.64 (122 s), after $2.62 (114 s), the regression run of `spec-conformance-e2e-cleared` $0.48 (61 s). A first launch of the after arm stopped before any run on `claude plugin eval` asking to trust the plugin directory ($0). No probe run: the scaffolds were checked by building them in a temp directory.

What the before verifier did (from the kept transcripts):

- **Close stopped** in 1 of 3 runs: the sonnet verifier traced the code, wrote that it gives `Total: 0.00` and that the tester probably reused a directory, and still made the cleared path `M1` under `Must address` - "I cannot clear it from the code alone, and the E2E rule makes a failed path a problem". `Verdict: FAIL`, no archive, no pull request. This is the stop #396 predicted and opus did not show. In the other 2 runs it passed, and the PR body named no cleared path next to `Verdict: FAIL`.
- **The block split both ways**: in 1 of 3 runs it made both failed paths items (the cleared one wrongly); in 2 of 3 it put both under `Should consider` with `Verdict: PASS`, letting the deferred `blocker` path `boolean-entry` through as well - the opposite error, against #391 design D1. With no rule for a judged path, the sonnet verifier judged both paths itself and landed on either side.
- **After**: every run listed `empty-ledger` under `Checked` with `f-4d2e8a1c7b90`, kept `boolean-entry` under `Must address` in the block case, and every close run archived the Change and opened a pull request whose body holds `Verdict: FAIL` with the cleared path.

Result: the cleared-path rule of #396 holds on a sonnet verifier and a tester error that is plausible output of the code; the old text stopped close in 1 of 3 runs there and, in the block case, also passed a holding `blocker` in 2 of 3. Regression cover: `spec-conformance-e2e-cleared` 1.00 in 1 run on the scaffold that now takes the fixture name. Nothing is left for a follow-up.

## Risks / Trade-offs

- 3 runs per arm show a gap only when it is frequent → the result names the runs that failed and what the verifier did, so a rare stop is visible; a larger sample is a follow-up only if the arms disagree.
