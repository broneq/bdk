**Impact Analysis (Grep/Read — Tier 3):**

- `Grep(pattern=<symbol name>, path=<src dir>)` — find all source references; always pass `path` to scope
- Cross-check test files separately: `Grep(pattern=<symbol name>, path=<test dir>)`

**Rules:**
- Text search IS the absence check at this tier — finding no references means no impact.
- Manual reference counting is error-prone. Verify thoroughly and flag any uncertainty to the user.
