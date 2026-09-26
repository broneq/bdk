---
name: skill-authoring
description: Writes and reviews Agent Skills and subagent files - frontmatter, layout, size, references, process versus knowledge, and skills that front a CLI. Use when creating, splitting, reviewing or fixing a skill or an agent, or when skill-check reports a finding.
license: MIT
---

# Skill authoring

A skill is a directory with a `SKILL.md` file and optional supporting files. Hosts load a skill in three steps, and each step has its own budget:

1. The `name` and `description` of every installed skill sit in context all the time. They decide whether the skill runs at all.
2. The body of `SKILL.md` loads when the skill runs. It decides what the agent does.
3. Supporting files load only when the body sends the agent to them. They carry detail that only some runs need.

Write for that order. An ID in parentheses after a guideline, such as (`line-limit`), names the `skill-check` rule that enforces it. Run `skill-check` before you commit a skill or an agent, and read a finding's rule ID here to learn what it asks for.

## Before writing: should this be a skill?

- A skill earns its place only when it changes what the agent does. It encodes a process the agent would not follow on its own, or it makes a concrete choice among options: a named pattern, a fixed output format, a project convention. A summary of what a capable model already knows is not a skill.
- Test a knowledge skill before you adopt it. Run the same tasks with and without it, and keep it only when the results differ measurably.
- Work that a program can do the same way every time belongs in a script or a CLI, not in prose. The skill then only says when to reach for the tool.
- A skill that grows a state machine (stages, retries, approvals, files at fixed paths) is doing process work. Move that process into code and keep the knowledge in the skill.

[Process versus knowledge](references/process-vs-knowledge.md) has the classification test and the admission rule.

## Frontmatter

- Open the file with a YAML block between two `---` lines, and make it a map of fields. (`frontmatter`)
- Write `name` in lowercase letters, digits and single hyphens, at most 64 characters, with no hyphen at either end. A project can require a prefix. (`name-format`)
- Make `name` equal to the directory name; hosts use one or the other depending on how the skill is invoked. (`name-matches-dir`)
- Name the file `SKILL.md` exactly. Hosts skip `skill.md` or `README.md`, and a directory of Markdown without `SKILL.md` is not a skill. (`skill-file-name`)
- Always write a `description`, and keep it within the host limit: 1024 characters for the portable profile, 1536 for `description` plus `when_to_use` in Claude Code. (`description`)
- Lead the description with what the skill does, then add a trigger clause such as "Use when ...". Never open with filler such as "This skill" or "Helps". The first words are what an agent scans when it chooses a skill. (`description-front-loaded`)
- Use only the fields of the profile you target, each with a value of the right type. The portable profile has six fields; Claude Code adds its own. (`fields`, `field-values`)
- Keep at least one way to run the skill: `disable-model-invocation: true` together with `user-invocable: false` leaves none. `agent` applies only with `context: fork`. (`invocation`)
- For agents, declare `model` when the project requires it, so that a model change is a reviewed diff and not an inherited surprise. (`require-model`)

[Frontmatter](references/frontmatter.md) lists the fields of each profile and what they do.

## Description

The description is the only part an agent sees before it decides to load the skill. Treat it as the skill's search entry:

- State the capability in the first clause, in words a user would type.
- Name the triggers: the tasks, file types, commands or failure messages that should bring the skill in.
- Name the boundary when a neighbouring skill covers the other side ("not for X; use Y").
- Leave out how the skill works. The body says that.

## Body

- Write a body. A skill with only frontmatter does nothing when it runs. (`body`)
- Keep `SKILL.md` short: at most 500 lines, and far less for most skills. Move detail that only some runs need into `references`. (`line-limit`)
- Name capabilities, not models. "A fast model" or "the most capable model" stays true when the model line-up changes; a model name goes stale. (`model-names`)
- Point at files with paths relative to the skill directory, or through the host's variable for that directory. An absolute path works only on the author's machine. (`absolute-paths`)
- Write the argument placeholder in its plural spelling. The singular spelling is not substituted and reaches the agent as literal text. (`arguments-typo`)

How to write the steps themselves:

- Write imperative steps the agent can follow and check: "List the callers of X", not "It may be useful to consider callers".
- Say what to find, check or produce, not which tool to use: "find the callers of X", not a tool call that searches for X. The host's system prompt teaches its tools; repeating it costs context and goes stale. Name a tool only where the tool is the subject: `allowed-tools` and `disallowed-tools`, a subagent dispatch, a question to the user through the host's question tool, or a script the step runs.
- Give each step a clear end: the output it produces or the condition that ends it.
- State invariants once, where they apply, and say what happens when one is violated.
- Prefer one worked example over three abstract rules. Put long examples in `references`.
- Match the level of freedom to the task: exact commands for fragile operations, heuristics for judgment calls.

## Portability

- A skill or agent meant for reuse names nothing that exists in one project only: no file of one repository (a placeholder such as `path/to/file` is fine), no "in this repo" or "our codebase", no team or organisation name, and no hardcoded branch, database or service name. Let the project's own configuration supply such values.
- A skill in the portable profile uses no Claude Code syntax: no `!` block and no Claude Code substitution variable. Other hosts show both as literal text. (`portable-syntax`)
- A project can forbid its own names, tool prefixes or stack-specific commands in reusable skills, anywhere or only in code. (`forbidden-text`)

## Claude Code features

[Claude Code features](references/claude-code.md) lists the string substitutions, how `!` blocks run, how to dispatch subagents and wait for them, skill-scoped hooks and how skills of one plugin share files. The rules below apply to skills that use them:

- A `!` block runs a shell command before the agent sees the skill. Pre-approve its command in `allowed-tools`: outside auto mode, an unapproved command aborts the whole skill. A project lists the entries its blocks need. (`block-allowed-tools`)
- A project that wraps its CLI in blocks can allow only whole-line blocks of that form, so no skill runs an arbitrary command at load time. (`block-form`)
- In a plugin, name the plugin's own skills and agents with its namespace, as `/<plugin>:<name>` and `subagent_type: <plugin>:<name>`. An unqualified name can resolve to another plugin's skill, and a reference to another plugin's skill depends on that plugin being installed. (`namespaced-refs`)
- A skill that only the user may start sets `disable-model-invocation: true`, and a skill that delegates edits removes the edit tools with `disallowed-tools`. A project lists such skills with the fields they require. (`required-fields`)

## Agents

An agent is one Markdown file whose body becomes the subagent's system prompt. The frontmatter and body rules above apply to it too.

- Give an agent only the tools its job needs. When an agent must not change anything but its `tools` include Bash or an edit tool, remove those tools, or, when it needs Bash to read, state the constraint in the body: "MUST NOT modify files". A narrower `tools` list or `disallowedTools` is enforced; a sentence in the body is only followed.
- A project can fix the shape of an agent body, for example an adapter that is one sentence loading a skill. (`body-shape`)

## Layout and references

- Keep `SKILL.md` at the top of the directory and put supporting files in conventional subdirectories: `references` for documents the agent reads, `scripts` for code it runs, `assets` for files the output uses, `examples` for sample output. A project can restrict the allowed top-level entries. (`layout`)
- Make every link and every backticked path in `SKILL.md` resolve inside the skill directory. (`references`)
- Link every supporting document from `SKILL.md` itself. A reference that links on to another file hides that file one level deeper than an agent reads, so the second file is usually never loaded. (`references`)
- Delete files that nothing mentions. A file that neither `SKILL.md` nor a file it references names is never read. (`unused-files`)
- Give every skill a name that is unique across all the directories you check. With a duplicate, the host silently picks one of them. (`unique-names`)

[Structure](references/structure.md) covers progressive disclosure, sharing files between skills and how to split a skill that has grown too large.

## Size

- A skill that fits in one screen is read in full. A long skill is skimmed, and the agent follows the parts it happened to read.
- Aim for a `SKILL.md` of 50 to 200 lines. Past 200 lines, look for detail that only some runs need, and move it to `references`.
- Split a skill in two when its description needs two unrelated trigger clauses. Two skills with sharp descriptions are chosen more reliably than one skill with a vague one.
- Do not split a single process across skills that must run in a fixed order. That order is process, and belongs in code.

## Skills that front a CLI

When a command-line tool does the work, the skill is a thin pointer to it:

- Declare the tool with `metadata.fronts-cli` set to the command name.
- Keep the skill model-invocable and at most 30 lines long.
- Say when to reach for the tool and show one invocation form.
- Point at the tool's `--help` as the only usage reference, and do not copy flags, subcommand tables or exit codes into the skill. (`cli-front`)

[CLI-fronting skills](references/cli-fronting.md) explains why and shows the shape.

## Reviewing a skill

1. Run `skill-check` and fix every finding, or record why a finding is accepted.
2. Read the description alone. Could an agent tell from it, and only from it, when to load the skill and when not to?
3. Classify each section as process, knowledge or wiring. Move process out.
4. For a knowledge skill, check that it encodes a choice or a process the agent would not make on its own.
5. Read the body as the agent will: in order, with no other context. Mark every step that has no clear end or output.
