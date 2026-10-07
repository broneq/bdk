# Tasks

## 1. Plugin skeleton and wiring

- [x] 1.1 Write `tests/craft-skills.test.ts` first: plugin shape (manifest fields, no `package.json`, hooks, agents or `bin/`), marketplace entry, release component, and the `RESULTS.md` rules of design D7; run `pnpm test` and see it fail because `plugins/bdk-craft` does not exist
- [x] 1.2 Create `plugins/bdk-craft/.claude-plugin/plugin.json` (version `0.1.0`, release-please layout), `README.md`, `LICENSE`; add `plugins/bdk-craft` to `release-please-config.json` and `.release-please-manifest.json`, the `bdk-craft` entry to `.claude-plugin/marketplace.json`; `plugins/*/evals/results/` is ignored by the root `.gitignore` (#189); verify with `claude plugin validate plugins/bdk-craft --strict` and `claude plugin validate .claude-plugin/marketplace.json --strict`

## 2. Eval cases (before any skill text)

- [x] 2.1 Write three cases each for `tdd`, `debugging` and `refactoring` with scaffold scripts (`node --test` workspace) and transcript graders (design D4, D5); verify every case loads and its scaffold runs with one `--ablation none --runs 1` trial per skill
- [x] 2.2 Write three cases each for `testing-strategy`, `api-design`, `oop-design`, `modularizing` and `mermaid-drawer` with reply graders (design D4); verify every case loads with one `--ablation none --runs 1` trial per skill

## 3. Skills, written with /skill-creator

- [x] 3.1 Write `tdd`, `debugging` and `refactoring` with `/skill-creator` from the draft material; verify each with `bdk-skill-kit` skill-check guidance and `claude plugin validate plugins/bdk-craft --strict`
- [x] 3.2 Write `testing-strategy`, `api-design`, `oop-design`, `modularizing` and `mermaid-drawer` (with its recipes reference) with `/skill-creator`; verify the same way
- [x] 3.3 Try one skill in a separate test project started with `claude --plugin-dir plugins/bdk-craft` (never inside this repository) and verify it triggers on a natural request

## 4. Measurement and admission

- [x] 4.1 Run the full suite with and without the plugin (`claude plugin eval plugins/bdk-craft --scaffold --allow-tools ... --model claude-opus-5-5 --judge-model claude-sonnet-5-5 --no-publish --json ...`); check every run for errors such as rate limits or timeouts and re-run affected cases before using the numbers
- [x] 4.2 Apply the admission rule (design D3) per skill; delete each rejected skill and its cases; write `plugins/bdk-craft/evals/RESULTS.md`; fill design.md "Outcome"; update the plugin `README.md` skill table to the admitted skills; verify `pnpm test` passes

## 5. Acceptance and gates

- [x] 5.1 Check the acceptance signal end to end: every directory under `plugins/bdk-craft/skills/` has an `admitted` row with mean `Δ` at least `+0.10` and a fired rate of at least half
- [x] 5.2 Run every check CI runs (`pnpm check`, `claude plugin validate --strict` on the marketplace and every plugin, commitlint on the commit), `openspec validate v3-207-bdk-craft-plugin --strict` and `openspec validate --specs --strict`; fix every failure
