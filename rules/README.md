# The BDK rule pack

One file per rule: `rules/<category>/BDK-<PREFIX>-<n>.md` and `rules/languages/<name>/BDK-<PREFIX>-<n>.md`. The frontmatter is the rule file schema of `.bdk/rules/` with `origin: bdk`; the body is the rule text. The kernel reads the pack from the installed plugin, never from a copy. A project switches a rule off with `rules.disabled` and adds its own under `.bdk/rules/`.

## What a rule is

A rule is a choice among valid alternatives that BDK or the project made and wants followed, stated as one instruction. It has one of two kinds:

- `house`: the choice itself ("write paths go through command handlers; queries never mutate").
- `knowledge`: a fact about a library, language or tool that a model gets wrong or does not know. It carries `source` and `verified` (the date it was last checked) and stays only while it still corrects the model.

Not a rule: a fact about the project's own system (it belongs in code, documentation or a living spec), a process lesson (a `learning` or `finding` entry), a principle with no valid alternative, and knowledge the models already have.

## Admission

A rule enters the pack only after the measurement of `docs/V3-EVAL-RULES-NOOP.md`, run with `pnpm eval` (suite `rules-noop`):

- M1: the rule's question answered blind by Haiku and Sonnet, judged COVERED, MISSED or WRONG.
- M2: a review of seeded violations with and without the rule, against an A/A noise floor.

A `house` rule is admitted unless it is COVERED for both models and M2 shows no measurable difference with a `without` detection of at least 0.8. A `knowledge` rule is admitted only when M1 is WRONG, MISSED or MIXED for at least one model. Every new `rules/languages/<name>/` directory and every rule added to one needs its rows in a measurement report. The `SEC` rules are kept without the house test (`docs/V3-RULES-MIGRATION.md`).

A removed rule stays as a tombstone with `removed` and its body, so its id is never reused.
