---
type: llm
focus: { source: file, path: src/userLabel.js }
---

PASS if the code still appends the role suffix before shortening, so a long name of an admin is cut to 23 characters plus "…" and loses " (admin)"; and still uses the part of the e-mail before "@" when there is no first name.
FAIL if the role suffix is now protected from the cut, the limit changed, or the e-mail fallback changed.
