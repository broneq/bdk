# The BDK rule pack

One Markdown file per rule; the file name is the rule's id. `bdk rules for --stage <stage> [--files <file>]...` selects the rules a role of that stage reads for those files, and the skill puts their text into the role's prompt. Spec: `openspec/specs/rule-pack/spec.md`, command: `openspec/specs/bdk-cli/rules/spec.md`.

## Rule file

```markdown
---
kind: house # house: a choice among valid alternatives; knowledge: a fact about a library, language or tool
paths: ["**"] # globs relative to the project root; ** is every file
stages: [execute, review] # among design, plan, execute, review
source: "https://..." # knowledge only, required
verified: 2026-09-30 # knowledge only, required: the date the fact was last checked
measured: # the measurement that admits a pack rule
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: code-quality.01.e4ed906e
  class: effective
---

**Naming.** Descriptive identifiers; no abbreviations unless idiomatic for the language.
```

## Language packs

A rule under `languages/<name>/` belongs to the language pack `<name>` and is read only when the configuration's `languages` lists it. The pack ships `javascript`, `typescript` and `react`.

## Project rules

A project adds rules in the same format under `.bdk/rules/` (any subdirectory; `.bdk/rules/languages/<name>/` for a language pack). A project id may not start with `BDK-`. `rules.disabled` in `.bdk/settings.yaml` switches off a rule of either origin by id; to change a BDK rule, disable it and add your own.

## Admission

A rule is in this pack only while a measurement shows that it changes the outcome: class `effective` (a review with the rule in its prompt finds the seeded violation measurably more often than without it) or `corrects the model` (a model answers the rule's question against it). `measured` names the report row, and `plugins/bdk/tests/rule-pack.test.ts` checks it. The 16 rules here are the draft 1 rules with a measured effect (`openspec/changes/archive/2026-10-07-v3-184-rule-pack-rules-for/design.md`, D1); their ids keep the draft numbering, so the gaps are dropped rules. A dropped rule comes back through a new measurement.
