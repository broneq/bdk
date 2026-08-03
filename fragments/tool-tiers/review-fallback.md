**Code Review Scope (Grep/Read — Tier 3):**

- `git diff --name-only HEAD~1` — changed files
- `git diff --stat HEAD~1` — change size per file
- Read changed files in full; trace callers via `Grep(pattern=<symbol>, path=<dir>)`

**Rules:**
- Text search IS the absence check at this tier — always scope Grep with `path`.
- Without graph risk scoring, review all changed files with equal thoroughness.
