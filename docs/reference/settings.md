# Settings reference

`.bdk/settings.json` is BDK's project configuration file. It is validated against `hooks/check-bdk-config/settings.schema.json` on every session start (see [Hooks reference](hooks.md) and [Troubleshooting](../troubleshooting.md)). Created by `/bdk:setup` - see [Setup](../getting-started/setup.md).

This page lists every top-level key from the schema, its type, its description exactly as written in the schema, and one example. The `quality` and `language-rules` override object is documented at the end.

## `$schema`

| Property | Value |
|---|---|
| Type | `string` |
| Default | none |

No description in the schema beyond the type. `/bdk:setup` writes it pointing at the shipped schema so editors can validate the file:

```json
{
  "$schema": "https://raw.githubusercontent.com/broneq/bdk/main/hooks/check-bdk-config/settings.schema.json"
}
```

## `languages`

| Property | Value |
|---|---|
| Type | array of non-empty strings, `minItems: 1` |
| Default | none |

Schema description:

```
Languages and frameworks detected in this project. Free-form: an entry only
needs a matching rules/languages/<name>.md (shipped or user-supplied) to
inject anything. See .claude/rules/language-rules.md.
```

Example:

```json
{
  "languages": ["typescript", "react"]
}
```

## `test-tools`

| Property | Value |
|---|---|
| Type | array of `tool` objects (see [Tool object](#tool-object)) |
| Default | none |

Schema description:

```
Commands to run the test suite, one entry per tier. Give every entry a
`tier` (fast | e2e) and a `scoped` template so callers can run only what
changed; `command` is the full-suite form and runs once, at the end of a
plan.
```

Example:

```json
{
  "test-tools": [
    {
      "type": "vitest",
      "tier": "fast",
      "command": "npm run test:unit",
      "scoped": "npx vitest run {files}",
      "related": "npx vitest related --run {files}",
      "failed": "npx vitest run --changed"
    },
    {
      "type": "playwright",
      "tier": "e2e",
      "command": "npm run test:e2e",
      "scoped": "npx playwright test {files}",
      "failed": "npx playwright test --last-failed"
    }
  ]
}
```

## `lint-tools`

| Property | Value |
|---|---|
| Type | array of `tool` objects (see [Tool object](#tool-object)) |
| Default | none |

Schema description:

```
Commands to run linters/formatters/typecheckers, one entry per tier (lint |
format | typecheck). Give lint/format entries a `scoped` template and
typecheckers an `incremental` form so per-group checks do not re-analyse the
whole project.
```

Example:

```json
{
  "lint-tools": [
    {"type": "eslint", "tier": "lint", "command": "npm run lint", "scoped": "npx eslint {files}"},
    {"type": "tsc", "tier": "typecheck", "command": "npm run typecheck", "incremental": "npx tsc -b --incremental"}
  ]
}
```

## `build-tools`

| Property | Value |
|---|---|
| Type | array of `tool` objects (see [Tool object](#tool-object)) |
| Default | none |

Schema description:

```
Commands to build the project
```

Example:

```json
{
  "build-tools": [{"type": "tsc", "command": "npm run build"}]
}
```

`build-tools` entries need no `tier` (per `skills/setup/SKILL.md`).

## `features`

| Property | Value |
|---|---|
| Type | object, `additionalProperties: false` |
| Default | none declared in the schema |

Four boolean keys, each with its own schema description:

| Key | Type | Description (schema text) |
|---|---|---|
| `caveman` | `boolean` | `Caveman communication mode` |
| `serena` | `boolean` | `Serena MCP semantic code tools` |
| `code-review-graph` | `boolean` | `code-review-graph MCP knowledge graph` |
| `lavish` | `boolean` | `Route bundled multi-question decision points through the lavish-axi binary instead of terminal AskUserQuestion. Also requires the binary on PATH; skills check both and fall back silently when either is absent.` |

Every value must be a boolean (`check.py`'s `validate_settings` rejects a non-boolean `features.<key>`).

No BDK behaviour currently reads `caveman` - no fragment, chain, hook or script consults it, even though `/bdk:setup` collects an answer for it. Tracked at https://github.com/broneq/bdk/issues/39.

The schema does not declare a default for these keys, and the two scripts that read them at runtime do not treat "missing" the same way:

- `hooks/register-graph-repo/register.py` treats `code-review-graph` as **on unless explicitly `false`** (`features.get("code-review-graph", True) is not False`).
- `scripts/inject.py` treats any `features.<key>` condition as **off unless explicitly `true`** (`bool(features.get(key, False))`) when resolving `--if features.<key>` conditions in skills.

So a project with no `features` block at all gets code-review-graph registration behavior as if it were on, but any skill fragment gated on `features.<key>` stays off. Write the flags explicitly rather than relying on the gap between these two behaviors.

Example:

```json
{
  "features": {
    "caveman": true,
    "serena": false,
    "code-review-graph": false
  }
}
```

## `quality`

| Property | Value |
|---|---|
| Type | object, `additionalProperties` are `ruleOverride` (see [Override object](#override-object)) |
| Default | none |

Schema description:

```
Per-category overrides for BDK's language-agnostic rules in rules/<name>.md.
Read by scripts/inject-rules.py. Keys are rule names (code-quality,
architecture, design-patterns, security, engineering-judgment,
test-quality).
```

Example:

```json
{
  "quality": {
    "code-quality": "path/to/code-quality-overrides.md",
    "security": {"path": "path/to/security-overrides.md", "mode": "replace"}
  }
}
```

## `language-rules`

| Property | Value |
|---|---|
| Type | object, `additionalProperties` are `ruleOverride` (see [Override object](#override-object)) |
| Default | none |

Schema description:

```
Per-language overrides for rules/languages/<lang>.md. Read by
scripts/inject-language-rules.py. Keys are entries from `languages`.
```

Example:

```json
{
  "language-rules": {
    "typescript": "path/to/typescript-overrides.md"
  }
}
```

## Override object

Both `quality` and `language-rules` values (per key) share the schema's `ruleOverride` definition. Schema description:

```
Either a bare path to the override file, or an object choosing how it
combines with the BDK default.
```

Two accepted forms:

1. **A bare string** - path to the override file, relative to project root (`minLength: 1`).
2. **An object** with:

| Field | Type | Required | Default | Description (schema text) |
|---|---|---|---|---|
| `path` | `string`, `minLength: 1` | yes | none | `Path to the override file, relative to project root` |
| `mode` | `string`, enum `extends` \| `replace` | no | `extends` | `extends appends the override to the BDK default; replace discards the default` |

Example of both forms together:

```json
{
  "quality": {
    "code-quality": "rules/my-code-quality.md",
    "architecture": {"path": "rules/my-architecture.md", "mode": "extends"},
    "security": {"path": "rules/my-security.md", "mode": "replace"}
  }
}
```

## Tool object

Used by every entry in `test-tools`, `lint-tools`, and `build-tools`. Schema `required: ["type", "command"]`, `additionalProperties: false`.

| Field | Type | Required | Description (schema text) |
|---|---|---|---|
| `type` | `string`, `minLength: 1` | yes | `The runner or framework this entry invokes (vitest, playwright, pytest, eslint, tsc, go-test, ...). Free-form: it names the tool, and BDK reads it to infer a missing tier, so a framework name is more useful here than a package manager name.` |
| `tier` | `string`, enum `fast \| e2e \| lint \| format \| typecheck` | no | `Which class of check this is. test-tools use fast \| e2e; lint-tools use lint \| format \| typecheck. Omitted -> BDK infers it from type/command, which is a guess: declare it. The tier decides when the command may run - a fast tier runs per group, an e2e tier only at the end of a plan (or scoped to specs the group itself touched).` |
| `command` | `string`, `minLength: 1` | yes | `Full, unscoped shell command - the whole suite or the whole project. The slowest form: reserved for the one end-of-plan gate.` |
| `scoped` | `string`, `minLength: 1`, must contain `{files}` | no | `Command scoped to an explicit path list. Must contain the {files} placeholder, which the caller replaces with space-separated paths (e.g. npx vitest run {files}, npx eslint {files}).` |
| `related` | `string`, `minLength: 1`, must contain `{files}` | no | `Command that runs the tests covering the given source files, for runners that can compute that themselves (e.g. npx vitest related --run {files}). Must contain {files}. Replaces asking an agent which tests cover a change.` |
| `failed` | `string`, `minLength: 1` | no | `Command that re-runs only the previously failing tests (e.g. npx vitest run --changed, npx playwright test --last-failed). Used by fix cycles so a fix attempt does not pay for a full suite.` |
| `incremental` | `string`, `minLength: 1` | no | `Cache-reusing form of a whole-project check that cannot be scoped to a file list - typecheckers above all (e.g. tsc -b --incremental). Preferred over command for repeated per-group runs in one worktree.` |

`hooks/check-bdk-config/check.py` enforces two rules beyond the schema's own types at validation time:

- `command` must be a non-empty string on every tool entry.
- `scoped` and `related`, when present, must contain the literal `{files}` placeholder - the config is rejected otherwise ("without it the command ignores the file list and runs everything").

See [Verification scoping](../concepts/verification-scoping.md) and [Tool tiers](../concepts/tool-tiers.md) for how `tier` and the scoped/related/failed/incremental forms are used during a plan.
