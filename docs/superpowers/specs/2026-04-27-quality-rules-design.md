# Quality Rules — Design Spec

**Date:** 2026-04-27
**Status:** Approved for implementation
**Branch:** feature/bdk-plugin

## Problem

Two BDK skills reference code-quality rule files that don't exist in user projects:

- `skills/cr/references/reviewer-prompt-template.md:18` — calls `{! inject-language-specific-rules.py code-quality}`. The script doesn't exist anywhere in the repo.
- `skills/create-plan/references/plan-template.md:182` — hardcodes path `.claude/shared/code-quality.md`. The file doesn't exist in BDK and isn't created in user projects on install.

Both references break silently. The `cr` template additionally references `architecture` rules at line 22 with the same broken pattern, indicating a planned tier of language-agnostic rule categories.

## Goals

1. Ship language-agnostic default rule sets with the BDK plugin (`code-quality`, `architecture`).
2. Allow users to override or extend defaults without modifying the plugin directory.
3. Allow users to point at existing project documentation (e.g. `docs/standards/coding.md`) as their rule source.
4. Fix both broken references so `/bdk:cr` and `/bdk:create-plan` work end-to-end.
5. Make adding new rule categories straightforward.

## Non-Goals

- Per-language rule overlays (e.g. python-specific code-quality). Rules stay language-agnostic — language nuance lives in the consuming skill.
- Rule suppression (disabling individual default rules via markers). YAGNI; revisit if requested.
- Migration tooling for users who already wrote their own `.claude/shared/code-quality.md` (the broken path was never functional).

## Design

### Settings schema

`.bdk/settings.json` gains a `quality` section:

```json
{
  "quality": {
    "code-quality": "docs/standards/coding.md",
    "architecture": {
      "path": "docs/architecture.md",
      "mode": "replace"
    }
  }
}
```

**Entry forms:**

| Form | Meaning |
|------|---------|
| Missing key | Use BDK default only. |
| String `s` | Shorthand — `{path: s, mode: "extends"}`. |
| Object `{path, mode?}` | Explicit. `mode` defaults to `"extends"`. Allowed values: `"extends"`, `"replace"`. |

**Path resolution:** Relative to project root (where `.bdk/settings.json` lives). Absolute paths allowed.

### Resolver — `scripts/inject-rules.py`

New script. Single positional argument: rule name (e.g. `code-quality`).

```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py code-quality
```

**Algorithm:**

1. Locate `.bdk/settings.json` (search upward from cwd, same convention as `inject.py`).
2. Locate BDK default at `${CLAUDE_PLUGIN_ROOT}/rules/<name>.md`.
3. If `quality.<name>` missing in settings → output BDK default content; exit 0.
4. Normalize entry:
   - String → `{path: <s>, mode: "extends"}`
   - Object → validate `path` required; `mode` defaults to `"extends"`; unknown mode → stderr warn, treat as `"extends"`.
5. Read user file at `entry.path`:
   - Missing file → stderr error + **exit 1**.
   - Read failure (permissions, encoding) → stderr error + **exit 1**.
6. If extends mode AND BDK default missing → stderr error + **exit 1** (catches misconfigured plugin). Replace mode does not require BDK default to exist.
7. Output:
   - `extends` → BDK default + `\n\n` + user content.
   - `replace` → user content only.

**Failure philosophy:** Loud. A misconfigured `quality` entry breaks `/bdk:create-plan` and `/bdk:cr` until fixed. Silent recovery would hide config errors that affect every plan and every review.

### Files shipped with BDK

```
bdk/
├── rules/
│   ├── code-quality.md          ← language-agnostic default
│   └── architecture.md          ← language-agnostic default
├── scripts/
│   └── inject-rules.py          ← new resolver
└── .claude/rules/
    └── quality-rules.md         ← BDK-dev convention: when/how to add new rule
```

### Default rule content

#### `rules/code-quality.md`

- **Naming.** Descriptive identifiers; no abbreviations unless idiomatic for the language.
- **Function size.** One responsibility per function. Big functions become hard to test and review.
- **Comments.** Explain *why* — the non-obvious constraint, the workaround. Not *what* (the code already says that). No commented-out code; delete it.
- **Error handling.** Validate at system boundaries (user input, external APIs). Trust internal calls and framework guarantees. No defensive try/except around code that can't fail.
- **Dead code.** Remove unused code rather than commenting it out. Version control preserves history.
- **Tests.** New public APIs have tests. Tests document intended behavior.
- **No language-specific tooling.** This file is language-agnostic. Skill consumers handle language nuance.

#### `rules/architecture.md`

- **Module boundaries.** Each module has one clear purpose and a small, well-defined interface.
- **Dependency direction.** No cycles. Layers (e.g. domain → infra) flow one way.
- **Premature abstraction.** Three concrete instances before extracting an abstraction. Two similar functions is fine; an interface for "future implementations" is not.
- **Justified changes.** New abstractions and indirection serve current requirements, not speculative ones.
- **Single source of truth.** Same fact should not be expressed in two places that can drift.

### Skill integration

**Constraint:** Shell substitution (`!`...`` `) only fires at SKILL.md load time. It does NOT execute inside `references/*.md`. Templates therefore use a **placeholder convention** that the skill resolves explicitly via the Bash tool when constructing prompts.

#### Placeholder syntax

Templates mark injection points with HTML comments:

```
<!-- INJECT: code-quality -->
<!-- INJECT: architecture -->
```

Invisible if rendered without processing. Trivial to grep/regex.

#### Resolution flow inside skills

Skill SKILL.md instructs Claude:

> Before emitting the template (or constructing the prompt from it), find every `<!-- INJECT: <name> -->` placeholder. For each, run:
> ```
> python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py <name>
> ```
> Substitute the placeholder with the script's stdout. If the script exits non-zero, surface the error and stop.

#### `skills/cr/references/reviewer-prompt-template.md`

Line 18 changes from:

```
{! inject-language-specific-rules.py code-quality}
```

to:

```
<!-- INJECT: code-quality -->
```

Line 22 changes from:

```
{! inject-language-specific-rules.py architecture}
```

to:

```
<!-- INJECT: architecture -->
```

#### `skills/cr/SKILL.md`

Add a step to the prompt-construction phase: "Resolve `<!-- INJECT: <name> -->` placeholders in the reviewer prompt template by running `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py <name>` for each. Substitute output into the prompt before dispatching reviewers."

#### `skills/create-plan/references/plan-template.md`

Lines 181-182 change from:

```
**Code Standards:**
.claude/shared/code-quality.md
```

to:

```
**Code Standards:**

<!-- INJECT: code-quality -->
```

#### `skills/create-plan/SKILL.md`

Add a step before emitting the plan: "Resolve `<!-- INJECT: <name> -->` placeholders in the plan template by running `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py <name>` for each. Substitute output into the final plan."

### Tests

`tests/unit/test_inject_rules.py` — pytest suite covering:

| Case | Expected |
|------|----------|
| No `.bdk/settings.json` | BDK default emitted, exit 0 |
| Settings has no `quality` section | BDK default emitted, exit 0 |
| Settings has `quality` but rule key missing | BDK default emitted, exit 0 |
| String entry, user file exists | BDK default + user content, exit 0 |
| Object entry `mode: "extends"`, user file exists | BDK default + user content, exit 0 |
| Object entry `mode: "replace"`, user file exists | User content only, exit 0 |
| Object entry `mode: "garbage"` | Warn to stderr, treat as extends, exit 0 |
| String entry, user file missing | Stderr error, exit 1 |
| Object entry, `path` missing | Stderr error, exit 1 |
| Object entry, user file unreadable (mock permission error) | Stderr error, exit 1 |
| Unknown rule name (no BDK default) | Stderr error, exit 1 |
| Empty user file with extends mode | BDK default + empty (still concatenated cleanly) |

Use `tmp_path` fixtures. Set `CLAUDE_PLUGIN_ROOT` env var per test. No real filesystem mutation outside tmp dirs.

### Documentation updates

- **`README.md`** — Add a "Quality Rules" section showing the four usage patterns:
  1. Zero config (use BDK defaults).
  2. Extend defaults (`.bdk/rules/code-quality.md` with additions, settings entry as string).
  3. Replace defaults (object form with `mode: "replace"`).
  4. Point at existing doc (string form pointing to `docs/standards/coding.md`).
- **`STARTUP_INSTRUCTIONS.md`** — Brief mention that BDK ships quality rules and `.bdk/settings.json` `quality` section overrides them. Link to README.
- **`.claude/rules/quality-rules.md`** — BDK-dev convention. When to add a new rule category vs. when it's a project-specific concern. Format requirements (language-agnostic, bullet-list of principles, no tool references).

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Skill (cr or create-plan) — SKILL.md orchestration       │
│                                                          │
│  1. Read template (references/*.md) verbatim             │
│  2. Find <!-- INJECT: <name> --> placeholders            │
│  3. For each, run inject-rules.py via Bash tool          │
│  4. Substitute output into template                      │
│  5. Emit resolved prompt/plan                            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │ scripts/inject-rules.py          │
        │  - reads .bdk/settings.json      │
        │  - resolves rule source          │
        │  - applies extends/replace mode  │
        │  - writes resolved content stdout│
        └────────────┬─────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  ${CLAUDE_PLUGIN_ROOT}/    <project>/<user-path>
  rules/code-quality.md     (per settings.json)
  rules/architecture.md
  (BDK defaults)            (user override, optional)
```

### `rules/` vs `fragments/` — distinction

BDK already has `fragments/` for conditional content. `rules/` is a separate concept:

| | `fragments/` | `rules/` |
|--|--------------|----------|
| **Purpose** | Conditional injection based on feature flags | Default rule sets, overridable by user |
| **Trigger** | `features.<flag>` in settings | Always injected; settings only changes *source* |
| **User override** | No (only on/off via flag) | Yes (path or content via `quality` settings) |
| **Resolver** | `scripts/inject.py` | `scripts/inject-rules.py` |
| **Settings section** | `features` | `quality` |

Keeping them separate avoids overloading either concept. Mixing override-able defaults under `fragments/` would conflate "feature on/off" with "where does this content come from".

## Trade-offs Considered

| Alternative | Rejected because |
|-------------|------------------|
| Fixed `.bdk/rules/<name>.md` extends-only | User can't reuse existing project docs (e.g. `docs/standards/coding.md`) without copying. |
| Settings paths, replace-only | Loses "deltas only" workflow; extending defaults forces copying full default file. |
| Soft fallback when user file missing | Hides config errors; every plan/review silently misses rules. User explicitly chose loud failure. |
| Per-language rule files (`code-quality-python.md`) | Violates BDK language-agnostic principle. Language nuance belongs in consuming skill. |
| `mode: "prepend"` (user content first, default after) | No clear use case; complexity without value. |
| Disable-individual-rules markers | YAGNI. Revisit if users request. |
| Shell-substitution (`!`...`` ` ) inside `references/*.md` | Doesn't execute — substitution only runs at SKILL.md load. Forced placeholder + Bash-tool resolution at skill orchestration time. |
| Reuse `fragments/` for rule files | Different semantics (override vs. feature flag). Keeps mental model and settings schema clean. |

## Success Criteria

- `/bdk:create-plan` runs end-to-end; injected plan template includes code-quality content.
- `/bdk:cr` runs end-to-end; reviewer prompts contain code-quality and architecture content.
- Misconfigured settings (missing user file) cause exit 1 with clear stderr message.
- Adding a new rule category = drop file in `rules/`, document in `.claude/rules/quality-rules.md`. No code changes.
- Unit tests cover all resolver branches; pass on `pytest tests/unit/`.

## Out of Scope (Future Work)

- Rule suppression markers.
- Per-language rule overlays.
- Validation tool (`/bdk:lint-quality`) that checks user files for format issues.
- Web-based rule editor.
