**Search (Serena — Tier 2):**

- `find_symbol(name_path=<Name/method>, relative_path=<file>)` — locate a named symbol by structural path; use `substring_matching=true` when name is approximate
- `search_for_pattern(pattern=<regex>, relative_path=<dir>)` — flexible regex/text search across files
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — trace all usages of a symbol across the codebase
- `get_symbols_overview(relative_path=<file>)` — scan a file's full symbol map without reading bodies

**Rules:**
- `find_symbol` is authoritative on exact name; use `search_for_pattern` only after symbol lookup fails.
- Scoped to session cwd. For paths outside cwd, skip Serena and fall through to text search.
