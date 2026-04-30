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

## Required: Standard Skill Header

Every skill must start with:

```
> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).
```

## Required: Skill References

Referencing other BDK skills, use full namespace:
- `/bdk:create-plan` not `/create-plan`
- `/bdk:debug` not `/debug`

## Domain-Specific Skills Do Not Belong Here

Skill useful for one language, framework, or domain:
- NOT in `skills/`
- Belongs in target project's `.claude/` directory
- Document reasoning in comment if making exceptions