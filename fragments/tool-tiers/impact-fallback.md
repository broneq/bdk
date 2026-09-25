**Impact Analysis (Grep/Read):**

- `Grep(pattern=<symbol name>, path=<src dir>)` - source references; always scope with `path`
- Cross-check tests separately: `Grep(pattern=<symbol name>, path=<test dir>)`
- No `Grep` in this session: `Bash` with `rg -n <symbol> <src dir>` and `rg -n <symbol> <test dir>`; then `Read` the callers

**Rules:**
- Text search IS the absence check: no references means no impact.
- Manual counting is error-prone. Verify thoroughly; flag uncertainty.
