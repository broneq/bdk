**Deep Symbol Exploration (Serena — Tier 2):**

- `get_symbols_overview(relative_path=<file>)` — file's symbol map (no bodies)
- `find_symbol(name_path=<symbol>, relative_path=<file>, include_body=true)` — read symbol body
- `find_symbol(name_path=<partial>, substring_matching=true)` — discovery when name unknown
- `find_referencing_symbols(name_path=<symbol>, relative_path=<file>)` — usages

**Rules:**
- Use after graph overview to drill into specific files/symbols.
- Scoped to session cwd — outside cwd → fall through to text search.
