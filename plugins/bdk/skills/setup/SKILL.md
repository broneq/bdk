---
name: setup
description: 'Configures a project for BDK in one run - detects the stack and how to start the product for E2E, writes .bdk/settings.yaml, adds permission allow rules, initialises OpenSpec with the BDK schema. Use when setting up or starting BDK in a project, when a BDK skill says "BDK not configured: run /bdk:setup" or reports an invalid configuration, or to change what setup detected.'
argument-hint: "[what to change, e.g. 'add the e2e entry']"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(openspec *) Bash(npx -y @fission-ai/openspec@1.13.2 *) Bash(git check-ignore *) Bash(node -e *) Bash(pnpm add -D @playwright/test@1.63.0) Bash(pnpm --filter * add -D @playwright/test@1.63.0) Bash(npm install -D @playwright/test@1.63.0) Bash(npm install -D @playwright/test@1.63.0 -w *) Bash(yarn add -D @playwright/test@1.63.0) Bash(yarn workspace * add -D @playwright/test@1.63.0) Bash(bun add -d @playwright/test@1.63.0) Bash(bun add -d @playwright/test@1.63.0 --cwd *) Bash(pnpm exec playwright install chromium) Bash(pnpm --filter * exec playwright install chromium) Bash(npx playwright install chromium) Bash(yarn playwright install chromium) Bash(bunx playwright install chromium) Bash(npx -y lavish-axi --version) Read Write Edit Glob Grep AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Setup

Leave this project configured for BDK: `bdk config check` exits 0, `bdk config show` reports no "not configured" line, the BDK OpenSpec schema is installed, and the permission and ignore rules are in place. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`. Read and search files with Read, Glob and Grep, not with Bash. Run each command on its own, without `;`, `&&`, pipes or `echo`: the result shows the exit code, and a compound command needs the user's approval. Never commit; the user reviews and commits.

## 1. Read the state

The block above shows one of three states:

- `BDK not configured: run /bdk:setup`: a first run. Do every step.
- `BDK configuration invalid`: fix the problems it lists, then continue with step 5.
- The configuration with origins: a re-run. Keep every value a layer sets. When the arguments name a change ("add the e2e entry"), do only that change, then steps 5, 6 (rules for its new commands), 9 (for a new `browser` item) and 10. Otherwise detect only the groups that are still empty and the rules and files still missing.

Done when you know which steps this run does.

## 2. Detect

Read the project's manifests and lockfiles, its scripts and the configs they name, before writing anything. Use [the stack table](references/stacks.md) for `languages`, `tools.test`, `tools.lint`, `tools.build` and their `scoped` forms, and [the E2E table](references/e2e.md) for `tools.e2e`. A v2 `.bdk/settings.json` is a hint: [v2 projects](references/stacks.md#v2-projects).

Note for every value the file it came from. In a repository of several packages, detect the items per package and decide each item's `paths` by [the paths rules](references/stacks.md#paths-in-a-repository-of-several-packages). Done when every group has a value, an empty answer with a reason, or an open question.

## 3. Ask, only when something is open

Open questions are only these: two commands competing for one group, a test or lint group with no command found, an E2E `start` or port the files do not settle, an existing `openspec/config.yaml` naming a schema other than `bdk` (step 7), deleting v2 files, and installing Playwright for a `browser` item ([Playwright](references/e2e.md#playwright)). When none is open, ask nothing and go on.

Otherwise ask them all in one `AskUserQuestion` call (at most 4 questions), the recommended answer first in each. A group with no command found offers "The project has none" first. When you cannot ask, take the recommended answers and name them in the report, except deleting files and installing: then keep the v2 files, install nothing, and list both in the report.

The schema question: "Make `bdk` the default OpenSpec schema of this project?", recommended first "Keep `<schema>`; BDK opens its own Changes with `--schema bdk`", second "Switch to `bdk`". The project's schema line and its `context:` text are the team's own workflow: never change them without a yes. Done when every open question has an answer.

## 4. Write `.bdk/settings.yaml`

On a first run write the file with Write; on a re-run change only the affected keys with Edit, keeping comments and key order. Write only detected keys: every other key keeps its default and stays out of the file. Shape:

```yaml
# BDK project settings. Resolved values with their origins: bdk config show
languages: [typescript]
tools:
  test:
    - id: vitest
      command: pnpm test
      scoped: pnpm vitest run {files}
      # paths: ["web/**"] - only in a repository of several packages
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

Leave out a group that has no item. Write `paths` only as the paths rules say; a single-package repository gets none. Done when the file holds every detected value.

## 5. Check the settings

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config check`. Exit 1 lists problems as `<file>: <key>: <message>`: fix each in the named file and run it again. Done when it exits 0.

## 6. Add permission allow rules

Edit the project's `.claude/settings.json` (create it as `{"permissions": {"allow": []}}` when missing). Claude Code asks the user to approve every write to this file; when the write is refused, list the rules in the report for the user to add. Add to `permissions.allow` each of these that is missing, keeping every other entry and key:

- `Bash(bdk *)` and `Bash(*/bin/bdk *)` (skills call the launcher by its plugin path), `Bash(openspec *)`, `Bash(git *)`, `Bash(gh *)`;
- `Bash(<command>)` for each `tools.test`, `tools.lint` and `tools.build` command, and each `tools.e2e` `start` and command `ready` (a URL needs no rule);
- `Bash(<prefix> *)` for each `scoped` form, `<prefix>` being the command before `{files}` (`pnpm vitest run {files}` gives `Bash(pnpm vitest run *)`).

Done when every rule is in the file and the JSON parses.

## 7. OpenSpec with the BDK schema

1. When `openspec/` is missing, initialise it with OpenSpec 1.13.2: `openspec --version`; when it prints `1.13.2`, run `openspec init --tools none .`, otherwise `npx -y @fission-ai/openspec@1.13.2 init --tools none .`. When neither runs, write `openspec/config.yaml` holding `schema: bdk`, and empty `openspec/specs/.gitkeep` and `openspec/changes/archive/.gitkeep`, and tell the user in the report to install it: `npm i -g @fission-ai/openspec@1.13.2`.
2. Install the schema, also on a re-run so a plugin update reaches the project: `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" openspec install`. It copies the schema the plugin ships into `openspec/schemas/bdk/` and lists each file as added, updated or unchanged.
3. Set the `schema:` line of `openspec/config.yaml` to `schema: bdk` with Edit, keeping the rest of the file, only when this run created `openspec/`, the file names no schema, or the user answered "Switch to `bdk`" in step 3. Otherwise leave the line and the `context:` text as they are.
4. When an OpenSpec CLI ran, run `openspec schema which bdk` (or its `npx` form): it must name the project as the source.

Done when `openspec/schemas/bdk/schema.yaml` exists, and `openspec/config.yaml` says `schema: bdk` or keeps the schema the project had.

## 8. Keep run files out of git

- Add `/.bdk/runs/` and `/.bdk/settings.local.yaml` to `.gitignore`, each when missing.
- `git check-ignore -v .bdk/settings.yaml`: when it prints a rule (BDK v2 wrote `/.bdk/`), remove that rule from its file, so the team sees the settings. Note the rule and its file for the report.
- Delete v2 paths only after the user agreed in step 3.

Done when `git check-ignore -q .bdk/settings.yaml` exits 1 and `git check-ignore -q .bdk/runs/x` exits 0.

## 9. Playwright for the browser item

Only for a `browser` item, and only when the user agreed in step 3: install what [Playwright](references/e2e.md#playwright) says, one command at a time, then check that `@playwright/test` resolves from the web app's package. A failed install goes into the report with its output; go on.

Done when the install ran or was not asked for, and you know which report line of [Playwright](references/e2e.md#playwright) applies.

## 10. Verify and report

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` and confirm it prints the configuration, not a "not configured" or "invalid" line.

Then check which decision surface the project gets: run `npx -y lavish-axi --version` once. Exit 0 means BDK asks the user through a Lavish page; any other exit, or a command that cannot run, means `AskUserQuestion`. Never install Lavish and write nothing for it: `design-draft` and `triage` choose their surface again when they ask.

Report briefly:

- each value written, with the file it came from (`tools.test.vitest: pnpm test (package.json scripts.test)`);
- the `paths` written on each check item (`tools.test.pytest: api/**`), or "no `paths`: one package";
- OpenSpec: `schema: bdk` set, or, when the project keeps its own schema, "OpenSpec keeps `<schema>` as the project's default; BDK opens its own Changes with `--schema bdk`";
- a removed ignore rule, in a line of its own: "Removed `/.bdk/` from `.gitignore` (BDK v2 ignored all of `.bdk/`): `.bdk/settings.yaml` is now tracked for the team; `.bdk/runs/` and `.bdk/settings.local.yaml` stay ignored";
- E2E: the entries written, or "E2E skipped" with the reason (a library has nothing to run); for a `browser` item, the Playwright line of [Playwright](references/e2e.md#playwright);
- the decision surface, in one line: "questions and triage use a Lavish page" or "questions and triage use AskUserQuestion; install lavish-axi for a browser review page";
- the files created or changed, left uncommitted for review;
- answers taken without asking, and anything left for the user (installing OpenSpec, an install of Playwright not asked for or declined, a group the project has none of);
- how to change a value: `bdk config set <key> <value>` or an edit of `.bdk/settings.yaml`, then `bdk config check`.
