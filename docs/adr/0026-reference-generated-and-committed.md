---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - scripts/docs-reference.test.ts
  - scripts/docs-impact/rule.test.ts
  - .github/workflows/docs.yml
---

# ADR-0026: The Reference is generated from the plugin sources and committed

## Context and Problem Statement

The docs site has a Reference section per plugin: every skill, agent, hook, `bdk` command, settings key and rule of the rule pack, with the facts a user looks up. Those facts live in the plugin sources (frontmatter, `hooks.json`, the command declarations, the settings schema, the rule files) and change in almost every PR. A hand-written Reference goes stale; a Reference built only at deploy time is never seen in review. How does the Reference stay true to the sources?

This is an explicit exception to [ADR-0002](0002-v3-repo-structure-and-release.md), whose driver is "no generated files in PRs" (with `pnpm-lock.yaml` as its only named exception).

## Decision Drivers

- **Never stale:** a Reference entry that no longer matches its source is a defect a user acts on.
- **Visible in review:** a reviewer sees what a change does to the user-facing facts.
- **Deploy on change:** the site deploys when `docs/**` changes on `main` (`docs.yml`); a plugin-only change must reach it too.
- **Parallel PRs:** 5-10 agent sessions open PRs at once (ADR-0002), and a generated file in each is a merge conflict waiting.

## Considered Options

1. **Generated and committed:** `pnpm docs:reference` writes `docs/reference/**`; the pages are committed, never edited by hand, and a test fails on drift.
2. **Generated at build time** only, never committed (VitePress data loaders or a pre-build step).
3. **Hand-written**, with a coverage test that every source item has an entry.

## Decision Outcome

**Chosen option: 1.** `pnpm docs:reference` (`scripts/docs-reference.ts`) writes the Reference pages of every plugin under `plugins/` from its sources: skills from their `SKILL.md` frontmatter, agents from theirs, hooks from `hooks.json`, `bdk` commands from their declarations (what `--help` prints), settings keys from the settings schema, and the rules of the rule pack from their files. The generator fails and names an item that lacks a field its entry needs. Every page says at its top that it is generated. The pages are committed. `scripts/docs-reference.test.ts`, run by `pnpm check`, regenerates them in memory and fails, naming each page that differs and the command to run, when the committed pages differ from the sources.

The docs-impact rule does not count a change under `docs/reference/` as a docs change: regenerating the Reference never stands in for updating the Guide or Concepts.

It is the only option that shows the Reference diff in the PR that causes it and deploys the site on a plugin-only change, without letting the pages drift.

### Consequences

- ✅ A reviewer sees every changed skill description, flag or default as a diff of the Reference.
- ✅ A plugin change that changes the Reference touches `docs/**`, so the `docs` job builds it and `docs.yml` deploys it after the merge.
- ❌ Parallel PRs that change the same plugin conflict on the generated pages; the fix is to regenerate after the merge, never to merge the text by hand.
- ❌ One more step before a PR (`pnpm docs:reference`), caught by `pnpm check` when forgotten.
- 🟡 Moving to option 2 later means changing the `docs` job and `docs.yml` path filters, the deploy trigger, the drift test and the docs-impact rule together.

## Pros and Cons of the Options

### 1 - Generated and committed

- Good: diff in review; deploy on change; drift fails `pnpm check`.
- Bad: generated files in PRs, against ADR-0002's driver; conflicts between parallel PRs.

### 2 - Generated at build time

- Good: no generated files in git.
- Bad: the reviewer never sees the result; the deploy path filters miss a plugin-only change unless they watch every plugin source.

### 3 - Hand-written with a coverage test

- Good: free-form pages.
- Bad: a test can check that an entry exists, not that its facts are current; every source change is a manual docs edit.
