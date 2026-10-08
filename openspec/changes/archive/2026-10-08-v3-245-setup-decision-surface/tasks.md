# Tasks

## 1. Eval cases first

- [x] 1.1 Add a `lavish-axi` stand-in that answers `--version` (exit 0) to `plugins/bdk/evals/setup-web-app/scaffold.sh`, and an `llm` grader `decision-surface.md` that passes when the reply says questions and triage use a Lavish page. Verify: `pnpm test` loads the case.
- [x] 1.2 Add a failing `lavish-axi` stand-in (exit 1) to `plugins/bdk/evals/setup-library/scaffold.sh`, and an `llm` grader `decision-surface.md` that passes when the reply says questions and triage use `AskUserQuestion` and suggests installing `lavish-axi`. Verify: `pnpm test` loads the case.
- [x] 1.3 Update the `setup-*` paragraph of `plugins/bdk/evals/README.md` to name the stubs. Verify: the paragraph names both stubs and the grant list still covers `npx`.

## 2. Setup skill

- [x] 2.1 Rebuild `plugins/bdk/skills/setup/SKILL.md` with `/skill-creator`: step 9 runs `npx -y lavish-axi --version` and the report names the decision surface (both wordings from the spec); add `Bash(npx -y lavish-axi --version)` to `allowed-tools`. Verify: `claude plugin validate plugins/bdk --strict` passes and the frontmatter parses.
- [x] 2.2 Try `/bdk:setup` in a separate test project started with `claude --plugin-dir`, once with the passing stub and once with the failing stub, or run the two eval cases. Verify: each report holds the matching line.

## 3. Docs

- [x] 3.1 Describe the decision surface report in `docs/guide/first-run.md` ("What setup does") and the `/bdk:setup` flow in `docs/concepts/orchestrators.md`; regenerate the Reference with `pnpm docs:reference`. Verify: `pnpm check` passes the docs name and staleness checks.

## 4. Gates

- [x] 4.1 Check the Acceptance signal end to end: run `setup-web-app` and `setup-library` (one run, one arm is enough to confirm the graders) and record the result for the PR.
- [x] 4.2 Run every check CI runs (`.github/workflows/`, `pnpm check`), `openspec validate v3-245-setup-decision-surface --strict` and `openspec validate --specs --strict`. Verify: all pass.
