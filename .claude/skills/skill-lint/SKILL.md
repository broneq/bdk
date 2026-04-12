---
name: skill-lint
description: Lint a BDK skill or agent file for best practices and portability. Use when reviewing, creating, or editing a skill (skills/*.md) or agent (agents/*.md) to verify it meets BDK conventions. Trigger on phrases like "check this skill", "verify agent", "does this follow best practices", "lint skill", or when about to commit a new skill/agent.
model: haiku
argument-hint: "[path/to/SKILL.md or agents/name.md]"
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

# Skill Lint

Verify BDK skill or agent file meets portability and quality conventions.

## Determine target

- `$ARGUMENTS` provided: use that path.
- Otherwise: ask user which file, or infer from recent context.

Read target file.

## Run checks

Report each check as `PASS`, `FAIL`, or `WARN` with one-line reason.

### 1. Frontmatter present
- File must start with `---`
- Must contain `name:` field
- Must contain `description:` field

### 2. Model field
- **Agent files** (`agents/`): `model:` **required** — FAIL if missing
- **Skill files** (`skills/`): `model:` recommended — WARN if missing (some skills intentionally inherit)

### 3. No absolute paths
Fail if file contains:
- `/Users/`, `/home/`, `/root/`, `/opt/`, `/var/`, `C:\`
- Any hardcoded filesystem path

### 4. No project-specific file references
Warn if file refs files only in one project:
- Patterns: specific filenames like `src/foo.py`, `app/models/user.rb`, `internal/auth/handler.go`
- Exception: generic examples clearly illustrative (e.g. `<your-file>`, `path/to/file`)

### 5. No project-specific instructions
Warn if file contains phrases tied to specific project:
- "in this project", "this repo", "our codebase", specific org/team names
- Hardcoded branch names, database names, service names

### 6. No language-specific commands
Fail if file hardcodes language/framework tooling:
- Test runners: `pytest`, `go test`, `npm test`, `yarn test`, `cargo test`, `rspec`, `jest`, `mocha`
- Build tools: `mvn`, `gradle`, `cargo build`, `make` (as build command)
- Linters: `ruff`, `eslint`, `golangci-lint`, `rubocop`, `flake8`

Use generic phrasing: "run the project's test suite", "run the linter".

### 7. BDK foundation header (skills only)
Skills must start body (after frontmatter) with:
```
> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md)...
```
FAIL if missing.

### 8. Skill cross-references use full namespace
References to other BDK skills must use `/bdk:` prefix.
- FAIL on: `/commit`, `/debug`, `/create-plan` (bare names)
- PASS on: `/bdk:commit`, `/bdk:debug`

### 9. `name` format valid
If `name:` present: must match `^[a-z0-9-]{1,64}$`.
- FAIL on uppercase, underscores, spaces, or >64 chars.

### 10. `description` length
If `description:` present: WARN if >250 chars (truncated in skill listing).

### 11. Invalid frontmatter fields
FAIL if file uses unsupported/obsolete frontmatter fields:
- `arguments:` (list of objects) — replaced by `argument-hint:`
- Any field not in: `name`, `description`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `effort`, `context`, `agent`, `hooks`, `paths`, `shell`

### 12. `effort` valid value
If `effort:` present: must be one of `low`, `medium`, `high`, `max`.
- FAIL on any other value.

### 13. `context` + `agent` combo
If `agent:` present but `context: fork` missing: WARN — `agent:` only applies with `context: fork`.

### 14. Dead skill combo
If both `disable-model-invocation: true` AND `user-invocable: false`: FAIL — skill inaccessible.

### 15. `$ARGUMENT` typo
If body uses `$ARGUMENT` (no S): FAIL — correct variable is `$ARGUMENTS` or `$ARGUMENTS[N]`.

## Output format

```
SKILL LINT: <filename>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS  Frontmatter present (name, description)
FAIL  No model defined — agent files require model:
PASS  No absolute paths
WARN  Project-specific reference: src/auth/middleware.py (line 14)
PASS  No project-specific instructions
FAIL  Language-specific command: pytest (line 22) — use "run the project's test suite"
PASS  BDK foundation header present
PASS  Skill references use /bdk: namespace
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2 failures, 1 warning
```

All checks pass → end with: `All checks passed.`

No fixes beyond check results unless user asks.