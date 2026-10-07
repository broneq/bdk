# BDK — Contributing & Development

## Architecture

### A kernel and thin skills

The kernel (`kernel/`, bundled into `dist/bdk.mjs`) holds the order of the work, the state of every Change and every check; the skills say what to do at each step and call it as `bdk <command>`. A skill gets settings-derived content (rules, language rules, fragments, project commands) only through its two context lines, `bdk ctx skill <name>`; a role agent gets its whole prompt from its dispatch package and its rules from `bdk rules show --ticket <ticket>`. `STARTUP_INSTRUCTIONS.md` is printed into each session at `SessionStart` as it is.

### Built-in Tools Only

BDK ships no MCP server (see `docs/adr/0001-remove-bundled-mcp-servers.md`). Skills and agents run on the host's built-in tools, and the host already tells the model how to use them. So BDK adds no tool guidance: a skill or agent step says what to find or check, not which tool to use for it.

### Development rules

BDK's own development rules are hand-written bullets in `.claude/rules/`, one file per area, scoped by `paths:`, so every Claude Code session that edits BDK loads them. Add a rule only once it passes the admission test: it survives a refactor that changes no decision, an agent would make a wrong change without it, the trap is invisible where the mistake is made, and no code, type or failing test tells it. A definition of how BDK works belongs in the spec that owns it, and a procedure in this file.

---

## Prerequisites

- Claude Code CLI installed
- A separate test project to install BDK into (any language/stack)

## Workflow

1. Edit skills, agents, or hooks in this repo
2. Run `pnpm install` in this repo (its `prepare` script builds the bundle, the schemas and the adapters, which git does not track), then launch Claude Code from the test project with `claude --plugin-dir ~/projects/bdk`
3. Invoke the changed skill in the test project: `/bdk:<skill-name>`
4. Measure the change when it can move behaviour: `pnpm eval with-without --skill bdk:<name> --tasks <file>` (probe first; see `docs/guide/contributing/evals.md`)

Try skills in the test project, never in this repository: BDK's own repository does not exercise them the way a user project does. After a change to `STARTUP_INSTRUCTIONS.md`, `hooks/hooks.json` or a hook script, start a new session in the test project, so `SessionStart` runs again, and check that its output or side effects reflect the change; then run a skill that relies on the changed part.

---

## Adding a Skill

1. Create `skills/<group>/<name>/SKILL.md` (`stages`, `roles` or `tools`) with its two context lines, and add its entry to `kernel/src/ctx/use-cases/manifest.ts`
2. Keep it language-agnostic: no hardcoded tool names, paths or commands
3. Add its section to `docs/guide/reference/skills.md` and its entry to `README.md`
4. Measure it against its absence: a task file and `pnpm eval with-without --skill bdk:<name> --tasks <file>` (`docs/guide/contributing/evals.md`)
5. Review it with `/bdk-skill-kit:skill-authoring` and run `pnpm skill-check`

## Adding an Agent

1. Add the adapter to `bdk export agents` (`kernel/src/export/`); write it by hand only when it runs without the kernel, as `agents/web-researcher.md` does
2. Assign a model (`haiku` / `sonnet` / `opus`) based on task complexity
3. Name it in `docs/guide/reference/agents.md`
4. Run `pnpm skill-check`

## Skill Content Checks

`pnpm skill-check` runs [`bdk-skill-kit`](https://github.com/broneq/bdk-skill-kit) over `skills/` and `agents/`: the kit's rules with BDK's settings in `skill-check.config.ts`, which reads the kernel wrapper form from the kernel-cli spec. `pnpm skill-check --list-rules` prints every enforced rule. It runs in CI and in the pre-commit hook whenever a staged file is under `skills/` or `agents/`. It needs Node 22.18 or later, because the config is TypeScript.

`skill-check.baseline.json` suppresses the known findings of v2 content. It only shrinks: when you fix a baselined finding, `pnpm skill-check` reports the entry as stale, and `pnpm skill-check --baseline-prune` removes it. Never add entries to it; fix a new finding instead.

---

## Hooks

- `hooks/hooks.json` registers every hook; each command runs the kernel as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" hooks <event>`, or sources a script of `hooks/guard/` into `/bin/sh` first, so a tool call the guard lets through never starts Node.
- `kernel/tests/contract/hooks-file.test.ts` checks the file against the recorded host payloads; `pnpm test:perf` holds the guards to their latency budgets.

---

## Running Tests

The repository's tests are vitest projects: `unit`, `e2e`, `contract` and `perf` (the commands are in the Kernel section below). The repository needs no Python.

Tests mirror the layout of what they cover. A slice's tests sit in its `tests/` directory (`kernel/src/<slice>/tests/`); kernel-wide tests sit in `kernel/tests/`: the E2E harness, the contract tests (`kernel/tests/contract/`) that check the plugin's files (hooks, skills, agents, the host probe and its recorded payloads), and the documentation site guards (`kernel/tests/docs/`).

### Acceptance catalogue

The v3 design's test list lives as a table in the `acceptance-catalogue` spec (`openspec/specs/acceptance-catalogue/spec.md`): one row per item, with an ID (`S3`, `AC-1`, `TSH-7`, `NFR-LAT-2`, `R-15`) and its evidence (`test`, `perf`, `report <path>`, `accepted: <reason>` or `open #<issue>`). A test answers an item by carrying its ID in brackets in its own title or in an enclosing `describe` title, for example `it("a killed session resumes [AC-2] [TSH-7]", ...)`; one title may carry several IDs. A `test` item needs a title in `unit`, `e2e` or `contract`, a `perf` item one in `perf`.

- To add an item, add a row with the next free number of its section and title the tests that answer it. A dropped item stays as a row with `accepted` and the reason.
- `pnpm acceptance:report` writes `docs/V3-ACCEPTANCE.md`, the table with each item's tests. Rerun it and commit the file after retitling a test or editing the catalogue.
- `kernel/tests/contract/acceptance-catalogue.test.ts` fails on an item without its evidence, on a bracketed ID of a catalogue prefix that is not in the table, and on a report that differs from what the command writes now.

### Perf budgets

`pnpm test:perf` times the hooks and the kernel through the bundle. CI does not run it, and an endpoint security agent that intercepts every process start (common on work laptops) adds several milliseconds per exec, so measure in a Linux container:

```bash
docker run --rm -v "$PWD":/src:ro node:24-bookworm bash -c 'mkdir /work && cd /src && tar --exclude=./node_modules --exclude=./dist -cf - . | tar -C /work -xf - && cd /work && corepack enable && pnpm install --frozen-lockfile && pnpm test:perf'
```

`.git-blame-ignore-revs` lists the formatting commits; GitHub's blame reads it, and local `git blame` does after a one-time `git config blame.ignoreRevsFile .git-blame-ignore-revs`.

---

## Documentation Site

The user documentation is a VitePress site. The pages live in `docs/guide/` and the site's config in `docs/guide/.vitepress/` (`config.ts`, the sidebar in `sidebar.ts`, the Markdown options in `markdown.ts`, the theme with the Mermaid component); everything else under `docs/` stays off the site. VitePress and Mermaid are devDependencies, so `pnpm install` is the whole setup. Until T50 rewrites them for v3, the pages describe v2 and open with a banner that says so.

```bash
pnpm docs:dev       # local server with hot reload
pnpm docs:build     # static build; a dead link fails it
pnpm docs:preview   # serve the last build
pnpm test:contract  # includes the site guards in kernel/tests/docs/
```

The guards check that every user-invocable skill has a section in `reference/skills.md` and an entry in `README.md`, that every agent is named in `reference/agents.md`, that the sidebar lists exactly the pages in `docs/guide/`, that every page carries the v2 banner, that every `hooks/...` path named in prose exists, that every in-site link with an anchor names a heading of its target page, and that no page names a removed mechanism (the tool tiers, the v2 settings hook, a Python script or hook of BDK). The `docs.yml` workflow builds the site on every pull request and deploys it to GitHub Pages only from `main`; the repository's Pages source must be "GitHub Actions". The dev skill `docs-sync` (`.claude/skills/docs-sync/`) audits the pages against the code.

---

## Kernel (Node / TypeScript)

The v3 kernel lives in `kernel/`: sources in `kernel/src/` (one directory per slice plus `shared/`, see `openspec/specs/kernel-architecture/spec.md`), kernel-wide tests in `kernel/tests/`. esbuild bundles it into `dist/bdk.mjs`, the one file the plugin runs. Agents and skills start it through `bin/bdk`, a POSIX `sh` launcher that Claude Code puts on the Bash tool's `PATH`; hooks run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs"` because a hook's `PATH` lacks the plugin's `bin/` (`docs/HOST-FACTS.md`, `plugin-bin-*`).

Requires Node and pnpm. Use the Node version in `.nvmrc` (`nvm use`); any Node from 22.13.0 on works. pnpm comes from the `packageManager` field of `package.json` (`corepack enable`).

```bash
pnpm install          # also installs the git hooks (husky) and builds (the `prepare` script)
pnpm build            # rebuild dist/bdk.mjs, the generated schemas and the generated agents adapters
pnpm lint             # ESLint, type-aware
pnpm format           # Prettier over the whole repository (pnpm format:check to only check)
pnpm typecheck        # tsc --noEmit
pnpm knip             # unused files, exports and dependencies
pnpm test:unit        # unit tests from source, with coverage thresholds
pnpm test:e2e         # E2E tests through dist/bdk.mjs (builds first)
pnpm test:contract    # contract, structure, bundle and dependency tests (builds first)
pnpm test:perf        # wall-clock budgets (*.perf.ts) through dist/bdk.mjs; CI does not run them
```

- Generated files are never committed: `dist/`, the schemas `schema/settings.json`, `schema/pipeline.json`, `schema/state/`, `schema/cli/output/`, `schema/cli/common/{version,refusal}.json`, and the adapters `agents/{integrator,judge,lead,reader,reviewer,runner,scout,worker}.md`. `pnpm build` writes them, `.gitignore` covers them, and a contract test fails when a generated file is tracked or not ignored. Change the source (`kernel/src/`), not the output. The hand-written `schema/cli/commands.json`, `commands.schema.json` and `cli/common/list-page.json` stay tracked.
- A release publishes the generated files on the `release` branch, which the marketplace installs from, and tags that commit `dist-v<version>` (the settings schema URL of the modeline). `main` and `staging/v3` hold no bundle, so they cannot be installed from git; test an unreleased change with `claude --plugin-dir` after `pnpm install`. To publish a tag again, run the `release-please` workflow by hand with its `tag` input.
- The pre-commit hook formats and lints staged files; the commit-msg hook enforces Conventional Commits, which release-please reads. CI runs the same checks and does not rely on the hooks.
- Dependencies are pinned to exact versions. Runtime dependencies are limited to `zod` and `yaml`; a test fails on anything else.

---

## Modifying the Shared Foundation

`STARTUP_INSTRUCTIONS.md` is injected into every user session. Edit with care — it affects all skills and occupies context on every session start. Test in a fresh session after changes.

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** — project-specific domain rules (architecture layers, domain logic, etc.)
- **Plans** — generated per-project
- **Project-specific hooks** — drift detection, worktree setup, directory creation
- **Domain skills** — feature-specific workflows
- **Language-specific hooks** — Python formatters, Go linters tied to one stack

---

## Writing Fragments

A fragment is a Markdown file under `fragments/<capability>/` that a skill receives only when its condition holds. It is a prompt value, so a project can extend or replace it like a rule set.

### Creating a Fragment

1. Write `fragments/<capability>/<name>.md`; keep it self-contained and short.
2. Declare its prompt key `fragments/<capability>/<name>` in `kernel/src/ctx/config.ts`.
3. Add or extend the `fragment` part of the consuming skills in `kernel/src/ctx/use-cases/manifest.ts`, with the condition that picks it, and point the skill body to the section title.

No skill gets a new `!` line: every skill reads its context through its two context lines, which `kernel/tests/contract/skill-context.test.ts` checks.

Agents are static markdown with no shell execution at load time. A role agent gets its content through the kernel instead: its dispatch package is its whole prompt, and it reads its rules with `bdk rules show --ticket <ticket>`.
