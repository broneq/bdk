## MODIFIED Requirements

### Requirement: Graph variants

The shipped pipeline SHALL give each profile and Change kind the nodes below, selected by node fields only; the profile is the effective profile from the ledger (`kernel-state`, Derived state and mutation).

| Node                               | `tiny`                        | `small`             | `large`             | kind `bug`                            | kind `review`           |
| ---------------------------------- | ----------------------------- | ------------------- | ------------------- | ------------------------------------- | ----------------------- |
| `intent`                           | yes                           | yes                 | yes                 | yes (the reproduction)                | yes (the review intent) |
| `design`                           | no                            | yes                 | no                  | no                                    | no                      |
| `design-parts`, `design-index`     | no                            | no                  | yes                 | no                                    | no                      |
| `architecture`                     | no                            | unless product-only | unless product-only | no                                    | no                      |
| `design-verify`                    | no                            | yes                 | yes                 | no                                    | no                      |
| `gate:design`                      | no                            | yes                 | yes                 | no                                    | no                      |
| `plan` (plan parts)                | yes                           | yes                 | yes                 | yes (one part: failing test plus fix) | no                      |
| `plan-verify`                      | no                            | yes                 | yes                 | per profile                           | no                      |
| `execute` (execute parts)          | yes                           | yes                 | yes                 | yes                                   | no                      |
| `simplify`, `tests-scoped`, `lint` | yes                           | yes                 | yes                 | yes                                   | no                      |
| `spec-delta`                       | when a part has `spec-impact` | same                | same                | same                                  | no                      |
| `tests-full`, `lint-full`          | yes                           | yes                 | yes                 | yes                                   | yes                     |
| `review`, `gate:review`, `close`   | yes                           | yes                 | yes                 | yes                                   | yes                     |

A `review` Change (`kernel-cli/change`, bdk change new; T42) reviews work already on its branch: it has no design, plan or execute node, so its first actionable node is `tests-full` and `bdk next` names `/bdk:cr`; the `review` node's other requirements are absent and count as met.

When `bdk done design` runs on a `small` Change whose `design/parts/` holds parts and which has no `design.md`, the kernel writes a `decision` entry with `profile: large` (`source: kernel`, `refs: [design/parts/]`), the nodes are recomputed for `large`, and the output's `next` is the first design part.

#### Scenario: new small Change

- **WHEN** `bdk change new "Add passwordless login"` runs and then `bdk next --json`
- **THEN** `artifact.id` is `design`

#### Scenario: tiny has no design

- **WHEN** a Change is opened with `--profile tiny --reason "<why>"`
- **THEN** `change status --json` lists no `design`, `architecture`, `design-verify`, `gate:design` or `plan-verify` node and `next` returns `plan`

#### Scenario: large Change

- **WHEN** a `large` feature Change has two design parts, both done, and `design-index` done
- **THEN** `change status` lists `design-part:01` and `design-part:02`, and `next` returns `architecture`, then `design-verify`, before any plan node

#### Scenario: bug Change

- **WHEN** `bdk change new "Login fails after password reset" --kind bug` runs and then `bdk next --json`
- **THEN** `artifact.id` is `plan` with kind `plan-part`, and no design node exists

#### Scenario: design split raises the profile

- **WHEN** a `small` Change has `design/parts/01-auth.md` and `design/parts/02-mail.md`, no `design.md`, and `bdk done design` runs
- **THEN** a `decision` with `profile: large` is written, the effective profile is `large`, and `next` returns `design-part:01`

#### Scenario: steps follow execute

- **WHEN** a `small` Change has one plan part and `bdk change status --json` runs
- **THEN** the nodes `execute-part:01`, `simplify:01`, `tests-scoped:01` and `lint:01` appear in that order, before `spec-delta`, `tests-full`, `lint-full` and `review`

#### Scenario: design verification before the gate

- **WHEN** a `small` feature Change has `design` and `architecture` done and `bdk next --json` runs
- **THEN** `artifact.id` is `design-verify`, and `gate:design` requires `design`, `architecture` and `design-verify`

#### Scenario: review Change

- **WHEN** `bdk change new "Review the login branch" --inferred --kind review` runs and then `bdk change status --json`
- **THEN** the nodes are `intent`, `tests-full`, `lint-full`, `review`, `gate:review` and `close`, and `bdk next --json` returns a review-stage node whose `command` is `/bdk:cr`
