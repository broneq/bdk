**Structural Editing (Serena — Tier 2):**

- `replace_symbol_body(name_path=<symbol>, relative_path=<file>, new_body=<code>)` — atomic body replace
- `insert_before_symbol` / `insert_after_symbol(name_path=<symbol>, relative_path=<file>, new_content=<code>)` — inject around a symbol
- `rename_symbol(name_path=<symbol>, relative_path=<file>, new_name=<name>)` — safe rename + reference update
- `safe_delete_symbol(name_path=<symbol>, relative_path=<file>)` — delete only if zero references

**Rules:**
- Prefer these over Edit/Write for function-level changes — safer, reference-aware.
- Use `safe_delete_symbol` only when reference count is confirmed zero.
