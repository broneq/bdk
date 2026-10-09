## Why

Tracks #314. An unexpected error inside `skill-check` (a discovery failure such as the `ENOENT` of #310, or a plugin rule that throws) escapes `main`, so Node prints a stack trace and exits 1, the code the `skill-kit` spec reserves for "an error-severity finding remains". A CI job or the `/bdk-skill-kit:skill-check` skill then reads a crash as ordinary findings, with no finding to fix.

## What Changes

- `skill-check` reports any error other than a usage or configuration error as one line `skill-check: internal error: <message>` on stderr and exits 3, a code of its own.
- An error thrown by a rule names the rule and the file it was checking in that message, so a broken plugin rule is found from the one line.
- The stack trace stays hidden unless the environment variable `SKILL_CHECK_DEBUG` is set to a non-empty value; then it follows the line on stderr.
- `--help` lists exit 3 and `SKILL_CHECK_DEBUG`; the `skill-check` skill tells the model what exit 3 means.
- A new eval case `skill-check-internal-error` measures that the skill reads exit 3 as a failure of the checker, not as findings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-kit`: "Invocation and exit codes" gains exit 3 for an internal error, its stderr line and `SKILL_CHECK_DEBUG`.

## Impact

- Code: `plugins/bdk-skill-kit/src/main.ts`, `src/runner.ts`, `src/main.test.ts`.
- Skill: `plugins/bdk-skill-kit/skills/skill-check/SKILL.md`; new eval case under `plugins/bdk-skill-kit/evals/`.
- Docs: `plugins/bdk-skill-kit/README.md` names exit 3. No `docs/guide/` or `docs/concepts/` page describes `skill-check` or its exit codes, so none changes; the Reference is regenerated with `pnpm docs:reference` (its skill description is unchanged).
- Compatibility: a caller that treated every non-zero, non-2 code as findings now sees 3 for a crash; that is the point of the change. Exit 0, 1 and 2 keep their meaning.
- Out of scope: the absolute `dirs` entry crash itself is #310.
