---
type: regex
pattern: '(vi|jest)\.mock\(\s*[\"''](stripe|axios|node-fetch|pg)[\"'']'
match: not_contains
---

No unit test mocks a library the project does not own.
