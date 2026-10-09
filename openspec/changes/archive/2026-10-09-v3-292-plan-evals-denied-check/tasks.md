# Tasks

## 1. Skill wording and spec

- [x] 1.1 Word the check block of `plugins/bdk/skills/plan/SKILL.md` as an unquoted, single command. Verify: `plan-verify-written` and `plan-budget-spent` score 1.00 over 3 runs each (`pnpm --filter @bdk/bdk run eval --ablation none --tag orchestrator --runs 3 --allow-tools Write Edit "Bash(*/bin/bdk *)" --case '<case>'`, clean HOME of the eval README).
- [x] 1.2 Merge the delta spec into `openspec/specs/bdk-plan/spec.md` (`/opsx:sync`). Verify: `openspec validate --specs --strict`.

## 2. Docs

- [x] 2.1 No Guide or Concepts page changes (no user-visible change); the PR body says `Docs-impact: none - ...`. Verify: `pnpm docs:reference` leaves no diff.
