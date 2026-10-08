## ADDED Requirements

### Requirement: Parts of another directory

`execute-waves` SHALL take `--parts <dir>`, an absolute directory of part files in the plan part format, such as the fix parts of a review round. With it, the lead SHALL take the waves from `bdk plan check <dir> --json`, SHALL pass `--parts <dir>` to every `implement-part`, `conform-part` and `resolve-conflict` it starts, SHALL keep the part state in `state.json` and write the result to `result.md` in the directory that holds `<dir>` (never in `<dir>`, where `bdk plan check` reports any other `.md` file), and SHALL leave `<run dir>/state.json` and `<run dir>/execute/result.md` unchanged. Part reports and check results SHALL stay under `<run dir>/execute/` and `<run dir>/checks/`. Without `--parts` the parts SHALL be `openspec/changes/<change>/plan/parts/` and the state and result SHALL be as before.

#### Scenario: Fix pass of a review round

- **WHEN** the lead runs `execute-waves monthly-report --run-dir <run> --parts <run>/review/round-1/fixes/parts` and that directory holds part `03`
- **THEN** the implementer prompt names `--parts <run>/review/round-1/fixes/parts`, `<run>/review/round-1/fixes/state.json` marks `03` `done`, `<run>/review/round-1/fixes/result.md` starts with `Status: done`, and `<run>/state.json` is unchanged
