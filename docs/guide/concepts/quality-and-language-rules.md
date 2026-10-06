# Quality and language rules

A rule is a standing instruction the agents that write, review and verify code receive with their task. BDK ships a pack of rules, and your project adds its own. Every rule has an id, every agent report cites the ids that shaped its work, and the kernel decides which rules each agent reads.

## What a rule is

A rule is a choice among valid alternatives that BDK or your project made and wants followed, stated as one instruction. It has one of two kinds:

- `house`: the choice itself, for example "write paths go through command handlers; queries never mutate".
- `knowledge`: a fact about a library, language or tool that a model gets wrong or does not know. It carries `source` (where the fact comes from) and `verified` (the date it was last checked), and stays only while it still corrects the model.

Not a rule:

- a fact about the project's own system ("users and permissions are joined by `user_id`"). It belongs in code, documentation or a living spec;
- a process lesson ("the negative test was forgotten"). It is a `learning` or `finding` entry, which the audit reads;
- a principle every competent engineer applies with no alternative being rejected;
- knowledge the models already have.

## Rule files and ids

Each rule is one Markdown file whose name is its id. The frontmatter holds the metadata, the body holds the instruction:

```markdown
---
schema: 1
id: API-2
kind: house
severity: high
origin: user
since: 2026-09-30
applies: ["src/api/**"]
---

Validate every request body against its schema before the handler reads it.
```

| Field                | Meaning                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `id`                 | `<PREFIX>-<n>`. `BDK-` ids belong to the shipped pack; your project picks its own prefixes. |
| `kind`               | `house` or `knowledge`.                                                                     |
| `severity`           | `critical`, `high`, `medium` or `low`.                                                      |
| `origin`             | `bdk`, `user`, or the entry or ticket the rule was adopted from.                            |
| `applies`            | Globs of the files the rule is about. Without it the rule is global.                        |
| `roles`              | The roles that read the rule, when the default for its prefix does not fit.                 |
| `source`, `verified` | Required for a `knowledge` rule.                                                            |
| `removed`            | Makes the file a tombstone: the rule is gone, its id is never reused.                       |

## The shipped pack

The pack lives in the installed plugin, one directory per category, and is never copied into your project:

| Directory                     | Prefix                          | Covers                                                               |
| ----------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| `rules/code-quality/`         | `BDK-CQ`                        | Function-level hygiene                                               |
| `rules/architecture/`         | `BDK-ARCH`                      | Layering, boundaries, dependency direction                           |
| `rules/design-patterns/`      | `BDK-DP`                        | Pattern choice and anti-patterns                                     |
| `rules/security/`             | `BDK-SEC`                       | Trust boundaries, injection, secrets, authorization, least privilege |
| `rules/test-quality/`         | `BDK-TQ`                        | What a test should assert and what it should not                     |
| `rules/engineering-judgment/` | `BDK-EJ`                        | Weighing quality against implementation effort                       |
| `rules/plan/`                 | `BDK-PL`                        | What a plan must hold to be checkable                                |
| `rules/languages/<name>/`     | `BDK-JS`, `BDK-TS`, `BDK-REACT` | JavaScript, TypeScript and React                                     |

A rule enters the pack only after a measurement shows that the models need it: a `house` rule that both measured models already follow, with no measurable effect on review, is left out. `rules/README.md` in the plugin states the admission rule.

A language pack is read only when its name is in `languages`:

```yaml
languages: [typescript, react]
```

## Your project's rules

Your own rules live in `.bdk/rules/`, one file per rule, committed with the code. `bdk rules accept "<text>" --prefix API` writes the next free id of a prefix, for example after an audit of learnings (see [Rules hygiene](../workflows/rules-hygiene.md)). It is the only command that creates a rule file.

`.bdk/rules/` and Claude Code's `.claude/rules/` are separate. BDK agents read the rules under `.bdk/rules/` through their packages. Claude Code loads your hand-written `.claude/rules/*.md` files into a session by their `paths:`. BDK never reads, writes or reports a file under `.claude/rules/`, so keep the conventions you want in every session there, and adopt into `.bdk/rules/` only the rules BDK agents must follow and cite.

To switch a rule off, shipped ones included, list its id:

```yaml
rules:
  disabled: [BDK-CQ-4, API-2]
```

## Which rules an agent reads

When the kernel builds a dispatch package, it selects the rules for the role and the task:

1. A shipped rule is read by the roles its prefix is meant for: the implementer, simplifier and reviewers read `CQ`, `ARCH`, `DP`, `SEC`, `TQ` and the language prefixes; the verifier reads `ARCH`, `TQ`, `EJ` and `PL`; the design verifier reads `ARCH`, `EJ` and `SEC`. A project rule is read by every role that reads rules. `roles` in a rule overrides both.
2. A rule with `applies` is selected only when one of the task's files matches one of its globs. A target without a file set, such as a design artifact, gets every rule.
3. Global rules come first, then scoped rules by how specific the matching glob is.

Every applying rule is selected: there is no cap, because a configured rule the agent never sees fails silently. When one role would read more than `rules.warn-above` rules (100 by default), the session start prints a `[BDK] rules warning` line; switch rules off or narrow them with `applies`.

The package records the selected ids. The agent reads exactly those rules with `bdk rules show --ticket <ticket>`, and cites the id of every rule that forced a decision or that a finding breaks. A reviewer without a package, such as the PR reviewer of `/bdk:pr-review`, reads the same selection for its file set with `bdk rules show --role pr-reviewer --file <path>...`, which needs no Change. To see what a role would read for a file, run:

```bash
bdk rules explain src/api/users.ts --role reviewer
```

## Checking the rules

`bdk rules check` validates every rule file, shipped and project, and refuses a duplicate id. `bdk doctor` reports an invalid rule file under `.bdk/rules/` with the same first problem.

### After an earlier `rules import`

Earlier v3 previews had a `rules import` command, which copied `.claude/rules/` into `.bdk/rules/`, and a `rules export --claude` command, which wrote `.claude/rules/bdk-generated.md` and `bdk-generated-scoped.md`. Both are gone. If your project used them:

- Each imported rule carries `origin: import`, which `bdk rules check` now refuses. Delete the rules you do not need BDK agents to follow, and set `origin: user` in the ones you keep.
- Delete `.claude/rules/bdk-generated.md` and `.claude/rules/bdk-generated-scoped.md`. Nothing updates them any more, and Claude Code would keep loading them.

## Related

- [Rules hygiene](../workflows/rules-hygiene.md) for the audit that turns lessons into rules.
- [Context](context.md#dispatch-packages) for how rules reach subagents.
