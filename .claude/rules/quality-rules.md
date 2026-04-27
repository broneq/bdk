# Quality Rules — Authoring Convention

How and when to add a new rule category to BDK.

## What goes in `rules/`

Files in `rules/` are **language-agnostic principles** injected into skill prompts via `scripts/inject-rules.py`. Each file is a Markdown bullet list.

## Add a new rule category when

- The principle applies to ANY language/framework (no `pytest`, `npm`, `go test` references).
- It is referenced from at least one skill (`cr`, `create-plan`, future skills).
- It is overridable per-project — users may want to extend or replace.

## Do NOT add a rule file for

- Language-specific tooling rules (those belong in skill consumer logic).
- Project-conventions a single user has (those belong in their `.bdk/settings.json` `quality` override).
- Rules referenced by zero skills (YAGNI).

## File format

- Bullet list of principles
- Each bullet: **Bold title.** Short explanation.
- No code blocks specific to one language
- No tool names (`pytest`, `eslint`, etc.)

## Adding a new category — steps

1. Write `rules/<name>.md` following the format above.
2. Add `<!-- INJECT: <name> -->` marker in the consuming skill's template.
3. Add resolution step to the skill's SKILL.md (see `skills/cr/SKILL.md` Step 2.5 as reference).
4. Document in `README.md` "Quality Rules" section if user-overridable.

## Settings schema reminder

User overrides live in `.bdk/settings.json`:

```json
{
  "quality": {
    "<name>": "path/to/file.md",
    "<name>": {"path": "path/to/file.md", "mode": "extends" | "replace"}
  }
}
```

`extends` (default) appends user content to BDK default. `replace` discards default.
