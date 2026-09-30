---
description: Conventions for the shipped rule pack under rules/ - rule files, ids, the definition and admission
paths:
  - "rules/**"
  - "kernel/src/rules/**"
  - "evals/suites/rules-noop/**"
---

# Rule Pack - Authoring Convention

How to add, change or remove a rule of the pack BDK ships. The `rule-pack` spec is normative; this file is the working summary.

## What a rule is

A rule is a choice among valid alternatives that BDK or the project made and wants followed, stated as one instruction. It has one of two kinds:

- `house`: the choice itself ("write paths go through command handlers; queries never mutate").
- `knowledge`: a fact about a library, language or tool that a model gets wrong or does not know. It carries `source` and `verified` (the date it was last checked).

Never a rule: a fact about the project's own system (it belongs in code, documentation or a living spec), a process lesson (a `learning` or `finding` entry for the audit), a principle every competent engineer applies with no alternative being rejected, and knowledge both measured models already have.

## Files and ids

- One file per rule: `rules/<category>/BDK-<PREFIX>-<n>.md`, or `rules/languages/<name>/BDK-<PREFIX>-<n>.md` for a language pack. The directory fixes the prefix (`PACK_DIRS` in `kernel/src/rules/domain/rule.ts`).
- The frontmatter is the rule file schema of `.bdk/rules/` with `origin: bdk`; the body is the rule text, one instruction, with no tool names outside a language pack.
- An id is never reused. A removed rule stays as a tombstone with `removed: <reason>` and its body.
- A rule names another rule by id, never by file or position.
- `rules/README.md` is the only other file under `rules/`.

## Admission

- A rule enters only after the `rules-noop` measurement (`evals/README.md`): a `house` rule is admitted unless it is COVERED for both models and M2 shows no measurable difference with a `without` detection of at least 0.8; a `knowledge` rule only when M1 is WRONG, MISSED or MIXED for at least one model.
- Every rule of a new `rules/languages/<name>/` directory needs its rows in a measurement report listed in `MEASURED_REPORTS` of `kernel/tests/contract/rule-pack.test.ts`.
- The `SEC` rules are kept without the house test (`docs/V3-RULES-MIGRATION.md`).

## Which role reads a rule

The role prefix sets are held in `kernel/src/rules/use-cases/selection.ts`; a rule's `roles` overrides them, and `applies` narrows it to the files its globs match. Adding a pack directory means adding it to `PACK_DIRS`, to the role sets that read it, and to the prefix list of the `rule-pack` and `kernel-cli/rules` specs.

Enforced by `kernel/tests/contract/rule-pack.test.ts` and `bdk rules check`.
