## 1. SDLC

- [x] 1.1 Rewrite the **Create** step in `CLAUDE.md`: dependency analysis for every new issue, `Dependencies` section with links or `None.`, the commands to set and read "blocked by" relations
- [x] 1.2 Add the open-blockers command to the **Pick** step in `CLAUDE.md`
- [x] 1.3 State the `Dependencies` rule in the `openspec/config.yaml` context

## 2. Verification

- [x] 2.1 Acceptance signal: run the read command on an existing issue with blockers (#170) and the add/read/remove commands on #281, and confirm #281 ends with no relations
- [x] 2.2 Run every check CI runs (`pnpm check`, plugin validation, commitlint, docs build), `openspec validate v3-281-sdlc-issue-deps --strict` and `openspec validate --specs --strict`
