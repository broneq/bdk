**Structural Editing (Read/Edit/Write - Tier 3):**

- `Read(file_path=<path>)` - read the file before every edit; required, and the edit fails without it
- `Edit(file_path=<path>, old_string=<exact text>, new_string=<new text>)` - exact-match replacement
- `Edit(..., replace_all=true)` - every occurrence in that one file; use for a rename inside a single file
- `Write(file_path=<path>, content=<full text>)` - new files, or a full rewrite of a file you have read

**Rules:**
- There is no reference-aware rename or safe delete at this tier. Before renaming or deleting a symbol, `Grep` its name across source **and** tests, then edit every call site yourself - a rename that compiles locally still breaks callers you did not look for.
- Include enough surrounding context in `old_string` to make the match unique; `replace_all` is per-file only, never repo-wide.
- Prefer `Edit` over `Write` on existing files. A full `Write` silently discards anything you did not carry over.
- After a multi-file edit, re-`Grep` the old name to prove no site was missed.
