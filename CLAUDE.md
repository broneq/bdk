# BDK — Broneq Dev Kit

Claude Code plugin packaging reusable dev workflows (skills, agents, hooks) that install into any project.

## Architecture

```
skills/                  — thin workflow definitions (language-agnostic)
agents/                  — subagent definitions used internally by skills
hooks/                   — hooks.json + shell scripts
rules/                   — convention docs distributed WITH the plugin to end-users
STARTUP_INSTRUCTIONS.md  — injected into user sessions at SessionStart via hook
tests/evals/             — skill behavior evals (LLM output grading, iterations)
tests/unit/              — pytest unit/integration tests for scripts
docs/                    — design specs and analysis
```

> `rules/` = BDK distributable output — ships to user projects. Not `.claude/rules/` (dev-time conventions for BDK itself).

## Key Conventions

- Skills must be **language-agnostic** — no hardcoded `pytest`, `go test`, `npm test`, etc.
- Environment discovery (test runner, build tool, lint command) delegated to `STARTUP_INSTRUCTIONS.md`
- New skills auto-inherit all conventions — edit shared foundation, not individual skills
- Skills reference each other with full namespace: `/bdk:create-plan`, `/bdk:debug`
- Every skill starts with: `> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md)...`

## Development Commands

```bash
# Install BDK locally into a test project
# Launch Claude Code from the target project directory with:
claude --plugin-dir ~/projects/bdk

# Invoke a skill in the test project
/bdk:commit
/bdk:debug

# Run unit tests (deterministic, fast)
pytest tests/unit/

# Run skill evals — see .claude/rules/skill-test-eval.md for format
```

## Adding a New Skill

1. Create `skills/<name>/skill.md`
2. Verify: no project-specific paths, tool names, or commands
3. Add entry to `## Skills` table in `README.md`
4. Write eval in `tests/evals/skills/<name>/`

Portability rule: skill only makes sense for one language stack or domain → not BDK. Put in target project's `.claude/` instead.

## Adding an Agent

1. Create `agents/<name>.md`
2. Assign model (`haiku` = fast/cheap, `sonnet` = balanced, `opus` = deep analysis)
3. List in `## Agents` table in `README.md`

## Modifying the Shared Foundation

`STARTUP_INSTRUCTIONS.md` injected into every user session. Changes affect all skills.
- Keep concise — occupies context every session start
- Verify skills relying on modified section still work
- Test in isolated project after changes

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
