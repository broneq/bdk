# Proposal

## Why

Scope: #140. Tracks #140.

Some Markdown files the kernel writes put the body right under the closing `---` of the frontmatter, and Prettier 3 inserts a blank line there. In a user project whose lint-staged or pre-commit hook runs Prettier on `*.md`, every commit carrying such a file gets rewritten, and the committed bytes stop being the kernel's bytes. That is churn today, and it breaks the byte-exact hashes (`kernel-state`, Committed state is hashed byte for byte) as soon as a formatter touches a hashed file. Fixing the shape alone is not durable: the next format change to a kernel writer, or a project's non-default Prettier options, brings the problem back. The kernel needs a guard that keeps Prettier out of `.bdk/` in every project, and a loud signal when that guard is missing.

## What Changes

- Every kernel-written Markdown document is Prettier-stable: one shared frontmatter serializer writes exactly one blank line between the closing `---` and a non-empty body, and no blank line when the body is empty. The living spec writer goes through the same serializer.
- Reading a document treats that one blank line as part of the separator, not of the body, so a document in the old shape and one in the new shape read to the same body, and a read-then-write round trip is byte-stable. The living spec's `bdk-merge-hash` is defined over the body after that separator, so existing living specs still verify.
- The kernel owns `.bdk/.prettierrc`, holding `{ "requirePragma": true, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] }`. Prettier resolves the nearest configuration file for each file (a nested `.prettierignore` is not read), so with this file it skips every file under `.bdk/` that lacks an `@format` pragma (the override covers JSON, which has no pragma support), whether it runs as `prettier --write .`, on explicit paths from lint-staged, or from a subdirectory. `change new`, `config set`, `rules accept` and `rules import` create the file when it is absent and never overwrite it. The file is committed.
- `bdk hooks session-start` prints a `[BDK] WARNING:` line in a BDK project whose `.bdk/.prettierrc` is missing or is not the guard, saying what breaks and how to restore the file.
- A contract test writes each kernel Markdown kind through the bundle and asserts the repository's pinned Prettier formats each one to identical bytes.
- The formatter E2E (`kernel/src/spec/tests/formatter.e2e.ts`) and its spec scenarios move from "the project's `.prettierignore` names `.bdk/`" to the kernel-owned guard, and keep proving that a formatter rewrite of hashed state is detected.
- This repository's `.prettierignore` drops the entries that exist only because kernel output was not Prettier-stable (`kernel/tests/fixtures/state/`, `.bdk/rules/` and the rules projection), and the repository commits the guard.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `kernel-state`: new requirements `Markdown document shape` (frontmatter separator, read tolerance) and `Formatter guard` (`.bdk/.prettierrc`, its writers, never overwritten); `Living spec file` defines the hashed body after the separator; `Committed state is hashed byte for byte` names the kernel-owned guard as the protection and its scenarios change accordingly.
- `kernel-cli/hooks`: `bdk hooks session-start` adds the formatter-guard warning line.
- `kernel-cli/change`: `bdk change new` creates `.bdk/.prettierrc` when absent.
- `kernel-cli/config`: `bdk config set` creates `.bdk/.prettierrc` when absent.
- `kernel-cli/rules`: `bdk rules accept` and `bdk rules import` create `.bdk/.prettierrc` when absent.

## Impact

- Kernel code: `kernel/src/shared/store/state/render.ts`, `kernel/src/shared/store/frontmatter.ts`, `kernel/src/spec/domain/render.ts`, a new guard module next to `kernel/src/shared/store/ignore.ts`, the use cases of `change new`, `config set`, `rules accept`, `rules import`, and the session-start use case and renderer in `kernel/src/hooks/`.
- CLI contract: `writes` of the four commands in `schema/cli/commands.json`.
- Tests: a new contract test over kernel Markdown kinds, updated `formatter.e2e.ts`, session-start unit tests, regenerated state fixture and byte snapshots where the separator changes.
- Repository: `.prettierignore` loses the entries that only existed for kernel output (the state fixture, `.bdk/rules/` and the rules projection). The repository commits its own `.bdk/.prettierrc`, and its `.bdk/rules/` files move to the separated shape (a blank line only; the bodies and the projection check are unchanged).
- Users: existing projects get `.bdk/.prettierrc` on their next `change new` or `config set`, and see the warning until then. Files already committed in the old shape keep reading and verifying; no migration.
- Out of scope: `/bdk:setup` still proposes `.bdk/` exclusions for tools other than Prettier (`stage-skills`, setup keeps .bdk/ out of the project's tools); the guard makes its Prettier entry redundant but harmless, and changing the skill is left to a later task. Formatters other than Prettier get only the Prettier-stable shape, no guard.
