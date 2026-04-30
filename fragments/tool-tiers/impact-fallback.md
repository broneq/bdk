**Impact analysis (Grep/Read — Tier 3):**
- `Grep(pattern=<symbol name>, path=<src dir>)` — find all source references manually
- Cross-check test files separately: `Grep(pattern=<symbol name>, path=<test dir>)`

Manual reference counting is error-prone. Verify thoroughly and flag any uncertainty to the user.
