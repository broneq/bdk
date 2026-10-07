# Tasks

## 1. Test harness and dependency

- [x] 1.1 Add `@fission-ai/openspec` 1.13.2 as an exact dev dependency of `plugins/bdk`; verify `pnpm install` then `pnpm install --frozen-lockfile` succeed and the CLI resolves from `plugins/bdk` with `--version` 1.13.2
- [x] 1.2 Write `plugins/bdk/tests/openspec-schema.test.ts` (design D7, D8): isolated temporary project, schema files on disk, `schema which` and `schema validate`, `new change --schema bdk` and `status --json`, `instructions plan --json`, a complete Change (`status`, `validate --strict`), `archive --yes`; verify it fails because `plugins/bdk/openspec/schemas/bdk/` does not exist

## 2. Schema

- [x] 2.1 Write `plugins/bdk/openspec/schemas/bdk/schema.yaml` (design D3, D4, D6) and the templates `proposal.md`, `spec.md`, `design.md`, `part.md` (D4, D5); verify the schema test passes, `pnpm format:check` passes on the YAML, and `claude plugin validate plugins/bdk --strict` still passes with the new directory

## 3. Acceptance and gates

- [x] 3.1 Acceptance by hand in a separate test project: copy the shipped schema to `openspec/schemas/bdk/`, `openspec new change demo --schema bdk`, `openspec status --change demo` lists the four artifacts; complete it and `openspec archive demo --yes` merges its delta; confirm the release snapshot rule of `scripts/publish-plugin.ts` keeps `openspec/schemas/bdk/`
- [x] 3.2 Run every check of `.github/workflows/pr.yml` locally (`pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `claude plugin validate` on the marketplace and every plugin, commitlint on the commit), `openspec validate v3-180-bdk-openspec-schema --strict` and `openspec validate --specs --strict`; verify all pass
