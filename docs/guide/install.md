# Install - add the BDK marketplace and the plugins you want

## What you need

| Tool | Why | Check |
|---|---|---|
| [Claude Code](https://code.claude.com/docs) | BDK runs inside it | `claude --version` |
| Node.js 22.18.0 or later, on `PATH` | the `bdk` command line the skills run | `node --version` |
| git | branches, commits and worktrees of a run | `git --version` |
| [GitHub CLI](https://cli.github.com/), logged in | reading issues, opening pull requests | `gh auth status` |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec) CLI 1.13.2 | Changes and specs | `openspec --version` |

`/bdk:setup` falls back to `npx -y @fission-ai/openspec@1.13.2` when `openspec` is missing, but the later stages run `openspec` directly, so install it once: `npm i -g @fission-ai/openspec@1.13.2`.

`lavish-axi` is started through `npx` when a stage needs it, with nothing to install: it shows a page where you answer design questions and triage findings (BDK falls back to questions in the terminal when it cannot open one). The [E2E check](/concepts/e2e) of a web product drives a browser with Playwright: your project's own, or one installed for the run (it needs Playwright's Chromium or Chrome; `/bdk:setup` offers to install them).

## Install from the marketplace

In Claude Code:

```text
/plugin marketplace add broneq/bdk
/plugin install bdk@bdk
```

Or from a shell:

```bash
claude plugin marketplace add broneq/bdk
claude plugin install bdk@bdk
```

Install the other plugins the same way, each when you want it: `bdk-craft@bdk`, `bdk-explain@bdk`, `bdk-skill-kit@bdk`, `git-identity@bdk`. None of them needs another.

Restart Claude Code after installing, then type `/bdk:` to see the commands. The `bdk` plugin also starts two hooks with every session ([hooks](/reference/bdk/hooks)); the session-start hook tells Claude whether the project is configured and, when it is, [how work goes through the BDK stages](/concepts/cli-config-hooks#hooks).

## Update

```bash
claude plugin marketplace update bdk
claude plugin update bdk@bdk
```

A new version of `bdk` can ship a new version of the BDK OpenSpec schema. Run `/bdk:setup` again in each project after an update: it installs the schema the plugin ships and keeps every setting you made.

## Run from a local checkout

To try an unreleased version, build the repository and start Claude Code with the plugin directory:

```bash
git clone https://github.com/broneq/bdk.git ~/src/bdk
cd ~/src/bdk && pnpm install && pnpm build
cd ~/your-project && claude --plugin-dir ~/src/bdk/plugins/bdk
```

`pnpm build` writes the `dist/` bundle of the `bdk` command line, which the repository does not commit.

Next: [set up a project](./first-run.md).
