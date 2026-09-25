# Process versus knowledge

A skill is prose that an agent interprets. Prose is good at judgment and bad at bookkeeping. Before you write or keep a section, classify it.

## The test

Apply it to each section of `SKILL.md` and to each reference, and count the lines of each kind.

- **Process** orders stages, decides what runs next, tracks or stores state, counts iterations or attempts, gates on an approval, writes files at fixed paths, retries or escalates, or formats envelopes for another program. Process belongs in code: a script, a CLI or the host's own workflow features. In prose, an agent follows it most of the time, which is not good enough for bookkeeping.
- **Knowledge** says how to do the domain work well: heuristics, checklists, quality criteria, templates of the produced artifact, domain vocabulary. Knowledge stays in the skill or in a project rule.
- **Wiring** connects the skill to its host: load-time command blocks, settings lookups, `allowed-tools`. Wiring belongs in frontmatter or in the host configuration, not in the body.

**Process share** is the number of process lines divided by the number of lines in `SKILL.md`. Above one half, the skill is a candidate for a redesign: the agent spends its attention on bookkeeping it will sometimes get wrong. The share guides the review; it is not an automatic verdict.

## The admission rule for knowledge skills

A knowledge skill is admitted only when both hold:

1. **It encodes a real process or a concrete choice.** It picks a named solution (a Page Object Model, a Test Data Builder, a fixed error format), or it lays down steps the agent would not take on its own. A restatement of what a capable model already knows does not qualify.
2. **It makes a measurable difference.** Run the same set of tasks with and without the skill, and compare the results against criteria fixed in advance. Keep the skill only when the difference is real. Rerun the comparison when the model changes, because the model may have learned what the skill teaches.

## Examples

| Section                                                          | Kind      | Where it goes                         |
| ---------------------------------------------------------------- | --------- | ------------------------------------- |
| "After the review, if more than 3 findings, loop back to step 2" | process   | code that counts and loops            |
| "Write the plan to a fixed file and update its status field"     | process   | code that owns the file               |
| "A good test name states the behaviour and the condition"        | knowledge | the skill                             |
| "Prefer a builder with valid defaults over hand-built fixtures"  | knowledge | the skill (a concrete choice)         |
| "Look up the test command in the settings file"                  | wiring    | a load-time lookup or the host config |
