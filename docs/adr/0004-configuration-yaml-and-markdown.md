---
status: accepted
date: 2026-09-25
decision-makers: {TBD}
consulted: {TBD}
informed: {TBD}
---

# ADR-0004: Configuration is YAML for structure plus Markdown files for text, with a JSON Schema generated from zod

## Context and Problem Statement

BDK v2 keeps its settings in `.bdk/settings.json`. JSON has no comments, and every text value is one escaped line, which is why `quality.*` already points at `.md` files instead of holding text. v3 configuration carries both structure (feature flags, tool commands with tiers, gates, budgets) and a growing amount of prose for agents (project goal, per-role instructions, project rules), resolved over four layers: BDK defaults < `~/.config/bdk/settings.yaml` < `.bdk/settings.yaml` < `.bdk/settings.local.yaml` (A-warstwy, D4). The question is the file format for both kinds of value. The user asked to see one project's configuration written in each candidate format before deciding. Register entry: R-format (`docs/v3/2026-09-23-0703-bdk-v3-decisions.md`, step 2A.3).

## Decision Drivers

- **Markdown text stays Markdown.** Editor highlighting, nested lists and code blocks that survive, and a diff per text.
- **Text and flags layer the same way.** Layering and the list of locally overridden keys (D4b) must work identically for a flag and for a text value.
- **The IDE suggests and validates keys** (the user's condition for this decision).
- **Unknown keys fail loudly** (S6): a typo is an error that names the key and the layer.
- **Size at real scale.** A project with a goal, five role texts and several rule files must not turn into a 200-400 line configuration file.

## Considered Options

1. **Variant 1: YAML for structure plus `prompts/` directories of Markdown files** - `settings.yaml` at each layer holds structured keys; `prompts/<key>.md` and `prompts.local/<key>.md` hold text values, where the file name is the key and frontmatter carries `mode: extends | replace` and `applies`; project rules are Markdown files with IDs in `.bdk/rules/`.
2. **Variant 2: YAML only, text in `|` blocks** - one `settings.yaml` per layer holds structure and text; each text value is three sibling keys (`mode`, `applies`, `text`).
3. **Variant 3: Markdown with frontmatter only** - one `settings.md` per layer: structure in the frontmatter, text values as `##` sections whose heading is the key, with attributes in braces after the heading.

## Decision Outcome

**Chosen option: 1, YAML for structure plus Markdown files for text**, because it is the only variant where text keeps full Markdown (highlighting, nesting, a diff per file) and where layering and D4b treat a text value exactly like a flag, since a file name is a key. The cost, values in two places, is paid by `bdk config show`, which names the layer each value comes from. The user's condition is part of the decision: the YAML has a JSON Schema generated from the zod registry, so the IDE suggests and validates keys.

### Consequences

- ✅ Structured keys have comments and a schema; text values are ordinary Markdown files with highlighting and a diff of their own.
- ✅ A person overrides a text value by adding `prompts.local/<key>.md`; the same key mechanism and the same D4b list apply to flags and texts.
- ✅ Project rules reuse the mechanism: a Markdown file with frontmatter `id` and `mode`, and rule IDs in the text (R-rule-id).
- ✅ The IDE suggests keys and flags errors while typing; `bdk config check` enforces the same schema on CI and at run time.
- ❌ Values live in two places per layer (`settings.yaml` and `prompts/`); `bdk config show <key>` prints the origin of each value and of each text part.
- ❌ The JSON Schema is a generated file in the repository; CI regenerates it and fails on any difference.
- 🟡 Text values are not covered by the YAML schema; their frontmatter is validated by the kernel instead.

### Implementation Requirements

- [ ] Four layers, deep merge, arrays merged by `id`, full override allowed; unknown key is an error naming the key and the layer (T12).
- [ ] `prompts/<key>.md` and `prompts.local/<key>.md` with `mode: extends | replace` and `applies` frontmatter (T12).
- [ ] JSON Schema exported from the zod registry to `schema/` on CI, checked with `git diff --exit-code` (T12).
- [ ] Setup writes a `# yaml-language-server: $schema=<versioned raw URL>` modeline into `settings.yaml`; an offline copy of the schema lives in `.bdk/.machine/schema/` (T12).
- [ ] An IDE with yaml-language-server suggests keys in a fixture's `settings.yaml` (manual confirmation once, T12).

## Pros and Cons of the Options

### Variant 1: YAML for structure plus `prompts/` directories of Markdown files

- ✅ Full Markdown for text, a diff per text file, frontmatter says where a text applies.
- ✅ The file name is the key, so layering and D4b are uniform for flags and texts.
- ✅ Rules with IDs are the same mechanism.
- ❌ Two places to look; needs `bdk config show` with origins.

### Variant 2: YAML only, text in `|` blocks

- ✅ One file, one syntax; the whole configuration in one `cat`.
- ✅ One schema validates everything, texts included.
- ❌ A realistic project reaches 200-400 lines, the size of the plan files v3 set out to remove.
- ❌ Markdown inside a `|` block has no editor highlighting, and the block indentation eats the indentation of nested lists and code blocks.
- ❌ A text change and a flag change mix in one diff; every text is three keys (`mode`, `applies`, `text`) instead of one file.

### Variant 3: Markdown with frontmatter only

- ✅ Looks like `SKILL.md` and agent files, so it is familiar; full highlighting; one file.
- ❌ `##` is taken by keys, so a text cannot use `##` itself.
- ❌ Attributes in braces after a heading are a private mini-syntax that needs its own parser and documentation.
- ❌ The frontmatter grows to 60-100 lines of YAML in a real project and stops being "front".
- ❌ Merging layers by heading is fragile: renaming a section in the project silently detaches a person's override.
- ❌ Rules lose their per-file frontmatter; flag and text changes mix in one diff.

## More Information

- Design `docs/v3/2026-09-23-0703-bdk-v3-change-centric-design.md`, section "Configuration (A-warstwy, R-format, D4, B7-B10)" and the "Change directory" layout; the three variants written out for one example project on design page 04 (`docs/v3/bdk-v3-design-04-doprecyzowanie.html`, section 1), with today's JSON shown for contrast.
- Related decisions: A-warstwy (four layers, `~/.config/bdk/` as the XDG layer), D4 and D4b (full local override, overridden keys recorded in the Change), R-rule-id (rule IDs `[PREFIX-n]`).
- Implemented by T12 (`bdk config`, zod registry, JSON Schema, `prompts/`); `bdk ctx` in T13 composes the Markdown values into prompts.
