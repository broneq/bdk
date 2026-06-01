---
description: Conventions for language-specific rule files injected per `.bdk/settings.json` `languages`
paths:
  - "rules/languages/**"
  - "skills/bdk-rules-languages/**"
  - "scripts/inject-language-rules.py"
---

# Language Rules — Authoring Convention

How and when to add a new language rule file to BDK. Companion to `quality-rules.md`.

## What goes in `rules/languages/`

Files in `rules/languages/<lang>.md` are **language- or framework-specific principles** injected per `.bdk/settings.json` `languages` array. Each file is a Markdown bullet list following the same format as quality rules.

Where quality rules describe principles that apply to every codebase, language rules describe principles that only make sense inside a specific stack (React, Vue, Python, Go, …).

## Add a new language file when

- The principle applies to **one** language or framework — not portable across stacks.
- The language is something a project would list in `.bdk/settings.json` `languages`.
- It is referenced from at least one skill or preloaded into an agent (today: `bdk-rules-languages`).

## Do NOT add a language file for

- Principles that are actually language-agnostic — those belong in `rules/code-quality.md` or `rules/architecture.md`.
- Project-private conventions for a single team — those belong in the consumer project's `.bdk/settings.json` `language-rules.<lang>` override.
- Languages no one has declared yet (YAGNI).

## File format

- Bullet list of principles.
- Each bullet: **Bold title.** Short explanation (one or two sentences).
- Optional `##` subheaders may group related bullets within one file when a language has a distinct concern worth separating (e.g. a `## Security` section in `react.md`). Keep groups few and obvious — the file is still primarily a flat list, not a nested document.
- Reference the underlying principle, not specific APIs where possible (APIs change faster than principles).
- Tooling references are allowed when the tooling is core to the language (e.g. naming a hook like `useEffect` in React rules is fine; naming `pytest` in Python rules is not — that belongs in a test-runner config).

## Adding a new language — steps

1. Write `rules/languages/<lang>.md` following the format above.
2. Verify the language is recognised by `.bdk/settings.json` `languages` array (free-form list — no enum to update).
3. Test: in a consumer project, set `languages: ["<lang>"]` and run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-language-rules.py <lang>` — confirm content prints.
4. No skill code changes required — `bdk-rules-languages` meta-skill, `<!-- INJECT-LANGUAGES -->` markers, and the script all iterate dynamically.

## Settings schema reminder

User overrides live in `.bdk/settings.json`:

```json
{
  "languages": ["react", "typescript"],
  "language-rules": {
    "react": "docs/team-react.md",
    "typescript": {"path": "docs/ts.md", "mode": "replace"}
  }
}
```

`extends` (default) appends user content to the BDK default. `replace` discards the default. Override path resolves relative to project root if not absolute.

## Why a separate system from `quality.<name>`

The quality-rule system is **explicitly language-agnostic** (see `.claude/rules/quality-rules.md` and `portability-check.md`). Putting React, Vue, Python, etc. into the `quality.<name>` namespace would violate that contract and pollute it with stack-specific entries. Language rules live in their own dimension — keyed by the `languages` array, not by a flat name list — and consumers (skills, agents) pull them in via `bdk-rules-languages` or the `<!-- INJECT-LANGUAGES -->` marker.
