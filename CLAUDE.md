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
docs/                    — temporary material, task artifacts, user docs, ADRs; never a living spec
openspec/specs/          — living specs of BDK v3 (kernel-cli, kernel-architecture, ...)
```

> `rules/` = BDK distributable output — ships to user projects. Not `.claude/rules/` (dev-time conventions for BDK itself).

## Key Conventions

- Skills must be **language-agnostic** — no hardcoded `pytest`, `go test`, `npm test`, etc.
- Environment discovery (test runner, build tool, lint command) delegated to `STARTUP_INSTRUCTIONS.md`
- New skills auto-inherit all conventions — edit shared foundation, not individual skills
- Skills reference each other with full namespace: `/bdk:create-plan`, `/bdk:debug`
- Every skill starts with: `> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md)...`

## Language

- Everything written into this repository is in English: `docs/`, plans, specs, `README.md`, `CONTRIBUTING.md`, skills, agents, rules, code comments, commit messages, GitHub issues and PR descriptions.
- The conversation language does not change this. When the user writes in another language, reply in that language, but write files in English.
- Exception: `docs/v3/` is a temporary archive of v3 design-session material and stays as written. Do not translate it.

## v3 Work Tracking

- Roadmap and task scope: `docs/V3-IMPLEMENTATION-PLAN.md`. Status: one GitHub issue per task `Tnn` in the `v3.0` milestone, with "blocked by" links for dependencies. Board: https://github.com/users/broneq/projects/1 (set `Status` to In progress when starting a task).
- Pick the next task from issues whose blockers are all closed. Each task runs as an OpenSpec Change `v3-tnn-<slug>` (lowercase: OpenSpec rejects capitals) on a branch `v3/Tnn-<slug>` and ends with a PR into `staging/v3`. Closing keywords only fire on the default branch, so after the merge close the issue with `gh issue close N -c "Done in #PR"`.
- Start a task: `/opsx:propose v3-tnn-<slug>` (or `/opsx:new` + `/opsx:continue` to review artifacts one at a time), naming the task ID and issue. Then `/opsx:apply`, `/opsx:verify`, `/opsx:archive`. Project context and artifact rules: `openspec/config.yaml`.
- Requires the OpenSpec CLI: `npm i -g @fission-ai/openspec@1.13.2`. Its global profile must be `custom` with `ff` and `verify` enabled before running `openspec update`, otherwise the update deletes `/opsx:ff` and `/opsx:verify` from `.claude/`.

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

## Plugin Reference Verification

When implementing or modifying anything that depends on Claude Code plugin loader behaviour — directory layout, manifest fields, hook events, frontmatter, `${CLAUDE_PLUGIN_ROOT}`, skill discovery, MCP/LSP server config, etc. — fetch https://code.claude.com/docs/en/plugins-reference first and verify the convention against the current spec. Don't trust prior assumptions; the spec evolves. Cite the relevant section before recommending non-standard behaviour.
