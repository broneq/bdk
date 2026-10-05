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

## Required: Dispatch Packages, Never a Command

A skill that starts a role agent passes the dispatch package path from `bdk dispatch build`, never a resolved command string. The dispatching skill does not know the project's runner; the kernel puts the configured `tools.*` entries into a runner package's `Checks` section, and the agent runs them from there.

A command baked into a dispatch prompt runs correctly in the project it was written for and silently runs the wrong scope - usually the whole suite - everywhere else. Nothing errors; the plan just takes minutes longer per group.

## Exception: Skills That Detect the Stack

A skill whose job is _discovering_ the environment names runners and frameworks by necessity — it maps a discovered runner to the command forms it writes into `.bdk/settings.yaml`. The ban above is on **consuming** a hardcoded command; naming one to derive settings is the whole function. Do not "portability-fix" such a table into generic prose: a derivation table that cannot name `vitest` cannot produce `vitest related --run`.

## Required: Agents Reading Tool Commands and Rules

A role agent gets the project's commands from its package (`Checks` of a runner package) and its rules with `bdk rules show --ticket <ticket>`; a skill gets them from its `ctx skill` sections (`Project commands: <group>`, `Rules: <category>`). Never embed a tool table or a rule text in an agent or a role body.

## Required: Standard Skill Header

Every **user-invocable workflow skill** must start with (after its two context lines, if it has them):

```
> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).
```

**Exempt:** skills with `user-invocable: false` (the role skills under `skills/roles/` and `swarm`). Agents and orchestrators load them, not users, and the foundation reference adds noise to the agent's context.

## Required: Skill References

Referencing other BDK skills, use full namespace:

- `/bdk:plan` not `/plan`
- `/bdk:plan` not `/plan`

## Domain-Specific Skills Do Not Belong Here

Skill useful for one language, framework, or domain:

- NOT in `skills/`
- Belongs in target project's `.claude/` directory
- Document reasoning in comment if making exceptions
