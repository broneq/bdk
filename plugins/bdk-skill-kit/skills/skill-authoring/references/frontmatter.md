# Frontmatter fields

`skill-check` validates frontmatter against one of two profiles, chosen per target in the config (`--portable` switches every skills target to the portable profile). The field lists come from the Agent Skills specification (https://agentskills.io/specification) and the Claude Code documentation for skills (https://code.claude.com/docs/en/skills) and subagents (https://code.claude.com/docs/en/sub-agents).

## Portable skills

The Agent Skills standard defines six fields. A skill that uses only these runs on every host that implements the standard.

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| `name`          | Required. Lowercase letters, digits and single hyphens, at most 64 characters.      |
| `description`   | Required. What the skill does and when to use it, at most 1024 characters.          |
| `license`       | A license name or the name of a license file shipped with the skill.                |
| `compatibility` | 1 to 500 characters on the environment the skill needs (tools, network, system).    |
| `metadata`      | A map of string keys to string values, for tooling. `fronts-cli` is one such key.   |
| `allowed-tools` | Tools the host pre-approves while the skill runs, as a string or a list of strings. |

## Claude Code skills

Claude Code accepts the portable fields and adds these:

| Field                      | Value                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `when_to_use`              | Extra trigger text, shown with `description`; both count toward the 1536-character cap. |
| `argument-hint`            | Autocomplete hint for arguments, for example `[issue-number]`.                          |
| `arguments`                | Named arguments, as a string or a list of strings.                                      |
| `disable-model-invocation` | `true` hides the skill from the model; only the user can run it.                        |
| `user-invocable`           | `false` hides the skill from the user's menu; only the model can run it.                |
| `disallowed-tools`         | Tools removed from the pool while the skill runs. The only field that restricts.        |
| `model`                    | A model override for the skill.                                                         |
| `effort`                   | `low`, `medium`, `high`, `xhigh` or `max`.                                              |
| `context`                  | `fork` runs the skill in an isolated subagent.                                          |
| `agent`                    | The subagent type for `context: fork`.                                                  |
| `background`               | `true` or `false`.                                                                      |
| `hooks`                    | Hooks scoped to the skill's lifetime.                                                   |
| `paths`                    | Globs that bring the skill in when matching files are in play.                          |
| `shell`                    | `bash` or `powershell`.                                                                 |

`allowed-tools` pre-approves; it does not restrict. A tool missing from the list still works and goes through the normal permission prompt. When the body states an invariant such as "never edit files", enforce it with `disallowed-tools` instead of asking for it in prose.

## Claude Code agents

Agents are single Markdown files, not directories. The standard defines no agents, so agents always use this profile.

| Field             | Value                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| `name`            | Required. Same format as a skill name.                                          |
| `description`     | Required. When to delegate to the agent.                                        |
| `tools`           | Comma-separated string or list: tool names, `Name(...)` patterns or `mcp__...`. |
| `disallowedTools` | Same forms as `tools`, removed from the pool.                                   |
| `model`           | The model the agent runs on, or `inherit`.                                      |
| `maxTurns`        | A positive integer.                                                             |
| `skills`          | Skills preloaded into the agent's context at start.                             |
| `memory`          | `user`, `project` or `local`.                                                   |
| `background`      | `true` or `false`.                                                              |
| `omitClaudeMd`    | `true` or `false`.                                                              |
| `effort`          | Same levels as for skills.                                                      |
| `isolation`       | `worktree`.                                                                     |
| `color`           | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink` or `cyan`.         |
| `initialPrompt`   | A string.                                                                       |
| `experimental`    | Host-specific experimental settings.                                            |

Claude Code ignores `hooks`, `mcpServers` and `permissionMode` on an agent that ships in a plugin. Move such an agent to the project's own agents directory, or drop the field.

## Invocation

| Frontmatter                      | User can run | Model can run | In context before it runs |
| -------------------------------- | ------------ | ------------- | ------------------------- |
| (default)                        | yes          | yes           | name and description      |
| `disable-model-invocation: true` | yes          | no            | nothing                   |
| `user-invocable: false`          | no           | yes           | name and description      |
