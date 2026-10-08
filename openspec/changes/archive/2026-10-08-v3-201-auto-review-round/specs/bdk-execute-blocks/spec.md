## ADDED Requirements

### Requirement: Part from another directory

`implement-part`, `conform-part` and `resolve-conflict` SHALL take `--parts <dir>`. With it, the part SHALL be `<dir>/<part-id>.md` instead of `openspec/changes/<change>/plan/parts/<part-id>.md`; everything else, the run directory, the reports, the checks and the work directory, SHALL be as without it.

#### Scenario: Fix part

- **WHEN** `implement-part monthly-report 03 --run-dir <run> --parts <run>/review/round-1/fixes/parts` runs
- **THEN** it reads the contract of `<run>/review/round-1/fixes/parts/03.md` and writes `<run>/execute/part-03.md`
