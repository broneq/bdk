## 1. Check in CI

- [x] 1.1 Write `tests/skill-check.test.ts`: runs the built `skill-check --strict` with the root config and expects exit 0; see it fail (no config yet)
- [x] 1.2 Add the root `skill-check.config.ts` (one skills and one agents target per plugin found under `plugins/`, `trigger` option for `bdk-craft` and `bdk-explain`); see the test fail on today's findings

## 2. Fix the findings

- [x] 2.1 `bdk/skills/diagnose-run`: no `<change>` in the description
- [x] 2.2 `bdk/skills/execute-waves`: no model name in the body; add a trigger clause
- [x] 2.3 `bdk/skills/pr-review-round`, `bdk/skills/review-round`: add a trigger clause
- [x] 2.4 `bdk/skills/spec-conformance`: no absolute path in the example
- [x] 2.5 `git-identity/skills/profile-add`, `status`, `use`: no home-relative path; add a trigger clause
- [x] 2.6 The test passes

## 3. Docs

- [x] 3.1 No Guide or Concepts page names these descriptions; regenerate the Reference with `pnpm docs:reference`

## 4. Gates

- [x] 4.1 `pnpm check`, `openspec validate --specs --strict`, `claude plugin validate --strict` on every plugin
