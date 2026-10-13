---
type: llm
focus: { source: file, path: .lavish/design-add-csv-export.html }
---

The file is round 1's Lavish page of the Change add-csv-export (a CSV export of tiny-ledger). The run started with a bare version of it: two cards, "CSV delimiter?" and "Amount format?", each with only radio options.
PASS if every card now holds all three of: a context section (marked `data-bdk-section="context"`) that says what the proposal says about the decision and what the code does today with at least one file and line of the project (such as `src/store.js:6` or `src/format.js:2`); an options section (`data-bdk-section="options"`) where each option names its consequences (cost, risk, what stays uncovered or what breaks), not only a label; and a recommendation section (`data-bdk-section="recommendation"`) naming the recommended option and the reason.
FAIL if any card still holds only a question and bare options, lacks one of the three sections, cites no file and line, or gives a recommendation without a reason.
