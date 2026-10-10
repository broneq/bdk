## MODIFIED Requirements

### Requirement: Single-command bdk calls in the review blocks

`review-group`, `review-integration` and `judge` SHALL run every `bdk` call as the whole Bash command, `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" <command>` with literal arguments and nothing before or after it: no `cd`, `;`, `&&`, `|`, `echo` and no shell variable, so that the grant `Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *)` matches it and no block is cut short by a denied call. The one exception SHALL be the `--workdir` form `cd <path> && "${CLAUDE_PLUGIN_ROOT}/bin/bdk" <command>`, both of whose pieces the blocks grant. The free text of `--summary`, `--evidence` and `--reason` SHALL hold no backtick, `$` or backslash, because the host reads a backtick or `$` inside double quotes as a substitution and denies the call. The blocks SHALL read and list files with Read, Grep and Glob, not with `cat`, `ls` or `grep` through Bash. Every `judge-*`, `review-group-*` and `review-integration-*` eval case SHALL hold the grader `no-denied-call`, which fails when the run's trace holds a denied tool call.

#### Scenario: Judge cases under the narrow grant

- **WHEN** `pnpm --filter @bdk/bdk run eval --allow-tools "Bash(*/bin/bdk *)" "Bash(git *)" --case 'judge-*' --runs 3 -j 5 --ablation none --model sonnet` runs
- **THEN** every case scores 1.00 and its `no-denied-call` grader passes in every run

#### Scenario: Review cases under the narrow grant

- **WHEN** the `review-group-*` and `review-integration-*` cases run with the Bash grants the eval README names for them
- **THEN** their `no-denied-call` graders pass

#### Scenario: Evidence that quotes code in backticks

- **WHEN** `judge-previous-repeat`, whose findings quote code in backticks, runs 10 times with the judge's grants
- **THEN** it scores 1.00 and `no-denied-call` passes in 10 of 10 runs, the judge having written its `--reason` text without a backtick
