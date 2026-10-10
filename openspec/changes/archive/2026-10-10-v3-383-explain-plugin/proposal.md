# Proposal

## Why

Tracks #383.

A question about how some code, a flow or a concept works gets a wall of terminal text today. A flow with several steps, a state machine or a parameter that changes a result reads far better as a picture you can step through. The third-party `explain-as` mod shows the idea, but it writes `.explain/` into the project (a dirty worktree) and previews through a terminal image pane that shows nothing inside Herdr; it also has no license, so nothing of it can be reused. BDK can ship the idea as a plain skill, admitted by evals like `bdk-craft` (archived Change `v3-207-bdk-craft-plugin`, design D3), under the rules of "Building skills (v3)" and "Target layout (v3)" in `CLAUDE.md` and ADR-0002.

## What Changes

- New plugin `plugins/bdk-explain/`: manifest, `README.md`, `LICENSE`, one skill `skills/explain/` (`/bdk-explain:explain`), and `evals/`. No hooks, no agents, no CLI, no `package.json`; it works without `bdk` and without `/bdk:setup`.
- The skill answers a question about the code, a flow or a concept with one self-contained HTML page: inline CSS and JS, no external resource, diagrams as inline SVG, step-through or controls where they help, legible in light and dark themes, the key picture in the first screen.
- The page goes to `.bdk/tmp/explain/<short-name>.html` in the current worktree; the skill creates `.bdk/tmp/.gitignore` holding `*` when missing, so `git status` stays clean and the project's `.gitignore` is never edited. The same name replaces the earlier page.
- The skill opens the page in the default browser (`open` on macOS, `xdg-open` on Linux) and replies with a two or three line summary and the path, never the HTML. When no browser can be opened it replies with the path only.
- Eval cases with and without the plugin; the skill ships only under the admission rule of `bdk-craft` (mean `Δ` at least `+0.10`, fired in at least half of the with-arm runs), recorded in `plugins/bdk-explain/evals/RESULTS.md`.
- Release and install wiring: `.claude-plugin/marketplace.json`, `release-please-config.json`, `.release-please-manifest.json`.
- The workspace test of `bdk-craft` (`tests/craft-skills.test.ts`) becomes the test of every plain-skill plugin admitted by evals and covers `bdk-explain` too; `tests/eval-suites.test.ts` gets the grants of the new suite.

**Resolved from the issue's "To resolve in the spec"** (details in design.md):

- Old pages are not cleaned by age: the skill never deletes a page; a name is reused for the same topic, and the whole directory is ignored scratch the user may delete at any time (design D4).
- `.bdk/tmp/` is the shared scratch directory of BDK plugins: a plugin that writes throwaway files writes them under `.bdk/tmp/<tool>/` and keeps `.bdk/tmp/.gitignore` with `*`. The Guide names it (design D5).
- When the browser cannot be opened (no display, a remote session, an unknown platform, or the command fails), the skill replies with the path only and does not retry (design D3).

## Capabilities

### New Capabilities
- `explain-plugin`: the `bdk-explain` plugin - what `/bdk-explain:explain` produces, where it writes, how it opens the page and replies, and how its skill is admitted by evals.

### Modified Capabilities
- `docs-site`: the Reference section lists `bdk-explain` among the plugins it holds a section for.

## Impact

- New: `plugins/bdk-explain/**`, `docs/guide/explain.md`, `docs/reference/bdk-explain.md` (generated).
- Changed: `.claude-plugin/marketplace.json`, `release-please-config.json`, `.release-please-manifest.json`, `tests/craft-skills.test.ts` (renamed `tests/admitted-skills.test.ts`), `tests/eval-suites.test.ts`, `docs/.vitepress/sidebar.ts`, `docs/reference/index.md`, `CLAUDE.md` ("Current state").
- User docs: new Guide page `docs/guide/explain.md`; `docs/guide/index.md` (plugin table) and `docs/guide/install.md` (plugin list) name the plugin; `docs/guide/footprint.md` names the `.bdk/tmp/` scratch directory. No Concepts page or diagram draws this plugin, so none is redrawn.
- Paid model calls, local only: one with/without run of the suite.
- Out of scope: any use of the skill by `bdk` orchestrators; a screenshot step or an in-terminal preview; other output formats than HTML.
