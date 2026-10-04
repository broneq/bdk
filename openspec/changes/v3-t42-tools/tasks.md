# Tasks

## 1. Contract test first

- [x] 1.1 Write `kernel/tests/contract/tools-skills.test.ts`, one `describe` per requirement of the `tools-skills` spec, with every scenario as a test. Run it and see it fail on the missing skills and the v2 directories still present.

## 2. commit

- [x] 2.1 Write `skills/tools/commit/SKILL.md` (D1):
  - frontmatter: description, argument hint, `allowed-tools` (the kernel pair, `AskUserQuestion`, `Read`, `Bash(git status *)`, `Bash(git diff *)`, `Bash(git log *)`, `Bash(git add *)`, `Bash(git commit *)`), `disallowed-tools: Edit Write NotebookEdit`; no `hooks`, no `model`;
  - body: the context lines, then the convention sources in order, the staging rule, the hook rule, and the boundary with `bdk commit`.
- [x] 2.2 Delete `skills/commit/`. Add `commit: []` to `SKILL_CONTEXT`.
- [x] 2.3 In `.claude/rules/skills.md`, drop the pointer to `skills/commit/SKILL.md` as the `skill-exists` example and keep the mechanism (D2).

## 3. docs

- [x] 3.1 Write `skills/tools/docs/references/document-shape.md`: the sections, the prototype example rules, and the Mermaid rules the skill needs. Take them from `explain-complex-code` and its `documentation-template.md`, without the `/bdk:mermaid-drawer` link.
- [x] 3.2 Write `skills/tools/docs/SKILL.md`:
  - mode from the argument;
  - the refresh flow (compare, plan, ask, rewrite as uniform text);
  - the create flow (read in the main thread, the 30-file threshold, `docs/architecture/<module>.md`);
  - "Done when" against the shape.

  No `Stop` hooks (D3-D5). Add `docs: []` to `SKILL_CONTEXT`.

- [x] 3.3 Delete `skills/update-docs/` and `skills/explain-complex-code/`. Update the `pyproject.toml` comment that names `examples.md`, or the ruff setting it explains when nothing else needs it.

## 4. rules

- [x] 4.1 Write `skills/tools/rules/SKILL.md` (D6, D7):
  - modes `audit` (the default), `capture <lesson>` and `check`;
  - the admission test cited from `rules/README.md`;
  - adoption only through `bdk rules accept --from`;
  - removal as an approved `removed` edit, followed by `bdk rules check` and `bdk rules export --claude`;
  - `allowed-tools`: the kernel pair, `Read`, `Edit`, `AskUserQuestion`, `Bash(lavish-axi *)`.

  Add `rules: [decision]` to `SKILL_CONTEXT`.

- [x] 4.2 Delete `skills/add-rule/` and `skills/refine-rules/` with their references and scripts, `tests/unit/skills/refine-rules/`, and `tests/evals/skills/{add-rule,refine-rules}/`.

## 5. adr

- [x] 5.1 Write `skills/tools/adr/references/madr-template.md` from the template in `create-adr`.
- [x] 5.2 Write `skills/tools/adr/SKILL.md` (D8):
  - the two inputs, the entry read through `bdk log show <id> --json`;
  - the numbering under `docs/adr/`, the questions it may ask, `Rules: architecture`;
  - `allowed-tools`: the kernel pair, `Read`, `Write`, `AskUserQuestion`, `Bash(ls *)`.

  Rename the `create-adr` entry of `SKILL_CONTEXT` to `adr`.

- [x] 5.3 Delete `skills/create-adr/`.

## 6. doctor and bdk-cli

- [x] 6.1 Write `skills/tools/doctor/SKILL.md` (D9): `disable-model-invocation: true`, the two-tier repair flow, the closing report. Add `doctor: []` to `SKILL_CONTEXT`.
- [x] 6.2 Write `skills/tools/bdk-cli/SKILL.md` (D10): `metadata.fronts-cli: bdk`, at most 30 lines, no context lines.

## 7. Kernel tests, baseline and docs

- [x] 7.1 Refresh the `ctx skill` snapshot (`kernel/tests/contract/__snapshots__/ctx-skill-output.test.ts.snap`) with `--update` after checking that the diff covers only the new and removed entries.
- [x] 7.2 Run `pnpm skill-check --baseline-prune`, then `pnpm skill-check`. Check that the baseline lost exactly the entries of the removed files and of `skills/commit/`.
- [x] 7.3 Update every place that names a removed skill:
  - `README.md`: Skills table rows for the six skills, and the Removed skills table with each replacement;
  - `STARTUP_INSTRUCTIONS.md`: Capture Conventions now names `/bdk:rules`;
  - `CONTRIBUTING.md`, `CLAUDE.md`, `IDEAS.md`;
  - `.claude/rules/portability-check.md`, `.claude/skills/docs-sync/references/docs-map.md`;
  - `docs/INJECTION-FLOWS.md`;
  - `docs/guide/`: the skills reference, the docs-and-decisions, rules-hygiene, debugging and troubleshooting pages, `index.md`, installation, `concepts/shared-foundation.md`, `reference/hooks.md`, `reference/artifacts.md`.

  Then run `pnpm docs:build`.

- [ ] 7.4 With the user's approval of the spend only, run the with-without probe for `bdk:docs` and `bdk:adr` (D13), each on a task file under `evals/`, and commit the result rows. Without approval, leave this box open and report it.

## 8. Acceptance

- [x] 8.1 Run `kernel/tests/contract/tools-skills.test.ts`, `skill-context.test.ts` and the ctx snapshot test. All must pass.
- [x] 8.2 Run the full gate:
  - `pnpm build`, `lint`, `format:check`, `typecheck`, `knip`, `lint:py`;
  - `test:unit`, `test:e2e`, `test:contract`;
  - `skill-check`, `docs:build`, `eval check`, `pytest tests/unit/`;
  - `node dist/bdk.mjs export agents --host claude --check`, `claude plugin validate .`.
- [x] 8.3 Run `openspec validate v3-t42-tools --strict`.
