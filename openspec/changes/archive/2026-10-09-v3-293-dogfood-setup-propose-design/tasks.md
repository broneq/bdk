## 1. Eval cases first

- [x] 1.1 `setup-existing-openspec`: a Node CLI with `openspec/config.yaml` on `schema: spec-driven` (with a `context:` naming it) and the v2 `/.bdk/` ignore rule; graders: schema line kept, schema installed, `/.bdk/` gone, reply names the removed rule and the kept schema (items 1, 3)
- [x] 1.2 `setup-claude-plugin`: a plugin with `.claude-plugin/plugin.json`, `skills/` and a `bin/` launcher; graders: `tools.e2e` item `plugin`, `driver: cli`, `ready` running `claude plugin validate` (item 2)
- [x] 1.3 `propose-naming-rule`: `propose-from-issue` plus a `rules.proposal` naming Changes `v3-<N>-<slug>`; graders: `openspec new change v3-42-...` and the proposal under `v3-42-*` (item 4)
- [x] 1.4 Graders on `design-fresh-auto-gate` and `design-manual-gate-no-ask`: no `Agent` call with `run_in_background: true` (item 5); `design-manual-gate-no-ask`: the reply ends on one question (item 11)
- [x] 1.5 `design-draft-follow-up-round`: a Lavish stub whose first poll answers and adds a note opening a new decision; graders: a second page `design-add-csv-export-2.html` written, the design uses the note (item 6); grader on `design-draft-lavish` that the poll runs in the main thread after the designer hands back (item 9)
- [x] 1.6 `design-draft-scope-narrowed`: a two-capability proposal whose answer drops one; graders: `proposal.md` moves it to Out of scope, no spec delta for it, `Scope changed by the user:` in `design.md` (item 7); a `CLAUDE.md` rule the answer contradicts gives a `Deviation:` line after the stub confirms it (item 8)
- [x] 1.7 `explore-cli-options`: the proposal relies on a local `bin/upload` CLI whose flags only its `--help` lists; graders: a `bin/upload --help` command ran, `explore.md` names `--folder` (item 10)

## 2. Skills (built with /skill-creator)

- [x] 2.1 `skills/setup/SKILL.md`: the schema question and keep rule (steps 3 and 7), the removed-rule report line (steps 8 and 10)
- [x] 2.2 `skills/setup/references/e2e.md`: the plugin row and section; `skills/e2e-check/references/drivers.md`: driving a plugin item through `claude -p --plugin-dir`
- [x] 2.3 `skills/propose/SKILL.md`: read the naming rule of `openspec/config.yaml` before naming
- [x] 2.4 `skills/design/SKILL.md`: foreground blocks, poll of an open page with the stop-and-resume path, deviations and one-question gate
- [x] 2.5 `skills/design-draft/SKILL.md`: rounds (at most three), the page handed back to the caller, scope changes in `proposal.md`, deviations; step 0 polls for a typed command; `agents/designer.md` names `proposal.md` and the hand-back
- [x] 2.6 `skills/explore/SKILL.md`, `agents/explorer.md`, `skills/verify-design/SKILL.md`, `agents/verifier.md`: settle a CLI's options with its help command
- [x] 2.7 `skill-check` passes on every changed skill and agent

## 3. Try the skills

- [x] 3.1 Run the new and changed cases (`claude plugin eval`, grants of `evals/README.md`) and record the results in this Change; fix the skill text until they pass
- [x] 3.2 Update `evals/README.md` for the new cases and their grants

## 4. Docs

- [x] 4.1 `docs/guide/first-run.md`: schema kept unless agreed, plugin E2E item, removed ignore rule reported
- [x] 4.2 `docs/concepts/orchestrators.md`: design stage rounds, Lavish hand-back and resume, deviations, one-question gate; `docs/concepts/e2e.md`: the plugin item
- [x] 4.3 `pnpm docs:reference`

## 5. Gates

- [x] 5.1 `pnpm check`, every job of `.github/workflows/pr.yml`, `openspec validate --specs --strict`
