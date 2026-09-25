# Skills that front a CLI

When a command-line tool does the work, a skill should not teach the tool. It should say when to reach for it and where its usage lives.

## Why thin

- **Usage drifts.** A flag table copied into a skill is correct on the day it is written. The tool's own `--help` is generated with the tool and cannot drift.
- **Context is expensive.** A skill body loads on every run. Usage text that the agent needs on one run in ten belongs behind a `--help` call made on that run.
- **The tool is the contract.** When the skill and `--help` disagree, the agent has two sources of truth and picks one at random.

## The shape

- `metadata.fronts-cli: <command>` in the frontmatter declares the skill as a front, so `skill-check` applies the checks below.
- Model-invocable: the point of the skill is that the agent finds the tool on its own. `disable-model-invocation: true` defeats it.
- At most 30 lines in `SKILL.md`.
- When to reach for the tool: the tasks, events or failure messages that call for it.
- One invocation form, the way the agent should always call it.
- `<command> --help` (or `<command> <group> --help`) named as the only usage reference.

## What `skill-check` flags

The `cli-front` rule reports a fronting skill that:

- disables model invocation;
- has more than 30 lines;
- never mentions `<command> ... --help`;
- names more than 3 distinct flags, not counting the help and JSON output flags;
- has more than 2 table or list rows that start with a flag or a subcommand of the tool.

The thresholds are options of the rule, so a project can tighten them.

## Example

```markdown
---
name: release-notes
description: Lints release notes with the notes tool. Use before committing release notes, or when CI reports a release-notes finding.
allowed-tools: Bash(notes *)
metadata:
  fronts-cli: notes
---

Run the linter on every changed release note before you commit it.

    notes lint <file>

`notes --help` is the only usage reference: read it for flags and exit codes.
```
