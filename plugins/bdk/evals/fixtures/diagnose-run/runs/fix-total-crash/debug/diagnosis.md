Status: ready
Change: fix-total-crash
Reproduction: .bdk/runs/fix-total-crash/debug/reproduction.md
Root cause: bin/tally.js:16 `add` pushes the text argument (`value`) instead of the parsed `amount`, so `total` computes `0 + "5"` = "05" and calls toFixed on a string
Scenario: tally / Requirement: Total / Scenario: Total after an add
Part: openspec/changes/fix-total-crash/plan/parts/01.md
Next: /bdk:debug fix-total-crash
