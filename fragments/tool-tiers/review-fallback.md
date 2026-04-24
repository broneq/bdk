**Code review scope (Grep/Read — Tier 3):**
- `git diff --name-only HEAD~1` — list changed files
- `git diff --stat HEAD~1` — change size per file
- Read changed files in full; manually trace callers via Grep

Without graph risk scoring, review all changed files with equal thoroughness.
