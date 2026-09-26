# Quality Rules — Authoring Convention

How and when to add a new rule category to BDK.

## What goes in `rules/`

Files in `rules/` are **language-agnostic principles** injected into skill prompts by `bdk ctx skill` (`.claude/rules/skill-context.md`). Each file is a Markdown bullet list.

## Add a new rule category when

- The principle applies to ANY language/framework (no `pytest`, `npm`, `go test` references).
- It is referenced from at least one skill (`cr`, `create-plan`, future skills).
- It is overridable per-project — users may want to extend or replace.

## Do NOT add a rule file for

- Language-specific tooling rules (those belong in skill consumer logic).
- Project-conventions a single user has (those belong in their `rules/<name>` prompt value).
- Rules referenced by zero skills (YAGNI).

## File format

- Bullet list of principles
- Each bullet: **Bold title.** Short explanation.
- No code blocks specific to one language
- No tool names (`pytest`, `eslint`, etc.)

## Adding a new category — steps

1. Write `rules/<name>.md` following the format above, and declare the prompt key `rules/<name>` in `kernel/src/ctx/config.ts`.
2. Add a `rules` part for it to the consuming skill's entry in `kernel/src/ctx/use-cases/manifest.ts`, and point the skill body to its `Rules: <name>` section.
3. When the skill renders a template with rule markers (`create-plan`), add a `<!-- INJECT: <name> -->` marker to the template.
4. Document in `README.md` "Quality Rules" section if user-overridable.

## Settings schema reminder

Each rule file is the default of the prompt key `rules/<name>`, which the kernel must declare (`kernel/src/ctx/config.ts`); an undeclared key is refused. User overrides are prompt values: a file `.bdk/prompts/rules/<name>.md`, or a mapping in `.bdk/settings.yaml`:

```yaml
prompts:
  files:
    rules/<name>: path/to/file.md
    rules/<other>: {path: path/to/file.md, mode: replace}
```

`extends` (default) appends user content to BDK default. `replace` discards default.
