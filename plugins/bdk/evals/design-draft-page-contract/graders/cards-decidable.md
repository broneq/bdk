---
type: llm
focus: { source: file, path: .lavish/design-add-csv-export.html }
---

The file is a Lavish page with one card per open design decision of the Change add-csv-export (a CSV export of tiny-ledger).
PASS if every card holds all three of: a context section (marked `data-bdk-section="context"`) that says what the proposal says about the decision and what the code does today with at least one file and line of the project (such as `src/store.js:12` or `src/format.js:2`); an options section (`data-bdk-section="options"`) where each option names its consequences (cost, risk, what stays uncovered or what breaks), not only a label; and a recommendation section (`data-bdk-section="recommendation"`) naming the recommended option and the reason. The visible text of the page (headings, context, options, recommendation) is in Polish; code, file names and technical terms may stay in English.
FAIL if any card lacks one of the three sections, cites no file and line, lists bare options without consequences, gives a recommendation without a reason, or the page's text is in English.
