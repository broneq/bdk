## MODIFIED Requirements

### Requirement: Rules no-op measurement

The `rules-noop` suite SHALL produce, for every rule of the BDK pack (`rule-pack`, Pack layout: one file per rule under `rules/<category>/` and `rules/languages/<name>/`), the outcome of a blind knowledge test on Haiku 4.5 and on Sonnet 5 graded by one judge as COVERED, MISSED or WRONG, and, for every rule with a seeded violation, the detection rate of a review with the pack's rules and without them, compared by the difference rule. A rule without a seeded violation SHALL be marked "not seedable" in the ablation columns. The rows measured before the pack migration keep their T40 bullet ids, which `docs/V3-RULES-MIGRATION.md` maps to the pack ids. `pnpm eval rules-noop --patches <name,...>` SHALL run the ablation of the named patches only, without the knowledge test, so a re-seeded rule or a new language pack is measured without repeating the whole series.

#### Scenario: per-bullet row

- **WHEN** the suite finishes
- **THEN** its table has one row per rule with the file, the rule text, the Haiku and Sonnet knowledge outcomes, the with-rules and without-rules detection rates or "not seedable", and a provisional class

#### Scenario: patch filter

- **WHEN** `pnpm eval rules-noop --patches 22-operator-toolkit --probe` runs
- **THEN** only the ablation of that patch runs, and an unknown patch name exits 2 naming it
