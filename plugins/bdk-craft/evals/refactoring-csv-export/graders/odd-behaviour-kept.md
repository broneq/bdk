---
type: llm
focus: { source: file, path: src/exportCsv.js }
---

PASS if the code still wraps a name in double quotes only when it contains ";", without escaping double quotes inside the name, and still writes the price rounded to 2 decimals with a comma and without trailing zeros (12.5 becomes "12,5"), and an empty field for a missing price.
FAIL if quotes inside names are now escaped, names without ";" are now quoted, or the price format changed.
