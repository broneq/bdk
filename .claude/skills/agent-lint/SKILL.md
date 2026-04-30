---
name: agent-lint
description: Lint a BDK agent file for best practices and portability. Use when reviewing, creating, or editing an agent (agents/*.md) to verify it meets BDK conventions. Trigger on phrases like "check this agent", "verify agent", "lint agent", or when about to commit a new agent.
model: sonnet
argument-hint: "[path/to/agents/name.md]"
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run.

# Agent Lint

Verify BDK agent file meets portability and quality conventions.

## Determine target

- `$ARGUMENTS`: one or more space-separated paths.
- No arguments: ask user which file, or infer from context.
- Agents live at `agents/<name>.md` — flat file, no subdirectory.

Per path: read file, run all checks. Print **separate report block** per file.

## Run checks

Report each check as `PASS`, `FAIL`, or `WARN` with one-line reason.

### 1. Frontmatter present
- File must start with `---`
- Must contain `name:` and `description:` fields

### 2. Model field — REQUIRED for BDK agents
FAIL if missing or empty. Valid: `haiku`, `sonnet`, `opus`, `inherit`, or full model ID (e.g. `claude-sonnet-4-6`, `claude-haiku-4-5`).
- `inherit` = uses parent model (valid but WARN — pin for predictable cost/behavior)
- Omitting `model:` = defaults to `inherit` — FAIL for BDK agents
- WARN if not standard alias or known model ID

### 3. No absolute paths
FAIL if file contains:
- `/Users/`, `/home/`, `/root/`, `/opt/`, `/var/`, `C:\`
- Any hardcoded filesystem path

### 4. No project-specific file references
WARN if file refs files only in one project:
- Patterns: `src/foo.py`, `app/models/user.rb`, `internal/auth/handler.go`
- Exception: generic illustrative examples (e.g. `<your-file>`, `path/to/file`)

### 5. No project-specific instructions
WARN if file contains phrases tied to specific project:
- "in this project", "this repo", "our codebase", specific org/team names
- Hardcoded branch names, database names, service names

### 6. No language-specific commands
FAIL if file hardcodes language/framework tooling:
- Test runners: `pytest`, `go test`, `npm test`, `yarn test`, `cargo test`, `rspec`, `jest`, `mocha`
- Build tools: `mvn`, `gradle`, `cargo build`, `make` (as build command)
- Linters: `ruff`, `eslint`, `golangci-lint`, `rubocop`, `flake8`

Exception: agents explicitly scoped to one language (name contains language, or description states it).

### 7. Skill cross-references use full namespace
Refs to BDK skills must use `/bdk:` prefix.
- FAIL: `/commit`, `/debug`
- PASS: `/bdk:commit`, `/bdk:debug`

### 8. `name` format valid
Must match `^[a-z0-9-]{1,64}$`. FAIL on uppercase, underscores, spaces, or >64 chars.

### 9. `description` length
WARN if `description:` >250 chars.

### 10. Invalid frontmatter fields
FAIL if unsupported frontmatter fields used.

**Valid agent fields:** `name`, `description`, `model`, `tools`, `disallowedTools`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `isolation`, `color`, `initialPrompt`, `effort`

**Skill-only fields invalid in agents** (FAIL): `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `context`, `agent`, `paths`, `shell`

### 10a. Plugin-unsafe fields
If agent in plugin's `agents/` directory (not `.claude/agents/` or `~/.claude/agents/`):
- WARN if frontmatter uses `hooks`, `mcpServers`, or `permissionMode` — silently ignored in plugin agents. Tell user to copy to `.claude/agents/` if needed.

### 11. `tools` field format
If `tools:` present: must be string or YAML list of known tool names.
- Valid: `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Agent`, `mcp__*`, `Agent(name)` syntax
- WARN on non-standard tool names
- PASS if absent (agent inherits default toolset)
- NOTE: `disallowedTools` can be used alongside or instead of `tools`

### 12. `$ARGUMENT` typo
FAIL if body uses `$ARGUMENT` (no S) — correct is `$ARGUMENTS` or `$ARGUMENTS[N]`.

### 13. Agent file placement
Must be flat `.md` directly under `agents/` — not in subdirectory.
- FAIL: `agents/foo/bar.md`
- WARN if filename doesn't match `name:` field

### 14. External agent dependencies
If agent invokes other agents by name:
1. Check `agents/<name>.md` exists in BDK repo.
2. Not found → WARN: unknown agent dependency, not shipped with BDK.

### 15. Safety rules declared
Read-only agents (analysis, review, exploration) should declare safety constraints.
- WARN if no file-modification tools in `tools:` AND body lacks "MUST NOT modify" or "read-only".
- PASS if `tools:` has only read-only tools (Read, Grep, Glob, WebFetch, WebSearch; Bash excluded).

### 16. Terminal output pattern
Agents with terminal output should define start/complete banners.
- WARN if no output format defined — hard to track in multi-agent workflows.
- PASS if body has output format block or states "no output required".

## Output format

One report block per file.

```
AGENT LINT: agents/test-runner.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS  Frontmatter present (name, description)
PASS  model: haiku defined
PASS  No absolute paths
PASS  No project-specific file references
PASS  No project-specific instructions
WARN  Language-specific command: pytest (line 31) — use "run the project's test suite" or scope agent to specific language
PASS  Skill references use /bdk: namespace
PASS  name format valid
PASS  description length OK
PASS  No invalid frontmatter fields
PASS  tools: field format valid
PASS  No $ARGUMENT typos
PASS  Agent file placement correct
PASS  No unknown external agent dependencies
WARN  No safety rules declared — add "MUST NOT modify files" if read-only intent
PASS  Terminal output pattern defined
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0 failures, 2 warnings
```

All files pass → end with: `All checks passed.`

No fixes beyond check results unless user asks.

## Checklist before responding

Run ALL 16 checks (not just seemingly relevant ones):

- [ ] 1. Frontmatter present
- [ ] 2. Model field — required (FAIL)
- [ ] 3. No absolute paths
- [ ] 4. No project-specific file references
- [ ] 5. No project-specific instructions
- [ ] 6. No language-specific commands
- [ ] 7. Skill cross-references use full namespace
- [ ] 8. `name` format valid
- [ ] 9. `description` length
- [ ] 10. Invalid frontmatter fields
- [ ] 10a. Plugin-unsafe fields (hooks/mcpServers/permissionMode in plugin agents)
- [ ] 11. `tools` field format
- [ ] 12. `$ARGUMENT` typo
- [ ] 13. Agent file placement
- [ ] 14. External agent dependencies
- [ ] 15. Safety rules declared
- [ ] 16. Terminal output pattern

Don't output checklist. Use internally only.