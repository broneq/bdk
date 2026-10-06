# Spec Delta

## MODIFIED Requirements

### Requirement: What a rule is

A rule SHALL be a choice among valid alternatives that the project or BDK made and wants followed, stated as one instruction, and SHALL carry one of two kinds:

- `house`: the choice itself ("write paths go through command handlers; queries never mutate", "default to zero new comments").
- `knowledge`: a fact about a library, language or tool that a model gets wrong or does not know, kept only while it corrects the model; it carries `source` (where the fact comes from) and `verified` (the date it was last checked) (T5).

Not a rule, and never admitted as one: a fact about the project's own system ("users and permissions are joined by `user_id`"), which belongs in code, documentation or a living spec; a process lesson ("the negative test was forgotten"), which is a `learning` or `finding` entry for the audit; a principle every competent engineer applies with no alternative being rejected; and knowledge both measured models already have. The definition is stated in the rule authoring convention (`rules/README.md`, "What a rule is") and in the user guide, and is the admission question the audit skill (T42) asks before it proposes a rule.

#### Scenario: definition in the convention and the guide

- **WHEN** the content test reads `rules/README.md` and the user guide page about rules
- **THEN** both state that a rule is a choice among valid alternatives, name the two kinds, and name the system fact and the process lesson as non-rules

#### Scenario: no hand-written authoring convention in the repository rules

- **WHEN** `.claude/rules/` is listed
- **THEN** it holds no `quality-rules.md`; the convention lives in `rules/README.md`
