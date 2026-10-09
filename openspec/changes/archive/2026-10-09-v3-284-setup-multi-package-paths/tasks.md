# Tasks

## 1. Evals first

- [x] 1.1 Create `plugins/bdk/evals/setup-multi-package/` (`case.yaml`, `prompt.md`, `scaffold.sh` with `api/` uv+pytest+ruff and `web/` pnpm+vitest+eslint, graders including one that runs `bdk check run --scope web/src/a.tsx` logic via glob checks on the written `paths`); add a "no `paths`" grader to `setup-web-app`; run the free eval load check and verify the new case loads
- [x] 1.2 Probe the case against the current skill (one run, no plugin ablation) and record that it fails on `paths`

## 2. Skill

- [x] 2.1 With `/skill-creator`, add "Paths in a repository of several packages" to `plugins/bdk/skills/setup/references/stacks.md` and the matching lines to steps 2 and 4 of `SKILL.md`; run skill-check

## 3. Verify with the eval

- [x] 3.1 Run `setup-multi-package` and `setup-web-app` (3 runs); record results in the PR; if it fails, fix the skill text, not the CLI

## 4. Docs

- [x] 4.1 Update `docs/guide/configuration.md` (monorepo example: `/bdk:setup` writes the `paths`) and `docs/guide/first-run.md` if it lists what setup detects
- [x] 4.2 Run `pnpm docs:reference`

## 5. Gates

- [x] 5.1 Run every check CI runs (`.github/workflows/`), `openspec validate v3-284-setup-multi-package-paths --strict` and `openspec validate --specs --strict`
