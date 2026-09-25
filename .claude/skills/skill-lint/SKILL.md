---
name: skill-lint
description: Review a BDK skill for the judgment checks `pnpm skill-check` cannot make. Use when reviewing, creating, or editing a skill under skills/, or before committing one.
model: sonnet
argument-hint: "[path/to/SKILL.md]"
---

# Skill Lint

Run `pnpm skill-check` first. It owns every deterministic rule (frontmatter, names, limits, references, layout, the `bdk/*` rules); `pnpm skill-check --list-rules` prints them. Fix its findings before this review. This skill covers only what needs judgment.

## Determine target

- `$ARGUMENTS` may be one or more space-separated paths.
- No arguments: ask which file, or infer it from recent context.

Per path, read `SKILL.md` and every supporting file in the skill directory. Run checks 1 and 2 on every file and check 3 on `SKILL.md` only. Print a separate report block per file.

## Checks

Report each check as `PASS` or `WARN` with a one-line reason and the line.

### 1. No project-specific file references

WARN when the file names a file that exists in only one project, such as `src/foo.py`, `app/models/user.rb` or `internal/auth/handler.go`. Generic placeholders (`<your-file>`, `path/to/file`) pass.

### 2. No project-specific instructions

WARN on phrases tied to one project: "in this project", "this repo", "our codebase", an organisation or team name, a hardcoded branch, database or service name.

### 3. Stated tool invariants are enforced

`allowed-tools` pre-approves; it restricts nothing. When the body states that the skill must **never** call a tool, the restriction belongs in `disallowed-tools`, which removes the tool from the pool.

WARN when the body asserts such an invariant and the frontmatter does not back it:

| Body says something like                                        | Expected frontmatter                                                                      |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| "autonomous", "no human-in-loop", "never ask the user mid-flow" | `disallowed-tools: AskUserQuestion`                                                       |
| "read-only", "MUST NOT modify source files", "never edit"       | `disallowed-tools: Edit NotebookEdit` (plus `Write` when the skill writes nothing at all) |

Do not FAIL: a skill may need the tool on some path, and the field cannot express "only for X". PASS when the invariant is absent or already backed.

## Output format

```
SKILL LINT: skills/brainstorming/SKILL.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WARN  Project-specific reference: src/auth/middleware.py (line 14)
PASS  No project-specific instructions
PASS  Stated tool invariants are enforced
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1 warning
```

When every file passes, end with `All checks passed.` Make no fixes unless the user asks.
