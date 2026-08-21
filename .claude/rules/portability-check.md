---
paths:
  - "skills/**/*.md"
---

# Portability Check — BDK Skill Authoring Rules

Creating or editing skills: verify portability before commit.

## Required: Language-Agnostic Commands

Skills NEVER hardcode:
- Test runners: `pytest`, `go test`, `npm test`, `cargo test`, `rspec`
- Build tools: `make`, `gradle`, `cargo build`, `mvn`
- Lint/format: `ruff`, `eslint`, `golangci-lint`, `rubocop`
- File paths specific to one project structure

Use generic phrasing:
- "run the project's test suite"
- "run the project's linter/formatter"
- "build the project"

Env detection handled by `STARTUP_INSTRUCTIONS.md` — trust it.

## Required: Dispatch Paths and Intent, Never a Command

A skill dispatching a verifier subagent (`bdk:test-runner`, `bdk:static-analyse`) passes **file paths plus what scope is wanted**, never a resolved command string. The dispatching skill does not know the project's runner; the agent reads it from `.bdk/settings.json` through its preloaded meta-skill.

A command baked into a dispatch prompt runs correctly in the project it was written for and silently runs the wrong scope — usually the whole suite — everywhere else. Nothing errors; the plan just takes minutes longer per group.

## Exception: Skills That Detect the Stack

A skill whose job is *discovering* the environment names runners and frameworks by necessity — it maps a discovered runner to the command forms it writes into `.bdk/settings.json`. The ban above is on **consuming** a hardcoded command; naming one to derive settings is the whole function. Do not "portability-fix" such a table into generic prose: a derivation table that cannot name `vitest` cannot produce `vitest related --run`.

## Required: Agents Reading Tool Commands

Agents needing project test/lint/build commands MUST preload the matching meta-skill via `skills:` frontmatter — never embed tool tables:

| Agent need | Meta-skill to preload |
|---|---|
| Run tests | `bdk-test-tools` |
| Run lint/format/typecheck | `bdk-lint-tools` |
| Language- or framework-specific rules | `bdk-rules-languages` |

Meta-skill body resolves at agent spawn. Edits to `.bdk/settings.json` take effect on the next agent spawn, not retroactively.

## Required: Standard Skill Header

Every **user-invocable workflow skill** must start with:

```
> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).
```

**Exempt:** meta-skills with `user-invocable: false` (e.g., `bdk-test-tools`, `bdk-lint-tools`, `bdk-rules-*`, `bdk-tier-*`). They are preloaded into agents, not invoked by users, and the foundation reference adds noise to the agent's context.

## Required: Skill References

Referencing other BDK skills, use full namespace:
- `/bdk:create-plan` not `/create-plan`
- `/bdk:debug` not `/debug`

## Domain-Specific Skills Do Not Belong Here

Skill useful for one language, framework, or domain:
- NOT in `skills/`
- Belongs in target project's `.claude/` directory
- Document reasoning in comment if making exceptions