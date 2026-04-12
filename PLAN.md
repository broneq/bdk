# BDK — Broneq Dev Kit

A personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks
into a single installable unit.

---

## Naming

- **Full name:** Broneq Dev Kit
- **Plugin ID:** `bdk`
- **Namespace:** `/bdk:<skill>` (e.g., `/bdk:cr`, `/bdk:commit`, `/bdk:plan`)

---

## Source

Skills, agents, and hooks are ported from the battle-tested configuration in:
```
~/PycharmProjects/or-migrator/.claude/
```

That project has 18 skills, 11 agents, 5 hooks, and 24 rules developed for a
complex Python XML migration codebase. BDK extracts the generic, project-agnostic parts.

---

## Plugin Structure

```
bdk/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (name, description, author)
├── skills/
│   ├── cr/
│   │   ├── SKILL.md
│   │   └── references/      # reviewer-prompt, report templates
│   ├── commit/
│   │   └── SKILL.md
│   ├── create-plan/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── execute-plan/
│   │   └── SKILL.md
│   ├── verify-plan/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── debug/
│   │   └── SKILL.md
│   ├── refactor/
│   │   └── SKILL.md
│   ├── test-driven-development/
│   │   └── SKILL.md
│   ├── brainstorming-session/
│   │   ├── SKILL.md
│   │   └── references/      # design-template.md
│   ├── create-adr/
│   │   └── SKILL.md
│   ├── save-progress/
│   │   └── SKILL.md
│   ├── restore-progress/
│   │   └── SKILL.md
│   └── explain-complex-code/
│       └── SKILL.md
├── agents/
│   ├── code-reviewer.md
│   ├── explorer.md
│   ├── test-runner.md
│   ├── dead-code-detector.md
│   ├── duplicate-detector.md
│   ├── architecture-reviewer.md
│   ├── static-analyse.md
│   ├── step-simulator.md
│   ├── helper-writer.md
│   ├── log-analyzer.md
│   └── web-researcher.md
├── hooks/
│   ├── format-python.sh     # Auto-format with ruff on file edit
│   └── typecheck-python.sh  # Run mypy on file edit
└── README.md
```

---

## Skills — Portability Assessment

| Skill | Status | Notes |
|-------|--------|-------|
| `cr` | Portable | Generic code review workflow |
| `commit` | Portable | Conventional commit message generation |
| `create-plan` | Portable | 5-phase TDD-driven planning |
| `execute-plan` | Portable | Executes plans with review checkpoints |
| `verify-plan` | Portable | Validates plan against requirements |
| `debug` | Portable | Structured debugging methodology |
| `refactor` | Portable | Step-by-step refactoring workflow |
| `test-driven-development` | Portable | Enforces test-first discipline |
| `brainstorming-session` | Portable | Creative design brainstorming |
| `create-adr` | Portable | Architecture Decision Records |
| `save-progress` | Portable | Checkpoint progress to docs/progress/ |
| `restore-progress` | Portable | Resume from saved checkpoints |
| `explain-complex-code` | Portable | Generate documentation for complex code |
| `update-docs` | Partial | Has project-specific references — needs cleanup |
| `create-fixture` | Skip | References or-migrator fixture builder API |
| `analyze-migration` | Skip | Domain-specific to or-migrator |
| `graphviz-docs-compiler` | Skip | Project-specific diagram patterns |

---

## Agents — All Portable

All 11 agents are generic and fully portable:

| Agent | Model | Purpose |
|-------|-------|---------|
| `code-reviewer` | sonnet | Layer-group deep code review |
| `explorer` | haiku | Fast codebase exploration |
| `test-runner` | haiku | Execute tests, parse results |
| `dead-code-detector` | haiku | Find unreachable/unused code |
| `duplicate-detector` | haiku | Find code duplication |
| `architecture-reviewer` | sonnet | Audit against architecture rules |
| `static-analyse` | haiku | Linting, type checking, complexity |
| `step-simulator` | haiku | Trace execution step-by-step |
| `helper-writer` | haiku | Write docstrings and comments |
| `log-analyzer` | haiku | Parse and summarize logs |
| `web-researcher` | haiku | Search web for information |

---

## Hooks — Portability Assessment

| Hook | Status | Notes |
|------|--------|-------|
| `format-python.sh` | Portable | Runs ruff format + ruff check --fix on edits |
| `typecheck-python.sh` | Portable | Runs mypy on edits |
| `ensure-directories.sh` | Skip | Hardcoded or-migrator paths (docs/cr, docs/plans) |
| `check_rules_drift.py` | Skip | Tied to or-migrator rules/ path patterns |
| `setup-worktree.py` | Skip | References or-migrator venv/deps setup |

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** — All 24 rules are or-migrator-specific (Froala, SEA, position maps, etc.)
- **Plans** — Generated per-project
- **Project-specific hooks** — Drift detection, worktree setup, directory creation
- **Domain skills** — `analyze-migration`, `create-fixture`, `graphviz-docs-compiler`

---

## Installation (once published)

```bash
# From GitHub
/plugin install bdk@broneq

# Local development
/plugin install ~/projects/bdk
```

---

## Implementation Steps

- [X] Create `.claude-plugin/plugin.json`
- [X] Copy and clean 13 portable skills from or-migrator
- [X] Copy all 11 agents
- [ ] Copy 2 portable hooks (`format-python.sh`, `typecheck-python.sh`)
- [ ] Write `README.md`
- [ ] Test locally with `/plugin install ~/projects/bdk`
- [ ] Verify `/bdk:cr`, `/bdk:commit`, `/bdk:plan` fire correctly
- [ ] Push to GitHub as `broneq/bdk`
