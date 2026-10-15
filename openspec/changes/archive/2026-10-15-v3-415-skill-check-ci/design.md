## Context

`bdk-skill-kit` ships `skill-check`; only its own skill is checked, by its self-check test. The other plugins are unchecked (#415, found in #410).

## Goals / Non-Goals

**Goals:** no error or warning on any plugin's skills and agents; CI keeps it so.

**Non-Goals:** new rules or project policy rules (`forbidden-text`, `namespaced-refs`); changing the kit's self-check.

## Decisions

### D1: One root config, plugins found by listing `plugins/`
`skill-check.config.ts` at the root lists `plugins/*/skills` and `plugins/*/agents` with `readdirSync`, one skills and one agents target per plugin. A new plugin is checked with no edit.
- Alternative: one config per plugin. Lost: five configs to keep in step, and a new plugin is unchecked until someone adds one - the gap this issue is about.
- Alternative: a fixed list of directories. Lost for the same reason.

### D2: A workspace test, not a CI step
`tests/skill-check.test.ts` spawns `plugins/bdk-skill-kit/dist/skill-check.mjs --strict` (built by the kit's `vitest.setup.ts` before any test) and asserts exit 0, printing the findings on failure. It runs in `pnpm test`, so in `pnpm check` locally and in the `check` job.
- Alternative: a step in `pr.yml` after `pnpm build`. Lost: `pnpm check` would not run it, so a contributor sees it only in CI.

### D3: Strict mode
Warnings fail too: today's warnings are all resolved, and a warning nobody must fix grows back.

### D4: Lead skills carry a trigger clause (issue: "To resolve in the spec")
`execute-waves`, `pr-review-round` and `review-round` are started by `bdk:lead` from a prompt naming them, but they are model-invocable like the blocks `implement-part`, `repair-wave` and `judge`, which all carry `Use when ... or when the lead ...`. They get the same clause, so the rule stays on for every `bdk` skill.
- Alternative: turn the rule off for `user-invocable: false` skills. Lost: the rule has no such filter, and turning it off for the whole `bdk` target would also stop checking user skills.

### D5: `Load it` is a trigger clause for `bdk-craft` and `bdk-explain`
Their descriptions were admitted by with/without evals (`evals/RESULTS.md`); rewording them would invalidate that measurement. Their trigger reads `Load it when|before ...`, so their targets set `description-front-loaded`'s `trigger` option to also accept `Load it (when|before|whenever)`.

### D6: Error fixes keep the meaning
- `diagnose-run`: `.bdk/runs/<change>/` becomes "the run directory of the Change under .bdk/runs/".
- `execute-waves`: the default of `policy.escalation.model` is named as "the most capable model"; `bdk config show` above prints the value with origin `default`. The example result line says "on the escalation model".
- `spec-conformance`: the example absolute argument becomes `$HOME/ledger.json`, whose join to the current directory shows the same mistake.
- `profile-add`: the placeholder names "the user's global .gitconfig in their home directory".

## Risks / Trade-offs

- Strict mode fails a PR on a new default-warning rule after a kit update -> the fix is a description edit or a config option, both one line.
