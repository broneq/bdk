# Spec Delta

## MODIFIED Requirements

### Requirement: Keys of evidence policy

The settings SHALL declare the evidence policy keys below, registered as one module `policy.evidence` with consumer `evidence` (T23-D16, D46, D48).

| Key                                   | Type                                        | Default                                                                                                                                                                                                                                                                                    | Owner | Consumer   | v2 origin |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------- | --------- |
| `policy.evidence.non-executable`      | append-only array of unique non-empty globs | `**/*.md`, `**/*.mdx`, `**/*.txt`, `**/*.rst`, `**/*.png`, `**/*.jpg`, `**/*.jpeg`, `**/*.gif`, `**/*.svg`, `**/*.webp`, `docs/**`, `LICENSE*`, `CHANGELOG*`, `.bdk/**`                                                                                                                    | T23   | `evidence` | none      |
| `policy.evidence.build-config`        | append-only array of unique non-empty globs | `package.json`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`, `poetry.lock`, `requirements*.txt`, `go.mod`, `go.sum`, `Cargo.toml`, `Cargo.lock`, `Gemfile`, `Gemfile.lock`, `pom.xml`, `build.gradle*`, `Makefile`, `CMakeLists.txt` | T23   | `evidence` | none      |
| `policy.evidence.max-committed-bytes` | integer >= 0                                | `65536`                                                                                                                                                                                                                                                                                    | T23   | `evidence` | none      |

Globs match paths relative to the project root; `*` stays within one path segment and `**` crosses segments. A path matching `build-config` counts as build config even when it also matches `non-executable` (`requirements.txt`). The two lists define the file-class partition every verifier uses: a changed source file gets its related tests, scoped lint and an incremental typecheck; non-executable content gets no tests and no typecheck, at most a configured syntax or schema validator, and never changes the tree hash; build-feeding config always counts as source and always changes the tree hash. The whole unscoped suite runs only on an explicit request or at the end-of-plan gate (`kernel-state`, Evidence manifest, Tree hash). `max-committed-bytes: 0` keeps every evidence file on the machine. A project whose Markdown is executable content (a documentation build) makes it count by listing it in `build-config`, since a default item cannot be removed.

#### Scenario: evidence defaults

- **WHEN** no layer sets `policy.evidence` and `bdk config show policy.evidence --json` runs
- **THEN** the exit code is 0, the two lists hold the defaults of the table and `max-committed-bytes` is 65536

#### Scenario: project appends a glob

- **WHEN** `.bdk/settings.yaml` sets `policy.evidence.build-config: ["mkdocs.yml", "docs/**"]`
- **THEN** the resolved `build-config` holds the defaults followed by both globs, and a change under `docs/` changes the tree hash
