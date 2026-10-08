# Design

## Context

See proposal.md - Why. The site exists (archived Change `2026-10-07-v3-212-docs-github-pages`): VitePress 1.6 in `docs/`, the base path `/bdk/`, deployment from `main` only (D1), Mermaid through a custom component that redraws on a theme switch (D2), a sidebar built from the files of `docs/adr/` and `docs/design/` (D3), and links into the `docs/v3-draft1/` archive rewritten to GitHub (D4). The PR job `docs` builds the site only when `docs/`, `pnpm-lock.yaml` or `pr.yml` change; `pnpm check` runs lint, format, typecheck, the one vitest suite (which already includes `docs/.vitepress/**/*.test.ts` and `scripts/**/*.test.ts`) and the build.

The facts the Reference needs already live in machine-readable sources:

- Skills: `plugins/*/skills/*/SKILL.md` frontmatter - `name`, `description`, `argument-hint`, `user-invocable: false` on the three lead skills (`execute-waves`, `review-round`, `pr-review-round`), `disable-model-invocation: true` on the `git-identity` skills.
- Agents: `plugins/bdk/agents/*.md` frontmatter - `name`, `description`, `model`, `tools`.
- Hooks: `plugins/bdk/hooks/hooks.json` (`SessionStart` and `PreToolUse` on `Bash`, both running `bdk hooks <verb>`) and `plugins/git-identity/hooks/hooks.json` (`SessionStart`, running `hooks/session-start.mjs`, whose header comment says what it does). The plugins reference (https://code.claude.com/docs/en/plugins-reference, "`hooks`") defines no description field on a hook, so the description has to come from what the hook runs.
- `bdk` commands: each slice declares its `Group` (name, summary, commands with verb, summary, arguments, flags, exit codes); `shared/cli/help.ts` renders `--help` from those declarations (spec `bdk-cli`, "Help": "there is no separate index of commands"). The groups are built inside `src/main.ts`, the composition root, which reads `process` and runs the CLI on import.
- Settings: `SettingsSchema` in `plugins/bdk/src/config/domain/settings.ts`, one strict zod 4 schema with a default on every leaf; it carries no descriptions yet. The user-facing text of each key lives today only in the table of `openspec/specs/bdk-cli/config/spec.md`, "Settings keys".

The flow diagrams: the `flow` session (worktree `bdk-worktrees/docs-bdk-flow-diagrams`, branch `docs/bdk-flow-diagrams`) writes 29 Mermaid diagrams, checked in the browser in both themes, as five uncommitted pages under `docs/concepts/`. Agreed with that session: it touches nothing outside `docs/concepts/`, this Change alone edits `docs/.vitepress/config.ts`, the sidebar and `docs/index.md`, and the pages come over as a file copy when `flow` reports them ready. The design-vs-code discrepancies `flow` found go to the user as issues, not onto the site.

## Goals / Non-Goals

**Goals:**

- Every fact that a source holds reaches the site through a generator, never through a second hand-written copy.
- Every way the docs can fall behind the code fails a check a contributor runs locally (`pnpm check`) or sees on the pull request (`docs-impact`), with a message that says what to update.
- What no check can judge (is the Guide still a correct explanation) is put in front of the author as a task and in front of the reviewer as a diff or a stated reason.

**Non-Goals:**

- Generating prose. The Guide and Concepts stay hand-written.
- Per-version docs, a search service beyond VitePress local search, or translations.
- Reference pages for the `skill-check` CLI of `bdk-skill-kit` (documented through its skill).
- Fixing the design-vs-code discrepancies found by `flow`.

## Decisions

### D1. Reference pages are generated and committed

`scripts/docs-reference.ts` reads the sources and writes `docs/reference/**`; `pnpm docs:reference` runs it. The pages are committed, each starting with a comment that it is generated and by which command.

Alternatives:
- *Hand-written reference with a coverage test.* Lost: the test can prove an entry exists, not that its argument hint, default or model is still true, so facts drift silently; and every new skill costs a hand-written entry.
- *Generated at build time by VitePress data loaders, nothing committed.* Lost on three counts: the PR shows no Reference diff, so the reviewer never sees what a change does to the docs; the `docs` PR job and `docs.yml` trigger on `docs/**` and would miss a plugin-only change (deploy would publish stale pages until the next docs edit); and the docs package would have to resolve each plugin's dependencies (zod) and build order inside VitePress.

Committing the output makes every source change show up as a `docs/reference/` diff in the same PR, which triggers the `docs` build and the deploy by the existing path filters.

### D2. One drift check: regenerate and compare

`scripts/docs-reference.test.ts` runs the generator in memory and compares its output with the committed files, file by file, in both directions: a page the generator would write that is missing or different, and a committed page under `docs/reference/` the generator would not write. The failure names each page and `pnpm docs:reference`. The generator itself has unit tests on fixture plugins (a missing description, an internal skill, a hook with no description source).

Alternatives:
- *Separate "every item has an entry" and "every entry has an item" tests.* Lost: full equality covers both directions and changed facts with one rule and no second list of names.
- *A `--check` mode run as its own CI step.* Lost: inside vitest it is part of `pnpm check` and of the existing `check` job, with no new step to keep in sync.

### D3. The sources the generator reads

- Skills and agents: frontmatter parsed with `yaml` (already a dependency of `plugins/bdk`; added as a root dev dependency for `scripts/`). Invocation is `/<plugin>:<name>`; `user-invocable: false` renders as "started by other skills"; `disable-model-invocation: true` renders as "only you start it". The generator fails when `name` or `description` is missing.
- Hooks: event, matcher, timeout and command from each `hooks.json`. The description comes from what the hook runs: a `bdk hooks <verb>` command takes the summary of that verb's declaration; a script takes the first sentence of the script's leading doc comment. The generator fails when neither exists.
- `bdk` commands: the generator reads the declarations without running the CLI and without changing its composition root. `src/slices.ts` lists every slice; each slice's `index.ts` exports its group factory `<slice>Group(deps)`. The generator imports each one, calls it with a stub that throws if a dependency is used (building a declaration touches none), sorts the groups by name as `bdk --help` does, and renders each group and command with `groupHelp` and `commandHelp` from `shared/cli/help.ts`, the functions `--help` uses. The page therefore shows exactly what `bdk <group> <verb> --help` prints, and help still comes only from the declarations (spec `bdk-cli`, "Help"). A first idea, moving the group list from `main.ts` into a new `src/groups.ts`, lost: the architecture lint allows only `main.ts` and `slices.ts` directly in `src/`, and `SLICES` already lists every slice; the generator's test fails when a directory under `src/` other than `shared/` is missing from it.
- Settings: `describeSettings` in `plugins/bdk/src/config/domain/describe.ts` walks `SettingsSchema` and returns, per dotted key, type, allowed values, bounds, default, whether it is required and its description; items by `id` and record values are named `tools.test.<id>.command` and `models.<role>` (the placeholder comes from the record's meta `entry`). The generator prints that list; `z.toJSONSchema` lost because its output loses the item-by-`id` and placeholder structure the keys use. Descriptions are added to every key with zod 4 `.meta({ description })` in `settings.ts`, moving the user text of the "Settings keys" table there (spec delta `bdk-cli/config`). A unit test in `plugins/bdk/src/config/tests/` fails on a key without a description, so the rule holds even before the generator runs.

Other alternatives for the CLI: *running the built `dist/bdk.mjs <group> --help`* lost because the test suite would need a build before it (the `check` job builds last) and a subprocess per command; *a new `bdk help --json` command* lost because it adds a user-facing command whose only consumer is this generator. For settings: *descriptions in a side file under `docs/`* lost because it is a second place to update; *parsing the spec table* lost because a spec is not a runtime source and the table and schema already differ in places.

`scripts/` may import the slices' `index.ts`, `src/slices.ts`, `shared/cli/help.ts` and `config/domain/`: the "plugins never import from each other" rule (ADR-0002) is about plugins, and `scripts/publish-plugin.ts` already reads plugin directories. The architecture lint of `plugins/bdk` governs imports inside the plugin and is unaffected.

### D4. Layout of the Reference

```
docs/reference/index.md            hand-written: what each plugin is for, links (in the sidebar)
docs/reference/bdk/skills.md       generated
docs/reference/bdk/agents.md       generated
docs/reference/bdk/cli.md          generated
docs/reference/bdk/settings.md     generated
docs/reference/bdk/hooks.md        generated
docs/reference/bdk-craft.md        generated (skills)
docs/reference/bdk-skill-kit.md    generated (skills)
docs/reference/git-identity.md     generated (skills, hooks)
```

Each entry is a heading with a stable anchor (`#plan`, `#policy-budgets-review-rounds`, `#config-set`), so hand-written pages link to entries. The `bdk` plugin is split into five pages because one page would hold 31 skills, 9 agents, about 25 commands and 30 keys. Every plugin's skills are listed, internal ones marked, so a user who sees `review-round` in a diagram finds it.

### D5. Hand-written pages and their name check

```
docs/guide/          index (what BDK is), install, first-run (/bdk:setup), workflow (idea to PR), configuration
docs/concepts/       from flow: workflow, orchestrators, agents, run-state, cli-config-hooks
                     written here: openspec-changes, findings, gates-and-budgets, e2e
```

The Concepts topics of the issue map to pages as: OpenSpec Changes - `openspec-changes`; blocks and orchestrators - `orchestrators`; agents and models - `agents`; run state - `run-state`; findings - `findings` (event log diagram linked from `run-state`); gates and budgets - `gates-and-budgets`; E2E as a user - `e2e`. The `flow` pages stay as written; they already link to the Reference pages. Their notation `bdk:<agent>` for an agent is part of the checked forms; `cli-config-hooks` keeps the skill-to-command and key-to-stage maps and links to the generated pages for the full tables.

`scripts/docs-reference/names.ts` (tested on a fixture model in `names.test.ts` beside it, run on the real pages by `scripts/docs-names.test.ts`) scans `docs/guide/**` and `docs/concepts/**`, prose and `mermaid` blocks, for the patterns agreed with `flow`: `/<plugin>:<name>` (skills), `bdk <group> <verb>` (commands), full dotted settings keys starting with a top-level key of the schema (`policy.budgets.review-rounds`), and links to Reference anchors (agents, and anything else linked). Each name must resolve against the same source model the generator builds (D3); the failure names page, line and name. Agents are matched by link only: bare agent names (`lead`, `judge`) are ordinary words.

Alternatives: *VitePress dead-link check only* lost because it checks pages, not anchors, and does not read diagrams; *a list of names per page in frontmatter* lost because it is a second list that drifts.

### D6. Sidebar: declared order for the user sections, a coverage test

`docs/.vitepress/sidebar.ts` keeps `sidebarItems` for ADRs and designs (D3 of the docs site) and gains a declared, ordered list for Guide, Concepts and Reference, because reading order is a choice, not a file-name order. `sidebar.test.ts` fails when a Markdown page under those three directories is not listed or a listed link has no page. Nav: Guide, Concepts, Reference, Decisions, Designs. The home page's primary action opens `guide/`.

Alternative: *generate the user sections from the files as well*, ordered by a numeric prefix - lost because file names would carry the order into URLs, and moving a page would break links.

### D7. Mermaid blocks parse in the test suite

`docs/.vitepress/mermaid-parse.test.ts` (with `mermaid-blocks.ts`) extracts every `mermaid` block of every site page and calls `mermaid.parse` (mermaid 12, already a docs dependency) under a DOM stand-in (`happy-dom` as a docs dev dependency, enabled for this file only). A diagram that does not parse fails `pnpm check` with page and line. The spike of task 1.1 settled it: `mermaid.parse` parses all 29 diagrams of the `flow` pages (22 `flowchart`, 7 `sequenceDiagram`) under `happy-dom` and rejects broken ones of both types; without a DOM stand-in it fails (`DOMPurify.addHook is not a function`). No headless-Chrome fallback is needed.

Alternative: *trust the browser check at authoring time only* lost because the name check (D5) will make contributors edit diagrams in later Changes, and nothing else would catch a syntax slip there.

### D8. Rules for hand-written pages: CLAUDE.md, config.yaml, verify, review

- `CLAUDE.md`, SDLC: a new bullet "Docs." between "Change" and "Gates": a Change that changes what a BDK user sees updates `docs/guide/` and `docs/concepts/` and runs `pnpm docs:reference` in the same PR; the PR body says which pages or states `Docs-impact: none - <reason>`. "Gates" gains `pnpm docs:reference` before `pnpm check`. `CLAUDE.md` "Current state" names the site's sections.
- `openspec/config.yaml`: a `tasks` rule "A Change that changes a skill, agent, hook, `bdk` command, settings key or the flow between them has a task group 'Docs' that names each Guide or Concepts page it updates and runs `pnpm docs:reference`; a Change without user-visible change says so in the proposal's Impact." A `proposal` rule asks Impact to list the affected docs pages. `operations.apply.guidance` and `operations.archive.guidance` each gain one line naming the docs task.
- `/opsx:verify` is a generated command (`openspec update` rewrites `.claude/commands/opsx/`), and OpenSpec 1.13.2 accepts operation guidance only for `apply` and `archive`. Verify therefore sees the docs rule as a task: an unchecked "Docs" task is reported as incomplete under Task Completion, and the archive guidance refuses to archive with it open. No edit to the generated verify command.
- Review: the PR template (`.github/pull_request_template.md`) holds a Docs section with the pages changed or the `Docs-impact:` line; the reviewer sees the generated `docs/reference/` diff and the hand-written page diff in the PR.

Alternative: *a custom verify step or hook* lost: the task rule already reaches verify through Task Completion, and CLAUDE.md asks for no machinery before a concrete blocker.

### D9. `docs-impact` job

A job `docs-impact` in its own workflow `.github/workflows/docs-impact.yml`, triggered on `pull_request` types `opened`, `synchronize`, `reopened` and `edited`. It diffs base to head; if any path matches `plugins/*/skills/**`, `plugins/*/agents/**`, `plugins/*/hooks/**`, `plugins/*/src/**` or `openspec/specs/**` and none matches `docs/guide/**` or `docs/concepts/**`, it reads the PR body from the event payload (through an environment variable, never interpolated into the script) and passes only on a line matching `^Docs-impact: none - (?!<reason>)\S`: a reason, not the placeholder the pull request template holds. Otherwise it fails with the changed paths and the line to add. Changes under `docs/reference/` do not count: they are generated and already enforced by D2. The job runs a small script, `scripts/docs-impact.ts`, with the rule in `scripts/docs-impact/rule.ts`, so the rule has unit tests. It needs only Node, no workspace install. It is added to the required checks of `main` and `staging/v3` by the maintainer (a branch protection setting, applied with `gh api` at the end of apply after confirmation).

Alternatives: *a label instead of a body line* lost because a label carries no reason for the reviewer; *a warning only* lost because the issue asks for a guarantee; *path rules per plugin file type* lost as precision without value: the reason line is the cheap escape for refactors.

It lives outside `pr.yml` so that editing the PR body re-runs only this job; the jobs of `pr.yml` keep the default `pull_request` types.

### D10. Versioning and where user docs live

One site, for the release on `main` (follows D1 of the docs site: `staging/v3` never deploys). Pages describe the current release; the Guide links to the `v2.7.0` README for v2 users. Per-version docs lost: one active line, and generated pages already move with each release.

The site owns the user documentation and the reference. `README.md` (#170) becomes a short entry that links to the site; `CONTRIBUTING.md` (#171) states the docs rule of D8 for contributors. Both are out of scope here; their issues get a comment naming the pages to link once this Change merges.

### D11. Bringing the flow pages over

When `flow` reports the pages ready, copy `docs/concepts/*.md` from its worktree into this branch as they are, in their own commit-ready step before any edit, then add Reference links and run the name check. The Change is squashed into one commit at the end (SDLC), so the copy's authorship is recorded in the PR body and commit message ("Concepts diagrams by the flow session"). If `flow` is not ready when the rest is done, apply waits at that task rather than drawing replacements.

### D12. The Broniszewski design system on the default theme

Asked for by the maintainer during the review of this Change. The site keeps the VitePress default theme (navigation, sidebar, search, outline, dark mode) and dresses it in the design system:

- `docs/.vitepress/theme/design-system/` holds an unchanged copy of the design system's `colors.css`, `typography.css`, `spacing.css`, `effects.css` and `components.css`, with a README naming the source commit and how to update. `fonts.css` (Google Fonts and Font Awesome) and `base.css` (global resets and a `.container` class VitePress also uses) are left out.
- `brand.css` maps the tokens onto VitePress's variables, repeats the design system's dark theme for VitePress's `.dark` class and for the navigation bar (dark in both themes), and restyles sidebar, outline, prose, tables, code and custom blocks after the design system's article styles. `design-system.test.ts` fails when the repeated dark theme differs from `colors.css`.
- Fonts are self-hosted from `@fontsource-variable/archivo`, `geist` and `jetbrains-mono`, as the design system's README asks for production; the site loads nothing from another host.
- `page-title.ts` renders the first heading's "<title> - <summary>" as the design system's page header: the title with the blue period, the summary as the lead. `Layout.vue` puts a `// Section` eyebrow above it and numbers the chapters of the Guide and Concepts.
- The home page (`home/HomePage.vue`) is built from the design system's components in their markup and classes: Hero on the dark grid, SectionHeader, process steps of ServiceCards with Segments (the review stage carries the one orange signal), plain ServiceCards, the FinalCTA band and the Footer.
- Mermaid draws with its `base` theme and variables read from the tokens at draw time, so diagrams follow the theme switch.
- `vue-tsc` replaces `tsc` for the docs typecheck, so the Vue components are type-checked too.

Alternatives: *a theme of its own built from the design system's components* lost: it would rebuild the sidebar, search, outline and theme switch the default theme already has; *loading the design system from GitHub at build time* lost: it is not a package, the build would need the network, and an unpinned upstream change would restyle the site without review; *Google Fonts as in `fonts.css`* lost: the design system itself asks for self-hosting in production, and it keeps readers' requests on one host.

### D13. Rule catalogue and setting examples from the sources

The review by three reader personas asked for a list of the rules (to know what to switch off) and for configuration examples. Both follow D1: the rule catalogue is generated from `plugins/bdk/rules/` with the pack's own `parseRule`, so the Reference shows exactly what `bdk rules for` reads; setting examples live in the settings schema's meta and a test parses each one as settings, so an example cannot go stale. Whole-file examples for typical projects stay hand-written in the Guide, where the name check holds their keys. Alternatives: *a hand-written rule table* lost for the D1 reasons; *examples only in the Guide* lost because nothing would keep them valid.

## Risks / Trade-offs

- [The name check misses a name written outside the agreed patterns, e.g. `review-rounds` alone] → the patterns are written down in `CLAUDE.md` next to the docs rule; the `docs-impact` job and the docs task still put the page in front of the author.
- [`mermaid.parse` under happy-dom does not support a diagram type] → D7 fallback, settled in the first apply task.
- [Generated pages churn on unrelated edits, e.g. reformatting a description] → that churn is the intended signal; the generator output is deterministic (sorted, no timestamps) so only real changes show.
- [`docs-impact` annoys refactor PRs] → one body line with a reason; the watched paths exclude tests outside `src/` and all of `docs/reference/`.
- [A slice factory starts doing work at construction] → the stub throws on any dependency use, so the generator test fails and names the slice.
- [A design system update restyles VitePress parts the mapping does not cover] → the copy changes only by an explicit update; the README asks for a check of every page in both themes, and the dark theme is held by a test.
- [Hand-written Guide still drifts in meaning while every name stays valid] → no check can judge meaning; the docs task, the PR template and the reviewer cover it, and the E2E run of the Guide at the end of apply sets the baseline.

## Migration Plan

Additive. After merge: the maintainer adds `docs-impact` to the required checks of `main` and `staging/v3`; #170 and #171 get comments with the links. Rollback is a revert of the PR plus removing the required check.

## Open Questions

None that change the specs or tasks. Defaults to confirm in review of these artifacts: the `docs-impact` watched paths of D9, and the branch-protection change applied by the apply session after the maintainer's confirmation (task 10.4).
