## MODIFIED Requirements

### Requirement: Levels by the product's behaviour

The judge SHALL judge every finding of the log that has no level, once each: it SHALL check the failure scenario against the code at the finding's place and set one level with `bdk findings level` and a one-sentence `--reason`, by these definitions:

| Level | When |
|---|---|
| `blocker` | the product breaks a spec scenario or the intent of the Change; the spec deltas would not describe the product after archive (a `spec-conformance` finding whose problem holds); a check is red; a security hole; data loss; a regression of existing behaviour |
| `should-fix` | the product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost that the finding names |
| `nice-to-have` | an improvement whose absence costs nothing concrete |
| `not-a-problem` | the failure scenario does not hold, the finding is out of the Change's scope or already handled, or it repeats an earlier finding of the log, whose id the reason names |

Of two findings that repeat each other, the judge SHALL level the later one in the log `not-a-problem` and judge the earlier one on its own. A rule violation by itself SHALL NOT be a `blocker`. For a `spec-conformance` finding the judge SHALL check both sides: what the cited spec location says, and what the code does for the input the evidence names; the finding holds when they disagree, and `/bdk:close` would refuse to archive the Change while it is open. A `spec-conformance` finding whose evidence is an error of `openspec validate --strict` holds while the delta still has what the error names (a requirement without a scenario), even though the product does what the delta says; it is a `blocker`, because `openspec archive` refuses the Change. The judge SHALL add no finding, record no decision, and leave a finding that already has a level as it is.

#### Scenario: Levels of a mixed round

- **WHEN** the judge runs on a log holding the decimal-place bug of `parseEntries`, an abbreviated name citing `BDK-CQ-1`, a crash on empty input that a guard already prevents, and an optional sort order
- **THEN** their latest levels are `blocker`, `should-fix`, `not-a-problem` and `nice-to-have`

#### Scenario: Resumed judge

- **WHEN** a judge crashed after leveling two of four findings and runs again
- **THEN** it levels only the other two, and the first two keep their levels

#### Scenario: A previous finding reported again

- **WHEN** the log holds a seeded `previous-review` finding of the parse bug and, later, a `review-group` finding of the same bug, and the bug is still there
- **THEN** the seeded finding is `blocker` and the later finding is `not-a-problem` with a reason naming the seeded finding's id

#### Scenario: Error message no delta lists

- **WHEN** the log holds an unleveled `spec-conformance` finding that no delta of `add-total` lists the error `tally: not an amount: <text>`, and `bin/tally.js` prints it for `tally add abc`
- **THEN** its level is `blocker`, not `should-fix`, although the product works

#### Scenario: Delta OpenSpec refuses

- **WHEN** the log holds an unleveled `spec-conformance` finding that the requirement Bad amount of the `add-total` delta has no scenario, quoting `openspec validate add-total --strict`, and the delta still has none, while `bin/tally.js` prints the error the requirement names
- **THEN** its level is `blocker`, not `nice-to-have` or `not-a-problem`, although the product works
