---
name: skill-lint
description: Lint a BDK skill or agent file for best practices and portability. Use when reviewing, creating, or editing a skill (skills/*.md) or agent (agents/*.md) to verify it meets BDK conventions. Trigger on phrases like "check this skill", "verify agent", "does this follow best practices", "lint skill", or when about to commit a new skill/agent.
model: sonnet
argument-hint: "[path/to/SKILL.md or agents/name.md]"
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

# Skill Lint

Verify BDK skill or agent file meets portability and quality conventions.

## Determine target

- `$ARGUMENTS` may be one or more space-separated paths.
- No arguments: ask user which file, or infer from recent context.

Per path:
1. Read file.
2. List all files in skill directory (recursively). Every file other than `SKILL.md` is supporting file.
3. Each supporting file: lint too (checks 3–6 only — portability checks), regardless of whether referenced in SKILL.md.

Print **separate report block** per file linted.

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
- Exception: generic illustrative examples (e.g. `<your-file>`, `path/to/file`)

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
Refs to other BDK skills must use `/bdk:` prefix.
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

### 16. External skill/agent references
BDK skills depend only on BDK-owned skills. Flag `/slash-command` and agent name invocations NOT prefixed `/bdk:`.

**Slash command refs** (`/name` in body):
- WARN on bare `/name` refs (e.g. `/commit`, `/debug`) — ambiguous, may resolve to wrong skill
- WARN on `/other-plugin:name` — hard dep on external plugin not guaranteed present
- PASS on `/bdk:name` — BDK namespace, expected

**Agent refs** (backtick or plain `agent-name` in body, e.g. `` `test-runner` ``):
1. Check if `agents/<name>.md` exists in BDK repo.
2. If exists → WARN: bare name found, use `/bdk:<name>` prefix.
3. If not exists → WARN: unknown agent dependency, not shipped with BDK.

### 17. Skill directory format
Per Claude Code skills spec, each skill must live at `<skill-name>/SKILL.md`.
- FAIL if filename not exactly `SKILL.md` (case-sensitive)
- WARN if parent dir name doesn't match `name` field in frontmatter (causes confusing dual identities)

### 18. Artifacts go to `.bdk/`
Skills producing file output must write to `.bdk/` in project root, not arbitrary dirs.
- FAIL if skill body instructs writing to `docs/`, `output/`, `tmp/`, `reports/`, or other non-`.bdk` paths
- PASS if output path is `.bdk/...` or no file output produced
- Exception: skills writing code/config into project structure as part of code-gen task (not report/artifact output)

### 19. No unused files in skill directory
List all files in skill directory (recursively). Every file other than `SKILL.md` must be referenced in skill body (markdown link, inline code mention, or explicit filename reference).
- WARN for each file present but not referenced anywhere in `SKILL.md`
- Exception: `SKILL.md` itself always exempt

Check: list dir contents, scan `SKILL.md` body for each filename. Not found → WARN.

### 20. Valid skill directory structure
Allowed layout:

```
<skill-name>/
├── SKILL.md            ← required, exactly this name
├── references/
│   └── *.md            ← templates and reference docs
├── examples/
│   └── *.md            ← example output files only
├── scripts/
│   └── *               ← executable scripts only (*.sh, *.py, etc.)
└── fragments/
    └── *.md            ← conditional injection targets
```

Rules:
- FAIL if any subdirectory other than `examples/`, `references/`, `scripts/`, or `fragments/` exists
- WARN if `fragments/` contains non-`.md` files
- WARN if `*.md` template/reference files sit at root level instead of `references/` — suggest moving
- WARN if `examples/` contains non-`.md` files
- WARN if `references/` contains non-`.md` files
- WARN if `scripts/` contains non-script files (non-executable or non-`.sh`/`.py`/`.js`/`.rb` extensions)
- WARN if any file at root level that is not `SKILL.md` (e.g. `.sh` scripts at root → `scripts/`, `.md` files → `references/`)
- PASS if only `SKILL.md` present (minimal valid structure)

## Output format

One report block per file. Supporting files get abbreviated reports (checks 3–6 only).

```
SKILL LINT: skills/brainstorming/SKILL.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS  Frontmatter present (name, description)
FAIL  No model defined — agent files require model:
PASS  No absolute paths
WARN  Project-specific reference: src/auth/middleware.py (line 14)
PASS  No project-specific instructions
FAIL  Language-specific command: pytest (line 22) — use "run the project's test suite"
PASS  BDK foundation header present
PASS  Skill references use /bdk: namespace
PASS  name format valid
PASS  description length OK
PASS  No invalid frontmatter fields
PASS  Directory format correct (SKILL.md, dir matches name)
WARN  External skill reference: /deploy (line 44) — use /bdk: prefix or remove dependency
FAIL  Artifact path: docs/designs/ (line 88) — skills must write artifacts to .bdk/
WARN  Unused file: examples/old-sample.md — not referenced in SKILL.md
PASS  Directory structure valid (SKILL.md, examples/, scripts/)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2 failures, 2 warnings

SKILL LINT: skills/brainstorming/reference.md  [supporting file — portability checks only]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS  No absolute paths
PASS  No project-specific file references
PASS  No project-specific instructions
PASS  No language-specific commands
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All checks passed.
```

All files pass → end with: `All checks passed.`

No fixes beyond check results unless user asks.

## Checklist before responding

Verify ALL 20 checks were executed for SKILL.md (not just the ones that seemed relevant):

- [ ] 1. Frontmatter present
- [ ] 2. Model field
- [ ] 3. No absolute paths
- [ ] 4. No project-specific file references
- [ ] 5. No project-specific instructions
- [ ] 6. No language-specific commands
- [ ] 7. BDK foundation header
- [ ] 8. Skill cross-references use full namespace
- [ ] 9. `name` format valid
- [ ] 10. `description` length
- [ ] 11. Invalid frontmatter fields
- [ ] 12. `effort` valid value
- [ ] 13. `context` + `agent` combo
- [ ] 14. Dead skill combo
- [ ] 15. `$ARGUMENT` typo
- [ ] 16. External skill/agent references
- [ ] 17. Skill directory format
- [ ] 18. Artifacts go to `.bdk/`
- [ ] 19. No unused files in skill directory
- [ ] 20. Valid skill directory structure

Do not output the checklist. Use it internally to confirm no check was skipped.