# Structure

## Directory layout

```text
<skill-name>/
  SKILL.md       the instructions; the only required file
  references/    documents the agent reads when the body sends it there
  scripts/       code the agent runs
  assets/        templates and files the output uses
  examples/      sample output that shows the expected format
```

`SKILL.md` is the only file at the top level. A project can narrow the allowed entries with the `layout` rule's `allowed` option.

## Progressive disclosure

Every line of `SKILL.md` costs context on every run. Every line in `references/` costs context only on the runs that need it. Sort content by how often a run needs it:

- **Every run** stays in `SKILL.md`: the steps, the decisions, the invariants.
- **Some runs** moves to a reference: a template, a long checklist, the detail of one branch of a decision.
- **No run** is deleted: history, rationale that changes no decision, duplicates of what the host already says.

For each reference, say in `SKILL.md` when to read it: "For a breaking change, read the migration checklist" loads the file at the right moment, while a bare list of links at the end loads it at random or never.

## One level deep

An agent reads `SKILL.md`, then the files it links. A file that is linked only from another reference is two hops away and is rarely opened. Link every reference from `SKILL.md`. When a reference needs another file, add that link to `SKILL.md` too, next to the step that needs both.

## Scripts

- Use a script when the step must give the same result every time: parsing, validation, formatting, file generation.
- Call the script through a path the host resolves, such as `${CLAUDE_SKILL_DIR}/scripts/<file>`, not a path relative to the working directory, which changes between projects.
- Make the script say what went wrong on failure. The agent reads its output, so an error message is an instruction.

## Sharing between skills

- A file that several skills use lives in one owning skill. The other skills point at it by path. A copy drifts from its original.
- When several skills need the whole guidance of another skill, name that skill instead of linking into its `references/`. Its `SKILL.md` usually holds the rules that govern the detail, and a path into its references delivers the detail without the rules.

## Splitting a large skill

Split along triggers, not along sections. Ask what task brings the agent to each part:

- Parts with different triggers become separate skills, each with its own sharp description.
- Parts with the same trigger stay in one skill; move their detail to references.
- Parts that must run in a fixed order across skills are a process. Put the order in code and keep each skill focused on doing its own step well.
