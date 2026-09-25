**Code Review Scope (Bash/Grep/Read):**

- `Bash`: `git diff --name-only <base>` - changed files
- `Bash`: `git diff --stat <base>` - change size per file
- `Read` changed files in full; trace callers with `Grep(pattern=<symbol>, path=<dir>)`, or `rg -n <symbol> <dir>` through `Bash` when `Grep` is not available

**Rules:**
- Text search IS the absence check; always scope the search to a path.
- There is no risk scoring: review all changed files with equal thoroughness.
