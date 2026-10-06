# Design

## Context

See proposal.md for the motivation (Why). Current state:

- One serializer already exists: `renderDocument` in `kernel/src/shared/store/state/render.ts` writes `---\n<yaml>---\n<body>`. It serves the state documents (`documents.ts`, written and mutated in place), the generated indexes (`indexes.ts`) and dispatch packages (`dispatch/use-cases/build.ts`). Rule files go through the same store. Two writers build frontmatter by hand: `renderFile` in `kernel/src/spec/domain/render.ts` (living specs) and `projectionFiles` in `kernel/src/rules/domain/projection.ts` (the scoped rules projection, whose globs are always double-quoted). Flow-style documents (reports) come out of the `yaml` library as `[ a, b ]`, and the generated indexes write unaligned Markdown tables; Prettier rewrites both.
- One reader exists: `splitFrontmatter` in `kernel/src/shared/store/frontmatter.ts`. Its body starts right after the closing `---` line, so a blank line becomes part of the body. Thirteen call sites use it, among them `living.ts`, whose `bodyHash` hashes that body for `bdk-merge-hash`.
- Prettier 3.9.9 is pinned in this repository's devDependencies. It was checked by hand on 2026-10-06: a `.bdk/.prettierignore` holding `*` is ignored, and a `.bdk/.prettierrc` holding `{"requirePragma": true}` makes Prettier skip `.bdk/rules/R.md` under `prettier --check .` from the root, `--check .bdk/rules/R.md` with an explicit path, and `--check R.md` from inside `.bdk/rules/`. During apply it turned out that `requirePragma` does not cover JSON, which has no pragma support: Prettier still formats an evidence capture `.json` under that guard.
- `ensureIgnored` (`kernel/src/shared/store/ignore.ts`) is the precedent for a project file the kernel keeps in place. `change new` and `config set` call it before their first write.
- `diffCheck` (`kernel/src/part/use-cases/diff.ts`) already drops every path under `.bdk/` from the undeclared-file check, so a kernel-created `.bdk/.prettierrc` never counts as the user's work. It needs no `onlyKernelIgnores`-style exception.
- `kernel/src/spec/tests/formatter.e2e.ts` proves that a formatter rewrite of hashed state is detected, and that a `.prettierignore` entry prevents it.

## Goals / Non-Goals

**Goals:**

- One serializer and one reader define the frontmatter separator. No writer builds `---` by hand.
- Prettier with default options is a no-op on every kernel-written Markdown file. A contract test enforces this, so the next writer that drifts fails CI.
- Prettier with any options leaves `.bdk/` alone in every project that has the guard, and a missing guard is visible at every session start.

**Non-Goals:**

- Normalising for formatters when hashing. `Committed state is hashed byte for byte` stays: the kernel never hashes a formatted form.
- Guards for dprint, Biome, markdownlint and other tools. They get the Prettier-stable shape only. `/bdk:setup` already proposes their exclusions.
- Changing `/bdk:setup`. Its Prettier exclusion becomes redundant but stays harmless.
- A `bdk doctor` finding for the guard. `stage-skills` says `doctor` does not check tool exclusions, and the session-start warning is the signal the user asked for.

## Decisions

### D1. Fix the shape in the serializer, guard `.bdk/` with a kernel-owned `.prettierrc`

Both are needed. The shape fix removes the churn for files outside `.bdk/` (`.claude/rules/bdk-generated.md`) and for projects without the guard. The guard covers what the shape fix cannot: a project's non-default Prettier options (`proseWrap: always`, a narrow `printWidth`) and future writer drift that the contract test does not see yet.

Alternatives:

- **Run Prettier from the kernel after each write.** Rejected. The bytes would depend on whether Prettier is installed, its version, the project's options and plugins, so two machines would write different files. That breaks the deterministic serialization `render.ts` promises and the byte hashes. It would also add a process spawn of about 300 ms to every write.
- **A nested `.bdk/.prettierignore`.** Rejected: Prettier reads `.prettierignore` only from its working directory (or `--ignore-path`). This was verified on 3.9.9.
- **Append `.bdk/` to the project's root `.prettierignore`.** Rejected as a kernel action. It edits a user-owned file whose format and location vary (`--ignore-path`, a monorepo root). `/bdk:setup` already offers this edit with consent. A file under `.bdk/` belongs to BDK, so the kernel can own it without asking.
- **`overrides` alone instead of `requirePragma`.** Rejected: Prettier has no `ignore` option inside a configuration file, and `requirePragma` is the one setting that turns formatting off. The guard uses an override only to route every file to a parser that honours the pragma (D3).

### D2. The separator is one blank line, and the reader consumes it

`renderDocument` writes `---\n<yaml>---\n` and, when `body !== ""`, `\n<body>`, adding a final newline when the body lacks one (a `log add --body` text has none; Prettier adds it). Flow sequences are written with `flowCollectionPadding: false` (`[a, b]`). `frontmatterFile(yaml, body)` is the one place that joins YAML text and a body; `renderDocument` uses it, and so does the rules export use case for the projection, whose domain function now returns the YAML text and the body separately (`domain/` may not import `shared/store`). The generated indexes render their table through `markdownTable` (`shared/store/state/table.ts`), which pads every column like Prettier. `ctx/render/startup.ts` keeps its own copy of that table code, because `render/` may import only `domain/` and `shared/vocabulary` (`kernel-architecture`). `splitFrontmatter` consumes at most one `\r?\n` that directly follows the closing `---` line. `renderFile` goes away: `renderLiving` builds the data mapping and calls `renderDocument`, so the frontmatter keys keep their order (`bdk-merge-hash`, `bdk-change`).

Because the reader consumes the blank line, `bdk-merge-hash` keeps hashing exactly the body that `renderBody` produced. Old-shape living specs still verify, and new-shape ones verify too. The hash definition in `Living spec file` changes only in wording ("after the frontmatter separator").

Alternatives:

- **Writer-only change.** Rejected: every read-then-write would add one more blank line, and every new-shape living spec would hash a body with a leading `\n`, so its hash would no longer equal the hash of the rendered body.
- **Strip all leading blank lines.** Rejected: it hides real edits. One blank line is the separator; a second one is content.

Side effect: a living spec that a user's Prettier already rewrote, only by inserting that blank line, verifies again. The file is in the canonical shape, so accepting it is correct.

### D3. Guard content and ownership

The content is `{ "requirePragma": true, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] }` and a newline, which is Prettier's own JSON formatting, so the file is stable even if a Prettier run reaches it. `requirePragma` skips a file without an `@format` pragma, but only for parsers that support pragmas; JSON does not. The override gives every file (`*`) the `yaml` parser, which does, so Markdown, YAML, JSON captures and any other file under `.bdk/` are skipped. A skipped file is never parsed, so the parser choice cannot make Prettier fail on it. The guard covers itself the same way. One function next to `ensureIgnored` (`ensureFormatterGuard(store, projectRoot)`) writes the file only when `store.read` returns undefined, and returns whether it wrote. `change new`, `config set`, `rules accept` and `rules import` call it where they call `ensureIgnored`, or before their first write. All four are the commands that can create `.bdk/` content in a project. `rules import --dry-run` writes nothing, so it writes no guard either.

An existing file is never rewritten, even when it is not the guard. A user who wrote their own `.bdk/.prettierrc` made a choice; the session-start warning tells them what it costs.

### D4. Session-start check

`sessionStart` reads `.bdk/.prettierrc` in a BDK project and parses it with the YAML parser the kernel already uses (YAML is a superset of JSON, and Prettier accepts both in `.prettierrc`). It reports `missing` when the file is absent and `weak` when it is unparseable, not a mapping, lacks `requirePragma: true`, or lacks an override whose `files` is or contains `*` with `options.parser: yaml`. The renderer puts the `[BDK] WARNING:` line first among the `[BDK]` lines, because a broken guard silently damages state and is more urgent than a configuration warning. The JSON output (`hooks-session-start.json`) gets no new field: `content` carries the line, as it does for the other findings. The hook never writes the file (decided with the user: a warning, not self-repair), because a session start must not dirty the user's working tree.

### D5. The contract test runs the real Prettier

The test goes in `kernel/tests/contract/`. It builds a temporary project through the bundle (`bdk change new`, `log add` with and without a body, `rules accept`, `rules import`, `rules export --claude`, a plan part with `done plan` for the index, and a spec merge reusing the `spec` E2E support). Then it calls `prettier.format(text, { filepath })` from the pinned devDependency, with no configuration resolution, and asserts equality for each file. Asserting the blank-line shape alone would miss YAML-level differences (flow sequences, quoting), and Prettier is already installed.

The formatter E2E keeps its two scenarios with new preconditions (`kernel-state`, Committed state is hashed byte for byte). Both run Prettier with `--prose-wrap always --print-width 40`, because default Prettier is now a no-op on kernel Markdown and would prove nothing. A third case asserts that no-op for Markdown; JSON evidence captures still change without the guard, which is why the guard needs the override. A fourth case checks explicit paths, a Markdown rule and a JSON capture, from the root and from a subdirectory.

## Risks / Trade-offs

- [In-flight Changes regenerate indexes in the new shape] → Generated indexes and ledger entries are not graph hash inputs (`kernel-pipeline`, Artifact kinds: `design-index` hashes the design parts, `plan-part` hashes the part file), so no node goes stale. `change.md` is written once and never rewritten. The first `done` after the upgrade produces a one-time diff in `plan/index.md` and `design/index.md`.
- [State fixture and byte snapshots change] → They are regenerated in the same PR. The `kernel/tests/fixtures/state/` entry leaves `.prettierignore` only if the regenerated fixture passes `prettier --check`. Host-written fixture files can still differ, and then the entry stays and the PR says why.
- [A project passes `--config <file>` to Prettier] → The nearest-config lookup is bypassed and the guard does nothing. Only the Prettier-stable shape protects the default options there. The case is rare, and the scenario names it in its documentation.
- [Prettier changes its Markdown output in a later major] → The contract test fails on the devDependency bump, before any release. In user projects the guard still holds.
- [The warning fires in every session of an old project until a write command runs] → Intended. It is the strong signal the user asked for, and it names a one-step fix.

## Migration Plan

No data migration. Old-shape files keep reading (D2). Projects get the guard on their next `change new`, `config set`, `rules accept` or `rules import`, and see the warning until then. This repository has no committed `.bdk/`, so it only drops the now-redundant `.prettierignore` entries. Rollback is a revert: old kernels read new-shape files with a body that starts with `\n`. Every body consumer except `bodyHash` trims or renders Markdown, so the only visible effect is a `merge-hash` finding for living specs merged by the new kernel.
