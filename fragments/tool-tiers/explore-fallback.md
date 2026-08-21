**Codebase Exploration (Glob/Grep/Read - Tier 3):**

- `Glob(pattern="**/*.{ext}")` - inventory files by type; directory names are the module map at this tier
- `Glob(pattern=<dir>/**)` - enumerate one area before reading anything in it
- `Grep(pattern=<regex>, path=<dir>, output_mode="files_with_matches")` - locate the area that owns a concept
- `Grep(pattern=<entry-point marker>, path=<src dir>)` - find flow entry points (route decorators, `main`, CLI registration, handler exports)
- `Read(file_path=<path>)` - read the few files the above narrowed to

**Entry sequence:** top-level `Glob` for the directory shape → `Grep` for the concept → `Read` only the files that matched.

**Rules:**
- Structure has to be inferred from paths and imports; there is no community or architecture map at this tier. Say so rather than presenting an inferred structure as authoritative.
- Always pass `path` to Grep; full-tree scans are slow.
- Text search IS the absence check at this tier - no matches after one synonym retry means absent.
- Read whole files sparingly: prefer `output_mode="content"` with `-n` to sample before reading.
