# Set up a project - one run of /bdk:setup

Every BDK command reads the project's configuration first. Until a project has one, the commands stop with `BDK not configured: run /bdk:setup`, and the session-start hook shows the same line. Open Claude Code in the project's root and run:

```text
/bdk:setup
```

## What setup does

1. **Reads the project.** Manifests, lockfiles, scripts and the configs they name: the languages, the test, lint and build commands (with a variant that runs only on given files, when the tool has one; in a repository of several packages, each check also gets the `paths` of its package), and how to start the product so BDK can use it as a user would.
2. **Asks only what it cannot settle.** For example two test commands competing, no lint command found, or a dev server port the files do not name. All questions come in one go, the recommended answer first.
3. **Writes `.bdk/settings.yaml`** with what it found, and nothing else; every other key keeps its default. Then it runs `bdk config check` until the file is valid.
4. **Adds permission rules** to `.claude/settings.json`, so the stages can run `bdk`, `openspec`, `git`, `gh` and your project's commands without asking each time. Claude Code asks you to approve this write, and applies the rules only in a project folder you trusted (the dialog Claude Code shows the first time you open the folder).
5. **Sets up OpenSpec** with the BDK schema: `openspec/config.yaml` says `schema: bdk`, and the schema lives in `openspec/schemas/bdk/`.
6. **Keeps run files out of git:** `.bdk/runs/` and `.bdk/settings.local.yaml` go into `.gitignore`; `.bdk/settings.yaml` stays tracked, so the team shares it.
7. **Reports where you will answer questions.** It runs `npx -y lavish-axi --version`: when it works, design questions and review triage come as a Lavish page in the browser; otherwise they come as `AskUserQuestion` in the terminal, and the report suggests installing `lavish-axi` for the browser page. Setup installs nothing for it.

Setup commits nothing: review the files and commit them yourself.

A typical result for a TypeScript web app:

```yaml
# BDK project settings. Resolved values with their origins: bdk config show
languages: [typescript]
tools:
  test:
    - id: vitest
      command: pnpm test
      scoped: pnpm vitest run {files}
  lint:
    - id: eslint
      command: pnpm lint
      scoped: pnpm eslint {files}
  build:
    - id: vite
      command: pnpm build
  e2e:
    - id: web
      start: pnpm dev
      ready: http://localhost:5173
      driver: browser
```

Every key is described in the [settings reference](/reference/bdk/settings), for example [`tools.e2e`](/reference/bdk/settings#tools-e2e).

## Check the result

The `bdk` command line ships inside the plugin and is on the `PATH` of Claude Code's Bash tool, not of your own terminal. Ask Claude to run it:

```text
run bdk config show
```

It prints every value with the layer it came from (`default`, `global`, `project` or `local`). `bdk config check` lists problems by file and key.

## Run setup again

- **Change one thing:** `/bdk:setup add the e2e entry` changes only that, and keeps everything else.
- **After a plugin update:** `/bdk:setup` installs the BDK schema the new version ships.
- **Coming from BDK v2:** setup reads `.bdk/settings.json` as a hint and asks before it deletes any v2 file.

## Without an E2E entry

A library or a project with nothing to start has no `tools.e2e`. BDK then skips the E2E check and reviews code, tests and spec conformance only; setup says so in its report. Add an entry later with `/bdk:setup add the e2e entry`.

Next: [take one idea to a pull request](./workflow.md).
