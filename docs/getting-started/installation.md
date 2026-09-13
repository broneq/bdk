# Installation

BDK installs as a Claude Code plugin. Two commands add it, one skill configures
the project, and everything else is a slash command in your normal session.

## Prerequisites

### Claude Code

BDK is a Claude Code plugin: skills, agents, and hooks are loaded by the Claude
Code plugin loader. There is nothing to run outside it.

### `uvx` (strongly recommended)

Both MCP servers BDK bundles in `.mcp.json` are launched through `uvx`:

| Server | Launched as |
|---|---|
| `serena` | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server ...` |
| `code-review-graph` | `uvx code-review-graph serve` |

Without `uvx` neither server starts, and BDK falls back to the plain
`Grep`/`Glob`/`Read` tier for search, exploration, and review. See
[Tool tiers](../concepts/tool-tiers.md) for what each tier changes.

A `SessionStart` hook checks for it on every session and prints this when it is
missing:

```
[BDK] WARNING: uvx not found. MCP tools (serena, code-review-graph) require uvx. Install: https://docs.astral.sh/uv/getting-started/installation/
```

!!! note
    The same hook block also runs `uvx code-review-graph status` when `uvx` is
    present, so a session start tells you the state of the graph index as well.

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

## Your first session is blocked on purpose

BDK's `SessionStart` hooks include `check-bdk-config`, which looks for
`.bdk/settings.json` in the project root. In a project that has never been set
up, the file is missing and the hook blocks the session with:

```
BDK project settings not found (.bdk/settings.json missing).

Run /bdk:setup to configure this project before proceeding.
Setup probes your project files and records test/lint/build commands.
Until setup is complete, skills that rely on project settings will not work correctly.
```

The same hook also blocks when the file exists but fails validation, with a
different message that names each error. See
[Troubleshooting](../troubleshooting.md) for that case.

!!! warning
    Do not hand-write `.bdk/settings.json` to get past the block. The file
    carries tiered and scoped command templates that every later agent depends
    on; `/bdk:setup` derives them from your project. The full key reference is
    in [Settings](../reference/settings.md).

Once settings exist and validate, the hook stops blocking and instead injects a
compact summary of the project's languages, test commands, lint commands, build
commands, and feature flags into the session.

## What you get

- BDK installed as a Claude Code plugin, with its skills reachable as `/bdk:<name>`.
- A `SessionStart` hook chain that injects the shared foundation, warns about a
  missing `uvx`, and blocks until the project is configured.
- No project artifacts yet: `.bdk/` is created by `/bdk:setup`.

## Next step

[Configure the project with `/bdk:setup`](setup.md).
