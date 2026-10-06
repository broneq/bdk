## 1. Lavish page names

- [x] 1.1 Add a failing case to `kernel/tests/contract/stage-skills.test.ts`: `fragments/decision/lavish.md` names a file name no earlier ask used and why. Verify: it fails on the current fragment. (The `ctx-skill-output` snapshot renders the Lavish-off fragment, so it does not cover this text.)
- [x] 1.2 Write the sentence into step 2 of the fragment (design D1). Verify: 1.1 passes.

## 2. Setup "Apply"

- [x] 2.1 Add a failing case to `kernel/tests/contract/stage-skills.test.ts`: the `## Apply` section holds no numbered list item and names the v2 ignore rule before the first `bdk config set` and the lint run after the commands and exclusions. Verify: it fails on the numbered list.
- [x] 2.2 Rewrite "Apply" in `skills/stages/setup/SKILL.md` as design D2 says. Verify: 2.1 passes, the existing setup cases stay green, `pnpm skill-check` clean.

## 3. Specs and acceptance

- [x] 3.1 Sync the `stage-skills` delta into `openspec/specs/stage-skills/spec.md`. Verify: `openspec validate --specs --strict`.
- [x] 3.2 Check the acceptance signal: `node dist/bdk.mjs ctx skill design` in a git directory with `features.lavish` on and `lavish-axi` on PATH prints the per-ask file name sentence; the full gates pass; run `openspec validate v3-161-lavish-page-names --strict`.
