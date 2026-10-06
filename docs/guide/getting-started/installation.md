# Installation

BDK installs as a Claude Code plugin. Two commands add it, one skill configures
a project, and everything else is a slash command in your normal session.

## Prerequisites

### Claude Code

BDK runs inside Claude Code: the CLI, the desktop app or an IDE extension.
claude.ai and Cowork do not install a plugin that has a `bin/` directory, and
BDK has no other way to start its kernel there.

### Node

The kernel is a Node program: install Node >= 22.13 and keep it on `PATH`. It
uses Node's built-in SQLite, so there is nothing else to install, no Python and
no native module. The plugin's `bin/bdk` launcher runs the kernel, and Claude
Code puts the plugin's `bin/` on the Bash tool's `PATH`, so skills, agents and
you, in a `!` command, call it as `bdk <command>`:

```
! bdk doctor
```

`bdk doctor` reports a Node below the minimum with the command that installs a
newer one.

### Nothing else for code tools

BDK ships no MCP server and starts no background process. Skills and agents
explore, search and trace code with Claude Code's built-in tools (`Grep`,
`Glob`, `Read`, `Bash`). If you want a code-navigation MCP server, configure it
yourself with `claude mcp add`; BDK neither depends on it nor tells its agents
to call it.

### Optional: Lavish

[Lavish](https://github.com/broneq/lavish) shows design comparisons and the
review report as a page in your browser. With the `lavish-axi` binary on
`PATH` and `features.lavish` at its default `true`, `/bdk:design`, `/bdk:plan`,
`/bdk:cr` and `/bdk:pr-review` ask their bundled questions there instead of in
the terminal. `/bdk:setup` offers to install it; without it the same questions
come through `AskUserQuestion`.

## Install the plugin

1. Add the BDK marketplace:

   ```
   /plugin marketplace add broneq/bdk
   ```

2. Install the plugin:

   ```
   /plugin install bdk@bdk
   ```

3. Optionally, install the craft skills (test-driven development, debugging,
   refactoring, Mermaid diagrams and more). They work without `bdk`; with it,
   implementer agents are told to follow `tdd`:

   ```
   /plugin install bdk-craft@bdk
   ```

The marketplace installs the latest release, which carries the built kernel.
To update later, open `/plugin`, select `bdk` on the **Installed** tab and
choose **Update now**.

## What changes in your sessions

- **Session start.** `bdk hooks session-start` prints the BDK foundation (the
  agents, verification proportionality, rules, capture conventions) and, in a
  project with `.bdk/`, one line per settings problem. It never blocks. See
  [Context](../concepts/context.md).
- **Skills** under `/bdk:<name>`; see [Skills](../reference/skills.md).
- **Guard hooks.** Before a tool call, a guard stops subagents from running git
  or orchestrator commands and anyone from editing `.bdk/specs/` by hand;
  typing a stage command passes its gate; the end of a session checkpoints the
  active Change. Each hook decides in the shell when it has nothing to do, so a
  tool call outside a Change costs well under a millisecond. See
  [Hooks](../reference/hooks.md).
- **No project files yet.** `.bdk/` is created by `/bdk:setup`.

## Next step

[Configure the project with `/bdk:setup`](setup.md).
