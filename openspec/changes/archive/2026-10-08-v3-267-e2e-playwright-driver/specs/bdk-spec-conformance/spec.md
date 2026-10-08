## MODIFIED Requirements

### Requirement: Input

The block SHALL take the name of a Change and, optionally, `--base <ref>`, the branch the Change's code is compared with. Without a Change name it SHALL use the only Change under `openspec/changes/` other than `archive/`, and stop naming what it found when there is none or several. Without `--base` it SHALL use the branch `origin/HEAD` names, else `main`. It SHALL read the Change's `proposal.md` and every spec delta (`openspec/changes/<change>/specs/**/spec.md`), the main spec under `openspec/specs/` of every capability a delta modifies, removes or renames, the code the Change touches (`git diff <base>...HEAD`) and the code each scenario runs through, and the latest E2E results of the Change when there are any: of the files `.bdk/runs/<change>/e2e/verdict.md` and `.bdk/runs/<change>/review/round-<N>/e2e/verdict.md`, the one modified last, with the scenario files next to it.

#### Scenario: No E2E results

- **WHEN** the Change has no `e2e/verdict.md`, neither in `.bdk/runs/<change>/` nor in any review round
- **THEN** the block checks the deltas against the code alone and its report says under `Checked` that no E2E results were read

#### Scenario: Latest E2E results

- **WHEN** `review/round-1/e2e/verdict.md` says `Verdict: FAIL` and the later `review/round-2/e2e/verdict.md` says `Verdict: PASS`
- **THEN** the block reads the round 2 results, and its report names `review/round-2/e2e/verdict.md` under `Checked`
