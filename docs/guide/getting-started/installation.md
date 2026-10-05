# Installation

::: warning Describes BDK v2
This page describes BDK v2. The v3 documentation replaces it (T50).
:::

BDK installs as a Claude Code plugin. Two commands add it, one skill configures
the project, and everything else is a slash command in your normal session.

## Prerequisites

### Claude Code

BDK is a Claude Code plugin: skills, agents, and hooks are loaded by the Claude
Code plugin loader. There is nothing to run outside it.

### Node

The kernel is a Node program: install Node >= 22.13 and keep it on `PATH`.
The plugin's `bin/bdk` launcher runs it, and Claude Code puts the plugin's
`bin/` on the Bash tool's `PATH`, so skills and agents call the kernel as
`bdk <command>`. Hooks run the bundle by its path, because a hook's `PATH`
does not hold the plugin's `bin/`.

### Not claude.ai or Cowork

BDK needs Claude Code: the CLI, the desktop app or an IDE extension. claude.ai
and Cowork do not install a plugin that has a `bin/` directory, and BDK has no
other way to start its kernel there.

### Nothing else for code tools

BDK ships no MCP server and starts no background process. Skills and agents
explore, search, and trace code with Claude Code's built-in tools (`Grep`,
`Glob`, `Read`, `Bash`). If you want a code-navigation MCP server, configure it
yourself with `claude mcp add`; BDK neither depends on it nor tells its agents
to call it.

### Optional: `lavish-axi`

With the `lavish-axi` binary on `PATH` **and** `features.lavish` set to `true`
in `.bdk/settings.json`, skills that bundle several decisions into one prompt
(`/bdk:design`, `/bdk:plan`) route that prompt through `lavish-axi`
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
- Guard hooks: `PreToolUse` stops subagents from running git or orchestrator
  commands and anyone from editing `.bdk/specs/`, `UserPromptExpansion` passes
  a stage gate when you type its command, and `SessionEnd` checkpoints the
  active Change.
- No project artifacts yet: `.bdk/` is created by `/bdk:setup`.

## Next step

[Configure the project with `/bdk:setup`](setup.md).
