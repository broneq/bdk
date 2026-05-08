**Structural Editing (Serena — Tier 2):**

- `replace_symbol_body(name_path=<symbol>, relative_path=<file>, new_body=<code>)` — replace an entire function or class body atomically
- `insert_before_symbol(name_path=<symbol>, relative_path=<file>, new_content=<code>)` — inject code immediately before a symbol's definition
- `insert_after_symbol(name_path=<symbol>, relative_path=<file>, new_content=<code>)` — inject code immediately after a symbol's definition
- `rename_symbol(name_path=<symbol>, relative_path=<file>, new_name=<name>)` — safe rename with automatic reference updates across the codebase
- `safe_delete_symbol(name_path=<symbol>, relative_path=<file>)` — delete a symbol only if it has zero references

**Rules:**
- Prefer these structural tools over Edit/Write for function-level changes — safer and reference-aware.
- Use `safe_delete_symbol` only when reference count is confirmed zero.
