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

`README.md` is a synopsis: what BDK is, installation, the quick start, the
pipeline in brief and the skills table. Every reference detail (settings,
Change state, the artifact graph, plan parts, tickets) lives on the site, so a
source change re-checks the site page first and the README only when the
synopsis itself moved.

---

## Reverse index: source -> pages at risk

| You changed                                                                                                                                                     | Re-check these pages                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skills/<name>/SKILL.md` frontmatter (name, `argument-hint`, `user-invocable`, `model`, `allowed-tools`, `disallowed-tools`)                                    | `reference/skills.md` (the skill's own section), plus the workflow page that narrates it                                                                                                             |
| A skill added, renamed, or retired under `skills/`                                                                                                              | `reference/skills.md`, `index.md` (pipeline diagram + profile table), `README.md` skills table, the owning workflow page, `getting-started/migration-from-v2.md` (Skills) when a v2 skill maps to it |
| `skills/stages/change/`, `design/`, `plan/`, `verify-design/`, `verify-plan/`, `execute/`, `close/`, `run/`, `skills/tools/cr/` bodies                          | `workflows/tiny.md`, `workflows/small.md`, `workflows/large.md`, `getting-started/first-feature.md`, `concepts/change-pipeline.md`                                                                   |
| `skills/tools/cr/`, `skills/tools/pr-review/` (modes, flags, rounds, `disallowed-tools`)                                                                        | `workflows/code-review.md`, `reference/skills.md`, `reference/agents.md` (read-only enforcement section)                                                                                             |
| `plugins/bdk-craft/skills/debugging/`                                                                                                                           | `workflows/debugging.md`                                                                                                                                                                             |
| `skills/tools/adr/`, `skills/tools/docs/`, `plugins/bdk-craft/skills/mermaid-drawer/`                                                                           | `workflows/docs-and-decisions.md`, `reference/skills.md`                                                                                                                                             |
| `skills/tools/rules/`                                                                                                                                           | `workflows/rules-hygiene.md`, `reference/skills.md`                                                                                                                                                  |
| `skills/tools/diagnose/`, `kernel/src/diagnostics/`                                                                                                             | `workflows/diagnostics.md`, `reference/configuration.md` (Diagnostics)                                                                                                                               |
| `skills/stages/setup/` (including `references/v2-migration.md`)                                                                                                 | `getting-started/setup.md`, `getting-started/installation.md`, `getting-started/migration-from-v2.md`                                                                                                |
| `skills/roles/` and `swarm` (the `user-invocable: false` set)                                                                                                   | `reference/skills.md` (collective role-skill paragraph), `concepts/agents.md` (roles and adapters)                                                                                                   |
| `agents/*.md` added, retired, or model/`tools:` changed                                                                                                         | `reference/agents.md` (the tables + the agent count), `concepts/agents.md`, `STARTUP_INSTRUCTIONS.md` agents table (regenerated by `bdk ctx startup`)                                                |
| `STARTUP_INSTRUCTIONS.md`                                                                                                                                       | `concepts/context.md`, `concepts/verification-scoping.md`, `concepts/agents.md`, `workflows/tiny.md`                                                                                                 |
| `kernel/src/ctx/` (manifest, sections), `kernel/src/dispatch/` (packages), `fragments/`                                                                         | `concepts/context.md`, `reference/configuration.md` (Prompts)                                                                                                                                        |
| `kernel/src/rules/`, `rules/`                                                                                                                                   | `concepts/quality-and-language-rules.md`, `workflows/rules-hygiene.md`, `reference/configuration.md` (Rules)                                                                                         |
| `kernel/src/registrations.ts`, `schema/settings.json` (settings keys)                                                                                           | `reference/configuration.md` (every key; `kernel/tests/docs/configuration.test.ts` catches a missing one, not a wrong one), `getting-started/setup.md`, `concepts/verification-scoping.md`           |
| `kernel/src/change/`, `log/`, `measure/`, `query/`, `service/` (`rebuild`), `kernel/src/shared/store/` (Change layout, index, markers, ignored paths)           | `concepts/change-pipeline.md` (The Change, Profiles, Two Changes at once), `reference/artifacts.md`, `getting-started/setup.md`                                                                      |
| `kernel/src/graph/`, `pipeline/` (nodes, kinds, templates, `policy.gates`, the four graph commands)                                                             | `concepts/change-pipeline.md` (The artifact graph, Gates), `reference/hooks.md` (UserPromptExpansion)                                                                                                |
| `kernel/src/part/`, `kernel/src/commit/`, the plan task grammar (`kernel/src/shared/store/state/plan.ts`), BDK trailers (`kernel/src/shared/store/progress.ts`) | `concepts/change-pipeline.md` (Plan parts), `concepts/verification-scoping.md`, `concepts/worktree-parts.md`                                                                                         |
| `kernel/src/attempt/`, `kernel/src/dispatch/domain/checks.ts`, `log ingest`, `policy.budgets`, `policy.oscillation`, `policy.escalation`                        | `concepts/change-pipeline.md` (Tickets and the escalation ladder, Evidence), `concepts/verification-scoping.md`, `reference/configuration.md` (Pipeline)                                             |
| `kernel/src/shared/store/worktree.ts`, `kernel/src/graph/domain/wave.ts` (isolation, merge back)                                                                | `concepts/worktree-parts.md`                                                                                                                                                                         |
| `hooks/hooks.json`, `hooks/guard/`, `kernel/src/hooks/`                                                                                                         | `reference/hooks.md`, `concepts/context.md`, `workflows/tiny.md`, `troubleshooting.md`                                                                                                               |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`                                                                                                 | `getting-started/installation.md`, `getting-started/migration-from-v2.md` (Steps)                                                                                                                    |
| `.gitignore` (the `.bdk/` entries)                                                                                                                              | `reference/artifacts.md`, `getting-started/setup.md` - both embed the tracked/untracked block                                                                                                        |
| `docs/guide/.vitepress/`, `.github/workflows/docs.yml`                                                                                                          | `contributing/index.md` includes `CONTRIBUTING.md` - edit `CONTRIBUTING.md`, never the page                                                                                                          |
| `CONTRIBUTING.md`                                                                                                                                               | nothing to edit under `docs/guide/` - `contributing/index.md` is a snippet include                                                                                                                   |
| `evals/` (suites, the `pnpm eval` commands and modes, providers)                                                                                                | `contributing/evals.md` (`kernel/tests/docs/evals.test.ts` catches an unnamed suite), `evals/README.md` synopsis, `CONTRIBUTING.md`                                                                  |
| `CHANGELOG.md`                                                                                                                                                  | nothing, ever - auto-generated by release-please, and `changelog.md` is a snippet include                                                                                                            |
| `README.md`                                                                                                                                                     | `index.md` (they make overlapping claims and drift apart)                                                                                                                                            |

---

## Page index: what each page asserts

Format: page - what it is for - the files that decide whether it is true.

### Entry points

- **`index.md`** - the pitch, the "Why BDK" bullet list, the pipeline mermaid, the profile table.
  Truth: `skills/` directory listing, `pipeline/pipeline.yaml`, `README.md`. Every bullet links into a
  concept or workflow page, so a retired page breaks this one first.
- **`getting-started/installation.md`** - Node, the two install commands, the `bdk` launcher, what
  changes in your sessions.
  Truth: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `bin/bdk`, `hooks/hooks.json`.
- **`getting-started/setup.md`** - `/bdk:setup` phases, the toolchain it derives, what gets written to
  `.bdk/`, the tracked-vs-untracked block.
  Truth: `skills/stages/setup/SKILL.md`, `kernel/src/registrations.ts`, `.gitignore`.
- **`getting-started/first-feature.md`** - one `small` Change from `/bdk:change` to `/bdk:close`, with
  what each stage leaves and where you decide.
  Truth: the stage skills' bodies, `pipeline/pipeline.yaml`. It quotes artifact paths and the review
  order, so it goes stale on any change to a stage's phases or artifact naming.
- **`getting-started/migration-from-v2.md`** - the one-time move from BDK 2: steps, the v2 ignore rule,
  the settings, skills, agents and artifacts maps, what is not migrated. The only page allowed to name
  v2 skills and paths (`kernel/tests/docs/shipped.test.ts` enforces that).
  Truth: `skills/stages/setup/references/v2-migration.md`, `skills/stages/setup/SKILL.md`, the
  `skills/` and `agents/` listings.

### Workflows (narrative "how you use it")

- **`workflows/tiny.md`** - when a Change is `tiny`, its stages, the measurement that flags an outgrown
  one, raising the profile, an edit with no Change.
  Truth: `skills/stages/change/`, `kernel/src/measure/`, `pipeline/pipeline.yaml`.
- **`workflows/small.md`** - what each stage leaves, where you step in, "when it goes sideways", gates
  on autopilot.
  Truth: the stage skills, `kernel/src/graph/`, `hooks/hooks.json` (UserPromptExpansion).
- **`workflows/large.md`** - how a Change becomes `large`, design parts, `spec-impact`, execution as
  one part agent per plan part, the grouped review.
  Truth: `skills/stages/design/`, `skills/stages/execute/`, `skills/roles/implementer/`,
  `skills/roles/conformer/`, `kernel/src/graph/`, `kernel/src/check/`, `kernel/src/review/domain/groups.ts`.
- **`workflows/debugging.md`** - a bug Change, and the `bdk-craft` debugging process inside it.
  Truth: `plugins/bdk-craft/skills/debugging/SKILL.md`, `kernel/src/dispatch/` (the `Craft` section).
- **`workflows/code-review.md`** - the review Change, the range, a round, triage and the fix loop, `--inline`, PR review.
  Truth: `skills/tools/cr/SKILL.md`, `skills/tools/pr-review/SKILL.md`, `kernel/src/review/`.
- **`workflows/docs-and-decisions.md`** - ADRs, module explanations, doc refresh, diagrams.
  Truth: `skills/tools/adr/`, `skills/tools/docs/`, `plugins/bdk-craft/skills/mermaid-drawer/`.
- **`workflows/rules-hygiene.md`** - learnings, the audit with `rules stats`, `rules accept`, `rules prune`,
  and why hand-written `.claude/rules/` stays Claude Code's.
  Truth: `skills/tools/rules/`, `kernel/src/rules/`, `STARTUP_INSTRUCTIONS.md` capture conventions table.
- **`workflows/diagnostics.md`** - the run journal, the verbose log, `/bdk:diagnose`.
  Truth: `skills/tools/diagnose/`, `kernel/src/diagnostics/`, `hooks/hooks.json`.

### Concepts (the "why")

- **`concepts/change-pipeline.md`** - the Change and its directory, profiles, the artifact graph and
  its commands, gates, plan parts and trailers, tickets and the escalation ladder, evidence, roles and
  dispatch packages, living specs, two Changes at once.
  Truth: `pipeline/pipeline.yaml`, `kernel/src/change/`, `kernel/src/graph/`, `kernel/src/part/`,
  `kernel/src/commit/`, `kernel/src/attempt/`, `kernel/src/evidence/`, `kernel/src/spec/`,
  `kernel/src/shared/store/`, `openspec/specs/`.
- **`concepts/context.md`** - the session foundation, a skill's context lines, dispatch packages,
  capture conventions.
  Truth: `STARTUP_INSTRUCTIONS.md`, `hooks/hooks.json`, `kernel/src/ctx/`, `kernel/src/dispatch/`.
- **`concepts/verification-scoping.md`** - proportionality, the `Verification: none` class, the
  runner's checks and command forms, freshness, anti-patterns.
  Truth: `openspec/specs/kernel-state/spec.md` (Plan part and plan index: the `Verification: none`
  class), `openspec/specs/kernel-settings/spec.md` (Keys of evidence policy: the file-class
  partition), `kernel/src/dispatch/domain/checks.ts`, `kernel/src/evidence/`, `skills/roles/runner/`.
- **`concepts/worktree-parts.md`** - when a part gets `isolation: worktree`, how it is built and merged
  back.
  Truth: `kernel/src/shared/store/worktree.ts`, `kernel/src/graph/domain/wave.ts`, `skills/stages/plan/`.
- **`concepts/agents.md`** - roles and adapters, model-as-cost, read-only enforcement, how an agent
  reads its context, structured returns, `SendMessage` vs respawn, the tree.
  Truth: `agents/*.md`, `skills/roles/`, `kernel/src/export/domain/adapters.ts`, `STARTUP_INSTRUCTIONS.md`.
- **`concepts/quality-and-language-rules.md`** - the definition of a rule, rule files and ids with `paths`
  and `stages`, the shipped pack, project rules, `rules.disabled`, the stage readers table and the selection
  per stage and file, `rules check`, and the notes for projects whose rules use `applies` or `roles` or that
  used the removed import and export.
  Truth: `rules/`, `kernel/src/rules/` (`domain/rule.ts`, `use-cases/selection.ts`),
  `kernel/src/shared/store/state/rule.ts`.

### Reference (the lookup tables - highest drift rate)

- **`reference/skills.md`** - one section per user-invocable skill: purpose, arguments, artifact,
  when to use, related skills. Role skills get one collective paragraph.
  Truth: every `skills/*/SKILL.md` frontmatter and body. The most drift-prone page in the site: a new
  skill that is never added here is invisible to users (the coverage guard catches a missing section,
  not a wrong one).
- **`reference/configuration.md`** - the settings layers and how they merge, then every key by
  section with its default.
  Truth: `kernel/src/registrations.ts` and each slice's `config.ts`, `bdk config schema`. The guard
  `kernel/tests/docs/configuration.test.ts` fails on a registered key the page does not name; a wrong
  default or description it does not catch.
- **`reference/agents.md`** - the agent count, the adapters and other agents tables, read-only enforcement.
  Truth: `agents/*.md` frontmatter, the `disallowed-tools` of `skills/stages/execute/`, `skills/stages/close/`,
  `skills/tools/cr/` and `skills/tools/pr-review/`. Contains an explicit count - count the files.
- **`reference/hooks.md`** - the SessionStart, PreToolUse, UserPromptExpansion and SessionEnd entries
  in order, the agent hooks (SubagentStart, SubagentStop, PostToolUse, PostToolUseFailure, Stop), the
  guard rules and gate outcomes.
  Truth: `hooks/hooks.json` (order matters and the page reproduces it), `hooks/*/`, the guard and
  gate tables of `openspec/specs/kernel-cli/hooks/spec.md`.
- **`reference/artifacts.md`** - the `.bdk/` layout, the Change directory, `.bdk/.machine/`, the
  tracked/untracked block.
  Truth: `kernel/src/shared/store/` (Change layout, ignored paths), `.gitignore`.

### Standalone

- **`troubleshooting.md`** - failure modes, each quoting a real error string.
  Truth: the message strings in `hooks/guard/*.sh` and `kernel/src/hooks/`. A reworded error
  message orphans its section here - grep the quoted string in the source to confirm it still exists
  verbatim.

### Snippet pages - never hand-edit

- **`changelog.md`** - `<!--@include: ../../CHANGELOG.md-->`. `CHANGELOG.md` is release-please output.
- **`contributing/index.md`** - `<!--@include: ../../../CONTRIBUTING.md-->`. Edit `CONTRIBUTING.md` instead.

### Contributing

- **`contributing/evals.md`** - the measurement harness: when to measure, the suites, probe before the
  full series, with-without, providers and their facts, committed results.
  Truth: `evals/harness/`, `evals/suites/` (every suite named, enforced by
  `kernel/tests/docs/evals.test.ts`), the `eval` scripts in `package.json`.

---

## Shared-facts index: stated in more than one place

Each row is one fact this repo repeats. Nothing enforces that the copies agree,
so they drift apart silently and a reader has no way to tell which copy to
trust. When a row's fact changes, every listed location changes with it; when
auditing, put the copies side by side and compare them directly rather than
checking each against the code in isolation. Site pages are named by their path
under `docs/guide/`.

| The fact                                                                                                       | Stated in                                                                                                               | Decided by                                                                                                   |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| The agent count and the fleet roster                                                                           | `reference/agents.md`, `concepts/agents.md`, `STARTUP_INSTRUCTIONS.md`                                                  | `agents/*.md`                                                                                                |
| How review agents are made read-only (`tools:` allowlist, **not** `disallowed-tools`, which only skills carry) | `index.md`, `reference/agents.md`, `concepts/agents.md`                                                                 | `agents/*.md` frontmatter; `skills/tools/cr/SKILL.md`, `skills/tools/pr-review/SKILL.md`                     |
| The three profiles, their thresholds and their stages                                                          | `README.md`, `index.md`, `concepts/change-pipeline.md`, `workflows/tiny.md`, `workflows/small.md`, `workflows/large.md` | `pipeline/pipeline.yaml`, `kernel/src/measure/`, `skills/stages/change/`                                     |
| Which quality rule sets ship and are injected                                                                  | `STARTUP_INSTRUCTIONS.md`, `concepts/quality-and-language-rules.md`, `README.md`                                        | `rules/<category>/`, `kernel/src/ctx/use-cases/manifest.ts`, `kernel/src/dispatch/`                          |
| The capture-conventions routing table                                                                          | `STARTUP_INSTRUCTIONS.md`, `concepts/context.md`, `workflows/rules-hygiene.md`                                          | `skills/tools/rules/SKILL.md`                                                                                |
| Verification proportionality and the `Verification: none` class                                                | `STARTUP_INSTRUCTIONS.md`, `concepts/verification-scoping.md`, `concepts/change-pipeline.md`, `workflows/tiny.md`       | `skills/stages/plan/SKILL.md`, `skills/stages/execute/`, `kernel/src/part/`, `plugins/bdk-craft/skills/tdd/` |
| When `/bdk:cr --inline` is the right mode                                                                      | `workflows/code-review.md`, `workflows/debugging.md`                                                                    | `skills/tools/cr/SKILL.md`                                                                                   |
| The `.bdk/` tracked-vs-untracked block                                                                         | `getting-started/setup.md`, `reference/artifacts.md`                                                                    | `.gitignore`                                                                                                 |
| The two BDK paths kept out of git (`/.bdk/.machine/`, `/.bdk/settings.local.yaml`)                             | `concepts/change-pipeline.md`, `reference/artifacts.md`, `reference/configuration.md` (Layers)                          | `kernel/src/shared/store/ignore.ts`                                                                          |
| The four settings layers and their order                                                                       | `README.md`, `reference/configuration.md` (Layers)                                                                      | `kernel/src/config/`                                                                                         |
| The gate mechanism (only a typed command or policy passes a gate)                                              | `index.md`, `README.md`, `concepts/change-pipeline.md`, `workflows/small.md`, `reference/hooks.md`                      | `kernel/src/hooks/`, `kernel/src/graph/`                                                                     |
| The groups of a `/bdk:cr` round                                                                                | `workflows/code-review.md`, `workflows/large.md`, `reference/skills.md`                                                 | `kernel/src/review/domain/groups.ts`                                                                         |

Two of these have already drifted at least once, which is why the index exists:
the read-only mechanism row (`index.md` and `README.md` attributed it to
`disallowed-tools`, which no agent carries) and the rule-sets row
(`STARTUP_INSTRUCTIONS.md` named four of the six files in `rules/`).

The "stated in" column is itself a claim that drifts. The rule-sets row was
written with three locations and an audit turned up three more, including
`workflows/trivial.md` (since retired). So when you verify a row, grep for a distinctive
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
6. **Every `bdk` command a page names exists**, enforced by `kernel/tests/docs/commands.test.ts`
   against the command registry, and no page but `getting-started/migration-from-v2.md` names a v2
   skill or path, enforced by `kernel/tests/docs/shipped.test.ts`.
7. **CI builds the site** (`.github/workflows/docs.yml`) on every pull request, and runs the guards
   in the kernel job's contract step.
