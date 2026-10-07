---
type: llm
---

PASS if the final reply (or an AskUserQuestion call) asks the user to decide at least one open point of the CSV export, such as the delimiter or the amount format, offers options with one marked as recommended, and does not present the design as finished.
FAIL if the reply presents a finished design without asking anything, or asks without offering options.
