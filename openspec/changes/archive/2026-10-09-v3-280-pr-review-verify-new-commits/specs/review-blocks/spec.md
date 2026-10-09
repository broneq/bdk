## MODIFIED Requirements

### Requirement: Levels by the product's behaviour

The judge SHALL judge every finding of the log that has no level, once each: it SHALL check the failure scenario against the code at the finding's place and set one level with `bdk findings level` and a one-sentence `--reason`, by these definitions:

| Level | When |
|---|---|
| `blocker` | the product breaks a spec scenario or the intent of the Change; a check is red; a security hole; data loss; a regression of existing behaviour |
| `should-fix` | the product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost that the finding names |
| `nice-to-have` | an improvement whose absence costs nothing concrete |
| `not-a-problem` | the failure scenario does not hold, the finding is out of the Change's scope or already handled, or it repeats an earlier finding of the log, whose id the reason names |

Of two findings that repeat each other, the judge SHALL level the later one in the log `not-a-problem` and judge the earlier one on its own. A rule violation by itself SHALL NOT be a `blocker`. The judge SHALL add no finding, record no decision, and leave a finding that already has a level as it is.

#### Scenario: Levels of a mixed round

- **WHEN** the judge runs on a log holding the decimal-place bug of `parseEntries`, an abbreviated name citing `BDK-CQ-1`, a crash on empty input that a guard already prevents, and an optional sort order
- **THEN** their latest levels are `blocker`, `should-fix`, `not-a-problem` and `nice-to-have`

#### Scenario: Resumed judge

- **WHEN** a judge crashed after leveling two of four findings and runs again
- **THEN** it levels only the other two, and the first two keep their levels

#### Scenario: A previous finding reported again

- **WHEN** the log holds a seeded `previous-review` finding of the parse bug and, later, a `review-group` finding of the same bug, and the bug is still there
- **THEN** the seeded finding is `blocker` and the later finding is `not-a-problem` with a reason naming the seeded finding's id
