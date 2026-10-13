# Proposal

## Why

Tracks #406.

`/bdk:execute` runs the parts of one wave in parallel, each in its own git worktree. A worktree is not the project: it has no installed dependencies, no env files, no database, no ports of its own, and BDK cannot know in general how to set one up. On 2026-10-12 a test-only Change on a Next.js + Convex project put three parts into three worktrees; all three blocked on `environment` after about 17 minutes, with no code verified. Heavy checks (E2E, a server, a container) do not run in parallel on one machine either, and parallel parts need a merge, a conflict resolver and a wave check for work one agent does in one pass. The user decided: BDK does not split the implementation into worktrees.

## What Changes

- **BREAKING** `/bdk:execute` builds every part in the main checkout, one part at a time, in plan order (wave by wave, ascending part id within a wave): implement, conform, commit, next part. No part runs in a git worktree, no part branch is made, nothing is merged.
- **BREAKING** The plan part format loses `isolation`. `bdk plan check` reports a part that still holds it as a `frontmatter` problem; its `--json` result and its text lines lose the `isolation` field and column. The checks `overlap` and `shared-not-alone` go: they existed only for parallel writes.
- **BREAKING** `/bdk:resolve-conflict` is removed: its merge mode has no caller left. Its wave repair moves to a new block `/bdk:repair-wave` (`<change> <n> --base <commit>`), on `bdk:implementer`, with the same report `execute/wave-<n>.md`. A wave stays as an order and as the place of the wave check (the `wave` check point); a red wave check is still repaired by an agent, so `/bdk:run` does not stop on it.
- **BREAKING** `implement-part` and `conform-part` lose `--workdir`: they always work in the working directory.
- `execution.max-parallel` stays, now only for read-only agents (the reviewers of `/bdk:auto-review` and `/bdk:pr-review`, and the pull requests `/bdk:pr-review` reviews at once); its description changes. No other setting exists only for parallel writes.
- `plan-draft`, `plan-fixes`, `diagnose-bug` and the `bdk` OpenSpec schema write parts without `isolation`; `plan-draft` no longer keeps the parts of one wave on disjoint files.
- Eval cases: `execute-main-checkout` (the acceptance case: a three-part plan built in the main checkout, in order, one commit per part, no `git worktree` call), `execute-wave-check` and `execute-resume-main-checkout` updated, `repair-wave-dated` replaces `resolve-conflict-wave`; `execute-single-part-wave`, `execute-resume-worktree`, `execute-wave-conflict` and `resolve-conflict-two-functions` are removed with the behaviour they measured.

## Resolved here (from "To resolve in the spec")

- What a wave means when parts run in sequence: an order and the place of the wave check. Waves keep `depends-on` visible in the plan, and the wave check runs the `wave` point (the whole suite, the type check) once per wave instead of once per part. A red wave check is repaired by `/bdk:repair-wave` (design D3; chosen by the user over "no repair" and "keep `resolve-conflict --wave`").
- What happens to `resolve-conflict` outside `--wave`: nothing calls it (only `execute-waves` merged part branches), so it is removed with its merge mode, its report `execute/merge-<id>.md` and its check id `merge-<id>`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-execute`: parts run one at a time in the main checkout; no worktree, branch or merge; the wave check repairs through `repair-wave`; the result drops merges.
- `bdk-execute-blocks`: `resolve-conflict` removed, `repair-wave` added; `--workdir` removed from `implement-part` and `conform-part`.
- `bdk-plan-blocks`: `plan-draft` writes parts without `isolation` and without the disjoint-files rule.
- `bdk-cli/plan`: `isolation` is no longer a part key (a part holding it has a `frontmatter` problem); `overlap` and `shared-not-alone` removed; output without isolation.
- `bdk-cli/config`: the description of `execution.max-parallel`.
- `bdk-openspec-schema`: the part frontmatter loses `isolation`.
- `bdk-auto-review`: fix parts carry no `isolation` and no disjoint-files rule.
- `bdk-debug`: the fix part `diagnose-bug` writes carries no `isolation`.
- `docs-site`: the plan Concepts, the problem list and the execute diagrams follow the new flow.
- `skill-evals`: the execute cases that run end to end.

## Impact

- Code: `plugins/bdk/src/plan/` (domain, schema, render, tests), `plugins/bdk/src/config/domain/settings.ts` and its tests, `plugins/bdk/tests/plan.test.ts`, `plugins/bdk/tests/openspec-schema.test.ts`.
- Skills and agents: `execute`, `execute-waves`, `implement-part`, `conform-part`, `resolve-conflict` (removed), `repair-wave` (new), `plan-draft` and its part example, `plan-fixes`, `diagnose-bug`, `agents/implementer.md`, `agents/lead.md`; the shipped schema `plugins/bdk/openspec/schemas/bdk/` (`schema.yaml`, `templates/part.md`).
- Evals: the cases above and every fixture or case file that writes a part with `isolation`; `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/orchestrators.md` (the execute diagrams and the check table), `docs/concepts/run-state.md` (the run directory tree, the file table, the Execute sequence), `docs/concepts/stages.md` (how a plan is cut), `docs/concepts/agents.md` (the blocks table), `docs/concepts/cli-config-hooks.md` (callers of `bdk check run`, the `execution.max-parallel` row), `docs/concepts/glossary.md` (Wave), `docs/guide/workflow.md`, `docs/guide/configuration.md` and `docs/guide/footprint.md`; Reference regenerated with `pnpm docs:reference`.
- Migration: an execute run started with an earlier BDK that left part worktrees or `bdk/<change>/part-*` branches is not resumed from them; finish or discard it before upgrading (named in the release note through `BREAKING CHANGE:`).
- Out of scope: how a check command runs and what the transcript shows of it (#408).
