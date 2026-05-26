**Search (Grep/Glob/Read — Tier 3):**

- `Grep(pattern=<regex>, path=<dir>)` — always pass `path` to scope
- `Glob(pattern=<glob>)` — find files by name
- `Read(file_path=<path>)` — read one file

**Rules:**
- Text search IS the absence check at this tier — no structural confirmation needed.
- Always pass `path` to Grep; full-tree scans are slow.
