# BDK docs map

What every page of the MkDocs site claims, and which files in this repo are the
ground truth for those claims. Three indexes: the **reverse index** answers "I
touched this file, what might now be wrong?", the **page index** answers "I am
auditing this page, what do I read to check it?", and the **shared-facts index**
answers "this repo states the same thing in five places - do they still agree?".

Page paths are relative to `docs/guide/`, the site's `docs_dir`. Everything else
under `docs/` (the v3 plan and archive, ADRs, `HOST-FACTS.md`,
`INJECTION-FLOWS.md`) is not part of the site.

Keep this file current. If a page is added, moved, retired, or starts claiming
something new, the map is part of that change - a stale map silently disables
the whole skill, because a page nobody maps is a page nobody audits.

These indexes are where to start, not where to stop. Every entry is a claim
someone wrote down once and may have got wrong; a page's real content always
outranks what this file predicts about it.

Until T50 rewrites the site for v3, every page carries the v2 banner and
describes v2 on purpose. The v3 settings live in the Settings section of
`README.md`; the site has no settings page until T50.

---

## Reverse index: source -> pages at risk

| You changed                                                                                                                  | Re-check these pages                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/<name>/SKILL.md` frontmatter (name, `argument-hint`, `user-invocable`, `model`, `allowed-tools`, `disallowed-tools`) | `reference/skills.md` (the skill's own section), plus the workflow page that narrates it                                                                              |
| A skill added, renamed, or retired under `skills/`                                                                           | `reference/skills.md`, `index.md` (pipeline diagram + tier table), `README.md` skills table, the owning workflow page                                                 |
| `skills/design/`, `create-plan/`, `verify-plan/`, `subagent-execute-plan/`, `cr/` bodies                                     | `workflows/full-pipeline.md`, `workflows/standard.md`, `getting-started/first-feature.md`, `concepts/plan-pipeline.md`                                                |
| `skills/cr/`, `skills/pr-review/` (modes, flags, agent scaling, `disallowed-tools`)                                          | `workflows/code-review.md`, `reference/skills.md`, `reference/agents.md` (read-only enforcement section)                                                              |
| `skills/debug/`                                                                                                              | `workflows/debugging.md`                                                                                                                                              |
| `skills/create-adr/`, `explain-complex-code/`, `update-docs/`, `mermaid-drawer/`                                             | `workflows/docs-and-decisions.md`, `reference/skills.md`                                                                                                              |
| `skills/add-rule/`, `skills/refine-rules/`                                                                                   | `workflows/rules-hygiene.md`, `reference/skills.md`                                                                                                                   |
| `skills/setup/`                                                                                                              | `getting-started/setup.md`, `getting-started/installation.md`                                                                                                         |
| `skills/bdk-*` meta-skills (the `user-invocable: false` set)                                                                 | `reference/skills.md` (collective meta-skill paragraph and its count), `concepts/agents.md` ("pre-briefed"), `concepts/shared-foundation.md`                          |
| `agents/*.md` added, retired, or model/`tools:`/`skills:` changed                                                            | `reference/agents.md` (both tables + the agent count), `concepts/agents.md`, `STARTUP_INSTRUCTIONS.md` agent tables                                                   |
| `STARTUP_INSTRUCTIONS.md`                                                                                                    | `concepts/shared-foundation.md`, `concepts/verification-scoping.md`, `concepts/agents.md`, `workflows/trivial.md`, `workflows/rules-hygiene.md` (capture conventions) |
| `scripts/inject-rules.py`, `scripts/inject-language-rules.py`, `rules/*.md`, `rules/languages/`                              | `concepts/quality-and-language-rules.md`, `concepts/shared-foundation.md` (the meta-skill example)                                                                    |
| `scripts/bdk_run_state.py` (trailers, manifest, session guard, waves, worktrees)                                             | `concepts/plan-pipeline.md`, `reference/artifacts.md`, `troubleshooting.md`                                                                                           |
| `kernel/src/ctx/config.ts`, `schema/settings.json` (settings keys)                                                           | `README.md` Settings section, `getting-started/setup.md` (the feature flags), `concepts/verification-scoping.md`, `concepts/quality-and-language-rules.md`            |
| `hooks/hooks.json`                                                                                                           | `reference/hooks.md`, `concepts/shared-foundation.md`, `workflows/trivial.md`                                                                                         |
| `hooks/check-rules-drift/`                                                                                                   | `reference/hooks.md`, `workflows/rules-hygiene.md`, `troubleshooting.md`                                                                                              |
| `hooks/is-command-exists/`, `hooks/is-skill-exist/`                                                                          | `reference/hooks.md` (the "not wired into hooks.json" section), `troubleshooting.md`                                                                                  |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`                                                              | `getting-started/installation.md`                                                                                                                                     |
| `.gitignore` (the `.bdk/` entries)                                                                                           | `reference/artifacts.md`, `getting-started/setup.md` - both embed the tracked/untracked block                                                                         |
| `pyproject.toml`, `.github/workflows/docs.yml`                                                                               | `contributing/index.md` is a snippet of `CONTRIBUTING.md` - edit `CONTRIBUTING.md`, never the page                                                                    |
| `CONTRIBUTING.md`                                                                                                            | nothing to edit under `docs/guide/` - `contributing/index.md` is a snippet include                                                                                    |
| `CHANGELOG.md`                                                                                                               | nothing, ever - auto-generated by release-please, and `changelog.md` is a snippet include                                                                             |
| `README.md`                                                                                                                  | `index.md` (they make overlapping claims and drift apart)                                                                                                             |

---

## Page index: what each page asserts

Format: page - what it is for - the files that decide whether it is true.

### Entry points

- **`index.md`** - the pitch, the "Why BDK" bullet list, the tier mermaid, the tier table.
  Truth: `skills/` directory listing, `STARTUP_INSTRUCTIONS.md`, `README.md`. Every bullet links into a
  concept or workflow page, so a retired page breaks this one first.
- **`getting-started/installation.md`** - prerequisites, the two install commands, configuring the
  project, what you get.
  Truth: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `hooks/hooks.json`.
- **`getting-started/setup.md`** - `/bdk:setup` phases, the feature flags, what gets written to
  `.bdk/`, the tracked-vs-untracked block.
  Truth: `skills/setup/SKILL.md`, `kernel/src/ctx/config.ts`, `.gitignore`.
- **`getting-started/first-feature.md`** - one change carried through the full tier, step by step,
  with the output to expect at each stage.
  Truth: the five pipeline skills' bodies. This page quotes actual prompts and artifact paths, so it
  goes stale on any change to a skill's phases or artifact naming.

### Workflows (narrative "how you use it")

- **`workflows/full-pipeline.md`** - stages 1-5, the "seams are files" argument, plan immutability,
  parallel worktrees.
  Truth: the five pipeline skills, `scripts/bdk_run_state.py`.
- **`workflows/standard.md`** - the standard tier, plus "when a standard run goes sideways".
  Truth: `skills/create-plan/`, `verify-plan/`, `subagent-execute-plan/`, `cr/`.
- **`workflows/trivial.md`** - why the trivial tier needs no skill.
  Truth: `STARTUP_INSTRUCTIONS.md`, `hooks/hooks.json`, `skills/cr/SKILL.md` (`--inline`).
- **`workflows/debugging.md`** - the five phases, choosing between 5a and 5b.
  Truth: `skills/debug/SKILL.md`.
- **`workflows/code-review.md`** - the four modes, agent scaling, the report, deferred findings, PR review.
  Truth: `skills/cr/SKILL.md`, `skills/pr-review/SKILL.md`, `agents/code-reviewer.md`.
- **`workflows/docs-and-decisions.md`** - ADRs, module explanations, doc refresh, diagrams.
  Truth: `skills/create-adr/`, `explain-complex-code/`, `update-docs/`, `mermaid-drawer/`.
- **`workflows/rules-hygiene.md`** - capture routing, the two rule skills, the drift Stop hook.
  Truth: `skills/add-rule/`, `skills/refine-rules/`, `hooks/check-rules-drift/`,
  `STARTUP_INSTRUCTIONS.md` capture conventions table.

### Concepts (the "why")

- **`concepts/shared-foundation.md`** - what SessionStart injects, why it is static, why subagents
  do not inherit it.
  Truth: `STARTUP_INSTRUCTIONS.md`, `hooks/hooks.json`, `skills/bdk-rules-*/`.
- **`concepts/verification-scoping.md`** - proportionality, the `Verification: none` class, tiers and
  command forms, anti-patterns.
  Truth: `.claude/rules/verification-scoping.md`, `STARTUP_INSTRUCTIONS.md`,
  `skills/bdk-test-tools/`, `skills/create-plan/`, `skills/subagent-execute-plan/`.
  Note: the rule file warns that these definitions are duplicated in several places with no test
  enforcing consistency. This page is one of those places.
- **`concepts/plan-pipeline.md`** - immutability stamp, commit trailers vs manifest, resume and
  session guard, parallel worktrees, waves, one commit per group.
  Truth: `scripts/bdk_run_state.py`, `skills/verify-plan/`, `skills/subagent-execute-plan/`.
- **`concepts/agents.md`** - the fleet, model-as-cost, read-only enforcement, pre-briefing,
  `SendMessage` vs respawn, structured returns.
  Truth: `agents/*.md`, `STARTUP_INSTRUCTIONS.md`, `skills/bdk-implementer-return-contract/`.
- **`concepts/quality-and-language-rules.md`** - the shipped rule sets, four usage patterns, language
  rules, misconfigured overrides.
  Truth: `rules/*.md`, `rules/languages/`, `scripts/inject-rules.py`,
  `scripts/inject-language-rules.py`, `kernel/src/ctx/config.ts`.

### Reference (the lookup tables - highest drift rate)

- **`reference/skills.md`** - one section per user-invocable skill: purpose, arguments, artifact,
  when to use, related skills. Meta-skills get one collective paragraph with their count.
  Truth: every `skills/*/SKILL.md` frontmatter and body. The most drift-prone page in the site: a new
  skill that is never added here is invisible to users (the coverage guard catches a missing section,
  not a wrong one).
- **`reference/agents.md`** - the agent count, both tables, read-only enforcement.
  Truth: `agents/*.md` frontmatter, `skills/cr/SKILL.md` and `skills/pr-review/SKILL.md`
  `disallowed-tools`. Contains an explicit count - count the files.
- **`reference/hooks.md`** - SessionStart and Stop entries in order, plus hook scripts not wired in.
  Truth: `hooks/hooks.json` (order matters and the page reproduces it), `hooks/*/`.
- **`reference/artifacts.md`** - the `.bdk/` layout, run state, the tracked/untracked block.
  Truth: `scripts/bdk_run_state.py`, `.gitignore`, every skill's artifact path.

### Standalone

- **`troubleshooting.md`** - failure modes, each quoting a real error string.
  Truth: the message strings in `hooks/*/check.py` and `scripts/bdk_run_state.py`. A reworded error
  message orphans its section here - grep the quoted string in the source to confirm it still exists
  verbatim.

### Snippet pages - never hand-edit

- **`changelog.md`** - `--8<-- "CHANGELOG.md"`. `CHANGELOG.md` is release-please output.
- **`contributing/index.md`** - `--8<-- "CONTRIBUTING.md"`. Edit `CONTRIBUTING.md` instead.

---

## Shared-facts index: stated in more than one place

Each row is one fact this repo repeats. Nothing enforces that the copies agree,
so they drift apart silently and a reader has no way to tell which copy to
trust. When a row's fact changes, every listed location changes with it; when
auditing, put the copies side by side and compare them directly rather than
checking each against the code in isolation. Site pages are named by their path
under `docs/guide/`.

| The fact                                                                                                       | Stated in                                                                                                                                    | Decided by                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The agent count and the fleet roster                                                                           | `README.md`, `reference/agents.md`, `concepts/agents.md`, `STARTUP_INSTRUCTIONS.md`                                                          | `agents/*.md`                                                                                   |
| How review agents are made read-only (`tools:` allowlist, **not** `disallowed-tools`, which only skills carry) | `index.md`, `README.md`, `reference/agents.md`, `concepts/agents.md`                                                                         | `agents/*.md` frontmatter; `skills/cr/SKILL.md`, `skills/pr-review/SKILL.md`                    |
| The three tiers and which skill each enters at                                                                 | `README.md`, `index.md`, `STARTUP_INSTRUCTIONS.md`                                                                                           | the pipeline skills                                                                             |
| Which quality rule sets ship and are injected                                                                  | `STARTUP_INSTRUCTIONS.md`, `concepts/quality-and-language-rules.md`, `workflows/trivial.md`, `README.md`, `.claude/rules/fragment-system.md` | `rules/*.md`, `scripts/inject-rules.py`, the `INJECT:` markers in `skills/create-plan/SKILL.md` |
| The capture-conventions routing table                                                                          | `STARTUP_INSTRUCTIONS.md`, `index.md`, `concepts/shared-foundation.md`, `workflows/rules-hygiene.md`, `workflows/trivial.md`                 | `skills/add-rule/SKILL.md`                                                                      |
| Verification proportionality and the `Verification: none` class                                                | `STARTUP_INSTRUCTIONS.md`, `.claude/rules/verification-scoping.md`, `concepts/verification-scoping.md`, `workflows/full-pipeline.md`         | `skills/create-plan/`, `skills/subagent-execute-plan/`, `skills/test-driven-development/`       |
| When `/bdk:cr --inline` is the right mode                                                                      | `workflows/trivial.md`, `workflows/code-review.md`, `workflows/debugging.md`                                                                 | `skills/cr/references/review-engine.md`                                                         |
| The `.bdk/` tracked-vs-untracked block                                                                         | `getting-started/setup.md`, `reference/artifacts.md`                                                                                         | `.gitignore`                                                                                    |
| The feature flag names                                                                                         | `getting-started/setup.md`, `README.md`                                                                                                      | `kernel/src/ctx/config.ts`                                                                      |
| The agent-scaling range for `/bdk:cr`                                                                          | `README.md`, `index.md`, `workflows/code-review.md`, `reference/skills.md`                                                                   | the sizing table in `skills/cr/`                                                                |

Two of these have already drifted at least once, which is why the index exists:
the read-only mechanism row (`index.md` and `README.md` attributed it to
`disallowed-tools`, which no agent carries) and the rule-sets row
(`STARTUP_INSTRUCTIONS.md` named four of the six files in `rules/`).

The "stated in" column is itself a claim that drifts. The rule-sets row was
written with three locations and an audit turned up three more, including
`workflows/trivial.md`. So when you verify a row, grep for a distinctive
phrase from the fact rather than only visiting the listed files, and add what
you find. A copy nobody knows about is the one that goes stale.

## Site-level invariants

These hold across pages, and break the build or the navigation rather than one paragraph:

1. **The `mkdocs.yml` `nav` lists exactly the pages under `docs/guide/`.** The guard in
   `kernel/tests/docs/coverage.test.ts` fails on an orphan page and on a nav entry without a page.
2. **Every relative `.md` link resolves.** Links are relative to the linking page
   (`../reference/skills.md`), and anchors follow the `toc` slugification: `## /bdk:add-rule` becomes
   `#bdkadd-rule`. A link out of `docs/guide/` (to `README.md`) must be an absolute GitHub URL.
3. **Snippet paths resolve.** `pymdownx.snippets` runs with `check_paths: true`, so a `--8<--` line
   pointing at a moved file fails the build.
4. **Mermaid blocks are fenced as ` ```mermaid `** and follow `/bdk:mermaid-drawer` (node budget,
   the shared palette).
5. **No em dash anywhere.** The site uses a plain `-`.
6. **Every page opens with the v2 banner** until T50, enforced by `kernel/tests/docs/banner.test.ts`.
7. **CI builds with `--strict`** (`.github/workflows/docs.yml`) on every pull request. A warning is a
   failure.
