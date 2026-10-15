## Why

Tracks #415. `skill-check` (bdk-skill-kit) runs in CI only on the kit's own skill: there is no `skill-check.config.*` at the repository root, so nothing checks the skills and agents of `bdk`, `bdk-craft`, `bdk-explain` or `git-identity`. Run over every plugin, it reports 6 errors and 12 warnings today, and nothing stops more from landing.

## What Changes

- Fix the errors:
  - `bdk/skills/diagnose-run`: the description holds the tag-like `<change>`, which hosts reject in a description.
  - `bdk/skills/execute-waves`: the body names the model `opus` twice (the default of `policy.escalation.model` and an example result line); name the capability and let `bdk config show` print the value.
  - `bdk/skills/spec-conformance`: the example `/tmp/ledger.json` is an absolute path.
  - `git-identity/skills/profile-add`: the placeholder `<absolute path to the user's ~/.gitconfig>` is read as a home-relative path.
- Resolve the warnings (`description-front-loaded`, no trigger clause):
  - The lead skills `execute-waves`, `pr-review-round` and `review-round` get a `Use when ...` clause, like every other block that only an agent starts (`implement-part`, `repair-wave`, `judge`).
  - The three `git-identity` skills get a `Use when ...` clause.
  - `bdk-craft` and `bdk-explain` keep their admitted descriptions (each was measured by a with/without eval); their trigger clause reads `Load it when|before ...`, so the root config accepts that form for those two plugins through the rule's `trigger` option.
- Add a root `skill-check.config.ts` that checks the `skills/` and `agents/` directories of every plugin under `plugins/`, found by listing the directory, so a new plugin is covered without editing the config.
- Add a workspace test that runs the built `skill-check` with that config in strict mode (warnings fail too); it runs in `pnpm test`, so in the `check` job of PR CI.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `repo-sdlc`: new requirement - every plugin's skills and agents pass `skill-check` in strict mode in the `check` job.

## Impact

- Files: `skill-check.config.ts` (new), `tests/skill-check.test.ts` (new), six `SKILL.md` files of `bdk`, three of `git-identity`.
- Users: only skill descriptions and wording change; the Reference is regenerated with `pnpm docs:reference`. No Guide or Concepts page describes these descriptions, so none changes.
- Out of scope: the kit's own stricter self-check (`plugins/bdk-skill-kit/skill-check.config.ts`) stays as it is.
