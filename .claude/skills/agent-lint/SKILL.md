---
name: agent-lint
description: Review a BDK agent for the judgment checks `pnpm skill-check` cannot make. Use when reviewing, creating, or editing an agent under agents/, or before committing one.
model: sonnet
argument-hint: "[path/to/agents/name.md]"
---

# Agent Lint

Run `pnpm skill-check` first. It owns every deterministic rule (frontmatter, model, names, limits, the `bdk/*` rules such as `adapter-shape` and `no-mcp-tools`); `pnpm skill-check --list-rules` prints them. Fix its findings before this review. This skill covers only what needs judgment.

## Determine target

- `$ARGUMENTS`: one or more space-separated paths.
- No arguments: ask which file, or infer it from context.

Per path, read the file and run every check. Print a separate report block per file.

## Checks

Report each check as `PASS` or `WARN` with a one-line reason and the line.

### 1. No project-specific file references

WARN when the file names a file that exists in only one project, such as `src/foo.py`, `app/models/user.rb` or `internal/auth/handler.go`. Generic placeholders (`<your-file>`, `path/to/file`) pass.

### 2. No project-specific instructions

WARN on phrases tied to one project: "in this project", "this repo", "our codebase", an organisation or team name, a hardcoded branch, database or service name.

### 3. Safety rules declared

Read-only agents (analysis, review, exploration) state their constraint.

- WARN when `tools:` holds no file-modification tool and the body lacks "MUST NOT modify" or "read-only".
- PASS when `tools:` holds only read-only tools (Read, Grep, Glob, WebFetch, WebSearch; Bash does not count as read-only).

## Output format

```
AGENT LINT: agents/test-runner.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASS  No project-specific file references
PASS  No project-specific instructions
WARN  No safety rules declared - add "MUST NOT modify files" if read-only intent
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1 warning
```

When every file passes, end with `All checks passed.` Make no fixes unless the user asks.
