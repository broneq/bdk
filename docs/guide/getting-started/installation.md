# Installation

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

BDK installs as a Claude Code plugin. Two commands add it, one skill configures
the project, and everything else is a slash command in your normal session.

## Prerequisites

### Claude Code

BDK is a Claude Code plugin: skills, agents, and hooks are loaded by the Claude
Code plugin loader. There is nothing to run outside it.

### Nothing else for code tools

BDK ships no MCP server and starts no background process. Skills and agents
explore, search, and trace code with Claude Code's built-in tools (`Grep`,
`Glob`, `Read`, `Bash`). If you want a code-navigation MCP server, configure it
yourself with `claude mcp add`; BDK neither depends on it nor tells its agents
to call it.

### Optional: the `caveman` plugin

`/bdk:commit` is a thin delegation: its whole body is
`Invoke /caveman:caveman-commit $ARGUMENTS`. A `UserPromptSubmit` hook checks
for the dependency once per session and warns when the skill is not installed:

```
[BDK] Skill 'caveman-commit' not installed. Install it for full functionality. Expected location: ~/.claude/skills/ or .claude/skills/
```

Every other BDK skill works without it.

### Optional: `lavish-axi`

With the `lavish-axi` binary on `PATH` **and** `features.lavish` set to `true`
in `.bdk/settings.json`, skills that bundle several decisions into one prompt
(`/bdk:design`, `/bdk:create-plan`) route that prompt through `lavish-axi`
instead of the terminal `AskUserQuestion`. The question set is unchanged; only
the surface differs. Skills check both the flag and the binary, and fall back
to the terminal silently when either is absent.

## Install the plugin

1. Add the BDK marketplace source:

   ```
   /plugin marketplace add broneq/bdk
   ```

2. Install the plugin:

   ```
   /plugin install bdk@bdk
   ```

## Configure the project before the first real task

Skills read the project's test, lint, and build commands from its settings, which
`/bdk:setup` writes. The session start checks the settings whenever a `.bdk/`
directory exists and prints what it finds, but it never blocks the session. See
[Hooks](../reference/hooks.md).

## What you get

- BDK installed as a Claude Code plugin, with its skills reachable as `/bdk:<name>`.
- A `SessionStart` hook that injects the shared foundation and checks the
  project settings.
- No project artifacts yet: `.bdk/` is created by `/bdk:setup`.

## Next step

[Configure the project with `/bdk:setup`](setup.md).
