---
description: Conventions for fragment files used with conditional content injection (inject.py)
paths:
  - "skills/**"
  - "fragments/**"
---

# Conditional Injection Fragments

## Fragments

Fragments are Markdown files that are conditionally injected into skills at load time based on `.bdk/settings.json` feature flags. They differ from `references/` (static, always-included documentation) — fragments are **only included** when their condition is met.

Inject calls use `scripts/inject.py`:

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if <condition> --then <path>`
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if <condition> --then-text "short text"`
```

## Directory structure

### Plugin-root fragments (shared across skills)

```
bdk/
├── fragments/
│   └── <capability>/
│       ├── step1-*.md
│       ├── step2-*.md
│       └── ...
```

**Use when:** Fragment content is injected into multiple skills (e.g., graph tool steps, setup instructions, reusable checklists).

**Naming:** Capability directory = feature key verbatim (e.g., `code-review-graph/`, `embeddings/`).

### Skill-local fragments

```
bdk/
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md
│       ├── references/     ← static, always-read
│       └── fragments/      ← conditional, skill-specific
│           ├── react.md
│           ├── vue.md
│           └── typescript-strict.md
```

**Use when:** Fragment content applies to exactly one skill and varies by condition (e.g., language-specific checklists, framework-specific steps).

**Naming:** Fragment filename = condition key (e.g., `react.md`, `typescript-strict.md`). Always use `.md` extension.

## Decision tree

| Fragment scope | Directory | Reference style | Example |
|---|---|---|---|
| Shared (>1 skill) | `fragments/<capability>/` | `${CLAUDE_PLUGIN_ROOT}/fragments/...` | graph steps, setup guides |
| Skill-local (1 skill) | `skills/<name>/fragments/` | `${CLAUDE_SKILL_DIR}/fragments/...` | React checklist in `cr` skill |

## Inject call syntax

### Shared fragment
```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.code-review-graph --then ${CLAUDE_PLUGIN_ROOT}/fragments/code-review-graph/step1-scope.md`
```

### Skill-local fragment
```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if languages.react --then ${CLAUDE_SKILL_DIR}/fragments/react.md`
```

### Inline text (≤2 lines)
```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.embeddings --then-text "Enable embeddings in your STARTUP_INSTRUCTIONS.md"`
```

## `--then` vs `--then-text`

| Use | When |
|---|---|
| `--then <file>` | Anything >2 lines or formatting-sensitive (lists, code blocks, tables) |
| `--then-text "<text>"` | Single line or short, stable snippets (≤2 lines) |

## Placement rule

Place inject calls **immediately before** the section they augment — not clustered at top or bottom of SKILL.md.

**Example:**
```markdown
### Code Review Approach

Start with architecture and impact radius...

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.code-review-graph --then ${CLAUDE_PLUGIN_ROOT}/fragments/code-review-graph/step1-scope.md`

### When to use this skill
```

## Chain files

For multi-tier injection (fallback ladders, complementary tool sets), use a `*.chain.json` file with `inject.py --chain`. Each tier fragment is self-contained — it carries its own tool list and policy rules. Schema and examples in `.claude/rules/fragment-system.md`.

## Rules summary

- **Fragments ≠ references**: Fragments are conditional; references are static. See decision tree above for placement.
- **Syntax**: Use `--then <file>` for content >2 lines; `--then-text` for snippets.
- **Placement**: Inject calls go immediately before the section they augment.
- **Multi-tier**: Use `--chain <file>.chain.json` instead of multiple `--if/--then` calls. See `fragment-system.md`.
- **Frontmatter**: a skill running these `!`...`` calls needs `allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)` — see `.claude/rules/skill-creation-rules.md`.

## Related: rule injection (not fragments)

Three mechanisms coexist — do not confuse them:

| Mechanism | Trigger | Source | Use case |
|---|---|---|---|
| `inject.py` | `!`...`` shell line with `--if` / `--chain` | Skill/agent body | Conditional fragments based on `features.*` or `languages[...]` |
| `inject-rules.py` | `!`...`` shell line, name as arg | `rules/<name>.md` (BDK) + `quality.<name>` override | Language-agnostic quality rules (`code-quality`, `architecture`, `design-patterns`, `security`, `engineering-judgment`) |
| `inject-language-rules.py` | `!`...`` shell line | `rules/languages/<lang>.md` per entry in `languages` + `language-rules.<lang>` override | Language- or framework-specific rule sheets |

All three resolve at skill load-time via `!`command`` — the model receives substituted content, never raw markers or instructions to substitute.

### `<!-- INJECT: <name> -->` markers — template-only

Markers exist **only** inside template files that the skill writes to disk as output (e.g., `skills/create-plan/references/plan-template.md`). The skill loads rule sections into context via `!`python3 .../inject-rules.py <name>`` at the top of its SKILL.md, then instructs the model to substitute marker → matching section verbatim while rendering the template to the output path.

Do **not** put `<!-- INJECT: ... -->` markers inside SKILL.md or agent.md bodies — those are skill-context files, not output templates. Use `!`...`` directly in their place.

See `.claude/rules/quality-rules.md` and `.claude/rules/language-rules.md` for authoring conventions of the latter two.