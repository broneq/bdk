## ADDED Requirements

### Requirement: The execute probe counts kernel refusals

The `execute` stage probe SHALL record, per case, the number of kernel refusals its agents met, by refusal rule, in its results row, so a run is compared with an earlier one by number. An `execute` probe on the fixture meets acceptance when it passes 3/3, shows no `policy/missing-citation`, `input/invalid-envelope`, `policy/no-open-ticket`, `input/unknown-command` or `input/unknown-flag` refusal, and has fewer refusals in total than probe 2 of T41 (21).

#### Scenario: Counts in the results row

- **WHEN** `pnpm eval stages --skill execute --probe` finishes
- **THEN** its results row holds a count per refusal rule for each case

#### Scenario: A refusal of a fixed rule fails the acceptance check

- **WHEN** a probe row holds a `policy/missing-citation` refusal
- **THEN** the acceptance comparison reports the row as failing
