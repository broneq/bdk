## MODIFIED Requirements

### Requirement: Wave check

Before it starts the first part of a wave, the lead SHALL record the wave's base, `git rev-parse HEAD` on the Change branch, in `state.json` as `waves.<n>.base` with `status` `pending`, unless the state already holds a base for that wave. After every part of the wave is `done` and on the Change branch (merged, or committed in the main checkout), the lead SHALL run the check run `wave-<n>` in the main checkout (spec `bdk-cli/check`): `bdk check plan <run dir> wave-<n> --at wave --changed <base>`, then each printed line as its own Bash call with the printed Bash timeout, one after another and character for character, then `bdk check record <run dir> wave-<n>` with the exit code each call reported. A `pass` or `none` verdict SHALL mark the wave `done`. On `fail` the lead SHALL start `bdk:implementer` running `resolve-conflict` with the arguments `<change> --wave <n> --base <base> --run-dir <absolute run dir>` (plus `--parts <dir>` when it runs other parts), with `model` and `effort` as for a conflict. On `Status: done` it SHALL commit the changed files on the Change branch with a message that names the wave, and mark the wave `done`; otherwise it SHALL run `resolve-conflict` once more on `policy.escalation.model` and `policy.escalation.effort`, committing on `Status: done`, and when that also fails, mark the wave `blocked` with the report's kind and evidence as `reason`, keep its uncommitted changes, and start no later wave. A wave with a blocked part SHALL get no wave check.

On a new execute run, a wave whose parts are all `done` and whose state is not `done` SHALL get its wave check (and repair) before any later wave starts. The uncommitted changes of a repair that failed stay in the main checkout for the user; the next run stops on them as on any uncommitted change (spec "Branch and worktrees").

#### Scenario: Green wave

- **WHEN** wave 1 holds parts `01` and `02`, both are merged, and the `tools.test` item `unit` (`when: [wave, review]`) passes
- **THEN** `checks/wave-1.json` holds `test unit` with `at` `wave` and the `changed` ref of `waves.1.base`, `state.json` marks wave 1 `done`, and wave 2 starts

#### Scenario: Red wave repaired

- **WHEN** `checks/wave-1.json` fails after parts `01` and `02` are merged
- **THEN** `resolve-conflict` runs with `--wave 1 --base <waves.1.base>`, the lead commits its repair on the Change branch, wave 1 is `done`, and wave 2 starts

#### Scenario: Red wave not repaired

- **WHEN** `checks/wave-1.json` stays red after two `resolve-conflict` runs
- **THEN** `state.json` marks wave 1 `blocked`, no part of wave 2 starts, and `execute/result.md` starts with `Status: blocked` and names `execute/wave-1.md`

#### Scenario: Wave check commands in the lead's transcript

- **WHEN** the `tools.test` item `unit` has `command: pnpm test` and `when: [wave, review]`, and wave 1 is merged
- **THEN** the lead's transcript holds the Bash call `pnpm test </dev/null > <run dir>/checks/wave-1/test-unit.txt 2>&1` between `bdk check plan` and `bdk check record`, and `checks/wave-1.json` holds `pnpm test`, its `cwd` and its exit code
