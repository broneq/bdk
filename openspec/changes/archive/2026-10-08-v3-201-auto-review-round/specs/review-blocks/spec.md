## ADDED Requirements

### Requirement: Fix parts and fix rounds

A group `p<NN>` whose part `openspec/changes/<change>/plan/parts/<NN>.md` does not exist SHALL be reviewed against the fix part `<run dir>/review/round-<k>/fixes/parts/<NN>.md` of the run directory. When the round's `groups.json` has an anchor of `kind` `round`, the round reviews the fixes made since that round: `review-group` SHALL check, for each task of a fix part, that the failure scenario of the finding the task names (read from that earlier round's log) no longer holds, and SHALL add a finding when it still holds; `review-integration` SHALL check only the scenarios and contracts that the round's changed files reach, following each changed contract to its users, instead of every scenario of the Change.

#### Scenario: Fixed finding still holds

- **WHEN** round 2 of `monthly-report` is anchored on round 1, group `p03` has the fix part `round-1/fixes/parts/03.md` whose task names finding `f-9ffca2edd413`, and `parseEntries('7')` still gives 7
- **THEN** `review-group` appends a finding on `src/parse.js` whose evidence names `f-9ffca2edd413` and the input `7`

#### Scenario: Integration in a fix round

- **WHEN** round 2 is anchored on round 1 and its files are `src/parse.js` and `src/parse.test.js`
- **THEN** `review-integration` checks the scenarios that reach `parseEntries` and the users of its result, and does not review the scenarios of `ledger --help`
