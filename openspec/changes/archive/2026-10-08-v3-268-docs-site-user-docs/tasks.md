# Tasks

## 1. Feasibility of the checks

- [x] 1.1 Spike D7: in a scratch vitest file under `docs/.vitepress/`, call `mermaid.parse` under `happy-dom` on one diagram of each type the `flow` pages use (flowchart, sequenceDiagram, stateDiagram-v2, and any other found with `grep -h '^```mermaid' -A1`); record in design.md D7 whether the in-suite parse holds or the headless-Chrome fallback is needed. Verify: the spike passes for every type, or design.md names the fallback; delete the scratch file.

## 2. Settings descriptions in the schema (`bdk-cli/config`)

- [x] 2.1 Write the failing test in `plugins/bdk/src/config/tests/`: walk `SettingsSchema` and fail, naming the dotted key, for every key and every item field and record value without a `description` in its meta. Verify: `pnpm vitest run plugins/bdk/src/config` fails listing the current keys.
- [x] 2.2 Add `.meta({ description })` to every key of `settings.ts`, one sentence each, carried over from the "Settings keys" table of `openspec/specs/bdk-cli/config/spec.md` and checked against what each consumer does. Verify: 2.1 passes; `bdk config show` and `bdk config check` tests unchanged and green.

## 3. CLI declarations readable without running the CLI

- [x] 3.1 Settle how the generator reads the command declarations: `src/groups.ts` is not allowed by the architecture lint (only `main.ts` and `slices.ts` in `src/`), so the generator reads `SLICES` and each slice's `<slice>Group` factory with a throwing stub (design D3). Verify: every slice `index.ts` exports `<slice>Group`, and building a group touches no dependency (`grep` of the nine factories; covered by the generator test in 4.1).

## 4. Reference generator and drift check

- [x] 4.1 Write failing unit tests for `scripts/docs-reference.ts` on fixture plugins under `scripts/fixtures/docs-reference/`: skill entry with invocation, argument hint and description; `user-invocable: false` marked as started by other skills; `disable-model-invocation: true` marked; agent entry with model and tools; hook description from a `bdk hooks <verb>` declaration and from a script's doc comment; CLI page from the real `SLICES` with nine groups, sorted, matching `bdk <group> --help`; failure naming the item on a missing skill description, a missing hook description and a settings key without description; deterministic output (same input, same bytes). Verify: tests fail (module missing).
- [x] 4.2 Implement the generator per design D3 and D4 (yaml frontmatter, `hooks.json`, `SLICES` and the group factories with `groupHelp`/`commandHelp`, `describeSettings(SettingsSchema)`), the "generated - do not edit, run `pnpm docs:reference`" header comment, stable anchors; add `yaml` as a root dev dependency and the root script `docs:reference`. Verify: 4.1 passes.
- [x] 4.3 Write the failing drift test `scripts/docs-reference.test.ts` (or a `describe` in it) that compares generator output with the committed `docs/reference/**` in both directions and names each differing page and `pnpm docs:reference`. Verify: it fails now, naming every page (none committed yet).
- [x] 4.4 Run `pnpm docs:reference`, commit-stage the pages, read each page in `pnpm --filter @bdk/docs docs:dev` for layout and anchors. Verify: 4.3 passes.
- [x] 4.5 Prove the Acceptance signal on drift with three throw-away edits, reverted after each: delete `plugins/bdk/skills/adr/`, add a settings key `execution.example` with a description, rename the `bdk config set` verb. Verify: `pnpm test` fails each time naming `docs/reference/bdk/skills.md`, `docs/reference/bdk/settings.md` and `docs/reference/bdk/cli.md` respectively; record the three outputs for the PR body.

## 5. Concepts pages from the flow session

- [x] 5.1 When `flow` reports ready (check with `herdr agent read flow --source recent-unwrapped --lines 80`), copy `docs/concepts/{workflow,orchestrators,agents,run-state,cli-config-hooks}.md` from `~/projects/bdk-worktrees/docs-bdk-flow-diagrams` unchanged. Verify: `diff -r` between the two `docs/concepts/` shows only the files this Change adds later; every page renders in `docs:dev` in both themes.
- [x] 5.2 In the copied pages, link names to Reference anchors (agents by link per D5) and point `cli-config-hooks` to the generated CLI, settings and hooks pages for full tables, without changing the diagrams' content. Verify: the site build passes; no anchor link is dead (checked by 6.3).

## 6. Site checks: sidebar, names, Mermaid

- [x] 6.1 Write the failing sidebar coverage test in `docs/.vitepress/sidebar.test.ts`: every Markdown page under `docs/guide/`, `docs/concepts/` and `docs/reference/` is in the declared sidebar, every declared link has a page, sections in the order Guide, Concepts, Reference, Architecture decisions, Designs. Verify: it fails (no declared user sections).
- [x] 6.2 Declare the user sections and their reading order in `docs/.vitepress/sidebar.ts`, wire them and the nav (Guide, Concepts, Reference, Decisions, Designs) into `config.ts`. Verify: 6.1 passes.
- [x] 6.3 Write the failing name-check test `scripts/docs-reference/names.test.ts` per D5, reusing the generator's source model: a fixture page with `/bdk:no-such-skill`, `bdk config nope`, `policy.budgets.nope` and a dead Reference anchor fails naming page, line and name, also inside a `mermaid` block. Verify: the fixture cases fail as expected; then run against the real pages.
- [x] 6.4 Implement the name check. Verify: 6.3 passes on fixtures and on `docs/guide/**` and `docs/concepts/**`; a throw-away rename of `review-round` in `plugins/bdk/skills/` fails it naming `docs/concepts/orchestrators.md` (reverted).
- [x] 6.5 Write the failing Mermaid parse test `docs/.vitepress/mermaid-parse.test.ts` with a fixture block holding a syntax error, then implement it per the outcome of 1.1. Verify: the fixture fails naming page and line; every real page passes.

## 7. Hand-written Guide and Concepts

- [x] 7.1 Write `docs/guide/index.md` (what BDK is, the four plugins, link to the `v2.7.0` README for v2 users), `install.md` (marketplace add, install each plugin, prerequisites: Node, OpenSpec CLI version, `gh`), `first-run.md` (`/bdk:setup` and what it writes), `workflow.md` (idea to PR with `/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review`, `/bdk:close`, `/bdk:run` as autopilot, `/bdk:pr-review` and `/bdk:debug`; link to `concepts/workflow`), `configuration.md` (layers, `bdk config show|check|set`, common keys, link to the settings Reference). Written from `plugins/*/skills`, `openspec/specs/` and the generated Reference, not from the designs. Verify: name check, sidebar check and site build pass.
- [x] 7.2 Write `docs/concepts/openspec-changes.md`, `findings.md`, `gates-and-budgets.md` and `e2e.md`, each with a "Sources" list like the `flow` pages, linking to them instead of redrawing their diagrams. Verify: name check, sidebar check, Mermaid parse and site build pass.
- [x] 7.3 Write `docs/reference/index.md` (hand-written: one paragraph per plugin and links to its generated pages) and rewrite `docs/index.md` so the primary action opens `/guide/` and the features lead to Guide, Concepts, Reference, then Decisions and Designs. Verify: site build passes; home page checked in the browser.

## 8. Rules that keep the hand-written pages current

- [x] 8.1 Write the failing unit tests for `scripts/docs-impact.ts`: watched-path change without `docs/guide/` or `docs/concepts/` change and no body line fails naming the paths; a `Docs-impact: none - <reason>` line passes; an empty reason fails; a docs page change passes; a `docs/reference/`-only docs change does not count; no watched path passes without reading the body. Verify: tests fail (module missing).
- [x] 8.2 Implement `scripts/docs-impact.ts` and `.github/workflows/docs-impact.yml` (types `opened`, `synchronize`, `reopened`, `edited`; body passed through `env`, never interpolated). Verify: 8.1 passes; `actionlint` or a YAML parse of the workflow passes; `pnpm format:check` passes.
- [x] 8.3 Add `.github/pull_request_template.md` with a Docs section (pages changed, or the `Docs-impact:` line). Verify: file present, formatted.
- [x] 8.4 Update `CLAUDE.md`: SDLC bullet "Docs." (D8) with the name patterns of D5, `pnpm docs:reference` in "Gates", the site sections in "Current state", `pnpm docs:reference` in "Development Commands". Verify: read back; `pnpm format:check` passes.
- [x] 8.5 Update `openspec/config.yaml`: the `tasks` rule for a "Docs" task group, the `proposal` rule for docs pages in Impact, one line each in `operations.apply.guidance` and `operations.archive.guidance`. Verify: `openspec instructions tasks --change v3-268-docs-site-user-docs --json` shows the new rule; `openspec validate --specs --strict` passes.

## 9. Docs

- [x] 9.1 This Change is the docs Change: confirm that every page it adds is in the sidebar and that `docs/reference/` is regenerated after the last source edit (`pnpm docs:reference` leaves no diff). Verify: `git status --short docs/reference` is empty after the run.

## 10. Design system (D12)

- [x] 10.1 Copy the design system's `colors`, `typography`, `spacing`, `effects` and `components` CSS unchanged into `docs/.vitepress/theme/design-system/` with a README naming the source commit; favicons into `docs/public/`. Verify: files equal the source at the named commit.
- [x] 10.2 Write the failing test `docs/.vitepress/theme/design-system.test.ts` (the site's dark theme equals `.bn-dark` of `colors.css`), then `brand.css`: token mapping onto VitePress, dark navigation bar, sidebar, outline, prose, tables, code, custom blocks; self-hosted variable fonts. Verify: the test passes; a changed dark value fails it.
- [x] 10.3 Write the failing tests `page-title.test.ts`, then `page-title.ts` (title with the blue period, summary as the lead in sentence case, short `<title>`). Verify: tests pass.
- [x] 10.4 Write the failing test `theme/sections.test.ts`, then `sections.ts` and `Layout.vue` (section eyebrow, numbered chapters in Guide and Concepts). Verify: tests pass.
- [x] 10.5 Build the home page from the design system's components (`home/HomePage.vue`) and draw Mermaid with the tokens (`mermaid-diagram.ts`); switch the docs typecheck to `vue-tsc`. Verify: `pnpm --filter @bdk/docs typecheck` fails on a type error in a `.vue` file and passes without it.
- [x] 10.6 Open every page in the browser in the light and the dark theme, at desktop and phone width. Verify: no Mermaid error, no horizontal scroll, nothing loaded from another host.

## 11. Acceptance and gates

- [x] 11.1 E2E as a new user: in a fresh test project, follow only the built site (`pnpm --filter @bdk/docs docs:build && pnpm --filter @bdk/docs docs:preview`) from the home page: install the plugins as the Guide says (until #213 publishes the first `bdk--v*` release, substitute `claude --plugin-dir` for the marketplace install step only, and say so in the PR), run `/bdk:setup`, take one small intent through `/bdk:propose` to an open PR. Record every point where the site was not enough and fix the page. Verify: one intent reached a PR without opening a BDK source file; notes in the PR body.
- [x] 11.2 Open every page of the built site in the browser (chrome-devtools-axi) in the light and the dark theme, including every diagram and the theme switch; fix anything that looks off. Verify: screenshots of each section in both themes, no Mermaid error box, no layout breakage at phone width.
- [x] 11.3 Run every CI check: `pnpm check`, `pnpm --filter @bdk/docs docs:build`, `pnpm exec claude plugin validate .claude-plugin/marketplace.json --strict` and each plugin, commitlint on the commit, the `docs-impact` script against this branch's diff and PR body, `openspec validate v3-268-docs-site-user-docs --strict` and `openspec validate --specs --strict`. Verify: all exit 0.
- [x] 11.4 With no pull request open, add `docs-impact` to the required status checks of `main` and `staging/v3` (the `required-checks` ruleset, `gh api -X PUT repos/broneq/bdk/rulesets/24663939`), and comment on #170 and #171 with the site links to use. Verify: the ruleset lists `check`, `plugins`, `commitlint`, `docs`, `openspec` and `docs-impact`; both comments posted.

## 12. Documentation review follow-ups

Three readers on Sonnet (a new user, a tech lead, a power user) read the site and reported what they missed; the maintainer asked for rules, run state, configuration examples and stage focus.

- [x] 12.1 Generate the rule catalogue (`docs/reference/bdk/rules.md`) from `plugins/bdk/rules/` through the pack's own parser, and make the name check fail on a rule id that does not exist; tests first. Verify: tests pass; the drift test caught the new page until it was generated.
- [x] 12.2 Write `docs/concepts/rules.md` (kinds, admission, who reads rules at which stage, selection, project rules with examples, switching off, layers) and `docs/concepts/stages.md` (focus and what each block leaves alone), from the skill and agent texts. Verify: name check, sidebar check and build pass.
- [x] 12.3 Extend `docs/concepts/run-state.md` with why every stage writes files, a table of writer, later readers, purpose and the effect of deleting each file, and recovery recipes. Verify: as 12.2.
- [x] 12.4 Give every top-level settings key an example in the schema, tested to be valid settings, rendered in the settings Reference; add whole-file examples to `docs/guide/configuration.md`; fix the `policy.gates.design` description (the plan has no gate) and list the `models` roles. Verify: `describe.test.ts` passes; Reference regenerated.
- [x] 12.5 Add `docs/guide/footprint.md` (measured time and cost, permissions, pushes, committed files, network), a quick start on `docs/guide/index.md`, `docs/concepts/glossary.md`, the branch step before committing the Change files in `docs/guide/workflow.md`, and link the diagram notation to the glossary. Verify: as 12.2; every page checked in the browser in both themes at desktop and phone width.
- [x] 12.6 File what the docs cannot fix: #272 (rules for design and plan reach no role), #273 (reviewers do not read project instructions), #274 (`models` roles for the explorer and the design and close verifiers), #275 (scoped checks get every file). Verify: the issues are on the board with milestone and phase, and the pages that describe each limit link it.
- [x] 12.7 From the maintainer's review of PR #271: a section in `docs/guide/configuration.md` on retries and escalation (`policy.budgets.part-attempts`, the last run on `policy.escalation.model`, then blocked) with a YAML example; each top-level section of the settings Reference shown whole, generated from the schema (its example over every key's default, the description as a comment, the allowed values of an enum, the default a value changes), linked from the Guide. Model and effort per role (#278) stays out of this Change. Verify: the renderer test passes; the drift test covers the page.
- [x] 12.8 After #269 (the E2E browser driver is Playwright) landed on `staging/v3`: the E2E, Install, Cost and footprint, Run state and Agents pages describe Playwright and the evidence under `review/round-N/e2e/`; the settings description of `tools.e2e.<id>.browser` names `playwright`. Verify: `pnpm docs:reference`, `pnpm check`.
