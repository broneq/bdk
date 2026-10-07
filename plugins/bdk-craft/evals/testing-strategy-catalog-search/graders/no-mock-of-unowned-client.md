---
type: regex
pattern: '(vi|jest)\.mock\(\s*[\"''](@elastic/elasticsearch|axios|node-fetch)[\"'']'
match: not_contains
---

No unit test mocks a library the project does not own.
