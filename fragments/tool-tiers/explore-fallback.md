**Codebase Exploration (Glob/Grep/Read):**

- `Glob(pattern="**/*.{ext}")` - inventory files by type; directory names are the module map
- `Glob(pattern=<dir>/**)` - enumerate one area before reading anything in it
- `Grep(pattern=<regex>, path=<dir>, output_mode="files_with_matches")` - locate the area that owns a concept
- `Grep(pattern=<entry-point marker>, path=<src dir>)` - find flow entry points (route decorators, `main`, CLI registration, handler exports)
- `Read(file_path=<path>)` - read the few files the above narrowed to
- No `Grep` / `Glob` in this session: `Bash` with `git ls-files <dir>` or `find` for the shape, `rg -l <regex> <dir>` for the concept; then `Read`

**Entry sequence:** directory shape → search for the concept → `Read` only the files that matched.

**Rules:**
- Structure is inferred from paths and imports; there is no architecture map. Say so rather than presenting an inferred structure as authoritative.
- Always scope the search to a path; full-tree scans are slow.
- Text search IS the absence check: no match after one synonym retry means absent.
- Read whole files sparingly: sample matches with line numbers (`output_mode="content"` with `-n`, or `rg -n`) before reading.
