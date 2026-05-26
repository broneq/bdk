**Search (Serena — Tier 2):**

- `find_symbol(name_path=<Name/method>, relative_path=<file>)` — exact lookup; add `substring_matching=true` when approximate
- `search_for_pattern(pattern=<regex>, relative_path=<dir>)` — regex/text search
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — usages
- `get_symbols_overview(relative_path=<file>)` — file's symbol map

**Rules:**
- `find_symbol` authoritative on exact name; use `search_for_pattern` only after symbol lookup fails.
- Scoped to session cwd — outside cwd → fall through to text search.
