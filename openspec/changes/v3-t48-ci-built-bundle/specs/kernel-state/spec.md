## MODIFIED Requirements

### Requirement: State JSON Schema

The JSON Schema of every document kind SHALL be generated from the zod schemas into `schema/state/<kind>.json` by `pnpm build`, and the field tables of this spec SHALL equal the generated schemas.

Files: `change.json`, `entry.json`, `attempt.json`, `evidence.json`, `dispatch.json`, `report.json`, `pruned.json`, `plan-part.json`, `plan-index.json`, `design.json`, `design-part.json`, `design-index.json`, `rule.json`, and `common.json` for the shared definitions (ids, refs, hashes, timestamps). Each file is draft 2020-12 with `$id` under `https://raw.githubusercontent.com/broneq/bdk/v3/schema/state/`, describes the frontmatter only, and is produced by the exporter that writes `schema/settings.json` and `schema/cli/`. CI fails on `git diff --exit-code schema/`.

#### Scenario: zod changed without export

- **WHEN** a commit changes a state zod schema without the regenerated `schema/state/` file
- **THEN** CI fails on `git diff --exit-code schema/`

#### Scenario: spec table drifts

- **WHEN** a field table of this spec names a field, requiredness or enum value that the generated schema does not have
- **THEN** the state schema contract test fails naming the document and the field
