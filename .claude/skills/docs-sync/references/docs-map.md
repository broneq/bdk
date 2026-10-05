# BDK docs map

What every page of the VitePress site claims, and which files in this repo are the
ground truth for those claims. Three indexes: the **reverse index** answers "I
touched this file, what might now be wrong?", the **page index** answers "I am
auditing this page, what do I read to check it?", and the **shared-facts index**
answers "this repo states the same thing in five places - do they still agree?".

Page paths are relative to `docs/guide/`, the site's source directory. Everything
else under `docs/` (the v3 plan and archive, ADRs, `HOST-FACTS.md`) is not part
of the site.

Keep this file current. If a page is added, moved, retired, or starts claiming
something new, the map is part of that change - a stale map silently disables
the whole skill, because a page nobody maps is a page nobody audits.

These indexes are where to start, not where to stop. Every entry is a claim
someone wrote down once and may have got wrong; a page's real content always
outranks what this file predicts about it.

Until T50 rewrites the site for v3, every page carries the v2 banner and
describes v2 on purpose. The v3 settings live in the Settings section of
`README.md` and the v3 Change state (`.bdk/changes/`, the ledger, the index,
the `change`, `log`, `measure` and `query` commands) in its Change state
section, and the artifact graph (`pipeline/pipeline.yaml`, `policy.gates`, the
`next`, `explain`, `validate` and `done` commands) in its Artifact graph
section, and the plan part format with the `part` commands in its Plan parts
section with `bdk commit`, and the tickets, budgets and escalation ladder with the `attempt`
commands in its Loops and attempts section; the site has pages for none of
them until T50.

---

## Reverse index: source -> pages at risk

| You changed                                                                                                                                                                             | Re-check these pages                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/<name>/SKILL.md` frontmatter (name, `argument-hint`, `user-invocable`, `model`, `allowed-tools`, `disallowed-tools`)                                                            | `reference/skills.md` (the skill's own section), plus the workflow page that narrates it                                                                                                             |
| A skill added, renamed, or retired under `skills/`                                                                                                                                      | `reference/skills.md`, `index.md` (pipeline diagram + tier table), `README.md` skills table, the owning workflow page                                                                                |
| `skills/design/`, `create-plan/`, `verify-plan/`, `subagent-execute-plan/`, `tools/cr/` bodies                                                                                          | `workflows/full-pipeline.md`, `workflows/standard.md`, `getting-started/first-feature.md`, `concepts/plan-pipeline.md`                                                                               |
| `skills/tools/cr/`, `skills/tools/pr-review/` (modes, flags, rounds, `disallowed-tools`)                                                                                                | `workflows/code-review.md`, `reference/skills.md`, `reference/agents.md` (read-only enforcement section)                                                                                             |
| `plugins/bdk-craft/skills/debugging/`                                                                                                                                                   | `workflows/debugging.md`                                                                                                                                                                             |
| `skills/tools/adr/`, `skills/tools/docs/`, `plugins/bdk-craft/skills/mermaid-drawer/`                                                                                                   | `workflows/docs-and-decisions.md`, `reference/skills.md`                                                                                                                                             |
| `skills/tools/rules/`                                                                                                                                                                   | `workflows/rules-hygiene.md`, `reference/skills.md`                                                                                                                                                  |
| `skills/setup/`                                                                                                                                                                         | `getting-started/setup.md`, `getting-started/installation.md`                                                                                                                                        |
| `skills/roles/` and `swarm` (the `user-invocable: false` set)                                                                                                                           | `reference/skills.md` (collective role-skill paragraph), `concepts/agents.md` (roles and adapters)                                                                                                   |
| `agents/*.md` added, retired, or model/`tools:` changed                                                                                                                                 | `reference/agents.md` (the tables + the agent count), `concepts/agents.md`, `STARTUP_INSTRUCTIONS.md` agents table (regenerated by `bdk ctx startup`)                                                |
| `STARTUP_INSTRUCTIONS.md`                                                                                                                                                               | `concepts/shared-foundation.md`, `concepts/verification-scoping.md`, `concepts/agents.md`, `workflows/trivial.md`                                                                                    |
| `kernel/src/ctx/` (manifest, sections), `kernel/src/rules/`, `rules/<category>/`, `rules/languages/`, `fragments/`                                                                      | `concepts/quality-and-language-rules.md`, `concepts/shared-foundation.md` (the meta-skill example), `README.md` Settings section                                                                     |
| `kernel/src/ctx/config.ts`, `schema/settings.json` (settings keys)                                                                                                                      | `README.md` Settings section, `getting-started/setup.md` (the feature flags), `concepts/verification-scoping.md`, `concepts/quality-and-language-rules.md`                                           |
| `kernel/src/change/`, `log/`, `measure/`, `query/`, `service/` (`rebuild`), `kernel/src/shared/store/` (Change layout, index, markers, ignored paths, the checkpoint and rebuild cores) | `README.md` Change state section and the `config set` row of its Settings table; `reference/artifacts.md` and `getting-started/setup.md` still describe the v2 `/.bdk/` ignore rule under the banner |
| `kernel/src/graph/`, `pipeline/` (nodes, kinds, templates, `policy.gates`, the four graph commands)                                                                                     | `README.md` Artifact graph section and its command table; `concepts/plan-pipeline.md` still describes the v2 pipeline under the banner                                                               |
| `kernel/src/part/`, `kernel/src/commit/`, the plan task grammar (`kernel/src/shared/store/state/plan.ts`), BDK trailers (`kernel/src/shared/store/progress.ts`)                         | `README.md` Plan parts section and its command table; `concepts/plan-pipeline.md` still describes the v2 plan format under the banner                                                                |
| `kernel/src/attempt/`, `log ingest` and the `bdk-entries` block (`kernel/src/log/use-cases/ingest.ts`, `block.ts`), `policy.budgets`, `policy.oscillation`, `policy.escalation`         | `README.md` Loops and attempts section and its command table, and the `policy` paragraph of its Settings section; `concepts/plan-pipeline.md` still describes the v2 retry rules under the banner    |
| `hooks/hooks.json`, `hooks/guard/`, `kernel/src/hooks/`                                                                                                                                 | `reference/hooks.md`, `concepts/shared-foundation.md`, `workflows/trivial.md`, `troubleshooting.md`                                                                                                  |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`                                                                                                                         | `getting-started/installation.md`                                                                                                                                                                    |
| `.gitignore` (the `.bdk/` entries)                                                                                                                                                      | `reference/artifacts.md`, `getting-started/setup.md` - both embed the tracked/untracked block                                                                                                        |
| `docs/guide/.vitepress/`, `.github/workflows/docs.yml`                                                                                                                                  | `contributing/index.md` includes `CONTRIBUTING.md` - edit `CONTRIBUTING.md`, never the page                                                                                                          |
| `CONTRIBUTING.md`                                                                                                                                                                       | nothing to edit under `docs/guide/` - `contributing/index.md` is a snippet include                                                                                                                   |
| `evals/` (the `pnpm eval` commands and modes)                                                                                                                                           | `CONTRIBUTING.md` (Workflow step 4 and Adding a Skill step 5); no page under `docs/guide/` describes the harness                                                                                     |
| `CHANGELOG.md`                                                                                                                                                                          | nothing, ever - auto-generated by release-please, and `changelog.md` is a snippet include                                                                                                            |
| `README.md`                                                                                                                                                                             | `index.md` (they make overlapping claims and drift apart)                                                                                                                                            |

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
  Truth: the pipeline stage skills, `kernel/src/part/`, `kernel/src/commit/`.
- **`workflows/standard.md`** - the standard tier, plus "when a standard run goes sideways".
  Truth: `skills/create-plan/`, `verify-plan/`, `subagent-execute-plan/`, `tools/cr/`.
- **`workflows/trivial.md`** - why the trivial tier needs no skill.
  Truth: `STARTUP_INSTRUCTIONS.md`, `hooks/hooks.json`, `skills/tools/cr/SKILL.md` (`--inline`).
- **`workflows/debugging.md`** - a bug Change, and the `bdk-craft` debugging process inside it.
  Truth: `plugins/bdk-craft/skills/debugging/SKILL.md`, `kernel/src/dispatch/` (the `Craft` section).
- **`workflows/code-review.md`** - the review Change, the range, a round, triage and the fix loop, `--inline`, PR review.
  Truth: `skills/tools/cr/SKILL.md`, `skills/tools/pr-review/SKILL.md`, `kernel/src/review/`.
- **`workflows/docs-and-decisions.md`** - ADRs, module explanations, doc refresh, diagrams.
  Truth: `skills/tools/adr/`, `skills/tools/docs/`, `plugins/bdk-craft/skills/mermaid-drawer/`.
- **`workflows/rules-hygiene.md`** - learnings, the audit with `rules stats`, `rules accept`, `rules prune`,
  `rules import` of hand-written `.claude/rules/`.
  Truth: `skills/tools/rules/`,
  `STARTUP_INSTRUCTIONS.md` capture conventions table.

### Concepts (the "why")

- **`concepts/shared-foundation.md`** - what SessionStart injects, why it is static, why subagents
  do not inherit it.
  Truth: `STARTUP_INSTRUCTIONS.md`, `hooks/hooks.json`, `kernel/src/ctx/`, `kernel/src/dispatch/`.
- **`concepts/verification-scoping.md`** - proportionality, the `Verification: none` class, tiers and
  command forms, anti-patterns.
  Truth: `.claude/rules/verification-scoping.md`, `STARTUP_INSTRUCTIONS.md`,
  `skills/stages/plan/`, `skills/stages/execute/`, `skills/roles/runner/`.
  Note: the rule file warns that these definitions are duplicated in several places with no test
  enforcing consistency. This page is one of those places.
- **`concepts/plan-pipeline.md`** - immutability stamp, commit trailers vs manifest, resume and
  session guard, parallel worktrees, waves, one commit per group.
  Truth: `kernel/src/part/`, `kernel/src/commit/`, `skills/stages/verify-plan/`, `skills/stages/execute/`.
- **`concepts/agents.md`** - roles and adapters, model-as-cost, read-only enforcement, how an agent
  reads its context, structured returns, `SendMessage` vs respawn, the tree.
  Truth: `agents/*.md`, `skills/roles/`, `kernel/src/export/domain/adapters.ts`, `STARTUP_INSTRUCTIONS.md`.
- **`concepts/quality-and-language-rules.md`** - the definition of a rule, rule files and ids, the shipped
  pack, project rules, `rules.disabled`, selection per role and file, `rules check` and the projection.
  Truth: `rules/`, `kernel/src/rules/` (`domain/rule.ts`, `use-cases/selection.ts`),
  `kernel/src/shared/store/state/rule.ts`.

### Reference (the lookup tables - highest drift rate)

- **`reference/skills.md`** - one section per user-invocable skill: purpose, arguments, artifact,
  when to use, related skills. Role skills get one collective paragraph.
  Truth: every `skills/*/SKILL.md` frontmatter and body. The most drift-prone page in the site: a new
  skill that is never added here is invisible to users (the coverage guard catches a missing section,
  not a wrong one).
- **`reference/agents.md`** - the agent count, the adapters and other agents tables, read-only enforcement.
  Truth: `agents/*.md` frontmatter, the `disallowed-tools` of `skills/stages/execute/`, `skills/stages/close/`,
  `skills/tools/cr/` and `skills/tools/pr-review/`. Contains an explicit count - count the files.
- **`reference/hooks.md`** - the SessionStart, PreToolUse, UserPromptExpansion and SessionEnd entries
  in order, the guard rules and gate outcomes.
  Truth: `hooks/hooks.json` (order matters and the page reproduces it), `hooks/*/`, the guard and
  gate tables of `openspec/specs/kernel-cli/hooks/spec.md`.
- **`reference/artifacts.md`** - the `.bdk/` layout, run state, the tracked/untracked block.
  Truth: `kernel/src/shared/store/` (Change layout, ignored paths), `.gitignore`.

### Standalone

- **`troubleshooting.md`** - failure modes, each quoting a real error string.
  Truth: the message strings in `hooks/guard/*.sh` and `kernel/src/hooks/`. A reworded error
  message orphans its section here - grep the quoted string in the source to confirm it still exists
  verbatim.

### Snippet pages - never hand-edit

- **`changelog.md`** - `<!--@include: ../../CHANGELOG.md-->`. `CHANGELOG.md` is release-please output.
- **`contributing/index.md`** - `<!--@include: ../../../CONTRIBUTING.md-->`. Edit `CONTRIBUTING.md` instead.

---

## Shared-facts index: stated in more than one place

Each row is one fact this repo repeats. Nothing enforces that the copies agree,
so they drift apart silently and a reader has no way to tell which copy to
trust. When a row's fact changes, every listed location changes with it; when
auditing, put the copies side by side and compare them directly rather than
checking each against the code in isolation. Site pages are named by their path
under `docs/guide/`.

| The fact                                                                                                       | Stated in                                                                                                                                  | Decided by                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| The agent count and the fleet roster                                                                           | `README.md`, `reference/agents.md`, `concepts/agents.md`, `STARTUP_INSTRUCTIONS.md`                                                        | `agents/*.md`                                                                                                       |
| How review agents are made read-only (`tools:` allowlist, **not** `disallowed-tools`, which only skills carry) | `index.md`, `README.md`, `reference/agents.md`, `concepts/agents.md`                                                                       | `agents/*.md` frontmatter; `skills/cr/SKILL.md`, `skills/pr-review/SKILL.md`                                        |
| The three tiers and which skill each enters at                                                                 | `README.md`, `index.md`, `STARTUP_INSTRUCTIONS.md`                                                                                         | the pipeline skills                                                                                                 |
| Which quality rule sets ship and are injected                                                                  | `STARTUP_INSTRUCTIONS.md`, `concepts/quality-and-language-rules.md`, `workflows/trivial.md`, `README.md`, `.claude/rules/skill-context.md` | `rules/<category>/`, `kernel/src/ctx/use-cases/manifest.ts`, the `INJECT:` markers in `skills/create-plan/SKILL.md` |
| The capture-conventions routing table                                                                          | `STARTUP_INSTRUCTIONS.md`, `index.md`, `concepts/shared-foundation.md`, `workflows/trivial.md`                                             | `skills/tools/rules/SKILL.md`                                                                                       |
| Verification proportionality and the `Verification: none` class                                                | `STARTUP_INSTRUCTIONS.md`, `.claude/rules/verification-scoping.md`, `concepts/verification-scoping.md`, `workflows/full-pipeline.md`       | `skills/create-plan/`, `skills/subagent-execute-plan/`, `skills/test-driven-development/`                           |
| When `/bdk:cr --inline` is the right mode                                                                      | `workflows/trivial.md`, `workflows/code-review.md`, `workflows/debugging.md`                                                               | `skills/cr/references/review-engine.md`                                                                             |
| The `.bdk/` tracked-vs-untracked block                                                                         | `getting-started/setup.md`, `reference/artifacts.md`                                                                                       | `.gitignore`                                                                                                        |
| The two BDK paths kept out of git (`/.bdk/.machine/`, `/.bdk/settings.local.yaml`)                             | `README.md` (Change state section, `config set` row)                                                                                       | `kernel/src/shared/store/ignore.ts`                                                                                 |
| The feature flag names                                                                                         | `getting-started/setup.md`, `README.md`                                                                                                    | `kernel/src/ctx/config.ts`                                                                                          |
| The groups of a `/bdk:cr` round                                                                                | `README.md`, `workflows/code-review.md`, `reference/skills.md`                                                                             | `kernel/src/review/domain/groups.ts`                                                                                |

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

1. **The sidebar in `docs/guide/.vitepress/sidebar.ts` lists exactly the pages under `docs/guide/`.**
   The guard in `kernel/tests/docs/coverage.test.ts` fails on an orphan page and on a sidebar entry
   without a page.
2. **Every relative `.md` link resolves, and so does its anchor.** Links are relative to the linking
   page (`../reference/skills.md`). The build fails on a dead link; `kernel/tests/docs/anchors.test.ts`
   fails on an anchor that names no heading. Anchors follow VitePress's slugification:
   `## /bdk:rules` becomes `#bdk-rules`. A link out of `docs/guide/` (to `README.md`) must be an
   absolute GitHub URL.
3. **Include paths resolve.** A `<!--@include: ...-->` line pointing at a moved file fails the build.
4. **Mermaid blocks are fenced as ` ```mermaid `** and follow `/bdk-craft:mermaid-drawer` (node budget,
   the shared palette).
5. **No em dash anywhere.** The site uses a plain `-`.
6. **Every page opens with the v2 banner** until T50, enforced by `kernel/tests/docs/banner.test.ts`.
7. **CI builds the site** (`.github/workflows/docs.yml`) on every pull request, and runs the guards
   in the kernel job's contract step.
