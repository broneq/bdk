## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T32. Tracks #59 (https://github.com/broneq/bdk/issues/59). Depends on T30, T31, T42 and T04 (all closed).

The hard cut of Q1 ("Migration (Q1)") promises a plugin without Python. Earlier tasks already removed most of it: the meta-skills and v2 agents (T42), `check-bdk-config` and the settings readers (T12), the injection scripts (T13), the MCP servers (T04), `check-rules-drift`. What is left still keeps a Python toolchain alive in the repository: four `.py` files, a pytest suite, a ruff and pytest CI job, `pyproject.toml` and `uv.lock`, and the documentation site, which builds with MkDocs Material through `uv`. Material for MkDocs is in maintenance mode, with its end of life on 2027-05-05, so the site needs a new engine anyway. Two migration defects from "Defects found on the way" also still reach v2 users. A v2 project keeps the `/.bdk/` ignore rule that v2's `ensure_ignored()` wrote, which hides the files v3 commits. `bdk doctor` reports only three of the five v2 paths that `/bdk:setup` deletes.

## What Changes

- **Python files removed.** `scripts/bdk_run_state.py`, `scripts/sentinel-echo.py`, `hooks/is-command-exists/` (the kernel's `hooks skill-exists` replaced it), `tests/unit/` (pytest), `pyproject.toml`, `uv.lock`; the `tests/evals/` legacy evals and `.claude/rules/skill-test-eval.md` (replaced by `evals/`, T40); `.claude/rules/script-tests.md` (pytest conventions for scripts that no longer exist).
- **Tests that still guard something are ported, not dropped (D5).** The `tests/host-probe/collect.mjs` anonymisation tests and the leak guard over `tests/fixtures/host-payloads/` move to a vitest contract test. The `web-researcher` tool allowlist moves into the plugin layout contract test. The `bdk_run_state.py` and `is-command-exists` tests go with their subjects.
- **CI without Python.** The `pytest` job (ruff lint, ruff format, pytest) is removed from `tests.yml`, `pnpm lint:py` from `package.json`, and `uv` from knip's binaries.
- **Documentation site on VitePress (decided with the user, 2026-10-05).** MkDocs Material (`mkdocs.yml`, the `docs` dependency group) is replaced by VitePress as a pnpm devDependency, configured in `docs/guide/.vitepress/`. The page content stays as it is, and T50 rewrites it for v3. The syntax is converted where the engines differ: admonitions, the `CHANGELOG.md` and `CONTRIBUTING.md` includes, mermaid. The drift guards read the sidebar of the VitePress config instead of the mkdocs `nav`. A new guard checks in-page anchors, which VitePress's dead-link check does not cover. The docs workflow builds with pnpm and deploys through GitHub Pages actions, still only from `main`.
- **v2 migration fixes.** `/bdk:setup` replaces a v2 rule that ignores `.bdk/` as a whole with the two v3 ignored paths, after asking. `bdk doctor` gains a `bdk-ignored` finding when git ignores `.bdk/settings.yaml`. The v2 layout markers grow from three to the five paths that setup deletes (`.bdk/design/`, `.bdk/verify-plan/` added).
- **BDK repository hygiene.** The root `.gitignore` swaps `/.bdk/` for the two v3 paths and drops the Python and MkDocs entries. `/.lavish/` stays (user decision). `.prettierignore` drops the Python and `tests/evals` entries. `docs/INJECTION-FLOWS.md` is deleted (decided with the user; git history keeps it). The docs-sync map loses its rows for deleted files.
- **Documentation.** `README.md` gains the installation section with the Node requirement, and its v3 pipeline and skills table are checked against T41 and T42. `CLAUDE.md` (Architecture, Development Commands) and `CONTRIBUTING.md` (Running Tests, Documentation Site, Hooks) are updated. The `docs/guide/` pages stop naming deleted files while they keep the v2 banner until T50.
- **Version 3.0.0 via release-please, no hand edit.** `staging/v3` already carries breaking commits (`feat!:` in T12, `refactor(skills)!:` in T41), so release-please proposes 3.0.0 for `bdk` on the merge into `main`. T32 checks this and does not edit `plugin.json` or `CHANGELOG.md`.
- **#39 closed.** `features.caveman` is already refused as a removed key with the reason "no consumer in v3 (#39)" (T12, `kernel/src/shared/config/known.ts`). `fix/38` and `fix/39` no longer exist on the remote. T32 closes #39, naming that state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-tooling`: "Unit suite green after the removal" (pytest) is replaced by a vitest requirement. A new requirement covers the repository without Python: no `python3` in `hooks/` or `skills/`, no tracked `.py`, no `__pycache__`, no `pyproject.toml` or `uv.lock`. The ported guards are named there.
- `kernel-architecture`: CI pipeline loses the Python job and its scenario.
- `docs-site`: Site location, Strict build, Drift guards, v2 banner and Deploy move from MkDocs Material to VitePress; the docs-sync skill runs no pytest.
- `kernel-cli/service`: `bdk doctor` reports five v2 markers and the new `bdk-ignored` finding.
- `stage-skills`: "setup migrates a v2 project" replaces the v2 `.bdk/` ignore rule.
- `skill-evals`: "Retirement of tests/evals" is removed with the directory.
- `craft-skills`: "The v2 craft skills leave bdk" no longer exempts `tests/evals/`, which is gone.

## Impact

- Deleted: `scripts/`, `hooks/is-command-exists/`, `tests/unit/`, `tests/evals/`, `pyproject.toml`, `uv.lock`, `mkdocs.yml`, `docs/INJECTION-FLOWS.md`, `.claude/rules/script-tests.md`, `.claude/rules/skill-test-eval.md`.
- Kernel: `kernel/src/config/domain/layout.ts` (markers), `kernel/src/service/` (doctor check, schema example), tests; `kernel/tests/docs/` (site reader, nav, anchors, banner syntax), `kernel/tests/contract/` (host probe, agent tools).
- Content: `skills/stages/setup/references/v2-migration.md`, `skills/stages/setup/SKILL.md` where it lists the migration steps; `docs/guide/**` (syntax and stale paths), `docs/guide/.vitepress/`.
- Tooling: `package.json` (VitePress devDependencies, `docs:build`, no `lint:py`), `pnpm-lock.yaml`, `.github/workflows/tests.yml`, `.github/workflows/docs.yml`, `knip.json`, `tsconfig.json`/`eslint.config.mjs` (the site config), `.gitignore`, `.prettierignore`, `.claude/skills/docs-sync/references/docs-map.md`.
- Docs: `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/adr/0001-remove-bundled-mcp-servers.md` (the T32 checklist item), `docs/HOST-FACTS.md` and `tests/host-probe/CHECKLIST.md` (the leak check command), `.claude/rules/artifacts.md` (the kernel owns `.bdk/`; the v2 run state paragraph goes).
- Repository setting: GitHub Pages source must be "GitHub Actions" before the first deploy from `main`; T32 notes it and does not change it, since the first deploy is the 3.0 release (T50).
- Out of scope: the v3 rewrite of the site pages and of `README.md` (T50); the 3.0.0 release itself and `bdk-craft`'s version (T50); `.claude/rules/` reduced by the T31 admission test (T50).

## Decisions

Resolved from the "To resolve in the spec" list of T32; design.md gives the rationale.

1. **`.bdk/verify-plan/` and `.bdk/runs/`: report.** In a user project both are v2 markers that `bdk doctor` reports as `v2-layout`, and `/bdk:setup` deletes them after asking. Nothing ignores them: v3 ignores only `/.bdk/.machine/` and `/.bdk/settings.local.yaml` (`kernel-state`, Ignored paths). In the BDK repository they do not exist, and its `.gitignore` gets the two v3 paths.
2. **`docs/INJECTION-FLOWS.md`: deleted.** It analyses the v2 Python injection, which T13 replaced. `docs/` holds only temporary material, and git history keeps the file.
3. **Site engine: VitePress, inside T32** (user decision 2026-10-05 after comparing MkDocs Material, VitePress, Starlight and Docusaurus).
