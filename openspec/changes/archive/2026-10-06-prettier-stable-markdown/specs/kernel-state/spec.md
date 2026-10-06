## ADDED Requirements

### Requirement: Markdown document shape

Every Markdown file with YAML frontmatter that the kernel writes (Change documents, ledger entries, attempt records, evidence manifests, dispatch packages, reports, generated indexes, rule files, living spec files) SHALL be serialized by one function into this shape: a `---` line, the YAML mapping, a `---` line, then, when the body is not empty, exactly one blank line followed by the body, which ends with a newline (the serializer adds one when the body lacks it). A file with an empty body ends right after the closing `---` line. Line endings are LF. Flow sequences in the frontmatter carry no padding inside the brackets (`[a, b]`), and a Markdown table in a generated body has every column padded to its widest cell. The shape is the one the repository's pinned Prettier produces with default options, so a Prettier pass over a kernel-written file changes no byte.

A reader SHALL treat one blank line directly after the closing `---` line as part of the frontmatter separator, not of the body. A file written before this requirement, whose body starts right under the closing `---`, therefore reads to the same body as the file in the current shape, and reading a document and writing it back yields the current shape byte for byte.

#### Scenario: a log entry with a body

- **WHEN** `bdk log add decision` writes an entry with the body `Chose the shared serializer.`
- **THEN** the file's closing `---` line is followed by one empty line and then `Chose the shared serializer.`, and the file ends with one newline

#### Scenario: an entry without a body

- **WHEN** `bdk log add decision` writes an entry with no body
- **THEN** the file ends with the closing `---` line and one newline

#### Scenario: the old shape reads to the same body

- **WHEN** a rule file holds its body right under the closing `---`, and another file holds the same frontmatter, one blank line and the same body
- **THEN** both read to the same body, and `bdk rules check` passes on both

#### Scenario: round trip is stable

- **WHEN** the kernel reads a document in either shape and writes it back unchanged
- **THEN** the written bytes are the current shape, and a second read and write changes no byte

#### Scenario: every kernel Markdown kind is Prettier-stable

- **WHEN** the contract test writes through the bundle a rule (`rules accept`), an imported rule (`rules import`), a ledger entry with a body and one without, the profile assumption and `change.md` of `change new`, the rules projection (`rules export --claude`), a generated plan index and a merged living spec, and formats each with the repository's pinned Prettier and default options
- **THEN** every formatted text equals the file's bytes

### Requirement: Formatter guard

The kernel SHALL own `.bdk/.prettierrc`, whose content is exactly the line `{ "requirePragma": true, "overrides": [{ "files": "*", "options": { "parser": "yaml" } }] }` and a newline. Prettier resolves the nearest configuration file of each file it formats and does not read a `.prettierignore` below its working directory, so this file governs every file under `.bdk/`. `requirePragma` makes Prettier skip a file without an `@format` pragma; JSON has no pragma support, so the override hands every file to the `yaml` parser, which has one. Together they keep Prettier off every file under `.bdk/` (Markdown, YAML, JSON evidence captures and any other kind), whether it runs over the whole tree, on explicit paths (lint-staged, pre-commit hooks) or from a subdirectory. The file is committed; it is not one of the `Ignored paths`. The guard is in force when the file is a mapping that sets `requirePragma: true` and has an override whose `files` is or contains `*` and whose `options.parser` is `yaml`.

Before their first write, `change new`, `config set`, `rules accept` and `rules import` create the file when it is absent. A file that exists is never changed, whatever it holds: the kernel does not take over a configuration the user wrote. `bdk hooks session-start` warns when the guard is not in force (`kernel-cli/hooks`, `bdk hooks session-start`) and never writes it. A refused command writes no guard, as it writes no other file.

#### Scenario: fresh repository

- **WHEN** `bdk change new` runs in a fresh repository
- **THEN** `.bdk/.prettierrc` holds exactly the guard content, and `git status --porcelain` lists it as untracked, not ignored

#### Scenario: a user's file is kept

- **WHEN** `.bdk/.prettierrc` holds `{"semi": false}` and `bdk config set tools.lint none` runs
- **THEN** the file's bytes are unchanged

#### Scenario: explicit paths are skipped

- **WHEN** a rule file under `.bdk/rules/` and a JSON evidence capture are reformatted by hand so that Prettier would change them, `.bdk/.prettierrc` holds the guard content, and the pinned Prettier runs `--check` on each path from the project root, and on the rule from `.bdk/rules/`
- **THEN** every run exits 0, and without the guard the same checks on the project root fail

#### Scenario: a refusal writes no guard

- **WHEN** `bdk change new "x" --kind review` is refused with `policy/empty-range` in a project without `.bdk/.prettierrc`
- **THEN** `.bdk/.prettierrc` still does not exist

## MODIFIED Requirements

### Requirement: Living spec file

Each capability of the living spec SHALL be one file `.bdk/specs/<capability>/spec.md`, written only by the kernel's merge in a canonical form with a merge hash in its frontmatter, so that a manual edit is detectable (D2b, V1-7).

Frontmatter (exactly these two keys, in this order):

| Key              | Value                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `bdk-merge-hash` | `sha256:` and the lowercase hex SHA-256 of the body's UTF-8 bytes: everything after the frontmatter separator (`Markdown document shape`). |
| `bdk-change`     | The id of the Change whose merge last wrote the file.                                                                                      |

The body is rendered canonically: `# <capability> Specification`, a blank line, `## Purpose`, the purpose, `## Requirements`, then each requirement block in order, one blank line between blocks and sections, LF line endings, one final newline, trailing whitespace trimmed. The format is OpenSpec's main spec format, so `openspec validate --specs --strict` accepts the directory (T02 decision Q-1: compatibility proven by a CI contract test, no runtime dependency). A file whose body does not hash to its `bdk-merge-hash`, or without the key, was edited outside the merge: `spec merge` and `change close` refuse with `policy/merge-hash-mismatch`, and `doctor` reports the `merge-hash` finding.

#### Scenario: hash covers the body

- **WHEN** the merge writes a file and one character of its body is then changed
- **THEN** the hash of the body no longer equals `bdk-merge-hash` and `doctor` reports `merge-hash` for the file

#### Scenario: OpenSpec accepts the merged specs

- **WHEN** CI copies the `.bdk/specs/` produced by the E2E merge into `openspec/specs/` of an empty repository and runs `openspec validate --specs --strict`
- **THEN** every capability is valid

#### Scenario: a living spec in the old shape still verifies

- **WHEN** `.bdk/specs/auth/login/spec.md` was merged before this change, so its body starts right under the closing `---`, and `bdk doctor --json` runs
- **THEN** it reports no `merge-hash` finding for the file

### Requirement: Committed state is hashed byte for byte

The kernel SHALL hash committed state over its exact bytes and SHALL NOT normalise it for any formatter: the graph input hashes over a Change's artifacts (`kernel-pipeline`, Artifact kinds) and the `bdk-merge-hash` of a living spec (`Living spec file`). A tool that rewrites a file under `.bdk/` therefore shows as a stale node, whose `explain` names the recorded and the current hash, and as the `merge-hash` finding of `bdk doctor`; the ledger, attempt records and evidence manifests carry no hash of their own bytes and still read. The protection has three layers: every Markdown file the kernel writes is already in the shape the repository's pinned Prettier produces with its default options (`Markdown document shape`); the kernel-owned `.bdk/.prettierrc` keeps Prettier off `.bdk/` whatever options the project uses (`Formatter guard`); and for every other tool the project's own ignore lists exclude `.bdk/` (`stage-skills`, setup keeps .bdk/ out of the project's tools), while no role rewrites `.bdk/` files (`role-contracts`, Contracts leave BDK's own files to setup).

#### Scenario: prettier over a reviewed Change

- **WHEN** `.bdk/.prettierrc` is deleted from a project whose `tiny` Change passed `gate:review` and whose living spec `auth/login` was merged and committed, and the repository's pinned Prettier runs `--write . --prose-wrap always --print-width 40`
- **THEN** files under `.bdk/` change, `plan-part:01` is `stale` with both hashes in its `why`, `bdk doctor --json` reports the `merge-hash` finding at level `fail` for `.bdk/specs/auth/login/spec.md`, and `bdk log list --json` exits 0

#### Scenario: prettier with .bdk/ ignored

- **WHEN** the same run happens with `.bdk/.prettierrc` as `change new` wrote it
- **THEN** no file under `.bdk/` changes, `plan-part:01` stays `done`, and `bdk doctor --json` reports no `merge-hash` finding

#### Scenario: default Prettier is a no-op on kernel output

- **WHEN** `.bdk/.prettierrc` is deleted from the same project and the pinned Prettier runs `--write .` with default options
- **THEN** no Markdown file the kernel wrote under `.bdk/` changes and `bdk doctor --json` reports no `merge-hash` finding
