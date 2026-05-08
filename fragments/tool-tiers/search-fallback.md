**Search (Grep/Glob/Read — Tier 3):**

- `Grep(pattern=<regex>, path=<dir>)` — text search across files; always pass `path` to scope the search
- `Glob(pattern=<glob>)` — find files by name pattern
- `Read(file_path=<path>)` — read a specific file

**Rules:**
- Text search across the tree IS the absence check at this tier — no structural confirmation needed.
- Always pass `path` to scope Grep; scanning the full filesystem is slow and noisy.
