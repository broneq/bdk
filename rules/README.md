# The BDK rule pack

One file per rule: `rules/<category>/BDK-<PREFIX>-<n>.md` and `rules/languages/<name>/BDK-<PREFIX>-<n>.md`. The frontmatter is the rule file schema of `.bdk/rules/` with `origin: bdk`; the body is the rule text. The kernel reads the pack from the installed plugin, never from a copy. A project switches a rule off with `rules.disabled` and adds its own under `.bdk/rules/`.

## Where a rule applies

Every rule states two required fields, and the kernel selects by them only:

- `paths`: the globs of the files the rule governs. `["**"]` is every file. A reader without a file set of its own (a design, a plan, a session skill) matches them against the files of the work tree.
- `stages`: the pipeline stages that read the rule, with no wildcard. The writer and the checker of a stage read the same rules:

| stage     | session skills            | pipeline nodes        | agent roles                                       |
| --------- | ------------------------- | --------------------- | ------------------------------------------------- |
| `design`  | `/bdk:design`, `/bdk:adr` | nodes `stage: design` | `design-verifier`                                 |
| `plan`    | `/bdk:plan`               | nodes `stage: plan`   | `verifier`                                        |
| `execute` | -                         | -                     | `implementer`, `conformer`                        |
| `review`  | -                         | -                     | `reviewer`, `integration-reviewer`, `pr-reviewer` |

The `runner`, `scout`, `lead` and `judge` roles read no stage rules; the judge reads only the rules an entry cites, by id.

In the pack, the directory fixes a rule's stages, and a language directory fixes its `paths` to the extensions of the language:

| directory                      | `stages`                              | `paths`                                       |
| ------------------------------ | ------------------------------------- | --------------------------------------------- |
| `architecture`                 | `design`, `plan`, `execute`, `review` | `**`                                          |
| `security`                     | `design`, `execute`, `review`         | `**`                                          |
| `engineering-judgment`         | `design`, `plan`                      | `**`                                          |
| `plan`                         | `plan`                                | `**`                                          |
| `test-quality`, `code-quality` | `plan`, `execute`, `review`           | `**` (`BDK-CQ-9`: the lockfiles)              |
| `design-patterns`              | `execute`, `review`                   | `**`                                          |
| `languages/javascript`         | `plan`, `execute`, `review`           | `**/*.js`, `**/*.mjs`, `**/*.cjs`, `**/*.jsx` |
| `languages/typescript`         | `plan`, `execute`, `review`           | `**/*.ts`, `**/*.mts`, `**/*.cts`, `**/*.tsx` |
| `languages/react`              | `plan`, `execute`, `review`           | `**/*.jsx`, `**/*.tsx`                        |

A language pack is read only when `languages` lists it; its `paths` then narrow it to the files of that language.

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
