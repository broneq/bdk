## Why

Tracks #298. `design-draft-lavish` scored 0.47 and 0.53 over 3 runs on a Mac (2026-10-09, Claude Code 2.1.292, `--runs 3 --ablation none`): in the failing runs no Lavish page is written and no spec or design follows, so the case measures the sandbox, not `design-draft`.

Reproduced on 2026-10-09 with npm 11.19 and the case's scaffold: the `lavish-axi` stub in the workspace's `node_modules/.bin` runs offline (`npx` finds it before any registry lookup). What reaches `registry.npmjs.org` is npm's own update check: under the clean `HOME` of "Host limits" npm has no `_update-notifier-last-checked` stamp, so every `npm`/`npx` call fetches `npm@latest` in the background (`NODE_DEBUG=net` shows the connection). In a run the sandbox denies it and Claude Code appends `<sandbox_violations> deny network-outbound registry.npmjs.org:443` to the command's output, although the stub answered. The model reads that as a failure and runs the Lavish CLI again as `npx -y lavish-axi <page>; echo "exit=$?"`, a compound command the grant `Bash(npx -y lavish-axi *)` does not cover; don't-ask mode denies it and the designer falls back to asking in its reply.

## What Changes

- The `eval` script (`plugins/bdk/evals/run.ts`) starts the runs with `npm_config_update_notifier=false`, so no `npm`/`npx` call of a case reaches the registry for npm's update check. Every case that calls `npx` gains it (the five `lavish-axi` stub cases, the `setup-*` cases, the `npx -y @fission-ai/openspec` fallback).
- `design-draft`, `design` and `triage` run each Lavish command as a Bash command of its own, without `;`, `&&`, pipes or `echo`, as `setup` already does: the tool result carries the exit code, and a compound command is not covered by the skill's grant (denied in a run, a permission prompt for a user).
- `design-draft-lavish` and `triage-lavish` gain a grader that fails a Lavish command chained with another.
- `plugins/bdk/evals/README.md` "Host limits" names the update check and the setting.

To resolve in the spec - where the fix belongs: in the run environment (the cause is npm, not the stub, so a stub change cannot fix it, and a `.npmrc` per scaffold would repeat it in five places and miss the other `npx` callers) and in the skill text (the compound command is a skill defect that also costs a real user a permission prompt). The case grants stay: widening them to cover `; echo` would hide the defect. See design.md D1-D3.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: the local run turns off npm's update check.
- `design-blocks`: Lavish commands run as commands of their own.
- `triage-block`: Lavish commands run as commands of their own.

## Impact

- `plugins/bdk/evals/run.ts`, `plugins/bdk/tests/evals.test.ts`, `plugins/bdk/evals/README.md`.
- `plugins/bdk/skills/design-draft/SKILL.md`, `plugins/bdk/skills/design/SKILL.md`, `plugins/bdk/skills/triage/SKILL.md`.
- `plugins/bdk/evals/design-draft-lavish/graders/`, `plugins/bdk/evals/triage-lavish/graders/`.
- User docs: no Guide or Concepts page changes. The skills ask through the same surfaces in the same order; only the shape of their Bash calls changes, which no page describes. The Reference is regenerated with `pnpm docs:reference`.
