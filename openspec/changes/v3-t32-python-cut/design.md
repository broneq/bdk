## Context

See proposal.md, Why. The state this design starts from, checked on `staging/v3` (bf7d25c6):

- Python left in git: `scripts/bdk_run_state.py` (read by no skill, hook or kernel code; only docs, the docs-sync map and its own tests name it), `scripts/sentinel-echo.py` (a v2 injection probe), `hooks/is-command-exists/check.py` (registered by no hook and no skill frontmatter; `bdk hooks skill-exists` replaced it in T13), and four pytest files under `tests/unit/`.
- `pyproject.toml` holds three dependency groups: `dev` (pytest), `lint` (ruff) and `docs` (mkdocs-material). The `docs` group is the only one that outlives the scripts. `pnpm docs:build` and `.github/workflows/docs.yml` run MkDocs through `uv`.
- The site: 24 pages under `docs/guide/`, 42 `!!!` admonitions, 3 mermaid fences, two pages that are only a `--8<--` snippet (`CHANGELOG.md`, `CONTRIBUTING.md`), 32 links with an anchor. `kernel/tests/docs/site.ts` parses `mkdocs.yml` for the nav (with a custom YAML tag for the Python mermaid callable) and recognises snippet pages by `--8<--`.
- Already done by earlier tasks, so T32 only records them: `ensureIgnored` (T20, `kernel/src/shared/store/ignore.ts`), `features.caveman` refused as a removed key (T12), the meta-skills and v2 agents gone (T42), `STARTUP_INSTRUCTIONS.md` rendered by `bdk ctx startup` (T13, T42), no tracked `__pycache__`, no `fix/38` or `fix/39` branch on the remote, and breaking commits on `staging/v3` for release-please.
- v2 projects: v2's `ensure_ignored()` appended `/.bdk/` to the project `.gitignore`. v3's `ensureIgnored` skips a path that a rule already covers, so in a v2 project it adds nothing, and the v3 files meant for git (`.bdk/settings.yaml`, `.bdk/changes/`, `.bdk/rules/`) stay ignored. `V2_MARKERS` holds three paths, while `v2-migration.md` deletes five.

## Goals / Non-Goals

**Goals:**

- No Python toolchain needed to develop, test, build or document BDK.
- Every guard that protects a file that still exists keeps running, in vitest.
- The docs site builds and is checked at least as strictly as under MkDocs `--strict`.
- A v2 project that runs `/bdk:setup` ends with `.bdk/` committed as v3 expects.

**Non-Goals:**

- Rewriting page content for v3, removing the v2 banners, restyling the site (T50).
- A custom VitePress theme beyond what mermaid needs.
- Changing `kernel-state`, Ignored paths: the two v3 paths stay as they are.

## Decisions

### D-1 Delete the Python files instead of porting them

`bdk_run_state.py` is v2 run state that the v3 ledger and `bdk part` / `bdk commit` replaced (T20, T22). It has no caller left. `sentinel-echo.py` and `is-command-exists/check.py` have no caller either. Deleting them removes their tests too.

- Alternative: port `is-command-exists` to the kernel. It lost because `bdk hooks skill-exists` already covers the only v3 need (a missing companion skill), and no skill checks for a system binary.

### D-2 Port the two live guards into the `contract` project

`kernel/tests/contract/host-probe.test.ts` runs `node tests/host-probe/collect.mjs` in a temp directory with the same environment the pytest helper set (`HOME`, `PROBE_OUT`, `PROBE_PROJECT`, `BDK_FIXTURES`). It carries over the eight collector cases and the leak guard: the parametrised positive and negative texts, and every committed fixture. The guard reads the running user's name from `os.userInfo().username`. The `web-researcher` allowlist becomes one assertion in `plugin-layout.test.ts`, which already lists the shipped agents. It parses the frontmatter with `yaml`, which replaces the hand-rolled parser.

- Alternative: the `unit` project. It lost because these tests read repository files and spawn a script outside `kernel/src/`; `contract` is where repository-wide guards live (vitest config comment), and `unit` coverage counts only `kernel/src/`.

### D-3 VitePress 1.6.x, source dir `docs/guide/`

The config lives in `docs/guide/.vitepress/config.ts` and runs with `vitepress build docs/guide`. `base: "/bdk/"` keeps the GitHub Pages URL of `site_url`, `editLink` keeps `edit_uri`, `appearance` gives the light and dark switch, `search.provider: "local"` replaces the search plugin, and `ignoreDeadLinks` stays `false`. Versions are pinned exact, as for every dependency. The site files are all devDependencies, so `pnpm audit --prod` and the runtime dependency test are unaffected.

- Alternatives (compared with the user on 2026-10-05): stay on MkDocs Material (Python, end of life 2027-05-05), Zensical (the MkDocs successor, still Python), Starlight (0.x, heavier Astro stack), Docusaurus (MDX breaks on prose with `<` and `{`, React and a bundler). VitePress has the smallest conversion and a stable major.
- 2.0 is still alpha (2.0.0-alpha.20, 2026-09-04), so 1.6.x it is. Moving to 2.0 is a dependabot bump once it is stable.

### D-4 The sidebar lives in its own data module

`docs/guide/.vitepress/sidebar.ts` exports the sidebar as plain data. `config.ts` imports it, and so does the nav guard in `kernel/tests/docs/site.ts`. The guard therefore never loads VitePress or Vite.

- Alternative: import `config.ts` in the test. It lost because it would pull VitePress into the contract run and tie the guard to the config's other imports.
- The top-level nav sections (Getting started, Workflows, Concepts, Reference) map to sidebar groups; `navigation.tabs` maps to `themeConfig.nav` with one entry per group.

### D-5 Syntax conversion, mechanical and checked

- `!!! <type> "<title>"` with a four-space indented body becomes `::: <type> <title>`, the body unindented, and `:::`. MkDocs `note` and `warning` map to VitePress `info` and `warning`. The conversion is a one-off script in the scratchpad, not committed, and its result is reviewed through the built site.
- `--8<-- "CHANGELOG.md"` becomes `<!--@include: ../../CHANGELOG.md-->`, and the same for `CONTRIBUTING.md`. `isSnippetPage` recognises the include form instead. Links inside the included files that point at repository paths are checked by the build. Each one that does not resolve on the site becomes an absolute GitHub URL in the source file. `CHANGELOG.md` is never edited by hand, so a dead link in it goes to `ignoreDeadLinks` as an explicit pattern instead.
- The banner text stays the same; only its container syntax changes, in the pages and in `banner.test.ts`.

### D-6 Mermaid through a local component, no plugin

A `markdown.config` hook in `config.ts` turns a `mermaid` fence into a `<Mermaid>` component with the encoded source. The component, in `docs/guide/.vitepress/theme/`, extends the default theme, imports `mermaid` on the client only, and renders again when the theme switches between light and dark.

- Alternative: `vitepress-plugin-mermaid`. It lost because its last release is from 2024, and it wraps the whole config. The component is about 30 lines with one direct dependency (`mermaid`).

### D-7 Anchor guard with VitePress's own slug function

VitePress's dead-link check ignores anchors, and MkDocs strict mode is what the spec promised. A new contract test collects the headings of each page (explicit `{#id}` first, otherwise the slug from `@mdit-vue/shared`'s `slugify`, the function VitePress uses) and checks every `[...](page.md#anchor)` and `[...](#anchor)` link. `@mdit-vue/shared` becomes a pinned devDependency, so knip sees a declared import.

- Alternative: a link-checker over the built HTML (for example `linkinator`). It lost because it needs a build in the contract run and adds a crawler for 32 links.

### D-8 Docs workflow on pnpm and GitHub Pages actions

Both jobs use `pnpm/action-setup` and `actions/setup-node` with `.nvmrc`, `pnpm install --frozen-lockfile` and `pnpm docs:build`. The deploy job uploads `docs/guide/.vitepress/dist` with `actions/upload-pages-artifact` and publishes it with `actions/deploy-pages` (`pages: write`, `id-token: write`, environment `github-pages`), still only on a push to `main`.

- Alternative: keep the `gh-pages` branch with a push action. It lost because the official Pages actions need no branch and no bot identity. The repository's Pages source must be "GitHub Actions" before the first deploy, which is the 3.0 release (T50). T32 records that and does not change the setting.

### D-9 `bdk doctor`: two more markers and `bdk-ignored`

`V2_MARKERS` gains `.bdk/design/` and `.bdk/verify-plan/`, in the order of `v2-migration.md`. `hooks session-start` reads the same list, so it reports them too. The new check runs `git check-ignore --no-index --verbose .bdk/settings.yaml` through the service slice's git port, and only when `.bdk/` exists in a git work tree. Exit 0 means the file is ignored, and the verbose line gives the source file and the pattern for the summary. Without git the check is skipped, as the ignore helper does.

- Level `fail`, not `warn`: the outcome is silent loss. A Change's committed files never reach git and the team never sees the settings, whereas `v2-layout` only leaves stale files.
- Alternative: make `ensureIgnored` remove the v2 rule itself. It lost because the kernel would edit a user-owned ignore rule without asking. The fix is a confirmed step of `/bdk:setup`, which already owns the v2 migration (`stage-skills`).

### D-10 `/bdk:setup` replaces the rule before writing settings

The step goes into `references/v2-migration.md` and runs whenever doctor reports `bdk-ignored`, so it also covers a project whose v2 files are already gone. It runs before the first `bdk config set`, because `ensureIgnored` would otherwise see both v3 paths covered by `/.bdk/` and add nothing. The skill removes only the matched rule line, adds whichever of the two v3 paths no rule covers, and commits `.gitignore` alone (`chore(bdk): replace the v2 .bdk/ ignore rule`).

### D-11 Repository files

- `.gitignore`: `/.bdk/` becomes `/.bdk/.machine/` and `/.bdk/settings.local.yaml`; drop `__pycache__/`, `*.pyc`, `*.pyo`, `tmp_*.py` and `/site/`; add `docs/guide/.vitepress/dist/` and `docs/guide/.vitepress/cache/`. A leftover local `.bdk/tmp/` from the removed rules-drift hook becomes visible to `git status`, which is correct: it is v2 residue to delete locally.
- `.prettierignore`: drop `tests/evals/**/iterations/`, `.pytest_cache/` and `.venv/`; add the VitePress output and cache.
- `.git-blame-ignore-revs` keeps its ruff commits: blame still walks that history.
- `knip.json`: drop `uv` from `ignoreBinaries`; point knip's VitePress plugin at `docs/guide/.vitepress/config.ts` if it does not find it itself.
- `tsconfig.json`: include `docs/guide/.vitepress/**/*.ts` so `pnpm typecheck` covers the config, the sidebar and the theme. `eslint.config.mjs`: lint the same files.

### D-12 Version 3.0.0 is checked, not written

`plugin.json` and `.github/.release-please-manifest.json` stay at 2.7.0 on `staging/v3`. release-please computes 3.0.0 from the `!` commits once `staging/v3` reaches `main`. T32 verifies that `git log origin/main..HEAD` holds at least one breaking commit, and that the T32 commit removing the Python files is itself marked `!` with a `BREAKING CHANGE:` footer naming the removed scripts.

## Risks / Trade-offs

- [VitePress 1.6.x stands on Vite 5 and has had no release since 2025-08] → Only the build uses it, the output is static, and `pnpm audit --prod` does not cover it. Dependabot's monthly group shows advisories, and the move to 2.x is a planned bump. A high advisory in the dev tree gets a pnpm `overrides` pin.
- [Converted admonitions or includes render wrong even though the build passes] → Every page of the built site is checked in a browser once (light and dark), as for any UI change, and the anchor guard covers the links.
- [The anchor slug differs from what VitePress renders, for example on headings with code or punctuation] → The guard uses VitePress's own `slugify` and honours `{#id}`. A test case pins one heading with backticks and one with punctuation.
- [Contributors with a local `.venv/`, `.pytest_cache/`, `.ruff_cache/` see them as untracked once the ignore entries go] → Those directories ignore themselves through their own `.gitignore` files, which uv, pytest and ruff write. CONTRIBUTING says they can be deleted.
- [The first deploy fails if the Pages source is still "Deploy from a branch"] → Recorded in the tasks and in the T50 hand-off; the build job is unaffected.

## Migration Plan

One PR into `staging/v3`, commits in task-group order, so each commit keeps `pnpm test:contract` green. The VitePress switch lands as a single commit, with config, conversion, guards and workflow together. Rollback is a revert of the PR. Nothing is published before 3.0, so no user sees an intermediate state.
