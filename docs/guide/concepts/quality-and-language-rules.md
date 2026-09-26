# Quality and language rules

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

BDK injects two kinds of standing instruction into the skills and agents that write or review code: **quality rules**, which are language-agnostic principles, and **language rules**, which are per-stack sheets. Both are overridable per project, and both are resolved at injection time rather than baked into any skill.

## Why they are separate from skills

A rule written inside `/bdk:cr` helps exactly one skill and is invisible to `/bdk:create-plan`, to the implementer subagent, and to you. Keeping rules in standalone files means one statement of a principle, one place to override it, and a reviewer and an implementer that are working from the same text.

It also enforces portability. A rule file is a bullet list of principles with no tool names and no language-specific code blocks, so `/bdk:cr` stays correct in a Go repo and a React repo alike. Anything that would name `pytest` or `eslint` belongs in `.bdk/settings.json`, not in a rule.

## The shipped rule sets

| Rule set               | Covers                                                               |
| ---------------------- | -------------------------------------------------------------------- |
| `code-quality`         | Function-level hygiene                                               |
| `architecture`         | Layering, boundaries, dependency direction                           |
| `design-patterns`      | Pattern choice and anti-patterns                                     |
| `security`             | Trust boundaries, injection, secrets, authorization, least privilege |
| `engineering-judgment` | Weighing quality and maintainability against implementation effort   |
| `test-quality`         | What a test should assert and what it should not                     |

They are consumed by `/bdk:cr`, `/bdk:create-plan`, and `/bdk:design`, and preloaded into the agents that need them (see [Agents](agents.md)).

## Four ways to use them

**1. Zero config.** No settings entry at all. BDK's defaults apply as shipped. This is the right choice for most projects.

**2. Extend a default.** Point at a file of project-specific additions:

```json
{
  "quality": {
    "code-quality": "docs/standards/coding.md"
  }
}
```

The BDK default is emitted first, then your file's content is appended.

**3. Replace a default.** When your project already has a complete rule set of its own:

```json
{
  "quality": {
    "code-quality": {
      "path": "docs/standards/coding.md",
      "mode": "replace"
    }
  }
}
```

**4. Point at a document you already have.** Mechanically identical to pattern 2, but worth calling out: the path can be any existing standards doc in the repo. There is nothing to copy and nothing to keep in sync.

A bare string means `extends`. The object form exists only so you can say `replace`. Keys are the rule-set names in the table above; the v3 settings are described in the [README](https://github.com/broneq/bdk/blob/main/README.md#settings).

!!! note
Prefer `extends`. `replace` discards principles you may not have noticed you were relying on, and a later BDK release that adds a principle to that set will not reach your project.

## Language rules

Language rules are the same idea keyed by stack rather than by rule name. BDK ships per-language principle sheets at `rules/languages/<lang>.md`, currently React, TypeScript, and JavaScript, and further languages follow the same pattern with no code change.

Declare the project's stack:

```json
{
  "languages": ["react", "typescript"]
}
```

Override or extend a sheet with the same `extends` and `replace` semantics, under a separate key so a language override cannot be confused with a quality override:

```json
{
  "languages": ["react"],
  "language-rules": {
    "react": "docs/team-react-conventions.md"
  }
}
```

The `languages` array is free-form. An entry only needs a matching sheet, shipped or supplied by you, to inject anything, and a language listed with no matching sheet and no override is silently skipped rather than erroring. That is deliberate: declaring `languages: ["python", "typescript"]` in a mixed repo should describe the repo honestly, not fail because one sheet does not exist yet.

Language rules reach code-writing and code-reviewing agents through the `bdk-rules-languages` meta-skill, and reach skills such as `/bdk:create-plan` as `Language rules: <language>` sections of their `bdk ctx skill` context.

## When an override is misconfigured

Rule resolution runs inside a dynamic block in a skill body, which captures standard output only and ignores exit status. A resolver that failed quietly would render as silence, and a missing rule file would look exactly like a rule set that is legitimately empty.

So `bdk ctx skill` prints a problem into the skill's context itself, as a `BDK STOP:` line with what to do instead, and the skill stops there. An unknown settings key or an invalid value shows up as a visible stop, not as a review that silently ran with no standards.

## Related

- [The shared foundation](shared-foundation.md) for how rules reach subagents.
- The [README](https://github.com/broneq/bdk/blob/main/README.md#settings) for the v3 settings.
