## ADDED Requirements

### Requirement: Validate a changed spec delta

When a part's diff changes a file under `openspec/changes/<change>/specs/`, `implement-part` SHALL run `openspec validate <change> --strict` after its part checks, fix each error on a delta in the part's `files` and run it again, at most three runs in all; an error still there after the third run SHALL be a blocker of kind `other` with the error as evidence, and `Status: done` SHALL require that no error names a delta of the part. `conform-part` SHALL run the same command on such a part, whatever the implementer report says, and list each error on a delta of the part under `Left` naming the task that changed that delta, so the verdict is `FAIL`; it SHALL NOT add or change spec text to fix it. An error on a file outside the part's `files` SHALL NOT fail the part: the implementer notes it under `Decisions taken without the user`, the conformer under `Left` as `outside the part`. Both reports SHALL name the run under `## Checks` as `openspec validate <change> --strict: pass` or `: fail`, or `openspec validate: not run, no OpenSpec CLI` when no `openspec` command is found, which SHALL NOT fail the part. A part that changes no spec delta SHALL NOT run it.

#### Scenario: Requirement without a scenario left by the implementer

- **WHEN** part `01` of `add-total` added the requirement `Bad amount` to `openspec/changes/add-total/specs/tally/spec.md` without a `#### Scenario:`, and its implementer report says `Status: done`
- **THEN** `conform-part` runs `openspec validate add-total --strict`, leaves the delta unchanged, lists a `Left` item naming task 1, and its report starts with `Verdict: FAIL`

#### Scenario: Implementer fixes its own invalid delta

- **WHEN** `implement-part` builds a task that adds a requirement to a delta of its part and `openspec validate <change> --strict` reports that the requirement has no scenario
- **THEN** it adds the scenario the task names, runs the validation again, and its report lists `openspec validate <change> --strict: pass` under `## Checks`

#### Scenario: Part without a delta

- **WHEN** part `02` changes only `src/csv.js` and its test
- **THEN** neither block runs `openspec validate`

## MODIFIED Requirements

### Requirement: Limits on what a block changes

Both blocks SHALL edit only paths listed in the part's `files`, plus their own files under the run directory. They SHALL NOT change git history or the index (no commit, stash, reset, checkout or restore of paths, rebase, merge, add), SHALL NOT install packages, and SHALL NOT run a command that reaches the network, spends money or needs credentials. They SHALL run the project's checks only through `bdk check run`; the one other command they MAY run is `openspec validate <change> --strict`, on a part that changes a spec delta. When the work needs anything outside these limits, `implement-part` SHALL stop with a blocker and `conform-part` SHALL leave the item.

#### Scenario: File outside the part

- **WHEN** a task of part `02` can only be done by changing `src/ledger.js`, which is not in the part's `files`
- **THEN** `implement-part` does not edit `src/ledger.js` and reports `Status: blocker` with `Kind: plan-defect` naming the file
