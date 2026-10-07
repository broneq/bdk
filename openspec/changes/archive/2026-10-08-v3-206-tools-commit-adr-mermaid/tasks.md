# Tasks

## 1. Eval cases first

- [x] 1.1 Write `plugins/bdk/evals/commit-commitlint-types`, `commit-unstaged-secrets`, `commit-unrelated-changes` (prompt, `case.yaml`, `scaffold.sh`, graders per design D9); verified by the free check `pnpm exec vitest run plugins/bdk/tests/evals.test.ts` loading them and running their scaffolds
- [x] 1.2 Write `plugins/bdk/evals/adr-fresh-madr`, `adr-supersede-house-format`, `adr-from-change` the same way; verified by the same free check
- [x] 1.3 Probe one case per tool without the skill (`--runs 1 --ablation none` against a plugin without the skills, or a plain `claude -p` in a scaffolded copy outside this repository) to see the graders fail where the plain model differs and that `git commit` works inside the Bash sandbox; fix graders that fail for a correct answer

## 2. The skills

- [x] 2.1 Build `plugins/bdk/skills/commit/SKILL.md` with `/skill-creator` (design D2-D5); verified by `bdk-skill-kit:skill-check` with no finding
- [x] 2.2 Build `plugins/bdk/skills/adr/SKILL.md` and `references/madr-template.md` with `/skill-creator` (design D2, D6-D8); verified by `bdk-skill-kit:skill-check` with no finding
- [x] 2.3 Add the tool cases, their grants and run commands to `plugins/bdk/evals/README.md`; narrow the `bdk config show` sentence in `docs/design/2026-10-07-v3-architecture.md` (design D2); add the skills to the plugin list in `CLAUDE.md`; verified by `claude plugin validate plugins/bdk --strict` and `pnpm check`

## 3. Measure

- [x] 3.1 Run each skill in a separate test project outside this repository with `claude -p ... --plugin-dir plugins/bdk` (commit: commitlint project, unstaged with secrets, a failing `pre-commit` hook; adr: fresh project, Change decision) and fix the skill until the observed behaviour matches the spec
- [x] 3.2 Run the six cases with and without the plugin, 3 runs per arm, pinned models (`--model claude-opus-5-5 --judge-model claude-sonnet-5-5`); fix a broken case before using its numbers; record WITH, W/OUT, Δ, fired count, cost and versions in design.md "Outcome"

## 4. Acceptance and gates

- [x] 4.1 Check the acceptance signal: every tool has an eval case (`commit-*`, `adr-*` in `plugins/bdk/evals/`, `mermaid-drawer-*` in `plugins/bdk-craft/evals/`)
- [x] 4.2 Run every CI check (`.github/workflows/`: `pnpm check` and the plugin validations), `openspec validate v3-206-tools-commit-adr-mermaid --strict` and `openspec validate --specs --strict`
