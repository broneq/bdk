**Impact Analysis (Grep/Read — Tier 3):**

- `Grep(pattern=<symbol name>, path=<src dir>)` — source refs; always scope with `path`
- Cross-check tests separately: `Grep(pattern=<symbol name>, path=<test dir>)`

**Rules:**
- Text search IS the absence check at this tier — no refs means no impact.
- Manual counting is error-prone. Verify thoroughly; flag uncertainty.
