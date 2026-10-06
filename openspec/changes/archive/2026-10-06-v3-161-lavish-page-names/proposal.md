# Proposal

## Why

Scope: #161. Tracks #161.

Two findings of the T56 acceptance runs (#147, #155). Lavish remembers a session by the page's file path and never reopens a path whose session the user ended, even after the file is written again; `/bdk:setup` hit it and now stamps its page name, but `fragments/decision/lavish.md`, which every other skill asking through Lavish follows, names only the directory. And setup's "Apply" is a numbered six-step script, against the repository rule in `.claude/rules/prompts.md` to give the whole task up front; only two of its orderings are real.

## What Changes

- `fragments/decision/lavish.md`: a page gets a file name of its own per ask, with the reason.
- `skills/stages/setup/SKILL.md` "Apply": the writes as an unnumbered list, preceded by the two orderings that matter (the v2 ignore rule before the first `bdk config set`; the lint run after the commands and the exclusions).
- The `ctx skill` output snapshot follows the fragment.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `stage-skills`: "Asking the user in two tiers" requires a fresh page file name per Lavish ask; "setup asks on one page" states the two orderings instead of a full write order.

## Impact

`fragments/decision/lavish.md`, `skills/stages/setup/SKILL.md`, `kernel/tests/contract/stage-skills.test.ts`, the `ctx-skill-output` contract snapshot, `openspec/specs/stage-skills/spec.md`. No kernel code, no schema, no setting.
