**Search (Grep/Glob/Read):**

- `Grep(pattern=<regex>, path=<dir>)` - always pass `path` to scope
- `Glob(pattern=<glob>)` - find files by name
- `Read(file_path=<path>)` - read one file
- No `Grep` / `Glob` in this session: `Bash` with `rg <regex> <dir>` (or `grep -rn`), `find <dir> -name <glob>`, `git ls-files <dir>`; then `Read`

**Rules:**
- Text search IS the absence check: no match after one synonym retry means absent.
- Always scope the search to a path; full-tree scans are slow.
