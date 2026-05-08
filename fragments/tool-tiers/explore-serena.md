**Deep Symbol Exploration (Serena — Tier 2):**

- `get_symbols_overview(relative_path=<file>)` — full symbol map of a file without reading bodies
- `find_symbol(name_path=<symbol>, relative_path=<file>, include_body=true)` — read a specific symbol's body
- `find_symbol(name_path=<partial>, substring_matching=true)` — broad discovery when exact name unknown
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — who uses this symbol

**Rules:**
- Use after graph overview to drill into specific files or symbols needing deeper analysis.
- Scoped to session cwd. For paths outside cwd, skip Serena and fall through to text search.
