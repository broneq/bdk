# Claude Code features

These features exist only in Claude Code. A skill in the portable profile uses none of them, and `portable-syntax` reports the syntax. Read on 2026-09-26 from https://code.claude.com/docs/en/skills, https://code.claude.com/docs/en/sub-agents and https://code.claude.com/docs/en/hooks; check them again when a host release changes the behaviour.

## String substitutions

Claude Code replaces these in the skill content before the agent sees it:

| Placeholder             | Replaced with                                               |
| ----------------------- | ----------------------------------------------------------- |
| `$ARGUMENTS`            | Every argument passed when the skill was invoked.           |
| `$ARGUMENTS[N]`, `$N`   | One argument by 0-based index: `$0` is the first.           |
| `${CLAUDE_SESSION_ID}`  | The current session ID, for logs or session-specific files. |
| `${CLAUDE_EFFORT}`      | The current effort level.                                   |
| `${CLAUDE_SKILL_DIR}`   | The directory that holds the skill's `SKILL.md`.            |
| `${CLAUDE_PROJECT_DIR}` | The project root.                                           |
| `${CLAUDE_PLUGIN_ROOT}` | The plugin's installation directory; plugin skills only.    |
| `${CLAUDE_PLUGIN_DATA}` | The plugin's persistent data directory; plugin skills only. |

The singular `$ARGUMENT` is not a placeholder and reaches the agent as literal text. Supporting files are not substituted: the agent reads them as written, so a reference can name a placeholder safely, while `SKILL.md` cannot mention one without it being replaced.

## `!` blocks

A `` !`command` `` at the start of a line or after whitespace, or a fenced block opened with ` ```! `, runs before the skill content reaches the agent, and the command's output replaces it. It runs inside code fences too.

- The command goes through the permission rules. Outside auto mode, a command that no rule allows aborts the whole skill, so pre-approve it in `allowed-tools` with a pattern such as `Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/tool.mjs" *)`. The host matches the pattern literally, quotes included. Deny and ask rules still win.
- A command that exits non-zero aborts the skill; the agent never sees the content.
- Keep a block to one command whose output the skill needs on every run. Work that only some runs need belongs in a step the agent runs.

## Dispatching subagents

- Pass only the parameters the host's Agent tool declares, such as `subagent_type`, `prompt` and `description`. The list changes between releases, and a parameter the tool does not declare is an input-validation error at run time that no test of the skill catches. Check the current list before you write a dispatch step, and never borrow a parameter from another tool.
- Name a plugin's agent with its namespace: `subagent_type: <plugin>:<agent>`.
- Subagents usually run in the background, and the host delivers a completion notification in a later turn. A step that needs the result says "wait for the completion notification; do not poll". Without that sentence the agent invents a poll: a sleep, a scheduled wake-up, a monitor or a watcher agent.
- Give the subagent everything it needs in the prompt. It starts without the conversation.

## Skill-scoped hooks

`hooks` in skill frontmatter registers hooks when the skill runs, and they stay registered for the rest of the session.

- `once: true` removes a hook after its first successful run. It is honoured only in skill frontmatter, and it suits a startup check. A run that fails, blocks or times out leaves the hook in place.
- In agent frontmatter, hooks live only while the agent runs, and a `Stop` hook becomes `SubagentStop`.
- A hook entry takes a `matcher` for the event, and each handler a `type` (`command`, `http`, `mcp_tool`, `prompt` or `agent`) and an optional `timeout` in seconds.

## Sharing within one plugin

- A reference or script that several skills of a plugin use lives in one owning skill. The others point at it as `${CLAUDE_PLUGIN_ROOT}/skills/<owner>/references/<file>`. A copy drifts from its original.
- To share a whole standard, name the owning skill (`/<plugin>:<owner>`) instead of a path into its `references/`. A path delivers the detail without the rules in the owner's `SKILL.md` that govern it.
