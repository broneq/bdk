## 1. Content test first

- [ ] 1.1 Write `kernel/tests/contract/craft-skills.test.ts`, failing on the current tree. It covers:
  - the `bdk-craft` manifest, the marketplace entry with its `git-subdir` source, and the plugin's top-level contents (`.claude-plugin/`, `skills/`, `README.md`, `CHANGELOG.md`);
  - every craft skill: one of the nine names, at most 200 lines, only standard fields, and no `bdk.mjs`, `CLAUDE_PLUGIN_ROOT`, `/bdk:` reference or model name;
  - an `admitted` row in `docs/V3-EVAL-CRAFT.md` for every shipped skill, and a row for each of the nine;
  - the three v2 paths absent, and no `debug` or `test-driven-development` key in `SKILL_CONTEXT`;
  - the stale-name search over `git ls-files`, skipping the "Removed skills" sections the way `tools-skills.test.ts` does.
- [ ] 1.2 Run it and confirm each case fails for the stated reason.

## 2. The bdk-craft plugin

- [ ] 2.1 Create `plugins/bdk-craft/.claude-plugin/plugin.json` (`name`, `version` `0.1.0`, `description`, `author`, `repository`, `license`, `skills: "./skills/"`) and a short `plugins/bdk-craft/README.md`: install alone, the nine skills, no `bdk` needed.
- [ ] 2.2 Add the `bdk-craft` entry with the `git-subdir` source to `.claude-plugin/marketplace.json`, after checking the source fields against the Claude Code marketplace docs.
- [ ] 2.3 Add the `plugins/bdk-craft` package to `.github/release-please-config.json` (`extra-files` pointing at its `plugin.json` `$.version`) and to `.github/.release-please-manifest.json` (`0.1.0`). Leave `CHANGELOG.md` to release-please; create no changelog by hand.
- [ ] 2.4 Add the portable target over `plugins/bdk-craft/skills` to `skill-check.config.ts`, and confirm that `pnpm skill-check` checks it.
- [ ] 2.5 Run `claude plugin validate plugins/bdk-craft` and `claude plugin validate .`.

## 3. The nine skills

Each skill follows D6. It is a process with checkable steps or a choice among named alternatives, at most 200 lines, with long detail in `references/`. Review each with `/bdk-skill-kit:skill-authoring` and `pnpm skill-check`.

- [ ] 3.1 `tdd`: rewrite `skills/test-driven-development/SKILL.md` without BDK gates or project placeholders.
- [ ] 3.2 `debugging`: rewrite `skills/debug/SKILL.md` as stateless knowledge. No `.bdk/debug/` file and no Change (D5). Fold the useful parts of its references in.
- [ ] 3.3 `mermaid-drawer`: move `skills/mermaid-drawer/` with its recipes reference; drop BDK-only wording.
- [ ] 3.4 `oop-design`.
- [ ] 3.5 `api-design`.
- [ ] 3.6 `refactoring`.
- [ ] 3.7 `data-modeling`.
- [ ] 3.8 `testing-strategy`.
- [ ] 3.9 `modularizing`.
- [ ] 3.10 Delete `skills/debug/`, `skills/test-driven-development/` and `skills/mermaid-drawer/`. Remove the `debug` and `test-driven-development` entries from `SKILL_CONTEXT`, and update the ctx snapshot. Run `pnpm skill-check --baseline-prune` for the `debug` entries.

## 4. `bdk ctx craft`

- [ ] 4.1 Write failing unit tests for the craft lookup: checkout path first, then the cache across marketplaces, highest semantic version first (`0.10.0` above `0.2.0`), and none found. Also write failing tests for the rendering: frontmatter dropped, headings one level down, `references/` inlined in name order.
- [ ] 4.2 Write a failing e2e test for `bdk ctx craft tdd` (exit 0, `--json` part kind `craft`) and for an unknown name (exit 3, `input/not-found` naming the searched paths).
- [ ] 4.3 Implement the command in the `ctx` slice. Add it to `schema/cli/commands.json`, and add the `craft` part kind to `schema/cli/output/ctx.json`. Run `pnpm build` and the contract tests that pair the spec and the schema.

## 5. The `Craft` section of dispatch packages

- [ ] 5.1 Write failing dispatch build tests:
  - an `implementer` package on a `feature` Change with `tdd` installed has a `Craft` section naming `tdd` and `bdk ctx craft tdd`, and no path;
  - a `bug` Change names `debugging`, then `tdd`;
  - with no `bdk-craft` install, the package has no `Craft` section;
  - a `simplifier`, `runner` or `reviewer` package has no `Craft` section.
- [ ] 5.2 Add the `craft` section kind to the template and fill it in `build.ts` through the lookup of 4.3. Check that the template hash and the package-size check still hold, and update the snapshots the template change moves.
- [ ] 5.3 Name the `Craft` section in the implementer role body (`skills/roles/implementer`), so the agent knows to run the commands before the first edit.

## 6. The with / without harness for bdk-craft

- [ ] 6.1 Write failing tests in `evals/suites/with-without/suite.test.ts`:
  - `--skill bdk-craft:tdd` builds both copies from `plugins/bdk-craft` and loads no `bdk` plugin;
  - the `without` copy lacks `skills/tdd/`;
  - an unknown plugin prefix is refused.
- [ ] 6.2 Implement the plugin choice in `skillDir` and `buildCells`.
- [ ] 6.3 Move `examples/mermaid-drawer.yaml` to `examples/craft/mermaid-drawer.yaml`, and point `EXAMPLE_TASKS` and the model-free check at `bdk-craft:mermaid-drawer`. Update `evals/harness/cli.test.ts`, `report.test.ts` and `evals/README.md`. Run `pnpm eval check`.

## 7. Measurement and admission

- [ ] 7.1 Write `evals/suites/with-without/examples/craft/<name>.yaml` for the other eight skills, three tasks each, in the form of `docs.yaml` and `adr.yaml`:
  - each task is written as a user would ask, without naming the skill;
  - it asks for the result at the end of the reply;
  - its assertions check the markers the skill fixes, for example a failing test shown before the implementation, `problem+json`, a Test Data Builder, or an expand-and-contract step.
- [ ] 7.2 Commit the skills, the harness and the task files, so the harness runs on a clean tree.
- [ ] 7.3 Show the user the projected spend (30 to 60 USD for nine probes, about 269 USD left) and get a yes before the first probe.
- [ ] 7.4 Run each probe:

  ```bash
  pnpm eval with-without --skill bdk-craft:<name> \
    --tasks evals/suites/with-without/examples/craft/<name>.yaml \
    --probe --run-cap 3 --budget 500
  ```

  Keep the results under `evals/results/with-without/`. Regenerate `report.md` with `pnpm eval report with-without`.

- [ ] 7.5 Write `docs/V3-EVAL-CRAFT.md` with one row per skill: task file, assertions passed `with` and `without`, cost, and the verdict `admitted` or `rejected` by D7. Delete every rejected skill from `plugins/bdk-craft/skills` and keep its task file.

## 8. References and documentation

- [ ] 8.1 Replace the references to the three v2 skills:
  - `README.md` (the Skills rows and a "Removed skills" mapping, plus a short `bdk-craft` section);
  - `CLAUDE.md`, `CONTRIBUTING.md`, `STARTUP_INSTRUCTIONS.md` (through `pnpm build` if it is rendered);
  - `.claude/rules/portability-check.md`, `.claude/rules/verification-scoping.md`, `.claude/skills/docs-sync/references/docs-map.md`;
  - `skills/stages/design/references/approaches.md`;
  - `docs/INJECTION-FLOWS.md`, `docs/HOST-FACTS.md`, `tests/host-probe/*`;
  - `kernel/src/hooks/tests/prompt-expansion.test.ts`;
  - the living specs that name them (`kernel-cli/hooks`, `skill-evals`, `tools-skills`) through this Change's deltas or as plain example renames.
- [ ] 8.2 Update the user guide:
  - `docs/guide/workflows/debugging.md` becomes a bug Change plus `bdk-craft:debugging`;
  - `docs/guide/workflows/docs-and-decisions.md` and `docs/guide/concepts/verification-scoping.md`;
  - `docs/guide/reference/skills.md`, with a "Removed skills" section and a `bdk-craft` section listing the admitted skills.

  Run `pnpm docs:build`.

- [ ] 8.3 Mark the T42 craft item done in `docs/V3-IMPLEMENTATION-PLAN.md`, and record D5 there: `debugging` opens no Change.

## 9. Acceptance and gate

- [ ] 9.1 Check the acceptance signal "`bdk-craft` installs alone on a project without `bdk` and `tdd` runs there". The evidence is the `with` cell of the `tdd` probe, which loaded only the `bdk-craft` copy (D8), and `claude plugin validate plugins/bdk-craft`. Name the run file in the report.
- [ ] 9.2 Run the full gate:
  - build and static checks: `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm lint:py`, `pnpm skill-check`, `pnpm eval check`;
  - tests: `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `uv run pytest tests/unit`;
  - docs and plugins: `pnpm docs:build`, `claude plugin validate .`, `claude plugin validate plugins/bdk-craft`.

  Fix every finding, including ones not caused by this Change.

- [ ] 9.3 Run `openspec validate v3-t42-craft --strict`.
