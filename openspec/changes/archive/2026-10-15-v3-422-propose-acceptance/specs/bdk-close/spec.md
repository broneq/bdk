## ADDED Requirements

### Requirement: Scope changes in the pull request body

The pull request body SHALL hold a part `Scope changes` listing every `## SL-<n>` entry of the archived Change's `scope-log.md` in its order, copied as written (its id, stage, AC, before, after, why and `By:` line), or saying `none` when the log holds no entry or is missing. The reply SHALL name the entries too.

#### Scenario: AC dropped by the user

- **WHEN** the close of `add-total` creates its pull request and `scope-log.md` holds `SL-1` with `AC: AC-3`, `After: dropped` and `By: user`
- **THEN** the body file has a `Scope changes` part that holds `SL-1` with `AC-3` and `By: user`
