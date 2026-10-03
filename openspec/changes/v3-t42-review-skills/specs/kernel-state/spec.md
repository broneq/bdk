## MODIFIED Requirements

### Requirement: Change document

`change.md` SHALL hold the Change's identity and intent, SHALL be written once by `change new` and SHALL never be mutated.

| Field        | Type                       | Req. | Stamped | Meaning                                                                                                 |
| ------------ | -------------------------- | ---- | ------- | ------------------------------------------------------------------------------------------------------- |
| `schema`     | integer                    | yes  | kernel  | Document version.                                                                                       |
| `id`         | Change id                  | yes  | kernel  |                                                                                                         |
| `kind`       | `feature \| bug \| review` | yes  |         | Graph variant (T02 decision R-8); `review` for a review of work already on the branch (T42).            |
| `profile`    | `tiny \| small \| large`   | yes  |         | Profile at opening; a later raise is a ledger entry, never an edit.                                     |
| `intent`     | string                     | yes  |         | The intent (for `bug`, the reproduction). The only place the intent lives (R-12).                       |
| `source`     | `user \| inferred`         | yes  | kernel  | `inferred` only from `change new --inferred` (R-12).                                                    |
| `at`         | timestamp                  | yes  | kernel  |                                                                                                         |
| `author`     | string                     | yes  | kernel  | Git `user.name <user.email>`.                                                                           |
| `overridden` | array of key names         | yes  | kernel  | Settings keys the local layer overrides at opening, names only (D4b); empty when none.                  |
| `base`       | commit sha                 | no   | kernel  | Only for `kind: review`: `git merge-base HEAD <ref>` at opening, where the Change's range starts (T42). |

The body is empty.

#### Scenario: inferred Change

- **WHEN** a stage skill without an active Change calls `change new --inferred "<first sentence>"`
- **THEN** `change.md` carries `source: inferred` and no later command rewrites the file

#### Scenario: review Change carries its base

- **WHEN** `bdk change new "Review the login branch" --kind review --base main` runs
- **THEN** `change.md` carries `kind: review` and `base` equal to `git merge-base HEAD main`, and a `feature` or `bug` Change carries no `base`
